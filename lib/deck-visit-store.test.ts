import { test } from "node:test";
import assert from "node:assert/strict";

import { createRestStore, createSlackThreadPoster, storeFromEnv } from "./deck-visit-store.js";
import { postSlackAlert, slackBotToken } from "./deck-gate.js";

type Call = { url: string; method: string; headers: Record<string, string>; body: string | null };

function stubFetch(reply: (c: Call) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
      body: typeof init?.body === "string" ? init.body : null,
    };
    calls.push(call);
    const r = reply(call);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: r.headers,
    });
  }) as typeof fetch;
  return { impl, calls };
}

const T0 = 1_760_000_000_000;
const store = (impl: typeof fetch) => createRestStore({ url: "https://p.supabase.co/", serviceRoleKey: "k", fetchImpl: impl });

test("claim takes the slot only when exactly one unreplied row was updated", async () => {
  const row = {
    id: "v1", kind: "reading_code", scope: "session", email: "a@b.com",
    alerted_at: new Date(T0).toISOString(), window_start: new Date(T0).toISOString(),
    channel: "C1", thread_ts: "1.1", replied_at: null, dropped_at: null, attempts: 0,
  };
  const won = stubFetch(() => ({ body: [row] }));
  const v = await store(won.impl).claim("v1", T0 + 1);
  assert.equal(v?.threadTs, "1.1");
  const url = won.calls[0].url;
  assert.match(url, /\/rest\/v1\/deck_visits\?/);
  assert.match(url, /id=eq\.v1/);
  assert.match(url, /replied_at=is\.null/);
  assert.match(url, /dropped_at=is\.null/);
  assert.equal(won.calls[0].method, "PATCH");
  assert.equal(won.calls[0].headers.Authorization, "Bearer k");

  const lost = stubFetch(() => ({ body: [] }));
  assert.equal(await store(lost.impl).claim("v1", T0), null);
});

test("registerVisit ignores duplicates instead of overwriting", async () => {
  const f = stubFetch(() => ({ status: 201 }));
  await store(f.impl).registerVisit({
    id: "v1", kind: "reading_code", scope: "session", email: "a@b.com",
    alertedAt: T0, windowStart: T0, channel: "C1", threadTs: "1.1",
  });
  assert.match(f.calls[0].url, /on_conflict=id/);
  assert.match(f.calls[0].headers.Prefer, /ignore-duplicates/);
});

test("dueVisits asks the database for unreplied, undropped visits at least 30 minutes old", async () => {
  const f = stubFetch(() => ({ body: [] }));
  await store(f.impl).dueVisits(T0, 30 * 60 * 1000);
  const url = decodeURIComponent(f.calls[0].url);
  assert.match(url, /replied_at=is\.null/);
  assert.match(url, /dropped_at=is\.null/);
  assert.match(url, new RegExp(`alerted_at=lte\\.${new Date(T0 - 30 * 60 * 1000).toISOString()}`));
});

test("insertEvents refuses once a visit holds the maximum, and writes only whitelisted columns", async () => {
  const full = stubFetch(() => ({ headers: { "content-range": "0-0/400" } }));
  assert.equal(await store(full.impl).insertEvents("v1", "a@b.com", [{ kind: "slide", slide: "A", slideIndex: 1, ms: 1000 }]), false);
  assert.equal(full.calls.length, 1, "no insert after the count says full");

  const room = stubFetch((c) => (c.method === "HEAD" ? { headers: { "content-range": "0-0/3" } } : { status: 201 }));
  assert.equal(
    await store(room.impl).insertEvents("v1", "a@b.com", [{ kind: "video", slide: "A", slideIndex: 1, ms: 1000, durationMs: 5000 }]),
    true,
  );
  const rows = JSON.parse(room.calls[1].body!) as Array<Record<string, unknown>>;
  assert.deepEqual(Object.keys(rows[0]).sort(), ["duration_ms", "email", "kind", "ms", "slide", "slide_index", "visit_id"]);
});

test("a database error surfaces as a thrown error (callers decide what that means)", async () => {
  const f = stubFetch(() => ({ status: 500 }));
  await assert.rejects(store(f.impl).drop("v1", T0), /500/);
});

