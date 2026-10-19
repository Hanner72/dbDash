// Assetto Corsa Competizione: liest das Shared Memory (eigenes Auto) und die Broadcasting-Schnittstelle (alle Autos)
// und übersetzt beides in das Datenformat von dbDash (gleiche Namen wie bei iRacing), damit state.js unverändert bleibt.
//
// Shared Memory laut „ACC Shared Memory Documentation“ (Kunos): Local\acpmf_physics / acpmf_graphics / acpmf_static,
// Strukturen mit 4-Byte-Ausrichtung, Texte als UTF-16 (wchar_t).
// Broadcasting laut Kunos-Broadcasting-SDK (Protokoll 4): UDP an 127.0.0.1:<updListenerPort> aus
// Dokumente\Assetto Corsa Competizione\Config\broadcasting.json.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const dgram = require('dgram');

const FILE_MAP_READ = 0x0004;
const NO_TIME = 2147483647; // ACC: „keine Zeit“

// ---------------- Shared Memory ----------------
class SharedMem {
  constructor(name) { this.name = name; this.base = null; this.handle = null; }
  static init() {
    if (SharedMem.k32 !== undefined) return SharedMem.k32;
    SharedMem.k32 = null;
    if (process.platform !== 'win32') return null;
    try {
      const koffi = require('koffi');
      const k32 = koffi.load('kernel32.dll');
      try { koffi.pointer('HANDLE', koffi.opaque()); } catch { /* schon definiert (iRacing-Leser) */ }
      SharedMem.koffi = koffi;
      SharedMem.k32 = {
        open: k32.func('HANDLE __stdcall OpenFileMappingW(uint32_t access, int inherit, str16 name)'),
        map: k32.func('void * __stdcall MapViewOfFile(HANDLE h, uint32_t access, uint32_t hi, uint32_t lo, size_t len)'),
        unmap: k32.func('int __stdcall UnmapViewOfFile(void *p)'),
        close: k32.func('int __stdcall CloseHandle(HANDLE h)'),
        // Electron erlaubt keine direkten Speicher-Views → in eigene Buffer kopieren (wie beim iRacing-Leser)
        copy: k32.func('void __stdcall RtlMoveMemory(_Out_ void *dst, void *src, size_t len)'),
      };
    } catch (e) { console.error('ACC-Shared-Memory:', e.message); }
    return SharedMem.k32;
  }
  open() {
    if (this.base) return true;
    const k = SharedMem.init();
    if (!k) return false;
    const h = k.open(FILE_MAP_READ, 0, this.name);
    if (!h) return false;
    const p = k.map(h, FILE_MAP_READ, 0, 0, 0);
    if (!p) { k.close(h); return false; }
    this.handle = h; this.base = p;
    return true;
  }
  read(len) {
    if (!this.open()) return null;
    const buf = Buffer.alloc(len);
    const addr = typeof this.base === 'bigint' ? this.base : SharedMem.koffi.address(this.base);
    SharedMem.k32.copy(buf, addr, len);
    return buf;
  }
  close() {
    const k = SharedMem.k32;
    if (k && this.base) k.unmap(this.base);
    if (k && this.handle) k.close(this.handle);
    this.base = this.handle = null;
  }
}

const f32 = (b, o) => b.readFloatLE(o);
const i32 = (b, o) => b.readInt32LE(o);
const arr = (b, o, n) => Array.from({ length: n }, (_, k) => b.readFloatLE(o + k * 4));
const wstr = (b, o, chars) => { const s = b.toString('utf16le', o, o + chars * 2); const z = s.indexOf('\0'); return z >= 0 ? s.slice(0, z) : s; };

