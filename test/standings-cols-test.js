// Standings-Spalten Automarke und Reifen: Marke aus dem iRacing-Fahrzeugnamen, Reifenmischung aus
// CarIdxTireCompound + DriverInfo.DriverTires.
'use strict';
const assert = require('assert');
const { buildState } = require('../src/state');
const CARS = ['Mercedes-AMG GT3 2020', 'Porsche 911 GT3 R (992)', 'Chevrolet Corvette Z06 GT3.R', 'Aston Martin Vantage GT3 EVO', 'Neuwagen X1'];
const S = {
  WeekendInfo: { TrackLength: '4.00 km' },
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
  DriverInfo: {
    DriverCarIdx: 0,
    DriverTires: [{ TireIndex: 0, TireCompoundType: 'Hard' }, { TireIndex: 1, TireCompoundType: 'Wet' }],
    Drivers: CARS.map((car, i) => ({ CarIdx: i, UserName: 'F' + i, CarClassID: 1, CarScreenName: car })),
  },
};
const D = {
  PlayerCarIdx: 0, SessionState: 4,
  CarIdxLapCompleted: [3, 3, 3, 3, 3], CarIdxLapDistPct: [0.5, 0.4, 0.3, 0.2, 0.1], CarIdxTrackSurface: [3, 3, 3, 3, 3],
  CarIdxTireCompound: [0, 1, -1, 5, 0],
};
const rows = Object.fromEntries(buildState(D, S, {}).classes[0].rows.map((c) => [c.name, c]));
assert.deepStrictEqual(CARS.map((_, i) => rows['F' + i].brand), ['Mercedes', 'Porsche', 'Chevrolet', 'Aston Martin', 'Neuwagen']);
assert.strictEqual(rows.F0.tyre.letter, 'H');
assert.strictEqual(rows.F1.tyre.letter, 'W');
assert.strictEqual(rows.F2.tyre, null, 'kein Reifen bekannt (-1)');
assert.strictEqual(rows.F3.tyre.letter, '5', 'unbekannte Mischung → Nummer');
console.log('OK – Standings-Spalten: Marken Mercedes/Porsche/Chevrolet/Aston Martin, Reifen H/W, unbekannt sauber');
