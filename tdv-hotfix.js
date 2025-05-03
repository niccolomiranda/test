/* --------------------------------------------------------------------------
   tdv‑hotfix.js   –   Early canvas clamp • Fast WebGL • Lazy splats
   2025‑05‑04 • MIT / public domain – use freely
   -------------------------------------------------------------------------- */

/* ✦ CONFIG ---------------------------------------------------------------- */
const PREVIEW_ID   = 'cloud_medium';  // ~300 K points  (initial load)
const ULTRA_ID     = 'cloud_ultra';   // ~3 M points   (lazy‑loaded)
const WIN_MP_BUDG  = 2_073_600;       // 1920×1080  cap on Windows
const OTHER_MP_BUDG= 8_294_400;       // 3840×2160 cap elsewhere
const SCALE_MIN    = 0.5;             // never below DPR 0.5
/* ------------------------------------------------------------------------ */

/* 1️⃣  Fast‑path WebGL: runs before 3DVista asks for a context */
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

/* 2️⃣  Clamp the first drawing‑buffer (and on every resize) */
(() => {
  const MAX_PIXELS = navigator.platform.startsWith('Win') ?
                     WIN_MP_BUDG : OTHER_MP_BUDG;
  let   canvas, gl;

  function resize(tag = 'init') {
    const cssW = innerWidth, cssH = innerHeight,
          dpr  = devicePixelRatio || 1;
    let   scale = Math.min(dpr, 1);          // never above DPR 1
    if (cssW * cssH * scale * scale > MAX_PIXELS) {
      scale = Math.sqrt(MAX_PIXELS / (cssW * cssH));
    }
    scale = Math.max(scale, SCALE_MIN);

    canvas.width  = (cssW * scale) | 0;
    canvas.height = (cssH * scale) | 0;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    gl && gl.viewport(0, 0, canvas.width, canvas.height);

    console.log('[DPR‑Fix]', tag,
                'css',   `${cssW}×${cssH}`,
                'scale', scale.toFixed(2),
                'buf',   `${canvas.width}×${canvas.height}`);
  }

  (function wait() {
    canvas = document.querySelector('canvas');
    if (!canvas) { requestAnimationFrame(wait); return; }
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    addEventListener('resize', () => resize('rsz'), { passive: true });
    resize();
  })();
})();

/* 3️⃣  Enforce clamp & AA‑off on every new Model3D instance */
(() => {
  function patch(model) {
    try { model.pixelRatioMinScale = 0.5; } catch (_) {}
    try { model.aaEnabled          = false; } catch (_) {}
  }
  const hook = setInterval(() => {
    if (!window.TDV?.Tour?.prototype) return;          // TDV not ready yet
    clearInterval(hook);

    const ORIG = TDV.Tour.prototype._initModel;
    TDV.Tour.prototype._initModel = function (mdl) {
      patch(mdl);                                      // our override
      return ORIG.apply(this, arguments);              // 3DVista logic
    };
    console.log('[Clamp] pixelRatioMinScale→0.5 & AA‑off for all models');
  }, 100);
})();

/* 4️⃣  Lazy‑load high‑res splat cloud after first interaction */
(() => {
  let swapped = false;

  function swapUltra() {
    if (swapped || !window.TDV?.Tour?.loadMedia) return;
    swapped = true;
    console.log('[Lazy] loading ultra cloud:', ULTRA_ID);
    TDV.Tour.loadMedia(ULTRA_ID);
  }

  /* load preview as soon as API ready */
  const boot = setInterval(() => {
    if (window.TDV?.Tour?.loadMedia) {
      clearInterval(boot);
      console.log('[Lazy] loading preview cloud:', PREVIEW_ID);
      TDV.Tour.loadMedia(PREVIEW_ID);
    }
  }, 100);

  /* watch for first user interaction */
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    addEventListener(ev, swapUltra, { once: true, passive: true })
  );
})();