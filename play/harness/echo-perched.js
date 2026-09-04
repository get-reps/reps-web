(function() {
  "use strict";
  var REF = 200;
  var ORB_CX = 100, ORB_CY = 100, ORB_R = 50, HALO_R = 84;
  var EYE_L_X = 82.4, EYE_R_X = 117.6, EYE_Y = 98, EYE_DOT_R = 3.8, EYE_INK = "#20201E";
  var MOUTH_COLOR = "#332C24";
  var BROW_COLOR = "#382B25", BROW_OPACITY = 0.72;
  var GLASSES_URI = "data:image/png;base64,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";
  var GLASSES_X = 64.87, GLASSES_Y = 84.66, GLASSES_W = 70.4, GLASSES_H = 26.74;
  var glassesImg = null;
  if (typeof Image !== "undefined" && GLASSES_URI && GLASSES_URI.charAt(0) === "d") {
    glassesImg = new Image();
    glassesImg.src = GLASSES_URI;
  }
  var ARM_L_AX = 56, ARM_L_AY = 106, ARM_R_AX = 144, ARM_R_AY = 106;
  var LEG_L_AX = 84, LEG_L_AY = 145, LEG_R_AX = 116, LEG_R_AY = 145;
  var ARM_L_DX = -16, ARM_L_DY = 28, ARM_R_DX = 16, ARM_R_DY = 28;
  var NUB_R = 4, LIMB_STROKE = 2;
  var CYAN = "#9EE5E5";
  var CLICK_ARM_TARGETS = [
    { hand: "L", dx: -14, dy: 82 },
    // 0: question — nub (42,188), dist ~105
    { hand: "L", dx: -34, dy: 86 },
    // 1: opt0 top-left — nub (22,192), dist ~121
    { hand: "L", dx: -40, dy: 84 },
    // 2: opt2 bottom-left (deepest) — nub (16,190), dist ~123
    { hand: "L", dx: -8, dy: 88 },
    // 3: opt1 top-right/CORRECT — nub (48,194), dist ~108
    { hand: "L", dx: -24, dy: 90 }
    // 4: opt3 bottom-right — nub (32,196), dist ~118
  ];
  var GOLD_R = 212, GOLD_G = 162, GOLD_B = 78;
  var EYE_OFFSET_X = -3, EYE_OFFSET_Y = 2;
  var BREATH_FREQ = 1.5, CORAL_BREATH_AMP = 0.32, REST_CORAL = 0.58;
  var AUTO_BLINK_WINDOW_S = 0.11;
  var PERCHED_BLINK_PERIOD = 3.2;
  var PERCHED_CANVAS_H_MULT = 1.08;
  var ENTRANCE_END = 0.55, HOLD_BODY_Y = 22, HOLD_GLOW = 0.2;
  var HOLD_ARM_L = -1.35, HOLD_ARM_R = 1.35, HOLD_ARM_RADIAL = 0.85;
  var LEG_EP_L = [-2, 34], LEG_EP_R = [2, 34];
  var LEG_PERIOD = 1.8, LEG_AMP = 0.42, FORESHORTEN_AMP = 0.18, LEAN_AMP = 0.035;
  var BREATH_FREQ_P = 0.5, BREATH_AMP = 0.012, GLOW_PULSE_AMP = 0.02;
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
  var BACK_C1 = 1.70158, BACK_C3 = BACK_C1 + 1;
  function easeOutBack(t) {
    return 1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2);
  }
  function piecewise(t, pieces) {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (t < p[0]) continue;
      if (t <= p[1]) {
        var lt = clamp01((t - p[0]) / (p[1] - p[0]));
        return lerp(p[2], p[3], p[4](lt));
      }
    }
    return pieces.length ? pieces[pieces.length - 1][3] : 0;
  }
  var E_ARM_L = [[0, 0.08, 0, 0.15, easeInOutSine], [0.08, 0.28, 0.15, -0.7, easeOutCubic], [0.28, 0.4, -0.7, -1.4, easeOutCubic], [0.4, 0.55, -1.4, HOLD_ARM_L, easeOutCubic]];
  var E_ARM_R = [[0, 0.08, 0, -0.15, easeInOutSine], [0.08, 0.28, -0.15, 0.7, easeOutCubic], [0.28, 0.4, 0.7, 1.4, easeOutCubic], [0.35, 0.55, 1.4, HOLD_ARM_R, easeOutCubic]];
  var E_ARM_RAD = [[0, 0.28, 1, 1, easeOutCubic], [0.28, 0.55, 1, HOLD_ARM_RADIAL, easeOutCubic]];
  var E_BODY_Y = [[0, 0.1, 0, -7, easeInOutSine], [0.1, 0.28, -7, 14, easeOutCubic], [0.28, 0.4, 14, HOLD_BODY_Y, easeOutCubic], [0.4, 0.55, HOLD_BODY_Y, HOLD_BODY_Y, easeInOutSine]];
  var E_ORB_SX = [[0, 0.08, 1, 1, easeInOutSine], [0.08, 0.28, 1, 1.04, easeOutBack], [0.28, 0.4, 1.04, 1.07, easeOutBack], [0.4, 0.55, 1.07, 1, easeOutCubic]];
  var E_ORB_SY = [[0, 0.08, 1, 1.03, easeInOutSine], [0.08, 0.28, 1.03, 0.93, easeOutBack], [0.28, 0.4, 0.93, 0.9, easeOutBack], [0.4, 0.55, 0.9, 1, easeOutCubic]];
  var E_GLOW = [[0, 0.55, 0.25, HOLD_GLOW, easeOutCubic]];
  function computePerched(t) {
    if (t < ENTRANCE_END) {
      return {
        armLAngle: piecewise(t, E_ARM_L),
        armRAngle: piecewise(t, E_ARM_R),
        legLAngle: 0,
        legRAngle: 0,
        orbScaleX: piecewise(t, E_ORB_SX),
        orbScaleY: piecewise(t, E_ORB_SY),
        bodyHopY: piecewise(t, E_BODY_Y),
        bodyLeanX: 0,
        armRadial: piecewise(t, E_ARM_RAD),
        legLRad: 1,
        legRRad: 1,
        glow: piecewise(t, E_GLOW)
      };
    }
    var th = t - ENTRANCE_END;
    var swing = LEG_AMP * Math.cos(2 * Math.PI * th / LEG_PERIOD);
    var phase = swing / LEG_AMP;
    var bp = 2 * Math.PI * BREATH_FREQ_P * th;
    return {
      armLAngle: HOLD_ARM_L,
      armRAngle: HOLD_ARM_R,
      legLAngle: swing,
      legRAngle: swing,
      orbScaleX: 1,
      orbScaleY: 1 + BREATH_AMP * Math.sin(bp),
      bodyHopY: HOLD_BODY_Y,
      bodyLeanX: -LEAN_AMP * phase,
      armRadial: HOLD_ARM_RADIAL,
      legLRad: 1 + FORESHORTEN_AMP * phase,
      legRRad: 1 - FORESHORTEN_AMP * phase,
      glow: HOLD_GLOW + GLOW_PULSE_AMP * Math.sin(bp)
    };
  }
  function limb(ctx, sc, ax, ay, dx, dy, bowSign, angle, strokeWOverride, nubROverride) {
    var len = Math.sqrt(dx * dx + dy * dy);
    var strokeW = strokeWOverride || LIMB_STROKE;
    var nubR = nubROverride || NUB_R;
    ctx.save();
    ctx.translate(ax * sc, ay * sc);
    ctx.rotate(angle);
    if (len > 1e-3) {
      var px = -dy / len, py = dx / len, bow = len * 0.12 * bowSign;
      var c1x = (dx * 0.33 + px * bow) * sc, c1y = (dy * 0.33 + py * bow) * sc;
      var c2x = (dx * 0.66 + px * bow) * sc, c2y = (dy * 0.66 + py * bow) * sc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, dx * sc, dy * sc);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = strokeW * sc;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(dx * sc, dy * sc, nubR * sc, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
    ctx.restore();
  }
  function rgba(r, g, b, a) {
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function drawBook(ctx, S, op, pageTurn) {
    if (op <= 1e-3) return;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.lineJoin = "round";
    var Cx = 100, spineTopY = 131, spineBotY = 150, Lx = 71, Rx = 129, outTopY = 114, outBotY = 143;
    var cover = function(ox, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(Cx * S, spineTopY * S);
      ctx.quadraticCurveTo(lerp(Cx, ox, 0.5) * S, (spineTopY - 3) * S, ox * S, outTopY * S);
      ctx.lineTo(ox * S, outBotY * S);
      ctx.quadraticCurveTo(lerp(Cx, ox, 0.5) * S, (spineBotY + 2) * S, Cx * S, spineBotY * S);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,210,0.30)";
      ctx.lineWidth = 1 * S;
      ctx.beginPath();
      ctx.moveTo(lerp(Cx, ox, 0.24) * S, (lerp(spineTopY, outTopY, 0.24) + 1) * S);
      ctx.quadraticCurveTo(lerp(Cx, ox, 0.6) * S, (lerp(spineTopY, outTopY, 0.6) - 1) * S, lerp(Cx, ox, 0.84) * S, (lerp(spineTopY, outTopY, 0.84) + 1) * S);
      ctx.lineTo(lerp(Cx, ox, 0.84) * S, (lerp(spineBotY, outBotY, 0.84) - 2) * S);
      ctx.lineTo(lerp(Cx, ox, 0.24) * S, (lerp(spineBotY, outBotY, 0.24) - 2) * S);
      ctx.closePath();
      ctx.stroke();
    };
    cover(Lx, "#9C5526");
    cover(Rx, "#B5642A");
    ctx.fillStyle = "#F1E7CF";
    ctx.beginPath();
    ctx.moveTo(Lx * S, outTopY * S);
    ctx.quadraticCurveTo(lerp(Cx, Lx, 0.5) * S, (spineTopY - 3) * S, Cx * S, spineTopY * S);
    ctx.quadraticCurveTo(lerp(Cx, Rx, 0.5) * S, (spineTopY - 3) * S, Rx * S, outTopY * S);
    ctx.lineTo((Rx - 2.5) * S, (outTopY + 5.5) * S);
    ctx.quadraticCurveTo(lerp(Cx, Rx, 0.5) * S, (spineTopY + 2.5) * S, Cx * S, (spineTopY + 5.5) * S);
    ctx.quadraticCurveTo(lerp(Cx, Lx, 0.5) * S, (spineTopY + 2.5) * S, (Lx + 2.5) * S, (outTopY + 5.5) * S);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(150,135,115,0.4)";
    ctx.lineWidth = 0.7 * S;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo((Lx + 6) * S, (outTopY + 3) * S);
    ctx.quadraticCurveTo(Cx * S, (spineTopY + 1.5) * S, (Rx - 6) * S, (outTopY + 3) * S);
    ctx.stroke();
    ctx.strokeStyle = "rgba(60,40,28,0.6)";
    ctx.lineWidth = 1.8 * S;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(Cx * S, spineTopY * S);
    ctx.lineTo(Cx * S, spineBotY * S);
    ctx.stroke();
    if (pageTurn > 1e-3) {
      var lift = Math.sin(pageTurn * Math.PI);
      var sway = (pageTurn - 0.5) * 2;
      var baseX = Cx + sway * 3;
      ctx.fillStyle = "#FBF3DF";
      ctx.beginPath();
      ctx.moveTo(baseX * S, spineTopY * S);
      ctx.quadraticCurveTo((baseX + sway * 16) * S, (spineTopY - 16 - 18 * lift) * S, (baseX + sway * 26) * S, (outTopY - 4 - 12 * lift) * S);
      ctx.lineTo((baseX + sway * 22) * S, (outTopY + 3 - 4 * lift) * S);
      ctx.quadraticCurveTo((baseX + sway * 13) * S, (spineTopY - 5 - 4 * lift) * S, baseX * S, (spineTopY + 2) * S);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(150,135,115,0.35)";
      ctx.lineWidth = 0.7 * S;
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawNub(ctx, nx, ny, nr) {
    var g = ctx.createRadialGradient(nx - nr * 0.35, ny - nr * 0.35, 0, nx, ny, nr);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.4, "#B8EEEE");
    g.addColorStop(1, "#6FCBCB");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nx, ny, nr, 0, Math.PI * 2);
    ctx.fill();
  }
  var FLOSS_BEAT = 0.62, FLOSS_OUT = 7, FLOSS_AMP_CROSS = 84, FLOSS_AMP_OUTER = 38, FLOSS_HAND_Y = 150;
  function computeFloss(tSec) {
    var loopT = tSec / FLOSS_BEAT;
    var beat = (Math.floor(loopT) % 4 + 4) % 4;
    var p = loopT - Math.floor(loopT);
    var swing = Math.sin(p * Math.PI);
    var side = beat === 0 || beat === 2 ? 1 : -1;
    var crossingIsLeft = side === 1;
    var lAmp = crossingIsLeft ? FLOSS_AMP_CROSS : FLOSS_AMP_OUTER;
    var rAmp = crossingIsLeft ? FLOSS_AMP_OUTER : FLOSS_AMP_CROSS;
    return {
      side,
      swing,
      crossingIsLeft,
      crossingFront: beat >= 2,
      lHandDx: side * swing * lAmp,
      rHandDx: side * swing * rAmp
    };
  }
  function draw(ctx, size, tSec) {
    var sc = size / REF;
    var cx = ORB_CX * sc, cy = ORB_CY * sc, orbR = ORB_R * sc;
    var pose = ctx.canvas.getAttribute("data-pose") || ctx.__pose || "";
    var f = computePerched(tSec);
    if (ctx.__renderedPose === void 0) {
      ctx.__renderedPose = pose;
      ctx.__poseFrom = pose;
      ctx.__poseTo = pose;
      ctx.__poseT0 = tSec - 100;
    }
    if (pose !== ctx.__renderedPose) {
      ctx.__poseFrom = ctx.__renderedPose;
      ctx.__poseTo = pose;
      ctx.__poseT0 = tSec;
      ctx.__renderedPose = pose;
    }
    var poseFrom = ctx.__poseFrom, poseTo = ctx.__poseTo;
    var isClickPose = function(p) {
      return !!p && p.indexOf("click-") === 0;
    };
    var POSE_DUR = poseTo === "curating-reach" || poseFrom === "curating-reach" ? 0.3 : poseTo === "writing-done" || poseFrom === "writing-done" ? 0.34 : poseTo === "track-drive" || poseFrom === "track-drive" ? 0.3 : isClickPose(poseTo) || isClickPose(poseFrom) ? 0.22 : 0.62;
    var pmix = easeInOutCubic(clamp01((tSec - ctx.__poseT0) / POSE_DUR));
    function poseIsStill(p) {
      return p === "celebrate" || p === "sad" || p === "wave" || p === "dance" || p === "writing" || p === "writing-done" || isClickPose(p) || p === "click-done" || p === "track-drive";
    }
    var sadMix = lerp(poseFrom === "sad" ? 1 : 0, poseTo === "sad" ? 1 : 0, pmix);
    if (poseTo === "celebrate") {
      f.bodyHopY = 8 - 6 * Math.abs(Math.sin(tSec * 3));
    }
    var legScale = lerp(poseIsStill(poseFrom) ? 0 : 1, poseIsStill(poseTo) ? 0 : 1, pmix);
    f.legLAngle *= legScale;
    f.legRAngle *= legScale;
    f.bodyLeanX *= legScale;
    f.legLRad = 1 + (f.legLRad - 1) * legScale;
    f.legRRad = 1 + (f.legRRad - 1) * legScale;
    var isDance = poseTo === "dance";
    var fl = isDance ? computeFloss(tSec) : null;
    var danceOffsetX = 0;
    if (isDance) {
      var dBreath = Math.sin(tSec / 2.6 * Math.PI * 2);
      f.bodyHopY = -1 + dBreath * 1.5;
      f.bodyLeanX = -fl.side * fl.swing * 0.06;
      f.orbScaleX = 1 - dBreath * 0.012;
      f.orbScaleY = 1 + dBreath * 0.018;
      f.glow = 0.42 + dBreath * 0.08;
      danceOffsetX = -fl.side * fl.swing * 12;
    }
    var coral = clamp01(REST_CORAL + Math.sin(tSec * BREATH_FREQ) * CORAL_BREATH_AMP);
    var coreR = orbR * lerp(0.6, 0.96, coral);
    var coreA = lerp(0.62, 1, coral);
    var glow = clamp01(f.glow);
    var thinkMix = lerp(poseFrom === "thinking" ? 1 : 0, poseTo === "thinking" ? 1 : 0, pmix);
    if (thinkMix > 0) glow = clamp01(glow + thinkMix * 0.15);
    var reachMix = lerp(poseFrom === "curating-reach" ? 1 : 0, poseTo === "curating-reach" ? 1 : 0, pmix);
    if (reachMix > 0) {
      var reachE2 = Math.max(0, tSec - ctx.__poseT0 - 0.22);
      glow = clamp01(glow + reachMix * (0.1 + 0.1 * Math.exp(-reachE2 * 4)));
    }
    var writeDoneMix = lerp(poseFrom === "writing-done" ? 1 : 0, poseTo === "writing-done" ? 1 : 0, pmix);
    if (writeDoneMix > 0) {
      var wdE = clamp01((tSec - ctx.__poseT0) / 0.4);
      glow = clamp01(glow + writeDoneMix * 0.06 * easeOutCubic(wdE));
    }
    var celebrateMix = lerp(poseFrom === "celebrate" ? 1 : 0, poseTo === "celebrate" ? 1 : 0, pmix);
    var blink = 0;
    var bphase = tSec % PERCHED_BLINK_PERIOD;
    if (bphase < AUTO_BLINK_WINDOW_S) {
      var bt = bphase / AUTO_BLINK_WINDOW_S;
      blink = bt < 0.5 ? bt * 2 : 2 - bt * 2;
    }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    var dpr = ctx.__dpr || 1;
    ctx.scale(dpr, dpr);
    ctx.translate(danceOffsetX * sc, f.bodyHopY * sc);
    ctx.translate(cx, cy);
    ctx.rotate(f.bodyLeanX);
    ctx.translate(-cx, -cy);
    ctx.save();
    ctx.globalAlpha = glow;
    var halo = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, HALO_R * sc);
    halo.addColorStop(0, rgba(158, 229, 229, 0.45));
    halo.addColorStop(0.55, rgba(158, 229, 229, 0.18));
    halo.addColorStop(1, rgba(158, 229, 229, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, HALO_R * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    function armFor(p) {
      if (p === "celebrate" || p === "slide") return [-18, -34, 18, -34, 0, 0];
      if (p === "sad") return [-8, 34, 8, 34, 0, 0];
      if (p === "wave") {
        var wv = Math.sin(tSec * 2 * Math.PI * 1.7);
        return [-14, 28, 19, -27, 0.12, -0.1 + 0.28 * wv];
      }
      if (p === "dance") {
        var fd = computeFloss(tSec);
        return [fd.lHandDx - FLOSS_OUT, FLOSS_HAND_Y - ARM_L_AY, fd.rHandDx + FLOSS_OUT, FLOSS_HAND_Y - ARM_R_AY, 0, 0];
      }
      if (p === "thinking") return [ARM_L_DX * f.armRadial, ARM_L_DY * f.armRadial, -2, -40, f.armLAngle, 0];
      if (p === "curating-reach") {
        var live = p === ctx.__poseTo;
        var e = tSec - ctx.__poseT0;
        var e2 = live ? Math.max(0, e - 0.22) : 0;
        var ring = 0.07 * Math.exp(-e2 * 5) * Math.sin(e2 * 16);
        var s = 1 + ring + 0.014 * Math.sin(tSec * 1.15);
        return [-30 * s, 34 * s, 14, 18, 0, 0];
      }
      if (p === "writing") {
        var we = tSec - ctx.__poseT0;
        var w = clamp01((we - 0.12) / 0.9);
        var env = Math.sin(w * Math.PI);
        var k = w * 2 * Math.PI * 6;
        return [
          24 + 22 * w + 1.2 * env * Math.cos(k),
          46 + 4 * clamp01(w / 0.06) - 3 * env + 2.6 * env * Math.sin(k),
          -14 + 1.5 * w,
          44,
          0,
          0
        ];
      }
      if (p === "writing-done") return [20, 46, -12, 42, 0, 0];
      if (isClickPose(p)) {
        var clickIdx = parseInt(p.slice(6), 10) || 0;
        var clickTarget = CLICK_ARM_TARGETS[clickIdx] || CLICK_ARM_TARGETS[0];
        var clickLive = p === ctx.__poseTo;
        var clickE = tSec - ctx.__poseT0;
        var clickE2 = clickLive ? Math.max(0, clickE - 0.14) : 0;
        var clickRing = 0.08 * Math.exp(-clickE2 * 6) * Math.sin(clickE2 * 18);
        var clickS = 1 + clickRing;
        var activeDx = clickTarget.dx * clickS, activeDy = clickTarget.dy * clickS;
        if (clickTarget.hand === "R") return [-14, 20, activeDx, activeDy, 0, 0];
        return [activeDx, activeDy, 14, 20, 0, 0];
      }
      if (p === "click-done") return [16, 34, -14, 30, 0, 0];
      if (ctx.__book) return [17, 39, -17, 39, 0, 0];
      return [ARM_L_DX * f.armRadial, ARM_L_DY * f.armRadial, ARM_R_DX * f.armRadial, ARM_R_DY * f.armRadial, f.armLAngle, f.armRAngle];
    }
    var aF = armFor(poseFrom), aT = armFor(poseTo);
    var armDxL = lerp(aF[0], aT[0], pmix), armDyL = lerp(aF[1], aT[1], pmix);
    var armDxR = lerp(aF[2], aT[2], pmix), armDyR = lerp(aF[3], aT[3], pmix);
    var armLAng = lerp(aF[4], aT[4], pmix), armRAng = lerp(aF[5], aT[5], pmix);
    var legEpL = isDance ? [-11, 30] : LEG_EP_L, legEpR = isDance ? [11, 30] : LEG_EP_R;
    var legDxL = legEpL[0] * f.legLRad, legDyL = legEpL[1] * f.legLRad;
    var legDxR = legEpR[0] * f.legRRad, legDyR = legEpR[1] * f.legRRad;
    var legAngL = f.legLAngle, legAngR = f.legRAngle;
    function legFor(p) {
      if (p === "track-drive") {
        var STRIDE = 0.46, ph = Math.sin(2 * Math.PI * tSec / STRIDE), amp = 8;
        return { dxL: -16 + amp * ph, dyL: 26, dxR: 16 - amp * ph, dyR: 26, angL: 0, angR: 0 };
      }
      if (isClickPose(p) || p === "click-done") {
        return { dxL: -16, dyL: 26, dxR: 16, dyR: 26, angL: 0, angR: 0 };
      }
      return null;
    }
    var legFrom = legFor(poseFrom), legTo = legFor(poseTo);
    if (legFrom || legTo) {
      var legBaseFrom = legFrom || { dxL: legDxL, dyL: legDyL, dxR: legDxR, dyR: legDyR, angL: legAngL, angR: legAngR };
      var legBaseTo = legTo || { dxL: legDxL, dyL: legDyL, dxR: legDxR, dyR: legDyR, angL: legAngL, angR: legAngR };
      legDxL = lerp(legBaseFrom.dxL, legBaseTo.dxL, pmix);
      legDyL = lerp(legBaseFrom.dyL, legBaseTo.dyL, pmix);
      legDxR = lerp(legBaseFrom.dxR, legBaseTo.dxR, pmix);
      legDyR = lerp(legBaseFrom.dyR, legBaseTo.dyR, pmix);
      legAngL = lerp(legBaseFrom.angL, legBaseTo.angL, pmix);
      legAngR = lerp(legBaseFrom.angR, legBaseTo.angR, pmix);
    }
    var clickMixL = 0, clickMixR = 0;
    if (isClickPose(poseFrom) || isClickPose(poseTo)) {
      var fromHand = isClickPose(poseFrom) ? (CLICK_ARM_TARGETS[parseInt(poseFrom.slice(6), 10) || 0] || CLICK_ARM_TARGETS[0]).hand : null;
      var toHand = isClickPose(poseTo) ? (CLICK_ARM_TARGETS[parseInt(poseTo.slice(6), 10) || 0] || CLICK_ARM_TARGETS[0]).hand : null;
      clickMixL = lerp(fromHand === "L" ? 1 : 0, toHand === "L" ? 1 : 0, pmix);
      clickMixR = lerp(fromHand === "R" ? 1 : 0, toHand === "R" ? 1 : 0, pmix);
    }
    limb(ctx, sc, ARM_L_AX, ARM_L_AY, armDxL, armDyL, 1, armLAng, LIMB_STROKE + clickMixL * 1.6, NUB_R + clickMixL * 2.2);
    limb(ctx, sc, ARM_R_AX, ARM_R_AY, armDxR, armDyR, -1, armRAng, LIMB_STROKE + clickMixR * 1.6, NUB_R + clickMixR * 2.2);
    limb(ctx, sc, LEG_L_AX, LEG_L_AY, legDxL, legDyL, 1, legAngL);
    limb(ctx, sc, LEG_R_AX, LEG_R_AY, legDxR, legDyR, -1, legAngR);
    if (poseTo === "click-done") {
      var doneE = tSec - ctx.__poseT0;
      var nubFlash = 0;
      if (doneE >= 0 && doneE < 0.08) nubFlash = doneE / 0.08;
      else if (doneE >= 0.08 && doneE < 0.24) nubFlash = 1;
      else if (doneE >= 0.24 && doneE < 0.5) nubFlash = 1 - (doneE - 0.24) / 0.26;
      if (nubFlash > 1e-3) {
        var flashNubX = (ARM_L_AX + armDxL) * sc, flashNubY = (ARM_L_AY + armDyL) * sc;
        var flashScale = 1 + 0.6 * nubFlash;
        var flashR = Math.round(lerp(158, GOLD_R, nubFlash));
        var flashG = Math.round(lerp(229, GOLD_G, nubFlash));
        var flashB = Math.round(lerp(229, GOLD_B, nubFlash));
        var flashGrad = ctx.createRadialGradient(
          flashNubX - NUB_R * sc * 0.3,
          flashNubY - NUB_R * sc * 0.3,
          0,
          flashNubX,
          flashNubY,
          NUB_R * sc * flashScale
        );
        flashGrad.addColorStop(0, rgba(255, 255, 255, 0.9 * nubFlash + 0.1));
        flashGrad.addColorStop(0.45, rgba(flashR, flashG, flashB, 1));
        flashGrad.addColorStop(1, rgba(flashR, flashG, flashB, 0.85));
        ctx.beginPath();
        ctx.arc(flashNubX, flashNubY, NUB_R * sc * flashScale, 0, Math.PI * 2);
        ctx.fillStyle = flashGrad;
        ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(f.orbScaleX, f.orbScaleY);
    ctx.translate(-cx, -cy);
    var body = ctx.createRadialGradient(cx, cy - orbR * 0.28, 0, cx, cy - orbR * 0.28, orbR * 1.02);
    body.addColorStop(0, rgba(210, 249, 249, 1));
    body.addColorStop(0.42, rgba(150, 232, 233, 1));
    body.addColorStop(0.74, rgba(108, 208, 213, 1));
    body.addColorStop(1, rgba(84, 186, 197, 1));
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.clip();
    var core = ctx.createRadialGradient(cx, cy + orbR * 0.1, 0, cx, cy + orbR * 0.1, coreR);
    core.addColorStop(0, rgba(255, 242, 210, 1 * coreA));
    core.addColorStop(0.28, rgba(255, 186, 118, 0.92 * coreA));
    core.addColorStop(0.55, rgba(250, 140, 86, 0.6 * coreA));
    core.addColorStop(0.8, rgba(242, 124, 74, 0.26 * coreA));
    core.addColorStop(1, rgba(236, 116, 68, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.fill();
    var depth = ctx.createRadialGradient(cx, cy + orbR * 0.62, 0, cx, cy + orbR * 0.62, orbR * 0.9);
    depth.addColorStop(0, rgba(34, 120, 134, 0.4));
    depth.addColorStop(0.7, rgba(34, 120, 134, 0));
    depth.addColorStop(1, rgba(34, 120, 134, 0));
    ctx.fillStyle = depth;
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    var spec = ctx.createRadialGradient(cx - orbR * 0.3, cy - orbR * 0.4, 0, cx - orbR * 0.3, cy - orbR * 0.4, orbR * 0.42);
    spec.addColorStop(0, rgba(255, 255, 255, 0.9));
    spec.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(cx - orbR * 0.3, cy - orbR * 0.4, orbR * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.lineWidth = orbR * 0.06;
    ctx.strokeStyle = rgba(158, 229, 229, 0.7);
    ctx.beginPath();
    ctx.arc(cx, cy, orbR * 0.99, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    if (isDance && fl.crossingFront) {
      if (fl.crossingIsLeft) limb(ctx, sc, ARM_L_AX, ARM_L_AY, armDxL, armDyL, 1, armLAng);
      else limb(ctx, sc, ARM_R_AX, ARM_R_AY, armDxR, armDyR, -1, armRAng);
    }
    if (ctx.__bookRendered === void 0) {
      ctx.__bookRendered = !!ctx.__book;
      ctx.__bookAt = tSec - 1;
    }
    if (!!ctx.__book !== ctx.__bookRendered) {
      ctx.__bookRendered = !!ctx.__book;
      ctx.__bookAt = tSec;
    }
    var bookRampT = clamp01((tSec - ctx.__bookAt) / 0.35);
    var bookOp = ctx.__bookRendered ? bookRampT : 1 - bookRampT;
    if (bookOp > 1e-3) {
      var _tMs = tSec * 1e3, _lt = _tMs % 5200;
      var _pt = _lt < 3600 || _lt > 4360 ? 0 : (_lt - 3600) / 760;
      drawBook(ctx, sc, bookOp, _pt);
      drawNub(ctx, (ARM_L_AX + 17) * sc, (ARM_L_AY + 39) * sc, NUB_R * sc);
      drawNub(ctx, (ARM_R_AX - 17) * sc, (ARM_R_AY + 39) * sc, NUB_R * sc);
    }
    var writeMix = lerp(poseFrom === "writing" || poseFrom === "writing-done" ? 1 : 0, poseTo === "writing" || poseTo === "writing-done" ? 1 : 0, pmix);
    if (writeMix > 0.02) {
      var penNubX = (ARM_L_AX + armDxL) * sc, penNubY = (ARM_L_AY + armDyL) * sc;
      ctx.save();
      ctx.globalAlpha = writeMix;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#C98A3E";
      ctx.lineWidth = 3.4 * sc;
      ctx.beginPath();
      ctx.moveTo(penNubX - 6 * sc, penNubY - 13 * sc);
      ctx.lineTo(penNubX + 3 * sc, penNubY + 6 * sc);
      ctx.stroke();
      ctx.strokeStyle = "#3A322A";
      ctx.lineWidth = 3.4 * sc;
      ctx.beginPath();
      ctx.moveTo(penNubX + 0.4 * sc, penNubY + 2.1 * sc);
      ctx.lineTo(penNubX + 3 * sc, penNubY + 6 * sc);
      ctx.stroke();
      ctx.restore();
      drawNub(ctx, penNubX, penNubY, NUB_R * sc);
    }
    var delightMix = clamp01(Math.max(reachMix, writeDoneMix, celebrateMix));
    var mStartY = lerp(112.75, 114.6, sadMix), mCtrlY = lerp(116.37, 110.8, sadMix), mEndY = lerp(112.35, 114.6, sadMix);
    if (delightMix > 0) {
      mStartY = lerp(mStartY, 111.4, delightMix);
      mCtrlY = lerp(mCtrlY, 119.8, delightMix);
      mEndY = lerp(mEndY, 111, delightMix);
    }
    ctx.beginPath();
    ctx.moveTo(92.5 * sc, mStartY * sc);
    ctx.quadraticCurveTo(100 * sc, mCtrlY * sc, 107.5 * sc, mEndY * sc);
    ctx.strokeStyle = MOUTH_COLOR;
    ctx.lineWidth = 1.7 * sc;
    ctx.lineCap = "round";
    ctx.stroke();
    var baseGazeX = typeof ctx.__gazeX === "number" ? ctx.__gazeX : ctx.__book ? 0 : EYE_OFFSET_X;
    var baseGazeY = typeof ctx.__gazeY === "number" ? ctx.__gazeY : ctx.__book ? 4 : EYE_OFFSET_Y;
    var gazeX = lerp(baseGazeX, 0, sadMix);
    var gazeY = lerp(baseGazeY, 6, sadMix);
    var exL = (EYE_L_X + gazeX) * sc, exR = (EYE_R_X + gazeX) * sc;
    var ey = (EYE_Y + gazeY) * sc;
    var rx = EYE_DOT_R * sc, ry = EYE_DOT_R * sc * Math.max(0.06, 1 - blink * 0.95);
    function eye(ex) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = EYE_INK;
      ctx.fill();
      ctx.globalAlpha = clamp01(1 - blink * 1.7) * 0.9;
      ctx.beginPath();
      ctx.ellipse(ex - rx * 0.34, ey - ry * 0.4, rx * 0.4, ry * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    eye(exL);
    eye(exR);
    ctx.save();
    ctx.globalAlpha = BROW_OPACITY;
    ctx.strokeStyle = BROW_COLOR;
    ctx.lineWidth = 2.3 * sc;
    ctx.lineCap = "round";
    var lS = lerp(81.25, 82.6, sadMix), lC = lerp(80, 80.6, sadMix), lE = lerp(81.25, 79.2, sadMix);
    var rS = lerp(81.25, 79.2, sadMix), rC = lerp(80, 80.6, sadMix), rE = lerp(81.25, 82.6, sadMix);
    ctx.beginPath();
    ctx.moveTo(78.65 * sc, lS * sc);
    ctx.quadraticCurveTo(82.4 * sc, lC * sc, 86.15 * sc, lE * sc);
    ctx.moveTo(113.85 * sc, rS * sc);
    ctx.quadraticCurveTo(117.6 * sc, rC * sc, 121.35 * sc, rE * sc);
    ctx.stroke();
    ctx.restore();
    if (glassesImg && glassesImg.complete && glassesImg.naturalWidth) {
      ctx.drawImage(glassesImg, GLASSES_X * sc, GLASSES_Y * sc, GLASSES_W * sc, GLASSES_H * sc);
    }
    ctx.restore();
  }
  function mount(canvas) {
    var size = parseInt(canvas.getAttribute("data-size") || "70", 10);
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    var hPx = Math.round(size * PERCHED_CANVAS_H_MULT);
    canvas.style.width = size + "px";
    canvas.style.height = hPx + "px";
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(hPx * dpr);
    var ctx = canvas.getContext("2d");
    ctx.__dpr = dpr;
    var gxAttr = canvas.getAttribute("data-gaze-x");
    var gyAttr = canvas.getAttribute("data-gaze-y");
    if (gxAttr !== null && gxAttr !== "") ctx.__gazeX = parseFloat(gxAttr);
    if (gyAttr !== null && gyAttr !== "") ctx.__gazeY = parseFloat(gyAttr);
    if (canvas.getAttribute("data-book") !== null) ctx.__book = true;
    var poseAttr = canvas.getAttribute("data-pose");
    if (poseAttr) ctx.__pose = poseAttr;
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      draw(ctx, size, (ts - start) / 1e3);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function init() {
    var nodes = document.querySelectorAll("[data-echo-perched]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
