// Radar: Reichweite = Lücke Stoßstange zu Stoßstange; in der Qualifikation aus.
'use strict';
const assert = require('assert');
const { buildState } = require('../src/state');
const session = (type) => ({
  WeekendInfo: { TrackLength: '4.00 km' },
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: type }] },
  DriverInfo: { DriverCarIdx: 0, Drivers: [0, 1, 2, 3].map((i) => ({ CarIdx: i, UserName: 'F' + i, CarClassID: 1 })) },
});
// Strecke 4000 m: Auto 1 6 m vor mir (Lücke 1,3 m), Auto 2 8 m hinter mir (Lücke 3,3 m), Auto 3 200 m weg
const pct = [0.5, 0.5 + 6 / 4000, 0.5 - 8 / 4000, 0.55];
const D = {
  PlayerCarIdx: 0, SessionState: 4, CarLeftRight: 1,
  CarIdxLapCompleted: [3, 3, 3, 3], CarIdxLapDistPct: pct, CarIdxTrackSurface: [3, 3, 3, 3],
};

const r = buildState(D, session('Race'), { radarRange: 2 }).radar;
assert.strictEqual(r.range, 2);
assert.ok(!r.qualify);
assert.strictEqual(r.cars.length, 2, 'nur Autos im sichtbaren Bereich');
const byDist = Object.fromEntries(r.cars.map((c) => [Math.sign(c.dist), c]));
assert.strictEqual(byDist[1].gap, 1.3);
assert.strictEqual(byDist[-1].gap, 3.3);
// Einblenden nur, wenn eine Lücke <= Reichweite ist: bei 2 m nur Auto 1, bei 1 m keines
assert.strictEqual(r.cars.filter((c) => c.gap <= 2).length, 1);
assert.strictEqual(buildState(D, session('Race'), { radarRange: 1 }).radar.cars.filter((c) => c.gap <= 1).length, 0);

for (const q of ['Qualify', 'Lone Qualify', 'Open Qualify']) assert.ok(buildState(D, session(q), { radarRange: 2 }).radar.qualify, q);
assert.ok(!buildState(D, session('Practice'), { radarRange: 2 }).radar.qualify);
console.log('OK – Radar: Lücke vorn 1.3 m / hinten 3.3 m, Reichweite 1–2 m richtig, Qualifikation aus');
