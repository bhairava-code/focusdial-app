// Sets FocusDial's icon and version info on the Windows exe without Wine (pure JS via resedit).
const fs = require('fs');
const path = require('path');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const exeObj = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exeObj);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const g = groups[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g ? g.id : 1, g ? g.lang : 1033, iconFile.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const lang = vi.getAllLanguagesForStringValues()[0] || { lang: 1033, codepage: 1200 };
  const v = ctx.packager.appInfo.version.split('.').map(Number);
  vi.setStringValues(lang, {
    ProductName: 'FocusDial', FileDescription: 'FocusDial', CompanyName: 'Pronoy Kumar Das',
    InternalName: 'FocusDial', OriginalFilename: 'FocusDial.exe', LegalCopyright: '© 2026 Pronoy Kumar Das',
    FileVersion: ctx.packager.appInfo.version, ProductVersion: ctx.packager.appInfo.version
  });
  vi.setFileVersion(v[0], v[1], v[2], 0); vi.setProductVersion(v[0], v[1], v[2], 0);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exeObj);
  fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
  console.log('  • exe icon + version info set with resedit');
};
