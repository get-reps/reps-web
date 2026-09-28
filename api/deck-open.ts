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

   Second job, {engaged: true}: the page sends this once the viewer moves past
   the cover. That is the first proof a PERSON is reading a link-unlocked
   session (mail-filter link checkers never leave slide 1), so it is where the
   real "someone is reading it" alert for a link unlock comes from. It also
   carries the forwarding check the per-browser comparison above cannot make:
   a forwarded link opens a brand-new session whose baseline is wherever the
   forwardee is, so the only honest comparison is against where the link was
   REQUESTED — which the link itself carries (`rg`).
   ========================================================================== */
import {
  type Viewer,
  SESSION_COOKIE,
  corsHeaders,
  escapeSlack,
  geoOf,
  issueSession,
  json,
  notifySlack,
  placeDiffers,
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

  let body: { engaged?: unknown } = {};
  try {
    body = ((await request.json()) as typeof body | null) ?? {};
  } catch {
    /* An empty body is the plain page-load beacon — not an error. */
  }

  const viewer = await readSession(gateSecret, readCookie(request, SESSION_COOKIE));
  /* No session is not an error — it is someone who has not been through the
     gate yet, or who cleared cookies. The page handles that by showing the gate. */
  if (!viewer) return json({ ok: true, known: false });

  const here = geoOf(request);
  let next = viewer;

  if (body.engaged === true) {
    /* Only link unlocks wait for this; code unlocks and pre-2026-09-28 sessions
       were announced at unlock and carry no `via: "link"`. */
    if (viewer.via === "link" && !viewer.c) {
      const moved = placeDiffers(viewer.rg, here);
      const sent = await notifySlack({
        text: moved
          ? `Angel deck: ${escapeSlack(viewer.e)}'s link is being read in ${escapeSlack(here)}, but was requested from ${escapeSlack(viewer.rg ?? "")} — possibly forwarded`
          : `Angel deck: ${escapeSlack(viewer.e)} is reading it (${escapeSlack(here)})`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: moved
                ? "*Angel deck* — :warning: possibly forwarded"
                : "*Angel deck* — someone is reading it",
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Email:*\n${escapeSlack(viewer.e)}` },
              { type: "mrkdwn", text: `*Reading from:*\n${escapeSlack(here)}` },
              { type: "mrkdwn", text: `*Link requested from:*\n${escapeSlack(viewer.rg ?? "not recorded")}` },
              { type: "mrkdwn", text: "*Entry:*\none-click link, read past the cover" },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text:
                  (moved
                    ? "Their link was opened somewhere other than where they asked for it. Usually a forward, sometimes travel or a phone on mobile data. "
                    : "") + escapeSlack(uaOf(request)),
              },
            ],
          },
        ],
      });
      /* Only mark it announced if Slack took it. For a link unlock this is the
         ONLY "someone is reading it" alert, so a Slack blip must mean "try
         again on the next read", never a reader who is silently never reported. */
      if (sent) next = { ...next, c: 1 };
    }
    return finish(gateSecret, viewer, next);
  }

  const seen = Array.isArray(viewer.s) ? viewer.s : [];
  if (here === viewer.geo || here === "unknown" || seen.includes(here)) {
    return finish(gateSecret, viewer, next);
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

  next = { ...next, s: [...seen, here].slice(-MAX_SEEN) };
  return finish(gateSecret, viewer, next);
}

/** Returns the viewer's address so the page can label every slide "Prepared for
    <email>" on a return visit too (the cookie is HttpOnly, so the page cannot
    read it itself). Only re-issues the cookie when something changed. */
async function finish(gateSecret: string, before: Viewer, after: Viewer): Promise<Response> {
  if (after === before) return json({ ok: true, known: true, email: before.e });
  return json(
    { ok: true, known: true, email: after.e },
    { headers: { "Set-Cookie": sessionCookie(await issueSession(gateSecret, after)) } },
  );
}
