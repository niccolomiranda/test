/* -------------------------------------------------------------------------
   tdv‑perf.js  (v1.0.2)   –  Fast WebGL • Clamp & Auto‑DPR
                             Early Font‑swap  •  Guaranteed Shader Warm‑up
                             Lazy Point‑Cloud •  Session Cache (SW)
   2025‑05‑05 • MIT / Public‑Domain
   ------------------------------------------------------------------------- */

/* ‥‥‥ CONFIG (unchanged) ‥‥‥ */
const PREVIEW_ID='', ULTRA_ID='';
const WIN_MP_BUDG=2_073_600, OTHER_MP_BUDG=8_294_400, SCALE_MIN=0.5;
const FPS_LO=45, FPS_HI=55, DROP_STEP=0.25, RISE_STEP=0.10;
const USE_SW_CACHE=true;

/* 0️⃣  – Session‑only Service‑Worker cache (unchanged) */
if (USE_SW_CACHE && 'serviceWorker' in navigator){ try{
  const code=`self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  e.respondWith(caches.open('session').then(async c=>{const h=await c.match(e.request);
  if(h)return h;const n=await fetch(e.request);c.put(e.request,n.clone());return n;}));});`;
  const blobURL=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  navigator.serviceWorker.register(blobURL).catch(()=>{});
}catch(_){} }

/* 1️⃣  – Non‑blocking fonts + preload ----------------------------------- */
(() => {
  const css   = `@font-face{font-display:swap!important}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  ['Open%20Sans.woff','Noticia%20Text%20Bold.woff'].forEach(f => {
    const l=document.createElement('link');
    l.rel='preload'; l.as='font'; l.crossOrigin='anonymous';
    l.href=`https://storage.net-fs.com/hosting/8375805/0/fonts/${f}`;
    document.head.appendChild(l);
  });
})();

/* 2️⃣  – Fast‑path WebGL (unchanged) ------------------------------------- */
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t,o={}){
    if(/webgl/.test(t)){Object.assign(o,{antialias:false,powerPreference:'high-performance'});
      console.log('[CTX] fast‑path WebGL');}
    return orig.call(this,t,o);};
})();

/* 3️⃣  – Early clamp + auto‑DPR + SAFE shader warm‑up ------------------- */
(() => {
  const TAG='[DPR]';
  const MAX_PIXELS = navigator.platform.startsWith('Win') ? WIN_MP_BUDG : OTHER_MP_BUDG;
  let canvas, gl, scale=1, frames=0, stamp=performance.now();
  const L=(...a)=>console.log(TAG,...a);

  /* shader warm‑up on a hidden dummy canvas – before 3DVista boots */
  (function prewarm(){
    try{
      const c=document.createElement('canvas'); c.width=c.height=1;
      const g=c.getContext('webgl2',{antialias:false, powerPreference:'high-performance'});
      if(!g){console.warn('[Warm] could not create dummy context'); return;}
      const b=g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER,b);
      g.bufferData(g.ARRAY_BUFFER,new Float32Array([0,0,0]),g.STATIC_DRAW);
      const vao=g.createVertexArray(); g.bindVertexArray(vao);
      g.enableVertexAttribArray(0);
      g.vertexAttribPointer(0,3,g.FLOAT,false,0,0);
      g.drawArrays(g.POINTS,0,1);
      console.log('[Warm] shaders compiled in dummy ctx');
      g.getExtension('WEBGL_lose_context')?.loseContext();
    }catch(e){console.warn('[Warm] pre‑compile failed',e);}
  })();

  function resize(r='init'){
    const w=innerWidth,h=innerHeight,dpr=devicePixelRatio||1;
    let s=Math.min(scale,dpr,1); if(w*h*s*s>MAX_PIXELS)s=Math.sqrt(MAX_PIXELS/(w*h));
    s=Math.max(s,SCALE_MIN); scale=s;
    canvas.width=(w*s)|0; canvas.height=(h*s)|0;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    gl?.viewport(0,0,canvas.width,canvas.height);
    L(r,'css',`${w}×${h}`,'scale',s.toFixed(2),'buf',`${canvas.width}×${canvas.height}`);}
  function loop(){frames++;const now=performance.now();
    if(now-stamp>=1000){const fps=(frames*1000/(now-stamp))|0;
      if(fps<FPS_LO&&scale>SCALE_MIN){scale*=1-DROP_STEP;resize('fps↓'+fps);}
      else if(fps>FPS_HI&&scale<1){scale=Math.min(scale*(1+RISE_STEP),1);resize('fps↑'+fps);}
      frames=0; stamp=now;} requestAnimationFrame(loop);}

  (function wait(){
    canvas=document.querySelector('canvas');
    if(!canvas){requestAnimationFrame(wait);return;}
    gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    addEventListener('resize',()=>resize('rsz'),{passive:true});
    resize(); loop();
  })();
})();

/* 4️⃣  – Force Model3D clamp & AA‑off (unchanged) ----------------------- */
(() => {
  function patch(m){try{m.pixelRatioMinScale=0.5;}catch{}
                    try{m.aaEnabled=false;}catch{}}
  const poll=setInterval(()=>{if(!TDV?.Tour?.prototype)return;
    clearInterval(poll);
    const ORIG=TDV.Tour.prototype._initModel;
    TDV.Tour.prototype._initModel=function(m){patch(m);return ORIG.apply(this,arguments);};
    console.log('[Clamp] pixelRatioMinScale→0.5 & AA‑off for all models');},100);
})();

/* 5️⃣  – Lazy point‑cloud swap (unchanged) ------------------------------ */
(() => {
  if(!PREVIEW_ID||!ULTRA_ID)return; let swapped=false;
  function swap(){if(swapped||!TDV?.Tour?.loadMedia)return;
    swapped=true; console.log('[Lazy] load ultra:',ULTRA_ID); TDV.Tour.loadMedia(ULTRA_ID);}
  const boot=setInterval(()=>{if(!TDV?.Tour?.loadMedia)return;
    clearInterval(boot); console.log('[Lazy] load preview:',PREVIEW_ID);
    TDV.Tour.loadMedia(PREVIEW_ID);},100);
  ['pointerdown','touchstart','keydown'].forEach(ev=>addEventListener(ev,swap,{once:true,passive:true}));
})();