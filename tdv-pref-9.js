/*  tdv‑perf.js  v2.0.0  –  cache‑everything SW + fast GL + DPR memory
    drop‑in fix for 3DVista “first‑load lag” (no preview cloud needed)
    2025‑05‑06 • MIT / Public Domain                             */

/* ── CONFIG (leave ULTRA_URL blank if you don’t care) ───────── */
const ULTRA_URL = '';            // optional: full path to your big .bin /.ply
const USE_SW_CACHE = true;       // turn off if you already roll your own
const WIN_MP_BUDG = 2_073_600, OTHER_MP_BUDG = 8_294_400, SCALE_MIN = 0.5;
const FPS_LO = 45, FPS_HI = 55, DROP = 0.25, RISE = 0.10;
/* ───────────────────────────────────────────────────────────── */

/* 0️⃣  cache‑everything Service Worker (RAM‑only, survives tab reloads) */
if (USE_SW_CACHE && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(
    URL.createObjectURL(new Blob([`
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
    `], { type: 'text/javascript' }))
  ).catch(() => {});
}

/* optional early prefetch of the big cloud file */
if (ULTRA_URL) fetch(ULTRA_URL, { mode: 'no-cors' }).catch(() => {});

/* 1️⃣  fast WebGL everywhere */
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o = {}) {
    if (/webgl/.test(t)) Object.assign(o, { antialias: false, powerPreference: 'high-performance' });
    return orig.call(this, t, o);
  };
})();

/* 2️⃣  real shader warm‑up (dummy canvas) */
(() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!g) return;
    const v = g.createShader(g.VERTEX_SHADER);
    g.shaderSource(v, '#version 300 es\nin vec3 p;void main(){gl_Position=vec4(p,1);}'); g.compileShader(v);
    const f = g.createShader(g.FRAGMENT_SHADER);
    g.shaderSource(f, '#version 300 es\nprecision mediump float;out vec4 c;void main(){c=vec4(1);}'); g.compileShader(f);
    const p = g.createProgram(); g.attachShader(p, v); g.attachShader(p, f); g.linkProgram(p); g.useProgram(p);
    const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 0]), g.STATIC_DRAW);
    g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 3, g.FLOAT, false, 0, 0);
    g.drawArrays(g.POINTS, 0, 1);
    g.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { }
})();

/* 3️⃣  adaptive DPR with persistent memory */
(() => {
  const MAX_PIX = navigator.platform.startsWith('Win') ? WIN_MP_BUDG : OTHER_MP_BUDG;
  let canvas, gl, scale = +localStorage.getItem('dprScale') || 0.5;
  let frames = 0, t0 = performance.now();

  function resize(tag = 'init') {
    const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
    let s = Math.min(scale, dpr, 1);
    if (w * h * s * s > MAX_PIX) s = Math.sqrt(MAX_PIX / (w * h));
    s = Math.max(s, SCALE_MIN);
    scale = s;
    canvas.width = (w * s) | 0; canvas.height = (h * s) | 0;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    gl?.viewport(0, 0, canvas.width, canvas.height);
  }

  function loop() {
    frames++; const now = performance.now();
    if (now - t0 >= 1000) {
      const fps = (frames * 1000 / (now - t0)) | 0;
      if (fps < FPS_LO && scale > SCALE_MIN) { scale *= 1 - DROP; resize(); }
      else if (fps > FPS_HI && scale < 1) { scale = Math.min(scale * (1 + RISE), 1); resize(); }
      localStorage.setItem('dprScale', scale.toFixed(2));
      frames = 0; t0 = now;
    }
    requestAnimationFrame(loop);
  }

  (function wait() {
    canvas = document.querySelector('canvas');
    if (!canvas) { requestAnimationFrame(wait); return; }
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    addEventListener('resize', () => resize(), { passive: true });
    resize(); loop();
    console.log('%c[TDV‑PERF] ready', 'color:#0c0');
  })();
})();