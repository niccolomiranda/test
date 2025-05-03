/* ╔══════════════════════════════════════════════════════════════════╗
   ║  tdv‑perf.js (v1.0.4)                                            ║
   ║  Fast WebGL ▸ Persistent Auto‑DPR ▸ True Shader Pre‑warm         ║
   ║  Preview‑first Gaussian Splat ▸ Locks DPR until Ultra is ready   ║
   ║  Session‑only asset cache ▸ Font‑swap & preload                  ║
   ║  2025‑05‑06 • MIT / Public‑Domain                                ║
   ╚══════════════════════════════════════════════════════════════════╝ */

/* ───── CONFIG ────────────────────────────────────────────────────── */
const PREVIEW_ID        = 'cloud_medium';   // <= 300 K splats  (leave '' to skip)
const ULTRA_ID          = 'cloud_ultra';    // full‑res cloud   (leave '' to skip)
const ULTRA_URL         = '';               // absolute URL of ULTRA file for prefetch; '' = skip
const ULTRA_READY_EVENT = 'modelready';     // TDV event when ULTRA model is fully uploaded

const WIN_MP_BUDG   = 2_073_600;   // 1920×1080 pixel budget on Windows
const OTHER_MP_BUDG = 8_294_400;   // 3840×2160 elsewhere
const SCALE_MIN     = 0.5;

const FPS_LO = 45, FPS_HI = 55;
const DROP_STEP = 0.25, RISE_STEP = 0.10;
const USE_SW_CACHE = true;         // incognito session cache
/* ─────────────────────────────────────────────────────────────────── */

/* 0️⃣  Prefetch the ultra cloud (optional) */
if (ULTRA_URL) fetch(ULTRA_URL, { mode: 'no-cors' }).catch(() => {});

/* 1️⃣  One‑shot session cache (kept in RAM, survives incognito tab group) */
if (USE_SW_CACHE && 'serviceWorker' in navigator) try {
  const sw = `
    self.addEventListener('fetch', e => {
      if (e.request.method !== 'GET') return;
      e.respondWith(
        caches.open('session').then(async c => {
          const hit = await c.match(e.request);
          if (hit) return hit;
          const net = await fetch(e.request);
          c.put(e.request, net.clone());
          return net;
        })
      );
    });
  `;
  navigator.serviceWorker.register(
    URL.createObjectURL(new Blob([sw], { type: 'text/javascript' }))
  ).catch(() => {});
} catch {}

/* 2️⃣  Make fonts non‑blocking & start them downloading ASAP */
(() => {
  const css = '@font-face{font-display:swap!important}';
  document.head.appendChild(Object.assign(document.createElement('style'),
    { textContent: css }));
  ['Open%20Sans.woff', 'Noticia%20Text%20Bold.woff'].forEach(fn => {
    const l = document.createElement('link');
    l.rel = 'preload'; l.as = 'font'; l.crossOrigin = 'anonymous';
    l.href = `https://storage.net-fs.com/hosting/8375805/0/fonts/${fn}`;
    document.head.appendChild(l);
  });
})();

/* 3️⃣  Fast‑path WebGL everywhere */
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, opts = {}) {
    if (/webgl/.test(t)) {
      Object.assign(opts, { antialias: false, powerPreference: 'high-performance' });
      console.log('[CTX] fast');
    }
    return orig.call(this, t, opts);
  };
})();

/* 4️⃣  True shader pre‑warm (dummy canvas, real program) */
(() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const gl = c.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw 0;
    const V = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(V, '#version 300 es\nin vec3 p;void main(){gl_Position=vec4(p,1);}');
    gl.compileShader(V);
    const F = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(F, '#version 300 es\nprecision mediump float;out vec4 c;void main(){c=vec4(1);}');
    gl.compileShader(F);
    const P = gl.createProgram(); gl.attachShader(P, V); gl.attachShader(P, F); gl.linkProgram(P);
    gl.useProgram(P);
    const B = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, 1);
    console.log('[Warm] shader binary cached');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { console.warn('[Warm] pre‑compile skipped'); }
})();

