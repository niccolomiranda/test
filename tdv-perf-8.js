/*  tdv‑perf.js  v1.0.6  ─────────────────────────────────────────────────
    Fast WebGL • DPR Memory • Real Shader Warm‑up
    Preview‑first Gaussian Splat (lock until ultra ready)
    Font‑swap + CDN preload • Safe incognito RAM cache
   --------------------------------------------------------------------- */

/* ─── CONFIG  (fill in real values – no placeholders!) ─────────────── */
const PREVIEW_ID        = 'cloud_medium';          // required
const ULTRA_ID          = 'cloud_ultra';           // required
const ULTRA_URL         = 'https://your‑cdn.com/3dv/cloud_ultra.bin'; // required
const ULTRA_READY_EVENT = 'modelready';            // usually 'modelready'

const FONT_CDN = 'https://cdn.jsdelivr.net/gh/YOUR_GH_USER/your-repo@main/static/fonts/';

const WIN_MP_BUDG = 2_073_600, OTHER_MP_BUDG = 8_294_400, SCALE_MIN = 0.5;
const FPS_LO = 45, FPS_HI = 55, DROP_STEP = 0.25, RISE_STEP = 0.10;
const USE_SW_CACHE = true;
/* ──────────────────────────────────────────────────────────────────── */

/* guard against forgotten placeholders */
['PREVIEW_ID','ULTRA_ID','ULTRA_URL'].forEach(k=>{
  if (eval(k).includes('your')||!eval(k)) {
    console.error('[TDV‑PERF] CONFIG error – update', k); throw new Error('Bad config');
  }
});

/* 0️⃣  prefetch ultra */
fetch(ULTRA_URL, {mode:'no-cors'}).catch(e=>{
  console.warn('[TDV‑PERF] ULTRA prefetch failed', e.message);
});

/* 1️⃣  session‑only SW cache (unchanged) */
if (USE_SW_CACHE && 'serviceWorker' in navigator) try {
  const sw=`self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  e.respondWith(caches.open('session').then(async c=>{const h=await c.match(e.request);
  if(h)return h;const n=await fetch(e.request);c.put(e.request,n.clone());return n;}));});`;
  navigator.serviceWorker.register(
    URL.createObjectURL(new Blob([sw],{type:'text/javascript'}))
  ).catch(()=>{});
} catch{}

/* 2️⃣  font‑swap + preload */
(() => {
  const style=document.createElement('style');
  style.textContent='@font-face{font-display:swap!important}';
  document.head.appendChild(style);
  [{f:'OpenSans.woff',  t:'font/woff'},
   {f:'NoticiaTextBold.woff',t:'font/woff'}].forEach(o=>{
    const l=document.createElement('link');
    l.rel='preload'; l.as='font'; l.type=o.t; l.crossOrigin='anonymous';
    l.href=FONT_CDN+o.f; document.head.appendChild(l);
  });
})();

/* 3️⃣  fast‑path WebGL */
(()=>{const o=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t,opts={}){
  if(/webgl/.test(t)){Object.assign(opts,{antialias:false,powerPreference:'high-performance'});
    console.log('[TDV‑PERF] fast GL');}
  return o.call(this,t,opts);};})();

/* 4️⃣  real shader warm‑up */
(()=>{try{
  const c=document.createElement('canvas');c.width=c.height=1;
  const gl=c.getContext('webgl2',{antialias:false,powerPreference:'high-performance'});
  if(!gl)throw 0;
  const V=gl.createShader(gl.VERTEX_SHADER);gl.shaderSource(V,'#version 300 es\nin vec3 p;void main(){gl_Position=vec4(p,1);}');gl.compileShader(V);
  const F=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(F,'#version 300 es\nprecision mediump float;out vec4 c;void main(){c=vec4(1);}');gl.compileShader(F);
  const P=gl.createProgram();gl.attachShader(P,V);gl.attachShader(P,F);gl.linkProgram(P);gl.useProgram(P);
  const B=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,B);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.drawArrays(gl.POINTS,0,1);
  console.log('[TDV‑PERF] shader cache ready');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
}catch(e){console.warn('[TDV‑PERF] warm‑up skipped',e);}})();

