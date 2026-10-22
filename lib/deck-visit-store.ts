/* ============================================================================
   Supabase (PostgREST) store + Slack thread poster for the deck follow-up.
   Plain fetch, no client library: runs on the edge, and the tests stub the
   network. Tables are created by scripts/deck-followup-tables.sql.
   ========================================================================== */
import {
  MAX_EVENTS_PER_VISIT,
  type BeaconEvent,
  type DeckEvent,
  type NewVisit,
  type ThreadPoster,
  type Visit,
  type VisitStore,
} from "./deck-followup.js";

type Fetch = typeof fetch;

const TIMEOUT_MS = 2500;
const EVENT_KEEP_MS = 48 * 60 * 60 * 1000;
const VISIT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

type VisitRow = {
  id: string;
  kind: Visit["kind"];
  scope: Visit["scope"];
  email: string;
  alerted_at: string;
  window_start: string;
  channel: string;
  thread_ts: string;
  replied_at: string | null;
  dropped_at: string | null;
  attempts: number;
};

type EventRow = {
  kind: "slide" | "video";
  slide: string;
  slide_index: number;
  ms: number;
  duration_ms: number | null;
  created_at: string;
};

const iso = (ms: number) => new Date(ms).toISOString();

function toVisit(r: VisitRow): Visit {
  return {
    id: r.id,
    kind: r.kind,
    scope: r.scope,
    email: r.email,
    alertedAt: Date.parse(r.alerted_at),
    windowStart: Date.parse(r.window_start),
    channel: r.channel,
    threadTs: r.thread_ts,
    repliedAt: r.replied_at ? Date.parse(r.replied_at) : null,
    droppedAt: r.dropped_at ? Date.parse(r.dropped_at) : null,
    attempts: r.attempts,
  };
}

function toEvent(r: EventRow): DeckEvent {
  const at = Date.parse(r.created_at);
  return r.kind === "video"
    ? { kind: "video", slide: r.slide, slideIndex: r.slide_index, ms: r.ms, durationMs: r.duration_ms ?? 0, at }
    : { kind: "slide", slide: r.slide, slideIndex: r.slide_index, ms: r.ms, at };
}

