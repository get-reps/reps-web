import { createClient } from "@supabase/supabase-js";

// QR short-link gateway resolver for getreps.io/r/<slug>.
// vercel.json rewrites /r/:slug -> /api/resolve?slug=:slug. Looks the slug up in
// public.links, 302s to the platform-appropriate destination, and logs the scan
// to public.link_scans (best-effort). Destinations are re-pointable (e.g. to the
// App Store at launch) with no reprint. Never 500s: any failure falls back home.
export const runtime = "edge";

const HOME = "https://getreps.io";
const ALLOWED_HOSTS = new Set([
  "getreps.io",
  "www.getreps.io",
  "testflight.apple.com",
  "apps.apple.com",
  "play.google.com",
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

async function handle(request: Request, log: boolean): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("resolve: missing supabase env");
    return redirectHome();
  }

  const slug = (new URL(request.url).searchParams.get("slug") || "").trim();
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
  const dest = resolveDestination(link.destination, platform);

  if (log) {
    // Best-effort scan logging; a failure here must never block the redirect.
    try {
      const ipHash = await hashIp(request.headers.get("x-forwarded-for"));
      const referrer = (request.headers.get("referer") ?? "").slice(0, 1024) || null;
      const country = normalizeCountry(request.headers.get("x-vercel-ip-country"));
      await supabase.from("link_scans").insert({
        link_id: link.id,
        ip_hash: ipHash,
        user_agent: ua ? ua.slice(0, 512) : null,
        referrer,
        country,
        platform,
      });
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
