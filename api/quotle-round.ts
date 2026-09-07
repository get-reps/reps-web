import { createClient } from "@supabase/supabase-js";

// Today's Quotle round for the public web game at getreps.io/play/quotle.
//
// WHY THIS EXISTS. play/quotle.html was a frozen demo with one quote written into
// the markup, so the web game showed the same Edison line forever while the app
// served a fresh quote every day. This route is the seam: it calls the SAME
// production function the app calls (`get_verbatim_round`), so the page and the
// app cannot drift, and nobody hand-edits an HTML file every morning.
//
// WHY IT IS A SERVER ROUTE AND NOT A CLIENT FETCH. `get_verbatim_round` is granted
// to `authenticated` only — anon is explicitly revoked — and the web game has no
// signed-in user. The service-role key satisfies the grant, and a service-role key
// may only ever live on the server. It is read here, used here, and NEVER appears
// in any response body: the payload below is rebuilt field by field for exactly
// that reason, rather than passing the RPC's object through.
//
// Follows api/resolve.ts: edge runtime, env-supplied Supabase credentials, and a
// path that never throws at the visitor.
export const runtime = "edge";

/**
 * Mirrors `verbatim_rounds.quote_text`'s own CHECK (1..400). It can only fire if
 * something wrote past that constraint, and then the right answer is the page's
 * fallback rather than a board of 900 tiles.
 */
const MAX_QUOTE_CHARS = 400;

/** What the page renders. A deliberately NARROW subset of the RPC's payload. */
export interface QuotleRoundPayload {
  available: true;
  tier: "published" | "reserve" | "rerun";
  is_rerun: boolean;
  effective_date: string;
  quote: {
    text: string;
    author: string;
    /** Echo's take — the paragraph under the quote on the win/loss screens. */
    context: string;
    question: string;
    on_this_day: { month: number; day: number; year: number | null } | null;
    read_more: { title: string; url: string; host: string };
  };
}

export interface QuotleRoundUnavailable {
  available: false;
  /**
   * Why there is no round. Bounded, and none of it derived from the request.
   * `none` is the bank saying it has nothing; the rest are our own failures, and
   * they stay distinguishable because each implies a different fix — the page
   * falls back identically for all of them, which is exactly why the distinction
   * has to survive somewhere a human can read it.
   */
  reason: "none" | "not_configured" | "rpc_error" | "unusable_payload";
}

function json(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}

/**
 * The date asked of the RPC: the server's own UTC calendar day.
 *
 * The app sends the player's LOCAL date (it has one); a static web page shared by
 * every timezone does not, and taking one from the browser would let a modified
 * client walk the date forward. The RPC clamps to +/- 1 day regardless, so
 * UTC-today is both the honest value and the one that gives every web player the
 * same quote on the same day.
 */
