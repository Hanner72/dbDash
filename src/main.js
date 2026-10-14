// dbDash – Hauptprozess
'use strict';

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { WebSocketServer } = require('ws');
const { IRSDK } = require('./irsdk');
const { Demo } = require('./demo');
const { buildState } = require('./state');
const { FuelTracker } = require('./fuel');
const { RaceTracker } = require('./race');
const { Joysticks, buttonLabel } = require('./joystick');

const VERSION = require('../package.json').version;
// Im fertigen Programm liegen die Overlays offen im Ordner resources/web (frei anpassbar)
const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'web');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// Overlays ohne Grafikkarte zeichnen (Einstellung „gpu“ aus): muss vor dem Start feststehen, wirkt nach Neustart
try {
  const early = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8'));
  if (early.gpu === false) app.disableHardwareAcceleration();
} catch { /* erster Start */ }

// ---------------- Einstellungen ----------------
const OVERLAYS = [
  { id: 'relative', title: 'Relative', file: 'relative.html', x: 60, y: 520 },
  { id: 'standings', title: 'Standings', file: 'standings.html', x: 60, y: 60 },
  { id: 'inputs', title: 'Inputs', file: 'inputs.html', x: 60, y: 860 },
  { id: 'delta', title: 'Delta', file: 'delta.html', x: 760, y: 60 },
  { id: 'dash', title: 'Dashboard', file: 'dash.html', x: 980, y: 560 },
  { id: 'radar', title: 'Radar (Ghost)', file: 'radar.html', x: 1640, y: 180 },
];
// Module des Dashboards
const DASH_MODULES = { shift: true };
// Anzeigen des Dashboards: jede kann links, rechts oder gar nicht angezeigt werden
const DASH_PAGE_LIST = [
  ['tyres', 'Reifen'], ['engine', 'Motor'], ['strategy', 'Sprit-Strategie'], ['relAll', 'Relative – Gesamt'],
  ['relClass', 'Relative – Klasse'], ['gapAll', 'Abstände – Gesamt'], ['gapClass', 'Abstände – Klasse'], ['laps', 'Rundenzeiten'], ['damage', 'Schaden'],
];
const DASH_PAGES = { tyres: 'left', engine: 'left', strategy: 'left', relAll: 'right', relClass: 'left', gapAll: 'left', gapClass: 'right', laps: 'right', damage: 'right' };
const SIDES = [['left', 'Links'], ['right', 'Rechts'], ['off', 'Aus']];
// Aktionen, die auf Tasten oder Lenkradknöpfe gelegt werden können
const ACTIONS = [
  { id: 'dashLeft', label: 'Dashboard: linkes Fenster umschalten' },
  { id: 'dashRight', label: 'Dashboard: rechtes Fenster umschalten' },
  { id: 'dashLeftPrev', label: 'Dashboard: linkes Fenster zurück' },
  { id: 'dashRightPrev', label: 'Dashboard: rechtes Fenster zurück' },
  { id: 'toggleVisible', label: 'Alle Overlays ein/aus' },
  { id: 'toggleEdit', label: 'Overlays verschieben ein/aus' },
];
const DEFAULT_BINDINGS = {
  dashLeft: { key: 'Alt+Shift+Left', joy: null },
  dashRight: { key: 'Alt+Shift+Right', joy: null },
  dashLeftPrev: { key: null, joy: null },
  dashRightPrev: { key: null, joy: null },
  toggleVisible: { key: 'Alt+Shift+H', joy: null },
  toggleEdit: { key: 'Alt+Shift+E', joy: null },
};
// Spalten der Standings, die sich ein-/ausschalten lassen
// Radar-Reichweite: Lücke Stoßstange zu Stoßstange in Metern
const RADAR_RANGES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 60, 80];
const STANDINGS_COLS = { gain: true, start: false, flag: true, pit: true, number: true, license: false, iRating: true, irDelta: true, incidents: true, last: true, best: true, gap: true };
// Zusatz-Optionen je Overlay für das Einstellungsfenster
const check = (path, label) => ({ path, label, type: 'check' });
const OVERLAY_OPTIONS = {
  standings: { title: 'Spalten', items: [
    check('standingsCols.gain', 'Plätze +/−'), check('standingsCols.start', 'Startplatz'), check('standingsCols.flag', 'Landesflagge'),
    check('standingsCols.pit', 'Box / Stopps'), check('standingsCols.number', 'Startnummer'), check('standingsCols.license', 'Lizenz'), check('standingsCols.iRating', 'iRating'),
    check('standingsCols.irDelta', 'iRating +/−'), check('standingsCols.incidents', 'Incidents'), check('standingsCols.last', 'Letzte Runde'),
    check('standingsCols.best', 'Beste Runde'), check('standingsCols.gap', 'Abstand')] },
  dash: { title: 'Anzeigen', single: true, items: [
    check('dashModules.shift', 'Schaltblitze'),
    ...DASH_PAGE_LIST.map(([k, label]) => ({ path: 'dashPages.' + k, label, type: 'select', options: SIDES }))] },
  radar: { title: 'Optionen', items: [
    check('radarAutoHide', 'Nur zeigen, wenn ein Auto innerhalb der Reichweite ist'),
    { path: 'radarRange', label: 'Reichweite (Lücke zum anderen Auto)', type: 'select', options: RADAR_RANGES.map((m) => [m, m + ' m']) }] },
};

