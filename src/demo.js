// Demo-Modus: simuliert ein Mehrklassen-Rennen und liefert Daten im selben
// Format wie das iRacing-SDK. So lassen sich alle Overlays ohne Spiel testen.
'use strict';

const FLAIRS = ['Austria', 'Germany', 'Spain', 'Austria', 'Japan', 'Switzerland', 'Sweden', 'Germany', 'Italy', 'Germany',
  'Romania', 'Czechia', 'France', 'Austria', 'Netherlands', 'England', 'Japan', 'Germany'];
// Startplätze innerhalb der Klasse (0-basiert, wie in iRacings QualifyResultsInfo)
const GRID = [2, 0, 4, 1, 5, 3, 6, 9, 3, 0, 11, 7, 5, 1, 10, 2, 8, 4];
const NAMES = [
  'Lukas Brandner', 'Marie Kogler', 'Tomás Herrera', 'Jonas Weidinger', 'Aiko Tanaka', 'Felix Hofer',
  'Sven Lindqvist', 'Paula Gruber', 'Matteo Ricci', 'Noah Fischer', 'Elena Popescu', 'Jakub Novák',
  'Sophie Laurent', 'David Steiner', 'Lena Moser', 'Oliver Wright', 'Kenji Mori', 'Clara Huber',
];

// Streckenprofil: Kurven mit Position (0..1), Mindestgeschwindigkeit (Anteil), Lenkrichtung
const CORNERS = [
  { at: 0.08, v: 0.38, dir: 1, len: 0.025 }, { at: 0.19, v: 0.62, dir: -1, len: 0.03 },
  { at: 0.31, v: 0.30, dir: -1, len: 0.02 }, { at: 0.44, v: 0.72, dir: 1, len: 0.04 },
  { at: 0.55, v: 0.45, dir: 1, len: 0.025 }, { at: 0.63, v: 0.50, dir: -1, len: 0.02 },
  { at: 0.78, v: 0.33, dir: 1, len: 0.025 }, { at: 0.91, v: 0.58, dir: -1, len: 0.03 },
];
const N = 2000;
const TRACK_M = 5200;  // Streckenlänge Demo Ring
const BATTLE = 10;     // dieses Auto fährt im Demo-Modus Rad an Rad mit dir (für das Radar)
const VMAX = 74; // m/s ~ 266 km/h

function buildProfile() {
  const v = new Float64Array(N).fill(1);
  for (const c of CORNERS) {
    for (let k = 0; k < N; k++) {
      const p = k / N;
      let d = p - c.at; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
      let f;
      if (Math.abs(d) <= c.len / 2) f = c.v;                         // in der Kurve
      else if (d < 0) f = c.v + (1 - c.v) * Math.min(1, (-d - c.len / 2) / 0.035); // Bremszone (kurz)
      else f = c.v + (1 - c.v) * Math.min(1, (d - c.len / 2) / 0.09);              // Beschleunigung (lang)
      v[k] = Math.min(v[k], f);
    }
  }
  // kumulierte Zeit (relativ) für Est-Time
  const cum = new Float64Array(N + 1);
  for (let k = 0; k < N; k++) cum[k + 1] = cum[k] + 1 / v[k];
  const total = cum[N];
  for (let k = 0; k <= N; k++) cum[k] /= total;
  return { v, cum };
}
const PROFILE = buildProfile();
const at = (arr, p) => arr[Math.min(N - 1, Math.max(0, Math.floor(((p % 1) + 1) % 1 * N)))];
const cumAt = (p) => { p = ((p % 1) + 1) % 1; const x = p * N, k = Math.floor(x); return PROFILE.cum[k] + (PROFILE.cum[Math.min(N, k + 1)] - PROFILE.cum[k]) * (x - k); };

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

class Demo {
  constructor() {
    const r = rnd(42);
    this.player = 5;
    this.cars = [];
    for (let i = 0; i < 18; i++) {
      const proto = i < 6; // Prototypen-Klasse
      const base = proto ? 92.5 + r() * 2.4 : 101.0 + r() * 2.8;
      this.cars.push({
        idx: i, proto, base,
        lapTime: base, // aktuelle Rundenzeit
        lap: 0,
        // in Fahrtrichtung gestaffelt, alle ab Start
        prog: -(i * 0.012) - (proto ? 0 : 0.05),
        last: 0, best: 0,
        iR: Math.round(1400 + r() * 3200),
        lic: ['A', 'B', 'C', 'A', 'B'][i % 5],
        sr: (1.5 + r() * 3).toFixed(2),
        inc: [0, 0, 2, 4, 1, 0, 6, 2, 0, 8, 2, 4, 0, 1, 12, 4, 2, 0][i],
      });
    }
    // Spieler: GT3 im Mittelfeld
    this.player = 8;
    this.cars[this.player].base = 101.6;
    this.r = r;
    this.t = 0;
    this.raceLen = 45 * 60;
    this.session = this._session();
    // ein paar Runden vorsimulieren, damit Rundenzeiten und Abstände sofort sichtbar sind
    for (let k = 0; k < 20000; k++) this.step(0.05);
  }

