import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { toQuotleRoundPayload, utcToday } from "./quotle-round.ts";

// /api/quotle-round is what turned play/quotle.html from a frozen demo into the
// daily game. Two properties are worth asserting rather than eyeballing:
//
//   1. It NARROWS. The RPC hands back a reviewer's private evidence note
//      (`verified`) alongside the player-facing content, and the route's job is to
//      publish one and not the other. That is a property of the code, invisible in
//      any screenshot, and it silently breaks the day someone "simplifies" the
//      builder into a pass-through.
//   2. It FAILS TO THE FALLBACK, not to a broken page. Every malformed payload
//      below produces a stale-but-true quote rather than an empty board — and the
//      page can only do that if this function says null instead of half a round.

/** A well-formed `get_verbatim_round` payload, exactly as the SQL builds it. */
function servedRound(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    available: true,
    tier: "published",
    is_rerun: false,
    round_id: "3f2a1c44-0000-4000-8000-000000000001",
    round_date: "2026-09-07",
    effective_date: "2026-09-07",
    theme: "persistence",
    set_id: null,
    quote: {
      id: "3f2a1c44-0000-4000-8000-000000000001",
      text: "I paint from the top down",
      author: "Grandma Moses",
      verified: "Checked against the 1952 autobiography, p. 140.",
      on_this_day: { month: 9, day: 7, year: 1860 },
      context: "She picked up a brush in her seventies.",
      question: "What have you decided you are too late to start?",
      read_more: {
        title: "Grandma Moses Starts Painting at 78",
        url: "https://www.example.org/grandma-moses",
        host: "example.org",
      },
    },
    ...overrides,
  };
}

function quoteWith(patch: Record<string, unknown>): Record<string, unknown> {
  const round = servedRound();
  round.quote = { ...(round.quote as Record<string, unknown>), ...patch };
  return round;
}

describe("utcToday", () => {
  test("formats the UTC calendar day, zero-padded", () => {
    assert.equal(utcToday(new Date("2026-09-07T16:30:00Z")), "2026-09-07");
    assert.equal(utcToday(new Date("2026-01-03T00:00:00Z")), "2026-01-03");
  });

  // The whole reason the route picks the date instead of the browser: one shared
  // day for every visitor, and no client that can walk the date forward.
  test("reads UTC, not the machine's local day", () => {
    // 23:30 UTC on the 7th is already the 8th in UTC+13 and still the 7th in UTC.
    assert.equal(utcToday(new Date("2026-09-07T23:30:00Z")), "2026-09-07");
    // 00:30 UTC on the 8th is still the 7th in UTC-5.
    assert.equal(utcToday(new Date("2026-09-08T00:30:00Z")), "2026-09-08");
  });
});

describe("toQuotleRoundPayload — what reaches the page", () => {
  test("passes a well-formed round through with every rendered field intact", () => {
    const payload = toQuotleRoundPayload(servedRound());
    assert.ok(payload);
    assert.equal(payload.available, true);
    assert.equal(payload.tier, "published");
    assert.equal(payload.is_rerun, false);
    assert.equal(payload.effective_date, "2026-09-07");
    assert.equal(payload.quote.text, "I paint from the top down");
    assert.equal(payload.quote.author, "Grandma Moses");
    assert.equal(payload.quote.context, "She picked up a brush in her seventies.");
    assert.equal(payload.quote.question, "What have you decided you are too late to start?");
    assert.deepEqual(payload.quote.on_this_day, { month: 9, day: 7, year: 1860 });
    assert.deepEqual(payload.quote.read_more, {
      title: "Grandma Moses Starts Painting at 78",
      url: "https://www.example.org/grandma-moses",
      host: "example.org",
    });
  });

  // THE ONE THAT MATTERS. `verified_note` is a reviewer's evidence that an
  // attribution is real — internal by design, and reps-app's own type says "never
  // rendered". A pass-through would publish it on a page with no login.
  test("does NOT carry the private verification note, or any field the page cannot use", () => {
    const payload = toQuotleRoundPayload(servedRound());
    assert.ok(payload);
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes("verified"), "verification note must not leave the server");
    assert.ok(!serialized.includes("1952 autobiography"));
    assert.ok(!serialized.includes("round_id"));
    assert.ok(!serialized.includes("set_id"));
    assert.ok(!serialized.includes("theme"));
    assert.deepEqual(Object.keys(payload.quote).sort(), [
      "author",
      "context",
      "on_this_day",
      "question",
      "read_more",
      "text",
    ]);
  });

  test("a reserve carries no anniversary, and that is normal rather than a defect", () => {
    const payload = toQuotleRoundPayload(
      quoteWith({ on_this_day: null }),
    );
    assert.ok(payload);
    assert.equal(payload.quote.on_this_day, null);
  });

  test("a rerun is served, flagged as one", () => {
    const payload = toQuotleRoundPayload(servedRound({ tier: "rerun", is_rerun: true }));
    assert.ok(payload);
    assert.equal(payload.tier, "rerun");
    assert.equal(payload.is_rerun, true);
  });
});