const DEFAULTS = {
  port: 8182,
  demo: true,
  units: 'kmh',
  hideEngineOff: true,
  gpu: true,
  standingsCols: STANDINGS_COLS,
  dashModules: DASH_MODULES,
  dashPages: DASH_PAGES,
  dashPage: { left: 'tyres', right: 'laps' },
  bindings: DEFAULT_BINDINGS,
  radarRange: 40,
  radarAutoHide: true,
  editMode: false,
  visible: true,
  relativeRows: 4,
  standingsRows: 14,
  overlays: Object.fromEntries(OVERLAYS.map((o) => [o.id, { enabled: o.enabled !== false, x: o.x, y: o.y, scale: 1, bg: 0.82 }])),
};
let cfgPath;
let cfg;

function loadConfig() {
  cfgPath = path.join(app.getPath('userData'), 'settings.json');
  // Umstieg von „TriDash Overlays“ bzw. „PitWall Overlays“: vorhandene Einstellungen einmalig übernehmen
  const oldPath = ['TriDash Overlays', 'PitWall Overlays'].map((d) => path.join(app.getPath('appData'), d, 'settings.json')).find((p) => fs.existsSync(p));
  if (!fs.existsSync(cfgPath) && oldPath) {
    try { fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); fs.copyFileSync(oldPath, cfgPath); } catch (e) { console.error('Übernahme alter Einstellungen:', e.message); }
  }
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { /* erster Start */ }
  cfg = { ...DEFAULTS, ...saved, editMode: false };
  cfg.standingsCols = { ...STANDINGS_COLS, ...(saved.standingsCols || {}) };
  cfg.dashModules = { ...DASH_MODULES };
  for (const k in DASH_MODULES) if (saved.dashModules && k in saved.dashModules) cfg.dashModules[k] = saved.dashModules[k];
  cfg.dashPage = { ...DEFAULTS.dashPage, ...(saved.dashPage || {}) };
  cfg.dashPages = { ...DASH_PAGES };
  for (const k in DASH_PAGES) {
    if (saved.dashPages && ['left', 'right', 'off'].includes(saved.dashPages[k])) cfg.dashPages[k] = saved.dashPages[k];
    else if (saved.dashModules && saved.dashModules[k] === false) cfg.dashPages[k] = 'off'; // alte Einstellung (Version 1.3)
  }
  cfg.bindings = {};
  for (const a of ACTIONS) cfg.bindings[a.id] = { ...DEFAULT_BINDINGS[a.id], ...((saved.bindings || {})[a.id] || {}) };
  cfg.overlays = { ...DEFAULTS.overlays };
  for (const o of OVERLAYS) cfg.overlays[o.id] = { ...DEFAULTS.overlays[o.id], ...((saved.overlays || {})[o.id] || {}) };
}
let saveTimer = null;
function saveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); } catch (e) { console.error(e); }
  }, 300);
}

