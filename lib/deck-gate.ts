/* ============================================================================
   Angel deck gate — shared crypto + request helpers
   ----------------------------------------------------------------------------
   Everything here is STATELESS. There is no table, no row per viewer, and
   therefore no ceiling on how many people can be let in: an access code is an
   HMAC of the address it was issued to, so the server can re-derive and check it
   without ever having stored it.

   That is a deliberate answer to the constraint Mike set ("mindful of not having
   a ceiling to how many people can see it"). The only per-person cost in the
   whole flow is ONE email, ONCE, and pre-authorised links skip even that.

   Threat model, stated honestly: this is a CURTAIN, not a lock (Mike's explicit
   choice). The deck HTML is a static file and anyone who fetches it directly has
   it. What the gate buys is (a) a real address before the overlay lifts, (b) an
   audit trail of who opened it and from where, and (c) enough friction that the
   deck is not casually passed around. It is not a defence against someone who
   wants the file.
   ========================================================================== */

/** Codes a human retypes: no I/O/0/1, so nothing is ambiguous in a serif email. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;

/** 32^6 = ~1.07 billion codes. Brute force is infeasible without any rate limit,
    which matters because an edge function has no shared memory to count with. */
const CODE_BUCKET_MS = 15 * 60 * 1000;
/** Accept the live bucket plus 3 past ones => a code lives 45-60 minutes. */
const CODE_BUCKET_GRACE = 3;

const SESSION_MAX_AGE_S = 90 * 24 * 60 * 60;
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "reps_deck";

export type Viewer = {
  /** lower-cased address the code was issued to */
  e: string;
  /** where they were when the gate opened, for the forwarding signal */
  geo: string;
  /** issued-at, epoch ms */
  t: number;
  /** places already reported to Slack, so a re-read from the same new city does
      not ping twice. Lives in the cookie because the whole gate is stateless. */
  s?: string[];
};

/* ── primitives ─────────────────────────────────────────────────────────── */

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

/** Constant-time compare. A `===` here leaks the position of the first wrong
    character through timing, which is the whole game against a 6-char code. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── email ──────────────────────────────────────────────────────────────── */

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null;
  return e;
}

/* ── access codes ───────────────────────────────────────────────────────── */

async function codeForBucket(secret: string, email: string, bucket: number): Promise<string> {
  const bytes = await hmac(secret, `code:${email}:${bucket}`);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export async function issueCode(secret: string, email: string, now = Date.now()): Promise<string> {
  return codeForBucket(secret, email, Math.floor(now / CODE_BUCKET_MS));
}

export async function checkCode(
  secret: string,
  email: string,
  supplied: string,
  now = Date.now(),
): Promise<boolean> {
  const given = supplied.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (given.length !== CODE_LEN) return false;
  const live = Math.floor(now / CODE_BUCKET_MS);
  /* Check every bucket even after a hit: bailing early on match makes the
     response time reveal which bucket matched, and therefore roughly when the
     code was issued. Cheap to avoid, so avoid it. */
  let ok = false;
  for (let b = live; b >= live - CODE_BUCKET_GRACE; b--) {
    if (safeEqual(await codeForBucket(secret, email, b), given)) ok = true;
  }
  return ok;
}

/* ── signed payloads (magic links + the session cookie) ─────────────────── */

async function sign(secret: string, kind: string, payload: unknown): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(secret, `${kind}:${body}`));
  return `${body}.${sig}`;
}

async function unsign<T>(secret: string, kind: string, token: string): Promise<T | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = b64url(await hmac(secret, `${kind}:${body}`));
  if (!safeEqual(expect, sig)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(unb64url(body))) as T;
  } catch {
    return null;
  }
}

/** A one-click link, so nobody has to retype anything on a phone. Also the lane
    for pre-authorised invites, which send no email at all. */
export function issueLink(secret: string, email: string, now = Date.now()): Promise<string> {
  return sign(secret, "link", { e: email, x: now + LINK_TTL_MS });
}

export async function checkLink(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<string | null> {
  const p = await unsign<{ e?: unknown; x?: unknown }>(secret, "link", token);
  if (!p || typeof p.e !== "string" || typeof p.x !== "number") return null;
  if (p.x < now) return null;
  return p.e;
}

export function issueSession(secret: string, v: Viewer): Promise<string> {
  return sign(secret, "sess", v);
}

export async function readSession(secret: string, token: string | null): Promise<Viewer | null> {
  if (!token) return null;
  const p = await unsign<Viewer>(secret, "sess", token);
  if (!p || typeof p.e !== "string" || typeof p.geo !== "string" || typeof p.t !== "number") {
    return null;
  }
  return p;
}

export function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_S}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/* ── where the viewer is ────────────────────────────────────────────────── */

/** Vercel resolves geo at the edge, which is a far better forwarding signal than
    a raw IP: phones change IP constantly (cell <-> wifi), so IP churn would fire
    on almost every genuine viewer, while a country/city change genuinely means
    the deck moved to someone else. Nothing here stores an IP address. */
export function geoOf(request: Request): string {
  const h = request.headers;
  const city = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");
  const country = h.get("x-vercel-ip-country");
  const parts = [city ? decodeURIComponent(city) : null, region, country].filter(Boolean);
  return parts.length ? parts.join(", ") : "unknown";
}

export function uaOf(request: Request): string {
  return (request.headers.get("user-agent") ?? "").slice(0, 200);
}

/* ── Slack ──────────────────────────────────────────────────────────────── */

export function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Fire-and-forget with a hard timeout. A Slack outage must never be the reason
    an investor cannot open the deck, so every caller ignores the result. */
export async function notifySlack(payload: unknown): Promise<void> {
  const url = process.env.SLACK_SUPPORT_WEBHOOK_URL;
  if (!url) {
    console.error("deck-gate: SLACK_SUPPORT_WEBHOOK_URL missing");
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) console.error("deck-gate: slack non-2xx", res.status);
  } catch (e) {
    console.error("deck-gate: slack threw", e);
  } finally {
    clearTimeout(timeout);
  }
}

/* ── shared response plumbing ───────────────────────────────────────────── */

export const ALLOWED_ORIGIN = "https://www.getreps.io";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function secret(): string | null {
  return process.env.DECK_GATE_SECRET ?? null;
}
