// shared/math-pen.js v1.3
// Maths pen: universal pen + Line tool (Exact 5.6 Exercise - NO glow)

(function(){
  const script = document.createElement('script');
  script.src = 'shared/universal-pen.js';
  script.onload = () => {
    setTimeout(() => {
      const bar = document.getElementById('penBar');
      if(!bar) return;
      
      // Insert line tool between pen and eraser
      const lineBtn = document.createElement('div');
      lineBtn.className = 'pen-btn';
      lineBtn.dataset.tool = 'line';
      lineBtn.textContent = '📏';
      lineBtn.title = 'Straight Line';
      
      const eraser = bar.querySelector('[data-tool="eraser"]');
      bar.insertBefore(lineBtn, eraser);
      
      lineBtn.onclick = (e) => {
        e.stopPropagation();
        window.UniversalPen.state.tool = 'line';
        window.UniversalPen.saveState();
        bar.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('on'));
        lineBtn.classList.add('on');
      };
      
      // Line drawing - EXACT 5.6 Exercise code - NO GLOW
      let lineStart = null;
      
      document.addEventListener('pointerdown', e => {
        if(window.UniversalPen?.state.tool === 'line') {
          e.stopImmediatePropagation(); // Prevent pen from also drawing
          const c = e.target.closest('canvas');
          if(c) {
            const r = c.getBoundingClientRect();
            lineStart = {
              x: (e.touches?e.touches[0].clientX:e.clientX) - r.left,
              y: (e.touches?e.touches[0].clientY:e.clientY) - r.top,
              canvas: c,
              ctx: c.getContext('2d')
            };
          }
        }
      }, true); // Capture phase to intercept before pen
      
      document.addEventListener('pointerup', e => {
        if(window.UniversalPen?.state.tool === 'line' && lineStart) {
          const r = lineStart.canvas.getBoundingClientRect();
          const end = {
            x: (e.touches?e.changedTouches[0].clientX:e.clientX) - r.left,
            y: (e.touches?e.changedTouches[0].clientY:e.clientY) - r.top
          };
          
          const ctx = lineStart.ctx;
          ctx.save();
          ctx.strokeStyle = '#8B5A2B';  // Dark brown - 5.6 style
          ctx.lineWidth = 2.5;          // Thin - 5.6 style
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(lineStart.x, lineStart.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          ctx.restore();
          
          // NO GLOW - removed per user request
          window.UniversalPen.playDing();
          
          // Save to undo stack
          window.UniversalPen.state.undoStack.push(lineStart.canvas.toDataURL());
          window.UniversalPen.state.redoStack = [];
          
          lineStart = null;
        }
      }, true);
    }, 100);
  };
  document.head.appendChild(script);
})();
