// Überholen mitten in der Runde: iRacing-Positionen sind noch veraltet (erst an der Linie aktualisiert),
// Vorder-/Hintermann müssen trotzdem sofort stimmen.
'use strict';
const assert = require('assert');
const { buildState } = require('../src/state');
const S = {
  WeekendInfo: { TrackLength: '4.00 km' },
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
  DriverInfo: { DriverCarIdx: 0, Drivers: [
    { CarIdx: 0, UserName: 'Ich', CarClassID: 1, CarClassEstLapTime: 100 },
    { CarIdx: 1, UserName: 'Anna', CarClassID: 1, CarClassEstLapTime: 100 },
    { CarIdx: 2, UserName: 'Bernd', CarClassID: 1, CarClassEstLapTime: 100 },
    { CarIdx: 3, UserName: 'Carla', CarClassID: 2, CarClassEstLapTime: 90 },
    { CarIdx: 4, UserName: 'Dieter (Garage)', CarClassID: 1, CarClassEstLapTime: 100 },
  ] },
};
// Runde 5 läuft. Ich habe Anna gerade überholt (ich 0.52, Anna 0.50); Bernd liegt 0.03 Runden vor mir.
// Carla (andere Klasse) ist 0.01 Runden hinter mir, Dieter steht in der Garage.
const pct = [0.52, 0.50, 0.55, 0.51, -1];
const D = {
  PlayerCarIdx: 0, SessionState: 4,
  CarIdxLap: [5, 5, 5, 5, -1], CarIdxLapCompleted: [4, 4, 4, 4, 3],
  CarIdxLapDistPct: pct, CarIdxEstTime: pct.map((p, i) => p * (i === 3 ? 90 : 100)),
  CarIdxTrackSurface: [3, 3, 3, 3, -1],
  // veraltete iRacing-Positionen vom letzten Linienübertritt: Anna noch vor mir
  CarIdxPosition: [3, 2, 1, 5, 4], CarIdxClassPosition: [3, 2, 1, 1, 4],
  CarIdxBestLapTime: [100, 100, 100, 90, 100], CarIdxLastLapTime: [100.5, 101, 100, 90, 0],
};
const st = buildState(D, S, {});
const g = st.dash.gaps;
assert.strictEqual(g.all.ahead.name, 'Bernd');
assert.strictEqual(g.all.behind.name, 'Carla');
assert.strictEqual(g.cls.ahead.name, 'Bernd');
assert.strictEqual(g.cls.behind.name, 'Anna');
assert.ok(Math.abs(g.cls.ahead.gap.s - 3.0) < 0.05, 'Abstand zu Bernd ~3.0 s, ist ' + g.cls.ahead.gap.s);
assert.ok(Math.abs(g.cls.behind.gap.s - 2.0) < 0.05, 'Abstand zu Anna ~2.0 s, ist ' + g.cls.behind.gap.s);
assert.strictEqual(g.all.pos, 2);
assert.strictEqual(g.cls.pos, 2);
// Überrundung: Anna eine Runde zurück
D.CarIdxLap = [6, 5, 6, 6, -1];
const st2 = buildState(D, S, {});
assert.deepStrictEqual(st2.dash.gaps.cls.behind.gap, { laps: 1 });
console.log('OK – Abstände: vor', g.cls.ahead.name, g.cls.ahead.gap.s.toFixed(2), 's, hinter', g.cls.behind.name, g.cls.behind.gap.s.toFixed(2), 's; gesamt hinter', g.all.behind.name);
