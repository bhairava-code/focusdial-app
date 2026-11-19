#!/usr/bin/env python3
"""Build the FocusDial NSIS installer from dist/win-unpacked without Wine.
Generates an explicit uninstall file list so the uninstaller only removes what it installed."""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'dist', 'win-unpacked')
NSIS = os.path.expanduser('~/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n')
files, dirs = [], []
for base, ds, fs in os.walk(SRC):
    rel = os.path.relpath(base, SRC)
    for f in fs:
        files.append(os.path.normpath(os.path.join(rel, f)).replace('/', '\\'))
    if rel != '.':
        dirs.append(rel.replace('/', '\\'))
lines = [f'  Delete "$INSTDIR\\{f}"' for f in sorted(files)]
lines += [f'  RMDir "$INSTDIR\\{d}"' for d in sorted(dirs, key=lambda d: -d.count('\\'))]
with open(os.path.join(ROOT, 'installer', 'uninstall-files.nsh'), 'w') as fh:
    fh.write('\n'.join(lines) + '\n')
print(f'uninstall list: {len(files)} files, {len(dirs)} folders')
env = dict(os.environ, NSISDIR=NSIS)
sys.exit(subprocess.call([os.path.join(NSIS, 'linux', 'makensis'), '-V2', os.path.join(ROOT, 'installer', 'installer.nsi')], env=env))
