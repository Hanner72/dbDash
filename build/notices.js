// Erzeugt DRITTANBIETER-LIZENZEN.txt aus den Lizenzdateien der mitgelieferten Fremdkomponenten
const fs = require('fs');
const path = require('path');
const nm = path.join(__dirname, '..', 'node_modules');
const parts = [
  ['Electron', 'electron/LICENSE'],
  ['koffi', 'koffi/LICENSE.txt'],
  ['ws', 'ws/LICENSE'],
  ['js-yaml', 'js-yaml/LICENSE'],
  ['argparse', 'argparse/LICENSE'],
  ['flag-icons (Länderflaggen)', 'flag-icons/LICENSE'],
];
let out = 'Drittanbieter-Komponenten in dbDash / Third-party components\n' +
  'Diese Komponenten stehen unter ihren eigenen Lizenzen. Chromium: siehe LICENSES.chromium.html.\n\n';
for (const [name, file] of parts) {
  const v = (() => { try { return require(path.join(nm, path.dirname(file), 'package.json')).version; } catch { return ''; } })();
  out += '='.repeat(70) + `\n${name} ${v}\n` + '='.repeat(70) + '\n' + fs.readFileSync(path.join(nm, file), 'utf8').trim() + '\n\n';
}
fs.writeFileSync(process.argv[2], out);
console.log('Lizenzhinweise geschrieben:', process.argv[2]);
