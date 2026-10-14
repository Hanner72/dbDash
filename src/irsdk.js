// Liest die iRacing-Telemetrie direkt aus dem Shared Memory (nur Windows).
// Struktur laut offiziellem iRacing SDK (irsdk_defines.h).
'use strict';

const yaml = require('js-yaml');

const MEM_NAME = 'Local\\IRSDKMemMapFileName';
const FILE_MAP_READ = 0x0004;
const STATUS_CONNECTED = 1;
const VAR_HEADER_SIZE = 144;
const TYPE_SIZES = [1, 1, 4, 4, 4, 8]; // char, bool, int, bitField, float, double

class IRSDK {
  constructor() {
    this.koffi = null;
    this.handle = null;
    this.base = null;
    this.vars = null;
    this.varCount = -1;
    this.sessionUpdate = -1;
    this.session = null;
    this.lastTick = -1;
    this.lastTickChange = 0;
    this._initFFI();
  }

  _initFFI() {
    if (process.platform !== 'win32') return;
    try {
      const koffi = require('koffi');
      const k32 = koffi.load('kernel32.dll');
      koffi.pointer('HANDLE', koffi.opaque());
      this.koffi = koffi;
      this.OpenFileMappingW = k32.func('HANDLE __stdcall OpenFileMappingW(uint32_t access, int inherit, str16 name)');
      this.MapViewOfFile = k32.func('void * __stdcall MapViewOfFile(HANDLE h, uint32_t access, uint32_t hi, uint32_t lo, size_t len)');
      this.UnmapViewOfFile = k32.func('int __stdcall UnmapViewOfFile(void *p)');
      this.CloseHandle = k32.func('int __stdcall CloseHandle(HANDLE h)');
      // Electron erlaubt keine direkten Speicher-Views -> Daten per RtlMoveMemory in eigene Buffer kopieren
      this.RtlMoveMemory = k32.func('void __stdcall RtlMoveMemory(_Out_ void *dst, void *src, size_t len)');
    } catch (e) {
      console.error('FFI init failed:', e);
      this.koffi = null;
    }
  }

  get available() { return !!this.koffi; }

  _open() {
    if (this.base) return true;
    const h = this.OpenFileMappingW(FILE_MAP_READ, 0, MEM_NAME);
    if (!h) return false;
    const p = this.MapViewOfFile(h, FILE_MAP_READ, 0, 0, 0);
    if (!p) { this.CloseHandle(h); return false; }
    this.handle = h;
    this.base = p;
    return true;
  }

  close() {
    if (this.base) this.UnmapViewOfFile(this.base);
    if (this.handle) this.CloseHandle(this.handle);
    this.base = this.handle = null;
    this.vars = null; this.varCount = -1; this.sessionUpdate = -1; this.session = null;
  }

  // Kopiert len Bytes ab offset aus dem Shared Memory in einen neuen Buffer
  _copy(offset, len) {
    const buf = Buffer.alloc(len);
    const addr = typeof this.base === 'bigint' ? this.base : this.koffi.address(this.base);
    this.RtlMoveMemory(buf, addr + BigInt(offset), len);
    return buf;
  }

