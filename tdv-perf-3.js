/* ---------------------------------------------------------------
   tdv‑perf.js  (v1.0.1)  –  Fast WebGL • Clamp & Auto‑DPR
                             Shader Warm‑up (safe) • Lazy splats
   --------------------------------------------------------------- */

/* ‥‥‥ CONFIG (unchanged) ‥‥‥ */
const PREVIEW_ID='', ULTRA_ID='';
const WIN_MP_BUDG=2_073_600, OTHER_MP_BUDG=8_294_400, SCALE_MIN=0.5;
const FPS_LO=45, FPS_HI=55, DROP_STEP=0.25, RISE_STEP=0.10;
const USE_SW_CACHE=true;

/* 0️⃣ session SW (unchanged) … */
/* 1️⃣ fast‑path WebGL (unchanged) … */

/* 2️⃣ clamp + adaptive DPR + **safe shader warm‑up** */
(() => {
  const TAG='[DPR]';
  const MAX_PIXELS = navigator.platform.startsWith('Win') ? WIN_MP_BUDG : OTHER_MP_BUDG;
  let canvas, gl, scale=1, frames=0, stamp=performance.now();
  const L=(...a)=>console.log(TAG,...a);

  function resize(r='init'){
    const w=innerWidth,h=innerHeight,dpr=devicePixelRatio||1;
    let s=Math.min(scale,dpr,1);
    if(w*h*s*s>MAX_PIXELS)s=Math.sqrt(MAX_PIXELS/(w*h));
    s=Math.max(s,SCALE_MIN); scale=s;
    canvas.width=(w*s)|0; canvas.height=(h*s)|0;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    gl?.viewport(0,0,canvas.width,canvas.height);
    L(r,'css',`${w}×${h}`,'scale',s.toFixed(2),'buf',`${canvas.width}×${canvas.height}`);
  }
  function fpsLoop(){frames++;const now=performance.now();
    if(now-stamp>=1000){
      const fps=(frames*1000/(now-stamp))|0;
      if(fps<FPS_LO&&scale>SCALE_MIN){scale*=1-DROP_STEP;resize('fps↓'+fps);}
      else if(fps>FPS_HI&&scale<1){scale=Math.min(scale*(1+RISE_STEP),1);resize('fps↑'+fps);}
      frames=0; stamp=now;}
    requestAnimationFrame(fpsLoop);}

  (function wait(){
    canvas=document.querySelector('canvas');
    if(!canvas){requestAnimationFrame(wait);return;}
    gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    if(gl){ /* ── safe warm‑up ── */
      const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0]),gl.STATIC_DRAW);
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.POINTS,0,1);
      gl.deleteBuffer(b);gl.deleteVertexArray(vao);
      console.log('[Warm] shaders compiled');
    } else console.warn('[Warm] no WebGL context – skip pre‑compile');

    addEventListener('resize',()=>resize('rsz'),{passive:true});
    resize(); fpsLoop();
  })();
})();

/* 4️⃣ force Model3D clamp (unchanged) … */
/* 5️⃣ lazy‑swap splats (unchanged) … */