// shared/math-pen.js v1.2
// Maths pen: universal pen + Line tool (auto-snap + glow + ding)

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
      
      // Line drawing logic with snap + glow + ding
      let lineStart = null;
      document.addEventListener('pointerdown', e => {
        if(window.UniversalPen?.state.tool === 'line') {
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
      });
      
      document.addEventListener('pointerup', e => {
        if(window.UniversalPen?.state.tool === 'line' && lineStart) {
          const r = lineStart.canvas.getBoundingClientRect();
          const end = {
            x: (e.touches?e.changedTouches[0].clientX:e.clientX) - r.left,
            y: (e.touches?e.changedTouches[0].clientY:e.clientY) - r.top
          };
          
          const ctx = lineStart.ctx;
          ctx.save();
          ctx.strokeStyle = '#8B5A2B';
          ctx.lineWidth = window.UniversalPen.state.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(lineStart.x, lineStart.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          
          // Gold glow
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = window.UniversalPen.state.size + 4;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.restore();
          
          window.UniversalPen.playDing();
          
          // Fade glow after 500ms
          setTimeout(() => {
            ctx.save();
            ctx.strokeStyle = '#8B5A2B';
            ctx.lineWidth = window.UniversalPen.state.size;
            ctx.beginPath();
            ctx.moveTo(lineStart.x, lineStart.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.restore();
            
            // Save to undo stack
            window.UniversalPen.state.undoStack.push(lineStart.canvas.toDataURL());
            window.UniversalPen.state.redoStack = [];
          }, 500);
          
          lineStart = null;
        }
      });
    }, 100);
  };
  document.head.appendChild(script);
})();
