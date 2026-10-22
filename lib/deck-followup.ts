/* ============================================================================
   Angel deck — 30-minute follow-up in the alert's own Slack thread
   ----------------------------------------------------------------------------
   Mike, 22 Oct 2026: 30 minutes after a deck alert lands in #reps-support, reply
   in its thread with what the person consumed — which slides held them longest,
   whether they played a video.

   Three moving parts, all stateless on the server (a Vercel function has no
   memory between calls, so every timer is a row and a sweep):

     1. The deck page beacons slide time and video time to /api/deck-track.
     2. When an alert is posted with a message id, a `deck_visits` row records
        which message to reply under and when.
     3. A cron calls runSweep() every few minutes; it replies to visits that are
        at least 30 minutes old, once, and drops ones that are hours late.

   This file is the pure part: validation, analysis, wording, the sweep. The
   database and Slack sit behind small interfaces so the tests drive the real
   logic with in-memory fakes. Internal only — the thread reply goes to our own
   channel; nothing here ever contacts the visitor.
   ========================================================================== */
import {
  SESSION_COOKIE,
  corsHeaders,
  escapeSlack,
  json,
  readCookie,
  readSession,
  type SlackPosted,
  type Viewer,
} from "./deck-gate.js";

export const FOLLOWUP_DELAY_MS = 30 * 60 * 1000;
/** A visit still unanswered this long after its alert is dropped, not sent late. */
export const DROP_AFTER_MS = 3 * 60 * 60 * 1000;
export const MAX_SEND_ATTEMPTS = 3;
export const MAX_BODY_CHARS = 2048;
export const MAX_EVENTS_PER_BEACON = 8;
export const MAX_EVENTS_PER_VISIT = 400;
/** A silence this long inside the window, followed by more reading, is "came back". */
export const COME_BACK_GAP_MS = 5 * 60 * 1000;
export const TOP_SLIDES = 5;

const MAX_SLIDE_NAME = 120;
const MAX_SLIDE_INDEX = 200;
const MAX_DWELL_MS = 2 * 60 * 60 * 1000;
const MAX_VIDEO_MS = 2 * 60 * 60 * 1000;
const MAX_VIDEO_LEN_MS = 6 * 60 * 60 * 1000;

/* ── what is stored ─────────────────────────────────────────────────────── */

export type AlertKind = "reading_code" | "reading_link" | "reading_forwarded" | "code_requested";
/** "session": the events of one browser session. "email": everything that address
    did in the window — used for "access code requested", which has no session yet. */
export type VisitScope = "session" | "email";

export type BeaconEvent =
  | { kind: "slide"; slide: string; slideIndex: number; ms: number }
  | { kind: "video"; slide: string; slideIndex: number; ms: number; durationMs: number };

/** A stored event: `at` is the server clock, epoch ms. */
export type DeckEvent = BeaconEvent & { at: number };

export type Visit = {
  id: string;
  kind: AlertKind;
  scope: VisitScope;
  email: string;
  alertedAt: number;
  windowStart: number;
  channel: string;
  threadTs: string;
  repliedAt: number | null;
  droppedAt: number | null;
  attempts: number;
};

export type NewVisit = Omit<Visit, "repliedAt" | "droppedAt" | "attempts">;

/** What the sweep and the beacon need from the database. */
export interface VisitStore {
  /** Idempotent: a second call with the same id changes nothing. */
  registerVisit(v: NewVisit): Promise<void>;
  /** Returns false when the visit already has too many events to take more. */
  insertEvents(visitId: string, email: string, events: BeaconEvent[]): Promise<boolean>;
  /** Unreplied, undropped visits whose alert is at least `olderThanMs` old. */
  dueVisits(now: number, olderThanMs: number): Promise<Visit[]>;
  /** Atomically takes the single reply slot. Null if somebody else already has it. */
  claim(id: string, now: number): Promise<Visit | null>;
  /** Gives the slot back after a failed post. */
  release(id: string, attempts: number): Promise<void>;
  drop(id: string, now: number): Promise<void>;
  eventsFor(v: Visit, windowEnd: number): Promise<DeckEvent[]>;
  /** Housekeeping: removes events and visit rows too old to matter. */
  prune(now: number): Promise<void>;
}

export interface ThreadPoster {
  (p: { channel: string; thread_ts: string; text: string }): Promise<{ ok: boolean; error?: string }>;
}

/* ── the beacon ─────────────────────────────────────────────────────────── */