  // Gibt {data, session} zurück oder null, wenn iRacing nicht läuft.
  read() {
    if (!this.koffi) return null;
    if (!this._open()) return null;

    const hb = this._copy(0, 112);
    const i32 = (o) => hb.readInt32LE(o);
    const status = i32(4);
    if (!(status & STATUS_CONNECTED)) { this.lastTick = -1; return null; }

    const sessionUpdate = i32(12);
    const sessionLen = i32(16);
    const sessionOffset = i32(20);
    const numVars = i32(24);
    const varHeaderOffset = i32(28);
    const numBuf = Math.min(4, i32(32));
    const bufLen = i32(36);
    if (numVars <= 0 || bufLen <= 0) return null;

    if (numVars !== this.varCount) this._readVarHeaders(this._copy(varHeaderOffset, numVars * VAR_HEADER_SIZE), numVars);

    if (sessionUpdate !== this.sessionUpdate && sessionLen > 0) {
      const raw = this._copy(sessionOffset, sessionLen);
      let end = raw.indexOf(0); if (end < 0) end = sessionLen;
      const text = raw.toString('latin1', 0, end);
      try {
        this.session = yaml.load(sanitizeYaml(text), { json: true });
      } catch (e) {
        console.error('Session-YAML Fehler:', e.message);
      }
      this.sessionUpdate = sessionUpdate;
    }

    // Neuesten Datenpuffer wählen und konsistent kopieren
    let best = 0, bestTick = -1;
    for (let i = 0; i < numBuf; i++) {
      const t = i32(48 + i * 16);
      if (t > bestTick) { bestTick = t; best = i; }
    }
    const off = i32(48 + best * 16 + 4);
    let copy = null;
    for (let tries = 0; tries < 3; tries++) {
      copy = this._copy(off, bufLen);
      if (this._copy(48 + best * 16, 4).readInt32LE(0) === bestTick) break;
    }

    // Wenn sich der Tick lange nicht ändert (iRacing hängt/beendet), als getrennt melden
    const now = Date.now();
    if (bestTick !== this.lastTick) { this.lastTick = bestTick; this.lastTickChange = now; }
    else if (now - this.lastTickChange > 2000) return null;

    return { data: this._decode(copy), session: this.session };
  }

  _readVarHeaders(buf, numVars) {
    const vars = {};
    for (let i = 0; i < numVars; i++) {
      const o = i * VAR_HEADER_SIZE;
      const type = buf.readInt32LE(o);
      const voff = buf.readInt32LE(o + 4);
      const count = buf.readInt32LE(o + 8);
      let e = buf.indexOf(0, o + 16); if (e < 0 || e > o + 48) e = o + 48;
      const name = buf.toString('latin1', o + 16, e);
      vars[name] = { type, offset: voff, count };
    }
    this.vars = vars;
    this.varCount = numVars;
  }

  _decode(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const out = {};
    for (const name in this.vars) {
      const v = this.vars[name];
      const size = TYPE_SIZES[v.type] || 4;
      const readOne = (o) => {
        switch (v.type) {
          case 0: return dv.getUint8(o);
          case 1: return dv.getUint8(o) !== 0;
          case 2: return dv.getInt32(o, true);
          case 3: return dv.getUint32(o, true);
          case 4: return dv.getFloat32(o, true);
          case 5: return dv.getFloat64(o, true);
          default: return 0;
        }
      };
      if (v.count === 1) out[name] = readOne(v.offset);
      else {
        const arr = new Array(v.count);
        for (let i = 0; i < v.count; i++) arr[i] = readOne(v.offset + i * size);
        out[name] = arr;
      }
    }
    return out;
  }
}

// iRacings YAML enthält Fahrer-/Teamnamen ohne Anführungszeichen, die Sonderzeichen
// enthalten können. Diese Werte werden hier sicher in Anführungszeichen gesetzt.
const QUOTE_KEYS = /^(\s*-?\s*)(UserName|TeamName|AbbrevName|Initials|CarScreenName|CarScreenNameShort|CarClassShortName|CarNumber|TrackDisplayName|TrackDisplayShortName|TrackConfigName|TrackCity|TrackCountry|SeriesName|SessionName|ClubName|DivisionName|CarDesignStr|HelmetDesignStr|SuitDesignStr|CarNumberDesignStr|CarSponsor_1|CarSponsor_2|LicString|FlairName): (.*)$/;
function sanitizeYaml(text) {
  return text.split('\n').map((line) => {
    const m = line.match(QUOTE_KEYS);
    if (!m) return line;
    let val = m[3].replace(/\r$/, '');
    if (val.startsWith('"') && val.endsWith('"') && val.length > 1) val = val.slice(1, -1);
    return `${m[1]}${m[2]}: '${val.replace(/'/g, "''")}'`;
  }).join('\n');
}

module.exports = { IRSDK, sanitizeYaml };
