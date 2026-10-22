import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DROP_AFTER_MS,
  FOLLOWUP_DELAY_MS,
  MAX_EVENTS_PER_VISIT,
  MAX_SEND_ATTEMPTS,
  analyseVisit,
  formatReply,
  handleTrack,
  parseBeacon,
  requestVisitId,
  runSweep,
  selectDue,
  sessionVisitId,
  trackAlert,
  type BeaconEvent,
  type DeckEvent,
  type NewVisit,
  type ThreadPoster,
  type Visit,
  type VisitStore,
} from "./deck-followup.js";
import { issueSession, SESSION_COOKIE } from "./deck-gate.js";

const MIN = 60_000;
const T0 = 1_760_000_000_000; // the alert
const S = "test-secret-not-the-real-one";

/* ── fixtures ───────────────────────────────────────────────────────────── */

function slide(slideName: string, index: number, ms: number, at: number): DeckEvent {
  return { kind: "slide", slide: slideName, slideIndex: index, ms, at };
}
function video(slideName: string, index: number, ms: number, durationMs: number, at: number): DeckEvent {
  return { kind: "video", slide: slideName, slideIndex: index, ms, durationMs, at };
}

function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    kind: "reading_code",
    scope: "session",
    email: "a@b.com",
    alertedAt: T0,
    windowStart: T0 - 5 * MIN,
    channel: "C123",
    threadTs: "1760000000.000100",
    repliedAt: null,
    droppedAt: null,
    attempts: 0,
    ...over,
  };
}

/** In-memory stand-in for the database. `claim` is atomic, like the real UPDATE ... WHERE replied_at IS NULL. */
class FakeStore implements VisitStore {
  visits = new Map<string, Visit>();
  events: Array<DeckEvent & { visitId: string; email: string }> = [];
  pruned = 0;
  full = false;
  async registerVisit(v: NewVisit) {
    if (!this.visits.has(v.id)) this.visits.set(v.id, { ...v, repliedAt: null, droppedAt: null, attempts: 0 });
  }
  async insertEvents(visitId: string, email: string, events: BeaconEvent[]) {
    const count = this.events.filter((e) => e.visitId === visitId).length;
    if (this.full || count >= MAX_EVENTS_PER_VISIT) return false;
    for (const e of events) this.events.push({ ...e, at: Date.now(), visitId, email });
    return true;
  }
  async dueVisits(now: number, olderThanMs: number) {
    return [...this.visits.values()].filter(
      (v) => v.repliedAt === null && v.droppedAt === null && v.alertedAt <= now - olderThanMs,
    );
  }
  async claim(id: string, now: number) {
    const v = this.visits.get(id);
    if (!v || v.repliedAt !== null || v.droppedAt !== null) return null;
    const before = { ...v };
    v.repliedAt = now;
    return before;
  }
  async release(id: string, attempts: number) {
    const v = this.visits.get(id)!;
    v.repliedAt = null;
    v.attempts = attempts;
  }
  async drop(id: string, now: number) {
    this.visits.get(id)!.droppedAt = now;
  }
  async eventsFor(v: Visit, windowEnd: number) {
    return this.events
      .filter((e) => (v.scope === "session" ? e.visitId === v.id : e.email === v.email))
      .filter((e) => e.at >= v.windowStart && e.at <= windowEnd);
  }
  async prune() {
    this.pruned += 1;
  }
}

function recorder(ok = true): { post: ThreadPoster; sent: Array<{ channel: string; thread_ts: string; text: string }> } {
  const sent: Array<{ channel: string; thread_ts: string; text: string }> = [];
  return {
    sent,
    post: async (p) => {
      sent.push(p);
      return ok ? { ok: true } : { ok: false, error: "channel_not_found" };
    },
  };
}

/* ── analysis text ──────────────────────────────────────────────────────── */

