import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// play/quotle.html is static HTML with an inline script and no module
// boundary, so — same approach as the login.html gateway-wiring test in
// api/resolve.test.ts — its contract can only be checked as source text.
//
// This guards the one thing the "Verbatim on the web" brief actually asked
// for: a visitor can play immediately with no install and no gate, and the
// "get the app" offer never blocks or redirects them out of the game. The
// game itself was later renamed Verbatim → Quotle on the website; this file
// and its assertions were updated for the new file/route/text, unchanged in
// what they guard.

const HTML_PATH = fileURLToPath(new URL("../play/quotle.html", import.meta.url));

function readHtml(): string {
  return readFileSync(HTML_PATH, "utf8");
}

describe("play/quotle.html — play online without the app", () => {
  test("the game view is the one shown on load, not gated behind another view", () => {
    const html = readHtml();
    assert.match(
      html,
      /<div class="uq-view active" data-view="game">/,
      "the game view must carry the active class in the static markup — a visitor's first paint is the game, not a waitlist or install screen",
    );
  });

  test("the boot script shows the game and opens the tutorial unconditionally", () => {
    const html = readHtml();
    const scriptStart = html.indexOf("(function() {");
    assert.ok(scriptStart !== -1, "expected the game's IIFE to be present");
    const script = html.slice(scriptStart);
    // These three calls run in this order with nothing gating them - no
    // "has the app", "is on iOS", or install-check branch in front of play.
    assert.match(script, /renderRoundUI\(\);\s*\n\s*showView\("game"\);\s*\n\s*fitGameScreen\(\);/);
    assert.match(script, /openIntro\(\);\s*\n\s*\}\)\(\);/, "openIntro (the how-to-play overlay) must be the last call before the IIFE closes, unconditional");
  });

  test("nothing on the page redirects, refreshes, or bounces the visitor to an app store", () => {
    const html = readHtml();
    assert.ok(!/http-equiv=["']refresh["']/i.test(html), "no meta-refresh redirect");
    assert.ok(!/window\.location\.(href|replace)\s*=/.test(html), "no forced navigation away from the game");
    assert.ok(!/document\.location\s*=/.test(html), "no forced navigation away from the game");
    assert.ok(!/\breps:\/\//.test(html), "no custom-scheme deep link attempt (the app hand-off is explicitly out of scope and would hang on platforms without the scheme registered)");
    assert.ok(!/\bintent:\/\//.test(html), "no Android intent:// deep link attempt");
  });
});

describe("play/quotle.html — the app offer is present and non-blocking", () => {
  test("every app-offer link points at the real App Store listing and opens in a new tab", () => {
    const html = readHtml();
    const linkPattern = /<a class="uq-app-(?:link|cta)"[^>]*href="([^"]+)"[^>]*target="([^"]*)"[^>]*rel="([^"]*)"/g;
    const matches = [...html.matchAll(linkPattern)];
    assert.ok(matches.length >= 4, `expected at least 4 app-offer links (header pill x3 reachable views + win/loss CTA x2), found ${matches.length}`);
    for (const [, href, target, rel] of matches) {
      assert.equal(href, "https://apps.apple.com/app/id6759216018");
      assert.equal(target, "_blank", "must open in a new tab so the live game underneath is never navigated away from");
      assert.match(rel, /\bnoopener\b/, "must not hand the opened tab a window.opener reference back into the game");
    }
  });

  test("the app-offer elements are plain links, not a full-screen or pointer-blocking overlay", () => {
    const html = readHtml();
    // A real trap would be a scrim/overlay class wrapping the offer, or a
    // disabled/pointer-events:none rule on the rest of the page while it
    // shows. Assert the offer classes carry none of that shape.
    const appLinkCss = /\.uq-app-link\s*\{([^}]*)\}/.exec(html)?.[1] ?? "";
    const appCtaCss = /\.uq-app-cta\s*\{([^}]*)\}/.exec(html)?.[1] ?? "";
    assert.ok(appLinkCss.length > 0 && appCtaCss.length > 0, "expected both app-offer CSS rules to exist");
    for (const rule of [appLinkCss, appCtaCss]) {
      assert.ok(!/position:\s*fixed/.test(rule), "app offer must not be a fixed overlay");
      assert.ok(!/z-index/.test(rule), "app offer must not be layered above game UI like a scrim");
    }
    // The offer markup must not be nested inside the pre-play tutorial overlay
    // or the share-sheet scrim — both of which DO legitimately use overlay
    // positioning elsewhere on this page for unrelated (in-scope) features.
    const introOverlayMatch = /<div class="uq-intro-overlay"[\s\S]*?<canvas id="uq-confetti-canvas"/.exec(html);
    assert.ok(introOverlayMatch, "expected to find the intro-overlay block to scope the check against");
    assert.ok(
      !introOverlayMatch[0].includes("uq-app-link") && !introOverlayMatch[0].includes("uq-app-cta"),
      "the app offer must live outside the blocking pre-play tutorial overlay",
    );
  });

  test("the header app-link sits in the header's reserved side slot, not the tutorial gate", () => {
    const html = readHtml();
    const headerSlotPattern = /<div class="uq-header__side uq-header__side--right"><a class="uq-app-link"/g;
    const count = (html.match(headerSlotPattern) || []).length;
    assert.equal(count, 4, "expected the header pill in all four header-bearing views (game, win, loss, set-detail)");
  });
});
