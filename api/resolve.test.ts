import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  resolveDestination,
  logRejectedDestination,
  type RejectionReason,
} from "./resolve.ts";

// `/r/:slug` is the single unauthenticated public entry point for every gateway
// click — every email CTA, every QR scan, every paid link — and it had zero
// automated coverage of any kind. Its defining behaviour is that it FAILS OPEN:
// a destination it refuses still 302s to the homepage, so a misconfigured row
// silently sends every recipient of a live campaign to getreps.io with nothing
// anywhere to say so.
//
// A curl chain cannot substitute for these two blocks. The gateway curl never
// loads login.html, so it cannot see renderer/hop-page slug drift; and exercising
// `host_not_allowed` through curl would mean pointing a PRODUCTION links row at a
// disallowed host, which is strictly worse than an assertion.

const HOME = "https://getreps.io";

describe("resolveDestination", () => {
  test("delivers a valid platform destination untouched", () => {
    const result = resolveDestination(
      { ios: "https://repsapp.onelink.me/abcd?pid=web_funnel", fallback: HOME },
      "ios",
    );
    assert.equal(result.rejection, null);
    assert.equal(result.destination, "https://repsapp.onelink.me/abcd?pid=web_funnel");
  });

  test("falls back to the fallback destination when the platform key is absent", () => {
    const result = resolveDestination({ fallback: "https://www.getreps.io/android" }, "android");
    assert.equal(result.rejection, null);
    assert.equal(result.destination, "https://www.getreps.io/android");
  });

  // ── The four rejection reasons. Each implies a DIFFERENT fix, which is the
  // whole point of the enum: "it went home" is not an actionable log line.
  test("destination_missing — the row carries no destination object at all", () => {
    for (const empty of [null, undefined, "not-an-object", 42]) {
      const result = resolveDestination(empty, "ios");
      assert.equal(result.rejection, "destination_missing");
      assert.equal(result.destination, HOME);
    }
  });

  test("destination_missing — the object has neither a platform key nor a fallback", () => {
    const result = resolveDestination({ android: "   " }, "ios");
    assert.equal(result.rejection, "destination_missing");
    assert.equal(result.destination, HOME);
  });

  test("invalid_url — a relative destination throws in new URL() and must not pass", () => {
    // This is the real-world shape: writing "/android" instead of the absolute
    // URL. It reads perfectly in a migration and silently sends everyone home.
    const result = resolveDestination({ ios: "/android" }, "ios");
    assert.equal(result.rejection, "invalid_url");
    assert.equal(result.destination, HOME);
  });

  test("non_https — an http:// destination is refused even on an allowed host", () => {
    const result = resolveDestination({ ios: "http://getreps.io/android" }, "ios");
    assert.equal(result.rejection, "non_https");
    assert.equal(result.destination, HOME);
  });

  test("host_not_allowed — an https destination on an unlisted host is refused", () => {
    const result = resolveDestination({ ios: "https://example.com/install" }, "ios");
    assert.equal(result.rejection, "host_not_allowed");
    assert.equal(result.destination, HOME);
  });

  test("every rejection still DELIVERS home — the gateway never errors", () => {
    const cases: unknown[] = [null, { ios: "/rel" }, { ios: "http://getreps.io" }, { ios: "https://evil.test" }];
    for (const destination of cases) {
      assert.equal(resolveDestination(destination, "ios").destination, HOME);
    }
  });
});

describe("logRejectedDestination", () => {
  test("logs exactly the reason, the platform enum and the delivery outcome", () => {
    const reasons: RejectionReason[] = [
      "destination_missing",
      "invalid_url",
      "non_https",
      "host_not_allowed",
    ];
    const original = console.error;
    const lines: string[] = [];
    console.error = (line: string) => void lines.push(line);
    try {
      for (const reason of reasons) logRejectedDestination(reason, "ios");
    } finally {
      console.error = original;
    }

    assert.equal(lines.length, reasons.length);
    lines.forEach((line, index) => {
      const parsed = JSON.parse(line);
      assert.deepEqual(parsed, {
        event: "resolve_destination_rejected",
        reason: reasons[index],
        platform: "ios",
        delivered: "home",
      });
      // The safety property, asserted as a property and not as a habit: no key
      // beyond these four may ever appear, because every other thing in scope at
      // the call site is a routing input (slug, destination, `?u=` identifier).
      assert.deepEqual(Object.keys(parsed).sort(), [
        "delivered",
        "event",
        "platform",
        "reason",
      ]);
    });
  });
});

// ── login.html source contract ────────────────────────────────────────────────
// The hop page is static HTML with no module boundary, so its App Store CTAs can
// only be checked as source. This is the guard the gateway curl structurally
// cannot be: the curl chain verifies `/r/:slug` and never loads this file, so
// renderer↔hop-page slug drift — the top silent-bug trigger for this whole change
// — would otherwise have no executable check anywhere.
describe("login.html gateway wiring", () => {
  const loginHtml = readFileSync(
    fileURLToPath(new URL("../login.html", import.meta.url)),
    "utf8",
  );

  test("the static no-JS href points at the recovery gateway slug", () => {
    // EASY MISS: the JS at the bottom of the page overwrites this href on every
    // JS-enabled load, so it looks correct in any browser test and diverges only
    // for no-JS, prefetch and email-scanner clients.
    assert.match(
      loginHtml,
      /<a id="store-link" href="https:\/\/www\.getreps\.io\/r\/web-recovery"/,
      "the static store-link href must be the recovery gateway slug",
    );
  });

  test("both dynamic slug branches are present and distinct", () => {
    assert.ok(
      loginHtml.includes('"https://www.getreps.io/r/web-welcome"'),
      "the isNew (welcome) branch must route through /r/web-welcome",
    );
    assert.ok(
      loginHtml.includes('"https://www.getreps.io/r/web-recovery"'),
      "the returning (recovery) branch must route through /r/web-recovery",
    );
  });

  test("no bare apps.apple.com URL survives anywhere in the page", () => {
    // A bare store URL here is un-attributable by construction: it bypasses the
    // gateway, so the click is never recorded in link_scans.
    assert.ok(
      !loginHtml.includes("apps.apple.com"),
      "every App Store CTA must route through the /r/ gateway, not a bare store URL",
    );
  });
});
