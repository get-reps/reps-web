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
  type Viewer,
  checkCode,
  corsHeaders,
  escapeSlack,
  geoOf,
  issueSession,
  json,
  normaliseEmail,
  notifySlack,
  readLink,
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
  let requestedFrom: string | null = null;

  if (typeof body.token === "string" && body.token.length > 0) {
    const link = await readLink(gateSecret, body.token);
    if (!link) return json({ ok: false, error: "link_expired" }, { status: 401 });
    email = link.email;
    requestedFrom = link.requestedFrom;
    via = "link";
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

  const viewer: Viewer = { e: email, geo, t: Date.now(), via };
  if (requestedFrom) viewer.rg = requestedFrom;

  if (via === "code") {
    /* A typed code means a person with the inbox open. Announce it now, and mark
       the session as already announced so the first-read beacon stays quiet. */
    viewer.c = 1;
    await notifySlack({
      text: `Angel deck: opened by ${email}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "*Angel deck* — someone is reading it" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Email:*\n${escapeSlack(email)}` },
            { type: "mrkdwn", text: `*From:*\n${escapeSlack(geo)}` },
            { type: "mrkdwn", text: "*Entry:*\ntyped the code" },
          ],
        },
        { type: "context", elements: [{ type: "mrkdwn", text: escapeSlack(uaOf(request)) }] },
      ],
    });
  } else {
    /* A followed link is NOT yet a reader. On 2026-09-28 one investor's email
       produced six link unlocks from Google/AWS/Microsoft data-centre towns
       (Council Bluffs, Boardman, Washington, Cardiff) — his mail filter checking
       the link — none of which ever left the cover slide. So this line is
       labelled as probable noise, and the real "someone is reading it" alert is
       sent by /api/deck-open once the viewer moves past the cover. */
    await notifySlack({
      text: `Angel deck: link check for ${email} from ${geo} (probably an email scanner)`,
      blocks: [
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                `:mag: Link opened for ${escapeSlack(email)} from ${escapeSlack(geo)}. ` +
                "Probably an email security scanner checking the link, so you can ignore this. " +
                "You will get a proper alert if someone reads past the cover.",
            },
          ],
        },
      ],
    });
  }

  const token = await issueSession(gateSecret, viewer);

  return json(
    { ok: true, email },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
}