export type BeaconParse =
  | { ok: true; events: BeaconEvent[] }
  | { ok: false; status: 400 | 413; reason: string };

function intIn(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Strict on purpose: the endpoint sits open to anyone holding a session cookie, and
    its output is read by a person in Slack. Anything off-shape is refused whole. */
export function parseBeacon(raw: string): BeaconParse {
  if (raw.length > MAX_BODY_CHARS) return { ok: false, status: 413, reason: "too_large" };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, reason: "not_json" };
  }
  const list = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_EVENTS_PER_BEACON) {
    return { ok: false, status: 400, reason: "bad_events" };
  }
  const events: BeaconEvent[] = [];
  for (const item of list) {
    const e = item as Record<string, unknown> | null;
    if (!e || typeof e !== "object") return { ok: false, status: 400, reason: "bad_event" };
    const slide = typeof e.slide === "string" ? e.slide.trim() : "";
    // eslint-disable-next-line no-control-regex
    if (!slide || slide.length > MAX_SLIDE_NAME || /[\u0000-\u001f\u007f]/.test(slide)) {
      return { ok: false, status: 400, reason: "bad_slide" };
    }
    const slideIndex = intIn(e.slide_index, 1, MAX_SLIDE_INDEX);
    if (slideIndex === null) return { ok: false, status: 400, reason: "bad_slide_index" };
    if (e.kind === "slide") {
      const ms = intIn(e.ms, 1, MAX_DWELL_MS);
      if (ms === null) return { ok: false, status: 400, reason: "bad_ms" };
      events.push({ kind: "slide", slide, slideIndex, ms });
    } else if (e.kind === "video") {
      const ms = intIn(e.ms, 1, MAX_VIDEO_MS);
      const durationMs = intIn(e.duration_ms, 0, MAX_VIDEO_LEN_MS);
      if (ms === null || durationMs === null) return { ok: false, status: 400, reason: "bad_video" };
      events.push({ kind: "video", slide, slideIndex, ms, durationMs });
    } else {
      return { ok: false, status: 400, reason: "bad_kind" };
    }
  }
  return { ok: true, events };
}

function sameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return /^https:\/\/(www\.)?getreps\.io$/.test(origin);
}

/** The beacon route's whole behaviour. The visit id is derived from the signed
    session cookie, never taken from the body, so a caller can only ever write
    to their own visit. */
