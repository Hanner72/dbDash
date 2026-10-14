// Nimmt das Vorstellungsvideo auf:  npm run video
// Startet dbDash im Demo-Modus mit eigenen Einstellungen (die echten bleiben unberührt), spielt das Drehbuch
// aus scenes.js auf der Bühne studio.html ab und schreibt nach video/out/:
//   dbDash-Vorstellung.mp4 (1920×1080, 30 fps, ohne Ton), sprechtext.md, youtube-beschreibung.txt
// Benötigt ffmpeg: im PATH, über die Umgebungsvariable FFMPEG oder das npm-Paket ffmpeg-static.
'use strict';

const { app, BrowserWindow } = require('electron');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const SCENES = require('./scenes');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const PORT = 8182;
const FPS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findFfmpeg() {
  const tries = [process.env.FFMPEG, 'ffmpeg'];
  try { tries.push(require('ffmpeg-static')); } catch { /* nicht installiert */ }
  for (const p of tries.filter(Boolean)) {
    try { execFileSync(p, ['-version'], { stdio: 'ignore' }); return p; } catch { /* weiter */ }
  }
  throw new Error('ffmpeg nicht gefunden – bitte installieren oder FFMPEG=<Pfad zu ffmpeg.exe> setzen');
}

const get = (url) => new Promise((ok) => http.get(url, (r) => { r.resume(); r.on('end', () => ok(r.statusCode)); }).on('error', () => ok(0)));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function main() {
  const ffmpeg = findFfmpeg();
  if (await get(`http://127.0.0.1:${PORT}/`)) throw new Error(`Port ${PORT} ist belegt – bitte dbDash/TriDash vorher beenden.`);
  fs.mkdirSync(OUT, { recursive: true });

  // 1. dbDash mit eigener Einstellungs-Kopie starten (Demo an, keine Overlay-Fenster auf dem Bildschirm)
  const appData = path.join(os.tmpdir(), 'dbdash-video-appdata');
  fs.rmSync(appData, { recursive: true, force: true });
  fs.mkdirSync(path.join(appData, 'dbDash'), { recursive: true });
  fs.writeFileSync(path.join(appData, 'dbDash', 'settings.json'), JSON.stringify({ demo: true, visible: false, port: PORT }));
  const env = { ...process.env, APPDATA: appData };
  delete env.ELECTRON_RUN_AS_NODE;
  const dbdash = spawn(process.execPath, [ROOT], { env, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await get(`http://127.0.0.1:${PORT}/`)); i++) await sleep(250);
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?id=video`);
  await new Promise((ok, fail) => { ws.on('open', ok); ws.on('error', fail); });
  const send = (m) => ws.send(JSON.stringify(m));

  // 2. Bühne unsichtbar rendern
  const win = new BrowserWindow({ width: 1920, height: 1080, show: false, useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(FPS);
  let frame = null;
  win.webContents.on('paint', (e, dirty, image) => { frame = image; });
  await win.loadFile(path.join(__dirname, 'studio.html'));
  await sleep(5000); // Overlays verbinden sich und füllen sich mit Daten

  // Vorschau (VIDEO_PREVIEW=1): pro Szene nur ein Standbild nach out/vorschau/
  if (process.env.VIDEO_PREVIEW) {
    const dir = path.join(OUT, 'vorschau'); fs.mkdirSync(dir, { recursive: true });
    for (const [i, sc] of SCENES.entries()) {
      for (const [k, v] of Object.entries(sc.set || {})) send({ cmd: 'set', path: k, value: v });
      for (const p of Object.values(sc.page || {})) await get(`http://127.0.0.1:${PORT}/api/page/${p}`);
      await win.webContents.executeJavaScript(`show(${JSON.stringify(sc)})`);
      await sleep(2500);
      fs.writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-${sc.id}.jpg`), (await win.webContents.capturePage()).toJPEG(85));
    }
    ws.close(); dbdash.kill();
    console.log('✔ Vorschau:', dir);
    return;
  }

  // 3. ffmpeg: JPEG-Bilder im festen 30-fps-Takt → H.264-MP4
  const file = path.join(OUT, 'dbDash-Vorstellung.mp4');
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  let written = 0;
  const writer = setInterval(() => {
    const due = Math.floor((Date.now() - t0) / 1000 * FPS);
    if (!frame) return;
    const jpg = frame.toJPEG(92);
    while (written < due) { ff.stdin.write(jpg); written++; } // fehlende Takte mit dem letzten Bild füllen
  }, 1000 / FPS / 2);

  // 4. Drehbuch abspielen
  const controlFrame = () => win.webContents.mainFrame.framesInSubtree.find((f) => /control\.html/.test(f.url));
  let at = 0;
  for (const sc of SCENES) {
    console.log(`${mmss(at)}  ${sc.id}`);
    for (const [k, v] of Object.entries(sc.set || {})) send({ cmd: 'set', path: k, value: v });
    for (const p of Object.values(sc.page || {})) await get(`http://127.0.0.1:${PORT}/api/page/${p}`);
    await win.webContents.executeJavaScript(`show(${JSON.stringify(sc)})`);
    const timers = [];
    if (sc.every) timers.push(setInterval(() => send({ cmd: 'action', action: sc.every[1] }), sc.every[0] * 1000));
    for (const [sec, y] of sc.scroll || []) {
      timers.push(setTimeout(() => { const f = controlFrame(); if (f) f.executeJavaScript(`scrollTo({ top: ${y}, behavior: 'smooth' })`); }, sec * 1000));
    }
    await sleep(sc.dur * 1000 - (Date.now() - t0 - at * 1000)); // im Zeitplan bleiben
    timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    at += sc.dur;
  }

  // 5. Abschließen
  clearInterval(writer);
  ff.stdin.end();
  await new Promise((ok) => ff.on('close', ok));
  ws.close();
  dbdash.kill();
  writeTexts();
  console.log(`\n✔ Fertig: ${file} (${mmss(written / FPS)})`);
}

// Sprechskript mit Zeitmarken und YouTube-Beschreibung mit Kapiteln
function writeTexts() {
  let at = 0;
  let speech = '# dbDash – Sprechtext zum Vorstellungsvideo\n\nZeitmarken passen zu `dbDash-Vorstellung.mp4`. Ruhig sprechen – jede Szene hat etwas Luft.\n\n';
  const chapters = [];
  for (const sc of SCENES) {
    speech += `**${mmss(at)} – ${mmss(at + sc.dur)}** · ${sc.title || sc.chapter || sc.id}\n\n${sc.speech}\n\n`;
    if (sc.chapter) chapters.push(`${mmss(at)} ${sc.chapter}`);
    at += sc.dur;
  }
  fs.writeFileSync(path.join(OUT, 'sprechtext.md'), speech);
  fs.writeFileSync(path.join(OUT, 'youtube-beschreibung.txt'),
`dbDash – kostenlose Overlays für iRacing (dannerbam Dash)

Relative, Standings, Inputs, Delta, ein großes Dashboard mit umschaltbaren Seiten und ein Radar – kostenlos,
schonend für deine FPS und auch als OBS-Browserquelle nutzbar.

Download: <LINK EINFÜGEN>

Kapitel:
${chapters.join('\n')}

© 2026 Johann Danner · Lizenz CC BY-NC-ND 4.0
dbDash ist ein unabhängiges Projekt und nicht mit iRacing.com Motorsport Simulations verbunden.

#iRacing #SimRacing #Overlay #Simracing
`);
}

app.whenReady().then(main).then(() => app.quit(), (e) => { console.error('Fehler:', e.message); app.exit(1); });
