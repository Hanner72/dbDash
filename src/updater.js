// Automatische Updates über GitHub-Releases: sucht regelmäßig nach einer neueren Version und installiert sie
// auf Knopfdruck (nie von selbst – ein Neustart mitten im Rennen wäre fatal).
// Ablauf: ZIP aus der Release laden → mit Windows-tar entpacken → dbDash beenden → ein kleines Skript kopiert die
// neuen Dateien über die alten (robocopy) und startet dbDash neu. Einstellungen liegen in %APPDATA% und bleiben erhalten.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const REPO = 'Hanner72/dbDash';
// Testhilfe: andere Adresse für die Release-Abfrage (z. B. lokaler Testserver)
const API = process.env.DBDASH_UPDATE_API || `https://api.github.com/repos/${REPO}/releases/latest`;

// "2.10.0" > "2.9.3"
function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}

class Updater {
  // version: aktuelle Version; installDir: Ordner mit dbDash.exe; onChange: wird bei jeder Statusänderung aufgerufen
  constructor({ version, installDir, onChange }) {
    this.version = version;
    this.installDir = installDir;
    this.onChange = onChange || (() => {});
    this.info = { status: 'idle', current: version }; // idle | checking | none | available | downloading | installing | error
    this.release = null;
  }

  // Fehler sprachneutral melden: errorCode (check | install) + Textschlüssel/Platzhalter für Details (web/lang/*.json)
  fail(code, e) {
    this.set({ status: 'error', errorCode: code, errorKey: e.key || null, errorVars: e.vars || null, errorText: e.key ? null : String(e.message || e) });
  }

  set(patch) { Object.assign(this.info, patch); this.onChange(this.info); }

  async check() {
    if (['checking', 'downloading', 'installing'].includes(this.info.status)) return this.info;
    this.set({ status: 'checking', errorCode: null });
    try {
      const res = await fetch(API, { headers: { 'User-Agent': 'dbDash-Updater', Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw Object.assign(new Error('http'), { key: 'upd.d.http', vars: { s: res.status } });
      const r = await res.json();
      const asset = (r.assets || []).find((a) => /win64\.zip$/i.test(a.name));
      const latest = String(r.tag_name || '').replace(/^v/, '');
      this.release = asset ? { latest, url: asset.browser_download_url, size: asset.size, page: r.html_url } : null;
      const available = !!(asset && newer(latest, this.version));
      this.set({ status: available ? 'available' : 'none', latest, page: r.html_url, notes: String(r.body || '').slice(0, 1500), checked: Date.now() });
    } catch (e) {
      this.fail('check', e);
    }
    return this.info;
  }

  // Lädt, entpackt und startet die Installation. quit() beendet danach dbDash.
  async install(quit) {
    if (this.info.status !== 'available' || !this.release) return;
    const work = path.join(os.tmpdir(), 'dbdash-update');
    try {
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      // 1. herunterladen (mit Fortschritt)
      this.set({ status: 'downloading', progress: 0, errorCode: null });
      const zip = path.join(work, 'update.zip');
      const res = await fetch(this.release.url, { headers: { 'User-Agent': 'dbDash-Updater' } });
      if (!res.ok || !res.body) throw Object.assign(new Error('download'), { key: 'upd.d.download', vars: { s: res.status } });
      const total = Number(res.headers.get('content-length')) || this.release.size || 0;
      const out = fs.createWriteStream(zip);
      let got = 0, lastPct = -1;
      for await (const chunk of res.body) {
        out.write(chunk);
        got += chunk.length;
        const pct = total ? Math.floor(got / total * 100) : 0;
        if (pct !== lastPct) { lastPct = pct; this.set({ progress: pct }); }
      }
      await new Promise((ok, fail) => out.end((e) => (e ? fail(e) : ok())));
      if (total && got !== total) throw Object.assign(new Error('incomplete'), { key: 'upd.d.incomplete' });

      // 2. entpacken (tar.exe ist in Windows 10/11 enthalten und kann ZIP)
      this.set({ status: 'installing', progress: 100 });
      const unpacked = path.join(work, 'neu');
      fs.mkdirSync(unpacked);
      execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', unpacked], { windowsHide: true });
      const src = [unpacked, ...fs.readdirSync(unpacked).map((d) => path.join(unpacked, d))].find((d) => fs.existsSync(path.join(d, 'dbDash.exe')));
      if (!src) throw Object.assign(new Error('noexe'), { key: 'upd.d.noexe' });

      // 3. Skript, das nach dem Beenden kopiert und neu startet
      const log = path.join(work, 'update.log');
      const script = path.join(work, 'update.cmd');
      fs.writeFileSync(script, [
        '@echo off', 'chcp 65001 >nul', 'title dbDash wird aktualisiert',
        'echo dbDash wird aktualisiert – bitte warten ...',
        ':warten',
        'tasklist /FI "IMAGENAME eq dbDash.exe" 2>nul | find /I "dbDash.exe" >nul && (timeout /t 1 /nobreak >nul & goto warten)',
        `robocopy "${src}" "${this.installDir}" /E /R:10 /W:1 /NFL /NDL /NJH /NJS /NP > "${log}"`,
        'if %ERRORLEVEL% GEQ 8 (echo. & echo Das Update konnte nicht kopiert werden. Details: ' + log + ' & pause & exit /b 1)',
        `start "" "${path.join(this.installDir, 'dbDash.exe')}"`,
        'exit /b 0', '',
      ].join('\r\n'), 'utf8');

      // geschützter Ordner (z. B. C:\Programme)? Dann mit Admin-Rechten ausführen (Windows fragt einmal nach)
      if (this.writable()) {
        spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      } else {
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command',
          `Start-Process cmd.exe -ArgumentList '/c','"${script}"' -Verb RunAs -WindowStyle Hidden`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      }
      quit();
    } catch (e) {
      this.fail('install', e);
    }
  }

  writable() {
    const probe = path.join(this.installDir, '.dbdash-schreibtest');
    try { fs.writeFileSync(probe, ''); fs.rmSync(probe); return true; } catch { return false; }
  }
}

module.exports = { Updater, newer };
