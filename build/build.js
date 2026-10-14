// dbDash – fertiges Windows-Programm bauen:  npm run build
// Ergebnis: dist\dbDash\dbDash.exe  (und dist\dbDash-<version>-win64.zip)
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const DIST = path.join(ROOT, 'dist');
const step = (t) => console.log(`\n▶ ${t}`);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Windows: Virenscanner oder ein offenes Explorer-Fenster sperren frisch erstellte Dateien kurz.
// Deshalb mehrmals versuchen und notfalls kopieren statt umbenennen.
function moveDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  for (let i = 0; i < 10; i++) {
    try { fs.renameSync(from, to); return; } catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      sleep(1000);
    }
  }
  console.log('  Ordner ist gesperrt – wird kopiert statt umbenannt …');
  fs.cpSync(from, to, { recursive: true });
  try { fs.rmSync(from, { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 }); }
  catch { console.log(`  Hinweis: Der alte Ordner „${path.basename(from)}“ konnte nicht gelöscht werden – einfach später von Hand löschen.`); }
}

(async () => {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 22) throw new Error(`Node.js ${process.versions.node} ist zu alt – bitte Node.js 22 oder neuer installieren (https://nodejs.org).`);

  // 1. Windows-Baustein von koffi (liest den iRacing-Speicher) bereitlegen
  step('koffi für Windows bereitstellen');
  const koffiVer = require(path.join(ROOT, 'node_modules/koffi/package.json')).version;
  const native = path.join(ROOT, 'node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node');
  if (!fs.existsSync(native)) {
    console.log('  nicht vorhanden – wird nachgeladen …');
    execSync(`npm install --no-save --force @koromix/koffi-win32-x64@${koffiVer}`, { cwd: ROOT, stdio: 'inherit' });
  }
  const koffiOut = path.join(ROOT, 'build/koffi/win32_x64');
  fs.mkdirSync(koffiOut, { recursive: true });
  fs.copyFileSync(native, path.join(koffiOut, 'koffi.node'));

  // 2. Flaggen-Zuordnung erzeugen
  step('Länderflaggen vorbereiten');
  require('./flags.js');

  // 3. Programm packen
  step('Programm packen (Electron)');
  const { packager } = require('@electron/packager');
  try { fs.rmSync(DIST, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); }
  catch (e) { throw new Error(`Der Ordner „dist“ ist gesperrt. Bitte dbDash beenden und Explorer-Fenster im Ordner „dist“ schließen. (${e.code})`); }
  const [out] = await packager({
    dir: ROOT,
    name: 'dbDash',
    executableName: 'dbDash',
    platform: 'win32',
    arch: 'x64',
    out: DIST,
    overwrite: true,
    asar: true,
    prune: true,
    extraResource: [path.join(ROOT, 'build/koffi'), path.join(ROOT, 'web')],
    ignore: [/^\/dist/, /^\/grafiken/, /^\/node_modules\/flag-icons/, /^\/parts/, /\.zip$/, /^\/LICENSE$/, /^\/test/, /^\/README/,
      /^\/build/, /^\/web/, /^\/video/, /^\/node_modules\/@koromix/, /^\/node_modules\/koffi\/(vendor|doc|lib|build)/,
      /^\/node_modules\/koffi\/src\/koffi\/(?!index\.cjs|src)/],
  });

  // 4. Symbol und Versionsinfos in die .exe schreiben
  step('Programmsymbol setzen');
  execSync(`node "${path.join(__dirname, 'set-icon.mjs')}" "${path.join(out, 'dbDash.exe')}" "${path.join(__dirname, 'icon.ico')}" ${pkg.version}`, { stdio: 'inherit' });

  // 5. Anleitung, Lizenzen, Grafiken beilegen; unnötige Sprachdateien entfernen
  step('Anleitung, Lizenzen und Grafiken beilegen');
  fs.copyFileSync(path.join(out, 'LICENSE'), path.join(out, 'LICENSE-Electron.txt'));
  fs.rmSync(path.join(out, 'LICENSE'), { force: true, maxRetries: 10, retryDelay: 500 });
  fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(out, 'LIESMICH.md'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(out, 'LICENSE.txt'));
  execSync(`node "${path.join(__dirname, 'notices.js')}" "${path.join(out, 'DRITTANBIETER-LIZENZEN.txt')}"`, { stdio: 'inherit' });
  fs.cpSync(path.join(ROOT, 'grafiken'), path.join(out, 'Grafiken'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'docs'), path.join(out, 'docs'), { recursive: true }); // Bilder der LIESMICH.md
  for (const f of fs.readdirSync(path.join(out, 'locales'))) {
    if (!['de.pak', 'en-US.pak', 'en-GB.pak'].includes(f)) fs.rmSync(path.join(out, 'locales', f));
  }
  const final = path.join(DIST, 'dbDash');
  moveDir(out, final);

  // 6. ZIP zum Weitergeben (mit Windows-Bordmitteln bzw. zip unter Linux)
  step('ZIP erstellen');
  const zip = path.join(DIST, `dbDash-${pkg.version}-win64.zip`);
  try {
    if (process.platform === 'win32') {
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${final}' -DestinationPath '${zip}' -Force"`, { stdio: 'inherit' });
    } else {
      execSync(`zip -qr9 "${zip}" dbDash`, { cwd: DIST, stdio: 'inherit' });
    }
  } catch { console.log('  (ZIP konnte nicht erstellt werden – der Ordner ist trotzdem fertig)'); }

  console.log(`\n✔ Fertig!\n  Programm: ${path.join(final, 'dbDash.exe')}\n  ZIP:      ${zip}\n`);
})().catch((e) => { console.error('\n✖ Build fehlgeschlagen:', e.message || e); process.exit(1); });
