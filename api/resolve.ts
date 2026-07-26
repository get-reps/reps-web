import { createClient } from "@supabase/supabase-js";

// QR short-link gateway resolver for getreps.io/r/<slug>.
// vercel.json rewrites /r/:slug -> /api/resolve?slug=:slug. Looks the slug up in
// public.links, 302s to the platform-appropriate destination, and logs the scan
// to public.link_scans (best-effort). Destinations are re-pointable (e.g. to the
// App Store at launch) with no reprint. Never 500s: any failure falls back home.
export const runtime = "edge";

const HOME = "https://getreps.io";
// AppsFlyer OneLink. Permanent subdomain for REPS (template yW0c); an ordinary
// https host that 301s on to the App Store, so it is safe to redirect into and
// it is what gives an install real attribution instead of a bare store link.
const ONELINK_HOST = "repsapp.onelink.me";
const ALLOWED_HOSTS = new Set([
  "getreps.io",
  "www.getreps.io",
  // Web funnel (funnel-deploy Vercel project). A destination host that is NOT
  // listed here does not fail loudly — resolveDestination() silently falls back
  // to HOME, so a links row pointing at an unlisted host 302s every visitor to
  // the homepage with nothing to flag it. Add the host here and deploy BEFORE
  // pointing a links row at it, never the other way round.
  "start.getreps.io",
  "testflight.apple.com",
  "apps.apple.com",
  "play.google.com",
  ONELINK_HOST,
]);

type Platform = "ios" | "android" | "fallback";

function redirect(dest: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: dest, "Cache-Control": "no-store" },
  });
}

function redirectHome(): Response {
  return redirect(HOME);
}

// Preserve the legacy static behavior for any /r/<code> not in the DB: send it to
// the homepage carrying its ref (what vercel.json's old static redirect did).
function redirectHomeWithRef(slug: string): Response {
  return redirect(`${HOME}/?ref=${encodeURIComponent(slug)}`);
}

// SHA-256 of the first x-forwarded-for hop, hex, truncated to 32 — matches api/support.ts hashIp.
async function hashIp(xff: string | null): Promise<string | null> {
  if (!xff) return null;
  const firstHop = xff.split(",")[0]?.trim();
  if (!firstHop) return null;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(firstHop),
  );
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function platformFromUA(ua: string | null): Platform {
  if (!ua) return "fallback";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "fallback";
}

function normalizeCountry(c: string | null): string | null {
  if (!c) return null;
  const up = c.toUpperCase();
  return /^[A-Z]{2}$/.test(up) ? up : null;
}

function normalizeRef(value: string | null): string | null {
  if (!value || !/^(0|[1-9]\d{0,9})$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= 2_147_483_647 ? String(parsed) : null;
}

// Treat the jsonb destination as untrusted; enforce https + host allowlist.
function resolveDestination(destination: unknown, platform: Platform): string {
  if (!destination || typeof destination !== "object") return HOME;
  const d = destination as Record<string, unknown>;
  const pick = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const chosen = pick(d[platform]) ?? pick(d.fallback) ?? HOME;
  try {
    const u = new URL(chosen);
    if (u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
      return chosen;
    }
  } catch {
    /* fall through to home */
  }
  return HOME;
}

// Carry the gateway's own ?u=<ref> through to AppsFlyer as af_sub1, so an install
// attributes to the individual recipient and not just to the campaign. Deliberately
// scoped to the OneLink host: no other destination understands af_sub*, and blindly
// appending a param to an arbitrary destination risks colliding with its own query
// string. `ref` is already normalized to a bounded integer before it reaches here.
function withAttribution(dest: string, ref: string | null): string {
  if (!ref) return dest;
  try {
    const u = new URL(dest);
    if (u.hostname.toLowerCase() !== ONELINK_HOST) return dest;
    u.searchParams.set("af_sub1", ref);
    return u.toString();
  } catch {
    return dest;
  }
}

async function handle(request: Request, log: boolean): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("resolve: missing supabase env");
    return redirectHome();
  }

  const requestUrl = new URL(request.url);
  const slug = (requestUrl.searchParams.get("slug") || "").trim();
  const ref = normalizeRef(requestUrl.searchParams.get("u"));
  if (!slug) return redirectHome();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let link: { id: string; destination: unknown } | null = null;
  try {
    const { data, error } = await supabase
      .from("links")
      .select("id, destination")
      .eq("slug", slug)
      .eq("is_archived", false)
      .maybeSingle();
    if (error) {
      console.error("resolve: lookup error", error);
      return redirectHome();
    }
    link = data;
  } catch (e) {
    console.error("resolve: lookup threw", e);
    return redirectHome();
  }

  // Unknown slug: preserve the legacy /?ref=<slug> behavior (no scan to log).
  if (!link) return redirectHomeWithRef(slug);

  const ua = request.headers.get("user-agent");
  const platform = platformFromUA(ua);
  const dest = withAttribution(resolveDestination(link.destination, platform), ref);

  if (log) {
    // Best-effort scan logging; a failure here must never block the redirect.
    try {
      const ipHash = await hashIp(request.headers.get("x-forwarded-for"));
      const referrer = (request.headers.get("referer") ?? "").slice(0, 1024) || null;
      const country = normalizeCountry(request.headers.get("x-vercel-ip-country"));
      const { error } = await supabase.from("link_scans").insert({
        link_id: link.id,
        ip_hash: ipHash,
        user_agent: ua ? ua.slice(0, 512) : null,
        referrer,
        country,
        platform,
        ref,
      });
      if (error) console.error("resolve: scan log failed", error);
    } catch (e) {
      console.error("resolve: scan log failed", e);
    }
  }

  return redirect(dest);
}

export async function GET(request: Request): Promise<Response> {
  return handle(request, true);
}

// HEAD (probes/preflights): resolve + 302 but do NOT log a scan.
export async function HEAD(request: Request): Promise<Response> {
  return handle(request, false);
}
