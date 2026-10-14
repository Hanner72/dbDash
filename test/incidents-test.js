// Incidents der Gegner: iRacing liefert in der Session-Info 0 → Ausritte zählen (1x pro Ausritt),
// kurzes Hin und Her innerhalb von 2 s zählt nur einmal; eigener Wert kommt exakt aus der Telemetrie.
'use strict';
const assert = require('assert');
const { buildState } = require('../src/state');
const { RaceTracker } = require('../src/race');
const S = {
  WeekendInfo: { TrackLength: '4.00 km' },
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
  DriverInfo: { DriverCarIdx: 0, Drivers: [
    { CarIdx: 0, UserName: 'Ich', CarClassID: 1, CurDriverIncidentCount: 0 },
    { CarIdx: 1, UserName: 'Anna', CarClassID: 1, CurDriverIncidentCount: 0 },
    { CarIdx: 2, UserName: 'Bernd', CarClassID: 1, CurDriverIncidentCount: 0 },
    { CarIdx: 3, UserName: 'Carla (Admin-Sicht)', CarClassID: 1, CurDriverIncidentCount: 6 },
  ] },
};
const race = new RaceTracker();
let st;
// Anna: zwei getrennte Ausritte (einer davon flattert kurz), Bernd: keiner, ich: 4x laut Telemetrie
const anna = [3, 0, 3, 0, 3, 3, 3, 3, 0, 0, 3]; // alle 0,5 s ein Messwert
anna.forEach((a, t) => {
  st = buildState({
    PlayerCarIdx: 0, SessionState: 4, SessionTime: t * 0.5, PlayerCarMyIncidentCount: 4,
    CarIdxLapCompleted: [2, 2, 2, 2], CarIdxLapDistPct: [0.5, 0.4, 0.3, 0.2],
    CarIdxTrackSurface: [3, a, 3, a],
  }, S, { race });
});
const inc = Object.fromEntries(st.classes.flatMap((cl) => cl.rows).map((c) => [c.name, c]));
assert.strictEqual(inc.Ich.inc, 4); assert.ok(!inc.Ich.incEst);
assert.strictEqual(inc.Anna.inc, 2); assert.ok(inc.Anna.incEst);
assert.strictEqual(inc.Bernd.inc, 0); assert.ok(inc.Bernd.incEst);
assert.strictEqual(inc['Carla (Admin-Sicht)'].inc, 6); assert.ok(!inc['Carla (Admin-Sicht)'].incEst);
console.log('OK – Incidents: Anna ≈2x (2 Ausritte), Bernd ≈0x, eigener Wert 4x, echter Wert 6x bleibt');
