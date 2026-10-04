import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ENDPOINT,
  cleanAvatarUrl,
  cleanFirstName,
  fetchInvitePreview,
  headlineName,
  normalizeCode,
  parsePreview,
} from "../js/invite-preview.js";

const CODE = "ABCD2345";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parsePreview — only a first name and an https picture ever get through", () => {
  test("a good response becomes a personalized preview", () => {
    assert.deepEqual(
      parsePreview({ first_name: "Sam", avatar_url: "https://x.supabase.co/a.jpg" }),
      { firstName: "Sam", avatarUrl: "https://x.supabase.co/a.jpg" },
    );
  });

  test("the generic shape (both null) is no preview at all", () => {
    assert.equal(parsePreview({ first_name: null, avatar_url: null }), null);
  });

  test("a picture without a name is never shown on its own", () => {
    assert.equal(parsePreview({ first_name: null, avatar_url: "https://x/a.jpg" }), null);
  });

  test("a name without a usable picture keeps the name", () => {
    assert.deepEqual(parsePreview({ first_name: "Sam", avatar_url: "http://x/a.jpg" }), {
      firstName: "Sam",
      avatarUrl: null,
    });
  });

  test("junk bodies are no preview", () => {
    for (const body of [null, undefined, "Sam", 42, [], { first_name: 7 }]) {
      assert.equal(parsePreview(body), null);
    }
  });

  test("a full name is cut to its first word, and capped in length", () => {
    assert.equal(cleanFirstName("  Sam   Jones "), "Sam");
    assert.equal(cleanFirstName("A".repeat(60))?.length, 24);
    assert.equal(cleanFirstName("Zoë"), "Zoë");
  });

  test("names with no letters or with markup are refused or stripped", () => {
    assert.equal(cleanFirstName("   "), null);
    assert.equal(cleanFirstName("1234"), null);
    assert.equal(cleanFirstName("<script>"), "script");
    assert.equal(cleanFirstName("<>"), null);
  });

  test("only https picture URLs are accepted", () => {
    assert.equal(cleanAvatarUrl("javascript:alert(1)"), null);
    assert.equal(cleanAvatarUrl("data:image/png;base64,AAAA"), null);
    assert.equal(cleanAvatarUrl("/relative.png"), null);
    assert.equal(cleanAvatarUrl("https://" + "a".repeat(2100)), null);
    assert.equal(cleanAvatarUrl("https://x.supabase.co/a.jpg"), "https://x.supabase.co/a.jpg");
  });
});

describe("fetchInvitePreview — every failure lands on the generic page", () => {
  test("calls the contract endpoint with the normalized code and no cookies", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const preview = await fetchInvitePreview(" abcd2345 ", {
      fetchImpl: async (url, init) => {
        seenUrl = String(url);
        seenInit = init;
        return jsonResponse({ first_name: "Sam", avatar_url: null });
      },
    });
    assert.equal(seenUrl, `${ENDPOINT}?code=${CODE}`);
    assert.equal(seenInit?.credentials, "omit");
    assert.deepEqual(preview, { firstName: "Sam", avatarUrl: null });
  });

  test("an invalid code never makes a request", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return jsonResponse({ first_name: "Sam" });
    };
    for (const code of ["", "short", "ABCD234I", "ABCD23450"]) {
      assert.equal(await fetchInvitePreview(code, { fetchImpl }), null);
    }
    assert.equal(called, false);
  });

  test("404 (endpoint not built yet) → generic", async () => {
    const preview = await fetchInvitePreview(CODE, {
      fetchImpl: async () => new Response("Not found", { status: 404 }),
    });
    assert.equal(preview, null);
  });

  test("500 → generic", async () => {
    const preview = await fetchInvitePreview(CODE, {
      fetchImpl: async () => jsonResponse({ first_name: "Sam" }, 500),
    });
    assert.equal(preview, null);
  });

  test("offline (fetch throws) → generic", async () => {
    const preview = await fetchInvitePreview(CODE, {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    assert.equal(preview, null);
  });

  test("non-JSON body → generic", async () => {
    const preview = await fetchInvitePreview(CODE, {
      fetchImpl: async () => new Response("<html>", { status: 200 }),
    });
    assert.equal(preview, null);
  });

  test("a slow lookup gives up on time, even if fetch ignores the abort", async () => {
    const started = Date.now();
    const preview = await fetchInvitePreview(CODE, {
      timeoutMs: 50,
      fetchImpl: () => new Promise<Response>(() => {}),
    });
    assert.equal(preview, null);
    assert.ok(Date.now() - started < 1000);
  });

  test("the headline falls back to 'A friend'", () => {
    assert.equal(headlineName(null), "A friend");
    assert.equal(headlineName({ firstName: "Sam", avatarUrl: null }), "Sam");
  });
});

describe("invite.html — generic page is complete without JS, CTAs untouched", () => {
  const html = readFileSync(fileURLToPath(new URL("../invite.html", import.meta.url)), "utf8");

  test("static markup already reads as the generic invite", () => {
    assert.match(html, /<span class="name" id="inviter-name">A friend<\/span> is inviting you to REPS/);
  });

  test("no emoji characters anywhere on the page", () => {
    assert.doesNotMatch(html, /&#1[0-9]{5};|\p{Extended_Pictographic}/u);
  });

  test("the store and app links keep their existing destinations", () => {
    assert.match(html, /href="https:\/\/apps\.apple\.com\/app\/id6759216018"/);
    assert.match(html, /'https:\/\/repsapp\.onelink\.me\/1zdF' \+/);
    assert.match(html, /'reps:\/\/invite\?code=' \+ encodeURIComponent\(code\)/);
  });

  test("the inviter's name is written as text, never as HTML", () => {
    assert.match(html, /nameEl\.textContent = preview\.firstName/);
    assert.doesNotMatch(html, /innerHTML/);
  });
});