  _session() {
    const GT3_CARS = ['BMW M4 GT3', 'Mercedes-AMG GT3 2020', 'Porsche 911 GT3 R (992)', 'Ferrari 296 GT3', 'Audi R8 LMS EVO II GT3',
      'McLaren 720S GT3 EVO', 'Lamborghini Huracán GT3 EVO', 'Ford Mustang GT3', 'Chevrolet Corvette Z06 GT3.R', 'Aston Martin Vantage GT3 EVO'];
    const drivers = this.cars.map((c) => ({
      CarIdx: c.idx,
      UserName: NAMES[c.idx],
      AbbrevName: NAMES[c.idx],
      TeamName: NAMES[c.idx],
      CarNumber: String(c.proto ? 10 + c.idx * 3 : 30 + c.idx * 4),
      CarClassID: c.proto ? 1 : 2,
      CarClassShortName: c.proto ? 'LMP2' : 'GT3',
      CarClassColor: c.proto ? 0x5ac8fa : 0xffc04a,
      CarClassEstLapTime: c.proto ? 93.5 : 102.0,
      CarScreenName: c.proto ? 'Dallara P217' : GT3_CARS[c.idx % GT3_CARS.length],
      CarScreenNameShort: c.proto ? 'Dallara P217' : GT3_CARS[c.idx % GT3_CARS.length],
      IRating: c.iR,
      LicString: `${c.lic} ${c.sr}`,
      LicColor: { A: 0x0153db, B: 0x00c702, C: 0xfeec04 }[c.lic],
      // wie in offiziellen iRacing-Rennen: fremde Incidents sind während der Session verborgen (0)
      CurDriverIncidentCount: c.idx === this.player ? c.inc : 0,
      FlairName: FLAIRS[c.idx],
      IsSpectator: 0,
      CarIsPaceCar: 0,
    }));
    return {
      WeekendInfo: { TrackDisplayName: 'Demo Ring (Simulation)', TrackLength: '5.20 km', WeekendOptions: { IncidentLimit: '25' } },
      DriverInfo: {
        DriverCarIdx: this.player, Drivers: drivers,
        DriverCarRedLine: 7800, DriverCarSLFirstRPM: 6400, DriverCarSLShiftRPM: 7350, DriverCarSLLastRPM: 7550, DriverCarSLBlinkRPM: 7700,
        DriverTires: [{ TireIndex: 0, TireCompoundType: 'Soft' }, { TireIndex: 1, TireCompoundType: 'Medium' }, { TireIndex: 2, TireCompoundType: 'Hard' }, { TireIndex: 3, TireCompoundType: 'Wet' }],
        DriverCarFuelMaxLtr: 100, DriverCarMaxFuelPct: 1, DriverCarEstLapTime: 102,
      },
      SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
      QualifyResultsInfo: { Results: this.cars.map((c) => ({ CarIdx: c.idx, ClassPosition: GRID[c.idx], Position: GRID[c.idx] + (c.proto ? 0 : 6) })) },
    };
  }

  step(dt) {
    this.t += dt;
    for (const c of this.cars) {
      const p = ((c.prog % 1) + 1) % 1;
      // Geschwindigkeit laut Profil, skaliert auf die Rundenzeit
      const speedFrac = at(PROFILE.v, p);
      const dp = dt * speedFrac / (c.lapTime * meanV());
      const before = Math.floor(c.prog);
      c.prog += dp;
      if (Math.floor(c.prog) > before && c.prog > 0) {
        if (c.prog >= 1) {
          c.last = c.lapTime;
          if (!c.best || c.last < c.best) c.best = c.last;
        }
        c.lap = Math.floor(c.prog);
        c.lapTime = c.base * (1 + (this.r() - 0.4) * 0.012);
      }
    }
    // Nahkampf: ein Auto pendelt um dich herum (mal davor, mal daneben, mal dahinter)
    const me = this.cars[this.player], b = this.cars[BATTLE];
    const off = Math.sin(this.t / 6) * 24 + Math.sin(this.t / 1.7) * 3;
    b.prog = me.prog + off / TRACK_M;
    b.last = me.last + 0.15; b.best = me.best + 0.1;
  }

