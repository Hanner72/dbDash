// ACC: Shared-Memory-Strukturen und Broadcasting-Nachrichten (nach Kunos-Dokumentation nachgebaut) → dbDash-Zustand.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const acc = require('../src/acc');
const { buildState } = require('../src/state');

// ---------- Hilfen zum Nachbauen ----------
const wstr = (b, o, s) => b.write(s + '\0', o, 'utf16le');
const str = (s) => { const x = Buffer.from(s, 'utf8'); const h = Buffer.alloc(2); h.writeUInt16LE(x.length); return Buffer.concat([h, x]); };
const u8 = (v) => Buffer.from([v]);
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); return b; };
const f32 = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v); return b; };
const lap = (ms) => Buffer.concat([i32(ms), u16(0), u16(0), u8(0), u8(0), u8(1), u8(0), u8(0)]);

// Physik: 3. Gang (ACC 4), 200 km/h, 45 l, Bremsbalance 0.54, Kerntemp. 80/81/82/83, 27 psi
const ph = Buffer.alloc(800);
ph.writeFloatLE(0.8, 4); ph.writeFloatLE(0.1, 8); ph.writeFloatLE(45, 12); ph.writeInt32LE(4, 16); ph.writeInt32LE(7200, 20);
ph.writeFloatLE(0.25, 24); ph.writeFloatLE(200, 28); ph.writeFloatLE(40, 32); ph.writeFloatLE(0, 36); ph.writeFloatLE(40, 40);
[27, 27, 26.5, 26.5].forEach((v, k) => ph.writeFloatLE(v, 88 + k * 4));
[80, 81, 82, 83].forEach((v, k) => ph.writeFloatLE(v, 152 + k * 4));
ph.writeInt32LE(0, 248); ph.writeFloatLE(22, 288); ph.writeFloatLE(31, 292); ph.writeFloatLE(0, 364); ph.writeFloatLE(0.54, 564);
ph.writeFloatLE(88, 712); ph.writeInt32LE(1, 780);

// Grafik: Rennen live, Spieler = Auto 7 auf P2, Bestzeit 1:45.000, Prognose 1:44.700, blaue Flagge
const gx = Buffer.alloc(1600);
gx.writeInt32LE(2, 4); gx.writeInt32LE(2, 8); gx.writeInt32LE(5, 132); gx.writeInt32LE(2, 136);
gx.writeInt32LE(52000, 140); gx.writeInt32LE(105600, 144); gx.writeInt32LE(105000, 148); gx.writeFloatLE(1200000, 152);
wstr(gx, 176, 'dry_compound'); gx.writeFloatLE(0.5, 248);
// drei Autos: ich (7), eins 3 m rechts neben mir (quer zur Fahrtrichtung), eins weit weg
gx.writeInt32LE(3, 252);
const coords = [[100, 0, 100], [100 + 3 / Math.SQRT2, 0, 100 - 3 / Math.SQRT2], [400, 0, 400]];
coords.forEach((c, k) => c.forEach((v, j) => gx.writeFloatLE(v, 256 + k * 12 + j * 4)));
[7, 3, 9].forEach((id, k) => gx.writeInt32LE(id, 976 + k * 4));
gx.writeInt32LE(7, 1216); gx.writeInt32LE(1, 1224); gx.writeInt32LE(0, 1236);
gx.writeInt32LE(3, 1268); gx.writeInt32LE(2, 1272); gx.writeInt32LE(0, 1276); gx.writeInt32LE(4, 1280);
gx.writeInt32LE(104700, 1396);

const st = Buffer.alloc(440);
wstr(st, 0, '1.9'); wstr(st, 30, '1.10.2'); wstr(st, 68, 'bmw_m4_gt3'); wstr(st, 134, 'monza');
wstr(st, 200, 'Johann'); wstr(st, 266, 'Danner'); st.writeInt32LE(7500, 412); st.writeFloatLE(120, 416);

const P = acc.parsePhysics(ph), G = acc.parseGraphics(gx), S = acc.parseStatic(st);
assert.strictEqual(G.playerCarID, 7); assert.strictEqual(G.tyreCompound, 'dry_compound'); assert.strictEqual(S.track, 'monza');
assert.strictEqual(S.playerSurname, 'Danner'); assert.strictEqual(G.carID.length, 3);

