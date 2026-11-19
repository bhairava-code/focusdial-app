'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ID = 'com.pronoy.focusdial';
const ORIGIN_HOST = 'focusdial';
const APP_URL = `app://${ORIGIN_HOST}/index.html`;
const APP_DIR = __dirname;

app.setAppUserModelId(APP_ID);
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

// Serve the UI from a private, secure scheme instead of file:// so a strict CSP header can be applied.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true } }]);
const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "img-src 'self' data:",
  "connect-src 'none'", "media-src 'none'", "object-src 'none'", "frame-src 'none'", "worker-src 'none'",
  "base-uri 'none'", "form-action 'none'"
].join('; ');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
               '.woff2': 'font/woff2', '.png': 'image/png' };

let win = null, tray = null, quitting = false;
const ICON = path.join(APP_DIR, 'icon.png');
const TRAY_ICON = path.join(APP_DIR, 'tray.png');

// ---------- window config (position, on-top, opacity...) ----------
const cfgFile = () => path.join(app.getPath('userData'), 'window.json');
let cfg = {};
try { const raw = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); if (raw && typeof raw === 'object') cfg = raw; } catch { /* first run */ }
cfg = {
  x: Number.isFinite(cfg.x) ? cfg.x : undefined, y: Number.isFinite(cfg.y) ? cfg.y : undefined,
  onTop: cfg.onTop !== false, closeToTray: cfg.closeToTray !== false, skipTaskbar: cfg.skipTaskbar === true,
  opacity: Number.isFinite(cfg.opacity) ? Math.min(1, Math.max(0.3, cfg.opacity)) : 1
};
let cfgTimer = null;
function saveCfg() {
  clearTimeout(cfgTimer);
  cfgTimer = setTimeout(() => fs.promises.writeFile(cfgFile(), JSON.stringify(cfg)).catch(() => {}), 400);
}

// ---------- habit log files: Documents\FocusDial\Habits\<habit>.csv ----------
const dataDir = () => path.join(app.getPath('documents'), 'FocusDial');
const habitDir = () => path.join(dataDir(), 'Habits');
const HEADER = 'date,logged_at,habit,status,source,streak_days,done_last_7_days,target_per_week\r\n';
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
function habitPath(file) {
  let base = path.basename(String(file || ''))
    // eslint-disable-next-line no-control-regex -- deliberately strips control characters from input
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '')
    .replace(/\.csv$/i, '').trim().replace(/[. ]+$/, '').slice(0, 60);
  if (!base || RESERVED.test(base)) base = 'habit ' + base;
  const full = path.join(habitDir(), base.trim() + '.csv');
  // Defence in depth: the result must stay inside the habit folder.
  if (path.dirname(full) !== habitDir()) throw new Error('bad habit path');
  return full;
}
let writeQueue = Promise.resolve();            // serialise writes; keep the main thread non-blocking
const enqueue = job => { writeQueue = writeQueue.then(job).catch(err => console.error('[habit]', err.message)); };

// ---------- auto launch ----------
const exePath = () => process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
const getAutoLaunch = () => { try { return app.getLoginItemSettings({ path: exePath() }).openAtLogin; } catch { return false; } };
const setAutoLaunch = v => { try { app.setLoginItemSettings({ openAtLogin: !!v, path: exePath() }); } catch { /* ignore */ } };

function state() {
  return { onTop: win ? win.isAlwaysOnTop() : cfg.onTop, opacity: win ? win.getOpacity() : cfg.opacity,
           autoLaunch: getAutoLaunch(), skipTaskbar: cfg.skipTaskbar, closeToTray: cfg.closeToTray };
}
const pushState = () => { if (win) win.webContents.send('state', state()); buildMenu(); };

function defaultPos(w) { const wa = screen.getPrimaryDisplay().workArea; return { x: wa.x + wa.width - w - 16, y: wa.y + 16 }; }
function onScreen(x, y) {
  return screen.getAllDisplays().some(d => { const a = d.workArea; return x >= a.x - 200 && x < a.x + a.width - 80 && y >= a.y - 20 && y < a.y + a.height - 80; });
}

