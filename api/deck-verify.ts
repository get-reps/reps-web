/* ============================================================================
   POST /api/deck-verify  {email, code} | {token}  ->  opens the gate
   ----------------------------------------------------------------------------
   Step two. Accepts either the six-character code the viewer retyped or the
   signed token from the one-click link (which is also how a pre-authorised
   invite arrives, having sent no email at all).

   On success it issues a 90-day session cookie carrying the address and the
   PLACE the gate was opened from. That place is the baseline every later open is
   compared against in /api/deck-open — which is how forwarding shows up.
   ========================================================================== */
import {
  checkCode,
  checkLink,
  corsHeaders,
  escapeSlack,
  geoOf,
  issueSession,
  json,
  normaliseEmail,
  notifySlack,
  secret,
  sessionCookie,
  uaOf,
} from "../lib/deck-gate.js";

export const runtime = "edge";

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const gateSecret = secret();
  if (!gateSecret) {
    console.error("deck-verify: DECK_GATE_SECRET missing");
    return json({ ok: false, error: "misconfigured" }, { status: 500 });
  }

  let body: { email?: unknown; code?: unknown; token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const geo = geoOf(request);
  let email: string | null = null;
  let via: "link" | "code" = "code";

  if (typeof body.token === "string" && body.token.length > 0) {
    email = await checkLink(gateSecret, body.token);
    via = "link";
    if (!email) return json({ ok: false, error: "link_expired" }, { status: 401 });
  } else {
    email = normaliseEmail(body.email);
    if (!email) return json({ ok: false, error: "bad_email" }, { status: 400 });
    if (typeof body.code !== "string") return json({ ok: false, error: "bad_code" }, { status: 400 });
    if (!(await checkCode(gateSecret, email, body.code))) {
      /* Deliberately one message for "wrong" and "expired". Distinguishing them
         tells someone guessing which addresses have live codes. */
      return json({ ok: false, error: "bad_code" }, { status: 401 });
    }
  }

  const token = await issueSession(gateSecret, { e: email, geo, t: Date.now() });

  await notifySlack({
    text: `Angel deck: opened by ${email}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: "*Angel deck* — someone is reading it" } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Email:*\n${escapeSlack(email)}` },
          { type: "mrkdwn", text: `*From:*\n${escapeSlack(geo)}` },
          { type: "mrkdwn", text: `*Entry:*\n${via === "link" ? "one-click link" : "typed the code"}` },
        ],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: escapeSlack(uaOf(request)) }] },
    ],
  });

  return json(
    { ok: true, email },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
}