// Physik (dein Auto) – Versatz in Bytes laut SPageFilePhysics
function parsePhysics(b) {
  return {
    packetId: i32(b, 0), gas: f32(b, 4), brake: f32(b, 8), fuel: f32(b, 12), gear: i32(b, 16), rpms: i32(b, 20),
    steerAngle: f32(b, 24), speedKmh: f32(b, 28), velocity: arr(b, 32, 3), wheelsPressure: arr(b, 88, 4),
    tyreCoreTemperature: arr(b, 152, 4), heading: f32(b, 208), carDamage: arr(b, 224, 5), pitLimiterOn: i32(b, 248),
    airTemp: f32(b, 288), roadTemp: f32(b, 292), clutch: f32(b, 364), brakeBias: f32(b, 564), waterTemp: f32(b, 712),
    isEngineRunning: i32(b, 780),
  };
}
// Grafik (Session, Zeiten, alle Auto-Positionen) – SPageFileGraphic
function parseGraphics(b) {
  const active = Math.max(0, Math.min(60, i32(b, 252)));
  const coords = [], ids = [];
  for (let k = 0; k < active; k++) { coords.push(arr(b, 256 + k * 12, 3)); ids.push(i32(b, 976 + k * 4)); }
  return {
    packetId: i32(b, 0), status: i32(b, 4), session: i32(b, 8), completedLaps: i32(b, 132), position: i32(b, 136),
    iCurrentTime: i32(b, 140), iLastTime: i32(b, 144), iBestTime: i32(b, 148), sessionTimeLeft: f32(b, 152),
    isInPit: i32(b, 160), tyreCompound: wstr(b, 176, 33), normalizedCarPosition: f32(b, 248), activeCars: active,
    carCoordinates: coords, carID: ids, playerCarID: i32(b, 1216), flag: i32(b, 1224), isInPitLane: i32(b, 1236),
    TC: i32(b, 1268), TCCut: i32(b, 1272), EngineMap: i32(b, 1276), ABS: i32(b, 1280), fuelXLap: f32(b, 1284),
    iDeltaLapTime: i32(b, 1360), iEstimatedLapTime: i32(b, 1396), isDeltaPositive: i32(b, 1400), isValidLap: i32(b, 1408),
    fuelEstimatedLaps: f32(b, 1412), clock: f32(b, 1488), gapAhead: i32(b, 1580), gapBehind: i32(b, 1584),
  };
}
// Statisch (Auto, Strecke, Name) – SPageFileStatic
function parseStatic(b) {
  return {
    smVersion: wstr(b, 0, 15), acVersion: wstr(b, 30, 15), numCars: i32(b, 64), carModel: wstr(b, 68, 33), track: wstr(b, 134, 33),
    playerName: wstr(b, 200, 33), playerSurname: wstr(b, 266, 33), maxRpm: i32(b, 412), maxFuel: f32(b, 416),
  };
}

// ---------------- Broadcasting (UDP) ----------------
const OUT = { REGISTER: 1, UNREGISTER: 9, ENTRY_LIST: 10, TRACK_DATA: 11 };
const IN = { REGISTRATION: 1, REALTIME: 2, REALTIME_CAR: 3, ENTRY_LIST: 4, TRACK_DATA: 5, ENTRY_LIST_CAR: 6 };

class Reader {
  constructor(buf) { this.b = buf; this.o = 0; }
  u8() { return this.b.readUInt8(this.o++); }
  u16() { const v = this.b.readUInt16LE(this.o); this.o += 2; return v; }
  i32() { const v = this.b.readInt32LE(this.o); this.o += 4; return v; }
  f32() { const v = this.b.readFloatLE(this.o); this.o += 4; return v; }
  str() { const n = this.u16(); const s = this.b.toString('utf8', this.o, this.o + n); this.o += n; return s; }
  lap() {
    const lap = { ms: this.i32(), carIndex: this.u16(), driverIndex: this.u16() };
    const splits = this.u8(); this.o += splits * 4;
    lap.invalid = this.u8() > 0; lap.validForBest = this.u8() > 0; lap.outlap = this.u8() > 0; lap.inlap = this.u8() > 0;
    if (lap.ms === NO_TIME || lap.ms <= 0) lap.ms = null;
    return lap;
  }
}
const writeStr = (s) => { const b = Buffer.from(String(s), 'utf8'); const h = Buffer.alloc(2); h.writeUInt16LE(b.length); return Buffer.concat([h, b]); };