// ---------------- Telemetrie ----------------
const sdk = new IRSDK();
let demo = null;
let state = { connected: false };
const fuelTracker = new FuelTracker();
const raceTracker = new RaceTracker();
let flagMap = {};
try { flagMap = JSON.parse(fs.readFileSync(path.join(WEB, 'flags', 'names.json'), 'utf8')); } catch (e) { console.error('Flaggen:', e.message); }
let fuelSource = null;
let lastTick = Date.now();
let lastProbe = 0;
let tickNo = 0;

function tick() {
  const now = Date.now();
  // Ohne iRacing nur einmal pro Sekunde nachsehen, ob es gestartet wurde (spart CPU, solange nichts läuft)
  if (!cfg.demo && !state.connected) {
    if (now - lastProbe < 1000) return;
    lastProbe = now;
  }
  tickNo++;
  const dt = Math.min(0.2, (now - lastTick) / 1000);
  lastTick = now;
  let raw = null;
  let source = 'none';
  if (cfg.demo) {
    if (!demo) demo = new Demo();
    demo.step(dt);
    raw = demo.read();
    source = 'demo';
  } else {
    raw = sdk.read();
    source = 'iracing';
  }
  if (raw && raw.session) {
    try {
      if (fuelSource !== source) { fuelTracker.reset(); raceTracker.reset(); fuelSource = source; }
      state = buildState(raw.data, raw.session, { source, relativeRows: cfg.relativeRows, standingsRows: cfg.standingsRows, radarRange: cfg.radarRange, fuel: fuelTracker, race: raceTracker, flagMap });
    } catch (e) {
      console.error(e);
      state = { connected: false, error: String(e.message || e) };
    }
  } else {
    state = { connected: false, source };
  }
  broadcastState();
}

// Jedes Overlay bekommt nur die Daten, die es anzeigt, und nur so oft, wie es sie braucht.
// Weniger Daten und seltenere Updates = weniger Neuzeichnen = mehr FPS für iRacing.
const BASE_KEYS = ['connected', 'engineOn', 'source', 'error'];
const TOPICS = {
  relative: { hz: 10, keys: ['relative', 'player', 'session'] },
  standings: { hz: 4, keys: ['classes', 'session'] },
  inputs: { hz: 30, keys: ['player'] },
  delta: { hz: 20, keys: ['player'] },
  dash: { hz: 30, keys: ['dash', 'player', 'session'] },
  radar: { hz: 30, keys: ['radar'] },
  control: { hz: 1, keys: [] },
};
const TOPIC_ALL = { hz: 10, keys: null }; // unbekannte Seiten (z. B. eigene Overlays): alles, 10x pro Sekunde

function stateMsg(topic) {
  const t = TOPICS[topic] || TOPIC_ALL;
  if (!t.keys) return JSON.stringify({ type: 'state', state });
  const part = {};
  for (const k of BASE_KEYS.concat(t.keys)) if (state[k] !== undefined) part[k] = state[k];
  return JSON.stringify({ type: 'state', state: part });
}

function broadcastState() {
  const cache = {};
  const slow = !cfg.demo && !state.connected; // ohne iRacing: jeder Takt ist schon nur 1x pro Sekunde
  for (const c of clients) {
    if (c.readyState !== 1) continue;
    const t = TOPICS[c.topic] || TOPIC_ALL;
    if (!slow && tickNo % Math.max(1, Math.round(30 / t.hz))) continue;
    if (!(c.topic in cache)) cache[c.topic] = stateMsg(c.topic);
    c.send(cache[c.topic]);
  }
}

// ---------------- Webserver + WebSocket ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let wss;
const clients = new Set();

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p.startsWith('/api/')) return handleApi(req, res, p);
      if (p === '/') p = '/index.html';
      const file = path.normalize(path.join(WEB, p));
      if (!file.startsWith(WEB)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        // Flaggen/Grafiken dürfen zwischengespeichert werden (die Tabellen werden 30x pro Sekunde neu gezeichnet)
        const cache = /[\\/](flags|assets)[\\/]/.test(file) ? 'max-age=86400' : 'no-store';
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
        res.end(buf);
      });
    });
    const allowed = new Set([`http://127.0.0.1:${cfg.port}`, `http://localhost:${cfg.port}`]);
    wss = new WebSocketServer({
      server, path: '/ws',
      // Nur Seiten dieser App (und OBS-Browserquellen auf derselben Adresse) dürfen sich verbinden
      verifyClient: (info) => !info.origin || allowed.has(info.origin),
    });
    wss.on('connection', (ws, req) => {
      ws.topic = new URL(req.url, 'http://x').searchParams.get('id') || '';
      clients.add(ws);
      ws.send(JSON.stringify(configMsg()));
      ws.send(stateMsg(ws.topic));
      ws.on('message', (m) => { try { handleCmd(JSON.parse(m)); } catch (e) { console.error(e); } });
      ws.on('close', () => clients.delete(ws));
    });
    server.on('error', reject);
    server.listen(cfg.port, '127.0.0.1', resolve);
  });
}

