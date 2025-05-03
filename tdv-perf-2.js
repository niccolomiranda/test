/* -------------------------------------------------------------------------
   tdv‑perf.js       –  Fast WebGL • Clamp & Auto‑DPR • Shader Warm‑up
                        Lazy Point‑Cloud   •   Session Cache (SW)
   2025‑05‑05 • MIT / Public‑Domain – do as you like
   ------------------------------------------------------------------------- */

/* ════════════════════════ CONFIG – EDIT HERE ════════════════════════════ */
const PREVIEW_ID = '';             // e.g. 'cloud_medium'  – empty '' → skip
const ULTRA_ID   = '';             // e.g. 'cloud_ultra'   – empty '' → skip

const WIN_MP_BUDG   = 2_073_600;   // 1920×1080 cap on Windows
const OTHER_MP_BUDG = 8_294_400;   // 3840×2160 cap elsewhere
const SCALE_MIN     = 0.5;

const FPS_LO    = 45;              // shrink if < 45 FPS
const FPS_HI    = 55;              // grow   if > 55 FPS
const DROP_STEP = 0.25;            // 25 % shrink
const RISE_STEP = 0.10;            // 10 % grow

const USE_SW_CACHE = true;         // in‑memory cache for incognito sessions
/* ════════════════════════════════════════════════════════════════════════ */

/* 0️⃣ — (optional) spin‑up a session‑only Service Worker –––––––––––––––– */
if (USE_SW_CACHE && 'serviceWorker' in navigator) {
  try {
    const swCode = `
      self.addEventListener('fetch', e => {
        if (e.request.method !== 'GET') return;
        e.respondWith(
          caches.open('session').then(async c=>{
            const hit = await c.match(e.request);
            if (hit) return hit;
            const net = await fetch(e.request);
            c.put(e.request, net.clone());
            return net;
          })
        );
      });
    `;
    const blobURL = URL.createObjectURL(new Blob([swCode],{type:'text/javascript'}));
    navigator.serviceWorker.register(blobURL).catch(()=>{});
  } catch(_) {}
}

/* 1️⃣ — Fast‑path WebGL –––––––––––––––––––––––––––––––––––––––––––––––––– */
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o = {}) {
    if (/webgl/.test(t)) {
      Object.assign(o, { antialias: false, powerPreference: 'high-performance' });
      console.log('[CTX] fast‑path WebGL');
    }
    return orig.call(this, t, o);
  };
})();

/* 2️⃣ — Early clamp + adaptive DPR –––––––––––––––––––––––––––––––––––––– */
(() => {
  const TAG        = '[DPR]';
  const MAX_PIXELS = navigator.platform.startsWith('Win') ?
                     WIN_MP_BUDG : OTHER_MP_BUDG;
  let canvas, gl, scale = 1, frames = 0, stamp = performance.now();

  const L = (...a)=>console.log(TAG,...a);

  function resize(r='init') {
    const w = innerWidth, h = innerHeight, dpr = devicePixelRatio||1;
    let s   = Math.min(scale, dpr, 1);
    if (w*h*s*s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS/(w*h));
    s = Math.max(s, SCALE_MIN); scale = s;

    canvas.width  = (w*s)|0; canvas.height = (h*s)|0;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    gl?.viewport(0,0,canvas.width,canvas.height);
    L(r,'css',`${w}×${h}`,'scale',s.toFixed(2),'buf',`${canvas.width}×${canvas.height}`);
  }

  function fpsLoop() {
    frames++; const now = performance.now();
    if (now-stamp>=1000) {
      const fps = (frames*1000/(now-stamp))|0;
      if (fps<FPS_LO && scale>SCALE_MIN) {scale*=1-DROP_STEP; resize('fps↓'+fps);}
      else if (fps>FPS_HI && scale<1)     {scale=Math.min(scale*(1+RISE_STEP),1); resize('fps↑'+fps);}
      frames=0; stamp=now;
    }
    requestAnimationFrame(fpsLoop);
  }

  (function wait() {
    canvas = document.querySelector('canvas');
    if (!canvas) { requestAnimationFrame(wait); return; }
    gl = canvas.getContext('webgl2')||canvas.getContext('webgl');

    /* 3️⃣ — Shader warm‑up (hidden 1‑point draw) */
    (function warmShaders(){
      const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0]),gl.STATIC_DRAW);
      const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.POINTS,0,1);
      gl.deleteBuffer(b); gl.deleteVertexArray(vao);
      console.log('[Warm] shaders compiled');
    })();

    addEventListener('resize',()=>resize('rsz'),{passive:true});
    resize(); fpsLoop();
  })();
})();

/* 4️⃣ — Force every Model3D to keep clamp & AA‑off –––––––––––––––––––––– */
(() => {
  function patch(m){try{m.pixelRatioMinScale=0.5;}catch{} try{m.aaEnabled=false;}catch{}}
  const poll = setInterval(()=>{ if(!TDV?.Tour?.prototype) return;
    clearInterval(poll);
    const ORIG = TDV.Tour.prototype._initModel;
    TDV.Tour.prototype._initModel = function(m){ patch(m); return ORIG.apply(this,arguments); };
    console.log('[Clamp] pixelRatioMinScale→0.5 & AA‑off for all models');
  },100);
})();

/* 5️⃣ — Lazy‑swap point‑cloud (optional) –––––––––––––––––––––––––––––––– */
(() => {
  if(!PREVIEW_ID||!ULTRA_ID) return;
  let swapped=false;
  function swap(){if(swapped||!TDV?.Tour?.loadMedia)return;
    swapped=true; console.log('[Lazy] load ultra:',ULTRA_ID); TDV.Tour.loadMedia(ULTRA_ID);}
  const boot=setInterval(()=>{ if(!TDV?.Tour?.loadMedia) return;
    clearInterval(boot);
    console.log('[Lazy] load preview:',PREVIEW_ID);
    TDV.Tour.loadMedia(PREVIEW_ID);
  },100);
  ['pointerdown','touchstart','keydown'].forEach(ev=>addEventListener(ev,swap,{once:true,passive:true}));
})();