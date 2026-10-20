// Live-Abstände über die Zeitnahme (gaps.js): genauer Zeitabstand bei ungleichmäßiger Geschwindigkeit,
// Training: Vorder-/Hintermann auf der Strecke, Standings: Rundenzeiten aus den Session-Ergebnissen.
'use strict';
const assert = require('assert');
const { buildState } = require('../src/state');
const { GapTracker } = require('../src/gaps');

const T = 100; // Rundenzeit
// Streckenanteil nach Zeit in der Runde: langsame und schnelle Abschnitte (nicht linear)
const pctAt = (u) => u + 0.12 * Math.sin(2 * Math.PI * u) / (2 * Math.PI);
const session = (type) => ({
  WeekendInfo: { TrackLength: '4.00 km', SessionID: 1, SubSessionID: 2 },
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: type, ResultsPositions: [
    { CarIdx: 1, FastestTime: 99.5, LastTime: 100.2 }, { CarIdx: 3, FastestTime: 101.25, LastTime: 102 },
  ] }] },
  DriverInfo: { DriverCarIdx: 0, Drivers: [
    { CarIdx: 0, UserName: 'Ich', CarClassID: 1, CarClassEstLapTime: T },
    { CarIdx: 1, UserName: 'Anna', CarClassID: 1, CarClassEstLapTime: T },
    { CarIdx: 2, UserName: 'Bernd', CarClassID: 1, CarClassEstLapTime: T },
    { CarIdx: 3, UserName: 'Carla (Garage)', CarClassID: 1, CarClassEstLapTime: T },
  ] },
});
// Anna fährt genau 2,0 s vor mir, Bernd 3,5 s hinter mir – alle mit demselben Geschwindigkeitsverlauf
const OFFSET = [0, 2, -3.5];
function frame(t, type) {
  const lap = [], pct = [];
  for (const o of OFFSET) { const x = (t + o + 10 * T) / T; lap.push(Math.floor(x) - 10); pct.push(pctAt(x - Math.floor(x))); }
  return {
    PlayerCarIdx: 0, SessionNum: 0, SessionState: 4, SessionTime: t,
    CarIdxLap: [...lap, -1], CarIdxLapCompleted: [...lap.map((l) => l - 1), -1],
    CarIdxLapDistPct: [...pct, -1], CarIdxEstTime: [...pct.map((p) => p * T), 0], CarIdxTrackSurface: [3, 3, 3, -1],
    CarIdxPosition: [2, 1, 3, 4], CarIdxClassPosition: [2, 1, 3, 4],
    CarIdxBestLapTime: [T, T, T, -1], CarIdxLastLapTime: [T, T, T, -1],
  };
}

for (const type of ['Race', 'Practice']) {
  const S = session(type), gaps = new GapTracker();
  let st, worstEst = 0;
  for (let t = 20; t < 20 + 1.6 * T; t += 1 / 30) {
    st = buildState(frame(t, type), S, { gaps });
    if (t > 20 + T * 1.1) {
      // nach einer Runde Zeitnahme: auf 0,05 s genau, überall auf der Strecke
      const g = st.dash.gaps.cls;
      assert.strictEqual(g.ahead.name, 'Anna', type);
      assert.strictEqual(g.behind.name, 'Bernd', type);
      assert.ok(Math.abs(g.ahead.gap.s - 2.0) < 0.05, `${type}: vor ${g.ahead.gap.s} bei t=${t.toFixed(1)}`);
      assert.ok(Math.abs(g.behind.gap.s - 3.5) < 0.05, `${type}: hinter ${g.behind.gap.s} bei t=${t.toFixed(1)}`);
      const est = buildState(frame(t, type), S, {}).dash.gaps.cls.ahead.gap.s;
      worstEst = Math.max(worstEst, Math.abs(est - 2.0));
    }
  }
  assert.ok(worstEst > 0.1, 'ohne Zeitnahme (nur Streckenanteil) wäre der Abstand ungenauer');
  if (type === 'Practice') {
    assert.strictEqual(st.dash.gaps.all.pos, 2, 'Training: eigene offizielle Position');
    assert.strictEqual(st.dash.gaps.cls.ahead.pos, 1);
  }
  console.log(`OK – ${type}: Abstand vor 2.00 / hinter 3.50 s genau (nur Streckenanteil: bis ${worstEst.toFixed(2)} s daneben)`);
}

// Battle: Anna fährt mir 0,5 s pro Runde davon → Δ Runde ≈ +0,50, Richtung ▲ (Abstand wächst)
{
  const { BattleTracker } = require('../src/gaps');
  const S = session('Race'), gaps = new GapTracker(), battle = new BattleTracker();
  const base = OFFSET[1];
  let st;
  for (let t = 20; t < 20 + 2.3 * T; t += 1 / 30) {
    OFFSET[1] = base + 0.005 * (t - 20);
    st = buildState(frame(t, 'Race'), S, { gaps, battle });
  }
  OFFSET[1] = base;
  const b = st.dash.gaps.cls.ahead.battle;
  assert.ok(b && Math.abs(b.lap - 0.5) < 0.05, 'Δ Runde ≈ +0.50, ist ' + (b && b.lap));
  assert.strictEqual(b.dir, 1, 'Abstand wächst gerade');
  assert.strictEqual(st.dash.gaps.cls.behind.battle.dir, 0, 'Bernd: Abstand gleich');
  assert.ok(Math.abs(st.dash.gaps.cls.behind.battle.lap) < 0.02, 'Bernd: Δ ≈ 0');
  console.log(`OK – Battle: Δ Runde ${b.lap.toFixed(2)} s (Gegner fährt 0,5 s/Runde davon), Richtung ▲`);
}

// Standings: Carla steht in der Garage (Telemetrie -1) → Zeiten aus ResultsPositions
const st = buildState(frame(50, 'Practice'), session('Practice'), {});
const carla = st.classes[0].rows.find((c) => c.name.startsWith('Carla'));
assert.strictEqual(carla.best, 101.25);
assert.strictEqual(carla.last, 102);
assert.strictEqual(st.classes[0].rows.find((c) => c.name === 'Anna').best, T, 'Telemetrie hat Vorrang');
console.log('OK – Standings: Rundenzeiten aus den Session-Ergebnissen, wenn die Telemetrie keine hat');