// Nachrichten der Broadcasting-Schnittstelle in den Zustand einarbeiten (getrennt testbar)
function handleBroadcast(st, msg) {
  const r = new Reader(msg);
  const type = r.u8();
  if (type === IN.REGISTRATION) {
    st.connectionId = r.i32(); st.registered = r.u8() > 0; r.u8(); st.error = r.str() || null;
    return st.registered ? 'registered' : 'rejected';
  }
  if (type === IN.REALTIME) {
    const u = { eventIndex: r.u16(), sessionIndex: r.u16(), sessionType: r.u8(), phase: r.u8(), sessionTime: r.f32(), sessionEndTime: r.f32(), focusedCar: r.i32() };
    r.str(); r.str(); r.str();
    if (r.u8() > 0) { r.f32(); r.f32(); }
    u.timeOfDay = r.f32(); u.ambientTemp = r.u8(); u.trackTemp = r.u8();
    st.session = u; st.lastData = Date.now();
    return 'realtime';
  }
  if (type === IN.REALTIME_CAR) {
    const c = { carIndex: r.u16(), driverIndex: r.u16(), driverCount: r.u8(), gear: r.u8() - 2, x: r.f32(), y: r.f32(), yaw: r.f32(),
      location: r.u8(), kmh: r.u16(), position: r.u16(), cupPosition: r.u16(), trackPosition: r.u16(), spline: r.f32(), laps: r.u16(), delta: r.i32() };
    c.best = r.lap(); c.last = r.lap(); c.current = r.lap();
    st.cars.set(c.carIndex, c); st.lastData = Date.now();
    return st.entries.has(c.carIndex) ? 'car' : 'unknown-car';
  }
  if (type === IN.ENTRY_LIST) {
    r.i32(); const n = r.u16(); const ids = new Set();
    for (let k = 0; k < n; k++) ids.add(r.u16());
    for (const id of [...st.entries.keys()]) if (!ids.has(id)) st.entries.delete(id);
    for (const id of [...st.cars.keys()]) if (!ids.has(id)) st.cars.delete(id);
    return 'entrylist';
  }
  if (type === IN.ENTRY_LIST_CAR) {
    const e = { carIndex: r.u16(), model: r.u8(), team: r.str(), raceNumber: r.i32(), cup: r.u8(), currentDriver: r.u8(), nationality: r.u16(), drivers: [] };
    const n = r.u8();
    for (let k = 0; k < n; k++) e.drivers.push({ first: r.str(), last: r.str(), short: r.str(), category: r.u8(), nationality: r.u16() });
    st.entries.set(e.carIndex, e);
    return 'entry';
  }
  if (type === IN.TRACK_DATA) {
    r.i32(); st.trackName = r.str(); st.trackId = r.i32(); st.trackMeters = r.i32();
    return 'track';
  }
  return 'other';
}

// broadcasting.json lesen/einrichten (ACC speichert sie meist als UTF-16)
// Testhilfe DBDASH_ACC_CONFIG = anderer Pfad (z. B. für ein simuliertes ACC)
function broadcastingFile() { return process.env.DBDASH_ACC_CONFIG || path.join(os.homedir(), 'Documents', 'Assetto Corsa Competizione', 'Config', 'broadcasting.json'); }
function readBroadcastingConfig(file = broadcastingFile()) {
  try {
    const raw = fs.readFileSync(file);
    const utf16 = raw[0] === 0xff && raw[1] === 0xfe || (raw.length > 1 && raw[1] === 0);
    const txt = (utf16 ? raw.toString('utf16le') : raw.toString('utf8')).replace(/^﻿/, '');
    const j = JSON.parse(txt);
    return { exists: true, port: Number(j.updListenerPort) || 0, password: String(j.connectionPassword || ''), utf16, json: j };
  } catch { return { exists: false, port: 0, password: '' }; }
}
// Schnittstelle einschalten (Port 9000), alte Datei als .bak sichern; ACC muss danach neu gestartet werden
function setupBroadcasting(file = broadcastingFile()) {
  const cur = readBroadcastingConfig(file);
  const j = { ...(cur.json || {}), updListenerPort: cur.port || 9000, connectionPassword: cur.password || 'dbdash', commandPassword: (cur.json && cur.json.commandPassword) || '' };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (cur.exists) fs.copyFileSync(file, file + '.bak');
  const txt = JSON.stringify(j, null, 2);
  fs.writeFileSync(file, cur.exists && !cur.utf16 ? txt : Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(txt, 'utf16le')]));
  return readBroadcastingConfig(file);
}

