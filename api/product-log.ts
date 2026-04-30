export const runtime = "edge";

const ALLOWED_ORIGIN = "https://getreps.io";
const MAX_EMAIL_LEN = 200;

type LogBody = {
  email?: unknown;
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

function permissiveEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const slackWebhookUrl = process.env.SLACK_SUPPORT_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    return new Response("misconfigured", { status: 500, headers: corsHeaders() });
  }

  let body: LogBody;
  try {
    body = (await request.json()) as LogBody;
  } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders() });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > MAX_EMAIL_LEN || !permissiveEmailValid(email)) {
    return new Response("bad request", { status: 400, headers: corsHeaders() });
  }

  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 200);
  const referer = request.headers.get("referer") ?? "(unknown)";
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ipHint = xff.split(",")[0]?.trim() || "(no ip)";

  const slackPayload = {
    text: `Product roadmap viewed by ${email}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "👀 Product roadmap viewed" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Email:*\n${escapeSlack(email)}` },
          { type: "mrkdwn", text: `*Page:*\n${escapeSlack(referer)}` },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `UA: ${escapeSlack(userAgent)}` },
          { type: "mrkdwn", text: `IP hint: ${escapeSlack(ipHint)}` },
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
      console.error("product-log: slack non-2xx", slackRes.status);
    }
  } catch (e) {
    console.error("product-log: slack threw", e);
  } finally {
    clearTimeout(timeoutId);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
