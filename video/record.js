// Nimmt das Vorstellungsvideo auf:  npm run video
// Startet dbDash im Demo-Modus mit eigenen Einstellungen (die echten bleiben unberührt), spielt das Drehbuch
// aus scenes.js auf der Bühne studio.html ab und schreibt nach video/out/:
//   dbDash-Vorstellung.mp4 (1920×1080, 30 fps, ohne Ton), sprechtext.md, youtube-beschreibung.txt
// Mit --docs (npm run screenshots) stattdessen die README-Bilder nach docs/img/ (Liste: screenshots.js).
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
const PORT = 8185; // eigener Port – ein laufendes dbDash (8182) darf weiterlaufen
const FPS = 30;
// Foto-Hintergrund verwenden, wenn video/hintergrund.jpg vorhanden ist (sonst gezeichnete Straße)
const PHOTO = fs.existsSync(path.join(__dirname, 'hintergrund.jpg'));
const DOCS = !!process.env.DOCS_SHOTS || process.argv.includes('--docs'); // README-Bilder statt Video
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
  const ffmpeg = DOCS ? null : findFfmpeg();
  if (await get(`http://127.0.0.1:${PORT}/`)) throw new Error(`Port ${PORT} ist belegt – läuft schon eine Aufnahme?`);
  fs.mkdirSync(OUT, { recursive: true });

  // 1. dbDash mit eigener Einstellungs-Kopie starten (Demo an, keine Overlay-Fenster auf dem Bildschirm)
  const userData = path.join(os.tmpdir(), 'dbdash-video-userdata');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ demo: true, visible: false, port: PORT }));
  const env = { ...process.env, DBDASH_USERDATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const dbdash = spawn(process.execPath, [ROOT], { env, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await get(`http://127.0.0.1:${PORT}/`)); i++) await sleep(250);
  // Sicherheitsprüfung: läuft dbDash wirklich mit der Kopie? (sonst würden die echten Einstellungen verändert)
  const used = () => fs.readdirSync(userData).length > 1; // Electron legt dort Cache-Ordner an
  for (let i = 0; i < 40 && !used(); i++) await sleep(250);
  if (!used()) { dbdash.kill(); throw new Error('dbDash nutzt nicht den Video-Einstellungsordner – Abbruch, um deine Einstellungen zu schützen.'); }
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?id=video`);
  await new Promise((ok, fail) => { ws.on('open', ok); ws.on('error', fail); });
  const send = (m) => ws.send(JSON.stringify(m));
  let live = null; // aktueller Zustand (für „warten, bis ein Auto neben dir ist“)
  ws.on('message', (m) => { try { const d = JSON.parse(m); if (d.type === 'state') live = d.state; } catch { /* egal */ } });

  // 2. Bühne unsichtbar rendern
  const win = new BrowserWindow({ width: 1920, height: 1080, show: false, useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(FPS);
  let frame = null;
  win.webContents.on('paint', (e, dirty, image) => { frame = image; });
  await win.loadFile(path.join(__dirname, 'studio.html'), { query: { port: String(PORT) } });
  await sleep(5000); // Overlays verbinden sich und füllen sich mit Daten
  // Rahmen der Overlays an ihre tatsächliche Größe anpassen (Zeilenzahl usw. hängt von den Einstellungen ab)
  const fitFrames = async () => {
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      const m = /\/(\w+)\.html\?id=/.exec(f.url);
      if (!m || m[1] === 'control') continue;
      const s = await f.executeJavaScript(`(() => { const r = document.getElementById('root'); return r ? [r.offsetWidth, r.offsetHeight] : null; })()`).catch(() => null);
      if (s && s[0] > 0) await win.webContents.executeJavaScript(`fit('${m[1]}', ${s[0]}, ${s[1]})`);
    }
  };
  await fitFrames();
  const inControl = (js) => { const f = win.webContents.mainFrame.framesInSubtree.find((x) => /control.html/.test(x.url)); return f ? f.executeJavaScript(js) : null; };

  // README-Bilder (--docs): Ausschnitte der Overlays in hoher Auflösung nach docs/img/
  if (DOCS) {
    const dir = path.join(ROOT, 'docs', 'img'); fs.mkdirSync(dir, { recursive: true });
    for (const sh of require('./screenshots')) {
      for (const [k, v] of Object.entries(sh.set || {})) send({ cmd: 'set', path: k, value: v });
      for (const p of Object.values(sh.page || {})) await get(`http://127.0.0.1:${PORT}/api/page/${p}`);
      await win.webContents.executeJavaScript(`show(${JSON.stringify({ ...sh, noMark: !!sh.crop, photo: PHOTO && sh.photo })})`);
      await sleep(2500);
      await fitFrames();
      if (sh.controlJs) await inControl(sh.controlJs);
      await sleep(400);
      if (sh.waitRadar) { // bis zu 60 s warten, bis ein Auto neben dir ist
        for (let i = 0; i < 240; i++) {
          const r = live && live.radar;
          if (r && (r.side >= 2 || (r.cars || []).some((c) => Math.abs(c.dist) < 5))) break;
          await sleep(250);
        }
        await sleep(300);
      }
      let rect;
      if (sh.crop) {
        rect = await win.webContents.executeJavaScript(`(() => {
          const rs = ${JSON.stringify(sh.crop)}.map((id) => document.querySelector('#ov-' + id + ' iframe').getBoundingClientRect());
          const x = Math.min(...rs.map((r) => r.left)) - 24, y = Math.min(...rs.map((r) => r.top)) - 24;
          return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
            width: Math.round(Math.max(...rs.map((r) => r.right)) - x + 24), height: Math.round(Math.max(...rs.map((r) => r.bottom)) - y + 24) };
        })()`);
      }
      const img = await win.webContents.capturePage(rect);
      fs.writeFileSync(path.join(dir, sh.file), sh.file.endsWith('.jpg') ? img.toJPEG(90) : img.toPNG());
      console.log('✔', sh.file, img.getSize().width + '×' + img.getSize().height);
    }
    ws.close(); dbdash.kill();
    return;
  }

  // Vorschau (VIDEO_PREVIEW=1): pro Szene nur ein Standbild nach out/vorschau/
  if (process.env.VIDEO_PREVIEW) {
    const dir = path.join(OUT, 'vorschau'); fs.mkdirSync(dir, { recursive: true });
    for (const [i, sc] of SCENES.entries()) {
      for (const [k, v] of Object.entries(sc.set || {})) send({ cmd: 'set', path: k, value: v });
      for (const p of Object.values(sc.page || {})) await get(`http://127.0.0.1:${PORT}/api/page/${p}`);
      await win.webContents.executeJavaScript(`show(${JSON.stringify({ ...sc, photo: PHOTO })})`);
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
    await win.webContents.executeJavaScript(`show(${JSON.stringify({ ...sc, photo: PHOTO })})`);
    if (sc.controlJs) inControl(sc.controlJs);
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
