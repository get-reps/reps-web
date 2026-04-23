import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const ALLOWED_ORIGIN = "https://getreps.io";
const ALLOWED_CATEGORIES = new Set([
  "bug", "feature", "account", "chrome-extension", "privacy", "other",
]);
const MAX_MESSAGE_LEN = 4000;
const MAX_EMAIL_LEN = 200;
const MAX_NAME_LEN = 100;
const MIN_ELAPSED_MS = 1500;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_MAX = 5;

type SupportRequestBody = {
  name?: unknown;
  email?: unknown;
  category?: unknown;
  message?: unknown;
  source_page?: unknown;
  website?: unknown;
  submit_elapsed_ms?: unknown;
};

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

function permissiveEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const slackWebhookUrl = process.env.SLACK_SUPPORT_WEBHOOK_URL;

  if (!supabaseUrl || !serviceRoleKey || !slackWebhookUrl) {
    return new Response("misconfigured", { status: 500, headers: corsHeaders() });
  }

  let body: SupportRequestBody;
  try {
    body = (await request.json()) as SupportRequestBody;
  } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders() });
  }

  // Honeypot — opaque 400, never reveal reason; any non-empty/non-null value trips it
  if (body.website !== undefined && body.website !== null && body.website !== "") {
    return new Response("bad request", { status: 400, headers: corsHeaders() });
  }

  // Time-floor — require finite number; NaN/non-number coerces to 0 and is rejected
  const rawElapsed = body.submit_elapsed_ms;
  const elapsed =
    typeof rawElapsed === "number" && Number.isFinite(rawElapsed) ? rawElapsed : 0;
  if (elapsed < MIN_ELAPSED_MS) {
    return new Response("bad request", { status: 400, headers: corsHeaders() });
  }

  // Field validation — trim all user strings first
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = rawName.length > 0 ? rawName : null;

  // source_page: same-origin validation and canonicalization
  let sourcePage: string | null = null;
  if (typeof body.source_page === "string") {
    const rawSourcePage = body.source_page.trim();
    if (rawSourcePage) {
      try {
        const parsed = new URL(rawSourcePage);
        if (parsed.origin === ALLOWED_ORIGIN) {
          sourcePage = `${parsed.origin}${parsed.pathname}`;
        }
      } catch {
        sourcePage = null;
      }
    }
  }

  if (
    !email || email.length > MAX_EMAIL_LEN || !permissiveEmailValid(email) ||
    !ALLOWED_CATEGORIES.has(category) ||
    !message || message.length > MAX_MESSAGE_LEN ||
    (name !== null && name.length > MAX_NAME_LEN)
  ) {
    return new Response("bad request", { status: 400, headers: corsHeaders() });
  }

  const userAgent = request.headers.get("user-agent");
  const xff = request.headers.get("x-forwarded-for");
  const clientIpHash = await hashIp(xff);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Rate limit (skip if no IP hash derivable)
  if (clientIpHash) {
    const since = new Date(
      Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
    ).toISOString();
    const { count, error: rateErr } = await supabase
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_ip_hash", clientIpHash)
      .gte("created_at", since);

    if (rateErr) {
      console.error("support: rate-limit query failed", rateErr);
      return new Response("server error", { status: 500, headers: corsHeaders() });
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response("too many requests, try again later", {
        status: 429,
        headers: corsHeaders(),
      });
    }
  }

  // Insert
  const { data: inserted, error: insertErr } = await supabase
    .from("support_requests")
    .insert({
      name,
      email,
      category,
      message,
      source_page: sourcePage,
      user_agent: userAgent,
      client_ip_hash: clientIpHash,
    })
    .select("id, created_at")
    .single();

  if (insertErr || !inserted) {
    console.error("support: insert failed", insertErr);
    return new Response("server error", { status: 500, headers: corsHeaders() });
  }

  // Slack webhook — non-blocking with 5s timeout
  try {
    const messagePreview = message.slice(0, 500);
    const uaPreview = (userAgent ?? "").slice(0, 120);
    const slackPayload = {
      text: `New REPS support ticket — ${category}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "🎫 New REPS support ticket" },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Category:*\n${escapeSlack(category)}` },
            {
              type: "mrkdwn",
              text: `*From:*\n${escapeSlack(name ?? "(no name)")} ${escapeSlack(email)}`,
            },
            {
              type: "mrkdwn",
              text: `*Page:*\n${escapeSlack(sourcePage ?? "(unknown)")}`,
            },
            { type: "mrkdwn", text: `*Ticket ID:*\n\`${inserted.id}\`` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Message:*\n>${escapeSlack(messagePreview)}`,
          },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `UA: ${escapeSlack(uaPreview)}` },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const slackRes = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
        signal: controller.signal,
      });
      if (!slackRes.ok) {
        console.error("support: slack webhook non-2xx", slackRes.status);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.error("support: slack webhook threw (may be AbortError on 5s timeout)", e);
  }

  return new Response(
    JSON.stringify({ ok: true, id: inserted.id, created_at: inserted.created_at }),
    {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    },
  );
}