class Broadcast {
  constructor() {
    this.sock = null;
    this.st = { cars: new Map(), entries: new Map(), session: null, trackMeters: 0, trackName: '', connectionId: -1, registered: false, lastData: 0, error: null };
    this.cfg = null; this.lastRegister = 0; this.lastEntryReq = 0;
  }
  get ok() { return this.st.registered && Date.now() - this.st.lastData < 5000; }
  send(buf) { if (this.sock && this.cfg) this.sock.send(buf, this.cfg.port, '127.0.0.1'); }
  register() {
    this.lastRegister = Date.now();
    this.cfg = readBroadcastingConfig();
    if (!this.cfg.port) return;
    if (!this.sock) {
      this.sock = dgram.createSocket('udp4');
      this.sock.on('message', (m) => this.onMessage(m));
      this.sock.on('error', () => { try { this.sock.close(); } catch { } this.sock = null; });
      this.sock.bind(0, '127.0.0.1');
    }
    const head = Buffer.from([OUT.REGISTER, 4]);
    const iv = Buffer.alloc(4); iv.writeInt32LE(100); // 10 Aktualisierungen pro Sekunde
    this.send(Buffer.concat([head, writeStr('dbDash'), writeStr(this.cfg.password), iv, writeStr('')]));
  }
  request(type) { const b = Buffer.alloc(5); b[0] = type; b.writeInt32LE(this.st.connectionId, 1); this.send(b); }
  onMessage(m) {
    let res;
    try { res = handleBroadcast(this.st, m); } catch { return; }
    if (res === 'registered') { this.request(OUT.ENTRY_LIST); this.request(OUT.TRACK_DATA); }
    if (res === 'unknown-car' && Date.now() - this.lastEntryReq > 1000) { this.lastEntryReq = Date.now(); this.request(OUT.ENTRY_LIST); }
  }
  // regelmäßig aufrufen: (neu) anmelden, wenn keine Daten kommen
  tick() { if (!this.ok && Date.now() - this.lastRegister > 3000) this.register(); }
  status() { return !this.cfg || !this.cfg.port ? 'off' : this.ok ? 'ok' : this.st.error ? 'error' : 'connecting'; }
  close() {
    if (this.sock) { try { if (this.st.connectionId >= 0) this.request(OUT.UNREGISTER); this.sock.close(); } catch { } }
    this.sock = null; this.st.registered = false;
  }
}

