// Merkt sich pro Rennen die Startplätze und zählt die Boxenstopps jedes Autos.
'use strict';

const RACING = 4; // irsdk_SessionState: 4 = Rennen läuft (grün)

class RaceTracker {
  constructor() { this.reset(); }

  reset() {
    this.key = null;
    this.start = new Map();     // carIdx -> Startplatz in der Klasse
    this.startSource = null;    // 'qualify' | 'snapshot'
    this.stops = new Map();     // carIdx -> Anzahl Boxenstopps
    this.inPit = new Map();     // carIdx -> war zuletzt in der Boxengasse
  }

  // cars: [{ idx, classId, classPos, pit }] (classPos 1-basiert, 0 = unbekannt)
  update(d, s, isRace, cars) {
    const key = `${d.SessionUniqueID ?? ''}/${d.SessionNum ?? 0}`;
    if (key !== this.key) { this.reset(); this.key = key; }
    if (!isRace) return;

    // 1. Startaufstellung aus der Qualifikation (Positionen sind dort 0-basiert)
    const q = s && s.QualifyResultsInfo && s.QualifyResultsInfo.Results;
    if (this.startSource !== 'qualify' && Array.isArray(q) && q.length) {
      this.start.clear();
      for (const r of q) if (r && r.CarIdx != null && r.ClassPosition != null) this.start.set(r.CarIdx, r.ClassPosition + 1);
      this.startSource = 'qualify';
    }
    // 2. sonst: Reihenfolge beim Start (erster Moment im grünen Rennen mit gültigen Positionen)
    if (!this.startSource && d.SessionState === RACING && cars.length && cars.every((c) => c.classPos > 0)) {
      for (const c of cars) this.start.set(c.idx, c.classPos);
      this.startSource = 'snapshot';
    }

    // Boxenstopps zählen: Wechsel Strecke -> Boxengasse während des Rennens
    for (const c of cars) {
      const was = this.inPit.get(c.idx);
      if (was === false && c.pit && d.SessionState === RACING) this.stops.set(c.idx, (this.stops.get(c.idx) || 0) + 1);
      this.inPit.set(c.idx, !!c.pit);
    }
  }

  startPos(idx) { return this.start.get(idx) || 0; }
  pitStops(idx) { return this.stops.get(idx) || 0; }
}

module.exports = { RaceTracker };
