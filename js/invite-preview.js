// @ts-check
// Inviter preview for invite.html: "<FirstName> is inviting you to REPS".
//
// Contract (spec: docs/invite-preview-backend-spec.md — the endpoint is NOT built yet):
//   GET /api/invite-preview?code=<8-char referral code>
//   200 { "first_name": string | null, "avatar_url": string | null }
// Unknown, ineligible or private inviters get the SAME 200 body with both fields null,
// so the response never reveals whether a code exists. Until the endpoint ships the
// route 404s and the page simply stays on its generic state.
//
// Everything here fails closed: any network error, timeout, non-200, malformed body or
// suspicious value resolves to null and the page keeps the generic "A friend" version.

/**
 * @typedef {{ first_name: string | null, avatar_url: string | null }} InvitePreviewResponse
 * @typedef {{ firstName: string, avatarUrl: string | null }} InvitePreview
 */

export const ENDPOINT = "/api/invite-preview";
export const TIMEOUT_MS = 2500;
const MAX_NAME_CHARS = 24;
const MAX_URL_CHARS = 2048;

// generate_referral_code()'s alphabet (no I/O/0/1) — same grammar invite.html already gates on.
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** @param {unknown} raw @returns {string | null} */
export function normalizeCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/**
 * A display-safe first name, or null. Defensive even though the server should only
 * ever send a first name: keeps the first word, drops control/markup characters,
 * and requires at least one letter.
 * @param {unknown} raw @returns {string | null}
 */
export function cleanFirstName(raw) {
  if (typeof raw !== "string") return null;
  const first = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().split(/\s+/)[0] || "";
  if (!/\p{L}/u.test(first)) return null;
  return Array.from(first).slice(0, MAX_NAME_CHARS).join("");
}

/** @param {unknown} raw @returns {string | null} */
export function cleanAvatarUrl(raw) {
  if (typeof raw !== "string" || raw.length > MAX_URL_CHARS) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * No usable first name means no personalization at all — a photo alone is never shown.
 * @param {unknown} body @returns {InvitePreview | null}
 */
export function parsePreview(body) {
  if (!body || typeof body !== "object") return null;
  const b = /** @type {Record<string, unknown>} */ (body);
  const firstName = cleanFirstName(b.first_name);
  if (!firstName) return null;
  return { firstName, avatarUrl: cleanAvatarUrl(b.avatar_url) };
}

/**
 * Never rejects.
 * @param {string} code
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<InvitePreview | null>}
 */
export async function fetchInvitePreview(code, opts = {}) {
  const valid = normalizeCode(code);
  if (!valid) return null;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  // The race (not just the abort) bounds a slow body too, and a fetch that ignores the signal.
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, opts.timeoutMs ?? TIMEOUT_MS);
  });
  const lookup = (async () => {
    const res = await fetchImpl(ENDPOINT + "?code=" + encodeURIComponent(valid), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    if (!res.ok) return null;
    return parsePreview(await res.json());
  })().catch(() => null);
  try {
    return /** @type {InvitePreview | null} */ (await Promise.race([lookup, timedOut]));
  } finally {
    clearTimeout(timer);
  }
}

/** @param {InvitePreview | null} preview */
export function headlineName(preview) {
  return preview ? preview.firstName : "A friend";
}
