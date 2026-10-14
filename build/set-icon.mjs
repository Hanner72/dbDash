// Setzt Icon und Versionsinfos der Windows-.exe (reines JavaScript, kein Wine nötig)
import * as ResEdit from 'resedit';
import fs from 'fs';

const [exePath, icoPath, version] = process.argv.slice(2);
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));

const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const groupId = groups.length ? groups[0].id : 1;
const lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, ico.icons.map((i) => i.data));

const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
if (vi) {
  const [a, b, c] = version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'dbDash – dannerbam Dash',
    ProductName: 'dbDash – dannerbam Dash',
    CompanyName: 'Johann Danner',
    LegalCopyright: '© 2026 Johann Danner · CC BY-NC-ND 4.0',
    OriginalFilename: 'dbDash.exe',
    InternalName: 'dbDash',
  });
  vi.outputToResourceEntries(res.entries);
}
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('Icon gesetzt:', exePath);
