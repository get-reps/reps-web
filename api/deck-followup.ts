/* ============================================================================
   GET /api/deck-followup  ->  the 30-minute sweep (Vercel cron, every 5 minutes)
   ----------------------------------------------------------------------------
   Replies in the Slack thread of every deck alert that is at least 30 minutes
   old and has not been answered. See lib/deck-followup.ts for the rules.

   Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls. With no
   CRON_SECRET configured the route refuses everything, so it can never be
   triggered by a stranger. `?dry=1` (or DECK_FOLLOWUP_DRY_RUN=1) logs what
   would be posted and posts nothing.
   ========================================================================== */
import { json, safeEqual } from "../lib/deck-gate.js";
import { runSweep } from "../lib/deck-followup.js";
import { createSlackThreadPoster, storeFromEnv } from "../lib/deck-visit-store.js";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return json({ ok: false, error: "misconfigured" }, { status: 500 });
  const supplied = request.headers.get("authorization") ?? "";
  if (!safeEqual(supplied, `Bearer ${cronSecret}`)) {
    return json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const store = storeFromEnv();
  const token = process.env.SLACK_SUPPORT_BOT_TOKEN;
  if (!store || !token) return json({ ok: false, error: "not_configured" }, { status: 503 });

  const dryRun =
    new URL(request.url).searchParams.get("dry") === "1" || process.env.DECK_FOLLOWUP_DRY_RUN === "1";

  try {
    const result = await runSweep({ store, post: createSlackThreadPoster({ token }), dryRun });
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("deck-followup: sweep failed", e);
    return json({ ok: false, error: "sweep_failed" }, { status: 500 });
  }
}