// ---------------- Übersetzung ins dbDash-Format ----------------
// Fahrzeugmodelle (carModelType) laut Broadcasting-SDK → Name und Klasse
const MODELS = {
  0: 'Porsche 991 GT3 R', 1: 'Mercedes-AMG GT3', 2: 'Ferrari 488 GT3', 3: 'Audi R8 LMS', 4: 'Lamborghini Huracán GT3', 5: 'McLaren 650S GT3',
  6: 'Nissan GT-R Nismo GT3 2018', 7: 'BMW M6 GT3', 8: 'Bentley Continental GT3 2018', 9: 'Porsche 991 II GT3 Cup', 10: 'Nissan GT-R Nismo GT3 2017',
  11: 'Bentley Continental GT3 2016', 12: 'Aston Martin V12 Vantage GT3', 13: 'Lamborghini Gallardo R-EX', 14: 'Jaguar G3', 15: 'Lexus RC F GT3',
  16: 'Lamborghini Huracán GT3 EVO', 17: 'Honda NSX GT3', 18: 'Lamborghini Huracán Super Trofeo', 19: 'Audi R8 LMS EVO', 20: 'Aston Martin V8 Vantage GT3',
  21: 'Honda NSX GT3 EVO', 22: 'McLaren 720S GT3', 23: 'Porsche 991 II GT3 R', 24: 'Ferrari 488 GT3 EVO', 25: 'Mercedes-AMG GT3 2020',
  26: 'Ferrari 488 Challenge EVO', 27: 'BMW M2 CS Racing', 28: 'Porsche 992 GT3 Cup', 29: 'Lamborghini Huracán Super Trofeo EVO2',
  30: 'BMW M4 GT3', 31: 'Audi R8 LMS GT3 EVO II', 32: 'Ferrari 296 GT3', 33: 'Lamborghini Huracán GT3 EVO2', 34: 'Porsche 992 GT3 R',
  35: 'McLaren 720S GT3 EVO', 36: 'Ford Mustang GT3',
  50: 'Alpine A110 GT4', 51: 'Aston Martin V8 Vantage GT4', 52: 'Audi R8 LMS GT4', 53: 'BMW M4 GT4', 55: 'Chevrolet Camaro GT4', 56: 'Ginetta G55 GT4',
  57: 'KTM X-Bow GT4', 58: 'Maserati MC GT4', 59: 'McLaren 570S GT4', 60: 'Mercedes-AMG GT4', 61: 'Porsche 718 Cayman GT4',
  80: 'Audi R8 LMS GT2', 82: 'KTM X-Bow GT2', 83: 'Maserati MC20 GT2', 84: 'Mercedes-AMG GT2', 85: 'Porsche 911 GT2 RS CS EVO', 86: 'Porsche 935',
};
const CLASSES = { GT3: [1, 0xffc04a], GT4: [2, 0x5ac8fa], GT2: [3, 0xff5a5a], CUP: [4, 0xc08bff], ST: [5, 0x3ddc84], CHL: [6, 0xff8a6a], TCX: [7, 0x8b94a3] };
function modelClass(m) {
  if ([9, 28].includes(m)) return 'CUP';
  if ([18, 29].includes(m)) return 'ST';
  if (m === 26) return 'CHL';
  if (m === 27) return 'TCX';
  if (m >= 80) return 'GT2';
  if (m >= 50) return 'GT4';
  return 'GT3';
}
const SESSION_TYPES = { 0: 'Practice', 1: 'Qualify', 2: 'Race', 3: 'Hotlap', 4: 'Time Attack', 7: 'Hotstint', 8: 'Superpole' };
// ACC-Flaggen → Bits wie bei iRacing (SessionFlags)
const FLAGS = { 1: 0x20, 2: 0x8, 3: 0x10000, 4: 0x2, 5: 0x1, 7: 0x4 };
// Seite eines Autos neben dir aus Weltkoordinaten (ACC hat keinen Spotter): +1 rechts, −1 links (Vorzeichen bei Bedarf drehen)
const SIDE_SIGN = 1;

