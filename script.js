/* -----------------------------------------------------------
   dpr‑auto.js         (adaptive device‑pixel‑ratio helper)
   Author: 2025‑05‑03
   Purpose:  Dynamically clamp / raise WebGL drawing‑buffer
             resolution so every display size stays smooth,
             even at full‑bleed 4 K or slow GPUs.

   How it works
   ------------
     • Starts with SCALE_MAX (normally 1.0  = 1 device‑px per CSS‑px)
     • Every second measures real FPS:
          – if FPS < FPS_LO  : reduce scale by DROP_STEP (20 %)
          – if FPS > FPS_HI  : raise  scale by RISE_STEP (10 %)
     • Enforces a hard megapixel ceiling (PIXEL_BUDG)
     • Never lets scale go below SCALE_MIN (for basic crispness)
     • Logs everything to the console   [DPR‑A] …

   -----------------------------------------------------------
   Public domain / MIT – do whatever you like with it.
   ----------------------------------------------------------- */

(function () {

  /* ✦ CONFIGURATION – tweak to taste ---------------------- */
  const TAG        = '[DPR‑A]';        // console prefix
  const SCALE_MAX  = 1.0;              // never render above this DPR
  const SCALE_MIN  = 0.5;              // never render below this DPR
  const PIXEL_BUDG = 8_294_400;        // ≈ 3840 × 2160 (8.3 MP)
  const FPS_LO     = 45;               // drop res if FPS < 45
  const FPS_HI     = 55;               // raise res if FPS > 55
  const DROP_STEP  = 0.20;             // shrink by 20 %
  const RISE_STEP  = 0.10;             // grow   by 10 %
  /* ------------------------------------------------------- */

  /* internal state ---------------------------------------- */
  let canvas, gl;
  let scale      = SCALE_MAX;
  let frameCount = 0;
  let lastStamp  = performance.now();

  /* quick console helper */
  const log = (...a) => console.log(TAG, ...a);

  /* ---- (re)size drawing‑buffer -------------------------- */
  function resize(reason = 'resize') {
    const cssW = innerWidth;
    const cssH = innerHeight;
    const dpr  = window.devicePixelRatio || 1;

    /* obey config + DPR + megapixel cap */
    let s = Math.min(scale, dpr, SCALE_MAX);
    if (cssW * cssH * s * s > PIXEL_BUDG) {
      s = Math.sqrt(PIXEL_BUDG / (cssW * cssH));
    }
    s = Math.max(s, SCALE_MIN);
    scale = s;                                // remember for FPS loop

    canvas.width  = (cssW * s) | 0;
    canvas.height = (cssH * s) | 0;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    gl && gl.viewport(0, 0, canvas.width, canvas.height);

    log(
      reason,
      'css',   `${cssW}×${cssH}`,
      'scale', s.toFixed(2),
      'buf',   `${canvas.width}×${canvas.height}`
    );
  }

  /* ---- FPS watchdog loop -------------------------------- */
  function loop() {
    frameCount++;
    const now = performance.now();
    const dt  = now - lastStamp;

    if (dt >= 1000) {
      const fps = (frameCount * 1000 / dt) | 0;

      if (fps < FPS_LO && scale > SCALE_MIN) {
        scale *= (1 - DROP_STEP);
        resize(`fps↓${fps}`);
      } else if (fps > FPS_HI && scale < SCALE_MAX) {
        scale = Math.min(scale * (1 + RISE_STEP), SCALE_MAX);
        resize(`fps↑${fps}`);
      }

      frameCount = 0;
      lastStamp  = now;
    }
    requestAnimationFrame(loop);
  }

  /* ---- wait for the 3DVista WebGL canvas ---------------- */
  (function wait() {
    canvas = document.querySelector('canvas');
    if (!canvas) { requestAnimationFrame(wait); return; }

    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    addEventListener('resize', () => resize('rsz'), { passive: true });

    resize('init');   // first sizing pass
    loop();           // start FPS monitor
  })();

})();