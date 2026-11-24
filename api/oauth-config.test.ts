import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET } from "./oauth-config.ts";

const KEYS = ["OAUTH_SUPABASE_URL", "OAUTH_SUPABASE_ANON_KEY", "OAUTH_ALLOW_DEV_CALLBACKS", "OAUTH_GOOGLE_ENABLED", "OAUTH_APPLE_ENABLED", "OAUTH_POSTHOG_KEY", "OAUTH_EMAIL_CODE_ENABLED"];
afterEach(() => { for (const k of KEYS) delete process.env[k]; });

test("unconfigured deploy fails loudly instead of guessing a project", async () => {
  const res = GET();
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { error: "not_configured" });
});

test("a non-Supabase URL is refused", () => {
  process.env.OAUTH_SUPABASE_URL = "https://evil.example";
  process.env.OAUTH_SUPABASE_ANON_KEY = "x".repeat(40);
  assert.equal(GET().status, 503);
});

test("returns the public config; dev callbacks off unless explicitly enabled", async () => {
  process.env.OAUTH_SUPABASE_URL = "https://ecxgtkoaerunnfklhglx.supabase.co";
  process.env.OAUTH_SUPABASE_ANON_KEY = "a".repeat(40);
  let body = await GET().json();
  assert.deepEqual(body, { supabaseUrl: "https://ecxgtkoaerunnfklhglx.supabase.co", anonKey: "a".repeat(40), allowDevCallbacks: false, google: false, apple: false, emailCode: false, posthogKey: null });
  process.env.OAUTH_ALLOW_DEV_CALLBACKS = "true";
  body = await GET().json();
  assert.equal(body.allowDevCallbacks, true);
});
