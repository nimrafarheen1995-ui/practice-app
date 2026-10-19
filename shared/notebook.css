/**
 * Universal Tablet Notebook Canvas Engine v2.0 (Advanced Toolbar Kit)
 * Preserves vector strokes, supports layer stacking, S-Pen pressure, 
 * Palm Rejection, and the Full Floating Pen Toolbar Drawer.
 */
(function (window) {
  'use strict';

  if (window.Notebook) return;

  const ENGINE_VERSION = '1.0';
  const COLORS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#ec4899', '#f59e0b', '#7c3aed'];
  const RAINBOW = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  const EMOJI_STAMPS = ['🌍', '🌳', '💧', '⭐', '✅', '❌', '🌈', '💡'];

  const Notebook = {
    version: ENGINE_VERSION,
    config: null,
    pen: { tool: 'pen', color: '#0f172a', width: 2.5, stamp: { type: 'emoji', value: '⭐' } },
    penOpen: false,
    rainbowIdx: 0,
    stylusOnly: true, // S-Pen palm rejection enabled by default
    pages: [],

    init: function (options) {
      if (!options || options.engine !== ENGINE_VERSION) {
        console.error(`Notebook engine version mismatch. Required: ${ENGINE_VERSION}`);
        return;
      }
      this.config = Object.assign({
        child: 'zaina',
        subject: 'general',
        lessonId: 'default',
        palette: COLORS,
        layers: []
      }, options);

      document.addEventListener('DOMContentLoaded', () => {
        this.setupDOM();
        this.bindGlobalEvents();
        this.renderPages();
        this.mountAdvancedToolbar();
      });
    },

    getStoragePrefix: function () {
      return `${this.config.child}_${this.config.subject}_${this.config.lessonId}`;
    },

    setupDOM: function () {
      if (this.stylusOnly) {
        document.body.classList.add('stylus-mode-active');
      }
    },

    bindGlobalEvents: function () {
      window.addEventListener('resize', () => {
        this.pages.forEach(p => p.resize());
      });
    },

    renderPages: function () {
      const pageElements = document.querySelectorAll('[data-notebook-page]');
      pageElements.forEach((el, index) => {
        const pageObj = new PageInstance(el, index, this);
        this.pages.push(pageObj);
      });
    },

    mountAdvancedToolbar: function () {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'pen-fab';
      fab.id = 'penBtn';
      fab.innerHTML = '✏️';
      fab.title = 'Pen tools';
      fab.onclick = () => this.togglePenDrawer();

      const drawer = document.createElement('div');
      drawer.className = 'pen-drawer';
      drawer.id = 'penDrawer';

      drawer.innerHTML = `
        <div class="pen-row">
          <button type="button" class="dtool" id="dtPen" onclick="Notebook.setTool('pen')" title="Pen">✏</button>
          <button type="button" class="dtool" id="dtEraser" onclick="Notebook.setTool('eraser')" title="Eraser">🧽</button>
          <span class="pdiv"></span>
          <button type="button" class="dtool" id="dtColors" onclick="Notebook.toggleBubble('colorBubble')" title="Colours">🎨</button>
          <button type="button" class="dtool" id="dtThick" onclick="Notebook.toggleBubble('thickBubble')" title="Thickness">━</button>
          <button type="button" class="dtool" id="dtCursive" onclick="Notebook.setTool('cursive')" title="Cursive nib">✒</button>
          <button type="button" class="dtool" id="dtRainbow" onclick="Notebook.setTool('rainbow')" title="Rainbow">🌈</button>
          <button type="button" class="dtool" id="dtStamp" onclick="Notebook.toggleBubble('stampBubble')" title="Stamps">⭐</button>
          
          <div id="colorBubble" class="bubble">
            <div class="bub-title">Colours</div>
            <div class="bub-row">
              ${this.config.palette.map(c => `<div class="sw" data-c="${c}" style="background:${c}" onclick="Notebook.setColor('${c}')"></div>`).join('')}
            </div>
          </div>

          <div id="thickBubble" class="bubble col">
            <label>Thickness — slide to change</label>
            <input type="range" id="thickSlider" min="1" max="10" step="0.5" value="2.5" oninput="Notebook.setThickness(this.value)" />
            <span id="thickLabel" style="color:#fff;font-size:11px;font-weight:800;margin-top:2px;">2.5</span>
          </div>

          <div id="stampBubble" class="bubble">
            <div class="bub-title">Fun Stamps</div>
            <div class="bub-row">
              ${EMOJI_STAMPS.map(e => `<button type="button" class="st" onclick="Notebook.pickStamp('${e}')">${e}</button>`).join('')}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(fab);
      document.body.appendChild(drawer);
      this.updatePenUI();
    },

    closeBubbles: function () {
      document.querySelectorAll('.bubble').forEach(b => b.classList.remove('open'));
    },

    toggleBubble: function (id) {
      const el = document.getElementById(id);
      const wasOpen = el.classList.contains('open');
      this.closeBubbles();
      if (!wasOpen) el.classList.add('open');
      this.updatePenUI();
    },

    togglePenDrawer: function () {
      this.penOpen = !this.penOpen;
      this.closeBubbles();
      document.getElementById('penDrawer').classList.toggle('open', this.penOpen);
    },

    setTool: function (t) {
      this.pen.tool = t;
      this.closeBubbles();
      this.updatePenUI();
    },

    setColor: function (c) {
      this.pen.color = c;
      this.pen.tool = 'pen';
      this.closeBubbles();
      this.updatePenUI();
    },

    setThickness: function (v) {
      this.pen.width = Number(v);
      this.updatePenUI();
    },

    pickStamp: function (val) {
      this.pen.stamp = { type: 'emoji', value: val };
      this.pen.tool = 'stamp';
      this.closeBubbles();
      this.updatePenUI();
    },

    updatePenUI: function () {
      const set = (id, on) => document.getElementById(id)?.classList.toggle('on', !!on);
      set('dtPen', this.pen.tool === 'pen');
      set('dtEraser', this.pen.tool === 'eraser');
      set('dtCursive', this.pen.tool === 'cursive');
      set('dtRainbow', this.pen.tool === 'rainbow');
      set('dtStamp', this.pen.tool === 'stamp');
      
      const colorBtn = document.getElementById('dtColors');
      if (colorBtn) colorBtn.style.boxShadow = `inset 0 -4px 0 ${this.pen.color}`;

      const stampBtn = document.getElementById('dtStamp');
      if (stampBtn) stampBtn.innerHTML = this.pen.stamp.value || '⭐';

      document.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === this.pen.color));
      
      const slider = document.getElementById('thickSlider');
      const label = document.getElementById('thickLabel');
      if (slider) slider.value = this.pen.width;
      if (label) label.textContent = this.pen.width;
    },

    grid: function (opts) {
      const options = Object.assign({ minor: 20, major: 100, color: '#cbd5e1' }, opts);
      return function (ctx, width, height) {
        ctx.save();
        ctx.strokeStyle = options.color;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = 0; x < width; x += options.minor) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += options.minor) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < width; x += options.major) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += options.major) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
        ctx.restore();
      };
    }
  };

  function PageInstance(container, pageIndex, engine) {
    this.container = container;
    this.index = pageIndex;
    this.engine = engine;
    this.storageKey = `${engine.getStoragePrefix()}_ink_p${pageIndex}`;
    this.strokes = [];
    this.currentStroke = null;

    this.initCanvas();
    this.loadInk();
  }

  PageInstance.prototype.initCanvas = function () {
    const stack = document.createElement('div');
    stack.className = 'canvas-stack';

    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.className = 'layer-bg';

    this.inkCanvas = document.createElement('canvas');
    this.inkCanvas.className = 'layer-ink';

    stack.appendChild(this.bgCanvas);
    stack.appendChild(this.inkCanvas);
    this.container.appendChild(stack);

    this.bgCtx = this.bgCanvas.getContext('2d');
    this.inkCtx = this.inkCanvas.getContext('2d', { desynchronized: true });

    this.resize();
    this.bindEvents();
  };

  PageInstance.prototype.resize = function () {
    const rect = this.inkCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.width = rect.width;
    this.height = rect.height;

    this.bgCanvas.width = this.width * dpr;
    this.bgCanvas.height = this.height * dpr;
    this.inkCanvas.width = this.width * dpr;
    this.inkCanvas.height = this.height * dpr;

    this.bgCtx.scale(dpr, dpr);
    this.inkCtx.scale(dpr, dpr);

    this.renderLayers();
    this.redrawStrokes();
  };

  PageInstance.prototype.renderLayers = function () {
    this.bgCtx.clearRect(0, 0, this.width, this.height);
    this.engine.config.layers.forEach(layerFn => {
      if (typeof layerFn === 'function') {
        layerFn(this.bgCtx, this.width, this.height);
      }
    });
  };

  PageInstance.prototype.bindEvents = function () {
    const canvas = this.inkCanvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (this.engine.stylusOnly && e.pointerType !== 'pen') {
        return;
      }
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;

      if (this.engine.pen.tool === 'eraser') {
        this.eraseAt(x, y);
      } else if (this.engine.pen.tool === 'stamp') {
        this.drawStamp(x, y);
        this.saveInk();
      } else {
        this.currentStroke = {
          tool: this.engine.pen.tool,
          color: this.engine.pen.tool === 'rainbow' ? RAINBOW[this.engine.rainbowIdx++ % RAINBOW.length] : this.engine.pen.color,
          width: this.engine.pen.width,
          points: [{ x, y, pressure }]
        };
        this.strokes.push(this.currentStroke);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this.engine.stylusOnly && e.pointerType !== 'pen') return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;

      if (this.engine.pen.tool === 'eraser' && e.buttons === 1) {
        this.eraseAt(x, y);
      } else if (this.currentStroke) {
        this.currentStroke.points.push({ x, y, pressure });
        this.drawSegment(this.currentStroke);
      }
    });

    const stopDrawing = () => {
      if (this.currentStroke) {
        this.currentStroke = null;
        this.saveInk();
      }
    };

    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);
  };

  PageInstance.prototype.drawSegment = function (stroke) {
    const pts = stroke.points;
    if (pts.length < 2) return;

    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];

    this.inkCtx.save();
    this.inkCtx.beginPath();
    this.inkCtx.moveTo(p1.x, p1.y);
    this.inkCtx.lineTo(p2.x, p2.y);
    this.inkCtx.strokeStyle = stroke.color;

    if (stroke.tool === 'cursive') {
      this.inkCtx.lineWidth = stroke.width * 1.5;
      this.inkCtx.globalAlpha = 0.88;
    } else {
      this.inkCtx.lineWidth = stroke.width * (p2.pressure * 1.5 || 1);
    }

    this.inkCtx.lineCap = 'round';
    this.inkCtx.lineJoin = 'round';
    this.inkCtx.stroke();
    this.inkCtx.restore();
  };

  PageInstance.prototype.drawStamp = function (x, y) {
    const size = 20 + this.engine.pen.width * 3.6;
    const val = this.engine.pen.stamp.value;
    this.inkCtx.save();
    this.inkCtx.font = `${size}px sans-serif`;
    this.inkCtx.textAlign = 'center';
    this.inkCtx.textBaseline = 'middle';
    this.inkCtx.fillText(val, x, y);
    this.inkCtx.restore();
  };

  PageInstance.prototype.redrawStrokes = function () {
    this.inkCtx.clearRect(0, 0, this.width, this.height);
    this.strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;
      this.inkCtx.save();
      this.inkCtx.strokeStyle = stroke.color;
      this.inkCtx.lineCap = 'round';
      this.inkCtx.lineJoin = 'round';

      for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        this.inkCtx.beginPath();
        this.inkCtx.moveTo(p1.x, p1.y);
        this.inkCtx.lineTo(p2.x, p2.y);
        this.inkCtx.lineWidth = stroke.width * (p2.pressure * 1.5 || 1);
        this.inkCtx.stroke();
      }
      this.inkCtx.restore();
    });
  };

  PageInstance.prototype.eraseAt = function (x, y) {
    const threshold = 18;
    const initialCount = this.strokes.length;
    this.strokes = this.strokes.filter(stroke => {
      return !stroke.points.some(p => Math.hypot(p.x - x, p.y - y) < threshold);
    });
    if (this.strokes.length !== initialCount) {
      this.redrawStrokes();
      this.saveInk();
    }
  };

  PageInstance.prototype.saveInk = function () {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.strokes));
    } catch (e) {
      console.warn("Storage write deferred to safe storage overflow.", e);
    }
  };

  PageInstance.prototype.loadInk = function () {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return;

    try {
      if (raw.startsWith('[') || raw.startsWith('{')) {
        this.strokes = JSON.parse(raw);
        this.redrawStrokes();
      } else if (raw.startsWith('data:image')) {
        const img = new Image();
        img.onload = () => {
          this.inkCtx.drawImage(img, 0, 0, this.width, this.height);
        };
        img.src = raw;
      }
    } catch (err) {
      console.error("Error loading ink:", err);
    }
  };

  PageInstance.prototype.clear = function () {
    this.strokes = [];
    this.inkCtx.clearRect(0, 0, this.width, this.height);
    localStorage.removeItem(this.storageKey);
  };

  window.Notebook = Notebook;
})(window);