export function createRestStore(opts: {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: Fetch;
}): VisitStore {
  const base = `${opts.url.replace(/\/+$/, "")}/rest/v1`;
  const doFetch: Fetch = opts.fetchImpl ?? ((i, init) => fetch(i, init));

  async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await doFetch(`${base}${path}`, {
        ...init,
        headers: {
          apikey: opts.serviceRoleKey,
          Authorization: `Bearer ${opts.serviceRoleKey}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`supabase ${init.method ?? "GET"} ${path.split("?")[0]} -> ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  const q = (pairs: Array<[string, string]>) =>
    "?" + pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

  return {
    async registerVisit(v: NewVisit) {
      await call(`/deck_visits${q([["on_conflict", "id"]])}`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          id: v.id,
          kind: v.kind,
          scope: v.scope,
          email: v.email,
          alerted_at: iso(v.alertedAt),
          window_start: iso(v.windowStart),
          channel: v.channel,
          thread_ts: v.threadTs,
        }),
      });
    },

    async insertEvents(visitId: string, email: string, events: BeaconEvent[]) {
      const head = await call(`/deck_events${q([["visit_id", `eq.${visitId}`], ["select", "id"]])}`, {
        method: "HEAD",
        headers: { Prefer: "count=exact", Range: "0-0", "Range-Unit": "items" },
      });
      const total = Number((head.headers.get("content-range") ?? "").split("/")[1]);
      /* Loud, not open: a count we cannot read must not silently turn the cap off. */
      if (!Number.isFinite(total)) throw new Error("supabase count missing from content-range");
      if (total >= MAX_EVENTS_PER_VISIT) return false;
      await call("/deck_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          events.map((e) => ({
            visit_id: visitId,
            email,
            kind: e.kind,
            slide: e.slide,
            slide_index: e.slideIndex,
            ms: e.ms,
            duration_ms: e.kind === "video" ? e.durationMs : null,
          })),
        ),
      });
      return true;
    },

    async dueVisits(now: number, olderThanMs: number) {
      const res = await call(
        `/deck_visits${q([
          ["replied_at", "is.null"],
          ["dropped_at", "is.null"],
          ["alerted_at", `lte.${iso(now - olderThanMs)}`],
          ["order", "alerted_at.asc"],
          ["limit", "50"],
        ])}`,
      );
      return ((await res.json()) as VisitRow[]).map(toVisit);
    },

    async claim(id: string, now: number) {
      const res = await call(
        `/deck_visits${q([["id", `eq.${id}`], ["replied_at", "is.null"], ["dropped_at", "is.null"]])}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ replied_at: iso(now) }),
        },
      );
      const rows = (await res.json()) as VisitRow[];
      return rows.length === 1 ? toVisit(rows[0]) : null;
    },

    async release(id: string, attempts: number) {
      await call(`/deck_visits${q([["id", `eq.${id}`]])}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ replied_at: null, attempts }),
      });
    },

    async drop(id: string, now: number) {
      await call(`/deck_visits${q([["id", `eq.${id}`]])}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ dropped_at: iso(now) }),
      });
    },

    async eventsFor(v: Visit, windowEnd: number) {
      const filters: Array<[string, string]> =
        v.scope === "session" ? [["visit_id", `eq.${v.id}`]] : [["email", `eq.${v.email}`]];
      const res = await call(
        `/deck_events${q([
          ["select", "kind,slide,slide_index,ms,duration_ms,created_at"],
          ...filters,
          ["created_at", `gte.${iso(v.windowStart)}`],
          ["created_at", `lte.${iso(windowEnd)}`],
          ["order", "created_at.asc"],
          ["limit", String(MAX_EVENTS_PER_VISIT)],
        ])}`,
      );
      return ((await res.json()) as EventRow[]).map(toEvent);
    },

    /** Age-based only. Events are never deleted by visit, because two alerts for
        the same person can have overlapping windows and one must not erase what the
        other still needs. Nothing a reply can use is older than 48 hours (visits
        are dropped after 3). The small visit rows outlive their events so a visit
        can never be answered twice. */
    async prune(now: number) {
      await call(`/deck_events${q([["created_at", `lt.${iso(now - EVENT_KEEP_MS)}`]])}`, { method: "DELETE" });
      await call(`/deck_visits${q([["alerted_at", `lt.${iso(now - VISIT_KEEP_MS)}`]])}`, { method: "DELETE" });
    },
  };
}

/** null when the deck database is not configured, which turns tracking off
    quietly rather than failing a visitor's page load. Reads only the DECK_*
    names, never the generic SUPABASE_* ones that api/support.ts and others use,
    so pointing the deck at its own project cannot change anything else. */
export function storeFromEnv(): VisitStore | null {
  const url = process.env.DECK_SUPABASE_URL;
  const key = process.env.DECK_SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createRestStore({ url, serviceRoleKey: key }) : null;
}

export function createSlackThreadPoster(opts: { token: string; fetchImpl?: Fetch }): ThreadPoster {
  const doFetch: Fetch = opts.fetchImpl ?? ((i, init) => fetch(i, init));
  return async ({ channel, thread_ts, text }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await doFetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${opts.token}`,
        },
        body: JSON.stringify({ channel, thread_ts, text, reply_broadcast: false, unfurl_links: false }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) return { ok: true };
      /* Slack answering "no" (an ok:false body, or a 429 before it looked at the
         message) means nothing was posted. Anything else is unknown. */
      const definite = res.status === 429 || (res.ok && data?.ok === false);
      return { ok: false, error: data?.error ?? `http_${res.status}`, definite };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.name : "threw", definite: false };
    } finally {
      clearTimeout(timer);
    }
  };
}
