/**
 * universal-pen.js - WHITE THEME vertical stack for EVS & all non-maths
 * For S9/S11 portrait tablets, sunlight readable
 * Features: pen, eraser, undo/redo, clear, 12 stamps, 8 stickers, thickness, sounds
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
  #uni-pen-root { position: fixed; z-index: 9999; font-family: system-ui; }
  #uni-pen-root.br { bottom: 18px; right: 18px; }
  #uni-pen-bubble {
    width: 56px; height: 56px; background: ${CONFIG.themeBg};
    border: 2px solid ${CONFIG.borderColor}; border-radius: 50%;
    display: grid; place-items: center; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,.15); font-size: 26px;
    user-select: none; -webkit-tap-highlight-color: transparent;
  }
  #uni-pen-panel {
    position: absolute; bottom: 68px; right: 0;
    background: ${CONFIG.themeBg}; border: 2px solid ${CONFIG.borderColor};
    border-radius: 16px; padding: 10px; width: 260px;
    box-shadow: 0 8px 24px rgba(0,0,0,.18); display: none;
    flex-direction: column; gap: 8px;
  }
  #uni-pen-panel.open { display: flex; }
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
  #pen-sound-toggle {
    position: fixed; bottom: 18px; left: 18px; z-index: 9998;
    width: 44px; height: 44px; background: #fff; border: 2px solid ${CONFIG.borderColor};
    border-radius: 50%; display: grid; place-items: center; cursor: pointer; font-size: 20px;
  }
  `;

  function injectStyle() {
    if (document.getElementById('uni-pen-style')) return;
    const s = document.createElement('style');
    s.id = 'uni-pen-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function createUI() {
    injectStyle();
    if (document.getElementById('uni-pen-root')) return;

    const root = document.createElement('div');
    root.id = 'uni-pen-root';
    root.className = 'br';
    root.innerHTML = `
      <div id="uni-pen-panel">
        <div class="pen-label">TOOLS</div>
        <div class="pen-row" id="pen-tools">
          <div class="pen-icon active" data-tool="pen" title="Pen">✏️</div>
          <div class="pen-icon" data-tool="eraser" title="Eraser">🧽</div>
          <div class="pen-icon" data-tool="undo" title="Undo">↩️</div>
          <div class="pen-icon" data-tool="redo" title="Redo">↪️</div>
          <div class="pen-icon" data-tool="clear" title="Clear">🗑️</div>
        </div>
        <div class="pen-divider"></div>
        <div class="pen-label">SIZE</div>
        <input type="range" min="2" max="24" value="4" class="pen-slider" id="pen-size">
        <div class="pen-row"><span style="font-size:11px;color:#8B5A2B">Pen / Eraser thickness</span></div>
        <div class="pen-divider"></div>
        <div class="pen-label">STAMPS (12)</div>
        <div class="pen-row" id="pen-stamps"></div>
        <div class="pen-divider"></div>
        <div class="pen-label">STICKERS (8)</div>
        <div class="pen-row" id="pen-stickers"></div>
      </div>
      <div id="uni-pen-bubble">✏️</div>
    `;
    document.body.appendChild(root);

    const soundBtn = document.createElement('div');
    soundBtn.id = 'pen-sound-toggle';
    soundBtn.textContent = '🔊';
    soundBtn.title = 'Mute/Unmute sounds';
    document.body.appendChild(soundBtn);

    const stampsEl = root.querySelector('#pen-stamps');
    CONFIG.stamps.forEach(s => {
      const d = document.createElement('div');
      d.className = 'pen-icon'; d.textContent = s; d.dataset.stamp = s;
      stampsEl.appendChild(d);
    });
    const stickersEl = root.querySelector('#pen-stickers');
    CONFIG.stickers.forEach(s => {
      const d = document.createElement('div');
      d.className = 'pen-icon'; d.textContent = s; d.dataset.sticker = s;
      stickersEl.appendChild(d);
    });

    return root;
  }

  // Core logic hooks - connects to your existing notebook.js canvas if present
  function attachLogic() {
    const root = createUI();
    const bubble = document.getElementById('uni-pen-bubble');
    const panel = document.getElementById('uni-pen-panel');
    const soundToggle = document.getElementById('pen-sound-toggle');
    let soundOn = true;
    let currentTool = 'pen';
    let penSize = 4;

    const audioPen = new Audio(); audioPen.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRyAgAAAAEA'; // placeholder soft pop
    const audioEraser = new Audio();

    function play(t) {
      if (!soundOn) return;
      try { if (t==='pen') audioPen.currentTime=0, audioPen.play().catch(()=>{}); } catch(e){}
    }

    bubble.addEventListener('click', () => {
      panel.classList.toggle('open');
      // haptic for kids
      if (navigator.vibrate) navigator.vibrate(10);
    });

    soundToggle.addEventListener('click', () => {
      soundOn = !soundOn;
      soundToggle.textContent = soundOn ? '🔊' : '🔇';
      soundToggle.style.background = soundOn ? '#fff' : '#FEF3C7';
    });

    root.querySelectorAll('.pen-icon[data-tool]').forEach(el => {
      el.addEventListener('click', () => {
        root.querySelectorAll('.pen-icon[data-tool]').forEach(i=>i.classList.remove('active'));
        if (['pen','eraser'].includes(el.dataset.tool)) el.classList.add('active');
        currentTool = el.dataset.tool;
        if (window.NotebookAPI) {
          if (currentTool==='pen') NotebookAPI.setTool('pen', penSize);
          if (currentTool==='eraser') NotebookAPI.setTool('eraser', penSize*2.5);
          if (currentTool==='undo') NotebookAPI.undo();
          if (currentTool==='redo') NotebookAPI.redo();
          if (currentTool==='clear') { if(confirm('Clear page?')) NotebookAPI.clear(); }
        }
        play(currentTool);
        if (['undo','redo','clear'].includes(currentTool)) setTimeout(()=>{ currentTool='pen'; }, 200);
      });
    });

    document.getElementById('pen-size').addEventListener('input', (e) => {
      penSize = parseInt(e.target.value);
      if (window.NotebookAPI && currentTool==='pen') NotebookAPI.setTool('pen', penSize);
      if (window.NotebookAPI && currentTool==='eraser') NotebookAPI.setTool('eraser', penSize*2.5);
    });

    root.querySelectorAll('[data-stamp]').forEach(el => {
      el.addEventListener('click', () => {
        if (window.NotebookAPI) NotebookAPI.addStamp(el.dataset.stamp, penSize);
        play('pen');
        if (navigator.vibrate) navigator.vibrate(15);
      });
    });
    root.querySelectorAll('[data-sticker]').forEach(el => {
      el.addEventListener('click', () => {
        if (window.NotebookAPI) NotebookAPI.addSticker(el.dataset.sticker);
        play('pen');
      });
    });

    // expose
    window.UniversalPen = { CONFIG, soundOn: () => soundOn, tool: () => currentTool };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachLogic);
  else attachLogic();
})();