// HTTP-Schnittstelle für Stream Deck & Co. (z. B. Plugin „Web Requests“):
//   /api/action/<aktion>   z. B. /api/action/dashLeft
//   /api/page/<anzeige>    z. B. /api/page/relClass
// Aufrufe aus Webseiten im Browser werden abgewiesen, damit fremde Seiten nichts auslösen können.
function handleApi(req, res, p) {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const site = req.headers['sec-fetch-site'];
  const origin = req.headers.origin;
  if ((site && site !== 'none' && site !== 'same-origin') || (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))) return send(403, { ok: false, error: 'nicht erlaubt' });
  const [, , kind, name] = p.split('/');
  if (kind === 'action' && ACTIONS.some((a) => a.id === name)) { runAction(name); return send(200, { ok: true, action: name }); }
  if (kind === 'page' && showPage(name)) return send(200, { ok: true, page: name });
  if (kind === 'list') return send(200, { actions: ACTIONS.map((a) => a.id), pages: DASH_PAGE_LIST.map(([k]) => k) });
  return send(404, { ok: false, error: 'unbekannt', hilfe: '/api/list' });
}

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(s);
}

function configMsg() {
  return {
    type: 'config',
    config: cfg,
    overlays: OVERLAYS.map(({ id, title, file }) => ({ id, title, file })),
    overlayOptions: OVERLAY_OPTIONS,
    dashPageList: DASH_PAGE_LIST,
    actions: ACTIONS.map((a) => ({ ...a, key: cfg.bindings[a.id].key, joy: cfg.bindings[a.id].joy ? joyLabel(cfg.bindings[a.id].joy) : null, keyError: shortcutErrors.has(a.id) })),
    learning: learning ? learning.action : null,
    joystick: { available: joysticks ? joysticks.available : false, devices: joysticks ? joysticks.devices() : [] },
    status: { version: VERSION, sdkAvailable: sdk.available, platform: process.platform, port: cfg.port },
  };
}
function pushConfig() { broadcast(configMsg()); saveConfig(); applyWindows(); updateTray(); }