export function utcToday(now: Date = new Date()): string {
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Does this text build any tiles at all? Mirrors `verbatimQuoteIsPlayable` in
 * reps-app lib/verbatim/round.ts. A quote with no A-Z is not a hard round, it is
 * an empty board.
 */
function isPlayable(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/**
 * Narrow the RPC's untyped jsonb to the payload the page renders, or null when it
 * is not usable.
 *
 * VALIDATED, NOT CAST, and rebuilt field by field. Two reasons, both load-bearing:
 * the value crosses the wire as jsonb, so `available: true` carrying a malformed
 * quote is a reachable state (a later edit to the SQL, a null in the wrong place);
 * and building the result explicitly is what guarantees no field we did not intend
 * — `verified` (a reviewer's private evidence note, never rendered to a player),
 * `round_id`, `set_id` — can ride along into a public response.
 */
export function toQuotleRoundPayload(raw: unknown): QuotleRoundPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const round = raw as Record<string, unknown>;
  if (round.available !== true) return null;

  const tier = round.tier;
  if (tier !== "published" && tier !== "reserve" && tier !== "rerun") return null;
  if (typeof round.is_rerun !== "boolean") return null;

  const effectiveDate = str(round.effective_date);
  if (!effectiveDate) return null;

  const quote = round.quote;
  if (!quote || typeof quote !== "object") return null;
  const q = quote as Record<string, unknown>;

  const text = str(q.text);
  const author = str(q.author);
  const context = str(q.context);
  const question = str(q.question);
  if (!text || !author || !context || !question) return null;
  if (text.length > MAX_QUOTE_CHARS || !isPlayable(text)) return null;

  const readMoreRaw = q.read_more;
  if (!readMoreRaw || typeof readMoreRaw !== "object") return null;
  const rm = readMoreRaw as Record<string, unknown>;
  const rmTitle = str(rm.title);
  const rmUrl = str(rm.url);
  const rmHost = str(rm.host);
  if (!rmTitle || !rmUrl || !rmHost) return null;
  // The page puts this straight into an href. The table already requires https,
  // and this is the boundary that has to hold whether or not it still does.
  if (!/^https:\/\//i.test(rmUrl)) return null;

  // A reserve has no calendar hook, so a missing anniversary is normal and must
  // not disqualify the round. A HALF-PRESENT one is a malformed row, and is
  // dropped rather than rendered as a partial date.
  let onThisDay: QuotleRoundPayload["quote"]["on_this_day"] = null;
  const anniversary = q.on_this_day;
  if (anniversary && typeof anniversary === "object") {
    const a = anniversary as Record<string, unknown>;
    const month = int(a.month);
    const day = int(a.day);
    const year = int(a.year);
    if (month !== null && day !== null && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      onThisDay = { month, day, year };
    }
  }

  return {
    available: true,
    tier,
    is_rerun: round.is_rerun,
    effective_date: effectiveDate,
    quote: {
      text,
      author,
      context,
      question,
      on_this_day: onThisDay,
      read_more: { title: rmTitle, url: rmUrl, host: rmHost },
    },
  };
}

/**
 * Every no-round path warns. The page falls back to a compiled-in quote, so a
 * broken route produces no error, no complaint and no visible symptom — "the web
 * game quietly stopped being daily" is precisely the failure that hides for weeks
 * (reps-app CLAUDE.md §21a). So it is said out loud in the log AND named in the
 * body, which is what a human sees on opening /api/quotle-round in a browser.
 */
function unavailable(
  reason: QuotleRoundUnavailable["reason"],
  status: number,
  cacheControl: string,
  detail?: unknown,
): Response {
  console.error(
    JSON.stringify({
      event: "quotle_round_unavailable",
      reason,
      detail: detail === undefined ? null : String(detail),
    }),
  );
  const body: QuotleRoundUnavailable = { available: false, reason };
  return json(body, status, cacheControl);
}

export async function GET(): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return unavailable("not_configured", 503, "no-store");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let data: unknown;
  try {
    // `get_verbatim_round` is not in this repo's generated Supabase types (there
    // are none here), so the call is made through the untyped signature. The
    // response is validated below rather than trusted.
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const result = await rpc("get_verbatim_round", { p_round_date: utcToday() });
    if (result.error) {
      return unavailable("rpc_error", 503, "no-store", result.error.message);
    }
    data = result.data;
  } catch (e) {
    return unavailable("rpc_error", 503, "no-store", e);
  }

  // The bank has nothing for today. Not our failure, and not cached for long: a
  // round published minutes later should reach players on the next refresh.
  if (data && typeof data === "object" && (data as Record<string, unknown>).available === false) {
    return unavailable("none", 200, "public, max-age=0, s-maxage=60");
  }

  const payload = toQuotleRoundPayload(data);
  if (!payload) {
    return unavailable("unusable_payload", 503, "no-store");
  }

  // CDN-only cache. Every visitor asks the same question (the server's UTC day),
  // so one upstream call per minute serves everyone, and 60s bounds how long a
  // just-past-midnight visitor can be shown yesterday's round.
  return json(payload, 200, "public, max-age=0, s-maxage=60, stale-while-revalidate=60");
}