function buildFrame(ph, gx, stc, bc, prevSession) {
  const valid = (ms) => ms > 0 && ms < NO_TIME;
  const me = gx.playerCarID;
  const best = valid(gx.iBestTime) ? gx.iBestTime / 1000 : -1;
  const last = valid(gx.iLastTime) ? gx.iLastTime / 1000 : -1;
  const est = valid(gx.iEstimatedLapTime) ? gx.iEstimatedLapTime / 1000 : null;
  const refLap = best > 0 ? best : last > 0 ? last : est || 120;
  const sessionType = SESSION_TYPES[gx.session] || 'Practice';
  const phase = bc && bc.session ? bc.session.phase : 5;
  const isRace = sessionType === 'Race';

  // Autos: aus Broadcasting (alle), sonst nur das eigene
  const cars = [];
  if (bc && bc.cars.size) {
    for (const c of bc.cars.values()) {
      const e = bc.entries.get(c.carIndex);
      const d = e && (e.drivers[e.currentDriver] || e.drivers[0]);
      cars.push({ idx: c.carIndex, rt: c, e, name: d ? `${d.first} ${d.last}`.trim() : `#${e ? e.raceNumber : c.carIndex}` });
    }
  }
  if (!cars.some((c) => c.idx === me)) cars.push({ idx: me, rt: null, e: null, name: `${stc.playerName} ${stc.playerSurname}`.trim() || 'Ich' });

  const n = Math.min(512, Math.max(64, ...cars.map((c) => c.idx + 1)));
  const A = (v) => new Array(n).fill(v);
  const pct = A(-1), lapC = A(-1), lapS = A(-1), pos = A(0), cpos = A(0), f2 = A(0), pit = A(false), bestA = A(-1), lastA = A(-1), surf = A(-1), estA = A(0), tyre = A(-1);
  const leaderDist = Math.max(0, ...cars.filter((c) => c.rt).map((c) => c.rt.laps + c.rt.spline));
  const classOf = (c) => modelClass(c.e ? c.e.model : -1);
  for (const c of cars) {
    const i = c.idx, r = c.rt;
    if (r) {
      pct[i] = r.spline; lapC[i] = r.laps; lapS[i] = r.laps + 1; pos[i] = r.position;
      pit[i] = r.location >= 2 && r.location <= 4; surf[i] = pit[i] ? 2 : 3;
      bestA[i] = r.best.ms ? r.best.ms / 1000 : -1; lastA[i] = r.last.ms ? r.last.ms / 1000 : -1;
      estA[i] = r.spline * refLap; f2[i] = Math.max(0, (leaderDist - (r.laps + r.spline)) * refLap);
    } else if (i === me) {
      pct[i] = gx.normalizedCarPosition; lapC[i] = gx.completedLaps; lapS[i] = gx.completedLaps + 1; pos[i] = gx.position;
      pit[i] = !!gx.isInPitLane; surf[i] = 3; bestA[i] = best; lastA[i] = last; estA[i] = gx.normalizedCarPosition * refLap;
    }
  }
  // Klassenposition aus der Gesamtposition
  const byClass = {};
  for (const c of cars) if (pos[c.idx] > 0) (byClass[classOf(c)] = byClass[classOf(c)] || []).push(c);
  for (const list of Object.values(byClass)) list.sort((a, b) => pos[a.idx] - pos[b.idx]).forEach((c, k) => { cpos[c.idx] = k + 1; });
  tyre[me] = /wet/i.test(gx.tyreCompound) ? 1 : 0;

  // Autos neben dir aus den Weltkoordinaten (für die Seitenwarnung des Radars)
  let left = 0, right = 0;
  const k = gx.carID.indexOf(me);
  const sp = Math.hypot(ph.velocity[0], ph.velocity[2]);
  if (k >= 0 && sp > 2) {
    const [px, , pz] = gx.carCoordinates[k];
    const fx = ph.velocity[0] / sp, fz = ph.velocity[2] / sp;
    gx.carCoordinates.forEach(([x, , z], j) => {
      if (j === k) return;
      const dx = x - px, dz = z - pz;
      const along = dx * fx + dz * fz, side = (dx * fz - dz * fx) * SIDE_SIGN;
      if (Math.abs(along) < 5 && Math.abs(side) > 1 && Math.abs(side) < 6) { if (side > 0) right++; else left++; }
    });
  }
  const carLeftRight = left && right ? 4 : left > 1 ? 5 : right > 1 ? 6 : left ? 2 : right ? 3 : 1;

  const gear = ph.gear - 1; // ACC: 0 = R, 1 = N, 2 = 1. Gang
  const remain = gx.sessionTimeLeft > 0 ? gx.sessionTimeLeft / 1000 : -1;
  const maxRpm = stc.maxRpm || 8000;
  const pressure = (psi) => psi * 6.89476; // psi → kPa (wie iRacing)
  const t = ph.tyreCoreTemperature;
  const data = {
    PlayerCarIdx: me, SessionNum: 0, SessionUniqueID: bc && bc.session ? `${bc.session.eventIndex}-${bc.session.sessionIndex}` : `acc-${gx.session}`,
    SessionState: isRace ? (phase < 5 ? 3 : phase === 5 ? 4 : 5) : 4,
    SessionTime: bc && bc.session ? bc.session.sessionTime / 1000 : 0, SessionTimeRemain: remain, SessionLapsRemainEx: 32767,
    SessionFlags: FLAGS[gx.flag] || 0, IsOnTrack: gx.status === 2, OnPitRoad: !!gx.isInPitLane,
    Speed: ph.speedKmh / 3.6, Gear: gear, RPM: ph.rpms, Throttle: ph.gas, Brake: ph.brake, Clutch: 1 - ph.clutch,
    SteeringWheelAngle: -ph.steerAngle * 4.71, SteeringWheelAngleMax: 4.71, // ±270° (ACC liefert nur −1 … 1)
    FuelLevel: ph.fuel, FuelLevelPct: stc.maxFuel ? ph.fuel / stc.maxFuel : null,
    EngineWarnings: (ph.pitLimiterOn ? 0x10 : 0) | (ph.isEngineRunning || ph.rpms > 300 ? 0 : 0x08),
    dcTractionControl: gx.TC, dcTractionControl2: gx.TCCut, dcABS: gx.ABS, dcEnginePower: gx.EngineMap + 1, dcBrakeBias: ph.brakeBias > 0 ? ph.brakeBias * 100 : null,
    WaterTemp: ph.waterTemp || null, AirTemp: ph.airTemp, TrackTempCrew: ph.roadTemp, CarLeftRight: carLeftRight,
    LFtempCL: t[0], LFtempCM: t[0], LFtempCR: t[0], RFtempCL: t[1], RFtempCM: t[1], RFtempCR: t[1],
    LRtempCL: t[2], LRtempCM: t[2], LRtempCR: t[2], RRtempCL: t[3], RRtempCM: t[3], RRtempCR: t[3],
    LFpressure: pressure(ph.wheelsPressure[0]), RFpressure: pressure(ph.wheelsPressure[1]), LRpressure: pressure(ph.wheelsPressure[2]), RRpressure: pressure(ph.wheelsPressure[3]),
    Lap: gx.completedLaps + 1, LapCompleted: gx.completedLaps, LapCurrentLapTime: gx.iCurrentTime / 1000,
    LapLastLapTime: last, LapBestLapTime: best,
    // ACC liefert die voraussichtliche Rundenzeit direkt – Delta = Prognose − Bestzeit (Prognose bleibt so exakt ACCs Wert)
    LapDeltaToSessionBestLap: best > 0 && est ? est - best : 0, LapDeltaToSessionBestLap_OK: !!(best > 0 && est),
    LapDeltaToSessionLastlLap: last > 0 && est ? est - last : 0, LapDeltaToSessionLastlLap_OK: !!(last > 0 && est),
    CarIdxLapDistPct: pct, CarIdxLapCompleted: lapC, CarIdxLap: lapS, CarIdxPosition: pos, CarIdxClassPosition: cpos, CarIdxF2Time: f2,
    CarIdxOnPitRoad: pit, CarIdxBestLapTime: bestA, CarIdxLastLapTime: lastA, CarIdxTrackSurface: surf, CarIdxEstTime: estA, CarIdxTireCompound: tyre,
  };
  const drivers = cars.map((c) => {
    const cls = classOf(c), [classId, color] = CLASSES[cls];
    return {
      CarIdx: c.idx, UserName: c.name, TeamName: c.e ? c.e.team : '', CarNumber: String(c.e ? c.e.raceNumber : ''),
      CarClassID: classId, CarClassShortName: cls, CarClassColor: color, CarClassEstLapTime: refLap,
      CarScreenName: c.e ? MODELS[c.e.model] || '' : stc.carModel, IsSpectator: 0, CarIsPaceCar: 0,
    };
  });
  const session = {
    WeekendInfo: { TrackDisplayName: (bc && bc.trackName) || stc.track, TrackLength: `${((bc && bc.trackMeters) || 5000) / 1000} km` },
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: sessionType }] },
    DriverInfo: {
      DriverCarIdx: me, Drivers: drivers, DriverCarFuelMaxLtr: stc.maxFuel, DriverCarMaxFuelPct: 1,
      DriverCarRedLine: maxRpm, DriverCarSLFirstRPM: maxRpm * 0.8, DriverCarSLShiftRPM: maxRpm * 0.95, DriverCarSLLastRPM: maxRpm * 0.97, DriverCarSLBlinkRPM: maxRpm * 0.985,
      DriverTires: [{ TireIndex: 0, TireCompoundType: 'Dry' }, { TireIndex: 1, TireCompoundType: 'Wet' }],
    },
  };
  // gleiche Objekt-Identität, solange sich die Fahrerliste nicht ändert (spart Arbeit beim Weiterverarbeiten)
  const key = JSON.stringify(session);
  return { data, session: prevSession && prevSession.key === key ? prevSession.session : Object.assign(session, {}), key };
}

