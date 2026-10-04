import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  CACHE_CONTROL,
  createFixedWindowLimiter,
  createInvitePreviewHandler,
  type InvitePreviewLookup,
} from "../lib/invite-preview-handler.ts";

// api/invite-preview.ts is a thin wiring shim (env vars -> createInvitePreviewHandler +
// createRpcLookup) with nothing of its own to unit test; the behaviour under test here is the
// vendored handler it wires up, exercised the same way the route itself calls it.

const CODE = "ABCD2345";
const PROJECT = "https://vciosaulrfvddcenblmo.supabase.co";
const AVATAR = `${PROJECT}/storage/v1/object/public/avatars/sam.jpg`;
const GENERIC = { first_name: null, avatar_url: null };

function fakeLookup(rows: Record<string, unknown>): { lookup: InvitePreviewLookup; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    lookup: async (code) => {
      calls.push(code);
      return rows[code] ?? GENERIC;
    },
  };
}

function get(query: string): Request {
  return new Request(`https://getreps.io/api/invite-preview${query}`, {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  });
}

describe("GET /api/invite-preview — mocked lookup", () => {
  test("public inviter: 200 with first name + photo, cached", async () => {
    const db = fakeLookup({ [CODE]: { first_name: "Sam", avatar_url: AVATAR } });
    const handler = createInvitePreviewHandler({ lookup: db.lookup, supabaseUrl: PROJECT });
    const res = await handler(get(`?code=${CODE}`));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { first_name: "Sam", avatar_url: AVATAR });
    assert.equal(res.headers.get("cache-control"), CACHE_CONTROL);
  });

  test("unknown code: generic 200, still cached", async () => {
    const db = fakeLookup({});
    const handler = createInvitePreviewHandler({ lookup: db.lookup, supabaseUrl: PROJECT });
    const res = await handler(get("?code=ZZZZZZZZ"));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), GENERIC);
    assert.equal(res.headers.get("cache-control"), CACHE_CONTROL);
  });

  test("malformed code: generic 200 without reaching the database", async () => {
    const db = fakeLookup({ [CODE]: { first_name: "Sam", avatar_url: AVATAR } });
    const handler = createInvitePreviewHandler({ lookup: db.lookup, supabaseUrl: PROJECT });
    for (const query of ["", "?code=", "?code=SHORT", "?code=ABCD23450", "?code=ABCDI234"]) {
      const res = await handler(get(query));
      assert.equal(res.status, 200, query);
      assert.deepEqual(await res.json(), GENERIC, query);
    }
    assert.equal(db.calls.length, 0, "no malformed code should reach the lookup");
  });

  test("lookup throwing: degrades to generic 200, never 500", async () => {
    const handler = createInvitePreviewHandler({
      lookup: async () => {
        throw new Error("db down");
      },
      supabaseUrl: PROJECT,
    });
    const res = await handler(get(`?code=${CODE}`));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), GENERIC);
  });

  test("rate-limited caller: 429 generic, uncached, no database call", async () => {
    const db = fakeLookup({ [CODE]: { first_name: "Sam", avatar_url: AVATAR } });
    const handler = createInvitePreviewHandler({
      lookup: db.lookup,
      supabaseUrl: PROJECT,
      limiter: createFixedWindowLimiter({ limit: 1, windowMs: 60_000 }),
    });
    const first = await handler(get(`?code=${CODE}`));
    assert.equal(first.status, 200);
    const second = await handler(get(`?code=${CODE}`));
    assert.equal(second.status, 429);
    assert.deepEqual(await second.json(), GENERIC);
    assert.equal(second.headers.get("cache-control"), "no-store");
    assert.equal(db.calls.length, 1, "the throttled request must not reach the database");
  });
});
