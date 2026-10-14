// Prüft den Shared-Memory-Parser mit einem nachgebauten iRacing-Speicherabbild
// (Layout laut irsdk_defines.h), gefüllt mit Demo-Daten im YAML-Format von iRacing.
'use strict';
const assert = require('assert');
const yaml = require('js-yaml');
const { IRSDK } = require('../src/irsdk');
const { Demo } = require('../src/demo');
const { buildState } = require('../src/state');

const demo = new Demo();
const { data, session } = demo.read();

// Variablen-Header erzeugen
const vars = [];
let off = 0;
for (const [name, val] of Object.entries(data)) {
  const arr = Array.isArray(val);
  const sample = arr ? val[0] : val;
  const type = typeof sample === 'boolean' ? 1 : Number.isInteger(sample) && !/Time|Pct|Delta|Speed|RPM|Fuel|Throttle|Brake|Clutch|Steering/.test(name) ? 2 : (name === 'SessionTime' ? 5 : 4);
  const size = [1, 1, 4, 4, 4, 8][type];
  const count = arr ? val.length : 1;
  vars.push({ name, type, offset: off, count, size, val });
  off += size * count;
}
const bufLen = Math.ceil(off / 16) * 16;
const sessionText = '---\n' + yaml.dump(session).replace(/^/gm, ' ').trimEnd() + '\n...\n';
const varHeaderOffset = 144;
const sessionOffset = varHeaderOffset + vars.length * 144;
const sessionLen = Buffer.byteLength(sessionText) + 64;
const buf0 = sessionOffset + sessionLen;
const total = buf0 + bufLen * 3;
const mem = Buffer.alloc(total);
const dv = new DataView(mem.buffer);

dv.setInt32(0, 2, true);          // ver
dv.setInt32(4, 1, true);          // status: connected
dv.setInt32(8, 60, true);         // tickRate
dv.setInt32(12, 1, true);         // sessionInfoUpdate
dv.setInt32(16, sessionLen, true);
dv.setInt32(20, sessionOffset, true);
dv.setInt32(24, vars.length, true);
dv.setInt32(28, varHeaderOffset, true);
dv.setInt32(32, 3, true);         // numBuf
dv.setInt32(36, bufLen, true);
for (let i = 0; i < 3; i++) {
  dv.setInt32(48 + i * 16, i === 1 ? 500 : 100 + i, true); // Puffer 1 ist der neueste
  dv.setInt32(48 + i * 16 + 4, buf0 + i * bufLen, true);
}
vars.forEach((v, i) => {
  const o = varHeaderOffset + i * 144;
  dv.setInt32(o, v.type, true); dv.setInt32(o + 4, v.offset, true); dv.setInt32(o + 8, v.count, true);
  mem.write(v.name, o + 16, 'latin1');
});
// Session-YAML im iRacing-Stil: Hex-Farben und unquotierte Namen
let iy = sessionText.replace(/CarClassColor: (\d+)/g, (m, n) => 'CarClassColor: 0x' + Number(n).toString(16))
  .replace(/UserName: '?([^'\n]+)'?/g, 'UserName: $1');
iy = iy.replace('UserName: Matteo Ricci', "UserName: Matteo O'Ricci: #62 {test}");
mem.write(iy, sessionOffset, 'latin1');
// Datenpuffer 1 (der neueste) befüllen, die anderen mit Müll
const b = buf0 + bufLen;
for (const v of vars) {
  const vals = Array.isArray(v.val) ? v.val : [v.val];
  vals.forEach((x, k) => {
    const o = b + v.offset + k * v.size;
    if (v.type === 1) dv.setUint8(o, x ? 1 : 0);
    else if (v.type === 2) dv.setInt32(o, x, true);
    else if (v.type === 4) dv.setFloat32(o, x, true);
    else if (v.type === 5) dv.setFloat64(o, x, true);
  });
}
mem.fill(0xAB, buf0, buf0 + bufLen);

// Parser mit dem Abbild verbinden (statt Windows-API)
const sdk = new IRSDK();
sdk.koffi = {};
sdk._open = function () { this.base = 1n; return true; };
sdk._copy = (o, len) => Buffer.from(mem.subarray(o, o + len)); // statt RtlMoveMemory
const r = sdk.read();
assert(r, 'read() lieferte nichts');
assert.strictEqual(r.data.PlayerCarIdx, data.PlayerCarIdx);
assert.strictEqual(r.data.Gear, data.Gear);
assert(Math.abs(r.data.Speed - data.Speed) < 1e-3);
assert.strictEqual(r.data.CarIdxPosition[5], data.CarIdxPosition[5]);
assert(Math.abs(r.data.CarIdxLapDistPct[8] - data.CarIdxLapDistPct[8]) < 1e-5);
assert.strictEqual(r.data.IsOnTrack, true);
assert.strictEqual(r.session.DriverInfo.Drivers.length, 18);
assert.strictEqual(r.session.DriverInfo.Drivers[8].UserName, "Matteo O'Ricci: #62 {test}");
assert.strictEqual(r.session.DriverInfo.Drivers[0].CarClassColor, 0x5ac8fa);
const st = buildState(r.data, r.session, { source: 'iracing' });
assert.strictEqual(st.relative.find((c) => c.isPlayer).name, "Matteo O'Ricci: #62 {test}");
assert.strictEqual(st.classes.length, 2);
// Nicht verbunden -> null
dv.setInt32(4, 0, true);
assert.strictEqual(sdk.read(), null);
console.log('OK – Parser liest', vars.length, 'Variablen,', st.classes.reduce((a, c) => a + c.size, 0), 'Fahrer, Spieler P' + st.player.position);
