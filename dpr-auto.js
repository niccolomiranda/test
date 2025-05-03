/* ---------------------------------------------------------------------------
   dpr‑auto.js        (adaptive DPR  +  WebGL fast‑path  +  lazy‑load splats)
   Commit this file to your repo, e.g.  gauss-tour-scripts/dist/dpr-auto.js
   Serve it through JSDelivr and load it in 3DVista with the 1‑line bootstrap
   ---------------------------------------------------------------------------
   2025‑05‑03 • MIT/PD – modify freely
--------------------------------------------------------------------------- */

/* ═════════════════════════════ FAST‑PATH WEBGL ═══════════════════════════ */
(()=>{
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o = {}) {
      if (/webgl/.test(t)) {
        o = Object.assign({ antialias: false, powerPreference: 'high-performance' }, o);
        console.log('[CTX] antialias:false  powerPreference:high-performance');
      }
      return orig.call(this, t, o);
    };
  })();
  
  /* ═══════════════════════ ADAPTIVE DPR / PIXEL BUDGET ═════════════════════ */
  (function () {
    /* ✦ CONFIG ------------------------------------------------------------- */
    const TAG        = '[DPR‑A]';
    const SCALE_MAX  = 1.0;
    const SCALE_MIN  = 0.5;
    const PIXEL_BUDG = navigator.platform.startsWith('Win') ? 2_073_600  /*2 MP*/
                                                            : 8_294_400; /*8 MP*/
    const FPS_LO     = 45;           // shrink if < 45 FPS
    const FPS_HI     = 55;           // grow   if > 55 FPS
    const DROP_STEP  = 0.20;         // −20 %
    const RISE_STEP  = 0.10;         // +10 %
    /* ---------------------------------------------------------------------- */
  
    let canvas, gl, scale = SCALE_MAX, frames = 0, last = performance.now();
  
    const log = (...a) => console.log(TAG, ...a);
  
    function resize(reason = 'rsz') {
      const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
      let s   = Math.min(scale, dpr, SCALE_MAX);
  
      /* megapixel clamp */
      if (w * h * s * s > PIXEL_BUDG) s = Math.sqrt(PIXEL_BUDG / (w * h));
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
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        const fps = (frames * 1000 / (now - last)) | 0;
        if (fps < FPS_LO && scale > SCALE_MIN) {
          scale *= 1 - DROP_STEP; resize(`fps↓${fps}`);
        } else if (fps > FPS_HI && scale < SCALE_MAX) {
          scale = Math.min(scale * (1 + RISE_STEP), SCALE_MAX);
          resize(`fps↑${fps}`);
        }
        frames = 0; last = now;
      }
      requestAnimationFrame(fpsLoop);
    }
  
    /* ════════════ lazy‑load point clouds after first interaction ══════════ */
    const LOW_ID  = 'cloud_medium';   // TODO: set to your 300 K‑splat asset ID
    const HIGH_ID = 'cloud_ultra';    // TODO: set to your 3 M‑splat asset ID
    let swapped   = false;
  
    function swapToHigh() {
      if (swapped) return;
      swapped = true;
      if (window.TDV?.Tour?.loadMedia) {
        console.log('[Lazy] loading high‑res cloud:', HIGH_ID);
        TDV.Tour.loadMedia(HIGH_ID);
      } else {
        console.warn('[Lazy] TDV API not ready – cannot load', HIGH_ID);
      }
    }
  
    function armLazyLoader() {
      ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
        addEventListener(ev, function onFirst() {
          removeEventListener(ev, onFirst, { capture: true });
          setTimeout(swapToHigh, 500);   // delay lets FPS stabilise
        }, { capture: true, passive: true })
      );
    }
  
    /* ═════════════════════════ INITIALISE ═════════════════════════════════ */
    (function wait() {
      canvas = document.querySelector('canvas');
      if (!canvas) { requestAnimationFrame(wait); return; }
  
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      addEventListener('resize', () => resize('rsz'), { passive: true });
  
      /* load low‑res splat cloud immediately if API available */
      if (window.TDV?.Tour?.loadMedia) {
        console.log('[Lazy] loading preview cloud:', LOW_ID);
        TDV.Tour.loadMedia(LOW_ID);
      }
  
      armLazyLoader();
      resize('init');
      fpsLoop();
    })();
  })();