  read() {
    const cars = this.cars;
    const n = 64;
    const arr = (fill) => new Array(n).fill(fill);
    const pct = arr(-1), lapC = arr(-1), est = arr(0), pos = arr(0), cpos = arr(0), f2 = arr(0),
      pit = arr(false), last = arr(-1), best = arr(-1), surf = arr(-1);

    const total = (c) => c.prog;
    const order = [...cars].sort((a, b) => total(b) - total(a));
    const leader = order[0];
    const classOrder = { true: [], false: [] };
    order.forEach((c, k) => {
      const i = c.idx;
      const p = ((c.prog % 1) + 1) % 1;
      pct[i] = p;
      lapC[i] = Math.max(0, Math.floor(c.prog));
      est[i] = cumAt(p) * (c.proto ? 93.5 : 102.0);
      pos[i] = k + 1;
      classOrder[c.proto].push(c);
      cpos[i] = classOrder[c.proto].length;
      f2[i] = (total(leader) - total(c)) * (c.proto ? 93.5 : 102.0);
      last[i] = c.last || -1;
      best[i] = c.best || -1;
      // ab und zu ein kurzer Ausritt neben die Strecke (für die geschätzten Incidents der Gegner)
      const offCycle = 140 + i * 23;
      surf[i] = i !== this.player && i % 3 !== 0 && (this.t + i * 41) % offCycle < 1.5 ? 0 : 3;
      // ein Auto fährt alle paar Runden durch die Box
      pit[i] = c.idx === 14 && lapC[i] % 4 === 3 && (p > 0.94 || p < 0.04);
    });

    const me = cars[this.player];
    const p = ((me.prog % 1) + 1) % 1;
    const sp = at(PROFILE.v, p);
    const spAhead = at(PROFILE.v, p + 0.006);
    const braking = spAhead < sp - 0.004;
    const corner = CORNERS.reduce((bestC, c) => {
      let d = p - c.at; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
      return Math.abs(d) < Math.abs(bestC.d) ? { c, d } : bestC;
    }, { c: null, d: 9 });
    const inCorner = corner.c && Math.abs(corner.d) < corner.c.len / 2 + 0.02;
    const wob = Math.sin(this.t * 7) * 0.02;

    const speed = sp * VMAX;
    const gear = speed < 18 ? 2 : speed < 30 ? 3 : speed < 42 ? 4 : speed < 55 ? 5 : 6;
    const lo = [0, 0, 0, 18, 30, 42, 55][gear], hi = [0, 0, 18, 30, 42, 55, 80][gear];
    const rpm = 4200 + (speed - lo) / (hi - lo) * 3600;

    let throttle, brake, steer;
    if (braking) {
      throttle = 0;
      brake = Math.min(1, 0.55 + (sp - spAhead) * 25);
    } else {
      brake = 0;
      throttle = sp > 0.985 ? 1 : Math.min(1, Math.max(0.15, 0.35 + (spAhead - sp) * 60));
    }
    steer = inCorner ? corner.c.dir * (1 - corner.c.v) * 2.6 * (1 - Math.abs(corner.d) / (corner.c.len / 2 + 0.02)) : 0;
    steer += wob;

    // Delta zur besten Runde: aktuelle Runde vs. Bestzeit über die Streckenposition
    const delta = me.best ? cumAt(p) * (me.lapTime - me.best) : 0;

    // Seitenwarnung (wie der iRacing-Spotter): Autos, die sich mit dir überlappen
    let left = 0, right = 0;
    for (const c of cars) {
      if (c === me) continue;
      let dist = (c.prog - me.prog) * TRACK_M;
      dist -= Math.round(dist / TRACK_M) * TRACK_M;
      if (Math.abs(dist) < 5) { if (c.idx === BATTLE && Math.sin(this.t / 23) > 0) left++; else right++; }
    }
    const carLeftRight = left && right ? 4 : left > 1 ? 5 : right > 1 ? 6 : left ? 2 : right ? 3 : 1;

    // Blaue Flagge, wenn ein schnellerer Prototyp von hinten kommt
    let blue = false;
    for (const c of cars) {
      if (!c.proto) continue;
      let dist = (me.prog - c.prog) * TRACK_M;
      dist -= Math.round(dist / TRACK_M) * TRACK_M;
      if (dist > 0 && dist < 120) blue = true;
    }

    const fuel = Math.max(0, 88 - this.t * 0.034);
    const heat = (base, k) => base + Math.sin(this.t / 9 + k) * 2 + throttle * 3;
    const tyre = (k, inner) => [heat(inner ? 84 : 78, k), heat(81, k + 1), heat(inner ? 78 : 84, k + 2)];

    const d = {
      SessionNum: 0,
      SessionState: 4,
      PitRepairLeft: 0,
      PitOptRepairLeft: 23.6,
      dcFuelMixture: 2,
      dcTractionControl2: 6,
      FuelPress: 4.1,
      LFwearL: 0.91, LFwearM: 0.93, LFwearR: 0.95, RFwearL: 0.88, RFwearM: 0.9, RFwearR: 0.92,
      LRwearL: 0.95, LRwearM: 0.96, LRwearR: 0.96, RRwearL: 0.94, RRwearM: 0.95, RRwearR: 0.95,
      SessionFlags: 0x4 | (blue ? 0x20 : 0),
      CarLeftRight: carLeftRight,
      LapCurrentLapTime: cumAt(p) * me.lapTime,
      LapDeltaToSessionBestLap: delta + 0.42,
      LapDeltaToSessionBestLap_OK: !!me.best,
      SessionLapsTotal: 32767,
      OnPitRoad: false,
      FuelLevelPct: fuel / 100,
      FuelUsePerHour: 0.034 * 3600 * 0.75,
      dcBrakeBias: 54.5,
      dcTractionControl: 4,
      dcABS: 3,
      WaterTemp: 88 + Math.sin(this.t / 30) * 2,
      OilTemp: 104 + Math.sin(this.t / 40) * 2,
      OilPress: 4.6 + throttle * 0.6,
      Voltage: 13.8,
      LFtempCL: tyre(0, false)[0], LFtempCM: tyre(0, false)[1], LFtempCR: tyre(0, false)[2],
      RFtempCL: tyre(1, true)[0] + 6, RFtempCM: tyre(1, true)[1] + 6, RFtempCR: tyre(1, true)[2] + 6,
      LRtempCL: tyre(2, false)[0] - 4, LRtempCM: tyre(2, false)[1] - 4, LRtempCR: tyre(2, false)[2] - 4,
      RRtempCL: tyre(3, true)[0], RRtempCM: tyre(3, true)[1], RRtempCR: tyre(3, true)[2],
      LFpressure: 172, RFpressure: 176, LRpressure: 168, RRpressure: 171,
      TrackTempCrew: 31.5,
      AirTemp: 22.4,
      SessionTime: this.t,
      SessionTimeRemain: Math.max(0, this.raceLen - this.t),
      SessionLapsRemainEx: 32767,
      PlayerCarIdx: this.player,
      IsOnTrack: true,
      // Testhilfe: DBDASH_DEMO_ENGINE_OFF=1 simuliert ein stehendes Auto mit Motor aus
      EngineWarnings: process.env.DBDASH_DEMO_ENGINE_OFF ? 0x08 : 0,
      PlayerCarMyIncidentCount: cars[this.player].inc,
      Speed: speed,
      Gear: gear,
      RPM: process.env.DBDASH_DEMO_ENGINE_OFF ? 0 : rpm,
      Throttle: throttle,
      Brake: brake,
      Clutch: 1,
      SteeringWheelAngle: steer,
      SteeringWheelAngleMax: 7.85,
      LapDeltaToBestLap: delta,
      LapDeltaToBestLap_OK: !!me.best,
      LapLastLapTime: me.last || -1,
      LapBestLapTime: me.best || -1,
      Lap: Math.max(0, Math.floor(me.prog)) + 1,
      FuelLevel: fuel,
      CarIdxLapDistPct: pct, CarIdxLapCompleted: lapC, CarIdxEstTime: est, CarIdxPosition: pos,
      CarIdxClassPosition: cpos, CarIdxF2Time: f2, CarIdxOnPitRoad: pit, CarIdxLastLapTime: last,
      CarIdxBestLapTime: best, CarIdxTrackSurface: surf,
      // Reifen: meist Medium/Hard, einzelne Autos auf Soft oder (Strategie-Poker) auf Regenreifen
      CarIdxTireCompound: cars.map((c) => [1, 2, 1, 0, 1, 2, 1, 3, 1, 2, 0, 1, 2, 1, 1, 2, 0, 1][c.idx] ?? 1).concat(new Array(n - cars.length).fill(-1)),
    };
    return { data: d, session: this.session };
  }
}

let _mean = null;
function meanV() {
  // so skalieren, dass eine Runde genau lapTime dauert: dt*v/(T*m) summiert = 1
  if (_mean == null) { let s = 0; for (let k = 0; k < N; k++) s += 1 / PROFILE.v[k]; _mean = s / N; _mean = 1 / _mean; }
  return 1 / (1 / _mean);
}

module.exports = { Demo };
