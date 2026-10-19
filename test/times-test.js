// Prognose und Delta: Referenzrunde und Delta müssen zusammenpassen (Session-Bestzeit + Delta zur Session-Bestzeit).
// LapDeltaToBestLap bezieht sich auf die ewige Bestzeit aus den Lapfiles und darf nicht mit LapBestLapTime gemischt werden.
'use strict';
const assert = require('assert');
const { buildState } = require('../src/state');
const S = {
  WeekendInfo: { TrackLength: '4.00 km' },
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
  DriverInfo: { DriverCarIdx: 0, DriverCarEstLapTime: 130, Drivers: [
    { CarIdx: 0, UserName: 'Ich', CarClassID: 1, CarClassEstLapTime: 105 },
    { CarIdx: 1, UserName: 'Vorne', CarClassID: 1, CarClassEstLapTime: 105 },
    { CarIdx: 2, UserName: 'Hinten', CarClassID: 1, CarClassEstLapTime: 105 },
  ] },
};
const base = {
  PlayerCarIdx: 0, SessionState: 4,
  CarIdxLap: [5, 5, 5], CarIdxLapCompleted: [4, 4, 4], CarIdxLapDistPct: [0.5, 0.53, 0.48], CarIdxTrackSurface: [3, 3, 3],
  CarIdxEstTime: [0.5 * 105, 0.53 * 105, 0.48 * 105], CarIdxBestLapTime: [100, 99, 101], CarIdxLastLapTime: [100.4, 99.5, 101.2],
  LapBestLapTime: 100, LapLastLapTime: 100.4,
  // ewige Bestzeit (Lapfile) ist 98.0 → Delta dazu +2.3; zur Session-Bestzeit (100.0) nur +0.3
  LapDeltaToBestLap: 2.3, LapDeltaToBestLap_OK: true,
  LapDeltaToSessionBestLap: 0.3, LapDeltaToSessionBestLap_OK: true,
  LapDeltaToSessionLastlLap: -0.1, LapDeltaToSessionLastlLap_OK: true,
};
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} statt ${b}`);

let st = buildState(base, S, {});
near(st.dash.predicted, 100.3, 'Prognose = Session-Bestzeit + Delta zur Session-Bestzeit');
near(st.dash.delta, 0.3, 'Dashboard-Delta zur Session-Bestzeit');
near(st.player.delta, 0.3, 'Delta-Overlay zur Session-Bestzeit');

// noch keine Bestzeit, aber eine letzte Runde → letzte Runde + Delta zur letzten Runde
st = buildState({ ...base, LapBestLapTime: -1, LapDeltaToSessionBestLap_OK: false }, S, {});
near(st.dash.predicted, 100.3, 'Prognose aus letzter Runde');
// gar keine Referenz → keine Prognose (nicht iRacings Schätzung 130 s)
st = buildState({ ...base, LapBestLapTime: -1, LapLastLapTime: -1, LapDeltaToSessionBestLap_OK: false, LapDeltaToSessionLastlLap_OK: false }, S, {});
assert.strictEqual(st.dash.predicted, null, 'ohne Referenzrunde keine Prognose');

// Abstände Vorder-/Hintermann = Streckenanteil × eigene Rundenzeit (wie im Relative)
st = buildState(base, S, {});
near(st.dash.gaps.all.ahead.gap.s, 0.03 * 100, 'Abstand nach vorne');
near(st.dash.gaps.all.behind.gap.s, 0.02 * 100, 'Abstand nach hinten');
const rel = Object.fromEntries(st.relative.map((c) => [c.name, c.gap]));
near(Math.abs(rel.Vorne), st.dash.gaps.all.ahead.gap.s, 'Relative und Abstände gleich (vorne)');
near(Math.abs(rel.Hinten), st.dash.gaps.all.behind.gap.s, 'Relative und Abstände gleich (hinten)');
console.log('OK – Zeiten: Prognose 100.3 (Session-Referenz, nicht Lapfile), Ersatz über letzte Runde, Abstände = Relative');