/* 5️⃣  adaptive DPR (persistent) with lock */
(()=>{const TAG='[DPR]',MAX_PIX= navigator.platform.startsWith('Win')?WIN_MP_BUDG:OTHER_MP_BUDG;
let cv,gl,scale=+localStorage.getItem('dprScale')||0.5,frames=0,ts=performance.now(),lock=true;
const log=(...a)=>console.log(TAG,...a);
function resize(r='init'){const w=innerWidth,h=innerHeight,d=devicePixelRatio||1;let s=Math.min(scale,d,1);
  if(w*h*s*s>MAX_PIX)s=Math.sqrt(MAX_PIX/(w*h));s=Math.max(s,SCALE_MIN);
  if(lock&&r.startsWith('fps↑'))return;scale=s;
  cv.width=(w*s)|0;cv.height=(h*s)|0;cv.style.width=w+'px';cv.style.height=h+'px';gl?.viewport(0,0,cv.width,cv.height);
  log(r,'css',`${w}×${h}`,'scale',s.toFixed(2),'buf',`${cv.width}×${cv.height}`);}
function loop(){frames++;const n=performance.now();if(n-ts>=1000){
  const fps=(frames*1000/(n-ts))|0;
  if(fps<FPS_LO&&scale>SCALE_MIN){scale*=1-DROP_STEP;resize('fps↓'+fps);}
  else if(fps>FPS_HI&&scale<1){scale=Math.min(scale*(1+RISE_STEP),1);resize('fps↑'+fps);}
  localStorage.setItem('dprScale',scale.toFixed(2));frames=0;ts=n;}requestAnimationFrame(loop);}
(function w(){cv=document.querySelector('canvas');if(!cv){requestAnimationFrame(w);return;}
  gl=cv.getContext('webgl2')||cv.getContext('webgl');
  addEventListener('resize',()=>resize('rsz'),{passive:true});resize();loop();})();
window.addEventListener(ULTRA_READY_EVENT, e=>{
  if(e.target && e.target.id===ULTRA_ID){lock=false;console.log('[TDV‑PERF] ultra ready – unlock DPR');}
});
})();

/* 6️⃣  clamp & AA‑off on every Model3D */
(()=>{function p(m){try{m.pixelRatioMinScale=0.5;}catch{} try{m.aaEnabled=false;}catch{}}
const t=setInterval(()=>{if(!TDV?.Tour?.prototype)return;clearInterval(t);
const o=TDV.Tour.prototype._initModel;TDV.Tour.prototype._initModel=function(m){p(m);return o.apply(this,arguments);};
console.log('[TDV‑PERF] clamp hook active');},100);})();

/* 7️⃣  preview → ultra swap */
(()=>{if(!TDV?.Tour){console.warn('[TDV‑PERF] TDV not ready');return;}
let swapped=false;
function loadUltra(){if(swapped||!TDV.Tour.loadMedia)return;
  swapped=true;console.log('[TDV‑PERF] load ULTRA');TDV.Tour.loadMedia(ULTRA_ID);}
const boot=setInterval(()=>{if(!TDV.Tour.loadMedia)return;
  clearInterval(boot);console.log('[TDV‑PERF] load PREVIEW');TDV.Tour.loadMedia(PREVIEW_ID);
  TDV.Tour.once?.(ULTRA_READY_EVENT, e=>{if(e.target.id===ULTRA_ID)console.log('[TDV‑PERF] ultra ready event');});
},100);
['pointerdown','touchstart','keydown'].forEach(ev=>addEventListener(ev,loadUltra,{once:true,passive:true}));
})();