describe("toQuotleRoundPayload — everything that must fall back instead", () => {
  // Each of these reaches the page as the same thing (a stale quote), and each
  // means something different upstream. They are enumerated so that a change to
  // the SQL's jsonb_build_object cannot quietly produce half a round.
  const rejected: Array<[string, unknown]> = [
    ["no payload at all", null],
    ["a string where an object belongs", "no round today"],
    ["the bank's explicit nothing", { available: false, effective_date: "2026-09-07", tier: "none" }],
    ["a tier outside the enum", servedRound({ tier: "bundled" })],
    ["is_rerun missing — the game would present an archive round as today's news", servedRound({ is_rerun: undefined })],
    ["no effective_date", servedRound({ effective_date: null })],
    ["no quote object", servedRound({ quote: null })],
    ["empty quote text", quoteWith({ text: "   " })],
    ["a quote that builds zero tiles", quoteWith({ text: "1882 — 1,000!" })],
    ["a quote longer than the column allows", quoteWith({ text: "a".repeat(401) })],
    ["no author", quoteWith({ author: "" })],
    ["no Echo take", quoteWith({ context: null })],
    ["no question", quoteWith({ question: undefined })],
    ["no read_more block", quoteWith({ read_more: null })],
    ["a read_more with no url", quoteWith({ read_more: { title: "T", url: "", host: "h" } })],
    // The page writes this straight into an href on a public page.
    ["a non-https read_more url", quoteWith({ read_more: { title: "T", url: "http://x.example", host: "x" } })],
    ["a javascript: read_more url", quoteWith({ read_more: { title: "T", url: "javascript:alert(1)", host: "x" } })],
  ];

  for (const [label, input] of rejected) {
    test(label, () => {
      assert.equal(toQuotleRoundPayload(input), null);
    });
  }

  // A malformed anniversary is not a reason to refuse a perfectly playable quote —
  // it is a reason not to render a date that is half a date.
  test("a half-present or impossible anniversary is dropped, the round still serves", () => {
    for (const anniversary of [
      { month: 9 },
      { day: 7 },
      { month: 13, day: 7, year: null },
      { month: 9, day: 32, year: null },
      "1860",
    ]) {
      const payload = toQuotleRoundPayload(quoteWith({ on_this_day: anniversary }));
      assert.ok(payload, `expected a round for ${JSON.stringify(anniversary)}`);
      assert.equal(payload.quote.on_this_day, null);
    }
  });

  test("an anniversary with no year survives — a recurring hook has no year to give", () => {
    const payload = toQuotleRoundPayload(quoteWith({ on_this_day: { month: 9, day: 7, year: null } }));
    assert.ok(payload);
    assert.deepEqual(payload.quote.on_this_day, { month: 9, day: 7, year: null });
  });
});

// ── The page itself. `get_verbatim_round` is reachable only with a service-role
// key, so the ONE way this feature can go badly wrong is that key reaching the
// browser. Asserted here rather than trusted, because play/quotle.html is a
// hand-edited 2,500-line file and the next edit will not remember.
describe("play/quotle.html ships no server credential", () => {
  const page = readFileSync(
    fileURLToPath(new URL("../play/quotle.html", import.meta.url)),
    "utf8",
  );

  test("no service-role key, no Supabase admin credential, no direct Supabase call", () => {
    assert.ok(!/service[_-]?role/i.test(page), "no service-role reference of any kind");
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/.test(page));
    assert.ok(!/eyJhbGciOi/.test(page), "no JWT literal (a Supabase key is a JWT)");
    assert.ok(!/supabase\.co/i.test(page), "the page must talk to our route, not to Supabase");
  });

  test("the page asks our own route for the round", () => {
    assert.ok(page.includes('fetch("/api/quotle-round"'));
  });

  test("the only hardcoded quote left is the labelled fallback", () => {
    // Every OTHER copy was deleted; if this count grows, a hardcoded quote has
    // crept back into the markup and the page has quietly stopped being daily.
    const fallbackBlock = page.slice(
      page.indexOf("var FALLBACK_ROUND"),
      page.indexOf("var FETCH_TIMEOUT_MS"),
    );
    assert.ok(fallbackBlock.length > 0, "the fallback round must still exist");
    const outsideFallback = page.replace(fallbackBlock, "");
    assert.ok(
      !/Genius is one percent/.test(outsideFallback),
      "the demo quote must exist only inside FALLBACK_ROUND",
    );
    assert.ok(
      !/Thomas Edison/.test(outsideFallback),
      "the demo author must exist only inside FALLBACK_ROUND",
    );
  });
});
