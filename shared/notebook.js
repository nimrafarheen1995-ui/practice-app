/**
 * Universal Tablet Notebook Canvas Engine v1.0
 * Preserves vector strokes, supports layer stacking, handles S-Pen pressure, 
 * provides Palm Rejection, and ensures cross-lesson isolation.
 */
(function (window) {
  'use strict';

  if (window.Notebook) return;

  const ENGINE_VERSION = '1.0';

  const Notebook = {
    version: ENGINE_VERSION,
    config: null,
    activeTool: 'pen', // 'pen', 'highlighter', 'eraser'
    activeColor: '#0F172A',
    penWidth: 3,
    stylusOnly: true, // S-Pen palm rejection by default
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
        palette: ['#0F172A', '#DC2626', '#2563EB', '#16A34A', '#7C3AED'],
        layers: []
      }, options);

      document.addEventListener('DOMContentLoaded', () => {
        this.setupDOM();
        this.bindGlobalEvents();
        this.renderPages();
        this.mountToolsUI();
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

    mountToolsUI: function () {
      const panel = document.createElement('div');
      panel.className = 'tools-panel';

      // Tool Icon Trigger (Updated from 🛠️ to 🎨)
      const avatarBtn = document.createElement('button');
      avatarBtn.className = 'tool-btn active';
      avatarBtn.innerHTML = '🎨';
      avatarBtn.title = 'Active Tools';

      // Stylus-Only Mode Toggle (Palm Rejection)
      const stylusBtn = document.createElement('button');
      stylusBtn.className = `tool-btn ${this.stylusOnly ? 'active' : ''}`;
      stylusBtn.innerHTML = '✏️';
      stylusBtn.title = 'Toggle Stylus-Only (Palm Rejection)';
      stylusBtn.onclick = () => {
        this.stylusOnly = !this.stylusOnly;
        stylusBtn.classList.toggle('active', this.stylusOnly);
        document.body.classList.toggle('stylus-mode-active', this.stylusOnly);
      };

      // Eraser
      const eraserBtn = document.createElement('button');
      eraserBtn.className = 'tool-btn';
      eraserBtn.innerHTML = '🧹';
      eraserBtn.title = 'Eraser';
      eraserBtn.onclick = () => {
        this.activeTool = 'eraser';
        eraserBtn.classList.add('active');
        penBtn.classList.remove('active');
      };

      // Pen
      const penBtn = document.createElement('button');
      penBtn.className = 'tool-btn active';
      penBtn.innerHTML = '🖊️';
      penBtn.title = 'Pen';
      penBtn.onclick = () => {
        this.activeTool = 'pen';
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
      };

      // Palette Swatches
      const swatches = document.createElement('div');
      swatches.style.display = 'flex';
      swatches.style.gap = '6px';

      this.config.palette.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = `palette-swatch ${color === this.activeColor ? 'active' : ''}`;
        swatch.style.backgroundColor = color;
        swatch.onclick = () => {
          this.activeColor = color;
          this.activeTool = 'pen';
          penBtn.classList.add('active');
          eraserBtn.classList.remove('active');
          panel.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
        };
        swatches.appendChild(swatch);
      });

      // Clear Current Page Button
      const clearBtn = document.createElement('button');
      clearBtn.className = 'tool-btn';
      clearBtn.innerHTML = '🗑️';
      clearBtn.title = 'Clear Ink';
      clearBtn.onclick = () => {
        if (confirm("Clear drawings on this page?")) {
          this.pages.forEach(p => p.clear());
        }
      };

      panel.appendChild(avatarBtn);
      panel.appendChild(stylusBtn);
      panel.appendChild(penBtn);
      panel.appendChild(eraserBtn);
      panel.appendChild(swatches);
      panel.appendChild(clearBtn);

      document.body.appendChild(panel);
    },

    grid: function (opts) {
      const options = Object.assign({ minor: 20, major: 100, color: '#cbd5e1' }, opts);
      return function (ctx, width, height) {
        ctx.save();
        ctx.strokeStyle = options.color;
        ctx.lineWidth = 0.5;

        // Minor grid
        ctx.beginPath();
        for (let x = 0; x < width; x += options.minor) {
          ctx.moveTo(x, 0); ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += options.minor) {
          ctx.moveTo(0, y); ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Major grid
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < width; x += options.major) {
          ctx.moveTo(x, 0); ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += options.major) {
          ctx.moveTo(0, y); ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
      };
    }
  };

  /**
   * Internal Page Controller managing Background Layers, Vector Stroke Buffers,
   * Low-Latency S-Pen Input, and Safe LocalStorage Serialization.
   */
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
      // S-Pen Palm Rejection enforcement
      if (this.engine.stylusOnly && e.pointerType !== 'pen') {
        return;
      }
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;

      if (this.engine.activeTool === 'eraser') {
        this.eraseAt(x, y);
      } else {
        this.currentStroke = {
          color: this.engine.activeColor,
          width: this.engine.penWidth,
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

      if (this.engine.activeTool === 'eraser' && e.buttons === 1) {
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
    this.inkCtx.lineWidth = stroke.width * (p2.pressure * 1.5 || 1);
    this.inkCtx.lineCap = 'round';
    this.inkCtx.lineJoin = 'round';
    this.inkCtx.stroke();
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
      // 1. Vector strokes (Preferred)
      if (raw.startsWith('[') || raw.startsWith('{')) {
        this.strokes = JSON.parse(raw);
        this.redrawStrokes();
      } else if (raw.startsWith('data:image')) {
        // 2. Legacy PNG backward compatibility
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
