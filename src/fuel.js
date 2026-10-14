// Sprit-Rechner: misst den Verbrauch pro Runde über die letzten Runden
// (Runden mit Boxenstopp oder Nachtanken werden nicht mitgezählt).
'use strict';

const KEEP = 5;            // Durchschnitt über die letzten 5 sauberen Runden
const KG_PER_LITER = 0.75; // für die Schätzung aus FuelUsePerHour (kg/h)

class FuelTracker {
  constructor() { this.reset(); }

  reset() {
    this.laps = [];
    this.lastLap = null;
    this.lapStartFuel = null;
    this.lapDirty = true;
    this.lastFuel = null;
    this.sessionKey = null;
  }

  update(d) {
    const fuel = d.FuelLevel;
    if (fuel == null) return;
    const key = `${d.SessionUniqueID ?? ''}/${d.SessionNum ?? 0}`;
    if (key !== this.sessionKey) { this.reset(); this.sessionKey = key; }

    const lap = d.LapCompleted != null ? d.LapCompleted : (d.Lap != null ? d.Lap - 1 : null);
    if (lap == null) return;

    // Nachgetankt (oder Reset) -> laufende Runde nicht werten
    if (this.lastFuel != null && fuel > this.lastFuel + 0.3) this.lapDirty = true;
    if (d.OnPitRoad) this.lapDirty = true;

    if (lap !== this.lastLap) {
      if (this.lastLap != null && lap === this.lastLap + 1 && !this.lapDirty && this.lapStartFuel != null) {
        const used = this.lapStartFuel - fuel;
        if (used > 0.05) { this.laps.push(used); if (this.laps.length > KEEP) this.laps.shift(); }
      }
      // erste beobachtete Runde ist nur eine Teilrunde -> nicht werten
      this.lapDirty = this.lastLap == null || !!d.OnPitRoad;
      this.lastLap = lap;
      this.lapStartFuel = fuel;
    }
    this.lastFuel = fuel;
  }

  // Verbrauch pro Runde: gemessen, sonst Schätzung aus dem momentanen Verbrauch
  perLap(lapTime, fuelUsePerHour) {
    if (this.laps.length) return { value: this.laps.reduce((a, b) => a + b, 0) / this.laps.length, estimated: false, laps: this.laps.length };
    if (fuelUsePerHour > 0 && lapTime > 0) return { value: fuelUsePerHour / KG_PER_LITER / 3600 * lapTime, estimated: true, laps: 0 };
    return { value: 0, estimated: true, laps: 0 };
  }
}

module.exports = { FuelTracker };