test("the thread poster sends thread_ts and reports Slack's refusal", async () => {
  const ok = stubFetch(() => ({ body: { ok: true, ts: "2.2" } }));
  const post = createSlackThreadPoster({ token: "xoxb-test", fetchImpl: ok.impl });
  assert.deepEqual(await post({ channel: "C1", thread_ts: "1.1", text: "hi" }), { ok: true });
  const sent = JSON.parse(ok.calls[0].body!);
  assert.equal(sent.thread_ts, "1.1");
  assert.equal(sent.channel, "C1");
  assert.equal(sent.reply_broadcast, false);
  assert.equal(ok.calls[0].headers.Authorization, "Bearer xoxb-test");

  const no = stubFetch(() => ({ body: { ok: false, error: "not_in_channel" } }));
  assert.deepEqual(await createSlackThreadPoster({ token: "t", fetchImpl: no.impl })({ channel: "C1", thread_ts: "1.1", text: "x" }), {
    ok: false,
    error: "not_in_channel",
    definite: true,
  });
});

test("the thread poster only calls a failure definite when Slack itself said no", async () => {
  const post = (impl: typeof fetch) => createSlackThreadPoster({ token: "t", fetchImpl: impl })({ channel: "C1", thread_ts: "1.1", text: "x" });
  const rateLimited = await post(stubFetch(() => ({ status: 429, body: { ok: false, error: "ratelimited" } })).impl);
  assert.equal(rateLimited.definite, true);
  const gatewayError = await post(stubFetch(() => ({ status: 502 })).impl);
  assert.equal(gatewayError.ok, false);
  assert.equal(gatewayError.definite, false);
  const dropped = await post((async () => {
    throw new Error("socket hang up");
  }) as typeof fetch);
  assert.equal(dropped.ok, false);
  assert.equal(dropped.definite, false);
});

test("an unreadable event count fails loudly instead of switching the cap off", async () => {
  const f = stubFetch(() => ({}));
  await assert.rejects(
    store(f.impl).insertEvents("v1", "a@b.com", [{ kind: "slide", slide: "A", slideIndex: 1, ms: 1000 }]),
    /count missing/,
  );
  assert.equal(f.calls.length, 1, "nothing inserted");
});

/* ── alert posting that returns a message id ────────────────────────────── */

function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  const penv = (process as unknown as { env: Record<string, string | undefined> }).env;
  for (const k of Object.keys(env)) {
    saved[k] = penv[k];
    if (env[k] === undefined) delete penv[k];
    else penv[k] = env[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete penv[k];
      else penv[k] = saved[k];
    }
  });
}

async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const BOT_ENV = {
  SLACK_SUPPORT_BOT_TOKEN: "xoxb-test",
  SLACK_SUPPORT_CHANNEL_ID: "C0SUPPORT",
  SLACK_SUPPORT_WEBHOOK_URL: "https://hooks.slack.test/abc",
};

test("with the bot configured, the alert is posted via chat.postMessage and returns its ts", async () => {
  const f = stubFetch(() => ({ body: { ok: true, ts: "1760.0001", channel: "C0SUPPORT" } }));
  const posted = await withEnv(BOT_ENV, () => withFetch(f.impl, () => postSlackAlert({ text: "Angel deck: opened by a@b.com" })));
  assert.deepEqual(posted, { ok: true, channel: "C0SUPPORT", ts: "1760.0001" });
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].url, /chat\.postMessage/);
  assert.equal(JSON.parse(f.calls[0].body!).channel, "C0SUPPORT");
});

test("if chat.postMessage fails the alert still goes out by webhook, with no ts", async () => {
  const f = stubFetch((c) => (c.url.includes("slack.com/api") ? { body: { ok: false, error: "not_in_channel" } } : { status: 200 }));
  const quiet = console.error;
  console.error = () => {};
  try {
    const posted = await withEnv(BOT_ENV, () => withFetch(f.impl, () => postSlackAlert({ text: "x" })));
    assert.deepEqual(posted, { ok: true, channel: null, ts: null });
    assert.equal(f.calls.length, 2);
    assert.match(f.calls[1].url, /hooks\.slack\.test/);
  } finally {
    console.error = quiet;
  }
});

test("the existing SLACK_BOT_TOKEN carries the alert and is the token that is sent", async () => {
  const f = stubFetch(() => ({ body: { ok: true, ts: "1760.0002", channel: "C0SUPPORT" } }));
  const posted = await withEnv(
    { SLACK_SUPPORT_BOT_TOKEN: undefined, SLACK_BOT_TOKEN: "xoxb-existing", SLACK_SUPPORT_CHANNEL_ID: "C0SUPPORT", SLACK_SUPPORT_WEBHOOK_URL: "https://hooks.slack.test/abc" },
    () => withFetch(f.impl, () => postSlackAlert({ text: "x" })),
  );
  assert.deepEqual(posted, { ok: true, channel: "C0SUPPORT", ts: "1760.0002" });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers.Authorization, "Bearer xoxb-existing");
});