test("ranks slides by time, merges revisits, and keeps the top five", () => {
  const events = [
    slide("Cover", 1, 8_000, T0 - 2 * MIN),
    slide("Problem", 2, 40_000, T0 - 1 * MIN),
    slide("Market", 3, 200_000, T0 + 4 * MIN),
    slide("Team", 4, 90_000, T0 + 6 * MIN),
    slide("Problem", 2, 30_000, T0 + 7 * MIN), // revisit: 70s in total
    slide("Traction", 5, 150_000, T0 + 10 * MIN),
    slide("Ask", 6, 20_000, T0 + 11 * MIN),
    slide("Vision", 7, 12_000, T0 + 12 * MIN),
  ];
  const a = analyseVisit(events, T0, T0 + FOLLOWUP_DELAY_MS);
  assert.deepEqual(
    a.slides.map((s) => [s.slide, s.ms]),
    [
      ["Market", 200_000],
      ["Traction", 150_000],
      ["Team", 90_000],
      ["Problem", 70_000],
      ["Ask", 20_000],
    ],
  );
  assert.equal(a.slidesVisited, 7);
  assert.deepEqual(a.furthest, { slideIndex: 7, slide: "Vision" });
  const text = formatReply(a);
  assert.match(text, /1\. Market \(3m 20s\)/);
  assert.match(text, /4\. Problem \(1m 10s\)/);
  assert.doesNotMatch(text, /Cover/);
  assert.match(text, /Reading time: 9m 10s across 7 slides/); // 8+40+200+90+30+150+20+12 = 550s
  assert.match(text, /Furthest slide reached: 7, Vision/);
});

test("video: played is reported with length; none played says so", () => {
  const played = analyseVisit(
    [slide("Intro", 2, 60_000, T0 + 5 * MIN), video("Intro", 2, 45_000, 69_000, T0 + 5 * MIN), video("Intro", 2, 10_000, 69_000, T0 + 8 * MIN)],
    T0,
    T0 + FOLLOWUP_DELAY_MS,
  );
  assert.deepEqual(played.videos, [{ slide: "Intro", playedMs: 55_000, durationMs: 69_000 }]);
  assert.match(formatReply(played), /Video: played on Intro for 55s of 1m 09s/);

  const none = analyseVisit([slide("Intro", 2, 60_000, T0 + 5 * MIN)], T0, T0 + FOLLOWUP_DELAY_MS);
  assert.equal(none.videos.length, 0);
  assert.match(formatReply(none), /Video: none played/);
});

test("no events at all: says so plainly and claims nothing else", () => {
  const text = formatReply(analyseVisit([], T0, T0 + FOLLOWUP_DELAY_MS));
  assert.match(text, /No page activity recorded after the alert\./);
  assert.doesNotMatch(text, /Reading time|Video|Most time/);
});

test("reading that all happened before the alert: summary, then no activity after", () => {
  const a = analyseVisit([slide("Cover", 1, 20_000, T0 - MIN), slide("Problem", 2, 30_000, T0 - 10_000)], T0, T0 + FOLLOWUP_DELAY_MS);
  assert.equal(a.afterEvents, 0);
  const text = formatReply(a);
  assert.match(text, /Reading time: 50s across 2 slides/);
  assert.match(text, /• No page activity recorded after the alert\./);
});

test("after-alert reading, and a return after a pause, are reported as facts", () => {
  const events = [
    slide("Cover", 1, 30_000, T0 + 1 * MIN),
    slide("Market", 3, 60_000, T0 + 3 * MIN),
    // quiet from minute 3 to minute 18, then back for two minutes
    slide("Traction", 5, 120_000, T0 + 20 * MIN),
  ];
  const a = analyseVisit(events, T0, T0 + FOLLOWUP_DELAY_MS);
  assert.equal(a.cameBackAfterMs, 15 * MIN);
  const text = formatReply(a);
  assert.match(text, /After the alert: 3m 30s more reading; came back after a 15m pause/);
});

test("events after the 30-minute window are not counted", () => {
  const a = analyseVisit([slide("Market", 3, 60_000, T0 + 5 * MIN), slide("Ask", 6, 600_000, T0 + 45 * MIN)], T0, T0 + FOLLOWUP_DELAY_MS);
  assert.equal(a.eventCount, 1);
  assert.deepEqual(a.furthest, { slideIndex: 3, slide: "Market" });
});

test("slide names from the browser are escaped before they reach Slack", () => {
  const text = formatReply(analyseVisit([slide("<!channel> & <b>", 2, 60_000, T0 + MIN)], T0, T0 + FOLLOWUP_DELAY_MS));
  assert.doesNotMatch(text, /<!channel>/);
  assert.match(text, /&lt;!channel&gt; &amp; &lt;b&gt;/);
});

/* ── which visits are due ───────────────────────────────────────────────── */

