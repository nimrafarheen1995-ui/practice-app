/**
 * Universal Pen v3.0 - stroke-based ink
 *
 * Ink is saved as strokes (lists of points), not images.
 *  - Drawings are stored as proportions of their box, so they scale and survive rotation.
 *  - Undo / redo are instant and use very little memory.
 *  - Each ink box keeps its own strokes, so boxes never overwrite each other.
 *
 * Public API (same names the lesson already uses):
 *   UniversalPen.forceCanvas(canvas)  register a box and draw its saved strokes
 *   UniversalPen.setInkKey(key)       default key for boxes without data-ink-key
 *   UniversalPen.clearInk()           clear the active box
 *   UniversalPen.saveInk()            save pending changes now
 *   UniversalPen.undo() / redo()
 *   UniversalPen.state                activeCanvas, ctx, tool settings
 */
(function () {
  'use strict';

  const CFG = {
    colors: ['#0F172A', '#2563EB', '#15803D', '#DC2626', '#7C3AED'],
    stamps: ['⭐', '😡', '❤️', '😊', '😢', '🌸', '♻️', '🌍', '✅', '❌', '💯', '❄️'],
    stickers: ['💃', '🔥', '⭐', '🌹', '🧐', '🫰', '🌳', '🎊'],
    uiKey: 'LQ_PEN_UI_V3',
    soundKey: 'LQ_PEN_SOUND_V3',
    inkPrefix: 'LQ_INK_V3_',
    stickerPrefix: 'LQ_STICKERS_V3_',
    lineColor: '#8B5A2B',
    lineWidth: 2.5,
    eraserMultiplier: 4,
    minEraserSize: 12,
    qalamWidthFactor: 3.2,
    saveDebounceMs: 300
  };

  const state = {
    tool: 'pen',          // pen | eraser | line
    penType: 'normal',    // normal | rainbow | glitter | qalam
    color: '#0F172A',
    size: 2.5,
    soundOn: false,
    audioCtx: null,
    activeCanvas: null,   // last box the child touched
    ctx: null,
    cur: null,            // stroke currently being drawn
    curRec: null,         // record that the current stroke will be saved to
    curCanvas: null,
    pointerId: null,      // the single pointer allowed to draw
    penSeen: 0            // last time a stylus was used (used for palm rejection)
  };

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round4 = v => Math.round(v * 10000) / 10000;

  const pagePart = ((location.pathname || 'page')
    .replace(/^\//, '')
    .replace(/\.html?$/i, '')
    .replace(/[^a-z0-9_-]/gi, '_')) || 'page';

  let defaultKey = null;
  const records = new Map();   // storage key -> { key, strokes, redo, timer }
  const registered = new WeakSet();
  let stackPos = null;         // position of the pen + eraser bubbles

  /* ================= Storage ================= */

  function boxKey(canvas) {
    const all = Array.from(document.querySelectorAll('canvas'));
    const sec = canvas.dataset.inkKey || defaultKey || canvas.id || ('canvas-' + all.indexOf(canvas));
    return CFG.inkPrefix + pagePart + '__' + sec;
  }

  function recordFor(canvas) {
    const key = boxKey(canvas);
    let rec = records.get(key);
    if (!rec) {
      rec = { key, strokes: [], redo: [], timer: null };
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && Array.isArray(d.s)) rec.strokes = d.s;
        }
      } catch (e) { /* corrupt or unavailable storage: start empty */ }
      records.set(key, rec);
    }
    return rec;
  }

  function saveNow(rec) {
    clearTimeout(rec.timer);
    rec.timer = null;
    try {
      localStorage.setItem(rec.key, JSON.stringify({ v: 3, s: rec.strokes }));
    } catch (e) {
      console.warn('Ink could not be saved (storage may be full).', e);
    }
  }

  function scheduleSave(rec) {
    clearTimeout(rec.timer);
    rec.timer = setTimeout(() => saveNow(rec), CFG.saveDebounceMs);
  }

  function flushAll() {
    records.forEach(rec => { if (rec.timer) saveNow(rec); });
  }

  /* ================= Rendering ================= */

  // Points are stored as [x, y, pressure] with x and y as proportions of the box.
  function drawQalam(ctx, x0, y0, p0, x1, y1, p1, color, total) {
    const ang = -Math.PI / 4;                 // 45-degree reed-nib angle
    const h0 = total * (p0 * 0.65 + 0.55) / 2;
    const h1 = total * (p1 * 0.65 + 0.55) / 2;
    const c = Math.cos(ang), s = Math.sin(ang);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(x0 - h0 * c, y0 - h0 * s);
    ctx.lineTo(x0 + h0 * c, y0 + h0 * s);
    ctx.lineTo(x1 + h1 * c, y1 + h1 * s);
    ctx.lineTo(x1 - h1 * c, y1 - h1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawSegment(ctx, s, i, W, H) {
    const n = s.pts.length / 3;
    if (i >= n) return;
    const x = s.pts[i * 3] * W, y = s.pts[i * 3 + 1] * H, p = s.pts[i * 3 + 2];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.t === 'e') ctx.globalCompositeOperation = 'destination-out';

    if (i === 0) {
      let r = s.w / 2;
      if (s.t === 'q') r = s.w * CFG.qalamWidthFactor * (p * 0.65 + 0.55) / 2;
      ctx.fillStyle = s.t === 'r' ? '#E11D48' : (s.t === 'e' ? '#000' : s.c);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(r, 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const x0 = s.pts[(i - 1) * 3] * W;
    const y0 = s.pts[(i - 1) * 3 + 1] * H;
    const p0 = s.pts[(i - 1) * 3 + 2];

    if (s.t === 'q') {
      drawQalam(ctx, x0, y0, p0, x, y, p, s.c, s.w * CFG.qalamWidthFactor);
    } else {
      if (s.t === 'r') ctx.strokeStyle = `hsl(${(i * 5) % 360},100%,50%)`;
      else ctx.strokeStyle = s.t === 'e' ? '#000' : s.c;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (s.t === 'g' && (i * 7) % 4 === 0) {
        // Deterministic sparkle so the same stroke always looks the same.
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(x + ((i * 37) % 11 - 5), y + ((i * 53) % 11 - 5), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawStroke(ctx, s, W, H) {
    if (s.t === 'l') {
      if (s.pts.length < 6) return;
      ctx.save();
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.pts[0] * W, s.pts[1] * H);
      ctx.lineTo(s.pts[3] * W, s.pts[4] * H);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const n = s.pts.length / 3;
    for (let i = 0; i < n; i++) drawSegment(ctx, s, i, W, H);
  }

  // Redraws a whole box from its saved strokes. `extra` is an in-progress stroke.
  function renderBox(canvas, extra) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const rec = recordFor(canvas);
    rec.strokes.forEach(s => drawStroke(ctx, s, W, H));
    if (extra) drawStroke(ctx, extra, W, H);
    return ctx;
  }

  function renderAll() {
    document.querySelectorAll('canvas[data-pen="true"]').forEach(c => renderBox(c));
  }

  /* ================= Public box handling ================= */

  function forceCanvas(canvas) {
    if (!canvas || canvas.tagName !== 'CANVAS') return;
    canvas.dataset.pen = 'true';
    canvas.style.touchAction = 'none';
    registered.add(canvas);
    state.activeCanvas = canvas;
    renderBox(canvas);
    state.ctx = canvas.getContext('2d');
  }

  function setInkKey(key) {
    defaultKey = key ? String(key) : null;
    renderAll();
  }

  function newStroke() {
    if (state.tool === 'eraser') {
      return { t: 'e', c: '#000', w: Math.max(CFG.minEraserSize, state.size * CFG.eraserMultiplier), pts: [] };
    }
    if (state.tool === 'line') {
      return { t: 'l', c: CFG.lineColor, w: CFG.lineWidth, pts: [] };
    }
    const code = { normal: 'p', rainbow: 'r', glitter: 'g', qalam: 'q' }[state.penType] || 'p';
    return { t: code, c: state.color, w: state.size, pts: [] };
  }

  function normPoint(e, canvas) {
    const r = canvas.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, -0.02, 1.02);
    const y = clamp((e.clientY - r.top) / r.height, -0.02, 1.02);
    const p = e.pressure > 0 ? e.pressure : 0.5;
    return [round4(x), round4(y), Math.round(p * 100) / 100];
  }

  /* ================= Drawing input ================= */

  function onDown(e) {
    if (e.button > 0) return;
    const canvas = e.target.closest ? e.target.closest('canvas') : null;
    if (!canvas || state.cur) return;             // not a box, or already drawing

    if (e.pointerType === 'touch') {
      if (Date.now() - state.penSeen < 1500) return;   // a stylus is in use: ignore the hand
      if (e.width > 40 || e.height > 40) return;       // palm-sized contact
    } else if (e.pointerType === 'pen') {
      state.penSeen = Date.now();
    }

    if (!registered.has(canvas)) forceCanvas(canvas);
    if (state.soundOn) initAudio();

    e.preventDefault();
    state.activeCanvas = canvas;
    state.ctx = canvas.getContext('2d');
    state.curCanvas = canvas;
    state.curRec = recordFor(canvas);
    state.pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}

    const s = newStroke();
    const p = normPoint(e, canvas);
    s.pts.push(p[0], p[1], p[2]);
    if (s.t === 'l') s.pts.push(p[0], p[1], p[2]);   // second point follows the pointer
    state.cur = s;

    if (s.t === 'e') playEraser();
    else if (s.t !== 'l') playPen();

    if (s.t !== 'l') drawSegment(state.ctx, s, 0, canvas.clientWidth, canvas.clientHeight);
  }

  function onMove(e) {
    const s = state.cur;
    if (!s || e.pointerId !== state.pointerId) return;
    e.preventDefault();
    const canvas = state.curCanvas;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const list = events.length ? events : [e];

    if (s.t === 'l') {
      const p = normPoint(list[list.length - 1], canvas);
      s.pts[3] = p[0]; s.pts[4] = p[1]; s.pts[5] = p[2];
      state.ctx = renderBox(canvas, s) || state.ctx;
      return;
    }
    for (const ev of list) {
      s.pts.push(...normPoint(ev, canvas));
      drawSegment(state.ctx, s, s.pts.length / 3 - 1, W, H);
    }
  }

  function onUp(e) {
    const s = state.cur;
    if (!s || e.pointerId !== state.pointerId) return;
    const canvas = state.curCanvas;
    const rec = state.curRec;

    if (s.t === 'l') {
      const p = normPoint(e, canvas);
      s.pts[3] = p[0]; s.pts[4] = p[1]; s.pts[5] = p[2];
      playDing();
    }
    if (s.pts.length >= 3) {
      rec.strokes.push(s);
      rec.redo = [];
      scheduleSave(rec);
    }

    state.cur = null;
    state.curRec = null;
    state.curCanvas = null;
    state.pointerId = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    renderBox(canvas);
  }

  /* ================= Undo / redo / clear ================= */

  function undo() {
    const canvas = state.activeCanvas;
    if (!canvas) return;
    const rec = recordFor(canvas);
    if (!rec.strokes.length) return;
    rec.redo.push(rec.strokes.pop());
    scheduleSave(rec);
    renderBox(canvas);
  }

  function redo() {
    const canvas = state.activeCanvas;
    if (!canvas) return;
    const rec = recordFor(canvas);
    if (!rec.redo.length) return;
    rec.strokes.push(rec.redo.pop());
    scheduleSave(rec);
    renderBox(canvas);
  }

  function clearInk() {
    const canvas = state.activeCanvas;
    if (!canvas) return;
    const rec = recordFor(canvas);
    rec.strokes = [];
    rec.redo = [];
    saveNow(rec);
    renderBox(canvas);
  }

  /* ================= Sound ================= */

  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!state.audioCtx && AC) state.audioCtx = new AC();
    if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
  }

  function noiseBurst(dur, freq, type, vol) {
    const ac = state.audioCtx;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 3) * 0.8;
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    src.buffer = buf;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + dur);
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  }

  function playPen() {
    if (!state.soundOn || !state.audioCtx) return;
    noiseBurst(0.06, 800, 'lowpass', 0.05);
  }

  function playEraser() {
    if (!state.soundOn || !state.audioCtx) return;
    noiseBurst(0.1, 400, 'bandpass', 0.04);
  }

  function playDing() {
    if (!state.soundOn || !state.audioCtx) return;
    const ac = state.audioCtx;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ac.currentTime);
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.25);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.25);
  }

  /* ================= Settings ================= */

  function loadSettings() {
    try {
      const d = JSON.parse(localStorage.getItem(CFG.uiKey) || 'null');
      if (d) {
        state.penType = d.penType || state.penType;
        state.color = d.color || state.color;
        state.size = d.size || state.size;
        stackPos = d.pos || null;
      }
      state.soundOn = localStorage.getItem(CFG.soundKey) === 'true';
    } catch (e) {}
    if (!stackPos) stackPos = { x: window.innerWidth - 66, y: window.innerHeight * 0.42 };
  }

  function saveSettings() {
    try {
      localStorage.setItem(CFG.uiKey, JSON.stringify({
        penType: state.penType, color: state.color, size: state.size, pos: stackPos
      }));
      localStorage.setItem(CFG.soundKey, String(state.soundOn));
    } catch (e) {}
  }

  /* ================= Stickers (saved per page) ================= */

  const stickerList = [];
  const stickerKey = () => CFG.stickerPrefix + pagePart;

  function saveStickers() {
    try { localStorage.setItem(stickerKey(), JSON.stringify(stickerList)); } catch (e) {}
  }

  function loadStickers() {
    try {
      const raw = localStorage.getItem(stickerKey());
      if (raw) JSON.parse(raw).forEach(s => stickerList.push(s));
    } catch (e) {}
    stickerList.forEach(renderSticker);
  }

  function placeEl(el, st) {
    el.style.left = (st.x * window.innerWidth) + 'px';
    el.style.top = (st.y * window.innerHeight) + 'px';
  }

  function repositionStickers() {
    document.querySelectorAll('.pen-sticker').forEach(el => {
      const st = el._st;
      if (st) placeEl(el, st);
    });
  }

  function placeSticker(em) {
    const st = { em, x: 0.42, y: 0.38, s: 32 };
    stickerList.push(st);
    renderSticker(st);
    saveStickers();
  }

  function renderSticker(st) {
    const el = document.createElement('div');
    el._st = st;
    el.className = 'pen-sticker';
    el.textContent = st.em;
    el.style.fontSize = st.s + 'px';
    el.style.position = 'fixed';
    placeEl(el, st);
    document.body.appendChild(el);

    let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;

    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.st-ctrl')) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      ox = st.x * window.innerWidth; oy = st.y * window.innerHeight;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) moved = true;
      st.x = clamp((ox + e.clientX - sx) / window.innerWidth, 0, 0.95);
      st.y = clamp((oy + e.clientY - sy) / window.innerHeight, 0, 0.95);
      placeEl(el, st);
    });
    el.addEventListener('pointerup', () => {
      if (dragging && moved) saveStickers();
      dragging = false;
    });
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (moved) return;
      toggleStickerControls(el, st);
    });
  }

  function toggleStickerControls(el, st) {
    const existing = el.querySelector('.st-ctrl');
    if (existing) { existing.remove(); return; }
    document.querySelectorAll('.st-ctrl').forEach(c => c.remove());

    const ctrl = document.createElement('div');
    ctrl.className = 'st-ctrl';
    ctrl.innerHTML = '<button type="button" data-a="big">+</button>' +
                     '<button type="button" data-a="small">−</button>' +
                     '<button type="button" data-a="close">✕</button>' +
                     '<button type="button" class="del" data-a="del">🗑</button>';
    ctrl.addEventListener('pointerdown', e => e.stopPropagation());
    ctrl.addEventListener('click', e => {
      e.stopPropagation();
      const a = e.target.dataset.a;
      if (a === 'big') { st.s = Math.min(96, st.s + 6); el.style.fontSize = st.s + 'px'; saveStickers(); }
      else if (a === 'small') { st.s = Math.max(16, st.s - 6); el.style.fontSize = st.s + 'px'; saveStickers(); }
      else if (a === 'close') { ctrl.remove(); }
      else if (a === 'del') {
        const i = stickerList.indexOf(st);
        if (i >= 0) stickerList.splice(i, 1);
        el.remove();
        saveStickers();
      }
    });
    el.appendChild(ctrl);
  }

  /* ================= Bubbles, tool bar and UI ================= */

  let movedStack = false;
  let longFired = false;
  let clearArmed = false;
  let clearTimer = null;

  function buildCSS() {
    const css = document.createElement('style');
    css.textContent = `
      #penBubble,#eraserBubble{position:fixed;z-index:50;width:56px;height:56px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;
        box-shadow:0 8px 24px rgba(0,0,0,.35);background:linear-gradient(135deg,#5A3C22,#8B5A2B);transition:transform .15s}
      #eraserBubble{background:linear-gradient(135deg,#6B7280,#9CA3AF)}
      #penBubble.on,#eraserBubble.on{box-shadow:0 0 0 3px #FEF3C7,0 8px 24px rgba(0,0,0,.35)}
      #penBubble:active,#eraserBubble:active{transform:scale(.95)}
      #penBubble span,#eraserBubble span{font-size:24px}
      #penBar{position:fixed;z-index:51;display:flex;gap:6px;align-items:center;flex-wrap:wrap;
        max-width:calc(100vw - 16px);padding:8px;background:rgba(255,255,255,.98);border:2px solid #E7D5B0;
        border-radius:18px;box-shadow:0 16px 40px rgba(0,0,0,.22);opacity:0;transform:scale(.92);
        pointer-events:none;transition:all .2s}
      #penBar.open{opacity:1;transform:none;pointer-events:auto}
      .pen-btn{position:relative;width:38px;height:38px;border-radius:10px;border:2px solid #E7D5B0;background:#fff;
        display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;user-select:none}
      .pen-btn.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-pop{position:absolute;bottom:46px;left:50%;transform:translateX(-50%) scale(.92);opacity:0;
        pointer-events:none;transition:all .18s;background:#fff;border:2px solid #E7D5B0;border-radius:14px;
        padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap;z-index:52}
      .pen-pop.open{opacity:1;transform:translateX(-50%) scale(1);pointer-events:auto}
      .pen-pop.wide{width:250px;white-space:normal}
      .pen-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
      .pen-mini{width:34px;height:34px;border-radius:8px;border:2px solid #E7D5B0;background:#fff;
        display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer}
      .pen-mini.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-dot{width:28px;height:28px;border-radius:50%;cursor:pointer;border:3px solid #fff;box-shadow:0 0 0 2px #E7D5B0}
      .pen-dot.on{box-shadow:0 0 0 2px #8B5A2B;transform:scale(1.1)}
      .pen-tab{padding:4px 8px;border-radius:8px;border:2px solid #E7D5B0;background:#fff;font-size:.75rem;font-weight:700;cursor:pointer}
      .pen-tab.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-lab{font-size:.65rem;font-weight:800}
      #stampGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:6px}
      #stampGrid .pen-mini{font-size:20px}
      #penSound{position:fixed;top:44%;left:10px;z-index:50;width:40px;height:40px;border-radius:50%;background:#fff;
        border:2px solid #8B5A2B;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;
        box-shadow:0 4px 12px rgba(0,0,0,.15)}
      .pen-sticker{position:fixed;z-index:40;user-select:none;touch-action:none;cursor:grab;line-height:1;
        filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))}
      .st-ctrl{position:absolute;top:-42px;left:50%;transform:translateX(-50%);display:flex;gap:4px;
        background:rgba(255,255,255,.96);border:2px solid #8B5A2B;border-radius:12px;padding:3px 5px;white-space:nowrap}
      .st-ctrl button{width:28px;height:28px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff;font-size:15px;cursor:pointer}
      .st-ctrl .del{background:#DC2626;color:#fff;border-color:#991B1B}
      canvas[data-pen="true"]{touch-action:none !important}
    `;
    document.head.appendChild(css);
  }

  function buildUI() {
    if ($('penBubble')) return;
    buildCSS();

    document.body.insertAdjacentHTML('beforeend', `
      <div id="penBubble"><span>✏️</span></div>
      <div id="eraserBubble"><span>🧽</span></div>
      <div id="penBar">
        <div class="pen-btn" data-act="pen">✏️
          <div class="pen-pop" id="penPop">
            <div class="pen-row">
              <div class="pen-mini" data-type="normal">✏️</div>
              <div class="pen-mini" data-type="rainbow">🌈</div>
              <div class="pen-mini" data-type="glitter">✨</div>
              <div class="pen-mini" data-type="qalam">🪶</div>
            </div>
            <div class="pen-row">
              <span class="pen-lab">Size</span>
              <input type="range" min="1" max="8" step="0.5" id="penSize" style="width:100px;accent-color:#8B5A2B">
              <span class="pen-lab" id="penSizeLab"></span>
            </div>
          </div>
        </div>
        <div class="pen-btn" data-act="undo">↩️</div>
        <div class="pen-btn" data-act="redo">↪️</div>
        <div class="pen-btn" data-act="clear" id="clearBtn" title="Tap twice to clear">🗑️</div>
        <div class="pen-btn" data-act="color">🎨
          <div class="pen-pop" id="colorPop"><div class="pen-row">${CFG.colors.map(c =>
            `<div class="pen-dot" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>
        </div>
        <div class="pen-btn" data-act="stamp">⭐
          <div class="pen-pop wide" id="stampPop">
            <div class="pen-row">
              <div class="pen-tab on" data-tab="stamps">Stamps</div>
              <div class="pen-tab" data-tab="stickers">Stickers</div>
              <div class="pen-tab" data-tab="line">📏 Line</div>
            </div>
            <div id="stampGrid"></div>
          </div>
        </div>
      </div>
      <div id="penSound">${state.soundOn ? '🔊' : '🔇'}</div>
    `);

    const pb = $('penBubble'), eb = $('eraserBubble'), bar = $('penBar');

    dragStack(pb, true);
    dragStack(eb, false);

    pb.addEventListener('click', () => {
      if (movedStack || longFired) { longFired = false; return; }
      setTool('pen');
      toggleBar();
    });
    eb.addEventListener('click', () => {
      if (movedStack) return;
      setTool('eraser');
      closeBar();
    });

    bar.addEventListener('click', e => {
      e.stopPropagation();
      const t = e.target;

      const ty = t.closest('[data-type]');
      if (ty) { state.penType = ty.dataset.type; setTool('pen'); return; }

      const tab = t.closest('[data-tab]');
      if (tab) { handleTab(tab); return; }

      const dot = t.closest('[data-c]');
      if (dot) { state.color = dot.dataset.c; setTool('pen'); closePops(); return; }

      const em = t.closest('[data-em]');
      if (em) { placeSticker(em.dataset.em); closePops(); return; }

      if (t.closest('.pen-pop')) return;           // clicks inside a popover (e.g. the slider)

      const act = t.closest('[data-act]');
      if (!act) return;
      switch (act.dataset.act) {
        case 'pen': setTool('pen'); togglePop('penPop'); break;
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'clear': clearTap(); break;
        case 'color': togglePop('colorPop'); break;
        case 'stamp': togglePop('stampPop'); break;
      }
    });

    $('penSize').addEventListener('input', e => {
      state.size = parseFloat(e.target.value);
      saveSettings();
      updateUI();
    });

    $('penSound').addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      $('penSound').textContent = state.soundOn ? '🔊' : '🔇';
      saveSettings();
      if (state.soundOn) initAudio();
    });

    document.addEventListener('click', e => {
      if (bar.contains(e.target) || pb.contains(e.target) || eb.contains(e.target)) return;
      closeBar();
    });

    placeStack();
    updateUI();
  }

  function setTool(t) {
    state.tool = t;
    saveSettings();
    updateUI();
  }

  function toggleBar() {
    const bar = $('penBar');
    const open = !bar.classList.contains('open');
    bar.classList.toggle('open', open);
    if (open) positionBar();
    else closePops();
  }

  function closeBar() {
    $('penBar').classList.remove('open');
    closePops();
  }

  function closePops() {
    document.querySelectorAll('.pen-pop').forEach(p => p.classList.remove('open'));
  }

  function togglePop(id) {
    const p = $(id);
    const wasOpen = p.classList.contains('open');
    closePops();
    if (!wasOpen) p.classList.add('open');
  }

  function handleTab(tab) {
    document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === tab));
    const name = tab.dataset.tab;
    if (name === 'line') {
      setTool('line');
      closeBar();
      return;
    }
    const list = name === 'stickers' ? CFG.stickers : CFG.stamps;
    $('stampGrid').innerHTML = list.map(s => `<div class="pen-mini" data-em="${s}">${s}</div>`).join('');
  }

  function clearTap() {
    const b = $('clearBtn');
    if (!clearArmed) {
      clearArmed = true;
      b.textContent = '✅';
      clearTimer = setTimeout(() => { clearArmed = false; b.textContent = '🗑️'; }, 2500);
      return;
    }
    clearTimeout(clearTimer);
    clearArmed = false;
    b.textContent = '🗑️';
    clearInk();
  }

  function updateUI() {
    const pb = $('penBubble'), eb = $('eraserBubble');
    if (pb) pb.classList.toggle('on', state.tool !== 'eraser');
    if (eb) eb.classList.toggle('on', state.tool === 'eraser');
    const bar = $('penBar');
    if (!bar) return;
    bar.querySelector('[data-act="pen"]').classList.toggle('on', state.tool === 'pen');
    bar.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x.dataset.type === state.penType));
    bar.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === state.color));
    const sl = $('penSize');
    sl.value = state.size;
    $('penSizeLab').textContent = state.size;
  }

  function placeStack() {
    const pb = $('penBubble'), eb = $('eraserBubble');
    if (!pb || !eb) return;
    pb.style.left = stackPos.x + 'px';
    pb.style.top = stackPos.y + 'px';
    eb.style.left = stackPos.x + 'px';
    eb.style.top = (stackPos.y + 64) + 'px';
    if ($('penBar').classList.contains('open')) positionBar();
  }

  function positionBar() {
    const pb = $('penBubble'), bar = $('penBar');
    const r = pb.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    let left = r.left - br.width - 8;
    if (left < 8) left = Math.min(window.innerWidth - br.width - 8, r.right + 8);
    bar.style.left = Math.max(8, left) + 'px';
    bar.style.top = clamp(r.top - 8, 8, window.innerHeight - br.height - 8) + 'px';
  }

  // Dragging the pen bubble moves the whole stack (pen + eraser).
  function dragStack(el, isPen) {
    let lp = null, sx = 0, sy = 0, ox = 0, oy = 0;
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.stopPropagation();
      movedStack = false;
      longFired = false;
      sx = e.clientX; sy = e.clientY;
      ox = stackPos.x; oy = stackPos.y;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}

      if (isPen) {
        lp = setTimeout(() => {
          if (movedStack) return;
          longFired = true;
          setTool(state.tool === 'eraser' ? 'pen' : 'eraser');
          closeBar();
          if (navigator.vibrate) navigator.vibrate(40);
        }, 550);
      }

      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!movedStack && Math.abs(dx) + Math.abs(dy) > 8) {
          movedStack = true;
          clearTimeout(lp);
        }
        if (!movedStack) return;
        stackPos.x = clamp(ox + dx, 4, window.innerWidth - 60);
        stackPos.y = clamp(oy + dy, 4, window.innerHeight - 130);
        placeStack();
      };
      const up = () => {
        clearTimeout(lp);
        el.removeEventListener('pointermove', mv);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (movedStack) saveSettings();
      };
      el.addEventListener('pointermove', mv);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }

  /* ================= Public API & start-up ================= */

  window.UniversalPen = {
    state,
    forceCanvas,
    setInkKey,
    clearInk,
    saveInk: flushAll,
    undo,
    redo,
    playDing,
    initAudio,
    saveState: saveSettings,
    renderAll
  };

  function init() {
    loadSettings();
    buildUI();
    loadStickers();

    document.addEventListener('pointerdown', onDown, { passive: false });
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll();
    });
    window.addEventListener('pagehide', flushAll);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderAll();
        placeStack();
        repositionStickers();
      }, 150);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