/* 5️⃣  Adaptive DPR  (persistent) with lock until ULTRA ready */
(() => {
  const TAG = '[DPR]';
  const MAX_PIXELS = navigator.platform.startsWith('Win') ? WIN_MP_BUDG : OTHER_MP_BUDG;
  let canvas, gl;
  let scale = +localStorage.getItem('dprScale') || 1;
  let frames = 0, stamp = performance.now();
  let scaleLock = !!ULTRA_ID;   // keep low res until ultra done

  const L = (...a) => console.log(TAG, ...a);

  function resize(reason = 'init') {
    const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
    let s = Math.min(scale, dpr, 1);
    if (w * h * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (w * h));
    s = Math.max(s, SCALE_MIN);

    /* keep scale low while locked */
    if (scaleLock && reason.startsWith('fps↑')) return;

    scale = s;
    canvas.width = (w * s) | 0;
    canvas.height = (h * s) | 0;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl?.viewport(0, 0, canvas.width, canvas.height);
    L(reason, 'css', `${w}×${h}`, 'scale', s.toFixed(2), 'buf', `${canvas.width}×${canvas.height}`);
  }

  function fpsLoop() {
    frames++;
    const now = performance.now();
    if (now - stamp >= 1000) {
      const fps = (frames * 1000 / (now - stamp)) | 0;
      if (fps < FPS_LO && scale > SCALE_MIN) {
        scale *= 1 - DROP_STEP; resize(`fps↓${fps}`);
      } else if (fps > FPS_HI && scale < 1) {
        scale = Math.min(scale * (1 + RISE_STEP), 1); resize(`fps↑${fps}`);
      }
      localStorage.setItem('dprScale', scale.toFixed(2));
      frames = 0; stamp = now;
    }
    requestAnimationFrame(fpsLoop);
  }

  /* unlock when ultra cloud finished uploading */
  window.addEventListener(ULTRA_READY_EVENT, () => {
    if (scaleLock) {
      scaleLock = false;
      console.log('[Ultra] ready – DPR can rise');
    }
  });

  (function wait() {
    canvas = document.querySelector('canvas');
    if (!canvas) { requestAnimationFrame(wait); return; }
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    addEventListener('resize', () => resize('rsz'), { passive: true });
    resize(); fpsLoop();
  })();
})();

/* 6️⃣  Force every Model3D to respect pixelRatioMinScale & AA‑off */
(() => {
  function patch(m) {
    try { m.pixelRatioMinScale = 0.5; } catch { }
    try { m.aaEnabled = false; } catch { }
  }
  const poll = setInterval(() => {
    if (!TDV?.Tour?.prototype) return;
    clearInterval(poll);
    const ORIG = TDV.Tour.prototype._initModel;
    TDV.Tour.prototype._initModel = function (m) { patch(m); return ORIG.apply(this, arguments); };
    console.log('[Clamp] pixelRatioMinScale→0.5');
  }, 100);
})();

/* 7️⃣  Lazy preview‑/ultra‑cloud swap  */
(() => {
  if (!PREVIEW_ID || !ULTRA_ID) return;
  let swapped = false;
  function swapUltra() {
    if (swapped || !TDV?.Tour?.loadMedia) return;
    swapped = true;
    console.log('[Lazy] loading ultra:', ULTRA_ID);
    TDV.Tour.loadMedia(ULTRA_ID);
  }
  const boot = setInterval(() => {
    if (!TDV?.Tour?.loadMedia) return;
    clearInterval(boot);
    console.log('[Lazy] loading preview:', PREVIEW_ID);
    TDV.Tour.loadMedia(PREVIEW_ID);
  }, 100);
  ['pointerdown', 'touchstart', 'keydown']
    .forEach(ev => addEventListener(ev, swapUltra, { once: true, passive: true }));
})();