/* ============================================================================
   POST /api/deck-comments  ->  a reviewer sends Mike their whole markup
   ----------------------------------------------------------------------------
   The review-circle lane: an advisor walks the deck, pins notes to specific
   things, and presses Send once. This delivers the set to Slack (immediate) and
   to Mike's inbox (durable, readable on a phone, survives Slack scroll).

   EVERY PINNED NOTE CARRIES A LINK BACK TO THE SPOT. The first version printed
   the raw coordinate ("pinned at 88%, 67%"), which is a fine machine
   representation and useless to a person — nobody can picture 88% of a slide, so
   the one thing the pin existed to communicate did not survive the trip. Mike,
   reading the first real notes email: "how can I review it after, knowing where
   the pin was as a human?" The link opens the deck on that slide and draws the
   pin exactly where the reviewer put it. Position travels IN the URL, so it needs
   no storage and points at the REAL slide rather than a picture of one.

   Requires a session, so only someone who has been through the gate can post.
   ========================================================================== */
import {
  SESSION_COOKIE,
  corsHeaders,
  escapeSlack,
  geoOf,
  json,
  notifySlack,
  readCookie,
  readSession,
  secret,
} from "../lib/deck-gate.js";

export const runtime = "edge";

const MAX_COMMENTS = 200;
const MAX_LEN = 2000;
const TO = "mike@getreps.io";
const FROM = "REPS deck <mike@getreps.io>";
const DECK_URL = "https://www.getreps.io/angel";

type Incoming = {
  slide?: unknown;
  slideIndex?: unknown;
  /** percentage across the 1920x1080 stage, or absent for a whole-slide note */
  x?: unknown;
  y?: unknown;
  text?: unknown;
};

type Clean = { slide: string; index: number; x: number | null; y: number | null; text: string };

function clean(list: unknown): Clean[] {
  if (!Array.isArray(list)) return [];
  const out: Clean[] = [];
  for (const raw of list.slice(0, MAX_COMMENTS)) {
    const c = raw as Incoming;
    const text = typeof c.text === "string" ? c.text.trim().slice(0, MAX_LEN) : "";
    if (!text) continue;
    out.push({
      slide: typeof c.slide === "string" ? c.slide.slice(0, 120) : "(unnamed slide)",
      index: typeof c.slideIndex === "number" && Number.isFinite(c.slideIndex) ? c.slideIndex : 0,
      x: typeof c.x === "number" && Number.isFinite(c.x) ? Math.round(c.x) : null,
      y: typeof c.y === "number" && Number.isFinite(c.y) ? Math.round(c.y) : null,
      text,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

function groupBySlide(list: Clean[]): Array<{ slide: string; index: number; items: Clean[] }> {
  const groups: Array<{ slide: string; index: number; items: Clean[] }> = [];
  for (const c of list) {
    const last = groups[groups.length - 1];
    if (last && last.index === c.index) last.items.push(c);
    else groups.push({ slide: c.slide, index: c.index, items: [c] });
  }
  return groups;
}

/** Opens the deck on that slide, with the pin drawn where the reviewer put it. */
function linkFor(c: Clean): string {
  if (c.x === null || c.y === null) return `${DECK_URL}#${c.index}`;
  return `${DECK_URL}?pin=${c.index}:${c.x},${c.y}#${c.index}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emailHtml(from: string, groups: ReturnType<typeof groupBySlide>, total: number): string {
  const body = groups
    .map((g) => {
      const items = g.items
        .map((c) => {
          const label = c.x !== null && c.y !== null ? "Show me on the slide" : "Open this slide";
          return `<li style="margin-bottom:16px;line-height:1.5;">
            ${esc(c.text).replace(/\n/g, "<br/>")}<br/>
            <a href="${linkFor(c)}" style="color:#D8443F;font-size:13px;text-decoration:none;font-weight:600;">${label} &rarr;</a>
          </li>`;
        })
        .join("");
      return `<tr><td style="padding-bottom:24px;">
        <div style="font-family:Georgia,serif;font-size:19px;color:#211A14;padding-bottom:8px;">${g.index}. ${esc(g.slide)}</div>
        <ul style="margin:0;padding-left:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:#4A423C;">${items}</ul>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#FFFAF7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFAF7;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="font-family:Georgia,serif;font-size:28px;color:#211A14;padding-bottom:6px;">${total} note${total === 1 ? "" : "s"} on the deck</td></tr>
  <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:#8A7F76;padding-bottom:26px;">from ${esc(from)} &middot; each link opens the deck with the pin on it</td></tr>
  ${body}
</table></td></tr></table></body></html>`;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  const gateSecret = secret();
  if (!gateSecret) return json({ ok: false, error: "misconfigured" }, { status: 500 });

  const viewer = await readSession(gateSecret, readCookie(request, SESSION_COOKIE));
  if (!viewer) return json({ ok: false, error: "not_unlocked" }, { status: 401 });

  let body: { comments?: unknown };
  try {
    body = (await request.json()) as { comments?: unknown };
  } catch {
    return json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const comments = clean(body.comments);
  if (!comments.length) return json({ ok: false, error: "empty" }, { status: 400 });

  const groups = groupBySlide(comments);

  await notifySlack({
    text: `Angel deck: ${comments.length} note(s) from ${viewer.e}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Angel deck* — ${comments.length} note${comments.length === 1 ? "" : "s"} from ${escapeSlack(viewer.e)}`,
        },
      },
      ...groups.slice(0, 20).map((g) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${g.index}. ${escapeSlack(g.slide)}*\n` +
            g.items
              .map(
                (c) =>
                  `> ${escapeSlack(c.text.slice(0, 500)).replace(/\n/g, "\n> ")}\n> <${linkFor(c)}|${c.x !== null ? "show me on the slide" : "open this slide"}>`,
              )
              .join("\n"),
        },
      })),
      { type: "context", elements: [{ type: "mrkdwn", text: escapeSlack(geoOf(request)) }] },
    ],
  });

  /* The email is the copy that survives. Slack is where he notices; the inbox is
     where he can still find it next week. A failure here is logged and reported
     but does not fail the request — the notes are already in Slack, and telling a
     reviewer their feedback vanished when it did not is worse than a quiet retry. */
  const resendKey = process.env.RESEND_API_KEY;
  let emailed = false;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          reply_to: viewer.e,
          subject: `Deck notes from ${viewer.e} (${comments.length})`,
          html: emailHtml(viewer.e, groups, comments.length),
          tags: [{ name: "surface", value: "angel_deck_comments" }],
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("deck-comments: resend", res.status);
    } catch (e) {
      console.error("deck-comments: resend threw", e);
    }
  }

  return json({ ok: true, received: comments.length, emailed });
}
