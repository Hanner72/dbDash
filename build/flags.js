// Erzeugt web/flags/names.json: iRacing-Flair-Name (Ländername, englisch) -> Flaggen-Datei
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'web', 'flags');
const codes = fs.readdirSync(dir).filter((f) => /^[a-z]{2}\.svg$/.test(f)).map((f) => f.slice(0, 2));
const dn = new Intl.DisplayNames(['en'], { type: 'region' });
const map = {};
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
for (const c of codes) {
  let name; try { name = dn.of(c.toUpperCase()); } catch { continue; }
  if (name && name.toUpperCase() !== c.toUpperCase()) map[norm(name)] = c;
}
// Abweichende Schreibweisen
const alias = {
  'England': 'gb-eng', 'Scotland': 'gb-sct', 'Wales': 'gb-wls', 'Northern Ireland': 'gb-nir',
  'United States of America': 'us', 'USA': 'us', 'UK': 'gb', 'Great Britain': 'gb', 'United Kingdom of Great Britain and Northern Ireland': 'gb',
  'Czech Republic': 'cz', 'Korea, Republic of': 'kr', 'Republic of Korea': 'kr', 'Korea': 'kr', 'Russian Federation': 'ru',
  'Viet Nam': 'vn', 'Iran, Islamic Republic of': 'ir', 'Taiwan, Province of China': 'tw', 'Hong Kong SAR China': 'hk',
  'Macao SAR China': 'mo', 'Holland': 'nl', 'The Netherlands': 'nl', 'Turkey': 'tr', 'Türkiye': 'tr', 'Ivory Coast': 'ci',
  "Cote d'Ivoire": 'ci', 'Macedonia': 'mk', 'North Macedonia': 'mk', 'Bosnia and Herzegovina': 'ba', 'Bosnia-Herzegovina': 'ba',
  'Slovak Republic': 'sk', 'Moldova, Republic of': 'md', 'Venezuela, Bolivarian Republic of': 've', 'Bolivia, Plurinational State of': 'bo',
  'Tanzania, United Republic of': 'tz', 'Syrian Arab Republic': 'sy', "Lao People's Democratic Republic": 'la', 'Brunei Darussalam': 'bn',
  'Cape Verde': 'cv', 'Swaziland': 'sz', 'Burma': 'mm', 'Vatican City': 'va', 'Holy See': 'va', 'Palestine': 'ps',
  'Congo, The Democratic Republic of the': 'cd', 'Democratic Republic of the Congo': 'cd', 'Republic of the Congo': 'cg',
  'Micronesia, Federated States of': 'fm', 'Saint Martin': 'mf', 'Curacao': 'cw', 'Kosovo': 'xk',
};
for (const [k, v] of Object.entries(alias)) if (fs.existsSync(path.join(dir, v + '.svg'))) map[norm(k)] = v;
fs.writeFileSync(path.join(dir, 'names.json'), JSON.stringify(map));
console.log(Object.keys(map).length, 'Namen;', ['Germany', 'Austria', 'England', 'United States', 'Czechia', 'Korea, Republic of'].map((n) => n + '=' + map[norm(n)]).join(' '));
