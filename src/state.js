// Wandelt rohe iRacing-Daten (oder Demo-Daten im gleichen Format) in einen
// einfachen Zustand für die Overlays um. Relative und Standings werden hier berechnet.
'use strict';

function colorHex(n, fallback = '#888888') {
  if (typeof n === 'string') n = parseInt(n, 16);
  if (typeof n !== 'number' || isNaN(n) || n === 0) return fallback;
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

function wrap(v, range) {
  // auf (-range/2, range/2] bringen
  while (v > range / 2) v -= range;
  while (v <= -range / 2) v += range;
  return v;
}

function buildState(d, s, opts) {
  const di = (s && s.DriverInfo) || {};
  const drivers = di.Drivers || [];
  const sessions = (s && s.SessionInfo && s.SessionInfo.Sessions) || [];
  const sessionNum = d.SessionNum || 0;
  const sess = sessions.find((x) => x.SessionNum === sessionNum) || sessions[sessionNum] || {};
  const sessionType = String(sess.SessionType || '');
  const isRace = /race/i.test(sessionType);
  const wi = (s && s.WeekendInfo) || {};
  const me = d.PlayerCarIdx != null ? d.PlayerCarIdx : di.DriverCarIdx;

  const pct = d.CarIdxLapDistPct || [];
  const lapC = d.CarIdxLapCompleted || d.CarIdxLap || [];
  // Gestartete Runde: wechselt im selben Moment wie LapDistPct an der Linie (LapCompleted hinkt teils kurz nach)
  const lapS = d.CarIdxLap || (d.CarIdxLapCompleted ? d.CarIdxLapCompleted.map((x) => x + 1) : []);
  const est = d.CarIdxEstTime || [];
  const f2 = d.CarIdxF2Time || [];
  const pos = d.CarIdxPosition || [];
  const cpos = d.CarIdxClassPosition || [];
  const pit = d.CarIdxOnPitRoad || [];
  const last = d.CarIdxLastLapTime || [];
  const best = d.CarIdxBestLapTime || [];
  const surf = d.CarIdxTrackSurface || [];

  // Fahrerliste
  const cars = [];
  for (const dr of drivers) {
    const i = dr.CarIdx;
    if (dr.IsSpectator || dr.CarIsPaceCar || /pace car/i.test(dr.UserName || '')) continue;
    const lic = String(dr.LicString || '');
    cars.push({
      idx: i,
      name: String(dr.UserName || ''),
      team: String(dr.TeamName || ''),
      number: String(dr.CarNumber || ''),
      car: String(dr.CarScreenNameShort || dr.CarScreenName || ''),
      classId: dr.CarClassID || 0,
      className: String(dr.CarClassShortName || ''),
      classColor: colorHex(dr.CarClassColor, '#cccccc'),
      classEst: dr.CarClassEstLapTime || 0,
      iRating: dr.IRating || 0,
      license: lic.split(' ')[0] || '',
      sr: lic.split(' ')[1] || '',
      licColor: colorHex(dr.LicColor, '#666666'),
      pct: pct[i] != null ? pct[i] : -1,
      lap: lapC[i] != null ? lapC[i] : 0,
      // gefahrene Distanz in Runden (live, für die aktuelle Reihenfolge)
      dist: lapS[i] != null && lapS[i] >= 0 && pct[i] >= 0 ? lapS[i] + pct[i] : null,
      est: est[i] || 0,
      f2: f2[i] || 0,
      pos: pos[i] || 0,
      classPos: cpos[i] || 0,
      pit: !!pit[i],
      last: last[i] > 0 ? last[i] : 0,
      best: best[i] > 0 ? best[i] : 0,
      inWorld: (surf[i] != null ? surf[i] !== -1 : true) && pct[i] >= 0,
      isPlayer: i === me,
      flag: flagCode(dr.FlairName, opts.flagMap),
      flagName: dr.FlairName ? String(dr.FlairName) : '',
      // Incidents: eigener Wert live aus der Telemetrie, sonst aus der Session-Info
      inc: i === me && d.PlayerCarMyIncidentCount != null ? d.PlayerCarMyIncidentCount
        : (dr.CurDriverIncidentCount != null ? dr.CurDriverIncidentCount : (dr.TeamIncidentCount != null ? dr.TeamIncidentCount : -1)),
    });
  }
  const meCar = cars.find((c) => c.isPlayer);

  // ---------- Relative ----------
  let relative = [];
  const relDash = { all: [], cls: [] };
  if (meCar && meCar.inWorld) {
    const estLap = meCar.classEst || meCar.best || meCar.last || 90;
    for (const c of cars) {
      if (!c.inWorld) continue;
      let gap;
      if (c.isPlayer) gap = 0;
      else if (c.est > 0 && meCar.est > 0 && c.classEst > 0 && meCar.classEst > 0) {
        // Est-Time jeder Klasse auf Rundenanteil normieren, dann mit eigener Rundenzeit gewichten
        gap = wrap(c.est / c.classEst - meCar.est / meCar.classEst, 1) * estLap;
      } else gap = wrap(c.pct - meCar.pct, 1) * estLap;
      const total = c.lap + c.pct, myTotal = meCar.lap + meCar.pct;
      let lapState = 0; // 0 gleiche Runde, 1 Runde voraus (überrundet dich), -1 Runde zurück
      if (isRace && !c.isPlayer) {
        const diff = total - myTotal;
        if (diff > 0.5) lapState = 1; else if (diff < -0.5) lapState = -1;
      }
      relative.push({ ...c, gap, lapState });
    }
    relative.sort((a, b) => b.gap - a.gap);
    // für das Dashboard: je 3 vor/hinter dir – gesamt und nur eigene Klasse
    relDash.all = around(relative, 3);
    relDash.cls = around(relative.filter((c) => c.classId === meCar.classId), 3);
    relative = around(relative, opts.relativeRows || 4);
  }

  // ---------- Standings ----------
  const classes = new Map();
  for (const c of cars) {
    if (!classes.has(c.classId)) classes.set(c.classId, { id: c.classId, name: c.className, color: c.classColor, cars: [] });
    classes.get(c.classId).cars.push(c);
  }
  const classList = [...classes.values()];
  for (const cl of classList) {
    // Sortierung: offizielle Position, sonst beste Runde, sonst Distanz
    cl.cars.sort((a, b) => {
      if (a.classPos && b.classPos) return a.classPos - b.classPos;
      if (a.classPos) return -1; if (b.classPos) return 1;
      if (!isRace) {
        if (a.best && b.best) return a.best - b.best;
        if (a.best) return -1; if (b.best) return 1;
      }
      return (b.lap + b.pct) - (a.lap + a.pct);
    });
    const leader = cl.cars[0];
    const classBest = Math.min(...cl.cars.map((c) => c.best || Infinity));
    cl.cars.forEach((c, k) => {
      c.classPos = c.classPos || k + 1;
      c.fastest = c.best > 0 && c.best === classBest;
      if (k === 0) { c.gapText = isRace ? 'Leader' : (c.best ? fmtLap(c.best) : '—'); return; }
      if (isRace) {
        const lapsDown = Math.floor((leader.lap + leader.pct) - (c.lap + c.pct));
        if (lapsDown >= 1) c.gapText = `+${lapsDown}L`;
        else if (c.f2 > 0 || leader.f2 > 0) c.gapText = '+' + Math.max(0, c.f2 - leader.f2).toFixed(1);
        else c.gapText = '—';
      } else {
        c.gapText = c.best && leader.best ? '+' + (c.best - leader.best).toFixed(3) : '—';
      }
    });
    cl.size = cl.cars.length;
    cl.sof = Math.round(cl.cars.reduce((a, c) => a + (c.iRating || 0), 0) / Math.max(1, cl.cars.length));
    // Prognose iRating-Änderung, falls das Rennen mit diesem Stand endet (nur Rennen)
    if (isRace) {
      const deltas = irChanges(cl.cars.map((c) => c.iRating || 1350));
      cl.cars.forEach((c, k) => { c.irDelta = deltas[k]; });
    }
  }
  // Startplätze und Boxenstopps
  if (opts.race) {
    opts.race.update(d, s, isRace, cars);
    for (const c of cars) {
      c.startPos = opts.race.startPos(c.idx);
      c.gain = isRace && c.startPos && c.classPos ? c.startPos - c.classPos : null;
      c.stops = opts.race.pitStops(c.idx);
    }
  }

  // Klassen: schnellste (kleinste Rundenzeit) zuerst
  classList.sort((a, b) => (a.cars[0] && b.cars[0] ? (a.cars[0].classEst || 0) - (b.cars[0].classEst || 0) : 0));
  const multiClass = classList.length > 1;
  const maxRows = opts.standingsRows || 14;
  for (const cl of classList) {
    const hasMe = cl.cars.some((c) => c.isPlayer);
    const limit = !multiClass ? maxRows : (hasMe ? Math.max(5, maxRows - 4 * (classList.length - 1)) : 3);
    cl.rows = pickRows(cl.cars, limit);
  }

  // ---------- Motor ----------
  // Motor läuft: Drehzahl vorhanden und kein "abgewürgt"-Flag (EngineWarnings Bit 0x08)
  const engineOn = (d.RPM || 0) > 300 && !((d.EngineWarnings || 0) & 0x08) && d.IsOnTrack !== false;

  // ---------- Spieler / Eingaben ----------
  const player = {
    speed: d.Speed || 0,
    gear: d.Gear != null ? d.Gear : 0,
    rpm: d.RPM || 0,
    throttle: d.Throttle || 0,
    brake: d.Brake || 0,
    clutch: d.Clutch != null ? 1 - d.Clutch : 0,
    steer: d.SteeringWheelAngle || 0,
    steerMax: d.SteeringWheelAngleMax || 7.85,
    delta: d.LapDeltaToBestLap || 0,
    deltaOk: !!d.LapDeltaToBestLap_OK,
    lastLap: d.LapLastLapTime > 0 ? d.LapLastLapTime : 0,
    bestLap: d.LapBestLapTime > 0 ? d.LapBestLapTime : 0,
    lap: d.Lap || 0,
    fuel: d.FuelLevel || 0,
    position: meCar ? meCar.pos : 0,
    classPosition: meCar ? meCar.classPos : 0,
    onTrack: d.IsOnTrack !== false,
  };

  const dash = buildDash(d, s, opts, { meCar, isRace, classList, cars });
  // Abstände zu Vorder- und Hintermann (nach Position) – gesamt und in der Klasse
  if (meCar) {
    // Im laufenden Rennen zählt die LIVE-Reihenfolge nach gefahrener Distanz – iRacing aktualisiert die Positionen
    // erst an der Linie, nach einem Überholmanöver wäre der Vordermann sonst bis zum Rundenende falsch.
    // Autos, die nicht auf der Strecke sind (Garage, getrennt), sind keine direkten Gegner.
    const live = isRace && d.SessionState !== undefined ? d.SessionState >= 4 : isRace;
    let order;
    if (live && meCar.dist != null) order = cars.filter((c) => c.dist != null && c.inWorld).sort((a, b) => b.dist - a.dist);
    else order = cars.filter((c) => c.pos > 0).sort((a, b) => a.pos - b.pos);
    if (!order.includes(meCar)) order = cars.slice();
    const clsOrder = live && meCar.dist != null ? order.filter((c) => c.classId === meCar.classId)
      : ((classList.find((cl) => cl.cars.includes(meCar)) || {}).cars || []);
    dash.gaps = { all: neighbours(order, meCar, isRace), cls: neighbours(clsOrder, meCar, isRace) };
  }
  dash.relAll = relDash.all.map(slimCar);
  dash.relClass = relDash.cls.map(slimCar);
  const radar = buildRadar(d, s, opts, { meCar, cars });

  return {
    connected: true,
    engineOn,
    dash,
    radar,
    source: opts.source,
    session: {
      type: sessionType,
      isRace,
      track: String(wi.TrackDisplayName || ''),
      timeRemain: d.SessionTimeRemain != null && d.SessionTimeRemain < 604800 ? d.SessionTimeRemain : -1,
      lapsRemain: d.SessionLapsRemainEx != null && d.SessionLapsRemainEx < 32767 ? d.SessionLapsRemainEx : -1,
      totalCars: cars.length,
      multiClass,
    },
    player,
    relative: relative.map(slimCar),
    classes: classList.map((cl) => ({ name: cl.name, color: cl.color, size: cl.size, sof: cl.sof, rows: cl.rows.map(slimCar) })),
  };
}

// Abstand zwischen zwei Autos: im Rennen Zeitabstand auf der Strecke (bzw. Runden), sonst Differenz der Bestzeiten
function gapBetween(front, back, isRace) {
  if (!front || !back) return null;
  if (!isRace) return front.best && back.best ? { s: back.best - front.best } : null;
  const dist = front.dist != null && back.dist != null ? front.dist - back.dist : (front.lap + front.pct) - (back.lap + back.pct);
  if (dist >= 1) return { laps: Math.floor(dist) };
  const lapT = back.best || back.last || back.classEst || 90;
  if (dist <= 0) return { s: Math.max(0, back.f2 - front.f2) }; // Positionen noch nicht aktualisiert
  let frac = dist;
  if (front.est > 0 && back.est > 0 && front.classEst > 0 && back.classEst > 0) {
    frac = front.est / front.classEst - back.est / back.classEst;
    frac -= Math.floor(frac);
    if (Math.abs(frac - dist) > 0.5) frac = dist; // Plausibilitätsprüfung
  }
  return { s: frac * lapT };
}

function neighbours(list, me, isRace) {
  const i = list.indexOf(me);
  const posKey = '_rank';
  list.forEach((c, k) => { c._rank = k + 1; });
  if (i < 0) return { ahead: null, behind: null, pos: 0, size: list.length };
  const info = (c, g) => c && {
    idx: c.idx, name: c.name, number: c.number, classColor: c.classColor, className: c.className,
    pos: c[posKey], last: c.last, best: c.best, pit: c.pit, gap: g,
    lastDiff: c.last && me.last ? c.last - me.last : null, // >0: der andere war in der letzten Runde langsamer
  };
  const a = list[i - 1], b = list[i + 1];
  return { ahead: info(a, gapBetween(a, me, isRace)), behind: info(b, gapBetween(me, b, isRace)), pos: me[posKey], size: list.length };
}

// n Autos vor und hinter dem Spieler (Liste ist nach Abstand sortiert)
function around(list, n) {
  const i = list.findIndex((c) => c.isPlayer);
  return i < 0 ? [] : list.slice(Math.max(0, i - n), i + n + 1);
}

// Top 3 immer, dann ein Fenster um den Spieler
function pickRows(list, limit) {
  if (list.length <= limit) return list;
  const me = list.findIndex((c) => c.isPlayer);
  if (me < 0 || me < limit) return list.slice(0, limit);
  const top = list.slice(0, 3);
  const rest = limit - 3;
  let start = me - Math.floor(rest / 2);
  start = Math.max(3, Math.min(start, list.length - rest));
  const out = top.concat(list.slice(start, start + rest));
  if (start > 3) out[3] = { ...out[3], gapBefore: true };
  return out;
}

function slimCar(c) {
  return {
    idx: c.idx, name: c.name, number: c.number, car: c.car, className: c.className, classColor: c.classColor,
    iRating: c.iRating, license: c.license, sr: c.sr, licColor: c.licColor, pos: c.pos, classPos: c.classPos,
    pit: c.pit, last: c.last, best: c.best, isPlayer: c.isPlayer, gap: c.gap, lapState: c.lapState,
    gapText: c.gapText, fastest: c.fastest, gapBefore: c.gapBefore, lap: c.lap,
    inc: c.inc, irDelta: c.irDelta, flag: c.flag, flagName: c.flagName, startPos: c.startPos, gain: c.gain, stops: c.stops,
  };
}

// ---------- Dashboard ----------
const FLAG_BITS = [
  [0x10000, 'black', 'SCHWARZE FLAGGE'], [0x20000, 'black', 'DISQUALIFIZIERT'], [0x100000, 'meatball', 'REPARATUR'],
  [0x10, 'red', 'ROTE FLAGGE'], [0x1, 'checkered', 'ZIELFLAGGE'], [0x4000, 'yellow', 'SAFETY CAR'], [0x8000, 'yellow', 'SAFETY CAR'],
  [0x8, 'yellow', 'GELBE FLAGGE'], [0x100, 'yellow', 'GELBE FLAGGE'], [0x40, 'debris', 'ÖL / TRÜMMER'],
  [0x20, 'blue', 'BLAUE FLAGGE'], [0x2, 'white', 'LETZTE RUNDE'], [0x4, 'green', 'GRÜN'],
];
function flagCode(name, map) {
  if (!name || !map) return null;
  const k = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return map[k] || null;
}
function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
function wheel(d, w) {
  const t = [d[w + 'tempCL'], d[w + 'tempCM'], d[w + 'tempCR']].map(num);
  const p = num(d[w + 'pressure']) ?? num(d[w + 'coldPressure']);
  return { t: t.every((x) => x == null) ? null : t, p: p != null && p > 0 ? p : null };
}

function buildDash(d, s, opts, { meCar, isRace, classList }) {
  const di = (s && s.DriverInfo) || {};
  const wi = (s && s.WeekendInfo) || {};
  const redline = num(di.DriverCarRedLine) || 0;
  const shift = {
    first: num(di.DriverCarSLFirstRPM) || (redline ? redline * 0.82 : 0),
    shift: num(di.DriverCarSLShiftRPM) || (redline ? redline * 0.94 : 0),
    last: num(di.DriverCarSLLastRPM) || (redline ? redline * 0.97 : 0),
    blink: num(di.DriverCarSLBlinkRPM) || redline || 0,
  };

  const myClass = meCar ? classList.find((cl) => cl.cars.includes(meCar)) : null;
  const lapTime = (meCar && (meCar.best || meCar.last)) || num(di.DriverCarEstLapTime) || (meCar && meCar.classEst) || 0;

  // Sprit
  const fuel = num(d.FuelLevel);
  let fuelInfo = null;
  if (fuel != null) {
    if (opts.fuel) opts.fuel.update(d);
    const pl = opts.fuel ? opts.fuel.perLap(lapTime, d.FuelUsePerHour) : { value: 0, estimated: true };
    const lapsRemain = d.SessionLapsRemainEx != null && d.SessionLapsRemainEx < 32767 ? d.SessionLapsRemainEx : -1;
    const timeRemain = d.SessionTimeRemain != null && d.SessionTimeRemain < 604800 ? d.SessionTimeRemain : -1;
    const pct = meCar ? Math.max(0, meCar.pct) : 0;
    // Runden bis zum Ziel (Schätzung): Restrunden bzw. Restzeit / Rundenzeit + angefangene Runde
    let toGo = null;
    if (isRace && lapsRemain >= 0) toGo = lapsRemain + (1 - pct);
    else if (isRace && timeRemain >= 0 && lapTime > 0) toGo = timeRemain / lapTime + (1 - pct) + 1;
    const maxL = num(di.DriverCarFuelMaxLtr) ? di.DriverCarFuelMaxLtr * (num(di.DriverCarMaxFuelPct) || 1) : 0;
    fuelInfo = {
      level: fuel,
      pct: num(d.FuelLevelPct) ?? (maxL ? fuel / maxL : null),
      perLap: pl.value || null,
      estimated: pl.estimated,
      laps: pl.value ? fuel / pl.value : null,
      toGo,
      toFinish: pl.value && toGo != null ? toGo * pl.value - fuel : null, // >0: so viel fehlt noch
      max: maxL || null,
    };
  }

  const flagsBits = d.SessionFlags || 0;
  const flags = [];
  for (const [bit, kind, label] of FLAG_BITS) if (flagsBits & bit && !flags.some((f) => f.label === label)) flags.push({ kind, label });

  const incLimit = parseInt(wi.WeekendOptions && wi.WeekendOptions.IncidentLimit, 10);

  // Wahrscheinliche Rundenzeit: Bestzeit + aktuelles Delta (sonst Schätzung von iRacing)
  let predicted = null;
  if (d.LapDeltaToBestLap_OK && d.LapBestLapTime > 0) predicted = d.LapBestLapTime + d.LapDeltaToBestLap;
  else if (d.LapDeltaToOptimalLap_OK && d.LapOptimalLapTime > 0) predicted = d.LapOptimalLapTime + d.LapDeltaToOptimalLap;
  else if (num(di.DriverCarEstLapTime)) predicted = di.DriverCarEstLapTime;

  // Schaden: iRacing meldet ihn als Reparaturzeit (Pflicht / optional) plus Motor-Warnungen
  const ew = d.EngineWarnings || 0;
  const meIdx = d.PlayerCarIdx;
  const carFlags = d.CarIdxSessionFlags && meIdx != null ? d.CarIdxSessionFlags[meIdx] || 0 : 0;
  const wear = (w) => { const v = [d[w + 'wearL'], d[w + 'wearM'], d[w + 'wearR']].map(num); return v.every((x) => x == null) ? null : v; };
  const damage = {
    repair: num(d.PitRepairLeft),
    optRepair: num(d.PitOptRepairLeft),
    meatball: !!((carFlags | flagsBits) & 0x100000),
    warnings: [
      [0x01, 'Wassertemperatur'], [0x02, 'Benzindruck'], [0x04, 'Öldruck'], [0x40, 'Öltemperatur'], [0x08, 'Motor abgewürgt'],
    ].filter(([b]) => ew & b).map(([, t]) => t),
    wear: { LF: wear('LF'), RF: wear('RF'), LR: wear('LR'), RR: wear('RR') },
  };

  // Motor-Mapping: je nach Auto unterschiedliche Variable
  const MAPS = [['dcEnginePower', 'MAP'], ['dcFuelMixture', 'MIX'], ['dcThrottleShape', 'THR'], ['dcEngineBraking', 'EB']];
  const mapVar = MAPS.find(([k]) => num(d[k]) != null);

  return {
    predicted,
    damage,
    map: mapVar ? { label: mapVar[1], value: d[mapVar[0]] } : null,
    gain: meCar ? meCar.gain : null,
    fuelPress: num(d.FuelPress),
    gear: d.Gear != null ? d.Gear : 0,
    speed: d.Speed || 0,
    rpm: d.RPM || 0,
    shift,
    lapCurrent: num(d.LapCurrentLapTime),
    lastLap: d.LapLastLapTime > 0 ? d.LapLastLapTime : null,
    bestLap: d.LapBestLapTime > 0 ? d.LapBestLapTime : null,
    delta: d.LapDeltaToBestLap_OK ? d.LapDeltaToBestLap : null,
    deltaSession: d.LapDeltaToSessionBestLap_OK ? d.LapDeltaToSessionBestLap : null,
    position: meCar ? meCar.pos : 0,
    classPosition: meCar ? meCar.classPos : 0,
    classSize: myClass ? myClass.cars.length : 0,
    className: myClass ? myClass.name : '',
    classColor: myClass ? myClass.color : null,
    lap: d.Lap || 0,
    lapsTotal: d.SessionLapsTotal != null && d.SessionLapsTotal < 32767 ? d.SessionLapsTotal : null,
    fuel: fuelInfo,
    bb: num(d.dcBrakeBias),
    tc: num(d.dcTractionControl),
    tc2: num(d.dcTractionControl2),
    abs: num(d.dcABS),
    water: num(d.WaterTemp),
    oil: num(d.OilTemp),
    oilPress: num(d.OilPress),
    voltage: num(d.Voltage),
    tyres: { LF: wheel(d, 'LF'), RF: wheel(d, 'RF'), LR: wheel(d, 'LR'), RR: wheel(d, 'RR') },
    trackTemp: num(d.TrackTempCrew) ?? num(d.TrackTemp),
    airTemp: num(d.AirTemp),
    incidents: d.PlayerCarMyIncidentCount != null ? d.PlayerCarMyIncidentCount : (meCar ? meCar.inc : null),
    incidentLimit: isFinite(incLimit) ? incLimit : null,
    flags,
    pitLimiter: !!((d.EngineWarnings || 0) & 0x10),
    onPitRoad: !!d.OnPitRoad,
  };
}

// ---------- Radar ----------
function trackLengthM(wi) {
  const m = String((wi && wi.TrackLength) || '').match(/([\d.]+)\s*(km|mi)?/);
  if (!m) return 4000;
  const v = parseFloat(m[1]);
  return m[2] === 'mi' ? v * 1609.34 : v * 1000;
}

function buildRadar(d, s, opts, { meCar, cars }) {
  const range = opts.radarRange || 40;
  const out = { range, cars: [], side: d.CarLeftRight != null ? d.CarLeftRight : 0 };
  if (!meCar || !meCar.inWorld) return out;
  const len = trackLengthM(s && s.WeekendInfo);
  const surf = d.CarIdxTrackSurface || [];
  for (const c of cars) {
    if (c.isPlayer || !c.inWorld) continue;
    if (c.pit !== meCar.pit) continue; // Boxengasse und Strecke getrennt betrachten
    if (surf[c.idx] === 0 || surf[c.idx] === 1) continue; // nicht in Garage/Boxenplatz
    const dist = wrap(c.pct - meCar.pct, 1) * len;
    if (Math.abs(dist) <= range) out.cars.push({ dist: Math.round(dist * 10) / 10, color: c.classColor, number: c.number, sameClass: c.classId === meCar.classId });
  }
  out.cars.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
  return out;
}

// iRating-Schätzung nach der von der Community ermittelten iRacing-Formel (Elo-ähnlich).
// ratings in Reihenfolge der aktuellen Position (Index 0 = P1). Ergebnis: Änderung je Fahrer.
const BR1 = 1600 / Math.LN2;
function irChanges(ratings) {
  const n = ratings.length;
  if (n < 2) return ratings.map(() => 0);
  const e = ratings.map((r) => Math.exp(-r / BR1));
  const chance = (a, b) => ((1 - e[a]) * e[b]) / ((1 - e[b]) * e[a] + (1 - e[a]) * e[b]);
  return ratings.map((_, i) => {
    let expected = -0.5; // chance(i,i) = 0.5 wird mitgezählt und hier abgezogen
    for (let j = 0; j < n; j++) expected += chance(i, j);
    const position = i + 1;
    const fudge = (n / 2 - position) / 100;
    return Math.round((n - position - expected - fudge) * 200 / n);
  });
}

function fmtLap(t) {
  if (!(t > 0)) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

module.exports = { buildState, irChanges };
