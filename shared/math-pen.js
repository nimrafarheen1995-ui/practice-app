/**
 * math-pen.js - WHITE THEME vertical stack + 📏 ruler for Maths
 * Same layout as universal-pen.js but adds ruler/scale tool
 * For S9/S11 portrait tablets
 */
(function() {
  const CONFIG = {
    themeBg: '#FFFFFF',
    borderColor: '#8B5A2B',
    activeBg: '#FEF3C7',
    iconSize: 36,
    stamps: ['⭐','😡','❤','😊','🌸','♻','🌿','🌍','✅','❌','💯','🎉'],
    stickers: ['🌿','🌍','⭐','🌸','💧','♻','🌳','🧹'],
    bubblePos: 'bottom-right'
  };

  const STYLE = `
  #math-pen-root { position: fixed; z-index: 9999; font-family: system-ui; }
  #math-pen-root.br { bottom: 18px; right: 18px; }
  #math-pen-bubble {
    width: 56px; height: 56px; background: ${CONFIG.themeBg};
    border: 2px solid ${CONFIG.borderColor}; border-radius: 50%;
    display: grid; place-items: center; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,.15); font-size: 26px;
    user-select: none; -webkit-tap-highlight-color: transparent;
  }
  #math-pen-panel {
    position: absolute; bottom: 68px; right: 0;
    background: ${CONFIG.themeBg}; border: 2px solid ${CONFIG.borderColor};
    border-radius: 16px; padding: 10px; width: 270px;
    box-shadow: 0 8px 24px rgba(0,0,0,.18); display: none;
    flex-direction: column; gap: 8px;
  }
  #math-pen-panel.open { display: flex; }
  .pen-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-start; }
  .pen-icon {
    width: ${CONFIG.iconSize}px; height: ${CONFIG.iconSize}px;
    background: #fff; border: 1.5px solid ${CONFIG.borderColor};
    border-radius: 8px; display: grid; place-items: center;
    cursor: pointer; font-size: 18px; transition: .15s;
  }
  .pen-icon.active { background: ${CONFIG.activeBg}; border-width: 2px; transform: scale(1.05); }
  .pen-label { font-size: 11px; font-weight: 700; color: ${CONFIG.borderColor}; margin: 4px 2px 0; letter-spacing: .5px; }
  .pen-slider { width: 100%; accent-color: ${CONFIG.borderColor}; }
  .pen-divider { height: 1px; background: #E7D5B8; margin: 2px 0; }
  #pen-sound-toggle-math {
    position: fixed; bottom: 18px; left: 18px; z-index: 9998;
    width: 44px; height: 44px; background: #fff; border: 2px solid ${CONFIG.borderColor};
    border-radius: 50%; display: grid; place-items: center; cursor: pointer; font-size: 20px;
  }
  #math-ruler-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9997; display: none;
  }
  #math-ruler-overlay.show { display: block; }
  .ruler-line {
    position: absolute; top: 50%; left: 10%; right: 10%; height: 60px;
    background: repeating-linear-gradient(90deg, ${CONFIG.borderColor} 0 2px, transparent 2px 20px);
    border-top: 2px solid ${CONFIG.borderColor}; border-bottom: 2px solid ${CONFIG.borderColor};
    background-color: rgba(255,255,255,.85); pointer-events: auto; cursor: move; touch-action: none;
    display: flex; align-items: center; justify-content: space-between; padding: 0 8px; font-size: 12px; color: ${CONFIG.borderColor};
  }
  `;

  function injectStyle() {
    if (document.getElementById('math-pen-style')) return;
    const s = document.createElement('style');
    s.id = 'math-pen-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function createUI() {
    injectStyle();
    if (document.getElementById('math-pen-root')) return;

    const root = document.createElement('div');
    root.id = 'math-pen-root';
    root.className = 'br';
    root.innerHTML = `
      <div id="math-pen-panel">
        <div class="pen-label">TOOLS</div>
        <div class="pen-row" id="pen-tools-math">
          <div class="pen-icon active" data-tool="pen" title="Pen">✏️</div>
          <div class="pen-icon" data-tool="eraser" title="Eraser">🧽</div>
          <div class="pen-icon" data-tool="ruler" title="Ruler">📏</div>
          <div class="pen-icon" data-tool="undo" title="Undo">↩️</div>
          <div class="pen-icon" data-tool="redo" title="Redo">↪️</div>
          <div class="pen-icon" data-tool="clear" title="Clear">🗑️</div>
        </div>
        <div class="pen-divider"></div>
        <div class="pen-label">SIZE</div>
        <input type="range" min="2" max="24" value="4" class="pen-slider" id="pen-size-math">
        <div class="pen-row"><span style="font-size:11px;color:#8B5A2B">Pen / Eraser thickness</span></div>
        <div class="pen-divider"></div>
        <div class="pen-label">STAMPS (12)</div>
        <div class="pen-row" id="pen-stamps-math"></div>
        <div class="pen-divider"></div>
        <div class="pen-label">STICKERS (8)</div>
        <div class="pen-row" id="pen-stickers-math"></div>
      </div>
      <div id="math-pen-bubble">✏️</div>
    `;
    document.body.appendChild(root);

    const soundBtn = document.createElement('div');
    soundBtn.id = 'pen-sound-toggle-math';
    soundBtn.textContent = '🔊';
    soundBtn.title = 'Mute/Unmute sounds';
    document.body.appendChild(soundBtn);

    const rulerOverlay = document.createElement('div');
    rulerOverlay.id = 'math-ruler-overlay';
    rulerOverlay.innerHTML = `<div class="ruler-line"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10 cm</span></div>`;
    document.body.appendChild(rulerOverlay);

    const stampsEl = root.querySelector('#pen-stamps-math');
    CONFIG.stamps.forEach(s => {
      const d = document.createElement('div');
      d.className = 'pen-icon'; d.textContent = s; d.dataset.stamp = s;
      stampsEl.appendChild(d);
    });
    const stickersEl = root.querySelector('#pen-stickers-math');
    CONFIG.stickers.forEach(s => {
      const d = document.createElement('div');
      d.className = 'pen-icon'; d.textContent = s; d.dataset.sticker = s;
      stickersEl.appendChild(d);
    });

    return { root, rulerOverlay };
  }

  function attachLogic() {
    const { root, rulerOverlay } = createUI() || {};
    if (!root) return;
    const bubble = document.getElementById('math-pen-bubble');
    const panel = document.getElementById('math-pen-panel');
    const soundToggle = document.getElementById('pen-sound-toggle-math');
    let soundOn = true;
    let currentTool = 'pen';
    let penSize = 4;
    let rulerVisible = false;

    function toggleRuler() {
      rulerVisible = !rulerVisible;
      rulerOverlay.classList.toggle('show', rulerVisible);
      // draggable
      const line = rulerOverlay.querySelector('.ruler-line');
      let startY=0, startTop=0, dragging=false;
      line.addEventListener('touchstart', (e)=>{
        dragging=true; startY=e.touches[0].clientY; startTop=line.offsetTop;
      });
      line.addEventListener('touchmove', (e)=>{
        if(!dragging) return; e.preventDefault();
        const dy = e.touches[0].clientY - startY;
        line.style.top = (startTop + dy) + 'px';
      }, {passive:false});
      line.addEventListener('touchend', ()=> dragging=false);
      line.addEventListener('mousedown', (e)=>{
        dragging=true; startY=e.clientY; startTop=line.offsetTop;
        const onMove = (ev)=>{ if(!dragging) return; line.style.top = (startTop + ev.clientY - startY)+'px'; };
        const onUp = ()=>{ dragging=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
      });
    }

    bubble.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (navigator.vibrate) navigator.vibrate(10);
    });

    soundToggle.addEventListener('click', () => {
      soundOn = !soundOn;
      soundToggle.textContent = soundOn ? '🔊' : '🔇';
    });

    root.querySelectorAll('.pen-icon[data-tool]').forEach(el => {
      el.addEventListener('click', () => {
        const tool = el.dataset.tool;
        if (tool==='ruler') {
          toggleRuler();
          el.classList.toggle('active');
          return;
        }
        root.querySelectorAll('.pen-icon[data-tool]').forEach(i=>{ if(i.dataset.tool!=='ruler') i.classList.remove('active'); });
        if (['pen','eraser'].includes(tool)) el.classList.add('active');
        currentTool = tool;
        if (window.NotebookAPI) {
          if (currentTool==='pen') NotebookAPI.setTool('pen', penSize);
          if (currentTool==='eraser') NotebookAPI.setTool('eraser', penSize*2.5);
          if (currentTool==='undo') NotebookAPI.undo();
          if (currentTool==='redo') NotebookAPI.redo();
          if (currentTool==='clear') { if(confirm('Clear page?')) NotebookAPI.clear(); }
        }
      });
    });

    document.getElementById('pen-size-math').addEventListener('input', (e) => {
      penSize = parseInt(e.target.value);
      if (window.NotebookAPI && currentTool==='pen') NotebookAPI.setTool('pen', penSize);
      if (window.NotebookAPI && currentTool==='eraser') NotebookAPI.setTool('eraser', penSize*2.5);
    });

    root.querySelectorAll('[data-stamp]').forEach(el => {
      el.addEventListener('click', () => {
        if (window.NotebookAPI) NotebookAPI.addStamp(el.dataset.stamp, penSize);
      });
    });
    root.querySelectorAll('[data-sticker]').forEach(el => {
      el.addEventListener('click', () => {
        if (window.NotebookAPI) NotebookAPI.addSticker(el.dataset.sticker);
      });
    });

    window.MathPen = { CONFIG, rulerVisible: () => rulerVisible };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachLogic);
  else attachLogic();
})();