export async function handleTrack(
  request: Request,
  deps: { secret: string | null; store: VisitStore | null },
): Promise<Response> {
  if (!deps.secret) return json({ ok: false }, { status: 500 });
  if (!sameSite(request)) return json({ ok: false, error: "forbidden" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS * 4) {
    return json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const raw = await request.text().catch(() => "");
  const parsed = parseBeacon(raw);
  if (!parsed.ok) return json({ ok: false, error: parsed.reason }, { status: parsed.status });

  const viewer = await readSession(deps.secret, readCookie(request, SESSION_COOKIE));
  if (!viewer) return json({ ok: false, error: "no_session" }, { status: 401 });
  if (!deps.store) return json({ ok: false, error: "not_configured" }, { status: 503 });

  try {
    const stored = await deps.store.insertEvents(await sessionVisitId(viewer), viewer.e, parsed.events);
    if (!stored) return json({ ok: false, error: "full" }, { status: 429 });
  } catch (e) {
    console.error("deck-track: store failed", e);
    return json({ ok: false, error: "store_failed" }, { status: 502 });
  }
  return json({ ok: true });
}

export function trackPreflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/* ── identity of a visit ────────────────────────────────────────────────── */

async function shortHash(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The session is the visit: the cookie already carries the address and the moment
    the gate opened, and it is signed, so this id cannot be forged from outside. */
export function sessionVisitId(viewer: Pick<Viewer, "e" | "t">): Promise<string> {
  return shortHash(`session|${viewer.e}|${viewer.t}`);
}

export function requestVisitId(email: string, alertedAt: number): Promise<string> {
  return shortHash(`request|${email}|${alertedAt}`);
}

/** Called right after an alert is posted. Never throws and never blocks the gate:
    a failure here costs one follow-up, not an investor's access. */
export async function trackAlert(
  store: VisitStore | null,
  posted: SlackPosted,
  info: { kind: AlertKind; scope: VisitScope; email: string; id: string; windowStart: number; now?: number },
): Promise<void> {
  if (!store || !posted.ok || !posted.ts || !posted.channel) return;
  try {
    await store.registerVisit({
      id: info.id,
      kind: info.kind,
      scope: info.scope,
      email: info.email,
      alertedAt: info.now ?? Date.now(),
      windowStart: info.windowStart,
      channel: posted.channel,
      threadTs: posted.ts,
    });
  } catch (e) {
    console.error("deck-followup: could not register visit", e);
  }
}

/* ── the analysis ───────────────────────────────────────────────────────── */

export type Analysis = {
  eventCount: number;
  readingMs: number;
  slides: Array<{ slide: string; ms: number }>;
  slidesVisited: number;
  furthest: { slideIndex: number; slide: string } | null;
  videos: Array<{ slide: string; playedMs: number; durationMs: number }>;
  /** events that ended after the alert */
  afterEvents: number;
  /** minutes of reading recorded after the alert */
  afterReadingMs: number;
  /** longest silence, with reading on both sides, that began after the alert */
  cameBackAfterMs: number | null;
};

function startOf(e: DeckEvent): number {
  return e.at - e.ms;
}

/** Facts only. Events are those from the visit's window, ending no later than
    `windowEnd`; callers pass alertedAt + 30 minutes so the numbers are the same
    whenever the sweep happens to run. */
export function analyseVisit(events: DeckEvent[], alertedAt: number, windowEnd: number): Analysis {
  const inWindow = events.filter((e) => e.at <= windowEnd).sort((a, b) => a.at - b.at);

  const bySlide = new Map<string, { ms: number; index: number }>();
  const byVideo = new Map<string, { playedMs: number; durationMs: number }>();
  let readingMs = 0;
  let furthest: Analysis["furthest"] = null;
  let afterEvents = 0;
  let afterReadingMs = 0;

  for (const e of inWindow) {
    if (e.kind === "slide") {
      readingMs += e.ms;
      const cur = bySlide.get(e.slide) ?? { ms: 0, index: e.slideIndex };
      cur.ms += e.ms;
      bySlide.set(e.slide, cur);
      if (!furthest || e.slideIndex > furthest.slideIndex) {
        furthest = { slideIndex: e.slideIndex, slide: e.slide };
      }
      if (e.at > alertedAt) afterReadingMs += Math.min(e.ms, e.at - alertedAt);
    } else {
      const cur = byVideo.get(e.slide) ?? { playedMs: 0, durationMs: 0 };
      cur.playedMs += e.ms;
      cur.durationMs = Math.max(cur.durationMs, e.durationMs);
      byVideo.set(e.slide, cur);
    }
    if (e.at > alertedAt) afterEvents += 1;
  }

  let cameBackAfterMs: number | null = null;
  for (let i = 1; i < inWindow.length; i++) {
    const gap = startOf(inWindow[i]) - inWindow[i - 1].at;
    if (gap >= COME_BACK_GAP_MS && inWindow[i].at > alertedAt) {
      cameBackAfterMs = Math.max(cameBackAfterMs ?? 0, gap);
    }
  }

  const slides = [...bySlide.entries()]
    .map(([slide, v]) => ({ slide, ms: v.ms, index: v.index }))
    .sort((a, b) => b.ms - a.ms || a.index - b.index)
    .slice(0, TOP_SLIDES)
    .map(({ slide, ms }) => ({ slide, ms }));

  return {
    eventCount: inWindow.length,
    readingMs,
    slides,
    slidesVisited: bySlide.size,
    furthest,
    videos: [...byVideo.entries()].map(([slide, v]) => ({ slide, ...v })),
    afterEvents,
    afterReadingMs,
    cameBackAfterMs,
  };
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

const NO_ACTIVITY = "No page activity recorded after the alert.";

/** The Slack thread reply. Slide names are written by the browser, so they are
    escaped here like every other untrusted string that reaches Slack. */
export function formatReply(a: Analysis): string {
  const head = "*What they read in the 30 minutes after this alert*";
  const foot = "_Counts only what the deck reported while the page was open._";
  if (a.eventCount === 0) return [head, NO_ACTIVITY, foot].join("\n");

  const lines: string[] = [head];
  lines.push(
    `• Reading time: ${fmtDuration(a.readingMs)} across ${a.slidesVisited} slide${a.slidesVisited === 1 ? "" : "s"}`,
  );
  if (a.slides.length > 0) {
    lines.push("• Most time on:");
    a.slides.forEach((s, i) => lines.push(`   ${i + 1}. ${escapeSlack(s.slide)} (${fmtDuration(s.ms)})`));
  }
  if (a.furthest) {
    lines.push(`• Furthest slide reached: ${a.furthest.slideIndex}, ${escapeSlack(a.furthest.slide)}`);
  }
  if (a.videos.length === 0) {
    lines.push("• Video: none played");
  } else {
    for (const v of a.videos) {
      const len = v.durationMs > 0 ? ` of ${fmtDuration(v.durationMs)}` : "";
      lines.push(`• Video: played on ${escapeSlack(v.slide)} for ${fmtDuration(v.playedMs)}${len}`);
    }
  }
  if (a.afterEvents === 0) {
    lines.push(`• ${NO_ACTIVITY}`);
  } else {
    const back =
      a.cameBackAfterMs !== null ? `; came back after a ${fmtDuration(a.cameBackAfterMs)} pause` : "";
    lines.push(`• After the alert: ${fmtDuration(a.afterReadingMs)} more reading${back}`);
  }
  lines.push(foot);
  return lines.join("\n");
}

/* ── the sweep ──────────────────────────────────────────────────────────── */

/** Pure filter, applied on top of the store's own query so the rule lives in one
    tested place: at least 30 minutes old, never replied, never dropped, not too late. */
export function selectDue(visits: Visit[], now: number): Visit[] {
  return visits.filter(
    (v) =>
      v.repliedAt === null &&
      v.droppedAt === null &&
      now - v.alertedAt >= FOLLOWUP_DELAY_MS &&
      now - v.alertedAt <= DROP_AFTER_MS,
  );
}

export type SweepResult = {
  dryRun: boolean;
  considered: number;
  sent: number;
  dropped: number;
  skipped: number;
  failed: number;
};

export async function runSweep(deps: {
  store: VisitStore;
  post?: ThreadPoster;
  now?: number;
  /** Defaults to TRUE. A caller has to opt in to actually posting to Slack. */
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<SweepResult> {
  const now = deps.now ?? Date.now();
  const dryRun = deps.dryRun ?? true;
  const log = deps.log ?? ((line: string) => console.log(line));
  const post = deps.post;
  if (!dryRun && !post) throw new Error("runSweep: a poster is required unless dryRun");
  const result: SweepResult = { dryRun, considered: 0, sent: 0, dropped: 0, skipped: 0, failed: 0 };

  const candidates = await deps.store.dueVisits(now, FOLLOWUP_DELAY_MS);
  result.considered = candidates.length;

  for (const v of candidates) {
    if (v.repliedAt !== null || v.droppedAt !== null) {
      result.skipped += 1;
      continue;
    }
    if (now - v.alertedAt < FOLLOWUP_DELAY_MS) {
      result.skipped += 1;
      continue;
    }
    if (now - v.alertedAt > DROP_AFTER_MS) {
      if (!dryRun) await deps.store.drop(v.id, now);
      result.dropped += 1;
      continue;
    }

    if (dryRun) {
      const events = await deps.store.eventsFor(v, v.alertedAt + FOLLOWUP_DELAY_MS);
      const text = formatReply(analyseVisit(events, v.alertedAt, v.alertedAt + FOLLOWUP_DELAY_MS));
      log(`deck-followup dry-run: ${JSON.stringify({ channel: v.channel, thread_ts: v.threadTs, text })}`);
      result.sent += 1;
      continue;
    }

    const claimed = await deps.store.claim(v.id, now);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }
    let ok = false;
    try {
      const windowEnd = claimed.alertedAt + FOLLOWUP_DELAY_MS;
      const events = await deps.store.eventsFor(claimed, windowEnd);
      const text = formatReply(analyseVisit(events, claimed.alertedAt, windowEnd));
      const res = await post!({ channel: claimed.channel, thread_ts: claimed.threadTs, text });
      ok = res.ok;
      if (!ok) log(`deck-followup: slack refused reply (${res.error ?? "unknown"})`);
    } catch (e) {
      log(`deck-followup: reply threw ${(e as Error)?.message ?? e}`);
    }

    if (ok) {
      result.sent += 1;
    } else {
      result.failed += 1;
      const attempts = claimed.attempts + 1;
      if (attempts >= MAX_SEND_ATTEMPTS) await deps.store.drop(claimed.id, now);
      else await deps.store.release(claimed.id, attempts);
    }
  }
  if (!dryRun) await deps.store.prune(now).catch((e) => log(`deck-followup: prune failed ${e}`));
  return result;
}
