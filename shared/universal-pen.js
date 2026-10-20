// shared/universal-pen.js v1.0
// Universal floating pen: drag anywhere, inline strips + full canvas
// 5 colors, 4 pen types, Web Audio sounds, 12 stamps, 8 stickers

(function(){
  const CFG = {
    colors: ['#0F172A','#2563EB','#15803D','#DC2626','#7C3AED'],
    stamps: ['⭐','😡','❤️','😊','😢','🌸','❄','💫','🌍','✅','❌','💯'],
    stickers: ['💃','🔥','⭐','🌹','🧐','🫰','🌳','🧹'],
    storageKey: 'LQ_UNIVERSAL_PEN_V1',
    soundKey: 'LQ_PEN_SOUND'
  };
  
  let state = {
    tool: 'pen', penType: 'normal', color: '#0F172A', size: 2.5,
    drawing: false, soundOn: false, activeCanvas: null, ctx: null,
    audioCtx: null, undoStack: [], redoStack: [], rainbowHue: 0
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
  
  // Web Audio - no files
  const initAudio = () => {
    if(!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  };
  
  const playPen = () => {
    if(!state.soundOn || !state.audioCtx) return;
    const buffer = state.audioCtx.createBuffer(1, state.audioCtx.sampleRate * 0.08, state.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = Math.random() * 0.2 - 0.1;
    const noise = state.audioCtx.createBufferSource();
    const gain = state.audioCtx.createGain();
    noise.buffer = buffer;
    gain.gain.setValueAtTime(0.06, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.08);
    noise.connect(gain).connect(state.audioCtx.destination);
    noise.start();
  };
  
  const playEraser = () => {
    if(!state.soundOn || !state.audioCtx) return;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, state.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.12);
    osc.connect(gain).connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.12);
  };
  
  const buildUI = () => {
    if(document.getElementById('universalPenBubble')) return;
    
    const css = document.createElement('style');
    css.textContent = `
      #universalPenBubble{position:fixed;bottom:18px;right:14px;z-index:50;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#5A3C22,#8B5A2B);box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none}
      #universalPenPanel{position:fixed;bottom:76px;right:14px;z-index:51;width:280px;background:rgba(255,255,255,.98);border:2px solid #E7D5B0;border-radius:18px;padding:10px;box-shadow:0 16px 40px rgba(0,0,0,.22);transform:scale(.9);opacity:0;pointer-events:none;transition:all .25s;transform-origin:bottom right}
      #universalPenPanel.open{transform:scale(1);opacity:1;pointer-events:auto}
      .up-row{display:flex;gap:5px;margin-bottom:6px;flex-wrap:wrap;align-items:center}
      .up-btn{width:36px;height:36px;border-radius:10px;border:2px solid #E7D5B0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;transition:.15s}
      .up-btn.on{border-color:#8B5A2B;background:#FEF3C7}
      .up-dot{width:26px;height:26px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 0 1.2px #CBD5E1;cursor:pointer}
      .up-dot.on{box-shadow:0 0 0 2.2px #8B5A2B}
      #universalPenSound{position:fixed;bottom:18px;left:14px;z-index:50;width:42px;height:42px;border-radius:50%;background:#fff;border:2px solid #8B5A2B;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px}
    `;
    document.head.appendChild(css);
    
    const bubble = document.createElement('div');
    bubble.id = 'universalPenBubble';
    bubble.innerHTML = '<span style="font-size:20px">✏️</span>';
    
    const panel = document.createElement('div');
    panel.id = 'universalPenPanel';
    panel.innerHTML = `
      <div style="font-weight:900;font-size:.72rem;margin-bottom:6px">Tools</div>
      <div class="up-row">
        <button class="up-btn on" data-tool="pen" type="button">✏️</button>
        <button class="up-btn" data-tool="eraser" type="button">🧽</button>
        <button class="up-btn" data-act="undo" type="button">↩️</button>
        <button class="up-btn" data-act="redo" type="button">↪️</button>
        <button class="up-btn" data-act="clear" type="button">🗑️</button>
      </div>
      <div class="up-row">
        <span style="font-size:.65rem;font-weight:800">Size</span>
        <input type="range" min="1" max="8" step="0.5" value="${state.size}" id="upSize" style="flex:1;accent-color:#8B5A2B"/>
        <span id="upSizeLab" style="font-size:.65rem;font-weight:800;min-width:20px">${state.size}</span>
      </div>
      <div style="font-weight:800;font-size:.68rem;margin:6px 0 4px">Pen Type</div>
      <div class="up-row">
        <button class="up-btn on" data-type="normal" type="button">✏️</button>
        <button class="up-btn" data-type="cursive" type="button">🖋️</button>
        <button class="up-btn" data-type="rainbow" type="button">🌈</button>
        <button class="up-btn" data-type="glitter" type="button">✨</button>
      </div>
      <div style="font-weight:800;font-size:.68rem;margin:6px 0 4px">Colors</div>
      <div class="up-row" id="upColors"></div>
      <div style="font-weight:800;font-size:.68rem;margin:6px 0 4px">Stamps</div>
      <div class="up-row" id="upStamps"></div>
      <div style="font-weight:800;font-size:.68rem;margin:6px 0 4px">Stickers - tap to float</div>
      <div class="up-row" id="upStickers"></div>
    `;
    
    const sound = document.createElement('div');
    sound.id = 'universalPenSound';
    sound.textContent = state.soundOn ? '🔊' : '🔇';
    
    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    document.body.appendChild(sound);
    
    // Populate
    const cRow = document.getElementById('upColors');
    CFG.colors.forEach(c => {
      const d = document.createElement('div');
      d.className = 'up-dot' + (c===state.color?' on':'');
      d.style.background = c;
      d.onclick = () => { state.color = c; saveState(); updateUI(); };
      cRow.appendChild(d);
    });
    
    const sRow = document.getElementById('upStamps');
    CFG.stamps.forEach(s => {
      const b = document.createElement('button');
      b.className = 'up-btn'; b.textContent = s; b.onclick = () => stamp(s);
      sRow.appendChild(b);
    });
    
    const kRow = document.getElementById('upStickers');
    CFG.stickers.forEach(s => {
      const b = document.createElement('button');
      b.className = 'up-btn'; b.textContent = s; b.onclick = () => sticker(s);
      kRow.appendChild(b);
    });
    
    attach(bubble, panel, sound);
    drag(bubble);
  };
  
  const updateUI = () => {
    document.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === state.tool);
    });
    document.querySelectorAll('[data-type]').forEach(b => {
      b.classList.toggle('on', b.dataset.type === state.penType);
    });
    document.querySelectorAll('.up-dot').forEach((d,i) => {
      d.classList.toggle('on', CFG.colors[i] === state.color);
    });
  };
  
  const attach = (bubble, panel, sound) => {
    bubble.onclick = () => panel.classList.toggle('open');
    sound.onclick = () => {
      state.soundOn = !state.soundOn;
      sound.textContent = state.soundOn ? '🔊' : '🔇';
      saveState();
      if(state.soundOn) initAudio();
    };
    
    panel.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => {
      state.tool = b.dataset.tool; saveState(); updateUI();
    });
    panel.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
      state.penType = b.dataset.type; saveState(); updateUI();
    });
    panel.querySelectorAll('[data-act]').forEach(b => {
      if(b.dataset.act==='undo') b.onclick = undo;
      if(b.dataset.act==='redo') b.onclick = redo;
      if(b.dataset.act==='clear') b.onclick = clear;
    });
    document.getElementById('upSize').oninput = (e) => {
      state.size = parseFloat(e.target.value);
      document.getElementById('upSizeLab').textContent = state.size;
      saveState();
    };
    
    document.addEventListener('click', e => {
      const c = e.target.closest('canvas');
      if(c) { state.activeCanvas = c; state.ctx = c.getContext('2d'); }
    });
  };
  
  const drag = (el) => {
    let p = {x:0,y:0};
    el.onpointerdown = e => {
      e.preventDefault();
      p = {x:e.clientX, y:e.clientY};
      const mv = e => {
        el.style.left = (el.offsetLeft + e.clientX - p.x) + 'px';
        el.style.top = (el.offsetTop + e.clientY - p.y) + 'px';
        el.style.bottom = el.style.right = 'auto';
        p = {x:e.clientX, y:e.clientY};
      };
      const up = () => { document.onpointermove = null; document.onpointerup = null; };
      document.onpointermove = mv; document.onpointerup = up;
    };
  };
  
  const pos = e => {
    if(!state.activeCanvas) return null;
    const r = state.activeCanvas.getBoundingClientRect();
    const x = (e.touches?e.touches[0].clientX:e.clientX) - r.left;
    const y = (e.touches?e.touches[0].clientY:e.clientY) - r.top;
    return {x,y};
  };
  
  const start = e => {
    if(!state.activeCanvas || !state.ctx) return;
    e.preventDefault(); state.drawing = true;
    const p = pos(e);
    state.ctx.beginPath(); state.ctx.moveTo(p.x,p.y);
    state.ctx.lineCap = state.ctx.lineJoin = 'round';
    state.ctx.lineWidth = state.size;
    if(state.tool==='eraser') {
      state.ctx.globalCompositeOperation = 'destination-out'; playEraser();
    } else {
      state.ctx.globalCompositeOperation = 'source-over';
      if(state.penType==='rainbow') {
        state.ctx.strokeStyle = `hsl(${state.rainbowHue},100%,50%)`;
        state.rainbowHue = (state.rainbowHue+5)%360;
      } else if(state.penType==='glitter') {
        state.ctx.strokeStyle = state.color; state.ctx.shadowColor = state.color; state.ctx.shadowBlur = 8;
      } else {
        state.ctx.strokeStyle = state.color; state.ctx.shadowBlur = 0;
      }
      if(state.penType==='cursive') state.ctx.lineWidth = state.size * 0.7;
      playPen();
    }
  };
  
  const draw = e => {
    if(!state.drawing || !state.ctx) return;
    e.preventDefault();
    const p = pos(e);
    state.ctx.lineTo(p.x,p.y); state.ctx.stroke();
    if(state.tool!=='eraser' && state.penType==='rainbow') {
      state.ctx.strokeStyle = `hsl(${state.rainbowHue},100%,50%)`;
      state.rainbowHue = (state.rainbowHue+5)%360;
    }
  };
  
  const end = () => {
    if(!state.drawing) return;
    state.drawing = false;
    state.undoStack.push(state.activeCanvas.toDataURL());
    if(state.undoStack.length>20) state.undoStack.shift();
    state.redoStack = [];
  };
  
  const undo = () => {
    if(!state.ctx || state.undoStack.length<2) return;
    state.redoStack.push(state.undoStack.pop());
    const i = new Image();
    i.onload = () => { state.ctx.clearRect(0,0,state.activeCanvas.width,state.activeCanvas.height); state.ctx.drawImage(i,0,0); };
    i.src = state.undoStack[state.undoStack.length-1];
  };
  
  const redo = () => {
    if(!state.ctx || !state.redoStack.length) return;
    const i = new Image();
    i.onload = () => { state.ctx.clearRect(0,0,state.activeCanvas.width,state.activeCanvas.height); state.ctx.drawImage(i,0,0); state.undoStack.push(state.redoStack.pop()); };
    i.src = state.redoStack[state.redoStack.length-1];
  };
  
  const clear = () => {
    if(!state.ctx || !confirm('Clear all?')) return;
    end(); state.ctx.clearRect(0,0,state.activeCanvas.width,state.activeCanvas.height);
  };
  
  const stamp = em => {
    if(!state.ctx) return alert('Tap a writing area first');
    state.ctx.font = '32px serif';
    state.ctx.fillText(em, state.activeCanvas.width/2-16, state.activeCanvas.height/2+16);
    end();
  };
  
  const sticker = em => {
    const s = document.createElement('div');
    s.textContent = em;
    s.style.cssText = 'position:fixed;left:50%;top:50%;font-size:32px;cursor:grab;z-index:15;user-select:none;touch-action:none;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))';
    document.body.appendChild(s); drag(s);
    s.onclick = () => {
      if(s.dataset.sel) { s.style.outline='none'; s.dataset.sel=''; s.querySelector('div')?.remove(); }
      else {
        s.style.outline='2px dashed #8B5A2B'; s.dataset.sel='1';
        const c = document.createElement('div');
        c.style.cssText = 'position:absolute;top:-34px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(255,255,255,.96);border:2px solid #8B5A2B;border-radius:12px;padding:3px 5px';
        c.innerHTML = '<button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff">+</button><button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #E7D5B0;background:#fff">-</button><button type="button" style="width:26px;height:26px;border-radius:8px;border:1.5px solid #991B1B;background:#DC2626;color:#fff">X</button>';
        s.appendChild(c);
        c.children[0].onclick = e => { e.stopPropagation(); s.style.fontSize=(parseInt(s.style.fontSize)+4)+'px'; };
        c.children[1].onclick = e => { e.stopPropagation(); s.style.fontSize=Math.max(16,parseInt(s.style.fontSize)-4)+'px'; };
        c.children[2].onclick = e => { e.stopPropagation(); s.remove(); };
      }
    };
    setTimeout(()=>s.remove(),300000);
  };
  
  loadState();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();
  
  document.addEventListener('pointerdown', start);
  document.addEventListener('pointermove', draw);
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
