/* ============================================================================
   echo-perched.js — faithful Canvas-2D port of the Skia "perched" Echo
   ----------------------------------------------------------------------------
   Ports components/shared/Echo.tsx (perched state) + lib/echo/perchedChoreography.ts
   to a self-contained <canvas> RAF so HTML mockups + canonicals can show the REAL
   animated perched Echo (frosted cyan orb, coral breath core, 4 cyan wire limbs
   with nubs, slow blink, leg-swing pendulum, entrance keyframes) — not a static orb.

   Every constant below is the real RN source value (REF = 200px reference box,
   scaled to `size`). Anatomy invariants per docs/truth/ECHO_ART_DIRECTION.md.

   USAGE:
     <canvas data-echo-perched data-size="70"></canvas>
     <script src="../harness/echo-perched.js"></script>
   Auto-mounts every [data-echo-perched]. Canvas is sized size × size*1.08 (the
   perched foot-nub overshoot, PERCHED_CANVAS_HEIGHT_MULTIPLIER).
   ============================================================================ */
(function () {
  'use strict';

  var REF = 200;
  // Orb
  var ORB_CX = 100, ORB_CY = 100, ORB_R = 50, HALO_R = 84;
  // Eyes
  var EYE_L_X = 84, EYE_R_X = 116, EYE_Y = 90, EYE_DOT_R = 3.4;
  // Limb anchors + rest endpoints
  var ARM_L_AX = 56, ARM_L_AY = 106, ARM_R_AX = 144, ARM_R_AY = 106;
  var LEG_L_AX = 84, LEG_L_AY = 145, LEG_R_AX = 116, LEG_R_AY = 145;
  var ARM_L_DX = -16, ARM_L_DY = 28, ARM_R_DX = 16, ARM_R_DY = 28;
  var NUB_R = 4, LIMB_STROKE = 2;
  var CYAN = '#9EE5E5';
  // gaze bias (perched Echo on the CTA looks down-left toward the question)
  var EYE_OFFSET_X = -3, EYE_OFFSET_Y = 2;

  // Breath / blink
  var BREATH_FREQ = 1.5, CORAL_BREATH_AMP = 0.32, REST_CORAL = 0.58;
  var AUTO_BLINK_WINDOW_S = 0.11;
  var PERCHED_BLINK_PERIOD = 3.2;
  var PERCHED_CANVAS_H_MULT = 1.08;

  // ── perchedChoreography.ts port ──────────────────────────────────────────
  var ENTRANCE_END = 0.55, HOLD_BODY_Y = 22, HOLD_GLOW = 0.2;
  var HOLD_ARM_L = -1.35, HOLD_ARM_R = 1.35, HOLD_ARM_RADIAL = 0.85;
  var LEG_EP_L = [-2, 34], LEG_EP_R = [2, 34];
  var LEG_PERIOD = 1.8, LEG_AMP = 0.42, FORESHORTEN_AMP = 0.18, LEAN_AMP = 0.035;
  var BREATH_FREQ_P = 0.5, BREATH_AMP = 0.012, GLOW_PULSE_AMP = 0.02;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  var BACK_C1 = 1.70158, BACK_C3 = BACK_C1 + 1;
  function easeOutBack(t) { return 1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2); }
  function piecewise(t, pieces) {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (t < p[0]) continue;
      if (t <= p[1]) { var lt = clamp01((t - p[0]) / (p[1] - p[0])); return lerp(p[2], p[3], p[4](lt)); }
    }
    return pieces.length ? pieces[pieces.length - 1][3] : 0;
  }
  // [tStart,tEnd,from,to,easing]
  var E_ARM_L = [[0,0.08,0,0.15,easeInOutSine],[0.08,0.28,0.15,-0.7,easeOutCubic],[0.28,0.4,-0.7,-1.4,easeOutCubic],[0.4,0.55,-1.4,HOLD_ARM_L,easeOutCubic]];
  var E_ARM_R = [[0,0.08,0,-0.15,easeInOutSine],[0.08,0.28,-0.15,0.7,easeOutCubic],[0.28,0.4,0.7,1.4,easeOutCubic],[0.35,0.55,1.4,HOLD_ARM_R,easeOutCubic]];
  var E_ARM_RAD = [[0,0.28,1,1,easeOutCubic],[0.28,0.55,1,HOLD_ARM_RADIAL,easeOutCubic]];
  var E_BODY_Y = [[0,0.1,0,-7,easeInOutSine],[0.1,0.28,-7,14,easeOutCubic],[0.28,0.4,14,HOLD_BODY_Y,easeOutCubic],[0.4,0.55,HOLD_BODY_Y,HOLD_BODY_Y,easeInOutSine]];
  var E_ORB_SX = [[0,0.08,1,1,easeInOutSine],[0.08,0.28,1,1.04,easeOutBack],[0.28,0.4,1.04,1.07,easeOutBack],[0.4,0.55,1.07,1,easeOutCubic]];
  var E_ORB_SY = [[0,0.08,1,1.03,easeInOutSine],[0.08,0.28,1.03,0.93,easeOutBack],[0.28,0.4,0.93,0.9,easeOutBack],[0.4,0.55,0.9,1,easeOutCubic]];
  var E_GLOW = [[0,0.55,0.25,HOLD_GLOW,easeOutCubic]];

  function computePerched(t) {
    if (t < ENTRANCE_END) {
      return {
        armLAngle: piecewise(t, E_ARM_L), armRAngle: piecewise(t, E_ARM_R),
        legLAngle: 0, legRAngle: 0,
        orbScaleX: piecewise(t, E_ORB_SX), orbScaleY: piecewise(t, E_ORB_SY),
        bodyHopY: piecewise(t, E_BODY_Y), bodyLeanX: 0,
        armRadial: piecewise(t, E_ARM_RAD), legLRad: 1, legRRad: 1,
        glow: piecewise(t, E_GLOW),
      };
    }
    var th = t - ENTRANCE_END;
    var swing = LEG_AMP * Math.cos((2 * Math.PI * th) / LEG_PERIOD);
    var phase = swing / LEG_AMP;
    var bp = 2 * Math.PI * BREATH_FREQ_P * th;
    return {
      armLAngle: HOLD_ARM_L, armRAngle: HOLD_ARM_R, legLAngle: swing, legRAngle: swing,
      orbScaleX: 1, orbScaleY: 1 + BREATH_AMP * Math.sin(bp),
      bodyHopY: HOLD_BODY_Y, bodyLeanX: -LEAN_AMP * phase,
      armRadial: HOLD_ARM_RADIAL,
      legLRad: 1 + FORESHORTEN_AMP * phase, legRRad: 1 - FORESHORTEN_AMP * phase,
      glow: HOLD_GLOW + GLOW_PULSE_AMP * Math.sin(bp),
    };
  }

  // ── draw one limb: cubic bezier (anchor→delta) with perpendicular bow + nub ──
  function limb(ctx, sc, ax, ay, dx, dy, bowSign, angle) {
    var len = Math.sqrt(dx * dx + dy * dy);
    ctx.save();
    ctx.translate(ax * sc, ay * sc);
    ctx.rotate(angle);
    if (len > 0.001) {
      var px = -dy / len, py = dx / len, bow = len * 0.12 * bowSign;
      var c1x = (dx * 0.33 + px * bow) * sc, c1y = (dy * 0.33 + py * bow) * sc;
      var c2x = (dx * 0.66 + px * bow) * sc, c2y = (dy * 0.66 + py * bow) * sc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, dx * sc, dy * sc);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = LIMB_STROKE * sc;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(dx * sc, dy * sc, NUB_R * sc, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
    ctx.restore();
  }

  function rgba(r, g, b, a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

  function draw(ctx, size, tSec) {
    var sc = size / REF;
    var cx = ORB_CX * sc, cy = ORB_CY * sc, orbR = ORB_R * sc;
    var f = computePerched(tSec);

    // universal coral breath (rides on REST coral)
    var coral = clamp01(REST_CORAL + Math.sin(tSec * BREATH_FREQ) * CORAL_BREATH_AMP);
    var coreR = orbR * lerp(0.6, 0.96, coral);
    var coreA = lerp(0.62, 1.0, coral);
    var glow = clamp01(f.glow);

    // perched auto-blink
    var blink = 0;
    var bphase = tSec % PERCHED_BLINK_PERIOD;
    if (bphase < AUTO_BLINK_WINDOW_S) { var bt = bphase / AUTO_BLINK_WINDOW_S; blink = bt < 0.5 ? bt * 2 : 2 - bt * 2; }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    // device-pixel-ratio crispness
    var dpr = ctx.__dpr || 1; ctx.scale(dpr, dpr);

    // body: hop (sit) translate + lean rotation around orb center
    ctx.translate(0, f.bodyHopY * sc);
    ctx.translate(cx, cy); ctx.rotate(f.bodyLeanX); ctx.translate(-cx, -cy);

    // LAYER 1 — outer cyan halo (approximation of the blurred Skia halo)
    ctx.save();
    ctx.globalAlpha = glow;
    var halo = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, HALO_R * sc);
    halo.addColorStop(0, rgba(158, 229, 229, 0.45));
    halo.addColorStop(0.55, rgba(158, 229, 229, 0.18));
    halo.addColorStop(1, rgba(158, 229, 229, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, HALO_R * sc, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // LAYER 2 — limbs (behind orb). Arms bow inward (-1 / +1), legs outward (+1 / -1).
    var armDxL = ARM_L_DX * f.armRadial, armDyL = ARM_L_DY * f.armRadial;
    var armDxR = ARM_R_DX * f.armRadial, armDyR = ARM_R_DY * f.armRadial;
    var legDxL = LEG_EP_L[0] * f.legLRad, legDyL = LEG_EP_L[1] * f.legLRad;
    var legDxR = LEG_EP_R[0] * f.legRRad, legDyR = LEG_EP_R[1] * f.legRRad;
    limb(ctx, sc, ARM_L_AX, ARM_L_AY, armDxL, armDyL, -1, f.armLAngle);
    limb(ctx, sc, ARM_R_AX, ARM_R_AY, armDxR, armDyR, 1, f.armRAngle);
    limb(ctx, sc, LEG_L_AX, LEG_L_AY, legDxL, legDyL, 1, f.legLAngle);
    limb(ctx, sc, LEG_R_AX, LEG_R_AY, legDxR, legDyR, -1, f.legRAngle);

    // LAYER 3 — orb (Y-breath scale around center)
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(f.orbScaleX, f.orbScaleY); ctx.translate(-cx, -cy);

    // 3a cyan frosted body
    var body = ctx.createRadialGradient(cx, cy - orbR * 0.28, 0, cx, cy - orbR * 0.28, orbR * 1.02);
    body.addColorStop(0, rgba(210, 249, 249, 1));
    body.addColorStop(0.42, rgba(150, 232, 233, 1));
    body.addColorStop(0.74, rgba(108, 208, 213, 1));
    body.addColorStop(1, rgba(84, 186, 197, 1));
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill();

    // clip to orb for core + depth
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.clip();
    // 3b restrained coral core (breathes)
    var core = ctx.createRadialGradient(cx, cy + orbR * 0.1, 0, cx, cy + orbR * 0.1, coreR);
    core.addColorStop(0, rgba(255, 242, 210, 1.0 * coreA));
    core.addColorStop(0.28, rgba(255, 186, 118, 0.92 * coreA));
    core.addColorStop(0.55, rgba(250, 140, 86, 0.6 * coreA));
    core.addColorStop(0.8, rgba(242, 124, 74, 0.26 * coreA));
    core.addColorStop(1, rgba(236, 116, 68, 0));
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.fill();
    // 3c bottom-edge teal depth
    var depth = ctx.createRadialGradient(cx, cy + orbR * 0.62, 0, cx, cy + orbR * 0.62, orbR * 0.9);
    depth.addColorStop(0, rgba(34, 120, 134, 0.4));
    depth.addColorStop(0.7, rgba(34, 120, 134, 0));
    depth.addColorStop(1, rgba(34, 120, 134, 0));
    ctx.fillStyle = depth; ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 3d soft top-left specular (never glossy)
    ctx.save();
    ctx.globalAlpha = 0.5;
    var spec = ctx.createRadialGradient(cx - orbR * 0.3, cy - orbR * 0.4, 0, cx - orbR * 0.3, cy - orbR * 0.4, orbR * 0.42);
    spec.addColorStop(0, rgba(255, 255, 255, 0.9));
    spec.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.arc(cx - orbR * 0.3, cy - orbR * 0.4, orbR * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // inner bright cyan rim
    ctx.save();
    ctx.lineWidth = orbR * 0.06;
    ctx.strokeStyle = rgba(158, 229, 229, 0.7);
    ctx.beginPath(); ctx.arc(cx, cy, orbR * 0.99, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    ctx.restore(); // end orb scale

    // eyes (two dots, blink squash Y) + gaze offset
    var exL = (EYE_L_X + EYE_OFFSET_X) * sc, exR = (EYE_R_X + EYE_OFFSET_X) * sc;
    var ey = (EYE_Y + EYE_OFFSET_Y) * sc;
    var rx = EYE_DOT_R * sc, ry = EYE_DOT_R * sc * Math.max(0.06, 1 - blink * 0.95);
    function eye(ex) {
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0B12'; ctx.fill();
      // tiny shine
      ctx.globalAlpha = clamp01(1 - blink * 1.7) * 0.9;
      ctx.beginPath(); ctx.ellipse(ex - rx * 0.34, ey - ry * 0.4, rx * 0.4, ry * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    eye(exL); eye(exR);

    ctx.restore();
  }

  function mount(canvas) {
    var size = parseInt(canvas.getAttribute('data-size') || '70', 10);
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    var hPx = Math.round(size * PERCHED_CANVAS_H_MULT);
    canvas.style.width = size + 'px';
    canvas.style.height = hPx + 'px';
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(hPx * dpr);
    var ctx = canvas.getContext('2d');
    ctx.__dpr = dpr;
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      draw(ctx, size, (ts - start) / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function init() {
    var nodes = document.querySelectorAll('[data-echo-perched]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
