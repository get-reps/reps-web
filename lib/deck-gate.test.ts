import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  checkCode,
  checkLink,
  geoOf,
  issueCode,
  issueLink,
  issueSession,
  normaliseEmail,
  readCookie,
  readSession,
  sessionCookie,
} from "./deck-gate.js";

const S = "test-secret-not-the-real-one";
const T0 = 1_760_000_000_000;

test("normaliseEmail lower-cases, trims, and rejects rubbish", () => {
  assert.equal(normaliseEmail("  Mike@GetReps.IO "), "mike@getreps.io");
  assert.equal(normaliseEmail("no-at-sign"), null);
  assert.equal(normaliseEmail("a@b"), null);
  assert.equal(normaliseEmail(""), null);
  assert.equal(normaliseEmail(42), null);
  assert.equal(normaliseEmail("a@b." + "x".repeat(300)), null);
});

test("a fresh code verifies, and is stable within its bucket", async () => {
  const code = await issueCode(S, "a@b.com", T0);
  assert.equal(code.length, 6);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(await issueCode(S, "a@b.com", T0 + 60_000), code);
  assert.equal(await checkCode(S, "a@b.com", code, T0), true);
});

test("codes are accepted case-insensitively and with stray spacing", async () => {
  const code = await issueCode(S, "a@b.com", T0);
  assert.equal(await checkCode(S, "a@b.com", code.toLowerCase(), T0), true);
  assert.equal(await checkCode(S, "a@b.com", ` ${code} `, T0), true);
});

test("a code is bound to its address and to this secret", async () => {
  const code = await issueCode(S, "a@b.com", T0);
  assert.equal(await checkCode(S, "other@b.com", code, T0), false);
  assert.equal(await checkCode("different-secret", "a@b.com", code, T0), false);
});

test("a code survives the grace window and dies after it", async () => {
  const code = await issueCode(S, "a@b.com", T0);
  const MIN = 60_000;
  // still good 40 minutes later (inside the 3-bucket grace)
  assert.equal(await checkCode(S, "a@b.com", code, T0 + 40 * MIN), true);
  // gone by 70 minutes
  assert.equal(await checkCode(S, "a@b.com", code, T0 + 70 * MIN), false);
});

test("a wrong or malformed code is refused", async () => {
  assert.equal(await checkCode(S, "a@b.com", "AAAAAA", T0 + 1), false);
  assert.equal(await checkCode(S, "a@b.com", "ABC", T0), false);
  assert.equal(await checkCode(S, "a@b.com", "", T0), false);
  // the ambiguous glyphs are not in the alphabet, so they can never be a code
  assert.equal(await checkCode(S, "a@b.com", "OIOIOI", T0), false);
});

test("a link round-trips, expires, and cannot be tampered with", async () => {
  const token = await issueLink(S, "a@b.com", T0);
  assert.equal(await checkLink(S, token, T0 + 1000), "a@b.com");
  // seven days is the default life
  assert.equal(await checkLink(S, token, T0 + 6 * 864e5), "a@b.com");
  assert.equal(await checkLink(S, token, T0 + 8 * 864e5), null);
  // flip a character in the payload -> signature no longer matches
  const [body, sig] = token.split(".");
  const swapped = body.slice(0, -1) + (body.slice(-1) === "A" ? "B" : "A");
  assert.equal(await checkLink(S, `${swapped}.${sig}`, T0 + 1000), null);
  assert.equal(await checkLink(S, "garbage", T0), null);
  assert.equal(await checkLink(S, "", T0), null);
});

test("a session round-trips and carries the place it was opened from", async () => {
  const token = await issueSession(S, { e: "a@b.com", geo: "London, ENG, GB", t: T0 });
  const v = await readSession(S, token);
  assert.equal(v?.e, "a@b.com");
  assert.equal(v?.geo, "London, ENG, GB");
  assert.equal(await readSession("wrong-secret", token), null);
  assert.equal(await readSession(S, null), null);
});

test("the seen-places list survives a re-issue", async () => {
  const token = await issueSession(S, {
    e: "a@b.com",
    geo: "London, ENG, GB",
    t: T0,
    s: ["Paris, FR", "New York, NY, US"],
  });
  const v = await readSession(S, token);
  assert.deepEqual(v?.s, ["Paris, FR", "New York, NY, US"]);
});

test("a link token is NOT accepted as a session, and vice versa", async () => {
  // the two are signed under different labels, so one can never be replayed as
  // the other even though the envelope format is identical
  const link = await issueLink(S, "a@b.com", T0);
  assert.equal(await readSession(S, link), null);
  const sess = await issueSession(S, { e: "a@b.com", geo: "x", t: T0 });
  assert.equal(await checkLink(S, sess, T0), null);
});

test("the session cookie is httpOnly, secure and long-lived", () => {
  const c = sessionCookie("tok");
  assert.match(c, /^reps_deck=tok;/);
  assert.match(c, /HttpOnly/);
  assert.match(c, /Secure/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Max-Age=7776000/);
});

test("readCookie picks the right one out of a crowded header", () => {
  const req = new Request("https://x.test", {
    headers: { cookie: "a=1; reps_deck=abc.def; reps_deck_rq=2-3" },
  });
  assert.equal(readCookie(req, "reps_deck"), "abc.def");
  assert.equal(readCookie(req, "reps_deck_rq"), "2-3");
  assert.equal(readCookie(req, "nope"), null);
  assert.equal(readCookie(new Request("https://x.test"), "reps_deck"), null);
});

test("geoOf reads Vercel's headers and degrades to unknown", () => {
  const req = new Request("https://x.test", {
    headers: {
      "x-vercel-ip-city": "San%20Francisco",
      "x-vercel-ip-country-region": "CA",
      "x-vercel-ip-country": "US",
    },
  });
  assert.equal(geoOf(req), "San Francisco, CA, US");
  assert.equal(geoOf(new Request("https://x.test")), "unknown");
});

/* ── the cross-implementation guard ───────────────────────────────────────
   deck-invite.mjs signs invite links with node:crypto; this file verifies them
   with WebCrypto. They are two independent implementations of one signature,
   and if they ever drift, every pre-authorised link fails at the door with no
   diagnostic. This is the test that catches that.
   ──────────────────────────────────────────────────────────────────────── */
function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function issueLinkTheInviteScriptWay(secret: string, email: string, expiresAt: number): string {
  const body = b64url(Buffer.from(JSON.stringify({ e: email, x: expiresAt }), "utf8"));
  const sig = b64url(createHmac("sha256", secret).update(`link:${body}`).digest());
  return `${body}.${sig}`;
}

test("deck-invite.mjs links verify against the edge function's checkLink", async () => {
  const expiresAt = T0 + 60 * 864e5;
  const token = issueLinkTheInviteScriptWay(S, "investor@fund.com", expiresAt);
  assert.equal(await checkLink(S, token, T0), "investor@fund.com");
  assert.equal(await checkLink(S, token, expiresAt + 1), null);
  assert.equal(await checkLink("other-secret", token, T0), null);
});

test("both implementations produce byte-identical tokens", async () => {
  const mine = await issueLink(S, "a@b.com", T0);
  const theirs = issueLinkTheInviteScriptWay(S, "a@b.com", T0 + 7 * 864e5);
  assert.equal(mine, theirs);
});
