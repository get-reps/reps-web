// G6 — Meta Conversions API (CAPI) server-side Lead. Recovers the ~40-50% of the browser Lead
// pixel that iOS/ATT + ad-blockers drop. Fires a server-side duplicate of the LP's `fbq('track',
// 'Lead')`, sharing an `event_id` so Meta DEDUPES the browser + server events (never double-counts).
// The LP (get/remember.html wlCapture) generates the event_id, fires the browser pixel with
// {eventID}, and POSTs here with the same event_id + hashed-able user data.
//
// Env (Vercel): META_CAPI_TOKEN — Conversions API access token (Events Manager -> pixel ->
// Settings -> Conversions API -> Generate access token). Secret; never in the repo. Missing token
// => soft no-op (200) so the client fire-and-forget never errors before the token is provisioned.
// Optional: META_CAPI_TEST_CODE — a Test Events code to verify in Events Manager -> Test events.

export const runtime = "edge";

const PIXEL_ID = "2087800178795740";
const GRAPH_VERSION = "v21.0";
const ALLOWED_ORIGIN = "https://getreps.io";
const MAX_EMAIL_LEN = 200;

type LeadBody = {
  event_id?: unknown;
  email?: unknown;
  event_source_url?: unknown;
  fbp?: unknown;
  fbc?: unknown;
};

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function permissiveEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Meta normalization for the email identifier: trim + lowercase, then SHA-256 hex.
async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function str(value: unknown, max = 400): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const token = process.env.META_CAPI_TOKEN;

  let body: LeadBody;
  try {
    body = (await request.json()) as LeadBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const eventId = str(body.event_id, 100);
  if (!email || email.length > MAX_EMAIL_LEN || !permissiveEmailValid(email) || !eventId) {
    return json({ error: "bad request" }, 400);
  }

  // Soft no-op until the token is provisioned — the browser call is fire-and-forget, so a 200
  // keeps the LP clean while G6-CAPI is wired but the Events Manager token isn't set yet.
  if (!token) {
    console.warn("meta-lead: META_CAPI_TOKEN not set — skipping server Lead");
    return json({ ok: true, skipped: "no_token" });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const clientIp = xff.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";

  const userData: Record<string, unknown> = { em: [await hashEmail(email)] };
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent.slice(0, 400);
  const fbp = str(body.fbp, 200);
  const fbc = str(body.fbc, 200);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId, // shared with the browser pixel → Meta dedupes
        action_source: "website",
        event_source_url: str(body.event_source_url, 500) || ALLOWED_ORIGIN,
        user_data: userData,
      },
    ],
    access_token: token,
  };
  const testCode = process.env.META_CAPI_TEST_CODE;
  if (testCode) payload.test_event_code = testCode;

  // Best-effort: never block the user. Bounded timeout; failures are logged, not surfaced.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("meta-lead: CAPI non-2xx", res.status, detail.slice(0, 300));
      return json({ ok: false, status: res.status });
    }
  } catch (e) {
    console.error("meta-lead: CAPI threw", e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: "capi_failed" });
  } finally {
    clearTimeout(timeoutId);
  }

  return json({ ok: true, event_id: eventId });
}