// ---------- Broadcasting ----------
const bc = { cars: new Map(), entries: new Map(), session: null, trackMeters: 0, connectionId: -1, registered: false, lastData: 0 };
const send = (...parts) => acc.handleBroadcast(bc, Buffer.concat(parts));
assert.strictEqual(send(u8(1), i32(42), u8(1), u8(1), str('')), 'registered');
send(u8(5), i32(42), str('Monza'), i32(3), i32(5793));
send(u8(4), i32(42), u16(3), u16(7), u16(3), u16(9));
const entry = (id, model, num, first, last) => send(u8(6), u16(id), u8(model), str('Team'), i32(num), u8(0), u8(0), u16(0), u8(1), str(first), str(last), str('XX'), u8(0), u16(0));
entry(7, 30, 77, 'Johann', 'Danner'); entry(3, 32, 33, 'Anna', 'Vorne'); entry(9, 53, 9, 'Gerd', 'Viert');
send(u8(2), u16(1), u16(2), u8(10), u8(5), f32(600000), f32(3600000), i32(7), str(''), str(''), str(''), u8(0), f32(50000), u8(22), u8(31), u8(0), u8(0), u8(0), lap(104000));
// Auto 3 liegt 0,02 Runden vor mir (P1), Auto 9 (GT4) eine Runde zurück
const car = (id, pos, laps, spline, best) => send(u8(3), u16(id), u16(0), u8(1), u8(5), f32(0), f32(0), f32(0), u8(1), u16(200),
  u16(pos), u16(pos), u16(pos), f32(spline), u16(laps), i32(0), lap(best), lap(best + 600), lap(0));
car(7, 2, 5, 0.50, 105000); car(3, 1, 5, 0.52, 104000); car(9, 3, 4, 0.30, 112000);
assert.strictEqual(bc.trackMeters, 5793); assert.strictEqual(bc.entries.get(3).drivers[0].last, 'Vorne');

// ---------- Übersetzung + Zustand ----------
const f = acc.buildFrame(P, G, S, bc, null);
assert.strictEqual(f.data.Gear, 3, 'ACC-Gang 4 = 3. Gang');
assert.ok(Math.abs(f.data.Speed - 200 / 3.6) < 1e-3);
assert.strictEqual(f.data.SessionFlags, 0x20, 'blaue Flagge');
assert.strictEqual(f.data.CarLeftRight, 3, 'Auto 3 m rechts neben mir → Seitenwarnung rechts');
const state = buildState(f.data, f.session, { source: 'acc', caps: { iRating: false, license: false } });
assert.strictEqual(state.caps.iRating, false);
assert.ok(Math.abs(state.dash.predicted - 104.7) < 1e-6, 'Prognose = ACCs geschätzte Rundenzeit');
assert.ok(Math.abs(state.dash.delta - (-0.3)) < 1e-6, 'Delta = Prognose − Bestzeit');
assert.deepStrictEqual(state.classes.map((c) => c.name), ['GT3', 'GT4']);
const gt3 = state.classes[0].rows;
assert.deepStrictEqual(gt3.map((c) => [c.classPos, c.name, c.brand]), [[1, 'Anna Vorne', 'Ferrari'], [2, 'Johann Danner', 'BMW']]);
assert.ok(Math.abs(state.dash.gaps.cls.ahead.gap.s - 0.02 * 105) < 1e-3, 'Abstand nach vorne = 0,02 Runden × eigene Bestzeit');
assert.strictEqual(state.session.track, 'Monza');

// ---------- broadcasting.json (ACC speichert UTF-16) ----------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbdash-acc-'));
const file = path.join(dir, 'broadcasting.json');
fs.writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify({ updListenerPort: 0, connectionPassword: 'asd', commandPassword: '' }), 'utf16le')]));
assert.strictEqual(acc.readBroadcastingConfig(file).port, 0);
const after = acc.setupBroadcasting(file);
assert.strictEqual(after.port, 9000); assert.strictEqual(after.password, 'asd'); assert.ok(after.utf16, 'bleibt UTF-16');
assert.ok(fs.existsSync(file + '.bak'), 'Sicherung angelegt');
fs.rmSync(dir, { recursive: true, force: true });

console.log('OK – ACC: Shared Memory, Broadcasting, Standings GT3/GT4, Prognose 1:44.700, Seitenwarnung rechts, broadcasting.json');