test("selectDue takes only visits at least 30 minutes old and not yet answered", () => {
  const now = T0 + FOLLOWUP_DELAY_MS;
  const visits = [
    visit({ id: "young", alertedAt: now - (FOLLOWUP_DELAY_MS - 1) }),
    visit({ id: "exact", alertedAt: now - FOLLOWUP_DELAY_MS }),
    visit({ id: "old-ok", alertedAt: now - 2 * 60 * MIN }),
    visit({ id: "replied", alertedAt: now - 40 * MIN, repliedAt: now - MIN }),
    visit({ id: "dropped", alertedAt: now - 40 * MIN, droppedAt: now - MIN }),
    visit({ id: "too-late", alertedAt: now - DROP_AFTER_MS - 1 }),
  ];
  assert.deepEqual(selectDue(visits, now).map((v) => v.id), ["exact", "old-ok"]);
});

/* ── the sweep ──────────────────────────────────────────────────────────── */

test("the sweep replies in the alert's own thread, once, with the analysis", async () => {
  const store = new FakeStore();
  await store.registerVisit({ ...visit(), id: "v1" });
  store.events.push({ ...slide("Market", 3, 90_000, T0 + 5 * MIN), visitId: "v1", email: "a@b.com" });
  const { post, sent } = recorder();
  const now = T0 + 31 * MIN;

  const first = await runSweep({ store, post, now, dryRun: false });
  assert.equal(first.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, "C123");
  assert.equal(sent[0].thread_ts, "1760000000.000100");
  assert.match(sent[0].text, /1\. Market \(1m 30s\)/);

  // idempotent: a second sweep, even a third, sends nothing
  await runSweep({ store, post, now: now + 5 * MIN, dryRun: false });
  await runSweep({ store, post, now: now + 10 * MIN, dryRun: false });
  assert.equal(sent.length, 1);
});

test("two sweeps running at once still send a single reply", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  const { post, sent } = recorder();
  const now = T0 + 35 * MIN;
  await Promise.all([runSweep({ store, post, now, dryRun: false }), runSweep({ store, post, now, dryRun: false })]);
  assert.equal(sent.length, 1);
});

test("a visit younger than 30 minutes is left alone", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  const { post, sent } = recorder();
  const r = await runSweep({ store, post, now: T0 + 29 * MIN, dryRun: false });
  assert.equal(r.considered, 0);
  assert.equal(sent.length, 0);
  assert.equal(store.visits.get("v1")!.repliedAt, null);
});

test("a visit more than a few hours late is dropped, never sent late", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  const { post, sent } = recorder();
  const r = await runSweep({ store, post, now: T0 + DROP_AFTER_MS + MIN, dryRun: false });
  assert.equal(r.dropped, 1);
  assert.equal(sent.length, 0);
  assert.notEqual(store.visits.get("v1")!.droppedAt, null);
  // and it stays dropped
  await runSweep({ store, post, now: T0 + DROP_AFTER_MS + 10 * MIN, dryRun: false });
  assert.equal(sent.length, 0);
});

test("dry run is the default: prints the Slack payload, posts nothing, claims nothing", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  const { post, sent } = recorder();
  const logged: string[] = [];
  const r = await runSweep({ store, post, now: T0 + 31 * MIN, log: (l) => logged.push(l) });
  assert.equal(r.dryRun, true);
  assert.equal(sent.length, 0);
  assert.equal(store.visits.get("v1")!.repliedAt, null, "a dry run must not use up the reply");
  assert.equal(logged.length, 1);
  assert.match(logged[0], /dry-run/);
  assert.match(logged[0], /"thread_ts":"1760000000.000100"/);
  assert.match(logged[0], /No page activity recorded after the alert/);
  assert.equal(store.pruned, 0);
});

test("a failed post gives the slot back, and gives up after three tries", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  const bad = recorder(false);
  const quiet = () => {};
  let now = T0 + 31 * MIN;
  for (let i = 1; i < MAX_SEND_ATTEMPTS; i++) {
    const r = await runSweep({ store, post: bad.post, now, dryRun: false, log: quiet });
    assert.equal(r.failed, 1);
    assert.equal(store.visits.get("v1")!.repliedAt, null, "still retryable");
    assert.equal(store.visits.get("v1")!.attempts, i);
    now += 5 * MIN;
  }
  await runSweep({ store, post: bad.post, now, dryRun: false, log: quiet });
  assert.notEqual(store.visits.get("v1")!.droppedAt, null);
  const good = recorder();
  await runSweep({ store, post: good.post, now: now + 5 * MIN, dryRun: false, log: quiet });
  assert.equal(good.sent.length, 0);
});

