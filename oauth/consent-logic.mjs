// Pure decision logic for /oauth/consent (reps-backend/work/chatgpt-plugin-261104/PLAN.md §1.3).
// No DOM, no network — unit-tested in lib/oauth-consent-logic.test.ts; consent.html imports it.

// Anti-phishing: dynamic client registration is open, so anyone can register a client
// called "ChatGPT". Identity comes ONLY from the redirect URI matching a vendor's
// documented callback — never from client_name, never from logo_uri.
//   OpenAI: https://developers.openai.com/plugins/build/auth.md (stable redirect, or the
//           callback-ID form when the authorization server does not send RFC 9207 `iss`).
//   Anthropic: claude.ai and claude.com MCP auth callbacks.
const EXACT = new Map([
  ["https://chatgpt.com/connector_platform_oauth_redirect", "ChatGPT"],
  ["https://claude.ai/api/mcp/auth_callback", "Claude"],
  ["https://claude.com/api/mcp/auth_callback", "Claude"],
]);
const CHATGPT_CALLBACK_ID = /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]{1,128}$/;
// Staging only (MCP Inspector, local test scripts). Claude Code's localhost callback is
// refused in production by construction: these never match unless allowDev is true.
const DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/[A-Za-z0-9_\/.-]*$/;

/**
 * @param {unknown} redirectUri  the redirect_uri from getAuthorizationDetails()
 * @param {{ allowDev?: boolean }} [opts]
 * @returns {{ allowed: true, assistant: string, domain: string } | { allowed: false, domain: string | null }}
 */
export function classifyRedirect(redirectUri, opts = {}) {
  if (typeof redirectUri !== "string" || redirectUri.length > 512) return { allowed: false, domain: null };
  let domain = null;
  try {
    domain = new URL(redirectUri).host;
  } catch {
    return { allowed: false, domain: null };
  }
  const exact = EXACT.get(redirectUri);
  if (exact) return { allowed: true, assistant: exact, domain };
  if (CHATGPT_CALLBACK_ID.test(redirectUri)) return { allowed: true, assistant: "ChatGPT", domain };
  if (opts.allowDev === true && DEV.test(redirectUri)) return { allowed: true, assistant: "a test app", domain };
  return { allowed: false, domain };
}

// "Existing REPS users only", enforced without a server route and without deleting
// anything (PLAN §1.3 cycle-3): a Google/Apple web sign-in for an unknown identity CREATES
// an account before we can refuse, so the one test is whether the account predates THIS
// consent attempt. t0 = when the user tapped a sign-in button (persisted across the
// provider redirect). 60 s of slack covers clock skew between the browser and Supabase.
export const PREDATE_SLACK_MS = 60_000;

/**
 * @param {{ created_at?: string, is_anonymous?: boolean } | null} user
 * @param {number | null} t0Ms  epoch ms when sign-in started on this page, or null if the
 *   user arrived already signed in (no sign-in happened here → nothing was created here)
 * @returns {{ ok: true } | { ok: false, reason: "no_real_account" | "anonymous" | "no_user" }}
 */
export function accountCheck(user, t0Ms) {
  if (!user) return { ok: false, reason: "no_user" };
  if (user.is_anonymous === true) return { ok: false, reason: "anonymous" };
  if (t0Ms === null) return { ok: true };
  const created = Date.parse(user.created_at ?? "");
  if (!Number.isFinite(created)) return { ok: false, reason: "no_real_account" };
  if (created >= t0Ms - PREDATE_SLACK_MS) return { ok: false, reason: "no_real_account" };
  return { ok: true };
}

/** Supabase email codes are 6–10 digits (both projects are set to 8 today). */
export function normaliseCode(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 10 ? digits : null;
}

/** authorization_id from the query string; Supabase ids are opaque, so only shape-check. */
export function readAuthorizationId(search) {
  const id = new URLSearchParams(search).get("authorization_id");
  return id && /^[A-Za-z0-9_-]{8,256}$/.test(id) ? id : null;
}

/**
 * Where Supabase tells us to send the browser after a decision (or for an already-consented
 * request) must itself be an allow-listed vendor callback — defence in depth against a grant
 * made by any other route. Query/fragment carry the code/state and are ignored for matching.
 */
export function redirectTargetAllowed(url, opts = {}) {
  const safe = safeRedirect(url, opts);
  if (!safe) return null;
  const u = new URL(safe);
  return classifyRedirect(u.origin + u.pathname, opts).allowed ? safe : null;
}

/** True when the redirect is a local tool (e.g. Claude Code) — refused in production with its own copy. */
export function isLocalCallback(domain) {
  return typeof domain === "string" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(domain);
}

/** Only ever navigate to an https URL (or the dev callback when allowed) returned by Supabase. */
export function safeRedirect(url, opts = {}) {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return u.toString();
    if (opts.allowDev === true && u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.toString();
  } catch {
    /* fall through */
  }
  return null;
}