class ACC {
  constructor() {
    this.phys = new SharedMem('Local\\acpmf_physics');
    this.gfx = new SharedMem('Local\\acpmf_graphics');
    this.stat = new SharedMem('Local\\acpmf_static');
    this.bc = new Broadcast();
    this.prev = null; this.lastPacket = -1; this.lastChange = 0; this.raw = null;
  }
  get available() { return !!SharedMem.init(); }

  // {data, session, game, caps} oder null, wenn ACC nicht läuft
  read() {
    const pb = this.phys.read(800), gb = pb && this.gfx.read(1600), sb = gb && this.stat.read(440);
    if (!pb || !gb || !sb) return null;
    const ph = parsePhysics(pb), gx = parseGraphics(gb), stc = parseStatic(sb);
    if (!stc.smVersion || gx.status === 0) { this.bc.close(); return null; } // ACC läuft, aber keine Session (Menü)
    // hängt die Simulation (Paket-Nummer bleibt stehen, außer Pause/Replay), als getrennt melden
    const now = Date.now();
    if (ph.packetId !== this.lastPacket) { this.lastPacket = ph.packetId; this.lastChange = now; }
    else if (gx.status === 2 && now - this.lastChange > 2000) return null;
    this.bc.tick();
    const f = buildFrame(ph, gx, stc, this.bc.ok ? this.bc.st : null, this.prev);
    this.prev = f;
    this.raw = { physics: ph, graphics: { ...gx, carCoordinates: undefined }, static: stc, broadcast: this.bc.status() };
    return { data: f.data, session: f.session, game: 'acc', caps: CAPS };
  }
  // Zustand der Broadcasting-Verbindung (für den Hinweis im Einstellungsfenster) – ohne Datei-Zugriff im Takt
  status() { return { game: 'acc', broadcast: this.bc.status(), port: this.bc.cfg ? this.bc.cfg.port : 0 }; }
  close() { this.phys.close(); this.gfx.close(); this.stat.close(); this.bc.close(); }
}
// Was ACC (anders als iRacing) nicht liefert → passende Spalten/Anzeigen ausblenden
const CAPS = { iRating: false, license: false, incidents: false, flags: false, tyres: false, damage: false };

module.exports = { ACC, parsePhysics, parseGraphics, parseStatic, handleBroadcast, buildFrame, readBroadcastingConfig, setupBroadcasting, modelClass, MODELS };
