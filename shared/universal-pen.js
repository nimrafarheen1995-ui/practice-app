// shared/universal-pen.js v1.2
// 7-icon bar: Pen Eraser Undo Redo Clear Colors Stamps/Stickers
// Fixes: undo/redo stack, palm rejection, smart panel, no double-tap clear

(function(){
  const CFG = {
    colors: ['#0F172A','#2563EB','#15803D','#DC2626','#7C3AED'],
    stamps: ['⭐','😡','❤️','😊','😢','🌸','♻️','🌍','✅','❌','💯','❄️'],
    stickers: ['💃','🔥','⭐','🌹','🧐','🫰','🌳','🧹'],
    storageKey: 'LQ_UNIVERSAL_PEN_V12',
    soundKey: 'LQ_PEN_SOUND_V12'
  };
  
  let state = {
    tool: 'pen', penType: 'normal', color: '#0F172A', size: 2.5,
    drawing: false, soundOn: false, activeCanvas: null, ctx: null,
    audioCtx: null, undoStack: [], redoStack: [], rainbowHue: 0,
    isScrolling: false, lastPoint: null, longPressTimer: null
  };
  
  const loadState = () => {
    try {
      const s = localStorage.getItem(CFG.storageKey);
      if(s) Object.assign(state, JSON.parse(s));
      state.soundOn = localStorage.getItem(CFG.soundKey) === 'true';
    } catch(e){}
  };
  
  const saveState = () => {
    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify({
        tool: state.tool, penType: state.penType, color: state.color, size: state.size
      }));
      localStorage.setItem(CFG.soundKey, state.soundOn);
    } catch(e){}
  };
  
  // Web Audio - Option A: Realistic pencil
  const initAudio = () => {
    if(!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  };
  
  const playPen = () => {
    if(!state.soundOn || !state.audioCtx) return;
    const buffer = state.audioCtx.createBuffer(1, state.audioCtx.sampleRate * 0.06, state.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i/data.length*3) * 0.8;
    const noise = state.audioCtx.createBufferSource();
    const filter = state.audioCtx.createBiquadFilter();
    const gain = state.audioCtx.createGain();
    noise.buffer = buffer;
    filter.type = 'lowpass'; filter.frequency.value = 800;
    gain.gain.setValueAtTime(0.05, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.06);
    noise.connect(filter).connect(gain).connect(state.audioCtx.destination);
    noise.start();
  };
  
  const playEraser = () => {
    if(!state.soundOn || !state.audioCtx) return;
    const buffer = state.audioCtx.createBuffer(1, state.audioCtx.sampleRate * 0.1, state.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random() * 2 - 1) * 0.25;
    const noise = state.audioCtx.createBufferSource();
    const filter = state.audioCtx.createBiquadFilter();
    const gain = state.audioCtx.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0.04, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.1);
    noise.connect(filter).connect(gain).connect(state.audioCtx.destination);
    noise.start();
  };
  
  const playDing = () => {
    if(!state.soundOn || !state.audioCtx) return;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, state.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.25);
    osc.connect(gain).connect(state.audioCtx.destination);
    osc.start(); osc.stop(state.audioCtx.currentTime + 0.25);
  };
  
  window.UniversalPen = { state, saveState, playDing, initAudio };
  
  const buildUI = () => {
    if(document.getElementById('penBubble')) return;
    
    const css = document.createElement('style');
    css.textContent = `
      #penBubble{position:fixed;bottom:18px;right:14px;z-index:50;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#5A3C22,#8B5A2B);box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;transition:transform .15s}
      #penBubble:active{transform:scale(.95)}
      #penBar{position:fixed;z-index:51;background:rgba(255,255,255,.98);border:2px solid #E7D5B0;border-radius:18px;padding:8px;box-shadow:0 16px 40px rgba(0,0,0,.22);transform:scale(.9);opacity:0;pointer-events:none;transition:all .25s;display:flex;gap:6px;align-items:center}
      #penBar.open{transform:scale(1);opacity:1;pointer-events:auto}
      .pen-btn{width:36px;height:36px;border-radius:10px;border:2px solid #E7D5B0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:.15s;position:relative}
      .pen-btn.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-btn:active{transform:scale(.9)}
      .pen-pop{position:absolute;bottom:46px;left:50%;transform:translateX(-50%) scale(.9);opacity:0;pointer-events:none;transition:all .2s;background:rgba(255,255,255,.98);border:2px solid #E7D5B0;border-radius:14px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap;z-index:52}
      .pen-pop.open{transform:translateX(-50%) scale(1);opacity:1;pointer-events:auto}
      .pen-pop-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
      .pen-pop-row:last-child{margin-bottom:0}
      .pen-mini{width:32px;height:32px;border-radius:8px;border:2px solid #E7D5B0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px}
      .pen-mini.on{background:#FEF3C7;border-color:#8B5A2B}
      .pen-dot{width:28px;height:28px;border-radius:50%;cursor:pointer;border:3px solid #fff;box-shadow:0 0 0 2px #E7D5B0;transition:.15s}
      .pen-dot.on{box-shadow:0 0 0 2px #8B5A2B;transform:scale(1.1)}
      .pen-tab{padding:4px 10px;border-radius:8px;border:2px solid #E7D5B0;background:#fff;cursor:pointer;font-size:.75rem;font-weight:700}
      .pen-tab.on{background:#FEF3C7;border-color:#8B5A2B}
      #penSound{position:fixed;bottom:18px;left:14px;z-index:50;width:44px;height:44px;border-radius:50%;background:#fff;border:2px solid #8B5A2B;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.15)}
      .pen-sticker{position:fixed;font-size:32px;cursor:grab;z-index:15;user-select:none;touch-action:none;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))}
      .pen-sticker.sel{outline:2px dashed #8B5A2B;outline-offset:4px}
    `;
    document.head.appendChild(css);
    
    const bubble = document.createElement('div');
    bubble.id = 'penBubble';
    bubble.innerHTML = '<span style="font-size:24px">✏️</span>';
    
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
            <input type="range" min="1" max="8" step="0.5" value="${state.size}" id="penSize" style="width:100px;accent-color:#8B5A2B"/>
            <span id="penSizeLab" style="font-size:.65rem;font-weight:800;min-width:24px">${state.size}</span>
          </div>
        </div>
      </div>
      <div class="pen-btn" data-tool="eraser">🧽</div>
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
          </div>
          <div id="stampGrid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:6px"></div>
        </div>
      </div>
    `;
    
    const sound = document.createElement('div');
    sound.id = 'penSound';
    sound.textContent = state.soundOn ? '🔊' : '🔇';
    
    document.body.appendChild(bubble);
    document.body.appendChild(bar);
    document.body.appendChild(sound);
    
    // Populate colors
    const colorRow = document.getElementById('colorRow');
    CFG.colors.forEach(c => {
      const d = document.createElement('div');
      d.className = 'pen-dot' + (c===state.color?' on':'');
      d.style.background = c;
      d.onclick = () => { state.color = c; saveState(); updateUI(); closePops(); };
      colorRow.appendChild(d);
    });
    
    // Populate stamps/stickers
    const stampGrid = document.getElementById('stampGrid');
    const renderStamps = () => {
      stampGrid.innerHTML = '';
      CFG.stamps.forEach(s => {
        const b = document.createElement('div');
        b.className = 'pen-mini'; b.textContent = s; b.style.fontSize = '20px';
        b.onclick = () => { placeStamp(s); closePops(); };
        stampGrid.appendChild(b);
      });
    };
    const renderStickers = () => {
      stampGrid.innerHTML = '';
      CFG.stickers.forEach(s => {
        const b = document.createElement('div');
        b.className = 'pen-mini'; b.textContent = s; b.style.fontSize = '20px';
        b.onclick = () => { placeSticker(s); closePops(); };
        stampGrid.appendChild(b);
      });
    };
    renderStamps();
    
    attachEvents(bubble, bar, sound, renderStamps, renderStickers);
    makeDraggable(bubble, bar);
    updateUI();
  };
  
  const closePops = () => document.querySelectorAll('.pen-pop').forEach(p => p.classList.remove('open'));
  
  const updateUI = () => {
    document.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === state.tool);
    });
    document.querySelectorAll('[data-type]').forEach(b => {
      b.classList.toggle('on', b.dataset.type === state.penType);
    });
    document.querySelectorAll('.pen-dot').forEach((d,i) => {
      d.classList.toggle('on', CFG.colors[i] === state.color);
    });
  };
  
  const positionBar = (bubble, bar) => {
    const rect = bubble.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const isTop = rect.top < window.innerHeight / 2;
    
    if(isTop) {
      bar.style.top = (rect.bottom + 8) + 'px';
      bar.style.bottom = 'auto';
    } else {
      bar.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      bar.style.top = 'auto';
    }
    bar.style.left = Math.max(8, Math.min(window.innerWidth - barRect.width - 8, rect.left + rect.width/2 - barRect.width/2)) + 'px';
  };
  
  const attachEvents = (bubble, bar, sound, renderStamps, renderStickers) => {
    let barOpen = false;
    
    bubble.onclick = (e) => {
      e.stopPropagation();
      barOpen = !barOpen;
      bar.classList.toggle('open', barOpen);
      if(barOpen) positionBar(bubble, bar);
      closePops();
    };
    
    // Long-press bubble = quick eraser
    bubble.onpointerdown = (e) => {
      state.longPressTimer = setTimeout(() => {
        state.tool = state.tool === 'eraser' ? 'pen' : 'eraser';
        saveState(); updateUI();
        navigator.vibrate?.(50);
      }, 500);
    };
    bubble.onpointerup = () => clearTimeout(state.longPressTimer);
    bubble.onpointerleave = () => clearTimeout(state.longPressTimer);
    
    sound.onclick = () => {
      state.soundOn = !state.soundOn;
      sound.textContent = state.soundOn ? '🔊' : '🔇';
      saveState();
      if(state.soundOn) initAudio();
    };
    
    // Tap outside closes
    document.addEventListener('click', (e) => {
      if(!bar.contains(e.target) && !bubble.contains(e.target)) {
        bar.classList.remove('open');
        barOpen = false;
        closePops();
      }
    });
    
    // Tool buttons
    bar.querySelectorAll('[data-tool]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        state.tool = b.dataset.tool;
        saveState(); updateUI(); closePops();
      };
    });
    
    // Pen pop
    bar.querySelector('[data-tool="pen"]').onclick = (e) => {
      e.stopPropagation();
      document.getElementById('penPop').classList.toggle('open');
    };
    
    bar.querySelectorAll('[data-type]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        state.penType = b.dataset.type;
        state.tool = 'pen';
        saveState(); updateUI();
      };
    });
    
    document.getElementById('penSize').oninput = (e) => {
      state.size = parseFloat(e.target.value);
      document.getElementById('penSizeLab').textContent = state.size;
      saveState();
    };
    
    // Color pop
    bar.querySelectorAll('.pen-btn')[5].onclick = (e) => {
      e.stopPropagation();
      document.getElementById('colorPop').classList.toggle('open');
    };
    
    // Stamp pop
    bar.querySelectorAll('.pen-btn')[6].onclick = (e) => {
      e.stopPropagation();
      document.getElementById('stampPop').classList.toggle('open');
    };
    
    bar.querySelectorAll('.pen-tab').forEach(tab => {
      tab.onclick = (e) => {
        e.stopPropagation();
        bar.querySelectorAll('.pen-tab').forEach(t => t.classList.remove('on'));
        tab.classList.add('on');
        if(tab.dataset.tab === 'stamps') renderStamps();
        else renderStickers();
      };
    });
    
    // Actions
    bar.querySelector('[data-act="undo"]').onclick = (e) => { e.stopPropagation(); undo(); };
    bar.querySelector('[data-act="redo"]').onclick = (e) => { e.stopPropagation(); redo(); };
    bar.querySelector('[data-act="clear"]').onclick = (e) => {
      e.stopPropagation();
      if(confirm('Clear all drawings?')) clear();
    };
    
    // Canvas detection
    document.addEventListener('click', e => {
      const c = e.target.closest('canvas');
      if(c) { state.activeCanvas = c; state.ctx = c.getContext('2d'); }
    });
    
    // Scroll detection
    window.addEventListener('scroll', () => {
      state.isScrolling = true;
      setTimeout(() => state.isScrolling = false, 150);
    });
  };
  
  const makeDraggable = (el, bar) => {
    let pos = {x:0,y:0};
    el.onpointerdown = e => {
      if(e.target !== el && !el.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      pos = {x:e.clientX, y:e.clientY};
      const move = e => {
        el.style.left = (el.offsetLeft + e.clientX - pos.x) + 'px';
        el.style.top = (el.offsetTop + e.clientY - pos.y) + 'px';
        el.style.bottom = el.style.right = 'auto';
        pos = {x:e.clientX, y:e.clientY};
        if(bar.classList.contains('open')) positionBar(el, bar);
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    };
  };
  
  const getPos = (e) => {
    if(!state.activeCanvas) return null;
    const r = state.activeCanvas.getBoundingClientRect();
    return {x: (e.touches?e.touches[0].clientX:e.clientX) - r.left, y: (e.touches?e.touches[0].clientY:e.clientY) - r.top};
  };
  
  const startDraw = (e) => {
    if(!state.activeCanvas || !state.ctx || state.isScrolling) return;
    // Palm rejection: only pen or finger with pressure
    if(e.pointerType === 'touch' && e.width > 20) return;
    if(e.pointerType !== 'pen' && e.pressure === 0 && e.pointerType !== 'mouse') return;
    
    e.preventDefault();
    state.drawing = true;
    state.lastPoint = getPos(e);
    state.ctx.beginPath();
    state.ctx.moveTo(state.lastPoint.x, state.lastPoint.y);
    state.ctx.lineCap = state.ctx.lineJoin = 'round';
    state.ctx.lineWidth = state.size;
    
    if(state.tool === 'eraser') {
      state.ctx.globalCompositeOperation = 'destination-out';
      playEraser();
    } else {
      state.ctx.globalCompositeOperation = 'source-over';
      if(state.penType === 'rainbow') {
        state.ctx.strokeStyle = `hsl(${state.rainbowHue},100%,50%)`;
        state.rainbowHue = (state.rainbowHue + 5) % 360;
      } else if(state.penType === 'glitter') {
        state.ctx.strokeStyle = state.color;
        state.ctx.shadowColor = state.color;
        state.ctx.shadowBlur = 0; // No shadow for glitter
      } else {
        state.ctx.strokeStyle = state.color;
        state.ctx.shadowBlur = 0;
      }
      if(state.penType === 'cursive') state.ctx.lineWidth = state.size * 0.7;
      playPen();
    }
  };
  
  const draw = (e) => {
    if(!state.drawing || !state.ctx || state.isScrolling) return;
    if(e.pointerType === 'touch' && e.width > 20) return;
    
    e.preventDefault();
    const p = getPos(e);
    state.ctx.lineTo(p.x, p.y);
    state.ctx.stroke();
    
    // Glitter sparkles
    if(state.tool !== 'eraser' && state.penType === 'glitter' && Math.random() > 0.7) {
      state.ctx.save();
      state.ctx.fillStyle = state.color;
      state.ctx.globalAlpha = 0.6;
      state.ctx.beginPath();
      state.ctx.arc(p.x + (Math.random()-0.5)*10, p.y + (Math.random()-0.5)*10, 1, 0, 7);
      state.ctx.fill();
      state.ctx.restore();
    }
    
    if(state.tool !== 'eraser' && state.penType === 'rainbow') {
      state.ctx.strokeStyle = `hsl(${state.rainbowHue},100%,50%)`;
      state.rainbowHue = (state.rainbowHue + 5) % 360;
    }
    
    state.lastPoint = p;
  };
  
  const endDraw = () => {
    if(!state.drawing) return;
    state.drawing = false;
    // Save state AFTER stroke completes - fixes undo glitch
    setTimeout(() => {
      if(state.activeCanvas) {
        state.undoStack.push(state.activeCanvas.toDataURL());
        if(state.undoStack.length > 30) state.undoStack.shift();
        state.redoStack = [];
      }
    }, 10);
  };
  
  const undo = () => {
    if(!state.ctx || state.undoStack.length < 2) return;
    state.redoStack.push(state.undoStack.pop());
    const img = new Image();
    img.onload = () => {
      state.ctx.clearRect(0,0,state.activeCanvas.width,state.activeCanvas.height);
      state.ctx.drawImage(img,0,0);
    };
    img.src = state.undoStack[state.undoStack.length - 1];
  };
  
  const redo = () => {
    if(!state.ctx || !state.redoStack.length) return;
    const img = new Image();
    img.onload = () => {
      state.ctx.clearRect(0,0,state.activeCanvas.width,state.activeCanvas.height);
      state.ctx.drawImage(img,0,0);
      state.undoStack.push(state.redoStack.pop());
    };
    img.src = state.redoStack[state.redoStack.length - 1];
  };
  
  const clear = () => {
    if(!state.ctx) return;
    state.undoStack.push(state.activeCanvas.toDataURL());
    state.ctx.clearRect(0,0,state.activeCanvas.width,state.activeCanvas.height);
    state.redoStack = [];
  };
  
  const placeStamp = (em) => {
    if(!state.ctx) return alert('Tap a writing area first');
    state.ctx.font = '32px serif';
    state.ctx.fillText(em, state.activeCanvas.width/2 - 16, state.activeCanvas.height/2 + 16);
    setTimeout(() => {
      if(state.activeCanvas) {
        state.undoStack.push(state.activeCanvas.toDataURL());
        state.redoStack = [];
      }
    }, 10);
  };
  
  const placeSticker = (em) => {
    const s = document.createElement('div');
    s.className = 'pen-sticker';
    s.textContent = em;
    s.style.left = '50%'; s.style.top = '50%';
    document.body.appendChild(s);
    
    let dragging = false, startPos = {};
    s.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation();
      dragging = true;
      startPos = {x: e.clientX - s.offsetLeft, y: e.clientY - s.offsetTop};
      s.style.cursor = 'grabbing';
    };
    
    document.addEventListener('pointermove', e => {
      if(!dragging) return;
      s.style.left = (e.clientX - startPos.x) + 'px';
      s.style.top = (e.clientY - startPos.y) + 'px';
    });
    
    document.addEventListener('pointerup', () => {
      dragging = false;
      s.style.cursor = 'grab';
    });
    
    s.onclick = (e) => {
      if(dragging) return;
      e.stopPropagation();
      if(s.classList.contains('sel')) {
        s.classList.remove('sel');
        s.querySelector('.pen-sticker-ctrl')?.remove();
      } else {
        s.classList.add('sel');
        const ctrl = document.createElement('div');
        ctrl.className = 'pen-sticker-ctrl';
        ctrl.style.cssText = 'position:absolute;top:-36px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(255,255,255,.96);border:2px solid #8B5A2B;border-radius:12px;padding:3px 5px';
        ctrl.innerHTML = '<button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff;font-size:16px">+</button><button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff;font-size:16px">-</button><button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #991B1B;background:#DC2626;color:#fff;font-size:16px">×</button>';
        s.appendChild(ctrl);
        ctrl.children[0].onclick = e => { e.stopPropagation(); s.style.fontSize = (parseInt(s.style.fontSize||32) + 4) + 'px'; };
        ctrl.children[1].onclick = e => { e.stopPropagation(); s.style.fontSize = Math.max(16, parseInt(s.style.fontSize||32) - 4) + 'px'; };
        ctrl.children[2].onclick = e => { e.stopPropagation(); s.remove(); };
      }
    };
    
    setTimeout(() => s.remove(), 300000);
  };
  
  loadState();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();
  
  document.addEventListener('pointerdown', startDraw);
  document.addEventListener('pointermove', draw);
  document.addEventListener('pointerup', endDraw);
  document.addEventListener('pointercancel', endDraw);
})();