function createWindow() {
  const W = 512, H = 760;
  let { x, y } = cfg;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !onScreen(x, y)) ({ x, y } = defaultPos(W));
  win = new BrowserWindow({
    x, y, width: W, height: H, useContentSize: true, frame: false, transparent: true, resizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, backgroundColor: '#00000000', show: false, title: 'FocusDial', icon: ICON,
    skipTaskbar: cfg.skipTaskbar,
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false,
      devTools: !app.isPackaged, navigateOnDragDrop: false, spellcheck: false, safeDialogs: true,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.setAlwaysOnTop(cfg.onTop, 'floating');
  win.setOpacity(cfg.opacity);
  win.setMenu(null);
  win.loadURL(APP_URL);
  win.once('ready-to-show', () => win.show());
  win.on('moved', () => { const b = win.getBounds(); cfg.x = b.x; cfg.y = b.y; saveCfg(); });
  win.on('show', buildMenu); win.on('hide', buildMenu);
  win.on('close', e => { if (!quitting && cfg.closeToTray) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });
  win.on('page-title-updated', (e, title) => {
    e.preventDefault();
    if (tray) tray.setToolTip(String(title).slice(0, 100) === 'FocusDial' ? 'FocusDial' : 'FocusDial  ' + String(title).slice(0, 100));
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F5' || input.key === 'F11' || (input.control && input.key.toLowerCase() === 'r'))) e.preventDefault();
  });
}

function showWin() { if (!win) createWindow(); if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function toggleWin() { if (win && win.isVisible() && !win.isMinimized()) win.hide(); else showWin(); }

function openHabitFolder() {
  fs.promises.mkdir(habitDir(), { recursive: true }).catch(() => {}).then(() => shell.openPath(habitDir()));
}

function buildMenu() {
  if (!tray) return;
  const visible = win && win.isVisible();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? 'Hide FocusDial' : 'Show FocusDial', click: toggleWin },
    { type: 'separator' },
    { label: 'Start / pause timer', click: () => win && win.webContents.send('cmd', 'toggle') },
    { label: 'Skip session', click: () => win && win.webContents.send('cmd', 'skip') },
    { label: 'Reset session', click: () => win && win.webContents.send('cmd', 'reset') },
    { type: 'separator' },
    { label: 'Always on top', type: 'checkbox', checked: state().onTop, click: i => { cfg.onTop = i.checked; saveCfg(); if (win) win.setAlwaysOnTop(i.checked, 'floating'); pushState(); } },
    { label: 'Start with Windows', type: 'checkbox', checked: getAutoLaunch(), click: i => { setAutoLaunch(i.checked); pushState(); } },
    { label: 'Open habit logs', click: openHabitFolder },
    { label: 'Reset position', click: () => { if (!win) return; const p = defaultPos(win.getBounds().width); win.setPosition(p.x, p.y); cfg.x = p.x; cfg.y = p.y; saveCfg(); showWin(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
}

// ---------- IPC: only our own page may call these, and every argument is validated ----------
function trusted(e) {
  try {
    if (!win || e.sender !== win.webContents || !e.senderFrame) return false;
    const u = new URL(e.senderFrame.url);
    return u.protocol === 'app:' && u.host === ORIGIN_HOST;
  } catch { return false; }
}
const on = (ch, fn) => ipcMain.on(ch, (e, ...a) => { if (trusted(e)) fn(...a); });
const bool = v => v === true;
const text = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);

ipcMain.handle('win:get', e => trusted(e) ? state() : null);
on('win:minimize', () => { if (!win) return; if (cfg.skipTaskbar) win.hide(); else win.minimize(); });
on('win:close', () => { if (!win) return; if (cfg.closeToTray) win.hide(); else { quitting = true; app.quit(); } });
on('win:show', showWin);
on('win:size', (w, h) => {
  if (!win || !Number.isFinite(w) || !Number.isFinite(h)) return;
  w = Math.max(160, Math.min(2400, Math.round(w))); h = Math.max(120, Math.min(2400, Math.round(h)));
  const [cw, ch] = win.getContentSize();
  if (cw === w && ch === h) return;
  win.setResizable(true); win.setContentSize(w, h); win.setResizable(false);
});
on('win:onTop', v => { cfg.onTop = bool(v); saveCfg(); if (win) win.setAlwaysOnTop(cfg.onTop, 'floating'); pushState(); });
on('win:opacity', v => { if (!Number.isFinite(v)) return; cfg.opacity = Math.min(1, Math.max(0.3, v)); saveCfg(); if (win) win.setOpacity(cfg.opacity); });
on('win:autoLaunch', v => { setAutoLaunch(bool(v)); pushState(); });
on('win:skipTaskbar', v => { cfg.skipTaskbar = bool(v); saveCfg(); if (win) win.setSkipTaskbar(cfg.skipTaskbar); pushState(); });
on('win:closeToTray', v => { cfg.closeToTray = bool(v); saveCfg(); pushState(); });

on('habit:log', (file, line) => {
  let p; try { p = habitPath(text(file, 80)); } catch { return; }
  // eslint-disable-next-line no-control-regex -- deliberately strips control characters from input
  const row = text(line, 2000).replace(/[\r\n\u0000]+/g, ' ');
  if (!row) return;
  enqueue(async () => {
    await fs.promises.mkdir(habitDir(), { recursive: true });
    try { await fs.promises.writeFile(p, '﻿' + HEADER, { flag: 'wx' }); } catch (err) { if (err.code !== 'EEXIST') throw err; }
    await fs.promises.appendFile(p, row + '\r\n', 'utf8');
  });
});
on('habit:snapshot', json => {
  const body = text(json, 2 * 1024 * 1024);
  try { JSON.parse(body); } catch { return; }
  enqueue(async () => {
    await fs.promises.mkdir(dataDir(), { recursive: true });
    const target = path.join(dataDir(), 'habits.json'), tmp = target + '.tmp';
    await fs.promises.writeFile(tmp, body, 'utf8');      // atomic replace: never leave a half-written backup
    await fs.promises.rename(tmp, target);
  });
});
on('habit:open', file => {
  let p; try { p = habitPath(text(file, 80)); } catch { return; }
  fs.promises.access(p).then(() => shell.openPath(p), () => openHabitFolder());
});
on('habit:folder', openHabitFolder);

// ---------- global web-contents lockdown ----------
app.on('web-contents-created', (e, contents) => {
  contents.on('will-navigate', ev => ev.preventDefault());
  contents.on('will-redirect', ev => ev.preventDefault());
  contents.on('will-attach-webview', ev => ev.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.on('second-instance', showWin);
app.on('before-quit', () => { quitting = true; });
app.whenReady().then(() => {
  protocol.handle('app', async req => {
    try {
      const u = new URL(req.url);
      if (u.host !== ORIGIN_HOST) return new Response('Not found', { status: 404 });
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
      const full = path.resolve(APP_DIR, rel);
      const ext = path.extname(full).toLowerCase();
      if (rel.includes('\0') || !full.startsWith(APP_DIR + path.sep) || !MIME[ext] || /\.(js)$/.test(rel) && /^(main|preload)\.js$/.test(path.basename(rel))) {
        return new Response('Not found', { status: 404 });
      }
      const body = await fs.promises.readFile(full);
      return new Response(body, { status: 200, headers: {
        'Content-Type': MIME[ext], 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  const ses = session.defaultSession;
  const fromApp = u => { try { const x = new URL(u); return x.protocol === 'app:' && x.host === ORIGIN_HOST; } catch { return false; } };
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(permission === 'notifications' && fromApp(details.requestingUrl)));
  ses.setPermissionCheckHandler((wc, permission, origin, details) => permission === 'notifications' && fromApp((details && details.requestingUrl) || origin));

  createWindow();
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('FocusDial');
  tray.on('click', toggleWin);
  buildMenu();
});
app.on('window-all-closed', () => { if (quitting) app.quit(); });
