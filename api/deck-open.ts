/* ============================================================================
   POST /api/deck-open  ->  "this deck just moved somewhere new"
   ----------------------------------------------------------------------------
   Mike's specific ask: know when the place that OPENED the gate is not the place
   that is READING it. That is the forwarding signal — a partner sends the deck
   round the fund, and this is what makes it visible.

   Why place and not IP. A phone changes IP constantly as it moves between cell
   and wifi, so an IP comparison would fire on nearly every genuine viewer and
   the alert would be worth nothing within a day. A city/country change is a
   thing that actually happened. Nothing here stores an IP address.

   Dedupe lives in the cookie: once a place has been reported it is appended to
   the session, so re-reading from the same new city is silent.
   ========================================================================== */
import {
  SESSION_COOKIE,
  corsHeaders,
  escapeSlack,
  geoOf,
  issueSession,
  json,
  notifySlack,
  readCookie,
  readSession,
  secret,
  sessionCookie,
  uaOf,
} from "../lib/deck-gate.js";

export const runtime = "edge";

/** Keep the cookie small; a viewer who genuinely reads from ten places has
    already told us everything the signal was going to tell us. */
const MAX_SEEN = 10;

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const gateSecret = secret();
  if (!gateSecret) return json({ ok: false }, { status: 500 });

  const viewer = await readSession(gateSecret, readCookie(request, SESSION_COOKIE));
  /* No session is not an error — it is someone who has not been through the
     gate yet, or who cleared cookies. The page handles that by showing the gate. */
  if (!viewer) return json({ ok: true, known: false });

  const here = geoOf(request);
  const seen = Array.isArray(viewer.s) ? viewer.s : [];

  if (here === viewer.geo || here === "unknown" || seen.includes(here)) {
    return json({ ok: true, known: true });
  }

  await notifySlack({
    text: `Angel deck: ${viewer.e} is reading it from a new place (${here})`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: "*Angel deck* — being read somewhere new" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Opened by:*\n${escapeSlack(viewer.e)}` },
          { type: "mrkdwn", text: `*Unlocked from:*\n${escapeSlack(viewer.geo)}` },
          { type: "mrkdwn", text: `*Reading from:*\n${escapeSlack(here)}` },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Usually means the deck was forwarded, or they travelled. " + escapeSlack(uaOf(request)),
          },
        ],
      },
    ],
  });

  const next = { ...viewer, s: [...seen, here].slice(-MAX_SEEN) };
  return json(
    { ok: true, known: true },
    { headers: { "Set-Cookie": sessionCookie(await issueSession(gateSecret, next)) } },
  );
}
