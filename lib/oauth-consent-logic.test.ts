import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error — plain browser ES module served as-is from /oauth (no build step).
import { accountCheck, classifyRedirect, isLocalCallback, normaliseCode, PREDATE_SLACK_MS, readAuthorizationId, redirectTargetAllowed, safeRedirect } from "../oauth/consent-logic.mjs";

test("only documented vendor callbacks get an Allow button", () => {
  assert.deepEqual(classifyRedirect("https://chatgpt.com/connector_platform_oauth_redirect"), { allowed: true, assistant: "ChatGPT", domain: "chatgpt.com" });
  assert.equal(classifyRedirect("https://chatgpt.com/connector/oauth/abc_DEF-123").allowed, true);
  assert.equal(classifyRedirect("https://claude.ai/api/mcp/auth_callback").assistant, "Claude");
  assert.equal(classifyRedirect("https://claude.com/api/mcp/auth_callback").assistant, "Claude");
  for (const bad of [
    "https://chatgpt.com.evil.example/connector_platform_oauth_redirect",
    "https://evil.example/api/mcp/auth_callback",
    "https://chatgpt.com/connector/oauth/../../x",
    "https://chatgpt.com/connector/oauth/a?next=https://evil.example",
    "http://claude.ai/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback/extra",
    "http://localhost:6274/oauth/callback",
    "javascript:alert(1)",
    "",
    null,
  ]) assert.equal(classifyRedirect(bad).allowed, false, String(bad));
});

test("localhost callbacks only when the staging config allows them", () => {
  assert.equal(classifyRedirect("http://localhost:6274/oauth/callback", { allowDev: true }).allowed, true);
  assert.equal(classifyRedirect("http://127.0.0.1:8765/callback", { allowDev: true }).assistant, "a test app");
  assert.equal(classifyRedirect("http://localhost.evil.example/cb", { allowDev: true }).allowed, false);
});

test("existing users only: the account must predate this sign-in attempt", () => {
  const t0 = Date.parse("2026-11-05T10:00:00Z");
  assert.deepEqual(accountCheck({ created_at: "2025-01-01T00:00:00Z" }, t0), { ok: true });
  assert.deepEqual(accountCheck({ created_at: new Date(t0 - PREDATE_SLACK_MS - 1).toISOString() }, t0), { ok: true });
  // Created just now by the Google/Apple sign-in on this page → refused (left in place, never deleted).
  assert.deepEqual(accountCheck({ created_at: new Date(t0 + 5_000).toISOString() }, t0), { ok: false, reason: "no_real_account" });
  assert.deepEqual(accountCheck({ created_at: new Date(t0 - 30_000).toISOString() }, t0), { ok: false, reason: "no_real_account" });
  assert.deepEqual(accountCheck({ created_at: "2025-01-01T00:00:00Z", is_anonymous: true }, t0), { ok: false, reason: "anonymous" });
  assert.deepEqual(accountCheck({ created_at: "nonsense" }, t0), { ok: false, reason: "no_real_account" });
  assert.deepEqual(accountCheck(null, t0), { ok: false, reason: "no_user" });
  // Already signed in when the page opened: nothing was created here.
  assert.deepEqual(accountCheck({ created_at: "2026-11-05T09:59:59Z" }, null), { ok: true });
});

test("code, authorization id and redirect sanitising", () => {
  assert.equal(normaliseCode(" 1234 5678 "), "12345678");
  assert.equal(normaliseCode("12345"), null);
  assert.equal(readAuthorizationId("?authorization_id=abc12345-XYZ"), "abc12345-XYZ");
  assert.equal(readAuthorizationId("?authorization_id=<script>"), null);
  assert.equal(readAuthorizationId(""), null);
  assert.equal(safeRedirect("https://chatgpt.com/connector_platform_oauth_redirect?code=x"), "https://chatgpt.com/connector_platform_oauth_redirect?code=x");
  assert.equal(safeRedirect("javascript:alert(1)"), null);
  assert.equal(safeRedirect("http://127.0.0.1:8765/callback?code=x"), null);
  assert.equal(safeRedirect("http://127.0.0.1:8765/callback?code=x", { allowDev: true }), "http://127.0.0.1:8765/callback?code=x");
});

test("the post-decision redirect must itself be a vendor callback", () => {
  assert.equal(redirectTargetAllowed("https://claude.ai/api/mcp/auth_callback?code=abc&state=s"), "https://claude.ai/api/mcp/auth_callback?code=abc&state=s");
  assert.equal(redirectTargetAllowed("https://chatgpt.com/connector/oauth/cb_123?code=x"), "https://chatgpt.com/connector/oauth/cb_123?code=x");
  assert.equal(redirectTargetAllowed("https://evil.example/cb?code=abc"), null);
  assert.equal(redirectTargetAllowed("https://claude.ai/somewhere-else?code=abc"), null);
  assert.equal(redirectTargetAllowed("http://127.0.0.1:8765/callback?code=x"), null);
  assert.equal(redirectTargetAllowed("http://127.0.0.1:8765/callback?code=x", { allowDev: true }), "http://127.0.0.1:8765/callback?code=x");
});

test("local tools are recognised for their own refusal copy", () => {
  assert.equal(isLocalCallback("localhost:33418"), true);
  assert.equal(isLocalCallback("127.0.0.1"), true);
  assert.equal(isLocalCallback("localhost.evil.example"), false);
  assert.equal(isLocalCallback(null), false);
});
