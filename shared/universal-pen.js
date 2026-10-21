/** Universal Pen v1.8 - dual bubbles, movable stickers */
console.log('loaded');/**
 * Universal Pen + Line Tool  v1.7
 * Dual bubbles (Pen + Eraser) + Line moved to Stamps panel
 * Samsung S9 / S11 ready
 * + Automatic ink save / load (survives browser close)
 * + Per-section / per-mode isolation (no duplicate ink)
 */
(function () {
  'use strict';

  const CFG = {
    colors: ['#0F172A', '#2563EB', '#15803D', '#DC2626', '#7C3AED'],
    stamps: ['⭐', '😡', '❤️', '😊', '😢', '🌸', '♻️', '🌍', '✅', '❌', '💯', '❄️'],
    stickers: ['💃', '🔥', '⭐', '🌹', '🧐', '🫰', '🌳', '🧹'],
    storageKey: 'LQ_UNIVERSAL_PEN_V16',
    soundKey: 'LQ_PEN_SOUND_V16',
    inkPrefix: 'LQ_INK_V16_',
    maxUndo: 30,
    lineColor: '#8B5A2B',
    lineWidth: 2.5,
    eraserMultiplier: 4,
    minEraserSize: 12,
    saveDebounceMs: 400
  };

  const state = {
    tool: 'pen',
    penType: 'normal',
    color: '#0F172A',
    size: 2.5,
    drawing: false,
    soundOn: false,
    activeCanvas: null,
    ctx: null,
    audioCtx: null,
    undoStack: [],
    redoStack: [],
    rainbowHue: 0,
    isScrolling: false,
    points: [],
    longPressTimer: null,
    lineStart: null,
    pointerId: null,
    // Ink persistence
    currentInkKey: null,
    saveTimer: null,
    inkLoadedFor: null
  };

  // ---------- Persistence (tool settings) ----------
  function loadState() {
    try {
      const s = localStorage.getItem(CFG.storageKey);
      if (s) Object.assign(state, JSON.parse(s));
      state.soundOn = localStorage.getItem(CFG.soundKey) === 'true';
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify({
        tool: state.tool,
        penType: state.penType,
        color: state.color,
        size: state.size
      }));
      localStorage.setItem(CFG.soundKey, String(state.soundOn));
    } catch (e) {}
  }

  // ---------- Ink key helpers ----------
  /**
   * Build a unique storage key for the current canvas + mode.
   * Priority:
   *  1. Explicit key set by UniversalPen.setInkKey('write')
   *  2. canvas[data-ink-key]
   *  3. canvas.id
   *  4. 'default'
   * Always prefixed with page path so different lessons never clash.
   */
  function buildInkKey(canvas) {
    if (!canvas) return null;

    const pagePart = (location.pathname || 'page')
      .replace(/^\//, '')
      .replace(/\.html?$/i, '')
      .replace(/[^a-z0-9_-]/gi, '_') || 'page';

    let sectionPart = 'default';
    if (state.currentInkKey) {
      sectionPart = state.currentInkKey;
    } else if (canvas.dataset && canvas.dataset.inkKey) {
      sectionPart = canvas.dataset.inkKey;
    } else if (canvas.id) {
      sectionPart = canvas.id;
    }

    return CFG.inkPrefix + pagePart + '__' + sectionPart;
  }

  function saveInkNow() {
    if (!state.activeCanvas) return;
    const key = buildInkKey(state.activeCanvas);
    if (!key) return;
    try {
      const data = state.activeCanvas.toDataURL('image/png');
      localStorage.setItem(key, data);
    } catch (e) {
      // Storage full – silent fail (safe-storage in the hub can help later)
    }
  }

  function scheduleSaveInk() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveInkNow, CFG.saveDebounceMs);
  }

  function loadInkFor(canvas) {
    if (!canvas) return;
    const key = buildInkKey(canvas);
    if (!key) return;

    // Already loaded this exact key for this canvas → skip
    if (state.inkLoadedFor === key && state.activeCanvas === canvas) return;

    const data = localStorage.getItem(key);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset undo for this canvas/mode
    state.undoStack = [];
    state.redoStack = [];

    if (!data) {
      // Empty – just store a blank snapshot
      try {
        state.undoStack.push(canvas.toDataURL('image/png'));
      } catch (e) {}
      state.inkLoadedFor = key;
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      try {
        state.undoStack.push(canvas.toDataURL('image/png'));
      } catch (e) {}
      state.inkLoadedFor = key;
    };
    img.onerror = () => {
      state.inkLoadedFor = key;
    };
    img.src = data;
  }

  function clearSavedInk() {
    if (!state.activeCanvas) return;
    const key = buildInkKey(state.activeCanvas);
    if (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  }

  // ---------- Audio ----------
  function initAudio() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playPen() {
    if (!state.soundOn || !state.audioCtx) return;
    const len = state.audioCtx.sampleRate * 0.06;
    const buffer = state.audioCtx.createBuffer(1, len, state.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / data.length * 3) * 0.8;
    }
    const noise = state.audioCtx.createBufferSource();
    const filter = state.audioCtx.createBiquadFilter();
    const gain = state.audioCtx.createGain();
    noise.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.setValueAtTime(0.05, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.06);
    noise.connect(filter).connect(gain).connect(state.audioCtx.destination);
    noise.start();
  }

  function playEraser() {
    if (!state.soundOn || !state.audioCtx) return;
    const len = state.audioCtx.sampleRate * 0.1;
    const buffer = state.audioCtx.createBuffer(1, len, state.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
    const noise = state.audioCtx.createBufferSource();
    const filter = state.audioCtx.createBiquadFilter();
    const gain = state.audioCtx.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0.04, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.1);
    noise.connect(filter).connect(gain).connect(state.audioCtx.destination);
    noise.start();
  }

  function playDing() {
    if (!state.soundOn || !state.audioCtx) return;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, state.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.25);
    osc.connect(gain).connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.25);
  }

  // ---------- Public API ----------
  window.UniversalPen = {
    state,
    saveState,
    playDing,
    initAudio,

    /** Force a canvas and load its ink */
    forceCanvas: (canvas) => {
      if (canvas && canvas.tagName === 'CANVAS') {
        state.activeCanvas = canvas;
        state.ctx = canvas.getContext('2d');
        canvas.style.touchAction = 'none';
        canvas.dataset.pen = 'true';
        loadInkFor(canvas);
      }
    },

    /**
     * Change the ink “bucket” for the current canvas.
     * Use this when switching Write ↔ Practice or Section A ↔ Section B
     * so the drawings stay separate and never duplicate.
     *
     * Example:
     *   UniversalPen.setInkKey('write');
     *   UniversalPen.setInkKey('practice');
     *   UniversalPen.setInkKey('section-2');
     */
    setInkKey: (key) => {
      // Save whatever is currently on the canvas before switching
      if (state.activeCanvas) saveInkNow();

      state.currentInkKey = key ? String(key) : null;
      state.inkLoadedFor = null; // force reload

      if (state.activeCanvas) {
        loadInkFor(state.activeCanvas);
      }
    },

    /** Manually save right now */
    saveInk: saveInkNow,

    /** Clear the saved ink for the current key (and the canvas) */
    clearInk: () => {
      if (!state.ctx || !state.activeCanvas) return;
      state.ctx.globalCompositeOperation = 'source-over';
      state.ctx.clearRect(0, 0, state.activeCanvas.width, state.activeCanvas.height);
      state.undoStack = [];
      state.redoStack = [];
      clearSavedInk();
      try {
        state.undoStack.push(state.activeCanvas.toDataURL('image/png'));
      } catch (e) {}
    }
  };

  // ---------- UI ----------
  function buildUI() {
    if (document.getElementById('penBubble')) return;

    const css = document.createElement('style');
    css.textContent = `
      #penBubble,#eraserBubble{position:fixed;z-index:50;width:56px;height:56px;border-radius:50%;
        background:linear-gradient(135deg,#5A3C22,#8B5A2B);box-shadow:0 8px 24px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;transition:transform .15s}
      #penBubble{bottom:90px;right:14px}
      #eraserBubble{bottom:90px;right:78px;background:linear-gradient(135deg,#6B7280,#9CA3AF)}
      #penBubble.on,#eraserBubble.on{box-shadow:0 0 0 3px #FEF3C7, 0 8px 24px rgba(0,0,0,.35)}
      #penBubble:active,#eraserBubble:active{transform:scale(.95)}
      #penBar{position:fixed;z-index:51;background:rgba(255,255,255,.98);border:2px solid #E7D5B0;border-radius:18px;
        padding:8px;box-shadow:0 16px 40px rgba(0,0,0,.22);transform:scale(.9);opacity:0;pointer-events:none;
        transition:all .25s;display:flex;gap:6px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px)}
      #penBar.open{transform:scale(1);opacity:1;pointer-events:auto}
      .pen-btn{width:36px;height:36px;border-radius:10px;border:2px solid #E7D5B0;background:#fff;
        display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:.15s;position:relative}
      .pen-btn.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-btn:active{transform:scale(.9)}
      .pen-pop{position:absolute;bottom:46px;left:50%;transform:translateX(-50%) scale(.9);opacity:0;pointer-events:none;
        transition:all .2s;background:rgba(255,255,255,.98);border:2px solid #E7D5B0;border-radius:14px;padding:8px;
        box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap;z-index:52}
      .pen-pop.open{transform:translateX(-50%) scale(1);opacity:1;pointer-events:auto}
      .pen-pop-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
      .pen-pop-row:last-child{margin-bottom:0}
      .pen-mini{width:32px;height:32px;border-radius:8px;border:2px solid #E7D5B0;background:#fff;
        display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px}
      .pen-mini.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-dot{width:28px;height:28px;border-radius:50%;cursor:pointer;border:3px solid #fff;box-shadow:0 0 0 2px #E7D5B0;transition:.15s}
      .pen-dot.on{box-shadow:0 0 0 2px #8B5A2B;transform:scale(1.1)}
      .pen-tab{padding:4px 10px;border-radius:8px;border:2px solid #E7D5B0;background:#fff;cursor:pointer;font-size:.75rem;font-weight:700}
      .pen-tab.on{background:#FEF3C7;border-color:#8B5A2B}
      #penSound{position:fixed;bottom:18px;left:14px;z-index:50;width:44px;height:44px;border-radius:50%;
        background:#fff;border:2px solid #8B5A2B;display:flex;align-items:center;justify-content:center;
        cursor:pointer;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.15);touch-action:none}
      .pen-sticker{position:fixed;font-size:32px;cursor:grab;z-index:15;user-select:none;touch-action:none;
        filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))}
      .pen-sticker.sel{outline:2px dashed #8B5A2B;outline-offset:4px}
      canvas[data-pen="true"]{touch-action:none !important}
    `;
    document.head.appendChild(css);

    const bubble = document.createElement('div');
    bubble.id = 'penBubble';
    bubble.innerHTML = '<span style="font-size:24px">✏️</span>';

    const eraserBubble = document.createElement('div');
    eraserBubble.id = 'eraserBubble';
    eraserBubble.innerHTML = '<span style="font-size:22px">🧽</span>';

    const bar = document.createElement('div');
    bar.id = 'penBar';
    bar.innerHTML = `
      <div class="pen-btn on" data-tool="pen" style="position:relative">
        ✏️
        <div class="pen-pop" id="penPop">
          <div class="pen-pop-row">
            <div class="pen-mini on" data-type="normal">✏️</div>
            <div class="pen-mini" data-type="cursive">🖋️</div>
            <div class="pen-mini" data-type="rainbow">🌈</div>
            <div class="pen-mini" data-type="glitter">✨</div>
          </div>
          <div class="pen-pop-row">
            <span style="font-size:.65rem;font-weight:800">Size</span>
            <input type="range" min="1" max="8" step="0.5" value="${state.size}" id="penSize"
                   style="width:100px;accent-color:#8B5A2B"/>
            <span id="penSizeLab" style="font-size:.65rem;font-weight:800;min-width:24px">${state.size}</span>
          </div>
        </div>
      </div>
      <div class="pen-btn" data-act="undo">↩️</div>
      <div class="pen-btn" data-act="redo">↪️</div>
      <div class="pen-btn" data-act="clear">🗑️</div>
      <div class="pen-btn" style="position:relative">
        🎨
        <div class="pen-pop" id="colorPop">
          <div class="pen-pop-row" id="colorRow"></div>
        </div>
      </div>
      <div class="pen-btn" style="position:relative">
        ⭐
        <div class="pen-pop" id="stampPop" style="width:240px">
          <div class="pen-pop-row">
            <div class="pen-tab on" data-tab="stamps">Stamps</div>
            <div class="pen-tab" data-tab="stickers">Stickers</div>
            <div class="pen-tab" data-tab="line">📏 Line</div>
          </div>
          <div id="stampGrid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:6px"></div>
        </div>
      </div>
    `;

    const sound = document.createElement('div');
    sound.id = 'penSound';
    sound.textContent = state.soundOn ? '🔊' : '🔇';

    document.body.appendChild(bubble);
    document.body.appendChild(eraserBubble);
    document.body.appendChild(bar);
    document.body.appendChild(sound);

    const colorRow = document.getElementById('colorRow');
    CFG.colors.forEach(c => {
      const d = document.createElement('div');
      d.className = 'pen-dot' + (c === state.color ? ' on' : '');
      d.style.background = c;
      d.onclick = () => {
        state.color = c;
        saveState();
        updateUI();
        closePops();
      };
      colorRow.appendChild(d);
    });

    const stampGrid = document.getElementById('stampGrid');
    function renderStamps() {
      stampGrid.innerHTML = '';
      CFG.stamps.forEach(s => {
        const b = document.createElement('div');
        b.className = 'pen-mini';
        b.textContent = s;
        b.style.fontSize = '20px';
        b.onclick = () => { placeStamp(s); closePops(); };
        stampGrid.appendChild(b);
      });
    }
    function renderStickers() {
      stampGrid.innerHTML = '';
      CFG.stickers.forEach(s => {
        const b = document.createElement('div');
        b.className = 'pen-mini';
        b.textContent = s;
        b.style.fontSize = '20px';
        b.onclick = () => { placeSticker(s); closePops(); };
        stampGrid.appendChild(b);
      });
    }
    renderStamps();

    attachEvents(bubble, bar, sound, renderStamps, renderStickers);
    makeDraggable(bubble, bar);
    const eraserBubbleEl = document.getElementById('eraserBubble');
    if (eraserBubbleEl) makeDraggable(eraserBubbleEl, bar);
    updateUI();
  }

  function closePops() {
    document.querySelectorAll('.pen-pop').forEach(p => p.classList.remove('open'));
  }

  function updateUI() {
    const penB = document.getElementById('penBubble');
    const erB = document.getElementById('eraserBubble');
    if (penB) penB.classList.toggle('on', state.tool === 'pen');
    if (erB) erB.classList.toggle('on', state.tool === 'eraser');
    document.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === state.tool);
    });
    document.querySelectorAll('[data-type]').forEach(b => {
      b.classList.toggle('on', b.dataset.type === state.penType);
    });
    document.querySelectorAll('.pen-dot').forEach((d, i) => {
      d.classList.toggle('on', CFG.colors[i] === state.color);
    });
  }

  function positionBar(bubble, bar) {
    const rect = bubble.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const isTop = rect.top < window.innerHeight / 2;
    if (isTop) {
      bar.style.top = (rect.bottom + 8) + 'px';
      bar.style.bottom = 'auto';
    } else {
      bar.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      bar.style.top = 'auto';
    }
    bar.style.left = Math.max(8, Math.min(window.innerWidth - barRect.width - 8,
      rect.left + rect.width / 2 - barRect.width / 2)) + 'px';
  }

  function attachEvents(bubble, bar, sound, renderStamps, renderStickers) {
    const eraserBubble = document.getElementById('eraserBubble');
    let barOpen = false;

    bubble.addEventListener('click', e => {
      e.stopPropagation();
      state.tool = 'pen';
      saveState();
      updateUI();
      barOpen = !barOpen;
      bar.classList.toggle('open', barOpen);
      if (barOpen) positionBar(bubble, bar);
      closePops();
    });

    if (eraserBubble) {
      eraserBubble.addEventListener('click', e => {
        e.stopPropagation();
        state.tool = 'eraser';
        saveState();
        updateUI();
        bar.classList.remove('open');
        barOpen = false;
        closePops();
      });
    }

    bubble.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && e.width > 25) return;
      state.longPressTimer = setTimeout(() => {
        state.tool = state.tool === 'eraser' ? 'pen' : 'eraser';
        saveState();
        updateUI();
        if (navigator.vibrate) navigator.vibrate(40);
      }, 550);
    });
    bubble.addEventListener('pointerup', () => clearTimeout(state.longPressTimer));
    bubble.addEventListener('pointerleave', () => clearTimeout(state.longPressTimer));
    bubble.addEventListener('pointercancel', () => clearTimeout(state.longPressTimer));

    sound.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      sound.textContent = state.soundOn ? '🔊' : '🔇';
      saveState();
      if (state.soundOn) {
        initAudio();
        if (state.audioCtx && state.audioCtx.state === 'suspended') {
          state.audioCtx.resume();
        }
      }
    });

    document.addEventListener('click', e => {
      if (!bar.contains(e.target) && !bubble.contains(e.target)) {
        bar.classList.remove('open');
        barOpen = false;
        closePops();
      }
    });

    bar.querySelectorAll('[data-tool]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        state.tool = b.dataset.tool;
        saveState();
        updateUI();
        closePops();
      });
    });

    bar.querySelector('[data-tool="pen"]').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('penPop').classList.toggle('open');
    });

    bar.querySelectorAll('[data-type]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        state.penType = b.dataset.type;
        state.tool = 'pen';
        saveState();
        updateUI();
      });
    });

    document.getElementById('penSize').addEventListener('input', e => {
      state.size = parseFloat(e.target.value);
      document.getElementById('penSizeLab').textContent = state.size;
      saveState();
    });

    // Color palette
    const colorBtn = bar.querySelector('#colorPop')?.parentElement;
    if (colorBtn) {
      colorBtn.addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('colorPop').classList.toggle('open');
      });
    }

    // Stamps / Stickers / Line
    const stampBtn = bar.querySelector('#stampPop')?.parentElement;
    if (stampBtn) {
      stampBtn.addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('stampPop').classList.toggle('open');
      });
    }

    bar.querySelectorAll('.pen-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        e.stopPropagation();
        bar.querySelectorAll('.pen-tab').forEach(t => t.classList.remove('on'));
        tab.classList.add('on');
        if (tab.dataset.tab === 'stamps') renderStamps();
        else if (tab.dataset.tab === 'stickers') renderStickers();
        else if (tab.dataset.tab === 'line') {
          state.tool = 'line';
          saveState();
          updateUI();
          closePops();
          bar.classList.remove('open');
          barOpen = false;
        }
      });
    });

    bar.querySelector('[data-act="undo"]').addEventListener('click', e => {
      e.stopPropagation();
      undo();
    });
    bar.querySelector('[data-act="redo"]').addEventListener('click', e => {
      e.stopPropagation();
      redo();
    });
    bar.querySelector('[data-act="clear"]').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Clear all drawings?')) clearCanvas();
    });
  }

  function makeDraggable(el, bar) {
    let pos = { x: 0, y: 0 };
    let moved = false;

    el.addEventListener('pointerdown', e => {
      if (e.target !== el && !el.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      pos = { x: e.clientX, y: e.clientY };
      moved = false;
      el.setPointerCapture(e.pointerId);

      const penB = document.getElementById('penBubble');
      const erB = document.getElementById('eraserBubble');

      const move = ev => {
        if (Math.abs(ev.clientX - pos.x) > 6 || Math.abs(ev.clientY - pos.y) > 6) {
          moved = true;
          clearTimeout(state.longPressTimer);
        }
        const dx = ev.clientX - pos.x;
        const dy = ev.clientY - pos.y;
        [penB, erB].forEach(b => {
          if (!b) return;
          b.style.left = (b.offsetLeft + dx) + 'px';
          b.style.top = (b.offsetTop + dy) + 'px';
          b.style.bottom = b.style.right = 'auto';
        });
        pos = { x: ev.clientX, y: ev.clientY };
        if (bar.classList.contains('open')) positionBar(penB || el, bar);
      };

      const up = () => {
        el.releasePointerCapture(e.pointerId);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        if (moved) clearTimeout(state.longPressTimer);
      };

      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
  }

  // ---------- Drawing helpers ----------
  function getPos(e, canvas) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY
    };
  }

  function isPalm(e) {
    // Slightly softer so stylus + light finger still work on Samsung tabs
    return e.pointerType === 'touch' && (e.width > 36 || e.height > 36);
  }

  function getCurrentLineWidth() {
    if (state.tool === 'eraser') {
      return Math.max(CFG.minEraserSize, state.size * CFG.eraserMultiplier);
    }
    if (state.penType === 'cursive') return state.size * 0.7;
    return state.size;
  }

  function ensureInitialUndo() {
    if (!state.activeCanvas || state.undoStack.length > 0) return;
    try {
      state.undoStack.push(state.activeCanvas.toDataURL('image/png'));
    } catch (e) {}
  }

  function pushUndo() {
    if (!state.activeCanvas) return;
    try {
      const data = state.activeCanvas.toDataURL('image/png');
      if (state.undoStack.length && state.undoStack[state.undoStack.length - 1] === data) return;
      state.undoStack.push(data);
      if (state.undoStack.length > CFG.maxUndo) state.undoStack.shift();
      state.redoStack = [];
    } catch (e) {}
  }

  function restoreFromDataURL(dataUrl) {
    return new Promise((resolve) => {
      if (!state.ctx || !state.activeCanvas) {
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => {
        state.ctx.globalCompositeOperation = 'source-over';
        state.ctx.clearRect(0, 0, state.activeCanvas.width, state.activeCanvas.height);
        state.ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataUrl;
    });
  }

  // ---------- Core drawing ----------
  function startDraw(e) {
    if (state.isScrolling) return;
    if (isPalm(e)) return;

    const canvas = e.target.closest('canvas');
    if (!canvas) return;

    // Activate + load ink if this is a new canvas / new key
    state.activeCanvas = canvas;
    state.ctx = canvas.getContext('2d');
    canvas.dataset.pen = 'true';
    canvas.style.touchAction = 'none';
    loadInkFor(canvas);
    ensureInitialUndo();
    // Guarantee a baseline snapshot before the first stroke
    if (state.undoStack.length === 0 && state.activeCanvas) {
      try { state.undoStack.push(state.activeCanvas.toDataURL('image/png')); } catch(e){}
    }

    try {
      canvas.setPointerCapture(e.pointerId);
      state.pointerId = e.pointerId;
    } catch (err) {}

    e.preventDefault();

    // LINE TOOL
    if (state.tool === 'line') {
      const p = getPos(e, canvas);
      state.lineStart = {
        x: p.x, y: p.y, canvas, ctx: state.ctx, snapshot: null
      };
      try {
        state.lineStart.snapshot = state.ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (err) {
        state.lineStart.snapshot = null;
      }
      return;
    }

    // PEN / ERASER
    state.drawing = true;
    state.points = [getPos(e, canvas)];
    state.ctx.beginPath();
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';
    state.ctx.lineWidth = getCurrentLineWidth();

    if (state.tool === 'eraser') {
      state.ctx.globalCompositeOperation = 'destination-out';
      playEraser();
    } else {
      state.ctx.globalCompositeOperation = 'source-over';
      state.ctx.shadowBlur = 0;
      if (state.penType === 'rainbow') {
        state.ctx.strokeStyle = `hsl(${state.rainbowHue},100%,50%)`;
        state.rainbowHue = (state.rainbowHue + 5) % 360;
      } else {
        state.ctx.strokeStyle = state.color;
      }
      playPen();
    }
  }

  function draw(e) {
    if (state.isScrolling) return;
    if (isPalm(e)) return;

    if (state.tool === 'line' && state.lineStart) {
      e.preventDefault();
      const { canvas, ctx, snapshot, x, y } = state.lineStart;
      const end = getPos(e, canvas);
      if (snapshot) ctx.putImageData(snapshot, 0, 0);
      ctx.save();
      ctx.strokeStyle = CFG.lineColor;
      ctx.lineWidth = CFG.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (!state.drawing || !state.ctx) return;
    e.preventDefault();

    const p = getPos(e, state.activeCanvas);
    state.points.push(p);

    if (state.points.length >= 3) {
      const len = state.points.length;
      const xc = (state.points[len - 2].x + p.x) / 2;
      const yc = (state.points[len - 2].y + p.y) / 2;
      state.ctx.quadraticCurveTo(state.points[len - 2].x, state.points[len - 2].y, xc, yc);
      state.ctx.stroke();
      state.ctx.beginPath();
      state.ctx.moveTo(xc, yc);
    } else {
      state.ctx.lineTo(p.x, p.y);
      state.ctx.stroke();
    }

    if (state.tool !== 'eraser' && state.penType === 'glitter' && Math.random() > 0.65) {
      state.ctx.save();
      state.ctx.fillStyle = state.color;
      state.ctx.globalAlpha = 0.55;
      state.ctx.beginPath();
      state.ctx.arc(p.x + (Math.random() - 0.5) * 12, p.y + (Math.random() - 0.5) * 12, 1.2, 0, Math.PI * 2);
      state.ctx.fill();
      state.ctx.restore();
    }

    if (state.tool !== 'eraser' && state.penType === 'rainbow') {
      state.ctx.strokeStyle = `hsl(${state.rainbowHue},100%,50%)`;
      state.rainbowHue = (state.rainbowHue + 5) % 360;
    }
  }

  function endDraw(e) {
    if (state.tool === 'line' && state.lineStart) {
      e.preventDefault();
      const { canvas, ctx, x, y } = state.lineStart;
      const end = getPos(e, canvas);
      ctx.save();
      ctx.strokeStyle = CFG.lineColor;
      ctx.lineWidth = CFG.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
      playDing();
      pushUndo();
      scheduleSaveInk();
      state.lineStart = null;
      return;
    }

    if (!state.drawing) return;
    state.drawing = false;

    if (state.points.length >= 2 && state.ctx) {
      const p = state.points[state.points.length - 1];
      state.ctx.lineTo(p.x, p.y);
      state.ctx.stroke();
    }
    state.points = [];

    if (state.ctx) state.ctx.globalCompositeOperation = 'source-over';

    setTimeout(() => {
      pushUndo();
      scheduleSaveInk();
    }, 16);

    if (state.activeCanvas && state.pointerId != null) {
      try { state.activeCanvas.releasePointerCapture(state.pointerId); } catch (err) {}
      state.pointerId = null;
    }
  }

  // ---------- Undo / Redo / Clear ----------
  async function undo() {
    if (!state.ctx || state.undoStack.length < 2) return;
    const current = state.undoStack.pop();
    state.redoStack.push(current);
    const prev = state.undoStack[state.undoStack.length - 1];
    await restoreFromDataURL(prev);
    scheduleSaveInk();
  }

  async function redo() {
    if (!state.ctx || !state.redoStack.length) return;
    const data = state.redoStack.pop();
    state.undoStack.push(data);
    await restoreFromDataURL(data);
    scheduleSaveInk();
  }

  function clearCanvas() {
    if (!state.ctx || !state.activeCanvas) return;
    pushUndo();
    state.ctx.globalCompositeOperation = 'source-over';
    state.ctx.clearRect(0, 0, state.activeCanvas.width, state.activeCanvas.height);
    clearSavedInk();
    scheduleSaveInk();
  }

  // ---------- Stamps & Stickers ----------
  function placeStamp(em) {
    placeSticker(em);
  }

  function placeSticker(em) {
    const s = document.createElement('div');
    s.className = 'pen-sticker';
    s.textContent = em;
    s.style.left = (window.innerWidth / 2 - 20) + 'px';
    s.style.top = (window.innerHeight / 2 - 20) + 'px';
    s.style.position = 'fixed';
    s.style.zIndex = '40';
    document.body.appendChild(s);

    let dragging = false;
    let start = { x: 0, y: 0 };

    s.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      start = { x: e.clientX - s.offsetLeft, y: e.clientY - s.offsetTop };
      s.style.cursor = 'grabbing';
      s.setPointerCapture(e.pointerId);
    });

    s.addEventListener('pointermove', e => {
      if (!dragging) return;
      s.style.left = (e.clientX - start.x) + 'px';
      s.style.top = (e.clientY - start.y) + 'px';
    });

    s.addEventListener('pointerup', () => {
      dragging = false;
      s.style.cursor = 'grab';
    });

    s.addEventListener('click', e => {
      if (dragging) return;
      e.stopPropagation();
      if (s.classList.contains('sel')) {
        s.classList.remove('sel');
        s.querySelector('.pen-sticker-ctrl')?.remove();
      } else {
        s.classList.add('sel');
        const ctrl = document.createElement('div');
        ctrl.className = 'pen-sticker-ctrl';
        ctrl.style.cssText = 'position:absolute;top:-36px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(255,255,255,.96);border:2px solid #8B5A2B;border-radius:12px;padding:3px 5px;';
        ctrl.innerHTML = `
          <button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff;font-size:16px">+</button>
          <button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff;font-size:16px">-</button>
          <button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #991B1B;background:#DC2626;color:#fff;font-size:16px">×</button>`;
        s.appendChild(ctrl);
        ctrl.children[0].onclick = ev => {
          ev.stopPropagation();
          s.style.fontSize = (parseInt(s.style.fontSize || 32) + 4) + 'px';
        };
        ctrl.children[1].onclick = ev => {
          ev.stopPropagation();
          s.style.fontSize = Math.max(16, parseInt(s.style.fontSize || 32) - 4) + 'px';
        };
        ctrl.children[2].onclick = ev => {
          ev.stopPropagation();
          s.remove();
        };
      }
    });

    setTimeout(() => s.remove(), 300000);
  }

  // ---------- Init ----------
  loadState();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

  document.addEventListener('pointerdown', startDraw, { passive: false });
  document.addEventListener('pointermove', draw, { passive: false });
  document.addEventListener('pointerup', endDraw, { passive: false });
  document.addEventListener('pointercancel', () => {
    state.drawing = false;
    state.points = [];
    state.lineStart = null;
    if (state.ctx) state.ctx.globalCompositeOperation = 'source-over';
  });

  // Save when the page is hidden / closed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveInkNow();
  });
  window.addEventListener('pagehide', saveInkNow);

  let scrollTimer;
  window.addEventListener('scroll', () => {
    state.isScrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { state.isScrolling = false; }, 180);
  }, { passive: true });

})();

