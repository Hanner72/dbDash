// dbDash – Programmsymbol und Stream-Deck-Grafiken aus den SVG-Vorlagen erzeugen:  npm run icons
// build/icon.svg      → build/icon.ico (16–256 px) und web/assets/icon.png (256 px)
// grafiken/*.svg      → grafiken/*-72/144/256/512.png
// Läuft in Electron (Chromium zeichnet die SVGs), daher keine zusätzlichen Pakete nötig.
'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const DECK_SIZES = [72, 144, 256, 512];

// SVG in einem unsichtbaren Fenster auf ein Canvas zeichnen → PNG-Daten
async function render(win, svg, size) {
  const url = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const data = await win.webContents.executeJavaScript(`new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = ${size};
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, ${size}, ${size});
      ok(c.toDataURL('image/png'));
    };
    img.onerror = () => fail(new Error('SVG konnte nicht geladen werden'));
    img.src = ${JSON.stringify(url)};
  })`);
  return Buffer.from(data.split(',')[1], 'base64');
}

// ICO-Datei aus PNG-Bildern zusammensetzen (Windows Vista+ erlaubt PNG in ICO)
function makeIco(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, png }, i) => {
    const o = 6 + 16 * i;
    head[o] = size % 256; head[o + 1] = size % 256;
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(png.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.png)]);
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false });
    await win.loadURL('data:text/html,<html></html>');

    const icon = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
    const pngs = [];
    for (const size of ICO_SIZES) pngs.push({ size, png: await render(win, icon, size) });
    fs.writeFileSync(path.join(__dirname, 'icon.ico'), makeIco(pngs));
    fs.writeFileSync(path.join(ROOT, 'web', 'assets', 'icon.png'), pngs.find((p) => p.size === 256).png);
    console.log('✔ build/icon.ico, web/assets/icon.png');

    const dir = path.join(ROOT, 'grafiken');
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
      const svg = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const size of DECK_SIZES) fs.writeFileSync(path.join(dir, `${f.slice(0, -4)}-${size}.png`), await render(win, svg, size));
      console.log(`✔ grafiken/${f.slice(0, -4)}-*.png`);
    }
  } catch (e) {
    console.error(e); process.exitCode = 1;
  }
  app.quit();
});
