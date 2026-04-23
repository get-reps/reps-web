export const runtime = "edge";

// Support form ingress — receives submissions from /support and relays
// them as structured email to support@getreps.io via Resend. Edge runtime
// so it boots fast and doesn't hold a cold-start tax per region.
//
// Required env var (set in Vercel dashboard):
//   RESEND_API_KEY — API key from https://resend.com/api-keys
//
// Optional env var:
//   SUPPORT_FROM — verified sender for Resend (default: "support@getreps.io").
//                  The domain must be verified in Resend's dashboard.

type SupportPayload = {
  name?: unknown;
  email?: unknown;
  category?: unknown;
  message?: unknown;
  page?: unknown;
  userAgent?: unknown;
};

type ValidatedPayload = {
  name: string;
  email: string;
  category: string;
  message: string;
  page: string;
  userAgent: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug report",
  feature: "Feature request",
  account: "Account or billing",
  "chrome-extension": "Chrome extension",
  privacy: "Privacy or data",
  other: "Something else",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://getreps.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

function isString(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isEmail(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    // Deliberately permissive — the reply attempt is what actually validates
    // deliverability. This only rejects obvious nonsense.
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function validate(body: SupportPayload): ValidatedPayload | null {
  if (!isEmail(body.email)) return null;
  if (!isString(body.category, 40)) return null;
  if (!CATEGORY_LABELS[body.category as string]) return null;
  if (!isString(body.message, 4000)) return null;

  const name =
    typeof body.name === "string" && body.name.length <= 100 ? body.name : "";
  const page =
    typeof body.page === "string" && body.page.length <= 500 ? body.page : "";
  const userAgent =
    typeof body.userAgent === "string" && body.userAgent.length <= 500
      ? body.userAgent
      : "";

  return {
    name: name.trim(),
    email: (body.email as string).trim(),
    category: body.category as string,
    message: (body.message as string).trim(),
    page: page.trim(),
    userAgent: userAgent.trim(),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(payload: ValidatedPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const categoryLabel = CATEGORY_LABELS[payload.category] ?? payload.category;
  const nameLine = payload.name || "(no name given)";
  const subject = `[REPS support] ${categoryLabel} — ${payload.email}`;

  const text = [
    `Category: ${categoryLabel}`,
    `From:     ${nameLine} <${payload.email}>`,
    payload.page ? `Page:     ${payload.page}` : null,
    payload.userAgent ? `Agent:    ${payload.userAgent}` : null,
    "",
    "Message:",
    payload.message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2C3E50; max-width: 640px; padding: 16px;">
      <h2 style="color: #FF6B6B; margin: 0 0 16px 0; font-size: 18px;">New REPS support message</h2>
      <table style="border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #8B95A1;">Category</td><td style="padding: 4px 0;">${escapeHtml(categoryLabel)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #8B95A1;">From</td><td style="padding: 4px 0;">${escapeHtml(nameLine)} &lt;${escapeHtml(payload.email)}&gt;</td></tr>
        ${payload.page ? `<tr><td style="padding: 4px 12px 4px 0; color: #8B95A1;">Page</td><td style="padding: 4px 0;">${escapeHtml(payload.page)}</td></tr>` : ""}
        ${payload.userAgent ? `<tr><td style="padding: 4px 12px 4px 0; color: #8B95A1;">Agent</td><td style="padding: 4px 0; word-break: break-all;">${escapeHtml(payload.userAgent)}</td></tr>` : ""}
      </table>
      <div style="border-top: 1px solid #EAEAEA; padding-top: 16px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(payload.message)}</div>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return new Response("support form not configured", {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  const from = process.env.SUPPORT_FROM ?? "support@getreps.io";
  const to = "support@getreps.io";

  let body: SupportPayload;

  try {
    body = (await request.json()) as SupportPayload;
  } catch {
    return new Response("invalid json", { status: 400, headers: CORS_HEADERS });
  }

  const payload = validate(body);

  if (!payload) {
    return new Response("missing or invalid fields", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const email = renderEmail(payload);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `REPS Support <${from}>`,
      to: [to],
      reply_to: payload.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    console.error("resend failed", resendResponse.status, detail);

    return new Response("relay failed", {
      status: 502,
      headers: CORS_HEADERS,
    });
  }

  return new Response("ok", { status: 200, headers: CORS_HEADERS });
}
