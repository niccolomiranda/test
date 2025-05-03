/* -------------------------------------------------------------------------
   tdv‑perf.js  (v1.0.3)  –  Fast WebGL • Auto‑DPR (persistent)
                            Real Shader Pre‑warm • Asset Prefetch
   2025‑05‑06
   ------------------------------------------------------------------------- */

/* ‥‥‥ CONFIG ‥‥‥ */
const PREVIEW_ID = '';                  // '' → skip
const ULTRA_ID   = '';                  // '' → skip
const ULTRA_URL  = '';                  // absolute URL of the heavy splat
const WIN_MP_BUDG=2_073_600, OTHER_MP_BUDG=8_294_400, SCALE_MIN=0.5;
const FPS_LO=45, FPS_HI=55, DROP_STEP=0.25, RISE_STEP=0.10;

/* 0️⃣  — prefetch ultra cloud (if URL given) */
if (ULTRA_URL) fetch(ULTRA_URL, {mode:'no-cors'}).catch(()=>{});

/* 1️⃣  — fast WebGL */
(()=>{const o=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t,opts={}){if(/webgl/.test(t)){
Object.assign(opts,{antialias:false,powerPreference:'high-performance'});
console.log('[CTX] fast');}return o.call(this,t,opts);};})();

/* 2️⃣  — persistent scale memory */
let savedScale = +localStorage.getItem('dprScale') || 1;

/* 3️⃣  — true shader warm‑up */
(function prewarm(){
  const c=document.createElement('canvas');c.width=c.height=1;
  const gl=c.getContext('webgl2',{antialias:false,powerPreference:'high-performance'});
  if(!gl){console.warn('[Warm] no ctx');return;}
  const v=gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(v,'#version 300 es\nin vec3 p;void main(){gl_Position=vec4(p,1);}');
  gl.compileShader(v);
  const f=gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(f,'#version 300 es\nprecision mediump float;out vec4 c;void main(){c=vec4(1);}');
  gl.compileShader(f);
  const prog=gl.createProgram(); gl.attachShader(prog,v); gl.attachShader(prog,f);
  gl.linkProgram(prog); gl.useProgram(prog);
  const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  gl.drawArrays(gl.POINTS,0,1);
  console.log('[Warm] shader binary cached');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
})();

/* 4️⃣  — adaptive DPR (+ restore last good scale) */
(()=>{const TAG='[DPR]';
const MAX_PIXELS=navigator.platform.startsWith('Win')?WIN_MP_BUDG:OTHER_MP_BUDG;
let canvas,gl,scale=savedScale,frames=0,stamp=performance.now();
const L=(...a)=>console.log(TAG,...a);
function resize(r='init'){const w=innerWidth,h=innerHeight,d=devicePixelRatio||1;
let s=Math.min(scale,d,1);if(w*h*s*s>MAX_PIXELS)s=Math.sqrt(MAX_PIXELS/(w*h));
s=Math.max(s,SCALE_MIN);scale=s;canvas.width=(w*s)|0;canvas.height=(h*s)|0;
canvas.style.width=w+'px';canvas.style.height=h+'px';gl?.viewport(0,0,canvas.width,canvas.height);
L(r,'css',`${w}×${h}`,'scale',s.toFixed(2),'buf',`${canvas.width}×${canvas.height}`);}
function loop(){frames++;const now=performance.now();
if(now-stamp>=1000){const fps=(frames*1000/(now-stamp))|0;
if(fps<FPS_LO&&scale>SCALE_MIN){scale*=1-DROP_STEP;resize('fps↓'+fps);}
else if(fps>FPS_HI&&scale<1){scale=Math.min(scale*(1+RISE_STEP),1);resize('fps↑'+fps);}
localStorage.setItem('dprScale',scale.toFixed(2));
frames=0;stamp=now;}requestAnimationFrame(loop);}
(function wait(){canvas=document.querySelector('canvas');
if(!canvas){requestAnimationFrame(wait);return;}
gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
addEventListener('resize',()=>resize('rsz'),{passive:true});resize();loop();})();
})();

/* 5️⃣  — force clamp & AA‑off on every Model3D */
(()=>{function p(m){try{m.pixelRatioMinScale=0.5;}catch{}try{m.aaEnabled=false;}catch{}}
const t=setInterval(()=>{if(!TDV?.Tour?.prototype)return;clearInterval(t);
const o=TDV.Tour.prototype._initModel;TDV.Tour.prototype._initModel=function(m){p(m);return o.apply(this,arguments);};
console.log('[Clamp] pixelRatioMinScale→0.5');},100);})();

/* 6️⃣  — lazy swap (optional as before) */
(()=>{if(!PREVIEW_ID||!ULTRA_ID)return;let s=false;
function h(){if(s||!TDV?.Tour?.loadMedia)return;s=true;console.log('[Lazy] ultra');TDV.Tour.loadMedia(ULTRA_ID);}
const b=setInterval(()=>{if(!TDV?.Tour?.loadMedia)return;clearInterval(b);
console.log('[Lazy] preview');TDV.Tour.loadMedia(PREVIEW_ID);},100);
['pointerdown','touchstart','keydown'].forEach(e=>addEventListener(e,h,{once:true,passive:true}));})();