function handleCmd(m) {
  switch (m.cmd) {
    case 'set': {
      // erlaubte Pfade: top-level Schlüssel oder overlays.<id>.<key>
      const parts = String(m.path).split('.');
      if (parts[0] === 'overlays' && cfg.overlays[parts[1]] && ['enabled', 'scale', 'bg'].includes(parts[2])) {
        cfg.overlays[parts[1]][parts[2]] = m.value;
      } else if (parts[0] === 'standingsCols' && parts[1] in STANDINGS_COLS && parts.length === 2) {
        cfg.standingsCols[parts[1]] = !!m.value;
      } else if (parts[0] === 'dashModules' && parts[1] in DASH_MODULES && parts.length === 2) {
        cfg.dashModules[parts[1]] = !!m.value;
      } else if (parts[0] === 'dashPages' && parts[1] in DASH_PAGES && parts.length === 2 && ['left', 'right', 'off'].includes(m.value)) {
        cfg.dashPages[parts[1]] = m.value;
      } else if (m.path === 'radarAutoHide') {
        cfg.radarAutoHide = !!m.value;
      } else if (m.path === 'radarRange' && RADAR_RANGES.includes(Number(m.value))) {
        cfg.radarRange = Number(m.value);
      } else if (['demo', 'units', 'editMode', 'visible', 'relativeRows', 'standingsRows', 'hideEngineOff', 'gpu'].includes(parts[0]) && parts.length === 1) {
        cfg[parts[0]] = m.value;
        if (parts[0] === 'demo' && m.value) demo = new Demo();
      } else return;
      pushConfig();
      break;
    }
    case 'size': {
      const w = windows[m.id];
      if (w && !w.isDestroyed()) sizeWindow(m.id, m.w, m.h);
      break;
    }
    case 'learn':
      if (!ACTIONS.some((a) => a.id === m.action)) return;
      learning = { action: m.action, until: Date.now() + 15000 };
      globalShortcut.unregisterAll(); // damit die Taste im Einstellungsfenster ankommt
      pushConfig();
      break;
    case 'cancelLearn':
      learning = null; applyShortcuts(); pushConfig();
      break;
    case 'bindKey':
      if (!learning || learning.action !== m.action || typeof m.accel !== 'string' || m.accel.length > 60) return;
      for (const a of ACTIONS) if (a.id !== m.action && cfg.bindings[a.id].key === m.accel) cfg.bindings[a.id].key = null; // keine Doppelbelegung
      cfg.bindings[m.action].key = m.accel;
      learning = null; applyShortcuts(); pushConfig();
      break;
    case 'clearBinding':
      if (!cfg.bindings[m.action] || !['key', 'joy'].includes(m.slot)) return;
      cfg.bindings[m.action][m.slot] = null;
      applyShortcuts(); pushConfig();
      break;
    case 'action':
      runAction(m.action);
      break;
    case 'resetPositions':
      for (const o of OVERLAYS) Object.assign(cfg.overlays[o.id], { x: o.x, y: o.y });
      for (const o of OVERLAYS) { const w = windows[o.id]; if (w && !w.isDestroyed()) w.setPosition(o.x, o.y); }
      pushConfig();
      break;
    case 'openUrl':
      if (/^https?:\/\/(127\.0\.0\.1|localhost):/.test(m.url)) shell.openExternal(m.url);
      break;
    case 'quit':
      app.quit();
      break;
  }
}

// ---------------- Tasten & Lenkradknöpfe ----------------
let joysticks = null;
let learning = null;               // { action, until }
const shortcutErrors = new Set();  // Aktionen, deren Taste Windows nicht freigegeben hat

function nextPage(side, dir = 1) {
  const list = DASH_PAGE_LIST.map(([k]) => k).filter((k) => cfg.dashPages[k] === side);
  if (!list.length) return;
  const i = Math.max(0, list.indexOf(cfg.dashPage[side]));
  cfg.dashPage[side] = list[(i + dir + list.length) % list.length];
}

// Eine bestimmte Anzeige direkt zeigen (z. B. per Stream-Deck-Taste); ist sie aus, kommt sie ins rechte Fenster
function showPage(page) {
  if (!(page in DASH_PAGES)) return false;
  if (cfg.dashPages[page] === 'off') cfg.dashPages[page] = 'right';
  cfg.dashPage[cfg.dashPages[page]] = page;
  pushConfig();
  return true;
}

function runAction(id) {
  switch (id) {
    case 'dashLeft': nextPage('left'); break;
    case 'dashRight': nextPage('right'); break;
    case 'dashLeftPrev': nextPage('left', -1); break;
    case 'dashRightPrev': nextPage('right', -1); break;
    case 'toggleVisible': cfg.visible = !cfg.visible; break;
    case 'toggleEdit': cfg.editMode = !cfg.editMode; break;
    default: return;
  }
  pushConfig();
}

function applyShortcuts() {
  globalShortcut.unregisterAll();
  shortcutErrors.clear();
  if (learning) return;
  for (const a of ACTIONS) {
    const key = cfg.bindings[a.id].key;
    if (!key) continue;
    let ok = false;
    try { ok = globalShortcut.register(key, () => runAction(a.id)); } catch { ok = false; }
    if (!ok) shortcutErrors.add(a.id);
  }
}

function joyLabel(j) { return `${j.name || 'Gerät ' + (j.dev + 1)} · ${buttonLabel(j.btn)}`; }

