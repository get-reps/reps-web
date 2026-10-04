// Invite preview route: GET /api/invite-preview?code=<CODE> -> { first_name, avatar_url }.
//
// Spec: reps-web docs/invite-preview-backend-spec.md. The page (reps-web js/invite-preview.js)
// already calls this and falls back to "A friend is inviting you to REPS" on anything but a usable
// first name. This module is the route's whole behaviour, written against Web-standard
// Request/Response with no runtime dependencies so reps-web's Vercel edge route can host it as-is:
//
//   // reps-web api/invite-preview.ts
//   export const runtime = "edge";
//   export const GET = createInvitePreviewHandler({
//     supabaseUrl: process.env.SUPABASE_URL,
//     lookup: createRpcLookup({
//       supabaseUrl: process.env.SUPABASE_URL,
//       serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
//     }),
//   });
//
// PRIVACY (binding):
//   * The body is ALWAYS exactly { first_name, avatar_url } — built here from scratch, never by
//     passing the database row through, so a widened SQL function cannot widen the response.
//   * Unknown, malformed, ineligible (friends-only / private / inactive / system / deleting) and
//     errored lookups all return the identical generic body with HTTP 200: no enumeration oracle.
//   * A picture is never returned without a name, and only from the project's own public avatars
//     bucket or a Google sign-in photo (resolveAvatarUrl) — never an arbitrary host.
//   * Only the first word of first_name is returned.
//   * Logs carry an outcome category only — never the code, the name or the picture URL.
//   * No CORS headers: only the same-origin page may read the response from a browser.

export type InvitePreviewBody = { first_name: string | null; avatar_url: string | null };

/** Fetches the raw database result for an already-validated code. May throw; may return junk. */
export type InvitePreviewLookup = (code: string) => Promise<unknown>;

export type InvitePreviewOutcome = "personal" | "generic" | "invalid_code" | "rate_limited" | "error";

export interface RateLimiter {
  /** True when this caller may proceed; false when over its budget. */
  allow(key: string, nowMs: number): boolean;
}

export const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";
export const RATE_LIMIT_PER_MINUTE = 30;
export const LOOKUP_TIMEOUT_MS = 2000;
const MAX_NAME_CHARS = 64;
const MAX_URL_CHARS = 2048;

// generate_referral_code()'s alphabet (no I/O/0/1) — the same grammar the page gates on.
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

export function genericBody(): InvitePreviewBody {
  return { first_name: null, avatar_url: null };
}

export function normalizeCode(raw: string | null): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** First word only — some users type a full name into first_name. */
function cleanFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const first = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().split(/\s+/)[0];
  if (!first) return null;
  return Array.from(first).slice(0, MAX_NAME_CHARS).join("");
}

// users.avatar_url is owner-writable with no validation, so it is NEVER reflected as-is: an
// arbitrary https host would make every visitor of the invite link load from it. Current app
// uploads store a storage path `<userId>/<uuid>.<ext>` (reps-app lib/queries/avatar.ts); historic
// rows hold the project's full public URL; OAuth sign-ups hold a Google photo URL.
const AVATAR_PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const AVATARS_PUBLIC_PREFIX = "/storage/v1/object/public/avatars/";
const ALLOWED_PHOTO_HOSTS = new Set(["lh3.googleusercontent.com"]);

/**
 * A safe, absolute avatar URL or null. Accepts exactly: a storage path (resolved against the
 * project's public avatars bucket), a full URL on the project's OWN public avatars prefix, or a
 * Google sign-in photo. `supabaseUrl` is the project origin; without it only Google photos pass.
 */