test("a poster that throws is treated as a failed post, not a crash", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  const r = await runSweep({
    store,
    post: async () => {
      throw new Error("network down");
    },
    now: T0 + 31 * MIN,
    dryRun: false,
    log: () => {},
  });
  assert.equal(r.failed, 1);
  assert.equal(store.visits.get("v1")!.repliedAt, null);
});

test("a real run without a poster is refused up front, before anything is claimed", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit());
  await assert.rejects(runSweep({ store, now: T0 + 31 * MIN, dryRun: false }), /poster is required/);
  assert.equal(store.visits.get("v1")!.repliedAt, null);
});

test("an access-code request is analysed by email, from the request onwards", async () => {
  const store = new FakeStore();
  await store.registerVisit(visit({ id: "req1", scope: "email", kind: "code_requested", windowStart: T0 }));
  store.events.push({ ...slide("Cover", 1, 20_000, T0 + 6 * MIN), visitId: "session-x", email: "a@b.com" });
  store.events.push({ ...slide("Other person", 1, 99_000, T0 + 6 * MIN), visitId: "session-y", email: "z@z.com" });
  const { post, sent } = recorder();
  await runSweep({ store, post, now: T0 + 31 * MIN, dryRun: false });
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Cover/);
  assert.doesNotMatch(sent[0].text, /Other person/);
});

/* ── registering a visit ────────────────────────────────────────────────── */

test("trackAlert records the message id, and does nothing without one", async () => {
  const store = new FakeStore();
  const info = { kind: "reading_code" as const, scope: "session" as const, email: "a@b.com", id: "v9", windowStart: T0 };
  await trackAlert(store, { ok: true, channel: null, ts: null }, info); // webhook post: no ts
  await trackAlert(store, { ok: false, channel: "C1", ts: "1.1" }, info); // not delivered
  await trackAlert(null, { ok: true, channel: "C1", ts: "1.1" }, info); // no database
  assert.equal(store.visits.size, 0);
  await trackAlert(store, { ok: true, channel: "C1", ts: "1.1" }, { ...info, now: T0 });
  await trackAlert(store, { ok: true, channel: "C1", ts: "9.9" }, { ...info, now: T0 }); // same visit again
  assert.equal(store.visits.size, 1);
  assert.equal(store.visits.get("v9")!.threadTs, "1.1", "first alert wins; never re-pointed");
});

test("a database failure while registering never reaches the caller", async () => {
  const broken = {
    ...new FakeStore(),
    registerVisit: async () => {
      throw new Error("db down");
    },
  } as unknown as VisitStore;
  const silence = console.error;
  console.error = () => {};
  try {
    await trackAlert(broken, { ok: true, channel: "C1", ts: "1.1" }, { kind: "reading_code", scope: "session", email: "a@b.com", id: "x", windowStart: T0 });
  } finally {
    console.error = silence;
  }
});

test("visit ids are stable per session, differ per person and per code request", async () => {
  assert.equal(await sessionVisitId({ e: "a@b.com", t: 1 }), await sessionVisitId({ e: "a@b.com", t: 1 }));
  assert.notEqual(await sessionVisitId({ e: "a@b.com", t: 1 }), await sessionVisitId({ e: "a@b.com", t: 2 }));
  assert.notEqual(await sessionVisitId({ e: "a@b.com", t: 1 }), await sessionVisitId({ e: "c@b.com", t: 1 }));
  assert.notEqual(await requestVisitId("a@b.com", 1), await sessionVisitId({ e: "a@b.com", t: 1 }));
});

/* ── the beacon endpoint ────────────────────────────────────────────────── */

const GOOD = { events: [{ kind: "slide", slide: "Market", slide_index: 3, ms: 12_000 }] };

test("parseBeacon accepts slide and video events", () => {
  const r = parseBeacon(
    JSON.stringify({
      events: [
        { kind: "slide", slide: "Market", slide_index: 3, ms: 12_000 },
        { kind: "video", slide: "Intro", slide_index: 2, ms: 8_000, duration_ms: 69_000 },
      ],
    }),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.events[1], { kind: "video", slide: "Intro", slideIndex: 2, ms: 8_000, durationMs: 69_000 });
});