function onJoyButton(dev, btn) {
  const name = joysticks.deviceName(dev);
  if (learning) {
    const j = { dev, btn, name };
    for (const a of ACTIONS) { const b = cfg.bindings[a.id].joy; if (a.id !== learning.action && b && b.btn === btn && b.dev === dev) cfg.bindings[a.id].joy = null; }
    cfg.bindings[learning.action].joy = j;
    learning = null; applyShortcuts(); pushConfig();
    return;
  }
  // gleiches Gerät (Index) oder gleicher Gerätename – der Index kann sich nach Umstecken ändern
  const hit = ACTIONS.filter((a) => { const b = cfg.bindings[a.id].joy; return b && b.btn === btn && b.dev === dev; });
  const list = hit.length ? hit : ACTIONS.filter((a) => { const b = cfg.bindings[a.id].joy; return b && b.btn === btn && b.name === name; });
  for (const a of list) runAction(a.id);
}

// ---------------- Overlay-Fenster ----------------
const windows = {};
const contentSize = {};

function sizeWindow(id, w, h) {
  contentSize[id] = { w, h };
  const win = windows[id];
  const s = cfg.overlays[id].scale || 1;
  const W = Math.max(40, Math.ceil(w * s)), H = Math.max(20, Math.ceil(h * s));
  const [cw, ch] = win.getContentSize();
  if (cw === W && ch === H) return;
  // manche Fenstermanager ignorieren Größenänderungen bei nicht skalierbaren Fenstern
  win.setResizable(true);
  win.setContentSize(W, H);
  win.setResizable(false);
}

function createOverlay(o) {
  const c = cfg.overlays[o.id];
  const win = new BrowserWindow({
    x: c.x, y: c.y, width: 300, height: 100,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    skipTaskbar: true, focusable: false, show: false, alwaysOnTop: true,
    backgroundColor: '#00000000', title: `dbDash – ${o.title}`,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.setIgnoreMouseEvents(!cfg.editMode);
  win.loadURL(`http://127.0.0.1:${cfg.port}/${o.file}?win=1&id=${o.id}`);
  win.once('ready-to-show', () => { if (shouldShow(o.id)) win.showInactive(); });
  win.on('moved', () => {
    const [x, y] = win.getPosition();
    Object.assign(cfg.overlays[o.id], { x, y });
    saveConfig();
  });
  windows[o.id] = win;
}

function shouldShow(id) { return cfg.visible && cfg.overlays[id].enabled; }

function applyWindows() {
  for (const o of OVERLAYS) {
    let win = windows[o.id];
    if (shouldShow(o.id)) {
      if (!win || win.isDestroyed()) { createOverlay(o); continue; }
      win.setIgnoreMouseEvents(!cfg.editMode);
      win.setFocusable(!!cfg.editMode);
      if (contentSize[o.id]) sizeWindow(o.id, contentSize[o.id].w, contentSize[o.id].h);
      if (!win.isVisible()) win.showInactive();
    } else if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
    }
  }
}

// Sicherheitsnetz: Overlays regelmäßig wieder nach vorne holen und im sichtbaren Bereich halten
function keepOnTop() {
  for (const o of OVERLAYS) {
    const w = windows[o.id];
    if (w && !w.isDestroyed() && w.isVisible()) {
      w.setAlwaysOnTop(true, 'screen-saver');
      const b = w.getBounds();
      const visible = screen.getAllDisplays().some((d) => b.x < d.bounds.x + d.bounds.width - 20 && b.x + b.width > d.bounds.x + 20 && b.y < d.bounds.y + d.bounds.height - 20 && b.y + b.height > d.bounds.y);
      if (!visible) { const def = OVERLAYS.find((x) => x.id === o.id); w.setPosition(def.x, def.y); }
      else if (!cfg.editMode) {
        // ragt ein Overlay über den Bildschirmrand (z. B. weil es größer geworden ist), zurückschieben
        const wa = screen.getDisplayMatching(b).workArea;
        const nx = Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width);
        const ny = Math.min(Math.max(b.y, wa.y), wa.y + wa.height - b.height);
        if (nx !== b.x || ny !== b.y) { w.setPosition(nx, ny); Object.assign(cfg.overlays[o.id], { x: nx, y: ny }); saveConfig(); }
      }
    }
  }
}

// ---------------- Kontrollfenster & Tray ----------------
let panel = null;
let tray = null;
let quitting = false;

