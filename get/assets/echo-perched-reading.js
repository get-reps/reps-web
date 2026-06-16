/* echo-perched-reading.js — self-contained "perched · reading a book" Echo.
   Engine extracted byte-for-byte from tmp/echo-motion-prototype.html (canonical Canvas-2D
   port of the Skia stack). Mounts on <canvas data-echo-perched-reading data-size="N">.
   Do not hand-edit the engine block; re-run tmp/extract-reading.cjs from the prototype. */
(function () {
  'use strict';
const REF = 200;
      const ORB_CX = 100, ORB_CY = 100, ORB_R = 50, HALO_R = 84;
      const EYE_L_X = 84, EYE_R_X = 116, EYE_Y = 90, EYE_DOT_R = 3.4;
      const EYE_ARC_HALF_W = 4.6, EYE_ARC_DEPTH = 2.4;
      const ARM_L_ANCHOR_X = 56, ARM_L_ANCHOR_Y = 106, ARM_R_ANCHOR_X = 144, ARM_R_ANCHOR_Y = 106;
      const LEG_L_ANCHOR_X = 84, LEG_L_ANCHOR_Y = 145, LEG_R_ANCHOR_X = 116, LEG_R_ANCHOR_Y = 145;
      const ARM_L_DX = -16, ARM_L_DY = 28, ARM_R_DX = 16, ARM_R_DY = 28;
      const LEG_L_DX = -8, LEG_L_DY = 32, LEG_R_DX = 8, LEG_R_DY = 32;
      const LIMB_STROKE = 2, NUB_R = 4;
      const SPARKLES = [
        { x: 80, y: 78, r: 0.8 }, { x: 122, y: 84, r: 0.6 }, { x: 90, y: 120, r: 0.6 },
        { x: 116, y: 118, r: 0.7 }, { x: 100, y: 73, r: 0.5 }, { x: 128, y: 104, r: 0.55 },
        { x: 73, y: 102, r: 0.6 }, { x: 106, y: 128, r: 0.5 }, { x: 95, y: 95, r: 0.45 },
      ];
      const BREATH_FREQ = 1.5, CORAL_BREATH_AMP = 0.32; // universal coral-core breath (Echo.tsx)

      // ─── math ──────────────────────────────────────────────────────────────────
      const lerp = (a, b, t) => a + (b - a) * t;
      const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
      const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
      const BACK_C1 = 1.70158, BACK_C3 = BACK_C1 + 1;
      const easeOutBack = (t) => 1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2);

      function sample(kfs, t, easing = easeInOutSine) {
        if (t <= kfs[0].t) return kfs[0].v;
        for (let i = 0; i < kfs.length - 1; i++) {
          const a = kfs[i], b = kfs[i + 1];
          if (t <= b.t) { const p = clamp01((t - a.t) / (b.t - a.t)); return lerp(a.v, b.v, easing(p)); }
        }
        return kfs[kfs.length - 1].v;
      }
      function sampleVec(kfs, t, easing = easeInOutSine) {
        const x = sample(kfs.map((k) => ({ t: k.t, v: k.v[0] })), t, easing);
        const y = sample(kfs.map((k) => ({ t: k.t, v: k.v[1] })), t, easing);
        return [x, y];
      }

      // Plant a foot at a FIXED screen pos despite the body transform (translate(ox,oy)
      // ∘ rotate(lean) about orb center 100,100). Returns the leg endpoint [dx,dy].
      function plantFoot(hipX, hipY, fixedX, fixedY, lean, ox, oy) {
        const vx = fixedX - 100 - ox, vy = fixedY - 100 - oy;
        const c = Math.cos(lean), s = Math.sin(lean);
        return [100 + (vx * c + vy * s) - hipX, 100 + (-vx * s + vy * c) - hipY];
      }

      function restFrame() {
        return {
          bodyLeanX: 0, bodyOffsetX: 0, bodyHopY: 0,
          orbScaleX: 1, orbScaleY: 1,
          armLAngle: 0, armRAngle: 0, legLAngle: 0, legRAngle: 0,
          armLEndpoint: [ARM_L_DX, ARM_L_DY], armREndpoint: [ARM_R_DX, ARM_R_DY],
          armLFront: false, armRFront: false, armRBowScale: 1,
          eyeOffsetX: 0, eyeOffsetY: 0, eyeScale: 1, eyeArcOpacity: 0,
          blinkAmountL: 0, blinkAmountR: 0,
          glow: 0.25, coralLevel: 0.58,
          phoneOpacity: 0,
        };
      }

      // ─── curious (Iteration 3 — GROUNDED weight-shift turn) ──────────────────────
      // Stands on the ground and TURNS: weight sinks onto a foot (bodyHopY DOWN, legs
      // compress so feet stay on the ground line), body turns over the planted foot,
      // gaze snaps+fixates, then weight transfers to the other foot. NO free hover bob;
      // bodyHopY >= 0 always; reduced cant (±0.11); plant lands BEFORE the turn peaks.
      const CURIOUS_LOOP_MS = 6000;
      const CUR_ENTRANCE_MS = 520;
      const CUR_EYE_SCALE = 1.06, CUR_GLOW = 0.34, CUR_LEG_DY = 32, CUR_LEG_LDX = -8, CUR_LEG_RDX = 8;
      const CUR_BHOP = [{t:0,v:2.5},{t:700,v:2.5},{t:1550,v:2.9},{t:1800,v:2.9},{t:2150,v:1.4},{t:2400,v:0.0},{t:2550,v:2.2},{t:2720,v:2.5},{t:3420,v:2.5},{t:4250,v:2.9},{t:4500,v:2.9},{t:4850,v:1.4},{t:5100,v:0.0},{t:5400,v:2.2},{t:6000,v:2.5}];
      const CUR_LEAN = [{t:0,v:-0.11},{t:700,v:-0.11},{t:1550,v:-0.115},{t:1800,v:-0.115},{t:2150,v:-0.07},{t:2400,v:0.008},{t:2550,v:0.03},{t:2720,v:0.11},{t:3420,v:0.11},{t:4250,v:0.115},{t:4500,v:0.115},{t:4850,v:0.07},{t:5100,v:-0.008},{t:5400,v:-0.06},{t:6000,v:-0.11}];
      const CUR_BOFF = [{t:0,v:-3},{t:700,v:-3},{t:1550,v:-3.2},{t:1800,v:-3.2},{t:2150,v:-1.6},{t:2400,v:0.2},{t:2550,v:2.4},{t:2720,v:3},{t:3420,v:3},{t:4250,v:3.2},{t:4500,v:3.2},{t:4850,v:1.6},{t:5100,v:-0.2},{t:5400,v:-2.4},{t:6000,v:-3}];
      const CUR_EYE_X = [{t:0,v:-5.0},{t:1550,v:-5.0},{t:1700,v:-4.6},{t:2050,v:-4.6},{t:2150,v:-3.0},{t:2350,v:5.0},{t:4050,v:5.0},{t:4200,v:4.6},{t:4550,v:4.6},{t:4700,v:3.0},{t:4900,v:-5.0},{t:6000,v:-5.0}];
      const CUR_EYE_Y = [{t:0,v:-2.0},{t:560,v:-2.0},{t:680,v:1.6},{t:1360,v:1.6},{t:1550,v:-0.8},{t:1900,v:-0.9},{t:2150,v:-1.0},{t:2350,v:-2.0},{t:3100,v:-2.0},{t:3220,v:1.6},{t:3900,v:1.6},{t:4250,v:-0.8},{t:4600,v:-0.9},{t:4850,v:-1.0},{t:5400,v:-2.0},{t:6000,v:-2.0}];
      const CUR_ORB_X = [{t:0,v:1.0},{t:1550,v:1.0},{t:2400,v:1.005},{t:2720,v:1.0},{t:4250,v:1.0},{t:5100,v:1.005},{t:5400,v:1.008},{t:6000,v:1.0}];
      const CUR_ORB_Y = [{t:0,v:1.025},{t:700,v:1.025},{t:1550,v:1.03},{t:1800,v:1.03},{t:2400,v:0.995},{t:2550,v:0.985},{t:2720,v:1.02},{t:3420,v:1.025},{t:4250,v:1.03},{t:5100,v:0.995},{t:5400,v:0.985},{t:6000,v:1.025}];
      // Arms stay low + never cross under the body (armL negative-X, armR positive-X).
      const CUR_ARM_L = [{t:0,v:[-17,30]},{t:1550,v:[-16,31]},{t:1800,v:[-16,31]},{t:2400,v:[-15,30]},{t:2720,v:[-12,31]},{t:4250,v:[-11,31]},{t:4500,v:[-11,31]},{t:5100,v:[-15,30]},{t:5400,v:[-17,30]},{t:6000,v:[-17,30]}];
      const CUR_ARM_R = [{t:0,v:[15,30]},{t:1550,v:[12,31]},{t:1800,v:[12,31]},{t:2400,v:[15,30]},{t:2720,v:[18,31]},{t:4250,v:[19,31]},{t:4500,v:[19,31]},{t:5100,v:[15,30]},{t:5400,v:[15,30]},{t:6000,v:[15,30]}];
      // Planted-foot anchors (fixed screen positions): feet do NOT move.
      const CUR_FOOT_LX = 76, CUR_FOOT_LY = 177, CUR_FOOT_RX = 124, CUR_FOOT_RY = 177, CUR_HIP_LX = 84, CUR_HIP_LY = 145, CUR_HIP_RX = 116, CUR_HIP_RY = 145;
      function computeCuriousFrame(tMs, opts = {}) {
        const f = restFrame();
        if (opts.reducedMotion) {
          const hop = 2.0, rLean = -0.09, rOff = -2.4;
          f.bodyLeanX = rLean; f.bodyOffsetX = rOff; f.bodyHopY = hop;
          f.eyeOffsetX = -4.0; f.eyeOffsetY = -1.5; f.eyeScale = CUR_EYE_SCALE;
          f.legLEndpoint = plantFoot(CUR_HIP_LX, CUR_HIP_LY, CUR_FOOT_LX, CUR_FOOT_LY, rLean, rOff, hop);
          f.legREndpoint = plantFoot(CUR_HIP_RX, CUR_HIP_RY, CUR_FOOT_RX, CUR_FOOT_RY, rLean, rOff, hop);
          f.legLAngle = 0; f.legRAngle = 0;
          f.armLEndpoint = [-17, 30]; f.armREndpoint = [15, 30];
          f.orbScaleX = 1.005; f.orbScaleY = 1.02; f.glow = 0.30; return f;
        }
        if (tMs < CUR_ENTRANCE_MS) {
          const hop = sample([{t:0,v:0},{t:130,v:0.6},{t:250,v:2.2},{t:420,v:2.5},{t:520,v:2.5}], tMs, easeOutCubic);
          f.bodyHopY = hop;
          f.bodyLeanX = sample([{t:0,v:0},{t:130,v:0.01},{t:250,v:-0.04},{t:420,v:-0.11},{t:520,v:-0.11}], tMs, easeOutCubic);
          f.bodyOffsetX = sample([{t:0,v:0},{t:130,v:-0.8},{t:250,v:-2.4},{t:420,v:-3},{t:520,v:-3}], tMs, easeOutCubic);
          f.legLEndpoint = plantFoot(CUR_HIP_LX, CUR_HIP_LY, CUR_FOOT_LX, CUR_FOOT_LY, f.bodyLeanX, f.bodyOffsetX, hop);
          f.legREndpoint = plantFoot(CUR_HIP_RX, CUR_HIP_RY, CUR_FOOT_RX, CUR_FOOT_RY, f.bodyLeanX, f.bodyOffsetX, hop);
          f.legLAngle = 0; f.legRAngle = 0;
          f.eyeOffsetX = sample([{t:0,v:0},{t:130,v:-1.0},{t:250,v:-5.0},{t:420,v:-5.2},{t:520,v:-5.0}], tMs, easeOutQuint);
          f.eyeOffsetY = sample([{t:0,v:0},{t:130,v:-0.5},{t:250,v:-2.0},{t:420,v:-2.2},{t:520,v:-2.0}], tMs, easeOutQuint);
          f.eyeScale = sample([{t:0,v:1.0},{t:130,v:1.04},{t:250,v:CUR_EYE_SCALE},{t:520,v:CUR_EYE_SCALE}], tMs, easeInOutSine);
          f.orbScaleX = sample([{t:0,v:1.0},{t:250,v:1.005},{t:520,v:1.0}], tMs, easeOutCubic);
          f.orbScaleY = sample([{t:0,v:1.0},{t:250,v:0.99},{t:420,v:1.02},{t:520,v:1.025}], tMs, easeOutCubic);
          f.armLEndpoint = sampleVec([{t:0,v:[-16,28]},{t:250,v:[-17,29]},{t:420,v:[-17,30]},{t:520,v:[-17,30]}], tMs, easeInOutSine);
          f.armREndpoint = sampleVec([{t:0,v:[16,28]},{t:250,v:[16,29]},{t:420,v:[15,30]},{t:520,v:[15,30]}], tMs, easeInOutSine);
          f.glow = sample([{t:0,v:0.28},{t:250,v:0.34},{t:520,v:CUR_GLOW}], tMs, easeOutCubic);
          return f;
        }
        const lt = (tMs - CUR_ENTRANCE_MS) % CURIOUS_LOOP_MS;
        const hop = sample(CUR_BHOP, lt, easeOutCubic);
        const lean = sample(CUR_LEAN, lt, easeOutCubic);
        const off = sample(CUR_BOFF, lt, easeOutCubic);
        f.bodyHopY = hop; f.bodyLeanX = lean; f.bodyOffsetX = off;
        f.legLEndpoint = plantFoot(CUR_HIP_LX, CUR_HIP_LY, CUR_FOOT_LX, CUR_FOOT_LY, lean, off, hop);
        f.legREndpoint = plantFoot(CUR_HIP_RX, CUR_HIP_RY, CUR_FOOT_RX, CUR_FOOT_RY, lean, off, hop);
        f.legLAngle = 0; f.legRAngle = 0;
        f.eyeOffsetX = sample(CUR_EYE_X, lt, easeOutQuint);
        f.eyeOffsetY = sample(CUR_EYE_Y, lt, easeOutQuint);
        f.orbScaleX = sample(CUR_ORB_X, lt, easeOutCubic);
        f.orbScaleY = sample(CUR_ORB_Y, lt, easeOutCubic);
        f.armLEndpoint = sampleVec(CUR_ARM_L, lt, easeInOutSine);
        f.armREndpoint = sampleVec(CUR_ARM_R, lt, easeInOutSine);
        f.eyeScale = CUR_EYE_SCALE; f.glow = CUR_GLOW;
        const blinkAt = (c) => { const d = Math.abs(lt - c); return d < 55 ? 1 - d / 55 : 0; };
        const bl = Math.max(blinkAt(1150), blinkAt(3950));
        f.blinkAmountL = bl; f.blinkAmountR = bl;
        return f;
      }

      // ─── encouraging (Iteration 3 — warm SMILE + calm arms at rest) ─────────────
      // Arms BEHIND the orb at REST (armFront false, ≤2px from rest, symmetric — NOT
      // a gesture). Warmth carried by the FACE: a small warm closed-mouth smile
      // (mouthSmile) + open enlarged dot-eyes on the viewer + lean-IN + glow pulse +
      // a warm blink (~1500ms) and a reassurance nod-down (~2700ms). Entrance 640 → hold 3600.
      const ENCOURAGING_LOOP_MS = 3600;
      const ENC_ENTRANCE_MS = 640;
      const ENC_HOLD = { armY: 28.8, armRang: -0.02, orbScaleX: 1.04, orbScaleY: 1.02, bodyOffsetX: 3, bodyLeanX: 0.055, eyeScale: 1.13, eyeOffsetY: 0.5, mouthSmile: 0.68, glow: 0.41, coralLevel: 0.62 };
      function computeEncouragingFrame(tMs, opts = {}) {
        const f = restFrame();
        f.armLFront = false; f.armRFront = false; f.coralLevel = 0.62; f.eyeArcOpacity = 0;
        if (opts.reducedMotion) {
          f.armLEndpoint = [-16, ENC_HOLD.armY]; f.armREndpoint = [16, ENC_HOLD.armY];
          f.armLAngle = -ENC_HOLD.armRang; f.armRAngle = ENC_HOLD.armRang;
          f.orbScaleX = ENC_HOLD.orbScaleX; f.orbScaleY = ENC_HOLD.orbScaleY;
          f.bodyOffsetX = ENC_HOLD.bodyOffsetX; f.bodyLeanX = ENC_HOLD.bodyLeanX; f.bodyHopY = 0;
          f.legLEndpoint = plantFoot(84,145,76,177, ENC_HOLD.bodyLeanX, ENC_HOLD.bodyOffsetX, 0);
          f.legREndpoint = plantFoot(116,145,124,177, ENC_HOLD.bodyLeanX, ENC_HOLD.bodyOffsetX, 0);
          f.eyeScale = ENC_HOLD.eyeScale; f.eyeOffsetX = 0; f.eyeOffsetY = ENC_HOLD.eyeOffsetY;
          f.mouthSmile = ENC_HOLD.mouthSmile; f.glow = 0.40; return f;
        }
        if (tMs < ENC_ENTRANCE_MS) {
          const armY = sample([{t:0,v:28},{t:100,v:28.5},{t:250,v:28.8},{t:380,v:29},{t:520,v:28.8},{t:640,v:28.8}], tMs, easeInOutSine);
          const armRang = sample([{t:0,v:0},{t:250,v:-0.02},{t:380,v:-0.03},{t:520,v:-0.02},{t:640,v:-0.02}], tMs, easeInOutSine);
          f.armREndpoint = [16, armY]; f.armLEndpoint = [-16, armY];
          f.armRAngle = armRang; f.armLAngle = -armRang;
          f.orbScaleX = sample([{t:0,v:1.0},{t:100,v:1.0},{t:250,v:1.02},{t:380,v:1.04},{t:520,v:1.04},{t:640,v:1.04}], tMs, easeOutCubic);
          f.orbScaleY = sample([{t:0,v:1.0},{t:100,v:0.99},{t:250,v:1.015},{t:380,v:1.035},{t:520,v:1.025},{t:640,v:1.02}], tMs, easeOutCubic);
          f.bodyOffsetX = sample([{t:0,v:0},{t:100,v:-1.0},{t:250,v:2},{t:380,v:3},{t:640,v:3}], tMs, easeOutCubic);
          f.bodyLeanX = sample([{t:0,v:0},{t:100,v:0.012},{t:250,v:0.045},{t:380,v:0.06},{t:520,v:0.055},{t:640,v:0.055}], tMs, easeOutCubic);
          f.bodyHopY = sample([{t:0,v:0},{t:100,v:1.0},{t:250,v:-0.5},{t:380,v:-1.5},{t:520,v:1.0},{t:640,v:0}], tMs, easeInOutSine);
          f.legLEndpoint = plantFoot(84,145,76,177, f.bodyLeanX, f.bodyOffsetX, f.bodyHopY);
          f.legREndpoint = plantFoot(116,145,124,177, f.bodyLeanX, f.bodyOffsetX, f.bodyHopY);
          f.eyeScale = sample([{t:0,v:1.06},{t:100,v:1.04},{t:250,v:1.11},{t:380,v:1.13},{t:640,v:1.13}], tMs, easeInOutSine);
          f.eyeOffsetX = 0;
          f.eyeOffsetY = sample([{t:0,v:0},{t:250,v:0.3},{t:380,v:0.5},{t:520,v:0.8},{t:640,v:0.5}], tMs, easeInOutSine);
          f.mouthSmile = sample([{t:0,v:0},{t:100,v:0.05},{t:250,v:0.4},{t:380,v:0.7},{t:520,v:0.68},{t:640,v:0.68}], tMs, easeOutCubic);
          f.glow = sample([{t:0,v:0.30},{t:100,v:0.31},{t:250,v:0.36},{t:380,v:0.42},{t:520,v:0.41},{t:640,v:0.41}], tMs, easeOutCubic);
          return f;
        }
        const h = (tMs - ENC_ENTRANCE_MS) % ENCOURAGING_LOOP_MS;
        const w1 = Math.sin((h / ENCOURAGING_LOOP_MS) * 2 * Math.PI);
        const w2 = Math.sin((h / 1800) * 2 * Math.PI);
        const armY = ENC_HOLD.armY + 0.5 * w1;
        f.armREndpoint = [16, armY]; f.armLEndpoint = [-16, armY];
        f.armRAngle = ENC_HOLD.armRang; f.armLAngle = -ENC_HOLD.armRang;
        f.orbScaleX = ENC_HOLD.orbScaleX + 0.015 * w1;
        f.orbScaleY = ENC_HOLD.orbScaleY + 0.015 * w1;
        f.bodyOffsetX = ENC_HOLD.bodyOffsetX;
        f.bodyLeanX = ENC_HOLD.bodyLeanX - 0.018 * w1;
        f.bodyHopY = -1.4 * w1;
        f.legLEndpoint = plantFoot(84,145,76,177, f.bodyLeanX, f.bodyOffsetX, f.bodyHopY);
        f.legREndpoint = plantFoot(116,145,124,177, f.bodyLeanX, f.bodyOffsetX, f.bodyHopY);
        f.eyeScale = ENC_HOLD.eyeScale; f.eyeOffsetX = 0; f.eyeOffsetY = ENC_HOLD.eyeOffsetY + 0.4 * w1;
        f.mouthSmile = ENC_HOLD.mouthSmile + 0.04 * w2;
        f.glow = ENC_HOLD.glow + 0.04 * w1;
        const d = Math.abs(h - 1500); const bl = d < 110 ? 1 - d / 110 : 0;
        f.blinkAmountL = bl; f.blinkAmountR = bl;
        return f;
      }

      // ─── tired (droop family — dry-run for echo-motion-factory, 2026-06-09) ──────
      // Weight-SINK slump onto PLANTED feet (bodyHopY >= 0 sink-only, NO hover), dim
      // STEADY glow (no flicker), arms hang LIMP+LOW (follow-through, not a gesture),
      // half-lidded eyes (blinkAmount floor 0.50), slow heavy breath + one slow blink.
      // Entrance 620 (overshoot-free easeOut sigh) → hold breath 3800. Body sinks
      // FIRST, arms TRAIL ~180ms, eyes droop LAST. Symmetric (bodyLeanX 0 = not sad).
      // Loop = 6400ms = 2 x 3200ms breaths; the YAWN fires near the START (150ms) so the
      // first yawn lands ~770ms after mount, then ~4.5s quiet between yawns (Mike: start
      // quick, yawn every ~4-5s).
      const TIRED_LOOP_MS = 6400;
      const TIR_BREATH_MS = 3200;
      const TIR_YAWN_START = 150, TIR_YAWN_END = 3000;
      const TIR_ENTRANCE_MS = 620;
      const TIR_HOLD = { bodyHopY: 3.0, orbScaleX: 1.015, orbScaleY: 0.97, armY: 34, armDx: 19, eyeOffsetY: 2.4, eyeScale: 0.94, blinkFloor: 0.50, glow: 0.19, coral: 0.55 };
      // Yawn beat keyframes (rel to TIR_YAWN_START). Edges = base breath/floor so the beat splices seam-free.
      const TIR_YMOUTH = [{t:0,v:0},{t:250,v:0.05},{t:600,v:0.70},{t:850,v:0.95},{t:1100,v:0.93},{t:2100,v:0.92},{t:2400,v:0.20},{t:2550,v:0},{t:2850,v:0}];
      // Cup OVER the mouth: peak nub dx -42 → screen x≈102 (mouth center 100), dy 2 → caps the cavity.
      const TIR_YARM = [{t:0,v:[19,34]},{t:250,v:[6,24]},{t:600,v:[-30,7]},{t:850,v:[-42,2]},{t:1100,v:[-42,2]},{t:2100,v:[-42,2]},{t:2400,v:[-18,12]},{t:2550,v:[8,26]},{t:2850,v:[19,34]}];
      const TIR_YBLINK = [{t:0,v:0.50},{t:250,v:0.42},{t:600,v:0.78},{t:850,v:1.0},{t:1100,v:1.0},{t:2100,v:1.0},{t:2400,v:0.55},{t:2550,v:0.50},{t:2850,v:0.50}];
      // inhale pulse: 0 at edges, 1 at mid (~925) — SUBTRACTED from breath bodyHopY (clamped >=0).
      const tirInhalePulse = (rel) => (rel < 0 || rel > 2850) ? 0 : 0.5 * (1 - Math.cos((rel / 2850) * 2 * Math.PI));
      function computeTiredFrame(tMs, opts = {}) {
        const f = restFrame();
        f.coralLevel = TIR_HOLD.coral; f.eyeArcOpacity = 0;
        if (opts.reducedMotion) {
          const hop = 2.5;
          f.bodyHopY = hop; f.bodyLeanX = 0; f.bodyOffsetX = 0;
          f.orbScaleX = 1.012; f.orbScaleY = 0.975;
          f.armLEndpoint = [-19, 34]; f.armREndpoint = [19, 34];
          f.legLEndpoint = plantFoot(84,145,76,177, 0, 0, hop);
          f.legREndpoint = plantFoot(116,145,124,177, 0, 0, hop);
          f.legLAngle = 0; f.legRAngle = 0;
          f.eyeOffsetX = 0; f.eyeOffsetY = 2.4; f.eyeScale = 0.94;
          f.blinkAmountL = 0.50; f.blinkAmountR = 0.50; f.glow = 0.19; return f;
        }
        if (tMs < TIR_ENTRANCE_MS) {
          // Anticipation hold-up @120 → body RELEASES + sinks (easeOut, no overshoot).
          const hop = sample([{t:0,v:0},{t:120,v:0},{t:360,v:2.4},{t:500,v:3.0},{t:620,v:3.0}], tMs, easeOutCubic);
          f.bodyHopY = hop; f.bodyLeanX = 0; f.bodyOffsetX = 0;
          f.orbScaleX = sample([{t:0,v:1.0},{t:120,v:1.005},{t:360,v:1.012},{t:500,v:1.015},{t:620,v:1.015}], tMs, easeOutCubic);
          f.orbScaleY = sample([{t:0,v:1.0},{t:120,v:1.005},{t:360,v:0.975},{t:500,v:0.97},{t:620,v:0.97}], tMs, easeOutCubic);
          // Arms TRAIL the body: still near rest-x at 360 when the body has sunk; droop low by 620.
          f.armLEndpoint = sampleVec([{t:0,v:[-16,28]},{t:120,v:[-16,28]},{t:360,v:[-17,31]},{t:500,v:[-19,33]},{t:620,v:[-19,34]}], tMs, easeInOutSine);
          f.armREndpoint = sampleVec([{t:0,v:[16,28]},{t:120,v:[16,28]},{t:360,v:[17,31]},{t:500,v:[19,33]},{t:620,v:[19,34]}], tMs, easeInOutSine);
          f.legLEndpoint = plantFoot(84,145,76,177, 0, 0, hop);
          f.legREndpoint = plantFoot(116,145,124,177, 0, 0, hop);
          f.legLAngle = 0; f.legRAngle = 0;
          f.eyeOffsetX = 0;
          f.eyeOffsetY = sample([{t:0,v:0},{t:120,v:0.3},{t:360,v:1.4},{t:500,v:2.2},{t:620,v:2.4}], tMs, easeInOutSine);
          f.eyeScale = sample([{t:0,v:1.0},{t:120,v:1.0},{t:360,v:0.96},{t:500,v:0.94},{t:620,v:0.94}], tMs, easeInOutSine);
          // Eyes droop to the half-lid floor LAST.
          const bl = sample([{t:0,v:0},{t:120,v:0.10},{t:360,v:0.35},{t:500,v:0.48},{t:620,v:0.50}], tMs, easeInOutSine);
          f.blinkAmountL = bl; f.blinkAmountR = bl;
          f.glow = sample([{t:0,v:0.25},{t:120,v:0.26},{t:360,v:0.21},{t:500,v:0.19},{t:620,v:0.19}], tMs, easeOutCubic);
          return f;
        }
        // Hold = 4 slow breaths (3800ms sub-rhythm) + one polite YAWN at 7600ms. seam @15200=0.
        const h = (tMs - TIR_ENTRANCE_MS) % TIRED_LOOP_MS;
        const bph = (h / TIR_BREATH_MS) * 2 * Math.PI; // 4 integer cycles over 15200
        const s1 = Math.sin(bph); // 0 at seam, slope-continuous
        let hop = 3.0 - 2.0 * (1 + Math.sin(bph - Math.PI / 2)) / 2; // breath, range [1.0,3.0]
        f.bodyLeanX = 0; f.bodyOffsetX = 0;
        f.orbScaleX = TIR_HOLD.orbScaleX - 0.008 * s1; // anti-coupled heave
        f.orbScaleY = TIR_HOLD.orbScaleY + 0.012 * s1; // un-squash on the in-breath
        f.eyeOffsetX = 0; f.eyeOffsetY = TIR_HOLD.eyeOffsetY + 0.4 * s1; f.eyeScale = TIR_HOLD.eyeScale;
        f.glow = TIR_HOLD.glow + 0.03 * s1; // dim-steady swell, band 0.16-0.22, NO flicker
        const armRYbreath = TIR_HOLD.armY + 0.6 * s1; // dead-weight arm breath
        let armR = [TIR_HOLD.armDx, armRYbreath]; // RIGHT arm: cup during the yawn, breath otherwise
        let armRFront = false;
        let bl = TIR_HOLD.blinkFloor; // no standalone blink — the yawn is the loop's one eye-close
        f.mouthOpen = 0;
        // ── YAWN overlay (once per loop) ──
        if (h >= TIR_YAWN_START && h <= TIR_YAWN_END) {
          const rel = h - TIR_YAWN_START;
          f.mouthOpen = sample(TIR_YMOUTH, rel, easeInOutSine);
          armR = sampleVec(TIR_YARM, rel, easeInOutSine);
          armRFront = armR[1] < 16; // hand raised in FRONT of the face, over the mouth
          bl = sample(TIR_YBLINK, rel, easeInOutSine); // eyes scrunch shut at the peak
          const st = tirInhalePulse(rel); // deeper inhale: orb rises (hop down toward 0), clamp >=0
          hop = Math.max(0, hop - 2.4 * st);
          f.orbScaleY += 0.01 * st; f.orbScaleX -= 0.006 * st; // coupled inhale stretch
        }
        f.bodyHopY = hop;
        f.armLEndpoint = [-TIR_HOLD.armDx, armRYbreath]; // LEFT arm always limp (never the cup)
        f.armREndpoint = armR; f.armRFront = armRFront;
        f.legLEndpoint = plantFoot(84,145,76,177, 0, 0, hop);
        f.legREndpoint = plantFoot(116,145,124,177, 0, 0, hop);
        f.legLAngle = 0; f.legRAngle = 0;
        f.blinkAmountL = bl; f.blinkAmountR = bl;
        return f;
      }

      function wrongFrame() {
        const f = restFrame();
        f.glow = 0.12; f.armLAngle = -0.55; f.armRAngle = 0.55;
        f.orbScaleX = 0.93; f.orbScaleY = 0.93; f.eyeArcOpacity = 0.45; return f;
      }

      // ─── sad v2 (droop family — AFFECT redesign; aching withdrawal) ──────────────────
      // v1 was recognizable-but-flat (Mike: "bland… virtually no emotional response"). v2
      // leads with the FACE: the grief BROW tents (∧ inner-corners up), the eyes GROW
      // (eyeScale 1.12 — v1 shrank them to 0.93, the cardinal error) and go WET (eyeShine
      // wells 0.85→0.95), and the gaze COMMITS down-AND-AWAY (eyeOffX -1.6, eyeOffY +3.4).
      // Staged loss of composure: gaze breaks → brow crumples → body wilts → arms self-hug →
      // frown LAST. Keeps the droop grounding (planted feet, bodyHopY>=0, noCoralBreath warm
      // core). Mirrors lib/echo/sadChoreography.ts (the timing authority).
      const SAD_LOOP_MS = 4200;
      const SAD_ENTRANCE_MS = 700;
      const SAD_D2R = Math.PI / 180;
      function setSadBrow(f, tentDeg, raise, op) {
        f.browOpacity = op;
        f.browAngleL = -tentDeg * SAD_D2R; // inner (right) end UP — the grief ∧ tent
        f.browAngleR = tentDeg * SAD_D2R;  // inner (left) end UP
        f.browRaiseL = raise; f.browRaiseR = raise;
      }
      function computeSadFrame(tMs, opts = {}) {
        const f = restFrame();
        f.eyeArcOpacity = 0; f.noCoralBreath = true;
        if (opts.reducedMotion) {
          const hop = 2.2;
          f.bodyHopY = hop; f.bodyLeanX = 0; f.bodyOffsetX = 0;
          f.orbScaleX = 0.987; f.orbScaleY = 1.020;
          f.armLEndpoint = [-9, 34]; f.armREndpoint = [9, 34];
          f.legLEndpoint = plantFoot(84,145,76,177, 0, 0, hop);
          f.legREndpoint = plantFoot(116,145,124,177, 0, 0, hop);
          f.legLAngle = 0; f.legRAngle = 0;
          f.eyeOffsetX = 0; f.eyeOffsetY = 1.5; f.eyeScale = 1.0; f.eyeShine = 0.30; f.eyeGap = 0; f.sadEye = 1;
          f.blinkAmountL = 0; f.blinkAmountR = 0;
          setSadBrow(f, 12, 1.6, 0.85);
          f.mouthFrown = 0.12; f.glow = 0.13; f.coralLevel = 0.66;
          return f;
        }
        if (tMs < SAD_ENTRANCE_MS) {
          // Staged: gaze breaks down-AND-AWAY FIRST (easeOutCubic = a decision), brows tent
          // ~60ms later (easeInOutSine, no snap), body wilts, arms self-hug + frown LAST.
          const hop = sample([{t:0,v:0},{t:140,v:0},{t:300,v:1.0},{t:480,v:2.0},{t:700,v:2.6}], tMs, easeOutCubic);
          f.bodyHopY = hop; f.bodyLeanX = 0; f.bodyOffsetX = 0;
          f.orbScaleX = sample([{t:0,v:1.0},{t:140,v:1.004},{t:300,v:0.994},{t:480,v:0.988},{t:700,v:0.986}], tMs, easeOutCubic);
          f.orbScaleY = sample([{t:0,v:1.0},{t:140,v:1.006},{t:300,v:1.012},{t:480,v:1.018},{t:700,v:1.022}], tMs, easeOutCubic);
          // Arms TRAIL + close to the self-hug; LEFT leads the RIGHT by ~20ms.
          f.armLEndpoint = sampleVec([{t:0,v:[-16,28]},{t:140,v:[-16,28]},{t:300,v:[-14,29]},{t:480,v:[-11,32]},{t:700,v:[-9,34]}], tMs, easeInOutSine);
          f.armREndpoint = sampleVec([{t:0,v:[16,28]},{t:160,v:[16,28]},{t:320,v:[14,29]},{t:500,v:[11,32]},{t:700,v:[9,34]}], tMs, easeInOutSine);
          f.legLEndpoint = plantFoot(84,145,76,177, 0, 0, hop);
          f.legREndpoint = plantFoot(116,145,124,177, 0, 0, hop);
          f.legLAngle = 0; f.legRAngle = 0;
          f.eyeOffsetX = 0;
          f.eyeOffsetY = sample([{t:0,v:0},{t:140,v:-0.3},{t:300,v:0.8},{t:480,v:1.3},{t:700,v:1.5}], tMs, easeOutCubic);
          f.eyeScale = 1.0; f.eyeShine = 0.30; f.eyeGap = 0;
          // Eyes CLOSE into the downcast pensive almond (sadEye 0→1) — the dominant sad signal.
          f.sadEye = sample([{t:0,v:0},{t:140,v:0.1},{t:300,v:0.5},{t:480,v:0.85},{t:700,v:1.0}], tMs, easeInOutSine);
          // A SOFT delicate worried brow eases in (subtle — the closed eyes carry the read).
          const brOp = sample([{t:0,v:0},{t:140,v:0.15},{t:300,v:0.5},{t:480,v:0.75},{t:700,v:0.85}], tMs, easeInOutSine);
          const brTent = sample([{t:0,v:0},{t:140,v:3},{t:300,v:7},{t:480,v:10},{t:700,v:12}], tMs, easeInOutSine);
          const brRaise = sample([{t:0,v:0},{t:140,v:0.3},{t:300,v:0.9},{t:480,v:1.3},{t:700,v:1.6}], tMs, easeInOutSine);
          setSadBrow(f, brTent, brRaise, brOp);
          f.blinkAmountL = 0; f.blinkAmountR = 0;
          f.mouthFrown = sample([{t:0,v:0},{t:140,v:0},{t:300,v:0.04},{t:480,v:0.08},{t:700,v:0.12}], tMs, easeInOutSine);
          f.glow = sample([{t:0,v:0.25},{t:140,v:0.23},{t:300,v:0.18},{t:480,v:0.135},{t:700,v:0.12}], tMs, easeOutCubic);
          f.coralLevel = sample([{t:0,v:0.58},{t:140,v:0.60},{t:300,v:0.63},{t:480,v:0.66},{t:700,v:0.67}], tMs, easeOutCubic);
          return f;
        }
        // Hold — slow heavy breath + a WELLING wet-eye/brow pulse at the in-breath + one slow
        // "swallow-it-down" blink. Everything is driven by `rise` (raised-cosine: 0 at the
        // seam/out-breath, 1 at the in-breath) so the entrance→hold join AND the loop seam are
        // value+slope continuous (rise and its slope are 0 at h=0 and h=4200).
        const h = (tMs - SAD_ENTRANCE_MS) % SAD_LOOP_MS;
        const bph = (h / SAD_LOOP_MS) * 2 * Math.PI;
        const rise = (1 - Math.cos(bph)) / 2; // 0 → 1 (in-breath, welling) → 0
        const hop = 2.6 - 1.55 * rise; // [1.05, 2.6], max at seam, >= 0
        f.bodyHopY = hop; f.bodyLeanX = 0; f.bodyOffsetX = 0;
        f.orbScaleX = 0.986 + 0.006 * rise;
        f.orbScaleY = 1.022 - 0.006 * rise;
        f.eyeOffsetX = 0; f.eyeOffsetY = 1.5 - 0.3 * rise; // a faint lift on the in-breath
        f.eyeScale = 1.0; f.eyeGap = 0; f.eyeShine = 0.30; f.sadEye = 1; // closed downcast pensive eye
        setSadBrow(f, 12 + 1 * rise, 1.6 + 0.3 * rise, 0.85); // soft delicate tent, wells a hair with the breath
        f.mouthFrown = 0.12;
        f.glow = 0.12 + 0.015 * rise; // withdrawn halo
        f.coralLevel = 0.67 + 0.04 * rise; // warm core stays high, pulses with the breath
        const armY = 34 - 0.6 * rise; // arms lift a hair on the in-breath
        f.armLEndpoint = [-9, armY]; f.armREndpoint = [9, armY];
        f.legLEndpoint = plantFoot(84,145,76,177, 0, 0, hop);
        f.legREndpoint = plantFoot(116,145,124,177, 0, 0, hop);
        f.legLAngle = 0; f.legRAngle = 0;
        f.blinkAmountL = 0; f.blinkAmountR = 0; // eyes are the closed downcast almond — no blink
        return f;
      }

      // ─── scanning (action family — Echo photographs the bookshelf; ITER-2) ─────────
      // ITER-2 fixes: (1) FLUID — the bob/orb-pulse/bodyHopY are CLOSED-FORM SINES (no
      // keyframe-knot dead-stops); the once-per-loop raise is a Hann-windowed additive
      // bump. (2) FACE-AS-A-UNIT — a held body turn toward the shelf (bodyLeanX +0.06,
      // orbScaleX ~0.98 reshape, left foot steps 76→80), eyeOffsetX collapsed to ~+1.6 so
      // the eyes don't slide alone (mouth rides the bodyLeanX group). Mirrors
      // lib/echo/scanningChoreography.ts (the timing authority).
      const SCANNING_LOOP_MS = 4400;
      const SCAN_ENTRANCE_MS = 600;
      const SCANNING_FLASH_AT_MS = 3150;
      const SCANNING_FLASH_DUR_MS = 450;
      const SCAN_OMEGA = (2 * Math.PI * 2) / SCANNING_LOOP_MS; // 2 alive-cycles/loop
      const SCAN_HIP_LX = 84, SCAN_HIP_LY = 145, SCAN_HIP_RX = 116, SCAN_HIP_RY = 145;
      const SCAN_RFOOT_X = 124, SCAN_LFOOT_X0 = 76, SCAN_FOOT_Y = 177;
      // Hann raise window: 0 in the bob band, easeInOutSine in/out, zero-slope edges.
      function scanRaiseWindow(lt) {
        if (lt <= 2550 || lt >= 4150) return 0;
        if (lt <= 3150) return easeInOutSine((lt - 2550) / 600);
        return 1 - easeInOutSine((lt - 3150) / 1000);
      }
      function scanBlink(lt) {
        const pulse = (c) => { const d = 65; if (lt < c - d || lt > c + d) return 0; return 1 - Math.abs(lt - c) / d; };
        return Math.max(pulse(700), pulse(4050));
      }
      // shared pose writer (feet planted via plantFoot under the LIVE body transform)
      function scanPose(f, armR, lean, offX, hop, orbX, orbY, eyeX, eyeY, eyeScale, smile, leftX, blink) {
        f.armREndpoint = armR; f.armLEndpoint = [-16, 28];
        f.bodyLeanX = lean; f.bodyOffsetX = offX; f.bodyHopY = hop;
        f.orbScaleX = orbX; f.orbScaleY = orbY;
        f.eyeOffsetX = eyeX; f.eyeOffsetY = eyeY; f.eyeScale = eyeScale; f.mouthSmile = smile;
        f.blinkAmountL = blink; f.blinkAmountR = blink;
        f.legLEndpoint = plantFoot(SCAN_HIP_LX, SCAN_HIP_LY, leftX, SCAN_FOOT_Y, lean, offX, hop);
        f.legREndpoint = plantFoot(SCAN_HIP_RX, SCAN_HIP_RY, SCAN_RFOOT_X, SCAN_FOOT_Y, lean, offX, hop);
      }
      const SCAN_LOOP0 = { armR:[20,6], lean:0.09, offX:2.4, hop:1.05, orbX:0.97, orbY:1.0, eyeX:2.0, eyeY:2.0, eyeScale:1.05, smile:0.45, leftX:76 };
      const SCAN_REST0 = { armR:[16,28], lean:0, offX:0, hop:1.0, orbX:1.0, orbY:1.0, eyeX:0, eyeY:0, eyeScale:1.04, smile:0.30, leftX:76 };
      function computeScanningFrame(tMs, opts = {}) {
        const f = restFrame();
        f.phoneOpacity = 1; f.armRFront = true; f.armLFront = false;
        f.eyeArcOpacity = 0; f.coralLevel = 0.58; f.glow = 0.32;
        if (opts.reducedMotion) {
          scanPose(f, [22, -4], 0.10, 2.8, 1.0, 0.965, 1.0, 2.6, 1.0, 1.06, 0.45, 83, 0);
          return f;
        }
        if (tMs < SCAN_ENTRANCE_MS) {
          const e = easeOutCubic(tMs / SCAN_ENTRANCE_MS);
          const L = SCAN_REST0, R = SCAN_LOOP0;
          scanPose(f,
            [lerp(L.armR[0], R.armR[0], e), lerp(L.armR[1], R.armR[1], e)],
            lerp(L.lean, R.lean, e), lerp(L.offX, R.offX, e), lerp(L.hop, R.hop, e),
            lerp(L.orbX, R.orbX, e), lerp(L.orbY, R.orbY, e),
            lerp(L.eyeX, R.eyeX, e), lerp(L.eyeY, R.eyeY, e),
            lerp(L.eyeScale, R.eyeScale, e), lerp(L.smile, R.smile, e), lerp(L.leftX, R.leftX, e), 0);
          return f;
        }
        const lt = (tMs - SCAN_ENTRANCE_MS) % SCANNING_LOOP_MS;
        const w = scanRaiseWindow(lt);
        const s = Math.sin(SCAN_OMEGA * lt); // smooth bob/breath, no knots
        const lean = 0.09 + 0.025 * w;
        const offX = 2.4 + 1.0 * w;
        const hop = 1.05 + 0.75 * s; // 0.3..1.8, >= 0
        const orbX = 0.97 - 0.012 * s - 0.022 * w;
        const orbY = 1.0 + 0.012 * s;
        const dy = lerp(6 + 6 * s, -20, w);
        const dx = 20 + 6 * w;
        const eyeX = 2.0 + 0.4 * s + 0.6 * w;
        const eyeY = lerp(2.0 + 0.4 * s, 0.3, w);
        const eyeScale = 1.05 + 0.04 * w;
        const smile = 0.45 + 0.1 * w;
        const leftX = 76 + 8 * w;
        scanPose(f, [dx, dy], lean, offX, hop, orbX, orbY, eyeX, eyeY, eyeScale, smile, leftX, scanBlink(lt));
        return f;
      }
      // phone-tip REF (host flash-cone origin) — nub through the body transform + [+9,-2].
      function phoneTipFromFrame(frame) {
        const nx = ARM_R_ANCHOR_X + frame.armREndpoint[0];
        const ny = ARM_R_ANCHOR_Y + frame.armREndpoint[1];
        const vx = nx - 100, vy = ny - 100, lean = frame.bodyLeanX || 0;
        const rx = 100 + (vx * Math.cos(lean) - vy * Math.sin(lean)) + (frame.bodyOffsetX || 0);
        const ry = 100 + (vx * Math.sin(lean) + vy * Math.cos(lean)) + (frame.bodyHopY || 0);
        return [rx + 9, ry - 2];
      }
      // flash envelope over [3150,3600]: fast attack, slower decay (a camera pop)
      function scanFlashEnv(lt) {
        if (lt < SCANNING_FLASH_AT_MS || lt > SCANNING_FLASH_AT_MS + SCANNING_FLASH_DUR_MS) return 0;
        const r = lt - SCANNING_FLASH_AT_MS;
        return r < 120 ? r / 120 : 1 - (r - 120) / (SCANNING_FLASH_DUR_MS - 120);
      }

      // ─── perched base (the shared SIT) — legs hang+swing+foreshorten, gentle breath,
      //     counter-balance lean. Ported from lib/echo/perchedChoreography.ts (seconds →
      //     ms here). NO bodyHopY oscillation — sitting people don't float; breath lives
      //     in orbScaleY + a glow micro-pulse. The two variants below layer accessories
      //     (book+book-arms / headphones+ledge-grip-arms) on top of this base.
      const PERCH_SIT_Y = 18;
      const PERCH_LEG_PERIOD_MS = 1800, PERCH_LEG_AMP = 0.40, PERCH_FORESHORTEN = 0.18, PERCH_LEAN_AMP = 0.032;
      const PERCH_LEG_L = [-2, 33], PERCH_LEG_R = [2, 33];
      function perchedBase(f, tMs) {
        const sec = tMs / 1000;
        const swing = PERCH_LEG_AMP * Math.cos((2 * Math.PI * sec) / (PERCH_LEG_PERIOD_MS / 1000));
        const phase = swing / PERCH_LEG_AMP; // −1..+1
        const breath = 2 * Math.PI * 0.5 * sec;
        f.bodyHopY = PERCH_SIT_Y; f.bodyOffsetX = 0;
        f.bodyLeanX = -PERCH_LEAN_AMP * phase;
        f.orbScaleX = 1; f.orbScaleY = 1 + 0.012 * Math.sin(breath);
        f.glow = 0.24 + 0.02 * Math.sin(breath);
        const rl = 1 + PERCH_FORESHORTEN * phase, rr2 = 1 - PERCH_FORESHORTEN * phase;
        f.legLEndpoint = [PERCH_LEG_L[0] * rl, PERCH_LEG_L[1] * rl];
        f.legREndpoint = [PERCH_LEG_R[0] * rr2, PERCH_LEG_R[1] * rr2];
        f.legLAngle = swing; f.legRAngle = swing;
        return { swing, phase, breath };
      }

      // ─── perched · reading a book (accessory: open book + arms HOLDING the book) ─────
      // Echo perched, absorbed in an open book held in both hands. Reading gaze scans the
      // lines (eyeOffsetX slow L↔R), a page turns ~once per loop, a calm blink, legs sway.
      const PERCHED_READING_LOOP_MS = 5200;
      const PR_PAGE_AT = 3600, PR_PAGE_DUR = 760;
      function prPageEnv(lt) { return (lt < PR_PAGE_AT || lt > PR_PAGE_AT + PR_PAGE_DUR) ? 0 : (lt - PR_PAGE_AT) / PR_PAGE_DUR; }
      function computePerchedReadingFrame(tMs, opts = {}) {
        const f = restFrame();
        f.coralLevel = 0.58;
        if (opts.reducedMotion) {
          perchedBase(f, 700);
          f.bodyLeanX = 0; f.legLAngle = 0; f.legRAngle = 0;
          f.legLEndpoint = PERCH_LEG_L.slice(); f.legREndpoint = PERCH_LEG_R.slice();
          f.armLFront = false; f.armRFront = false; // arms come from BEHIND the orb
          f.armLEndpoint = [17, 39]; f.armREndpoint = [-17, 39];
          f.armLBowScale = -0.5; f.armRBowScale = -0.5; f.handNubsFront = true;
          f.bookOpacity = 1; f.pageTurn = 0;
          f.eyeOffsetX = 0; f.eyeOffsetY = 3.2; f.eyeScale = 0.95;
          return f;
        }
        const lt = tMs % PERCHED_READING_LOOP_MS;
        perchedBase(f, tMs);
        const settle = clamp01(tMs / 320); // book + hands ease in
        // arms come from BEHIND the orb (back limbs); the gripping hand-nubs are re-drawn
        // in FRONT of the book so they read as holding it at its lower-outer corners
        f.armLFront = false; f.armRFront = false;
        f.armLEndpoint = [lerp(-16, 17, settle), lerp(28, 39, settle)];
        f.armREndpoint = [lerp(16, -17, settle), lerp(28, 39, settle)];
        f.armLAngle = 0; f.armRAngle = 0; f.armLBowScale = -0.5; f.armRBowScale = -0.5;
        f.handNubsFront = settle > 0.5;
        f.bookOpacity = settle;
        f.pageTurn = prPageEnv(lt);
        // reading gaze: down + slow line-scan; eyes shrink a touch (focused)
        f.eyeOffsetY = 3.2 * settle;
        f.eyeOffsetX = 2.4 * Math.sin((2 * Math.PI * lt) / 2600);
        f.eyeScale = 0.96;
        const d = Math.abs(lt - 1700); const bl = d < 90 ? 1 - d / 90 : 0;
        f.blinkAmountL = bl; f.blinkAmountR = bl;
        return f;
      }

      // ─── perched · headphones (accessory: over-ear cans + arms GRIPPING the ledge edge) ─
      // Hands are free, so they grip the front lip of the ledge; the head grooves to the
      // beat (orb pulse + side-to-side sway), the near foot taps, eyes content-closed.
      const PERCHED_HEADPHONES_LOOP_MS = 4320; // 8 beats × 540ms (~111 bpm)
      const PH_BEAT_MS = 540;
      function computePerchedHeadphonesFrame(tMs, opts = {}) {
        const f = restFrame();
        f.coralLevel = 0.60;
        if (opts.reducedMotion) {
          perchedBase(f, 500);
          f.bodyLeanX = 0; f.legLAngle = 0; f.legRAngle = 0;
          f.legLEndpoint = PERCH_LEG_L.slice(); f.legREndpoint = PERCH_LEG_R.slice();
          f.headphoneOpacity = 1; // no ledge — just Echo + headphones
          f.armLFront = false; f.armRFront = false; // arms rest at the sides, from behind
          f.armLEndpoint = [-15, 31]; f.armREndpoint = [15, 31];
          f.eyeArcOpacity = 0.92; f.mouthSmile = 0.46;
          return f;
        }
        perchedBase(f, tMs);
        const settle = clamp01(tMs / 320);
        f.headphoneOpacity = settle; // no ledge — just Echo + headphones
        // arms rest at the sides, coming from BEHIND the orb (back limbs); they sway a hair
        // with the groove but don't grip anything
        f.armLFront = false; f.armRFront = false;
        f.armLEndpoint = [-15, 31]; f.armREndpoint = [15, 31];
        f.armLAngle = 0; f.armRAngle = 0;
        // BEAT groove — orb pulses on the beat, head sways over a 2-beat bar; body stays
        // anchored (hands gripping the edge), so the head moves, not the seat.
        const beat = (tMs % PH_BEAT_MS) / PH_BEAT_MS;
        const pop = Math.pow(Math.sin(Math.PI * beat), 2);     // 0→1→0 each beat
        f.bodyHopY = PERCH_SIT_Y; // anchored
        f.bodyLeanX = 0.06 * Math.sin((2 * Math.PI * tMs) / (PH_BEAT_MS * 2));
        f.orbScaleY = (1 + 0.012 * Math.sin((2 * Math.PI * 0.5 * tMs) / 1000)) * (1 + 0.022 * pop);
        f.orbScaleX = 1 - 0.012 * pop;
        // foot-tap: RIGHT leg kicks out on each beat; LEFT hangs with a gentle sway
        const tap = Math.pow(Math.sin(Math.PI * beat), 3);
        f.legRAngle = -0.30 * tap; f.legREndpoint = PERCH_LEG_R.slice();
        f.legLAngle = 0.05 * Math.sin((2 * Math.PI * tMs) / (PH_BEAT_MS * 2)); f.legLEndpoint = PERCH_LEG_L.slice();
        // content: eyes happy-closed arcs, small smile, glow lifts on the beat
        f.eyeArcOpacity = 0.92; f.mouthSmile = 0.42 + 0.07 * pop; f.glow = 0.26 + 0.03 * pop;
        return f;
      }

      // ─── renderer: mirrors Echo.tsx draw order ───────────────────────────────────
      function limbPath(ctx, ax, ay, dx, dy, bowSign, bowScale, S) {
        const len = Math.hypot(dx, dy);
        ctx.beginPath();
        if (len < 0.001) { ctx.moveTo(ax * S, ay * S); return; }
        const px = -dy / len, py = dx / len, bow = len * 0.12 * bowSign * bowScale;
        const c1x = ax + dx * 0.33 + px * bow, c1y = ay + dy * 0.33 + py * bow;
        const c2x = ax + dx * 0.66 + px * bow, c2y = ay + dy * 0.66 + py * bow;
        ctx.moveTo(ax * S, ay * S);
        ctx.bezierCurveTo(c1x * S, c1y * S, c2x * S, c2y * S, (ax + dx) * S, (ay + dy) * S);
      }
      function drawLimb(ctx, ax, ay, dx, dy, bowSign, bowScale, angle, S) {
        ctx.save();
        ctx.translate(ax * S, ay * S); ctx.rotate(angle); ctx.translate(-ax * S, -ay * S);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(180,240,240,0.7)'; ctx.lineWidth = LIMB_STROKE * S * 2.2;
        ctx.shadowColor = 'rgba(158,229,229,0.9)'; ctx.shadowBlur = LIMB_STROKE * S * 1.6;
        limbPath(ctx, ax, ay, dx, dy, bowSign, bowScale, S); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(184,238,238,1)'; ctx.lineWidth = LIMB_STROKE * S;
        limbPath(ctx, ax, ay, dx, dy, bowSign, bowScale, S); ctx.stroke();
        const nx = (ax + dx) * S, ny = (ay + dy) * S, nr = NUB_R * S;
        const g = ctx.createRadialGradient(nx - nr * 0.35, ny - nr * 0.35, 0, nx, ny, nr);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, '#B8EEEE'); g.addColorStop(1, '#6FCBCB');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, 7); ctx.fill();
        ctx.restore();
      }

      function drawEcho(ctx, tile, frame, elapsedSec) {
        const S = tile / REF;
        const cx = ORB_CX * S, cy = ORB_CY * S, orbR = ORB_R * S;
        let coral = clamp01(frame.coralLevel + (frame.noCoralBreath ? 0 : Math.sin(elapsedSec * BREATH_FREQ) * CORAL_BREATH_AMP));
        const coreRadius = orbR * lerp(0.6, 0.96, coral);
        const coreAlpha = lerp(0.62, 1.0, coral);
        const glow = clamp01(frame.glow);

        // Ledge — accessory layer (ledgeOpacity lever). The edge Echo is perched ON.
        // Drawn STATIONARY (outside the body transform) so it stays level while Echo
        // grooves on top; the front-arm hands (inside the transform) grip its top lip.
        drawLedge(ctx, S, clamp01(frame.ledgeOpacity || 0));

        ctx.save();
        ctx.translate(frame.bodyOffsetX * S, frame.bodyHopY * S);
        ctx.translate(cx, cy); ctx.rotate(frame.bodyLeanX); ctx.translate(-cx, -cy);

        ctx.save(); ctx.globalAlpha = glow;
        let hg = ctx.createRadialGradient(cx, cy, orbR * 0.4, cx, cy, HALO_R * S);
        hg.addColorStop(0.4, 'rgba(158,229,229,0.55)'); hg.addColorStop(1, 'rgba(158,229,229,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, HALO_R * S, 0, 7); ctx.fill();
        ctx.restore();

        const aL = frame.armLEndpoint, aR = frame.armREndpoint;
        if (!frame.armLFront) drawLimb(ctx, ARM_L_ANCHOR_X, ARM_L_ANCHOR_Y, aL[0], aL[1], -1, (frame.armLBowScale ?? 1), frame.armLAngle, S);
        if (!frame.armRFront) drawLimb(ctx, ARM_R_ANCHOR_X, ARM_R_ANCHOR_Y, aR[0], aR[1], 1, frame.armRBowScale, frame.armRAngle, S);
        // Legs honor per-frame endpoint overrides (plantFoot) so planted-feet states render
        // faithfully — the orb leans/sinks above stationary feet (fixes the iter-1 harness gap
        // where legs drew from fixed constants + tilted with bodyLeanX).
        const lL = frame.legLEndpoint || [LEG_L_DX, LEG_L_DY];
        const lR = frame.legREndpoint || [LEG_R_DX, LEG_R_DY];
        drawLimb(ctx, LEG_L_ANCHOR_X, LEG_L_ANCHOR_Y, lL[0], lL[1], 1, 1, frame.legLAngle, S);
        drawLimb(ctx, LEG_R_ANCHOR_X, LEG_R_ANCHOR_Y, lR[0], lR[1], -1, 1, frame.legRAngle, S);

        ctx.save(); ctx.translate(cx, cy); ctx.scale(frame.orbScaleX, frame.orbScaleY); ctx.translate(-cx, -cy);
        let bg = ctx.createRadialGradient(cx, cy - orbR * 0.28, 0, cx, cy - orbR * 0.28, orbR * 1.02);
        bg.addColorStop(0, 'rgba(210,249,249,1)'); bg.addColorStop(0.42, 'rgba(150,232,233,1)');
        bg.addColorStop(0.74, 'rgba(108,208,213,1)'); bg.addColorStop(1, 'rgba(84,186,197,1)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, 7); ctx.clip();
        let cg = ctx.createRadialGradient(cx, cy + orbR * 0.1, 0, cx, cy + orbR * 0.1, coreRadius);
        cg.addColorStop(0, `rgba(255,242,210,${1.0 * coreAlpha})`);
        cg.addColorStop(0.28, `rgba(255,186,118,${0.92 * coreAlpha})`);
        cg.addColorStop(0.55, `rgba(250,140,86,${0.6 * coreAlpha})`);
        cg.addColorStop(0.8, `rgba(242,124,74,${0.26 * coreAlpha})`);
        cg.addColorStop(1, 'rgba(236,116,68,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, 7); ctx.fill();
        let dg = ctx.createRadialGradient(cx, cy + orbR * 0.62, 0, cx, cy + orbR * 0.62, orbR * 0.9);
        dg.addColorStop(0, 'rgba(34,120,134,0.40)'); dg.addColorStop(0.7, 'rgba(34,120,134,0)'); dg.addColorStop(1, 'rgba(34,120,134,0)');
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, 7); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 0.5;
        let sg = ctx.createRadialGradient(cx - orbR * 0.3, cy - orbR * 0.4, 0, cx - orbR * 0.3, cy - orbR * 0.4, orbR * 0.42);
        sg.addColorStop(0, 'rgba(255,255,255,0.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx - orbR * 0.3, cy - orbR * 0.4, orbR * 0.42, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        for (const s of SPARKLES) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(s.x * S, s.y * S, s.r * S, 0, 7); ctx.fill(); }
        let rg = ctx.createRadialGradient(cx, cy, orbR * 0.84, cx, cy, orbR * 1.06);
        rg.addColorStop(0, 'rgba(158,232,236,0)'); rg.addColorStop(0.84, 'rgba(186,244,247,0.30)');
        rg.addColorStop(0.95, 'rgba(150,240,246,0.92)'); rg.addColorStop(1, 'rgba(120,224,236,0.55)');
        ctx.lineWidth = orbR * 0.08; ctx.strokeStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, orbR * 1.02, 0, 7); ctx.stroke();
        ctx.restore();

        // Headphones — over-ear held/attached prop (headphoneOpacity lever). Band arcs
        // over the crown + two ear-cups straddle the orb sides; cyan-accented to match
        // the wire limbs. Drawn AFTER the orb (sits on it) but inside the body transform
        // so it bobs/leans/nods WITH the head. Rigid (not orb-scaled). Below the eyes.
        drawHeadphones(ctx, S, clamp01(frame.headphoneOpacity || 0));

        ctx.save(); ctx.translate(frame.eyeOffsetX * S, frame.eyeOffsetY * S);
        const dotOpacity = clamp01(1 - frame.eyeArcOpacity);
        const eyeScale = frame.eyeScale ?? 1;
        const eyeGap = frame.eyeGap ?? 0; // signed REF px added to each eye's OUTWARD distance; <0 = drawn closer
        // eyeShine: bigger + brighter catchlight = the wet, held-back-tears eye (sad hero accent).
        const eyeShine = frame.eyeShine ?? 0.3;
        const shineScale = 0.42 + clamp01(eyeShine) * 0.55; // 0.42..0.97 — the wet swell
        const shineOp = clamp01(0.55 + eyeShine * 0.5);
        const sadEyeLvl = clamp01(frame.sadEye || 0); // 0 = open dots, 1 = closed downcast almond (pensive 😔)
        function eye(ex, blink) {
          const dOp = dotOpacity * (1 - sadEyeLvl); // dots fade as the sad eye closes in
          if (dOp <= 0.01) return;
          const rx = EYE_DOT_R * S * eyeScale, ry = EYE_DOT_R * S * eyeScale * Math.max(0.05, 1 - blink * 0.95);
          ctx.fillStyle = `rgba(0,0,0,${dOp})`;
          ctx.beginPath(); ctx.ellipse(ex * S, EYE_Y * S, rx, ry, 0, 0, 7); ctx.fill();
          const lit = dOp * clamp01(1 - blink * 1.7);
          ctx.fillStyle = `rgba(255,255,255,${lit * shineOp})`;
          ctx.beginPath(); ctx.ellipse((ex - EYE_DOT_R * 0.34) * S, (EYE_Y - EYE_DOT_R * 0.4) * S, rx * shineScale, ry * shineScale, 0, 0, 7); ctx.fill();
        }
        // Closed downcast almond — the pensive 😔 sad eye (corners up, top edge sags, bottom
        // bulges down). Geometry derived from the reference Lottie eye, scaled to Echo.
        function drawSadEye(ex, op) {
          const X = ex * S, Y = EYE_Y * S, hw = 6 * S;
          ctx.fillStyle = `rgba(18,18,18,${op})`;
          ctx.beginPath();
          ctx.moveTo(X - hw, Y - 2.8 * S);
          ctx.quadraticCurveTo(X, Y + 0.8 * S, X + hw, Y - 2.8 * S); // top edge sags to ~Y-0.9
          ctx.quadraticCurveTo(X, Y + 9.0 * S, X - hw, Y - 2.8 * S); // bottom bulges down to ~Y+3.2
          ctx.closePath(); ctx.fill();
        }
        eye(EYE_L_X - eyeGap, frame.blinkAmountL); eye(EYE_R_X + eyeGap, frame.blinkAmountR);
        if (sadEyeLvl > 0.01) {
          drawSadEye(EYE_L_X - eyeGap, dotOpacity * sadEyeLvl);
          drawSadEye(EYE_R_X + eyeGap, dotOpacity * sadEyeLvl);
        }
        if (frame.eyeArcOpacity > 0.01) {
          ctx.strokeStyle = `rgba(0,0,0,${frame.eyeArcOpacity})`; ctx.lineWidth = 1.6 * S; ctx.lineCap = 'round';
          for (const ex of [EYE_L_X, EYE_R_X]) {
            ctx.beginPath();
            ctx.moveTo((ex - EYE_ARC_HALF_W) * S, EYE_Y * S);
            ctx.quadraticCurveTo(ex * S, (EYE_Y + EYE_ARC_DEPTH) * S, (ex + EYE_ARC_HALF_W) * S, EYE_Y * S);
            ctx.stroke();
          }
        }
        ctx.restore();

        // Brows — generic grief/anger/surprise inner-brow (browOpacity/browAngle/browRaise).
        // Drawn at ORB-FIXED Y (NOT translated by the eye-offset gaze) so the brow tents while
        // the gaze drops beneath it. Aligned to the eyeGap-adjusted eye X so they draw together.
        // Mirrors the Echo.tsx generic brow render.
        const browOp = clamp01(frame.browOpacity || 0);
        if (browOp > 0.01) {
          const browLen = 8 * S; // SHORT + THIN + soft — a delicate worried hairline, NOT a brutal slash
          const drawBrow = (exRef, raise, angle) => {
            const bx = exRef * S, by = (EYE_Y - 9.5 - (raise || 0)) * S; // sits HIGHER → breathing room above the eyes
            ctx.save();
            ctx.globalAlpha = browOp * 0.9; // a touch soft, not stark black
            ctx.translate(bx, by); ctx.rotate(angle || 0); ctx.translate(-bx, -by);
            ctx.strokeStyle = '#3a322c'; ctx.lineWidth = 1.3 * S; ctx.lineCap = 'round'; // thin + warm-dark, not #000
            ctx.beginPath();
            ctx.moveTo(bx - browLen / 2, by + 0.3 * S);
            ctx.quadraticCurveTo(bx, by - 0.9 * S, bx + browLen / 2, by + 0.3 * S); // gentle soft curve
            ctx.stroke();
            ctx.restore();
          };
          drawBrow(EYE_L_X - eyeGap, frame.browRaiseL, frame.browAngleL);
          drawBrow(EYE_R_X + eyeGap, frame.browRaiseR, frame.browAngleR);
        }

        // Mouth — generic open mouth = a round "O" YAWN (mouthOpen): NO tongue, NO lip
        // line across it. Mirrors Echo.tsx's generic (non-whisper) mouth render. Sits
        // BEFORE the front limbs so the cupped hand occludes it.
        const mOpen = clamp01(frame.mouthOpen || 0);
        if (mOpen > 0.001) {
          const MOUTH_CX = 100, MOUTH_Y = 109;
          const rxY = mOpen * 5.2 * S, ryY = mOpen * 6.2 * S; // slightly taller than wide
          const cyY = (MOUTH_Y + mOpen * 3.0) * S; // the O drops as the jaw opens
          ctx.fillStyle = 'rgba(40,26,20,0.94)'; // dark mouth cavity (no tongue)
          ctx.beginPath(); ctx.ellipse(MOUTH_CX * S, cyY, rxY, ryY, 0, 0, 7); ctx.fill();
        }
        const mSmile = clamp01(frame.mouthSmile || 0);
        if (mSmile > 0.001) {
          const MOUTH_CX = 100, MOUTH_Y = 109, MOUTH_HALF_W = 7.5;
          const mLx = (MOUTH_CX - MOUTH_HALF_W) * S, mRx = (MOUTH_CX + MOUTH_HALF_W) * S, mCx = MOUTH_CX * S;
          const mLY = (MOUTH_Y + 0.4 - 2.8 * mSmile) * S;
          const mRY = (MOUTH_Y - 2.8 * mSmile) * S;
          const mBelly = (MOUTH_Y + 1.9 + 0.8 * mSmile) * S;
          ctx.strokeStyle = '#3a2f29'; ctx.lineWidth = 1.7 * S; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(mLx, mLY); ctx.quadraticCurveTo(mCx, mBelly, mRx, mRY); ctx.stroke();
        }
        // Frown — tiny downturned arc (mouthFrown lever, sad). Corners DROP, belly LIFTS
        // above them so the existing lip quad inverts to a gentle ∩-down. Cap ~0.35 (a
        // bigger frown reads as crying). Mirrors the Echo.tsx generic frown render.
        const mFrown = clamp01(frame.mouthFrown || 0);
        if (mFrown > 0.001) {
          const MOUTH_CX = 100, MOUTH_Y = 109, MOUTH_HALF_W = 6.5;
          const mLx = (MOUTH_CX - MOUTH_HALF_W) * S, mRx = (MOUTH_CX + MOUTH_HALF_W) * S, mCx = MOUTH_CX * S;
          const mCornerY = (MOUTH_Y + 0.5 + 3.0 * mFrown) * S; // corners drop
          const mBelly = (MOUTH_Y + 1.2 - 5.0 * mFrown) * S; // belly lifts ABOVE the corners → frown
          ctx.strokeStyle = '#3a2f29'; ctx.lineWidth = 1.7 * S; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(mLx, mCornerY); ctx.quadraticCurveTo(mCx, mBelly, mRx, mCornerY); ctx.stroke();
        }

        // Open book — accessory layer (bookOpacity + pageTurn levers). Code-drawn open
        // book held in FRONT of the orb, BELOW the eyes. The front arm-nubs (hands) draw
        // AFTER this so they read as supporting it. NOT part of canonical Echo anatomy —
        // an accessory we composite onto the perched base.
        drawBook(ctx, S, clamp01(frame.bookOpacity || 0), clamp01(frame.pageTurn || 0));

        if (frame.armLFront) drawLimb(ctx, ARM_L_ANCHOR_X, ARM_L_ANCHOR_Y, aL[0], aL[1], -1, (frame.armLBowScale ?? 1), frame.armLAngle, S);
        if (frame.armRFront) drawLimb(ctx, ARM_R_ANCHOR_X, ARM_R_ANCHOR_Y, aR[0], aR[1], 1, frame.armRBowScale, frame.armRAngle, S);

        // Phone — held prop (phoneOpacity lever). Code-drawn device anchored at the RIGHT
        // nub, drawn in front (the hand holds it over the body), tilted to "aim right"
        // toward the shelf. NO glow/flash inside Echo — the flash is host FX.
        const phoneA = clamp01(frame.phoneOpacity || 0);
        if (phoneA > 0.001) {
          const nx = (ARM_R_ANCHOR_X + aR[0]) * S, ny = (ARM_R_ANCHOR_Y + aR[1]) * S;
          ctx.save();
          ctx.globalAlpha = phoneA;
          ctx.translate(nx, ny);
          ctx.rotate(0.42); // top tilts toward the shelf (screen-right)
          const pw = 10 * S, ph = 18 * S, pr = 2.6 * S, oy = -2.5 * S;
          // body (charcoal, natural prop color — not cyan-washed)
          ctx.fillStyle = '#2A2D34';
          rr(ctx, -pw / 2, oy - ph / 2, pw, ph, pr); ctx.fill();
          // screen (slightly lighter, faint cool tint)
          ctx.fillStyle = '#3C4350';
          rr(ctx, -pw / 2 + 1.4 * S, oy - ph / 2 + 2.2 * S, pw - 2.8 * S, ph - 4.4 * S, pr * 0.6); ctx.fill();
          // lens dot near the top (the "camera" facing up-right toward the shelf)
          ctx.fillStyle = '#525a68';
          ctx.beginPath(); ctx.arc(pw * 0.18, oy - ph / 2 + 1.0 * S, 1.2 * S, 0, 7); ctx.fill();
          ctx.restore();
        }

        // Hand-nubs in FRONT of a held accessory. The arm is a BACK limb (root hidden
        // behind the orb — "arms come from behind Echo, not the top"), but the gripping
        // hand wraps to the front, so re-draw just the nub on top of the book.
        if (frame.handNubsFront) {
          drawNub(ctx, (ARM_L_ANCHOR_X + aL[0]) * S, (ARM_L_ANCHOR_Y + aL[1]) * S, NUB_R * S);
          drawNub(ctx, (ARM_R_ANCHOR_X + aR[0]) * S, (ARM_R_ANCHOR_Y + aR[1]) * S, NUB_R * S);
        }

        ctx.restore();
      }
      // rounded-rect path helper (phone body)
      function rr(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      // ─── accessory layers (book / headphones / ledge) — composited onto the perched
      //     base, NOT part of canonical Echo anatomy. Each gated by its own opacity lever.
      function drawHeadphones(ctx, S, op) {
        if (op <= 0.001) return;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // headband: a ROUNDED arch (cubic) — rises fairly vertically from the cups then
        // curves smoothly over the top (the bend lives at the top, not a pointy peak). Apex
        // ~y44, a few px above the crown (orb top ≈ y50).
        const band = () => { ctx.beginPath(); ctx.moveTo(52 * S, 79 * S); ctx.bezierCurveTo(58 * S, 32 * S, 142 * S, 32 * S, 148 * S, 79 * S); };
        ctx.strokeStyle = '#2A2D34'; ctx.lineWidth = 6 * S; band(); ctx.stroke();
        ctx.strokeStyle = 'rgba(150,232,233,0.85)'; ctx.lineWidth = 1.8 * S; band(); ctx.stroke();
        // ear-cups: LARGE, ROUND, BULKY circumaural cushions centered over the EARS
        // (ear/eye level, mid-height), protruding outward past the side of the head.
        const cup = (cxr) => {
          const x = cxr * S, y = 95 * S, w = 21 * S, h = 31 * S, r = 10.5 * S;
          ctx.fillStyle = '#2A2D34'; rr(ctx, x - w / 2, y - h / 2, w, h, r); ctx.fill();
          ctx.strokeStyle = 'rgba(150,232,233,0.9)'; ctx.lineWidth = 1.7 * S;
          rr(ctx, x - w / 2 + 1.8 * S, y - h / 2 + 1.8 * S, w - 3.6 * S, h - 3.6 * S, r * 0.78); ctx.stroke();
          // soft ear-pad highlight (the cushion)
          ctx.fillStyle = 'rgba(120,208,213,0.32)';
          ctx.beginPath(); ctx.ellipse(x, y, w * 0.28, h * 0.34, 0, 0, 7); ctx.fill();
        };
        cup(49); cup(151);
        ctx.restore();
      }
      function drawBook(ctx, S, op, pageTurn) {
        if (op <= 0.001) return;
        ctx.save();
        ctx.globalAlpha = op;
        const P = (x, y) => [x * S, y * S];
        // Open book held up to read — CONCAVE (∪): the spine is the valley at the center
        // BOTTOM, the two cover halves sweep UP and OUT so the outer edges sit higher than
        // the spine. We see the warm COVERS (outer surface); a cream page-edge runs along
        // the concave top opening. This is the recognizable open-book silhouette, curved.
        const Cx = 100;
        const spineTopY = 131, spineBotY = 150;   // center spine = the valley (LOW)
        const Lx = 71, Rx = 129;                  // outer edges
        const outTopY = 114, outBotY = 143;       // outer edges ride HIGH (concave)
        // two curved cover halves
        const cover = (ox, fill) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(...P(Cx, spineTopY));                                            // spine top (valley)
          ctx.quadraticCurveTo(...P(lerp(Cx, ox, 0.5), spineTopY - 3), ...P(ox, outTopY)); // sweep up+out
          ctx.lineTo(...P(ox, outBotY));                                              // outer edge thickness
          ctx.quadraticCurveTo(...P(lerp(Cx, ox, 0.5), spineBotY + 2), ...P(Cx, spineBotY)); // back to valley
          ctx.closePath(); ctx.fill();
          // decorative cover inset rule, following the curve
          ctx.strokeStyle = 'rgba(255,240,210,0.30)'; ctx.lineWidth = 1 * S;
          ctx.beginPath();
          ctx.moveTo(...P(lerp(Cx, ox, 0.24), lerp(spineTopY, outTopY, 0.24) + 1));
          ctx.quadraticCurveTo(...P(lerp(Cx, ox, 0.6), lerp(spineTopY, outTopY, 0.6) - 1), ...P(lerp(Cx, ox, 0.84), lerp(spineTopY, outTopY, 0.84) + 1));
          ctx.lineTo(...P(lerp(Cx, ox, 0.84), lerp(spineBotY, outBotY, 0.84) - 2));
          ctx.lineTo(...P(lerp(Cx, ox, 0.24), lerp(spineBotY, outBotY, 0.24) - 2));
          ctx.closePath(); ctx.stroke();
        };
        cover(Lx, '#9C5526'); cover(Rx, '#B5642A');
        // cream page-block FILLING the concave opening, its top edge COINCIDENT with the
        // cover top edge (no gap) — the visible tops of the pages, following the curve.
        ctx.fillStyle = '#F1E7CF';
        ctx.beginPath();
        ctx.moveTo(...P(Lx, outTopY));
        ctx.quadraticCurveTo(...P(lerp(Cx, Lx, 0.5), spineTopY - 3), ...P(Cx, spineTopY));
        ctx.quadraticCurveTo(...P(lerp(Cx, Rx, 0.5), spineTopY - 3), ...P(Rx, outTopY));
        ctx.lineTo(...P(Rx - 2.5, outTopY + 5.5));
        ctx.quadraticCurveTo(...P(lerp(Cx, Rx, 0.5), spineTopY + 2.5), ...P(Cx, spineTopY + 5.5));
        ctx.quadraticCurveTo(...P(lerp(Cx, Lx, 0.5), spineTopY + 2.5), ...P(Lx + 2.5, outTopY + 5.5));
        ctx.closePath(); ctx.fill();
        // one faint ruled line on the page-block (follows the curve)
        ctx.strokeStyle = 'rgba(150,135,115,0.4)'; ctx.lineWidth = 0.7 * S; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(...P(Lx + 6, outTopY + 3));
        ctx.quadraticCurveTo(...P(Cx, spineTopY + 1.5), ...P(Rx - 6, outTopY + 3));
        ctx.stroke();
        // spine — the valley fold at the center bottom
        ctx.strokeStyle = 'rgba(60,40,28,0.6)'; ctx.lineWidth = 1.8 * S; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(...P(Cx, spineTopY)); ctx.lineTo(...P(Cx, spineBotY)); ctx.stroke();
        // page-turn: a cream page peels UP out of the opening (from ABOVE the page-block
        // edge), curls over, and drifts across to settle. Anchored ON the top edge.
        if (pageTurn > 0.001) {
          const lift = Math.sin(pageTurn * Math.PI);   // 0→1→0 curl height
          const sway = (pageTurn - 0.5) * 2;           // −1 → +1 (drifts R→L as it lands)
          const baseX = Cx + sway * 3;                 // hinge near the center of the opening
          ctx.fillStyle = '#FBF3DF';
          ctx.beginPath();
          ctx.moveTo(...P(baseX, spineTopY));
          ctx.quadraticCurveTo(...P(baseX + sway * 16, spineTopY - 16 - 18 * lift), ...P(baseX + sway * 26, outTopY - 4 - 12 * lift));
          ctx.lineTo(...P(baseX + sway * 22, outTopY + 3 - 4 * lift));
          ctx.quadraticCurveTo(...P(baseX + sway * 13, spineTopY - 5 - 4 * lift), ...P(baseX, spineTopY + 2));
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(150,135,115,0.35)'; ctx.lineWidth = 0.7 * S; ctx.stroke();
        }
        ctx.restore();
      }
      function drawLedge(ctx, S, op) {
        if (op <= 0.001) return;
        ctx.save();
        ctx.globalAlpha = op;
        const topY = 150 * S, x0 = 44 * S, x1 = 156 * S, h = 28 * S, r = 5 * S;
        const g = ctx.createLinearGradient(0, topY, 0, topY + h);
        g.addColorStop(0, 'rgba(120,196,201,0.55)'); g.addColorStop(1, 'rgba(70,150,160,0.28)');
        ctx.fillStyle = g; rr(ctx, x0, topY, x1 - x0, h, r); ctx.fill();
        // top lip highlight — where the hands grip
        ctx.strokeStyle = 'rgba(200,245,247,0.8)'; ctx.lineWidth = 1.6 * S;
        ctx.beginPath(); ctx.moveTo(x0 + r, topY); ctx.lineTo(x1 - r, topY); ctx.stroke();
        ctx.restore();
      }
      // a single cyan sphere-nub (the "hand") — used to draw a gripping hand in FRONT of a
      // held accessory when the arm itself comes from BEHIND the orb (back limb).
      function drawNub(ctx, nx, ny, nr) {
        const g = ctx.createRadialGradient(nx - nr * 0.35, ny - nr * 0.35, 0, nx, ny, nr);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, '#B8EEEE'); g.addColorStop(1, '#6FCBCB');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, 7); ctx.fill();
      }

      // ─── layout ──────────────────────────────────────────────────────────────────
      const TILE = 190, DPR = 2;
      function makeCell(parent, label, kls) {
        const cell = document.createElement('div'); cell.className = 'cell ' + (kls || 'cream');
        const cv = document.createElement('canvas'); cv.width = TILE * DPR; cv.height = TILE * DPR;
        const ctx = cv.getContext('2d'); ctx.scale(DPR, DPR);
        const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = label;
        cell.appendChild(cv); cell.appendChild(lbl); parent.appendChild(cell);
        return ctx;
      }
      function makeWideCell(parent, label, w, h, kls) {
        const cell = document.createElement('div'); cell.className = 'cell ' + (kls || 'cream');
        cell.style.width = w + 'px';
        const cv = document.createElement('canvas'); cv.width = w * DPR; cv.height = h * DPR;
        cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.style.maxWidth = 'none';
        const ctx = cv.getContext('2d'); ctx.scale(DPR, DPR);
        const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = label;
        cell.appendChild(cv); cell.appendChild(lbl); parent.appendChild(cell);
        return ctx;
      }
      // The composited Import-page scene: Echo (scanning) + bookshelf PNG-stand-in + the
      // HOST-owned camera flash (cone + burst + shelf-brighten), phase-locked to the apex.
      function drawScanningSceneCell(ctx, tMs) {
        const S = 0.9; // echoTile 180 / REF 200
        const frame = computeScanningFrame(tMs);
        const lt = tMs < SCAN_ENTRANCE_MS ? -1 : (tMs - SCAN_ENTRANCE_MS) % SCANNING_LOOP_MS;
        const env = lt < 0 ? 0 : scanFlashEnv(lt);
        // bookshelf stand-in (the real scene uses assets/bookshelf-friendly.png)
        const shx = 226, shy = 64, shw = 120, shh = 104;
        ctx.save();
        ctx.fillStyle = '#C8975A'; rr(ctx, shx, shy, shw, shh, 6); ctx.fill();
        ctx.fillStyle = '#B5824A'; ctx.fillRect(shx + 8, shy + 50, shw - 16, 6); // mid shelf
        ctx.fillStyle = '#9C6E3C'; ctx.fillRect(shx + 6, shy + 8, shw - 12, 40); // top recess
        ctx.fillStyle = '#9C6E3C'; ctx.fillRect(shx + 6, shy + 60, shw - 12, 36); // bottom recess
        const books = ['#6FA8A0', '#5B7FB5', '#D97A4A', '#E0A24A', '#8C6FB5'];
        books.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(shx + 16 + i * 14, shy + 14, 10, 30); });
        books.forEach((c, i) => { ctx.fillStyle = books[(i + 2) % 5]; ctx.fillRect(shx + 18 + i * 13, shy + 66, 9, 26); });
        if (env > 0) { // shelf brightens during the flash (host FX)
          ctx.globalCompositeOperation = 'lighter';
          let g = ctx.createRadialGradient(shx + 30, shy + shh * 0.4, 6, shx + 30, shy + shh * 0.4, shw);
          g.addColorStop(0, `rgba(255,228,170,${0.6 * env})`); g.addColorStop(1, 'rgba(255,228,170,0)');
          ctx.fillStyle = g; ctx.fillRect(shx - 20, shy - 20, shw + 60, shh + 50);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
        // Echo (left)
        drawEcho(ctx, 180, frame, tMs / 1000);
        // HOST flash FX — cone from the phone tip → shelf + radial burst at the tip
        if (env > 0) {
          const tip = phoneTipFromFrame(frame);
          const sx = tip[0] * S, sy = tip[1] * S;
          const tx = shx + 24, ty = shy + shh * 0.42;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const ang = Math.atan2(ty - sy, tx - sx), spread = 0.30, len = Math.hypot(tx - sx, ty - sy) * 1.04;
          let g = ctx.createLinearGradient(sx, sy, tx, ty);
          g.addColorStop(0, `rgba(255,240,200,${0.85 * env})`); g.addColorStop(1, 'rgba(255,228,170,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(ang - spread) * len, sy + Math.sin(ang - spread) * len);
          ctx.lineTo(sx + Math.cos(ang + spread) * len, sy + Math.sin(ang + spread) * len);
          ctx.closePath(); ctx.fill();
          let p = ctx.createRadialGradient(sx, sy, 1, sx, sy, 22 * env + 4);
          p.addColorStop(0, `rgba(255,255,255,${0.95 * env})`); p.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = p; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fill();
          ctx.restore();
        }
      }

  // ── mount: render perched-reading, CROPPED TIGHT to Echo's content box ──
  // BOX = Echo's animated bounding box in REF-200 coords (measured over a full page-turn
  // cycle, incl. page-lift + leg-sway) + small margin. Cropping removes the empty canvas
  // padding so Echo's FEET are the canvas bottom edge → it perches ON the bar, not above it.
  // data-size = the on-screen WIDTH of Echo's box. ALWAYS animates (decorative aria-hidden
  // mascot — intentionally not gated on prefers-reduced-motion).
  var BOX = { x0: 32, y0: 50, w: 132, h: 156 };
  function mountReading(canvas) {
    var displayW = parseInt(canvas.getAttribute('data-size') || '54', 10);
    var scale = displayW / BOX.w;
    var displayH = Math.round(BOX.h * scale);
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    var ctx = canvas.getContext('2d');
    var t0 = null;
    function tick(now) {
      if (t0 === null) t0 = now;
      var tMs = now - t0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -BOX.x0 * dpr * scale, -BOX.y0 * dpr * scale);
      drawEcho(ctx, 200, computePerchedReadingFrame(tMs), tMs / 1000);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function init() {
    var nodes = document.querySelectorAll('[data-echo-perched-reading]');
    for (var i = 0; i < nodes.length; i++) mountReading(nodes[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