test("parseBeacon refuses malformed bodies whole", () => {
  const bad: unknown[] = [
    "not json",
    "null",
    "[]",
    JSON.stringify({}),
    JSON.stringify({ events: [] }),
    JSON.stringify({ events: "x" }),
    JSON.stringify({ events: Array.from({ length: 9 }, () => GOOD.events[0]) }),
    JSON.stringify({ events: [{ ...GOOD.events[0], kind: "click" }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], slide: "" }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], slide: "x".repeat(121) }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], slide: "bad\nname" }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], slide: 7 }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], slide_index: 0 }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], slide_index: 1.5 }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], ms: -5 }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], ms: "12" }] }),
    JSON.stringify({ events: [{ ...GOOD.events[0], ms: 3 * 60 * 60 * 1000 }] }),
    JSON.stringify({ events: [{ kind: "video", slide: "Intro", slide_index: 2, ms: 5000 }] }),
    JSON.stringify({ events: [{ kind: "video", slide: "Intro", slide_index: 2, ms: 5000, duration_ms: -1 }] }),
    JSON.stringify({ events: [GOOD.events[0], null] }),
  ];
  for (const raw of bad) {
    const r = parseBeacon(raw as string);
    assert.equal(r.ok, false, String(raw).slice(0, 80));
    assert.equal(!r.ok && r.status, 400, String(raw).slice(0, 80));
  }
});

test("parseBeacon refuses an oversized body with 413", () => {
  const huge = JSON.stringify({ events: [{ ...GOOD.events[0], slide: "x".repeat(3000) }] });
  const r = parseBeacon(huge);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 413);
});

async function sessionCookieFor(email: string, t: number): Promise<string> {
  return `${SESSION_COOKIE}=${await issueSession(S, { e: email, geo: "Austin, TX, US", t })}`;
}

function trackRequest(body: string, cookie?: string, extra: Record<string, string> = {}): Request {
  return new Request("https://www.getreps.io/api/deck-track", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...extra },
    body,
  });
}

test("endpoint: stores events under the visit derived from the cookie, ignoring any id in the body", async () => {
  const store = new FakeStore();
  const cookie = await sessionCookieFor("a@b.com", 1234);
  const body = JSON.stringify({ ...GOOD, visit_id: "someone-elses", email: "evil@x.com" });
  const res = await handleTrack(trackRequest(body, cookie), { secret: S, store });
  assert.equal(res.status, 200);
  assert.equal(store.events.length, 1);
  assert.equal(store.events[0].visitId, await sessionVisitId({ e: "a@b.com", t: 1234 }));
  assert.equal(store.events[0].email, "a@b.com");
});

test("endpoint: malformed and oversized bodies are rejected and nothing is stored", async () => {
  const store = new FakeStore();
  const cookie = await sessionCookieFor("a@b.com", 1);
  const malformed = await handleTrack(trackRequest("{nope", cookie), { secret: S, store });
  assert.equal(malformed.status, 400);
  const wrongShape = await handleTrack(trackRequest(JSON.stringify({ events: [{ kind: "slide" }] }), cookie), { secret: S, store });
  assert.equal(wrongShape.status, 400);
  const big = await handleTrack(trackRequest("x".repeat(5000), cookie), { secret: S, store });
  assert.equal(big.status, 413);
  const declared = await handleTrack(trackRequest(JSON.stringify(GOOD), cookie, { "content-length": "999999" }), { secret: S, store });
  assert.equal(declared.status, 413);
  assert.equal(store.events.length, 0);
});

test("endpoint: no session, a forged cookie, or a foreign origin store nothing", async () => {
  const store = new FakeStore();
  const body = JSON.stringify(GOOD);
  assert.equal((await handleTrack(trackRequest(body), { secret: S, store })).status, 401);
  const forged = `${SESSION_COOKIE}=${(await sessionCookieFor("a@b.com", 1)).split("=")[1]}x`;
  assert.equal((await handleTrack(trackRequest(body, forged), { secret: S, store })).status, 401);
  const cookie = await sessionCookieFor("a@b.com", 1);
  assert.equal((await handleTrack(trackRequest(body, cookie, { origin: "https://evil.example" }), { secret: S, store })).status, 403);
  assert.equal(store.events.length, 0);
});

test("endpoint: a visit that is full gets 429; an unconfigured database gets 503", async () => {
  const cookie = await sessionCookieFor("a@b.com", 1);
  const full = new FakeStore();
  full.full = true;
  assert.equal((await handleTrack(trackRequest(JSON.stringify(GOOD), cookie), { secret: S, store: full })).status, 429);
  assert.equal((await handleTrack(trackRequest(JSON.stringify(GOOD), cookie), { secret: S, store: null })).status, 503);
  assert.equal((await handleTrack(trackRequest(JSON.stringify(GOOD), cookie), { secret: null, store: full })).status, 500);
});
