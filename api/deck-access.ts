/* ============================================================================
   POST /api/deck-access  {email}  ->  emails a 6-character code + a one-click link
   ----------------------------------------------------------------------------
   Step one of the Angel-deck gate. Stateless: the code is derived from the
   address, never stored, so there is no per-viewer row and no ceiling on how
   many people can be let in. The only cost is one email per person, once —
   after that they hold a 90-day session cookie and never see this again.

   Pre-authorised invite links (issued by scripts/deck-invite.mjs) skip this
   route entirely and send nothing, which is the zero-email lane for the named
   list.
   ========================================================================== */
import {
  corsHeaders,
  escapeSlack,
  geoOf,
  issueCode,
  issueLink,
  json,
  normaliseEmail,
  notifySlack,
  readCookie,
  secret,
  uaOf,
} from "../lib/deck-gate.js";

export const runtime = "edge";

const DECK_URL = "https://www.getreps.io/angel";
const FROM = "Mike at REPS <mike@getreps.io>";
const REPLY_TO = "mike@getreps.io";

/* Soft abuse guard. This endpoint spends real money (email) on an unauthenticated
   caller, so it cannot be wide open — but a stateless edge function has nowhere
   to count. The honest position: the origin check stops casual scripted abuse,
   the cookie throttle stops a stuck retry loop and an impatient human, and the
   Slack ping on EVERY request means Mike sees a flood within seconds rather than
   discovering it in a bill. A determined attacker who drops cookies defeats the
   throttle; that residual risk is accepted for an audience of this size and is
   written down in the work trail rather than left implied. */
const THROTTLE_COOKIE = "reps_deck_rq";
const THROTTLE_MAX = 5;
const THROTTLE_WINDOW_MS = 60 * 60 * 1000;

function throttleState(request: Request, now: number): { count: number; since: number } {
  const raw = readCookie(request, THROTTLE_COOKIE);
  if (!raw) return { count: 0, since: now };
  const [c, s] = raw.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(c) || !Number.isFinite(s) || now - s > THROTTLE_WINDOW_MS) {
    return { count: 0, since: now };
  }
  return { count: c, since: s };
}

function throttleCookie(count: number, since: number): string {
  const ttl = Math.ceil(THROTTLE_WINDOW_MS / 1000);
  return `${THROTTLE_COOKIE}=${count}-${since}; Path=/api; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`;
}

function sameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts may omit it
  return /^https:\/\/(www\.)?getreps\.io$/.test(origin);
}

/* Two registers, per EMAIL_CRAFT: Lora for the headline, system sans for
   everything the reader acts on. One primary button, fixed geometry. No Echo on
   an outward email. The sign-off is the website line, never the in-app motto —
   an inbox is external, so it is "Save anything. Remember everything." */
function emailHtml(code: string, link: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FFFAF7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFAF7;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
  <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#211A14;padding-bottom:16px;">
    Your access to the REPS deck
  </td></tr>
  <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#4A423C;padding-bottom:28px;">
    Enter this code on the page you just came from:
  </td></tr>
  <tr><td align="center" style="padding-bottom:28px;">
    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;letter-spacing:0.22em;font-weight:600;color:#211A14;background:#FFFFFF;border:1px solid #EADFD6;border-radius:14px;padding:20px 24px 20px 30px;">${code}</div>
  </td></tr>
  <tr><td align="center" style="padding-bottom:28px;">
    <a href="${link}" style="display:inline-block;background:#FF6B6B;color:#FFFFFF;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;padding:15px 34px;border-radius:999px;">Open the deck</a>
  </td></tr>
  <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#8A7F76;padding-bottom:28px;">
    The code lasts an hour. The button works for a week, on any device.
  </td></tr>
  <tr><td style="border-top:1px solid #EADFD6;padding-top:20px;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#8A7F76;">
    REPS &middot; Save anything. Remember everything.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function emailText(code: string, link: string): string {
  return [
    "Your access to the REPS deck",
    "",
    `Code: ${code}`,
    "",
    `Or open it directly: ${link}`,
    "",
    "The code lasts an hour. The link works for a week, on any device.",
    "",
    "REPS - Save anything. Remember everything.",
  ].join("\n");
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const gateSecret = secret();
  const resendKey = process.env.RESEND_API_KEY;
  if (!gateSecret || !resendKey) {
    console.error("deck-access: missing env", {
      secret: Boolean(gateSecret),
      resend: Boolean(resendKey),
    });
    return json({ ok: false, error: "misconfigured" }, { status: 500 });
  }

  if (!sameSite(request)) return json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const email = normaliseEmail(body.email);
  if (!email) return json({ ok: false, error: "bad_email" }, { status: 400 });

  const now = Date.now();
  const t = throttleState(request, now);
  if (t.count >= THROTTLE_MAX) {
    return json(
      { ok: false, error: "too_many" },
      { status: 429, headers: { "Set-Cookie": throttleCookie(t.count, t.since) } },
    );
  }

  const code = await issueCode(gateSecret, email, now);
  const link = `${DECK_URL}?t=${encodeURIComponent(await issueLink(gateSecret, email, now))}`;
  const geo = geoOf(request);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: REPLY_TO,
      subject: "Your access code for the REPS deck",
      html: emailHtml(code, link),
      text: emailText(code, link),
      tags: [{ name: "surface", value: "angel_deck_gate" }],
    }),
  });

  if (!res.ok) {
    /* Never silently swallow this: a viewer staring at a screen that says "check
       your inbox" when nothing was sent is exactly the silent-partial-success
       class CLAUDE.md §21 exists to catch. Tell the caller, and page Slack. */
    const detail = await res.text().catch(() => "");
    console.error("deck-access: resend failed", res.status, detail.slice(0, 300));
    await notifySlack({
      text: `Angel deck: FAILED to send access code to ${email} (Resend ${res.status})`,
    });
    return json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  await notifySlack({
    text: `Angel deck: access code requested by ${email}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Angel deck* — access code requested` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Email:*\n${escapeSlack(email)}` },
          { type: "mrkdwn", text: `*From:*\n${escapeSlack(geo)}` },
        ],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: escapeSlack(uaOf(request)) }] },
    ],
  });

  return json(
    { ok: true },
    { headers: { "Set-Cookie": throttleCookie(t.count + 1, t.since) } },
  );
}
