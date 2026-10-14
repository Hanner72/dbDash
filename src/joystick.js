// Liest Knöpfe von Lenkrad, Button-Box & Co. über die Windows-Joystick-Schnittstelle (winmm).
// Funktioniert im Hintergrund, auch wenn iRacing im Vordergrund ist. Bis zu 16 Geräte,
// je 32 Knöpfe + Coolie-Hat (als Knöpfe 33–36: hoch/rechts/runter/links).
'use strict';

const JOYINFOEX_SIZE = 52;
const JOY_RETURNALL = 0xff;
const JOYCAPSW_SIZE = 728;
const MAX_DEV = 16;

class Joysticks {
  constructor(onPress) {
    this.onPress = onPress;     // (dev, btn) => void
    this.lib = null;
    this.connected = new Map(); // dev -> { name, buttons, pov }
    this.timers = [];
    this.buf = Buffer.alloc(JOYINFOEX_SIZE);
    if (process.platform !== 'win32') return;
    try {
      const koffi = require('koffi');
      const winmm = koffi.load('winmm.dll');
      this.joyGetPosEx = winmm.func('uint32 __stdcall joyGetPosEx(uint32 id, void *pji)');
      this.joyGetDevCapsW = winmm.func('uint32 __stdcall joyGetDevCapsW(uintptr_t id, void *pjc, uint32 cbjc)');
      this.lib = winmm;
    } catch (e) { console.error('Joystick-Init:', e.message); }
  }

  get available() { return !!this.lib; }

  start() {
    if (!this.available) return;
    this.scan();
    this.timers.push(setInterval(() => this.scan(), 3000));
    this.timers.push(setInterval(() => this.poll(), 1000 / 60));
  }

  stop() { this.timers.forEach(clearInterval); this.timers = []; }

  _read(dev) {
    this.buf.fill(0);
    this.buf.writeUInt32LE(JOYINFOEX_SIZE, 0);
    this.buf.writeUInt32LE(JOY_RETURNALL, 4);
    if (this.joyGetPosEx(dev, this.buf) !== 0) return null;
    return { buttons: this.buf.readUInt32LE(32), pov: this.buf.readUInt32LE(40) };
  }

  // Angeschlossene Geräte suchen (nicht jeden Frame, weil Abfragen leerer IDs langsam sein können)
  scan() {
    for (let dev = 0; dev < MAX_DEV; dev++) {
      const r = this._read(dev);
      if (r && !this.connected.has(dev)) this.connected.set(dev, { name: this._name(dev), buttons: r.buttons, pov: r.pov });
      if (!r && this.connected.has(dev)) this.connected.delete(dev);
    }
  }

  _name(dev) {
    try {
      const caps = Buffer.alloc(JOYCAPSW_SIZE);
      if (this.joyGetDevCapsW(dev, caps, JOYCAPSW_SIZE) !== 0) return `Gerät ${dev + 1}`;
      const vid = caps.readUInt16LE(0), pid = caps.readUInt16LE(2);
      let name = caps.toString('utf16le', 4, 68); const z = name.indexOf('\0'); if (z >= 0) name = name.slice(0, z);
      if (!name || /PC-joystick|joystick driver/i.test(name)) name = `Controller ${vid.toString(16).padStart(4, '0').toUpperCase()}:${pid.toString(16).padStart(4, '0').toUpperCase()}`;
      return name;
    } catch { return `Gerät ${dev + 1}`; }
  }

  static povDir(pov) {
    if (pov === 0xffff || pov > 36000) return 0;
    return [33, 34, 35, 36][Math.round(pov / 9000) % 4]; // hoch, rechts, runter, links
  }

  poll() {
    for (const [dev, st] of this.connected) {
      const r = this._read(dev);
      if (!r) { this.connected.delete(dev); continue; }
      const pressed = r.buttons & ~st.buttons; // neu gedrückt
      for (let b = 0; b < 32; b++) if (pressed & (1 << b)) this.onPress(dev, b + 1);
      const pd = Joysticks.povDir(r.pov);
      if (pd && pd !== Joysticks.povDir(st.pov)) this.onPress(dev, pd);
      st.buttons = r.buttons; st.pov = r.pov;
    }
  }

  deviceName(dev) { return (this.connected.get(dev) || {}).name || `Gerät ${dev + 1}`; }
  devices() { return [...this.connected.entries()].map(([dev, d]) => ({ dev, name: d.name })); }
}

function buttonLabel(btn) {
  return btn > 32 ? ['Hat hoch', 'Hat rechts', 'Hat runter', 'Hat links'][btn - 33] : `Knopf ${btn}`;
}

module.exports = { Joysticks, buttonLabel };
