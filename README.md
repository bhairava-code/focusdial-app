# FocusDial

Floating flip clock, Pomodoro timer, task list (battery progress) and habit tracker for Windows.
Built with Electron 45.

## 1️⃣ Run it on your PC

Needs [Node.js](https://nodejs.org) 20 or newer.

```powershell
cd focusdial-app
npm install
npm start
```

## 2️⃣ Build the Windows installer + portable .exe

On Windows:

```powershell
npm run dist:windows
```

Output goes to `dist\`:
- `FocusDial-Setup-1.0.0.exe` – installer (Start menu + desktop shortcut)
- `FocusDial-Portable-1.0.0.exe` – runs without installing

(`npm run dist:linux-host` builds the same files from Linux without Wine, using `installer/`.)

## 3️⃣ Project structure

```
app/
  index.html     page markup (no inline code – strict CSP)
  app.css        all styles, 10 themes
  app.js         clock, flip cards, Pomodoro, tasks, habits, settings
  main.js        Electron main process: window, tray, app:// protocol + CSP,
                 permissions, IPC checks, habit CSV writing
  preload.js     the only bridge between page and main (contextBridge)
  fonts/         offline Oswald + Outfit fonts
  icon.png, tray.png
build/
  icon.ico       app icon
  afterPack.js   sets exe icon + version info (pure JS, no Wine)
installer/
  installer.nsi        NSIS installer (used for Linux builds)
  build-installer.py   makes the uninstall file list, runs makensis
eslint.config.js
package.json     electron-builder config, Electron fuses
```

## 4️⃣ Where data is saved

| What | Where |
|---|---|
| Tasks, habits, settings | `%APPDATA%\FocusDial` (app storage) |
| Habit log, one CSV per habit | `Documents\FocusDial\Habits\<habit>.csv` |
| Habit backup | `Documents\FocusDial\habits.json` |
| Window position, on-top, opacity | `%APPDATA%\FocusDial\window.json` |

CSV columns: `date, logged_at, habit, status, source, streak_days, done_last_7_days, target_per_week`

## 5️⃣ Security

- `contextIsolation`, `sandbox`, no `nodeIntegration`, DevTools off in release builds
- UI served from `app://focusdial` with a strict Content-Security-Policy (no inline script, no network)
- All navigation, popups and webviews blocked; only the notifications permission is granted
- Every IPC call checks its sender and validates/caps its input
- Habit file names are sanitised (path traversal, reserved Windows names); CSV guards against formula injection
- Electron fuses: RunAsNode, NODE_OPTIONS and inspect flags off; ASAR integrity + only-load-from-ASAR on
- Uninstaller removes only the files it installed

Run `npm run lint` and `npm audit --omit=dev` before releasing.

## 6️⃣ Keyboard shortcuts

| Key | Action |
|---|---|
| Space | Start / pause |
| R / S | Reset / skip |
| 1 2 3 | Focus / short break / long break |
| T | Show/hide tasks & habits |
| N | New task or habit |
| C | Compact view |
| P | Pin on top |
| Ctrl + / Ctrl − | Size |
