(() => {
  'use strict';
  const D = window.desktop || null;
  if (D) document.documentElement.classList.add('desktop');
  const widget = document.getElementById('widget');
  const home = document.getElementById('home');
  const $ = s => widget.querySelector(s);
  const THEMES = [['pure','Pure Dark'],['dark','Dark'],['light','Light'],['green','Green'],['blue','Blue'],
                  ['red','Red'],['orange','Orange'],['yellow','Yellow'],['purple','Purple'],['pink','Pink']];
  const SWATCH = {pure:['#000','#141414','#f4f4f4'],dark:['#16181e','#2a2e37','#eef0f5'],light:['#e7eaf0','#fff','#1d2028'],
    green:['#114536','#0a271e','#d6ffe8'],blue:['#13336a','#0b1d3b','#dceaff'],red:['#55141c','#2a090d','#ffe1e1'],
    orange:['#66300a','#2c1504','#ffe9d4'],yellow:['#ffe56e','#2c2609','#fff6c4'],purple:['#32185f','#180a31','#ece0ff'],pink:['#6a1b4b','#310a22','#ffe0f0']};
  const DEFAULTS = { focus: 25, short: 5, long: 15, every: 4, autoBreak: true, autoFocus: false, sound: true, notify: true,
                     h24: false, sec: true, date: true, analog: true, theme: 'dark', compact: false, panel: true, ptab: 'tasks', scale: 1 };
  const RING_C = 2 * Math.PI * 94;
  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>'
  };

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('focusdial3.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('focusdial3.' + k, JSON.stringify(v)); } catch { /* best effort */ } }
  };
  const pad = n => String(n).padStart(2, '0');
  const ymd = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function safeFile(name) {
    // eslint-disable-next-line no-control-regex -- deliberately strips control characters from input
    let base = String(name).replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 40);
    if (!base || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base)) base = 'habit ' + (base || '');
    return base.trim() + '.csv';
  }
  // ---------- validate stored data (never trust storage blindly) ----------
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d; };
  // eslint-disable-next-line no-control-regex -- deliberately strips control characters from input
  const str = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
  const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isId = v => typeof v === 'string' && /^[a-z0-9]{1,24}$/.test(v);
  const SCALES = [0.85, 1, 1.2, 1.45];
  function cleanSettings(raw) {
    const r = obj(raw), o = Object.assign({}, DEFAULTS);
    for (const k of Object.keys(DEFAULTS)) if (typeof r[k] === typeof DEFAULTS[k]) o[k] = r[k];
    o.focus = num(o.focus, 1, 99, 25); o.short = num(o.short, 1, 99, 5); o.long = num(o.long, 1, 99, 15); o.every = num(o.every, 2, 10, 4);
    if (!THEMES.some(([k]) => k === o.theme)) o.theme = DEFAULTS.theme;
    if (!['tasks', 'habits'].includes(o.ptab)) o.ptab = 'tasks';
    if (!SCALES.includes(o.scale)) o.scale = 1;
    return o;
  }
  function cleanTasks(raw) {
    return (Array.isArray(raw) ? raw : []).filter(x => x && typeof x === 'object').slice(0, 300).map(x => ({
      id: isId(x.id) ? x.id : uid(), title: str(x.title, 80).trim() || 'Task', est: num(x.est, 1, 10, 2), done: num(x.done, 0, 999, 0),
      completed: x.completed === true, due: isDay(x.due) ? x.due : '', created: isDay(x.created) ? x.created : ymd()
    }));
  }
  function cleanHabits(raw) {
    return (Array.isArray(raw) ? raw : []).filter(h => h && typeof h === 'object').slice(0, 100).map(h => {
      const log = {};
      for (const k of Object.keys(obj(h.log))) if (isDay(k) && h.log[k]) log[k] = 1;
      const name = str(h.name, 50).trim() || 'Habit';
      const file = /^[^\\/:*?"<>|]{1,60}\.csv$/i.test(h.file) ? h.file : safeFile(name);
      return { id: isId(h.id) ? h.id : uid(), name, target: num(h.target, 1, 7, 7), log, file, created: isDay(h.created) ? h.created : ymd() };
    });
  }
  const S = cleanSettings(store.get('settings', {}));
  const dur = m => Math.min(99, Math.max(1, Number(S[m]) || DEFAULTS[m])) * 60000;
  const rawSt = obj(store.get('state', {}));
  const st = {
    mode: ['focus', 'short', 'long'].includes(rawSt.mode) ? rawSt.mode : 'focus',
    running: rawSt.running === true, endAt: num(rawSt.endAt, 0, 8.64e15, 0), remaining: 0, cycle: num(rawSt.cycle, 0, 1000, 0),
    today: (obj(rawSt.today).d === ymd()) ? { d: ymd(), n: num(rawSt.today.n, 0, 1000, 0) } : { d: ymd(), n: 0 }
  };
  st.remaining = num(rawSt.remaining, 0, dur(st.mode), dur(st.mode));
  if (st.running && st.endAt - Date.now() > dur(st.mode)) { st.running = false; st.remaining = dur(st.mode); }
  let tasks = cleanTasks(store.get('tasks', []));
  let activeId = isId(store.get('active', null)) ? store.get('active', null) : null;
  let habits = cleanHabits(store.get('habits', []));
  const saveState = () => store.set('state', st);
  const saveSettings = () => store.set('settings', S);
  const saveTasks = () => { store.set('tasks', tasks); store.set('active', activeId); };
  const saveHabits = () => { store.set('habits', habits); if (D) D.habitSnapshot(JSON.stringify(habits, null, 2)); };

  // ---------- flip cards ----------
  function makeFlip(parent) {
    const d = document.createElement('div');
    d.className = 'flip';
    d.innerHTML = '<div class="half hu"><span></span></div><div class="half hl"><span></span></div><div class="half fu"><span></span></div><div class="half fl"><span></span></div>';
    parent.appendChild(d);
    const [top, bot, ftop, fbot] = Array.from(d.children, c => c.firstChild);
    let cur = null, timer = 0;
    return {
      set(v, animate = true) {
        v = String(v);
        if (v === cur) return;
        const old = cur === null ? v : cur;
        cur = v;
        top.textContent = v; ftop.textContent = old; fbot.textContent = v; bot.textContent = old;
        d.classList.remove('go'); clearTimeout(timer);
        if (!animate || old === v) { bot.textContent = v; return; }
        void d.offsetWidth; d.classList.add('go');
        timer = setTimeout(() => { bot.textContent = v; d.classList.remove('go'); }, 600);
      }
    };
  }
  const pairOf = id => { const p = $('#' + id); return [makeFlip(p), makeFlip(p)]; };
  const F = { h: pairOf('cH'), m: pairOf('cM'), s: pairOf('cS'), tm: pairOf('tM'), ts: pairOf('tS') };
  const setPair = (pair, str, anim) => { pair[0].set(str[0], anim); pair[1].set(str[1], anim); };

  const el = {
    ring: $('#ring'), hHour: $('#hHour'), hMin: $('#hMin'), hSec: $('#hSec'), ampm: $('#ampm'), date: $('#date'),
    dots: $('#dots'), todayN: $('#todayN'), toast: $('#toast'), settings: $('#settings'), tabs: $('#tabs'),
    pop: $('#btnPop'), compact: $('#btnCompact'), full: $('#btnFull'), panelBtn: $('#btnPanel'),
    tlist: $('#tlist'), hlist: $('#hlist'), bigBatt: $('#bigBatt'), bigFill: $('#bigFill'), pct: $('#pct'),
    clearDone: $('#btnClearDone'), habitFolder: $('#btnHabitFolder')
  };
  el.ring.style.strokeDasharray = RING_C.toFixed(2);
  let t = '';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0, a = i * Math.PI / 30, r1 = big ? 66 : 72, r2 = 77, sx = Math.sin(a), cy = Math.cos(a);
    t += `<line class="${big ? 't5' : 't'}" x1="${(100 + r1 * sx).toFixed(2)}" y1="${(100 - r1 * cy).toFixed(2)}" x2="${(100 + r2 * sx).toFixed(2)}" y2="${(100 - r2 * cy).toFixed(2)}"/>`;
  }
  $('#ticks').innerHTML = t;
  $('#themes').innerHTML = THEMES.map(([k, n]) => `<button data-t="${k}"><span class="sw"></span>${n}</button>`).join('');
  widget.querySelectorAll('#themes button').forEach(b => {
    const [bg, c, d] = SWATCH[b.dataset.t], sw = b.firstChild;
    sw.style.background = bg; sw.style.setProperty('--c', c); sw.style.setProperty('--d', d);
  });

  let pipWin = null, host = window, loops = null, animOK = false;
  const isMini = location.hash === '#mini';

  // ---------- clock ----------
  function drawHands() {
    const n = new Date();
    const s = n.getSeconds() + n.getMilliseconds() / 1000, m = n.getMinutes() + s / 60, h = (n.getHours() % 12) + m / 60;
    el.hSec.setAttribute('transform', `rotate(${(s * 6).toFixed(2)} 100 100)`);
    el.hMin.setAttribute('transform', `rotate(${(m * 6).toFixed(2)} 100 100)`);
    el.hHour.setAttribute('transform', `rotate(${(h * 30).toFixed(2)} 100 100)`);
  }
  let lastDay = ymd();
  function drawClock() {
    const n = new Date();
    let h = n.getHours();
    if (!S.h24) { el.ampm.textContent = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; } else el.ampm.textContent = '';
    setPair(F.h, pad(h), animOK); setPair(F.m, pad(n.getMinutes()), animOK); setPair(F.s, pad(n.getSeconds()), animOK);
    const ds = `<b>${n.toLocaleDateString(undefined, { weekday: 'long' })}</b> · ${n.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    if (el.date.innerHTML !== ds) el.date.innerHTML = ds;
    if (ymd() !== lastDay) {
      lastDay = ymd();
      if (st.today.d !== lastDay) { st.today = { d: lastDay, n: 0 }; saveState(); }
      renderStats(); renderTasks(); renderHabits();
    }
  }

  // ---------- pomodoro ----------
  const remainingMs = () => st.running ? st.endAt - Date.now() : st.remaining;
  function renderTimer() {
    const rem = remainingMs(), total = dur(st.mode);
    const secs = Math.ceil(Math.max(0, rem) / 1000), mm = pad(Math.min(99, Math.floor(secs / 60))), ss = pad(secs % 60);
    setPair(F.tm, mm, animOK); setPair(F.ts, ss, animOK);
    const prog = Math.min(1, Math.max(0, 1 - rem / total));
    el.ring.style.strokeDashoffset = (RING_C * (1 - prog)).toFixed(2);
    const title = st.running || rem < total ? `${st.running ? '▶' : '⏸'} ${mm}:${ss} · ${st.mode === 'focus' ? 'Focus' : 'Break'}` : 'FocusDial';
    if (document.title !== title) document.title = title;
    if (pipWin && pipWin.document.title !== title) pipWin.document.title = title;
  }
  function renderStats() {
    const every = Math.max(2, Number(S.every) || 4);
    const filled = st.cycle === 0 ? 0 : ((st.cycle - 1) % every) + 1;
    let h = '';
    for (let i = 0; i < every; i++) h += `<span class="dot${i < filled ? ' full' : ''}"></span>`;
    el.dots.innerHTML = h;
    el.todayN.textContent = st.today.n;
  }
  function renderMode() {
    widget.dataset.mode = st.mode;
    widget.classList.toggle('running', st.running);
    el.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.m === st.mode));
    const focusing = st.running && st.mode === 'focus';
    el.tlist.classList.toggle('focusing', focusing);
    el.bigBatt.classList.toggle('charging', focusing && S.ptab === 'tasks' && tasks.some(x => x.id === activeId && !x.completed));
    renderTimer(); renderStats();
  }
  function tick() {
    drawClock(); drawHands();
    if (st.running && st.endAt - Date.now() <= 0) { st.running = false; st.remaining = 0; complete(true); return; }
    renderTimer();
  }
  function startLoops() {
    stopLoops();
    const h = host, L = { h, iv: h.setInterval(tick, 200), raf: 0 };
    const frame = () => { drawHands(); L.raf = h.requestAnimationFrame(frame); };
    L.raf = h.requestAnimationFrame(frame);
    loops = L; tick();
  }
  function stopLoops() { if (!loops) return; try { loops.h.clearInterval(loops.iv); loops.h.cancelAnimationFrame(loops.raf); } catch { /* best effort */ } loops = null; }

  function start() {
    if (st.running) return;
    unlockAudio(); askNotify();
    if (st.remaining <= 0) st.remaining = dur(st.mode);
    st.endAt = Date.now() + st.remaining; st.running = true;
    renderMode(); saveState();
  }
  function pause() { if (!st.running) return; st.remaining = Math.max(0, st.endAt - Date.now()); st.running = false; renderMode(); saveState(); }
  const toggle = () => st.running ? pause() : start();
  function reset() { st.running = false; st.remaining = dur(st.mode); renderMode(); saveState(); }
  function setMode(m, autostart) { st.mode = m; st.running = false; st.remaining = dur(m); renderMode(); if (autostart) start(); else saveState(); }
  function skip() { complete(false, st.running); }
  function complete(natural, keepRunning) {
    const was = st.mode;
    let credited = null;
    if (was === 'focus' && natural) {
      st.cycle++; st.today.n++;
      const a = tasks.find(x => x.id === activeId && !x.completed);
      if (a) { a.done++; credited = a; saveTasks(); renderTasks(); }
    }
    if (natural) { chime(was); notify(was, credited); flash(); }
    let next;
    if (was === 'focus') { const every = Math.max(2, Number(S.every) || 4); next = st.cycle > 0 && st.cycle % every === 0 ? 'long' : 'short'; }
    else { if (was === 'long') st.cycle = 0; next = 'focus'; }
    setMode(next, natural ? (next === 'focus' ? S.autoFocus : S.autoBreak) : !!keepRunning);
    if (natural) toastMsg(was === 'focus' ? (credited ? `🔋 +1 · ${credited.title}` : '🎉 ☕') : '🎯');
  }
  function flash() { widget.classList.remove('flashing'); void widget.offsetWidth; widget.classList.add('flashing'); }

  // ---------- sound & notifications ----------
  let actx = null;
  function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { /* best effort */ } }
  function chime(kind, force) {
    if (!S.sound && !force) return;
    unlockAudio(); if (!actx) return;
    const notes = kind === 'focus' ? [659.25, 783.99, 1046.5] : [1046.5, 783.99, 587.33];
    const now = actx.currentTime + 0.02;
    notes.forEach((f, i) => [[f, 0.22], [f * 2.01, 0.05]].forEach(([freq, vol]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = now + i * 0.24;
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 1.7);
    }));
  }
  function askNotify() { try { if (S.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch { /* best effort */ } }
  function notify(was, task) {
    if (!S.notify) return;
    try {
      if (!('Notification' in window) || Notification.permission === 'denied') return;
      const n = new Notification(was === 'focus' ? '🍅 Focus session done!' : '☕ Break is over', {
        body: was === 'focus' ? (task ? `🔋 ${task.title} · ${task.done}/${task.est}` : 'Stand up, stretch, drink some water.') : 'Back to deep work. You got this.', silent: true });
      n.onclick = () => { if (D) D.show(); };
    } catch { /* best effort */ }
  }
  let toastT;
  function toastMsg(msg, ms = 2600) { el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms); }

  // ---------- batteries ----------
  const lvl = r => r >= 1 ? 'var(--b-full)' : r >= 0.67 ? 'var(--b-high)' : r >= 0.34 ? 'var(--b-mid)' : 'var(--b-low)';
  const lvlClass = r => r >= 1 ? 'lv-full' : r >= 0.67 ? 'lv-high' : r >= 0.34 ? 'lv-mid' : 'lv-low';
  function battery(done, total, opts = {}) {
    const cells = Math.max(1, Math.min(10, total));
    const filled = opts.full ? cells : Math.min(done, cells), r = total ? done / total : 0;
    let c = '';
    for (let i = 0; i < cells; i++) c += `<i class="${i < filled ? 'on' : ''}${i === filled && opts.next ? ' next' : ''}"></i>`;
    const extra = done > total ? `<span class="over">+${done - total}</span>` : '';
    const bolt = r >= 1 || opts.full ? `<span class="bolt">${opts.full ? ICON.check : ICON.bolt}</span>` : '';
    return `<div class="batt ${opts.full ? 'lv-full' : lvlClass(r)}" title="${esc(opts.title || '')}"><div class="cells">${c}</div><span class="nub"></span>${bolt}${extra}</div>`;
  }
  function setBig(r, label) {
    el.bigFill.style.width = (Math.max(0, Math.min(1, r)) * 100).toFixed(1) + '%';
    el.bigBatt.style.setProperty('--lvl', lvl(r));
    el.pct.textContent = label;
  }

  // ---------- tasks ----------
  function dueChip(due) {
    if (!due) return '';
    if (!isDay(due)) return '';
    const today = ymd(), d = new Date(due + 'T00:00');
    const cls = due < today ? 'late' : due === today ? 'today' : '';
    const txt = due === today ? '●' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `<div class="due ${cls}">${ICON.cal}${esc(txt)}</div>`;
  }
  function renderTasks() {
    const order = [...tasks.filter(x => !x.completed), ...tasks.filter(x => x.completed)];
    el.tlist.innerHTML = order.map(x => `
      <li class="task${x.completed ? ' done' : ''}${x.id === activeId ? ' active' : ''}" data-id="${x.id}">
        <button class="chk" data-a="check" title="Done">${ICON.check}</button>
        <div class="tmain"><div class="ttitle" title="Double-click to rename">${esc(x.title)}</div>${dueChip(x.due)}</div>
        <div class="tedit"><button class="mini" data-a="dec" title="Fewer pomodoros">−</button><button class="mini" data-a="inc" title="More pomodoros">+</button></div>
        ${battery(x.done, x.est, { next: x.id === activeId && !x.completed, full: x.completed, title: `🍅 ${x.done}/${x.est}` })}
        <button class="mini" data-a="del" title="Delete">${ICON.x}</button>
      </li>`).join('');
    if (S.ptab === 'tasks') {
      const est = tasks.reduce((a, x) => a + Math.max(1, x.est), 0);
      const done = tasks.reduce((a, x) => a + (x.completed ? Math.max(1, x.est) : Math.min(x.done, x.est)), 0);
      setBig(est ? done / est : 0, (est ? Math.round(done / est * 100) : 0) + '%');
    }
    el.clearDone.hidden = S.ptab !== 'tasks' || !tasks.some(x => x.completed);
  }
  el.tlist.addEventListener('click', e => {
    const li = e.target.closest('.task'); if (!li) return;
    const x = tasks.find(k => k.id === li.dataset.id); if (!x) return;
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target.closest('.batt')) { x.done++; toastMsg(`🔋 ${x.done}/${x.est}`, 1200); }
    else if (a === 'check') { x.completed = !x.completed; if (x.completed && activeId === x.id) activeId = (tasks.find(k => !k.completed) || {}).id || null; if (x.completed) { flash(); toastMsg('✅'); } }
    else if (a === 'inc') x.est = Math.min(10, x.est + 1);
    else if (a === 'dec') x.est = Math.max(1, x.est - 1);
    else if (a === 'del') { tasks = tasks.filter(k => k !== x); if (activeId === x.id) activeId = (tasks.find(k => !k.completed) || {}).id || null; }
    else if (e.target.closest('.ttitle[contenteditable="true"]')) return;
    else if (!x.completed) activeId = x.id;
    saveTasks(); renderTasks(); renderMode();
  });
  el.tlist.addEventListener('contextmenu', e => {
    const b = e.target.closest('.batt'); if (!b) return;
    e.preventDefault();
    const x = tasks.find(k => k.id === b.closest('.task').dataset.id);
    if (x && x.done > 0) { x.done--; saveTasks(); renderTasks(); toastMsg(`🔋 ${x.done}/${x.est}`, 1200); }
  });
  function makeEditable(node, onSave) {
    const old = node.textContent;
    node.contentEditable = 'true'; node.focus();
    const r = document.createRange(); r.selectNodeContents(node);
    const sel = node.ownerDocument.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const finish = save => {
      node.contentEditable = 'false';
      node.removeEventListener('keydown', kd); node.removeEventListener('blur', bl);
      const v = node.textContent.trim();
      if (save && v && v !== old) onSave(v); else node.textContent = old;
    };
    const kd = e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') finish(false); e.stopPropagation(); };
    const bl = () => finish(true);
    node.addEventListener('keydown', kd); node.addEventListener('blur', bl);
  }
  el.tlist.addEventListener('dblclick', e => {
    const tt = e.target.closest('.ttitle'); if (!tt) return;
    const x = tasks.find(k => k.id === tt.closest('.task').dataset.id);
    makeEditable(tt, v => { x.title = v.slice(0, 80); saveTasks(); renderTasks(); });
  });
  let newEst = 2;
  const newDue = $('#newDue'), calBtn = $('#calBtn');
  $('#taskForm').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; newEst = Math.max(1, Math.min(10, newEst + Number(b.dataset.d))); $('#newEst').textContent = newEst; });
  newDue.addEventListener('change', () => calBtn.classList.toggle('set', !!newDue.value));
  calBtn.addEventListener('click', e => { if (e.target === newDue) { try { newDue.showPicker(); e.preventDefault(); } catch { /* best effort */ } } });
  $('#taskForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#newTask'), title = inp.value.trim(); if (!title) return;
    const x = { id: uid(), title: title.slice(0, 80), est: newEst, done: 0, completed: false, due: newDue.value || '', created: ymd() };
    tasks.push(x); if (!activeId || !tasks.some(k => k.id === activeId && !k.completed)) activeId = x.id;
    inp.value = ''; newDue.value = ''; calBtn.classList.remove('set'); newEst = 2; $('#newEst').textContent = 2;
    saveTasks(); renderTasks(); renderMode();
  });
  el.clearDone.addEventListener('click', () => { tasks = tasks.filter(x => !x.completed); saveTasks(); renderTasks(); });

  // ---------- habits ----------
  const daysBack = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
  const last7 = h => { let c = 0; for (let i = 0; i < 7; i++) if (h.log[ymd(daysBack(i))]) c++; return c; };
  function streakOf(h) { let i = h.log[ymd()] ? 0 : 1, n = 0; while (h.log[ymd(daysBack(i))]) { n++; i++; } return n; }
  // CSV field: quote when needed, and neutralise spreadsheet formula injection (=, +, -, @, tab, CR)
  const csvq = v => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\r\n']/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function logHabit(h, day, status, source) {
    if (!D) return;
    const n = new Date();
    const line = [day, `${ymd(n)} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`, csvq(h.name), csvq(status), source, streakOf(h), last7(h), h.target].join(',');
    D.habitLog(h.file, line);
  }
  function setHabitDay(h, day, on, source) {
    if (on) h.log[day] = 1; else delete h.log[day];
    logHabit(h, day, on ? 'done' : 'undone', source);
    saveHabits(); renderHabits();
  }
  let armed = null, armT = 0;
  function renderHabits() {
    const days = [6, 5, 4, 3, 2, 1, 0].map(daysBack), today = ymd();
    const head = `<li class="habit hhead"><span></span><span></span><div class="week">${days.map(d => `<span class="${ymd(d) === today ? 'today' : ''}">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>`).join('')}</div><span></span><span></span><span></span></li>`;
    el.hlist.innerHTML = habits.length ? head + habits.map(h => {
      const s = streakOf(h), w = last7(h);
      return `<li class="habit" data-id="${h.id}">
        <button class="chk${h.log[today] ? ' on' : ''}" data-a="today" title="Done today">${ICON.check}</button>
        <div class="tmain"><div class="ttitle" title="Double-click to rename">${esc(h.name)}</div></div>
        <div class="week">${days.map(d => `<i class="${h.log[ymd(d)] ? 'on' : ''}${ymd(d) === today ? ' today' : ''}" data-day="${ymd(d)}" title="${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}"></i>`).join('')}</div>
        <span class="streak${s >= 3 ? ' hot' : ''}" title="Streak">🔥${s}</span>
        ${battery(w, h.target, { title: `${w}/${h.target} this week` })}
        <div class="hacts">${D ? `<button class="mini" data-a="file" title="Open log file">${ICON.file}</button>` : ''}<button class="mini${armed === h.id ? ' arm' : ''}" data-a="del" title="Delete (click twice)">${ICON.x}</button></div>
      </li>`;
    }).join('') : '';
    if (S.ptab === 'habits') {
      const n = habits.length, d = habits.filter(h => h.log[today]).length;
      setBig(n ? d / n : 0, n ? `${d}/${n}` : '0/0');
    }
  }
  el.hlist.addEventListener('click', e => {
    const li = e.target.closest('.habit'); if (!li || !li.dataset.id) return;
    const h = habits.find(k => k.id === li.dataset.id); if (!h) return;
    const day = e.target.closest('[data-day]')?.dataset.day;
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (day) setHabitDay(h, day, !h.log[day], day === ymd() ? 'today' : 'backfill');
    else if (a === 'today' || e.target.closest('.batt')) { const on = !h.log[ymd()]; setHabitDay(h, ymd(), on, 'today'); if (on) { flash(); toastMsg(`🔥 ${streakOf(h)}`); } }
    else if (a === 'file') D && D.openHabitFile(h.file);
    else if (a === 'del') {
      if (armed !== h.id) { armed = h.id; clearTimeout(armT); armT = setTimeout(() => { armed = null; renderHabits(); }, 2500); renderHabits(); return; }
      armed = null; logHabit(h, ymd(), 'deleted', 'app'); habits = habits.filter(k => k !== h); saveHabits(); renderHabits();
    }
  });
  el.hlist.addEventListener('dblclick', e => {
    const tt = e.target.closest('.ttitle'); if (!tt) return;
    const h = habits.find(k => k.id === tt.closest('.habit').dataset.id);
    makeEditable(tt, v => { const old = h.name; h.name = v.slice(0, 50); logHabit(h, ymd(), 'renamed from ' + old, 'app'); saveHabits(); renderHabits(); });
  });
  let newTarget = 7;
  $('#habitForm').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b) return; newTarget = Math.max(1, Math.min(7, newTarget + Number(b.dataset.h))); $('#newTarget').textContent = newTarget; });
  $('#habitForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#newHabit'), name = inp.value.trim(); if (!name) return;
    let file = safeFile(name), n = 2;
    while (habits.some(h => h.file.toLowerCase() === file.toLowerCase())) file = safeFile(name).replace(/\.csv$/, ` (${n++}).csv`);
    const h = { id: uid(), name: name.slice(0, 50), target: newTarget, log: {}, file, created: ymd() };
    habits.push(h); inp.value = '';
    logHabit(h, ymd(), 'created', 'app');
    saveHabits(); renderHabits();
  });
  el.habitFolder.addEventListener('click', () => D && D.openHabitFolder());

  // ---------- panel ----------
  function applyPanel() {
    widget.querySelectorAll('.ptabs button').forEach(b => b.classList.toggle('active', b.dataset.p === S.ptab));
    $('#tasksView').hidden = S.ptab !== 'tasks';
    $('#habitsView').hidden = S.ptab !== 'habits';
    el.habitFolder.hidden = S.ptab !== 'habits';
    renderTasks(); renderHabits(); renderMode();
  }
  widget.querySelectorAll('.ptabs button').forEach(b => b.addEventListener('click', () => { S.ptab = b.dataset.p; saveSettings(); applyPanel(); }));

  // ---------- settings ----------
  function applyLook() {
    document.documentElement.dataset.theme = S.theme;
    if (pipWin) pipWin.document.documentElement.dataset.theme = S.theme;
    widget.querySelectorAll('#themes button').forEach(b => b.classList.toggle('active', b.dataset.t === S.theme));
    widget.querySelectorAll('#sizes button').forEach(b => b.classList.toggle('active', Number(b.dataset.s) === Number(S.scale)));
    widget.querySelectorAll('.secpart').forEach(n => n.hidden = !S.sec);
    el.date.hidden = !S.date;
    $('.dialbox').hidden = !S.analog;
    widget.classList.toggle('no-analog', !S.analog);
    widget.classList.toggle('compact', !!S.compact);
    $('#panel').hidden = !S.panel;
    el.compact.classList.toggle('on', !!S.compact);
    el.panelBtn.classList.toggle('on', !!S.panel);
    fit();
  }
  const inputs = { sFocus: 'focus', sShort: 'short', sLong: 'long', sEvery: 'every' };
  const checks = { s24: 'h24', sSec: 'sec', sDate: 'date', sAnalog: 'analog', sAutoBreak: 'autoBreak', sAutoFocus: 'autoFocus', sSound: 'sound', sNotify: 'notify' };
  for (const [id, k] of Object.entries(inputs)) {
    const inp = $('#' + id); inp.value = S[k];
    inp.addEventListener('change', () => {
      const v = Math.round(Number(inp.value));
      S[k] = isFinite(v) ? Math.min(Number(inp.max), Math.max(Number(inp.min), v)) : DEFAULTS[k];
      inp.value = S[k]; saveSettings();
      if (!st.running && k !== 'every') st.remaining = dur(st.mode);
      renderMode(); saveState();
    });
  }
  for (const [id, k] of Object.entries(checks)) {
    const inp = $('#' + id); inp.checked = !!S[k];
    inp.addEventListener('change', () => { S[k] = inp.checked; saveSettings(); applyLook(); if (k === 'h24') drawClock(); if (k === 'notify' && S.notify) askNotify(); });
  }
  widget.querySelectorAll('#themes button').forEach(b => b.addEventListener('click', () => { S.theme = b.dataset.t; saveSettings(); applyLook(); }));
  widget.querySelectorAll('#sizes button').forEach(b => b.addEventListener('click', () => { const v = Number(b.dataset.s); if (SCALES.includes(v)) { S.scale = v; saveSettings(); applyLook(); } }));
  const setScale = d => { const i = SCALES.indexOf(Number(S.scale)); S.scale = SCALES[Math.max(0, Math.min(SCALES.length - 1, (i < 0 ? 1 : i) + d))]; saveSettings(); applyLook(); };
  const openSettings = v => { el.settings.hidden = !v; widget.classList.toggle('sopen', v); fit(); };

  // desktop window settings
  let onTop = false;
  function syncDesktop(s) {
    if (!s) return;
    onTop = !!s.onTop;
    $('#wTop').checked = onTop; $('#wAuto').checked = !!s.autoLaunch; $('#wTask').checked = !s.skipTaskbar; $('#wTray').checked = !!s.closeToTray;
    $('#wOpacity').value = Math.round((s.opacity || 1) * 100); $('#wOpVal').textContent = Math.round((s.opacity || 1) * 100) + '%';
    el.pop.classList.toggle('on', onTop);
    el.pop.title = onTop ? 'Unpin from top (P)' : 'Keep on top (P)';
  }
  if (D) {
    D.get().then(syncDesktop);
    D.on('state', syncDesktop);
    D.on('cmd', c => { if (c === 'toggle') toggle(); else if (c === 'skip') skip(); else if (c === 'reset') reset(); });
    $('#wTop').addEventListener('change', e => D.setOnTop(e.target.checked));
    $('#wAuto').addEventListener('change', e => D.setAutoLaunch(e.target.checked));
    $('#wTask').addEventListener('change', e => D.setSkipTaskbar(!e.target.checked));
    $('#wTray').addEventListener('change', e => D.setCloseToTray(e.target.checked));
    $('#wOpacity').addEventListener('input', e => { $('#wOpVal').textContent = e.target.value + '%'; D.setOpacity(Number(e.target.value) / 100); });
    $('#btnMin').addEventListener('click', () => D.minimize());
    $('#btnX').addEventListener('click', () => D.close());
    $('#btnLogs').addEventListener('click', () => D.openHabitFolder());
  }

  // ---------- size / float / fullscreen ----------
  const isFull = () => !!document.fullscreenElement;
  function fit() {
    if (D) {
      widget.style.zoom = String(S.scale);
      const r = widget.getBoundingClientRect();
      D.setSize(Math.ceil(r.width) + 32, Math.ceil(r.height) + 32);
      return;
    }
    if (!(pipWin || isMini || isFull())) { widget.style.zoom = String(S.scale); return; }
    const w = host.innerWidth, h = host.innerHeight;
    widget.style.zoom = '1';
    const r = widget.getBoundingClientRect();
    const p = isFull() ? 60 : 8;
    widget.style.zoom = Math.max(0.35, Math.min(4, Math.min((w - p) / r.width, (h - p) / r.height))).toFixed(3);
  }
  if (D && 'ResizeObserver' in window) new ResizeObserver(() => fit()).observe(widget);
  const inFrame = (() => { try { return window.top !== window; } catch { return true; } })();
  const pipSupported = 'documentPictureInPicture' in window;

  async function popOut() {
    if (D) { D.setOnTop(!onTop); return; }
    if (pipWin) { pipWin.close(); return; }
    if (isMini) return;
    if (isFull()) { try { await document.exitFullscreen(); } catch { /* best effort */ } }
    if (pipSupported && !inFrame) {
      try {
        widget.style.zoom = '1';
        const r = widget.getBoundingClientRect();
        const pw = await documentPictureInPicture.requestWindow({ width: Math.round(r.width + 8), height: Math.round(r.height + 8) });
        pipWin = pw;
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(n => {
          const c = n.cloneNode(true);
          if (c.tagName === 'LINK') c.href = n.href;
          pw.document.head.appendChild(c);
        });
        pw.document.documentElement.dataset.theme = S.theme;
        pw.document.body.className = 'floating';
        pw.document.body.append(widget);
        el.full.hidden = true;
        document.getElementById('floatingNote').hidden = false;
        el.pop.classList.add('on');
        pw.addEventListener('keydown', onKey);
        pw.addEventListener('resize', fit);
        pw.addEventListener('pagehide', () => {
          home.prepend(widget); el.full.hidden = false;
          document.getElementById('floatingNote').hidden = true;
          el.pop.classList.remove('on');
          pipWin = null; host = window; fit(); startLoops();
        });
        host = pw; startLoops();
        requestAnimationFrame(fit); setTimeout(fit, 150);
        return;
      } catch { pipWin = null; host = window; fit(); }
    }
    let w = null;
    try { w = window.open(location.href.split('#')[0] + '#mini', 'focusdial-mini', 'popup,width=500,height=720'); } catch { /* best effort */ }
    if (!w) toastMsg(inFrame ? '📌 Open FocusDial in Chrome or Edge to float it' : '📌 Needs Chrome or Edge 116+', 4200);
  }
  async function toggleFull() {
    if (pipWin || D) return;
    try { if (isFull()) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toastMsg('⛶ ✕'); }
  }
  document.addEventListener('fullscreenchange', () => {
    document.body.classList.toggle('floating', isFull() || isMini);
    if (isFull()) document.body.append(widget); else if (!isMini && !pipWin) home.prepend(widget);
    requestAnimationFrame(fit);
  });

  // ---------- keyboard ----------
  function onKey(e) {
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) { if (e.key === 'Escape') tg.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setScale(1); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setScale(-1); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case ' ': e.preventDefault(); toggle(); break;
      case 'r': reset(); break;
      case 's': skip(); break;
      case '1': setMode('focus'); break;
      case '2': setMode('short'); break;
      case '3': setMode('long'); break;
      case 'c': S.compact = !S.compact; saveSettings(); applyLook(); break;
      case 't': S.panel = !S.panel; saveSettings(); applyLook(); break;
      case 'n': if (!S.panel) { S.panel = true; saveSettings(); applyLook(); } e.preventDefault(); $(S.ptab === 'habits' ? '#newHabit' : '#newTask').focus(); break;
      case 'f': toggleFull(); break;
      case 'p': popOut(); break;
      case 'escape': openSettings(false); break;
    }
  }
  document.addEventListener('keydown', onKey);
  $('#btnPlay').addEventListener('click', toggle);
  $('#btnReset').addEventListener('click', reset);
  $('#btnSkip').addEventListener('click', skip);
  $('#btnSettings').addEventListener('click', () => openSettings(el.settings.hidden));
  $('#btnClose').addEventListener('click', () => openSettings(false));
  el.compact.addEventListener('click', () => { S.compact = !S.compact; saveSettings(); applyLook(); });
  el.panelBtn.addEventListener('click', () => { S.panel = !S.panel; saveSettings(); applyLook(); });
  el.full.addEventListener('click', toggleFull);
  el.pop.addEventListener('click', popOut);
  document.getElementById('btnBringBack').addEventListener('click', () => pipWin && pipWin.close());
  el.tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
  $('#btnTest').addEventListener('click', () => chime('focus', true));
  $('#btnResetDay').addEventListener('click', () => { st.today = { d: ymd(), n: 0 }; st.cycle = 0; renderStats(); saveState(); toastMsg('↺'); });
  window.addEventListener('resize', () => { if (!D) fit(); });
  window.addEventListener('beforeunload', () => { if (pipWin) pipWin.close(); });

  // ---------- boot ----------
  if (isMini) { document.body.classList.add('floating'); el.full.hidden = true; document.body.append(widget); }
  if (st.running && st.endAt <= Date.now()) { st.running = false; st.remaining = 0; complete(false, false); }
  if (D && habits.length) D.habitSnapshot(JSON.stringify(habits, null, 2));
  applyLook();
  applyPanel();
  startLoops();
  animOK = true;
  requestAnimationFrame(fit);
  if (document.fonts) document.fonts.ready.then(fit);
})();
