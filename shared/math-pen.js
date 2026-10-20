// shared/math-pen.js v1.0
// Maths pen: universal pen + Line tool (auto-snap + glow + ding)
// For zaina-maths-*.html

(function(){
  // Load universal pen first
  const script = document.createElement('script');
  script.src = 'shared/universal-pen.js';
  script.onload = () => {
    // Add line tool after universal loads
    setTimeout(() => {
      const panel = document.getElementById('universalPenPanel');
      if(!panel) return;
      
      const lineBtn = document.createElement('button');
      lineBtn.className = 'up-btn';
      lineBtn.dataset.tool = 'line';
      lineBtn.type = 'button';
      lineBtn.textContent = '📏';
      lineBtn.title = 'Straight Line';
      
      const firstRow = panel.querySelector('.up-row');
      firstRow.insertBefore(lineBtn, firstRow.children[1]); // After pen, before eraser
      
      // Web Audio ding for line snap
      let audioCtx;
      const playDing = () => {
        if(!window.UniversalPen?.state.soundOn) return;
        if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
      };
      
      // Override line drawing
      let lineStart = null;
      document.addEventListener('pointerdown', e => {
        if(window.UniversalPen?.state.tool === 'line') {
          const c = e.target.closest('canvas');
          if(c) lineStart = {x: e.clientX - c.getBoundingClientRect().left, y: e.clientY - c.getBoundingClientRect().top, canvas: c};
        }
      });
      
      document.addEventListener('pointerup', e => {
        if(window.UniversalPen?.state.tool === 'line' && lineStart) {
          const c = lineStart.canvas;
          const ctx = c.getContext('2d');
          const end = {x: e.clientX - c.getBoundingClientRect().left, y: e.clientY - c.getBoundingClientRect().top};
          
          // Draw snapped line
          ctx.save();
          ctx.strokeStyle = '#8B5A2B';
          ctx.lineWidth = window.UniversalPen.state.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(lineStart.x, lineStart.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          
          // Glow effect
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = window.UniversalPen.state.size + 4;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.restore();
          
          playDing();
          setTimeout(() => {
            ctx.save();
            ctx.strokeStyle = '#8B5A2B';
            ctx.lineWidth = window.UniversalPen.state.size;
            ctx.beginPath();
            ctx.moveTo(lineStart.x, lineStart.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.restore();
          }, 500);
          
          lineStart = null;
        }
      });
    }, 100);
  };
  document.head.appendChild(script);
})();
