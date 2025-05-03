/* -------------------------------------------------------------------------
   tdv‑perf.js     – Fast WebGL • Early clamp • Adaptive DPR • Lazy splats
   2025‑05‑05 • MIT / PD – do whatever you like
   ------------------------------------------------------------------------- */

/* ═══════════════════════ CONFIG – EDIT AS NEEDED ════════════════════════ */
const PREVIEW_ID = '';           // e.g. 'cloud_medium'  | '' = skip lazy swap
const ULTRA_ID   = '';           // e.g. 'cloud_ultra'   | '' = skip lazy swap

const WIN_MP_BUDG   = 2_073_600;   // FullHD cap (≈2 MP) for Windows
const OTHER_MP_BUDG = 8_294_400;   // 4 K cap      (≈8 MP) elsewhere
const SCALE_MIN     = 0.5;
const FPS_LO        = 45;          // shrink if < 45 FPS
const FPS_HI        = 55;          // grow   if > 55 FPS
const DROP_STEP     = 0.25;        // 25 % shrink
const RISE_STEP     = 0.10;        // 10 % grow
/* ════════════════════════════════════════════════════════════════════════ */

/* 1️⃣  Fast‑path WebGL (runs before 3DVista grabs a context) */
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, opts = {}) {
    if (/webgl/.test(t)) {
      Object.assign(opts, { antialias: false, powerPreference: 'high-performance' });
      console.log('[CTX] fast‑path WebGL');
    }
    return orig.call(this, t, opts);
  };
})();

/* 2️⃣  Early clamp + adaptive DPR */
(() => {
  const TAG        = '[DPR]';
  const MAX_PIXELS = navigator.platform.startsWith('Win') ?
                     WIN_MP_BUDG : OTHER_MP_BUDG;
  let canvas, gl, scale = 1, fpsFrames = 0, fpsStamp = performance.now();

  const log = (...a) => console.log(TAG, ...a);

  function resize(reason = 'init') {
    const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
    let s   = Math.min(scale, dpr, 1);                 // cap at DPR 1

    if (w * h * s * s > MAX_PIXELS) {
      s = Math.sqrt(MAX_PIXELS / (w * h));
    }
    s = Math.max(s, SCALE_MIN);
    scale = s;

    canvas.width  = (w * s) | 0;
    canvas.height = (h * s) | 0;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    gl && gl.viewport(0, 0, canvas.width, canvas.height);

    log(reason, 'css', `${w}×${h}`, 'scale', s.toFixed(2),
        'buf', `${canvas.width}×${canvas.height}`);
  }

  function fpsLoop() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsStamp >= 1000) {
      const fps = (fpsFrames * 1000 / (now - fpsStamp)) | 0;
      if (fps < FPS_LO && scale > SCALE_MIN) {
        scale *= 1 - DROP_STEP; resize(`fps↓${fps}`);
      } else if (fps > FPS_HI && scale < 1) {
        scale = Math.min(scale * (1 + RISE_STEP), 1); resize(`fps↑${fps}`);
      }
      fpsFrames = 0; fpsStamp = now;
    }
    requestAnimationFrame(fpsLoop);
  }

  (function wait() {
    canvas = document.querySelector('canvas');
    if (!canvas) { requestAnimationFrame(wait); return; }
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    addEventListener('resize', () => resize('rsz'), { passive: true });
    resize(); fpsLoop();
  })();
})();

/* 3️⃣ Enforce clamp + AA‑off on every Model3D */
(() => {
  function patch(m) {
    try { m.pixelRatioMinScale = 0.5; } catch (_) {}
    try { m.aaEnabled          = false; } catch (_) {}
  }
  const poll = setInterval(() => {
    if (!window.TDV?.Tour?.prototype) return;
    clearInterval(poll);

    const ORIG = TDV.Tour.prototype._initModel;
    TDV.Tour.prototype._initModel = function (mdl) {
      patch(mdl);
      return ORIG.apply(this, arguments);
    };
    console.log('[Clamp] pixelRatioMinScale→0.5 & AA‑off for all models');
  }, 100);
})();

/* 4️⃣ Lazy‑load ultra splat cloud (optional) */
(() => {
  if (!PREVIEW_ID || !ULTRA_ID) return;            // skip if IDs blank
  let swapped = false;

  function swapUltra() {
    if (swapped || !window.TDV?.Tour?.loadMedia) return;
    swapped = true;
    console.log('[Lazy] loading ultra cloud:', ULTRA_ID);
    TDV.Tour.loadMedia(ULTRA_ID);
  }

  const boot = setInterval(() => {
    if (window.TDV?.Tour?.loadMedia) {
      clearInterval(boot);
      console.log('[Lazy] loading preview cloud:', PREVIEW_ID);
      TDV.Tour.loadMedia(PREVIEW_ID);
    }
  }, 100);

  ['pointerdown', 'touchstart', 'keydown']
    .forEach(ev => addEventListener(ev, swapUltra, { once: true, passive: true }));
})();