export function resolveAvatarUrl(raw: unknown, supabaseUrl: string | undefined): string | null {
  if (typeof raw !== "string" || raw.length > MAX_URL_CHARS) return null;
  let projectOrigin: string | null = null;
  if (supabaseUrl) {
    try {
      const project = new URL(supabaseUrl);
      if (project.protocol === "https:") projectOrigin = project.origin;
    } catch {
      projectOrigin = null;
    }
  }

  if (AVATAR_PATH_RE.test(raw)) {
    return projectOrigin ? `${projectOrigin}${AVATARS_PUBLIC_PREFIX}${raw}` : null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (ALLOWED_PHOTO_HOSTS.has(url.hostname)) return url.href;
  if (
    projectOrigin &&
    url.origin === projectOrigin &&
    url.pathname.startsWith(AVATARS_PUBLIC_PREFIX) &&
    url.pathname.length > AVATARS_PUBLIC_PREFIX.length
  ) {
    return url.href;
  }
  return null;
}

/**
 * The only path from a database result to a response body. Reads exactly two fields and builds a
 * fresh object, so nothing else the row might carry can reach the client.
 */
export function toPreviewBody(raw: unknown, supabaseUrl?: string): InvitePreviewBody {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return genericBody();
  const row = raw as Record<string, unknown>;
  const firstName = cleanFirstName(row.first_name);
  if (!firstName) return genericBody();
  return { first_name: firstName, avatar_url: resolveAvatarUrl(row.avatar_url, supabaseUrl) };
}

/**
 * Best-effort per-instance fixed-window limiter. The authoritative limit is the Vercel Firewall
 * rule on /api/invite-preview (30 req/min/IP, deny); this one bounds a single warm instance and
 * keeps database calls from one caller in check if that rule is ever missing. Edge caching means
 * it only ever sees cache misses.
 */
export function createFixedWindowLimiter(
  opts: { limit?: number; windowMs?: number; maxKeys?: number } = {},
): RateLimiter {
  const limit = opts.limit ?? RATE_LIMIT_PER_MINUTE;
  const windowMs = opts.windowMs ?? 60_000;
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key, nowMs) {
      const current = windows.get(key);
      if (!current || nowMs - current.start >= windowMs) {
        // Bound memory: drop the oldest entry (insertion order) rather than grow without limit.
        if (!current && windows.size >= maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest !== undefined) windows.delete(oldest);
        }
        windows.set(key, { start: nowMs, count: 1 });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
  };
}

/** Caller identity for rate limiting: the platform-set client IP. */
export function callerKey(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/**
 * Calls public.get_invite_preview(p_code) through PostgREST with the service-role key. Missing
 * configuration resolves to null (generic page), never an exception the route could surface.
 */
export function createRpcLookup(opts: {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  fetchImpl?: typeof fetch;
}): InvitePreviewLookup {
  return async (code) => {
    if (!opts.supabaseUrl || !opts.serviceRoleKey) return null;
    const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    const res = await fetchImpl(`${opts.supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/get_invite_preview`, {
      method: "POST",
      headers: {
        apikey: opts.serviceRoleKey,
        Authorization: `Bearer ${opts.serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ p_code: code }),
    });
    if (!res.ok) return null;
    return await res.json();
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timedOut]).finally(() => clearTimeout(timer));
}

function json(body: InvitePreviewBody, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function createInvitePreviewHandler(deps: {
  lookup: InvitePreviewLookup;
  /** The Supabase project URL: resolves storage-path avatars and is the only storage host allowed. */
  supabaseUrl: string | undefined;
  limiter?: RateLimiter;
  now?: () => number;
  timeoutMs?: number;
  log?: (event: { event: "invite_preview"; outcome: InvitePreviewOutcome }) => void;
}): (request: Request) => Promise<Response> {
  const limiter = deps.limiter ?? createFixedWindowLimiter();
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? LOOKUP_TIMEOUT_MS;
  const log = deps.log ?? (() => {});

  return async (request) => {
    let outcome: InvitePreviewOutcome = "error";
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
      }

      const code = normalizeCode(new URL(request.url).searchParams.get("code"));
      if (!code) {
        outcome = "invalid_code";
        return json(genericBody(), 200, CACHE_CONTROL);
      }

      if (!limiter.allow(callerKey(request), now())) {
        outcome = "rate_limited";
        // Generic body so the page degrades exactly as it does for the firewall's 429; no-store so
        // an edge cache never replays one caller's throttle to everyone opening this link.
        return json(genericBody(), 429, "no-store");
      }

      let raw: unknown = null;
      try {
        raw = await withTimeout(deps.lookup(code), timeoutMs);
      } catch {
        outcome = "error";
        return json(genericBody(), 200, CACHE_CONTROL);
      }
      const body = toPreviewBody(raw, deps.supabaseUrl);
      outcome = body.first_name ? "personal" : "generic";
      return json(body, 200, CACHE_CONTROL);
    } catch {
      outcome = "error";
      return json(genericBody(), 200, CACHE_CONTROL);
    } finally {
      try {
        log({ event: "invite_preview", outcome });
      } catch {
        // Logging must never change the response.
      }
    }
  };
}