test("SLACK_SUPPORT_BOT_TOKEN wins over SLACK_BOT_TOKEN when both are set", async () => {
  await withEnv({ SLACK_SUPPORT_BOT_TOKEN: "xoxb-override", SLACK_BOT_TOKEN: "xoxb-existing" }, async () => {
    assert.equal(slackBotToken(), "xoxb-override");
  });
  await withEnv({ SLACK_SUPPORT_BOT_TOKEN: undefined, SLACK_BOT_TOKEN: "xoxb-existing" }, async () => {
    assert.equal(slackBotToken(), "xoxb-existing");
  });
  await withEnv({ SLACK_SUPPORT_BOT_TOKEN: "", SLACK_BOT_TOKEN: "xoxb-existing" }, async () => {
    assert.equal(slackBotToken(), "xoxb-existing", "an empty override is not a token");
  });
  await withEnv({ SLACK_SUPPORT_BOT_TOKEN: undefined, SLACK_BOT_TOKEN: undefined }, async () => {
    assert.equal(slackBotToken(), null);
  });
});

test("a bot token without a channel id keeps alerts on the webhook exactly as before", async () => {
  const f = stubFetch(() => ({ status: 200 }));
  const posted = await withEnv(
    { SLACK_SUPPORT_BOT_TOKEN: undefined, SLACK_BOT_TOKEN: "xoxb-existing", SLACK_SUPPORT_CHANNEL_ID: undefined, SLACK_SUPPORT_WEBHOOK_URL: "https://hooks.slack.test/abc" },
    () => withFetch(f.impl, () => postSlackAlert({ text: "x" })),
  );
  assert.deepEqual(posted, { ok: true, channel: null, ts: null });
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].url, /hooks\.slack\.test/);
});

test("the deck store reads only the DECK_* database settings", async () => {
  const none = { DECK_SUPABASE_URL: undefined, DECK_SUPABASE_SERVICE_ROLE_KEY: undefined };
  await withEnv({ ...none, SUPABASE_URL: "https://support.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "support-key" }, async () => {
    assert.equal(storeFromEnv(), null, "the generic names alone must not switch tracking on");
  });
  await withEnv({ ...none, DECK_SUPABASE_URL: "https://cockpit.supabase.co", SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    assert.equal(storeFromEnv(), null, "a URL without its key is not configured");
  });
  await withEnv(
    { DECK_SUPABASE_URL: "https://cockpit.supabase.co", DECK_SUPABASE_SERVICE_ROLE_KEY: "deck-key", SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
    async () => {
      assert.ok(storeFromEnv(), "the DECK_* pair alone is enough");
    },
  );
});

test("the deck store sends requests to the DECK_* project with the DECK_* key", async () => {
  const f = stubFetch(() => ({ body: [] }));
  await withEnv(
    { DECK_SUPABASE_URL: "https://cockpit.supabase.co", DECK_SUPABASE_SERVICE_ROLE_KEY: "deck-key", SUPABASE_URL: "https://support.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "support-key" },
    () => withFetch(f.impl, () => storeFromEnv()!.prune(T0)),
  );
  assert.ok(f.calls.length > 0);
  for (const c of f.calls) {
    assert.match(c.url, /^https:\/\/cockpit\.supabase\.co\//);
    assert.ok(Object.values(c.headers).every((v) => !v.includes("support-key")));
    assert.ok(Object.values(c.headers).some((v) => v.includes("deck-key")));
  }
});

test("without the bot settings the alert goes out by webhook exactly as before", async () => {
  const f = stubFetch(() => ({ status: 200 }));
  const posted = await withEnv(
    { SLACK_SUPPORT_BOT_TOKEN: undefined, SLACK_BOT_TOKEN: undefined, SLACK_SUPPORT_CHANNEL_ID: undefined, SLACK_SUPPORT_WEBHOOK_URL: "https://hooks.slack.test/abc" },
    () => withFetch(f.impl, () => postSlackAlert({ text: "x" })),
  );
  assert.deepEqual(posted, { ok: true, channel: null, ts: null });
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].url, /hooks\.slack\.test/);
});
