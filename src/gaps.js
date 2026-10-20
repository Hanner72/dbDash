// Genauer Zeitabstand zwischen zwei Autos auf der Strecke (wie ein Zeitnehmer an der Strecke):
// Für jedes Auto wird gemerkt, WANN es zuletzt jede Stelle der Strecke passiert hat (1000 Messpunkte pro Runde).
// Abstand zum Vordermann = jetzt − Zeitpunkt, zu dem er an MEINER aktuellen Stelle war.
// Das ist genauer als Streckenanteil × Rundenzeit, weil Kurven/Geraden mit echten Zeiten eingehen.
'use strict';

const N = 1000;

class GapTracker {
  constructor() { this.reset(); }

  reset() {
    this.key = null;
    this.now = 0;
    this.cars = new Map(); // carIdx -> { t: Float64Array(N) (Sessionzeit je Messpunkt, NaN = unbekannt), p, at }
  }

  // now: Sessionzeit (s); cars: [{ idx, pct, inWorld }]; key: wechselt bei neuer Session
  update(now, cars, key) {
    if (typeof now !== 'number' || !isFinite(now)) return;
    if (key !== this.key || now < this.now - 1) { this.reset(); this.key = key; }
    this.now = now;
    for (const c of cars) {
      let h = this.cars.get(c.idx);
      if (!c.inWorld || !(c.pct >= 0)) { if (h) h.p = null; continue; }
      if (!h) { h = { t: new Float64Array(N).fill(NaN), p: null, at: 0 }; this.cars.set(c.idx, h); }
      const p1 = c.pct;
      if (h.p == null) { h.p = p1; h.at = now; continue; }
      let dp = p1 - h.p;
      if (dp < -0.5) dp += 1; // über die Ziellinie
      const dt = now - h.at;
      if (dp <= 0) {
        // steht oder kleines Zittern rückwärts: nichts eintragen; deutlich rückwärts = versetzt (Reset, Abschleppen)
        if (dp < -0.002) { h.t.fill(NaN); h.p = p1; h.at = now; }
        continue;
      }
      if (dp > 0.25 || dt <= 0 || dt > 3) {
        // Sprung (Abschleppen, Pause, Aussetzer): alte Werte passen nicht mehr zusammen
        h.t.fill(NaN); h.p = p1; h.at = now; continue;
      }
      // alle überquerten Messpunkte zwischen alter und neuer Stelle mit interpolierter Zeit eintragen
      const p0 = h.p, end = p0 + dp;
      for (let k = Math.floor(p0 * N) + 1; k / N <= end; k++) h.t[k % N] = h.at + ((k / N - p0) / dp) * dt;
      h.p = p1; h.at = now;
    }
  }

  // Sessionzeit, zu der Auto idx zuletzt an Stelle pct war (zwischen zwei Messpunkten interpoliert), sonst null
  timeAt(idx, pct) {
    const h = this.cars.get(idx);
    if (!h || !(pct >= 0)) return null;
    const x = (pct % 1) * N, k = Math.floor(x) % N;
    const a = h.t[k], b = h.t[(k + 1) % N];
    if (isNaN(a)) return null;
    if (isNaN(b) || b < a || b - a > 10) return a; // nächster Punkt noch nicht (in dieser Runde) passiert
    return a + (b - a) * (x - Math.floor(x));
  }

  // Zeitabstand von front zu back (s): wie lange ist es her, dass front an der Stelle von back war.
  // maxAge: älter = nicht verlässlich (z. B. front war zwischendurch weg) → null
  gap(front, back, maxAge) {
    if (!front || !back) return null;
    const t = this.timeAt(front.idx, back.pct);
    if (t == null) return null;
    const g = this.now - t;
    return g >= 0 && g <= (maxAge || 300) ? g : null;
  }
}

// Battle: wie entwickelt sich der Abstand zu einem Gegner?
// lead = Vorsprung des Gegners auf dich in s (+ = er liegt vor dir, − = hinter dir). Mit Vorzeichen, damit der
// Verlauf auch über Platztausche hinweg weiterläuft (Duell mit Überholmanövern).
// lap = lead jetzt − lead vor einer Runde an derselben Stelle (− = du hast gewonnen)
// dir = Richtung in den letzten 3 s (−1 du holst auf, 1 du verlierst, 0 gleich)
const B = 200; // Stellen pro Runde
class BattleTracker {
  constructor() { this.reset(); }
  reset() { this.map = new Map(); this.now = 0; }

  track(idx, lead, myPct, now, refLap) {
    if (lead == null || !(myPct >= 0) || typeof now !== 'number') return null;
    if (now < this.now - 1) this.map.clear(); // neue Session / Wiederholung
    this.now = now;
    let h = this.map.get(idx);
    const nan = () => new Float64Array(B).fill(NaN);
    if (!h) { h = { g: nan(), t: nan(), gP: nan(), tP: nan(), recent: [], last: now }; this.map.set(idx, h); }
    h.last = now;
    const k = Math.floor(myPct * B) % B;
    const lapT = refLap > 0 ? refLap : 120;
    // pro Runde einmal je Stelle merken; der Wert der vorigen Runde wandert nach gP/tP
    if (!(now - h.t[k] < lapT * 0.5)) { h.gP[k] = h.g[k]; h.tP[k] = h.t[k]; h.g[k] = lead; h.t[k] = now; }
    const age = now - h.tP[k];
    const lap = age > lapT * 0.5 && age < lapT * 1.6 ? lead - h.gP[k] : null;
    h.recent.push([now, lead]);
    while (h.recent.length > 1 && now - h.recent[0][0] > 3) h.recent.shift();
    const [t0, g0] = h.recent[0];
    const ch = now - t0 > 0.5 ? lead - g0 : 0;
    if (this.map.size > 64) for (const [x, v] of this.map) if (now - v.last > 300) this.map.delete(x);
    return { lap, dir: ch < -0.01 ? -1 : ch > 0.01 ? 1 : 0 };
  }
}

module.exports = { GapTracker, BattleTracker };