function openPanel() {
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return; }
  panel = new BrowserWindow({
    width: 560, height: 820, minWidth: 480, minHeight: 500,
    title: 'dbDash', autoHideMenuBar: true, backgroundColor: '#0f1115',
    icon: iconPath(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  panel.loadURL(`http://127.0.0.1:${cfg.port}/control.html`);
  panel.on('close', (e) => {
    if (!quitting) { e.preventDefault(); panel.hide(); }
  });
}

// Alle dbDash-Prozesse (Hauptprogramm, Overlay-Fenster, Grafik) mit niedrigerer Priorität laufen lassen:
// Windows gibt dann iRacing immer zuerst Rechenzeit. Neue Fenster bekommen eigene Prozesse → regelmäßig wiederholen.
function lowerPriority() {
  for (const m of app.getAppMetrics()) {
    try { os.setPriority(m.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* Prozess schon beendet */ }
  }
}

function iconPath() { return path.join(WEB, 'assets', 'icon.png'); }

function updateTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Einstellungen öffnen', click: openPanel },
    { type: 'separator' },
    { label: 'Overlays anzeigen', type: 'checkbox', checked: cfg.visible, click: (i) => { cfg.visible = i.checked; pushConfig(); } },
    { label: 'Overlays verschieben', type: 'checkbox', checked: cfg.editMode, click: (i) => { cfg.editMode = i.checked; pushConfig(); } },
    { label: 'Demo-Modus', type: 'checkbox', checked: cfg.demo, click: (i) => { cfg.demo = i.checked; if (i.checked) demo = new Demo(); pushConfig(); } },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]));
}

app.on('second-instance', () => openPanel());

app.whenReady().then(async () => {
  loadConfig();
  try {
    await startServer();
  } catch (e) {
    dialog.showErrorBox('dbDash', `Port ${cfg.port} ist bereits belegt. Läuft dbDash schon?\n\n${e.message}`);
    app.quit();
    return;
  }
  tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 }));
  tray.setToolTip('dbDash – dannerbam Dash');
  tray.on('click', openPanel);
  updateTray();

  applyShortcuts();
  joysticks = new Joysticks(onJoyButton);
  joysticks.start();
  // Lernmodus nach 15 s automatisch beenden; Geräteliste im Einstellungsfenster aktuell halten
  let lastDevs = '';
  setInterval(() => {
    if (learning && Date.now() > learning.until) { learning = null; applyShortcuts(); pushConfig(); }
    const devs = JSON.stringify(joysticks.devices());
    if (devs !== lastDevs) { lastDevs = devs; broadcast(configMsg()); }
  }, 1000);

  applyWindows();
  openPanel();
  setInterval(tick, 1000 / 30);
  setInterval(keepOnTop, 3000);
  lowerPriority();
  setInterval(lowerPriority, 10000);

  // Entwickler-Test: Screenshots aller Fenster speichern und beenden
  if (process.env.DBDASH_SHOT) {
    setTimeout(async () => {
      const dir = process.env.DBDASH_SHOT;
      for (const [id, w] of Object.entries({ ...windows, panel })) {
        if (id === 'panel' && process.env.DBDASH_SCROLL) {
          await w.webContents.executeJavaScript(`document.querySelector('#ov-${process.env.DBDASH_SCROLL === '1' ? 'standings' : process.env.DBDASH_SCROLL}').scrollIntoView()`);
          await new Promise((r) => setTimeout(r, 300));
        }
        const img = await w.webContents.capturePage();
        fs.writeFileSync(path.join(dir, id + '.png'), img.toPNG());
        console.log('SHOT', id, JSON.stringify(w.getBounds()), await w.webContents.executeJavaScript('innerWidth+"x"+innerHeight+" root "+JSON.stringify(document.getElementById("root")?.getBoundingClientRect())'), img.getSize().width+'x'+img.getSize().height);
      }
      app.quit();
    }, Number(process.env.DBDASH_SHOT_DELAY) || 5000);
  }
});

app.on('before-quit', () => { quitting = true; saveConfigNow(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); try { sdk.close(); } catch { } });
app.on('window-all-closed', (e) => { /* im Tray weiterlaufen */ });

function saveConfigNow() {
  clearTimeout(saveTimer);
  try { fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, editMode: false }, null, 2)); } catch { }
}
