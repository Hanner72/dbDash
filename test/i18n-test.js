// Übersetzungen: alle Sprachdateien haben dieselben Schlüssel, und jeder im Code verwendete Schlüssel existiert.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LANG = path.join(ROOT, 'web', 'lang');
const langs = Object.fromEntries(fs.readdirSync(LANG).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(LANG, f), 'utf8'))]));
const de = langs.de;
assert.ok(de && langs.en, 'de.json und en.json müssen existieren');

// 1. gleiche Schlüssel überall, nichts leer (außer bewusst leerer Spaltenkopf der Flagge)
for (const [code, dict] of Object.entries(langs)) {
  const missing = Object.keys(de).filter((k) => !(k in dict));
  const extra = Object.keys(dict).filter((k) => !(k in de));
  assert.deepStrictEqual(missing, [], `${code}.json: fehlende Schlüssel`);
  assert.deepStrictEqual(extra, [], `${code}.json: Schlüssel, die es in de.json nicht gibt`);
  for (const [k, v] of Object.entries(dict)) if (k !== 'colh.flag') assert.ok(String(v).trim(), `${code}.json: ${k} ist leer`);
  // Platzhalter müssen in allen Sprachen gleich sein
  for (const k of Object.keys(de)) {
    const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
    assert.strictEqual(ph(dict[k]), ph(de[k]), `${code}.json: Platzhalter in ${k} passen nicht zu de.json`);
  }
}

// 2. verwendete Schlüssel im Code
const files = [...fs.readdirSync(path.join(ROOT, 'web')).filter((f) => /\.(html|js)$/.test(f)).map((f) => path.join(ROOT, 'web', f)),
  ...fs.readdirSync(path.join(ROOT, 'src')).map((f) => path.join(ROOT, 'src', f))];
const used = new Set();
const PREFIX = '(?:common|ov|lap|rel|delta|col|colh|st|tyre|page|dash|unit|dmg|warn|flag|side|act|opt|joy|tray|err|upd|ctl)';
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(new RegExp(`(?:data-i18n(?:-html|-title)?=")(${PREFIX}\\.[\\w.]+)"`, 'g'))) used.add(m[1]);
  for (const m of s.matchAll(new RegExp(`['\`](${PREFIX}\\.[\\w]+(?:\\.[\\w]+)?)['\`]`, 'g'))) used.add(m[1]);
}
// zusammengesetzte Schlüssel ('page.' + k usw.)
const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
const list = (re) => (main.match(re) || ['', ''])[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1));
for (const k of list(/DASH_PAGE_KEYS = \[([^\]]+)\]/)) used.add('page.' + k);
for (const k of list(/STANDINGS_COL_LIST = \[([^\]]+)\]/)) { used.add('col.' + k); used.add('colh.' + k); }
used.add('colh.pos');
for (const k of list(/const ACTIONS = \[([^\]]+)\]/)) used.add('act.' + k);
for (const k of ['relative', 'standings', 'inputs', 'delta', 'dash', 'radar']) used.add('ov.' + k);
for (const n of [33, 34, 35, 36]) used.add('joy.hat' + n);
for (const k of ['check', 'install']) used.add('upd.err.' + k);

// keine Schlüssel: Dateinamen und Präfixe, an die erst noch etwas angehängt wird
for (const k of [...used]) if (/\.(html|js|json|svg|png)$/.test(k) || k === 'joy.hat') used.delete(k);
const missing = [...used].filter((k) => !(k in de)).sort();
assert.deepStrictEqual(missing, [], 'im Code verwendet, aber nicht in de.json');
console.log(`OK – Übersetzungen: ${Object.keys(langs).join(', ')} mit je ${Object.keys(de).length - 1} Texten, ${used.size} verwendete Schlüssel vorhanden`);
