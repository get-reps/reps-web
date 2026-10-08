import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler, { runtime } from "./echo-set.ts";

const store = "https://apps.apple.com/app/id6759216018";
const urls = [
  "https://www.getreps.io/echo-set?id=6fbabe3e-d683-4ac6-b795-2ae8ba258e26",
  "https://www.getreps.io/echo-set?unknown=value&to=https://evil.test",
  "https://www.getreps.io/echo-set?id=first&id=second",
  "https://www.getreps.io/echo-set",
];

for (const url of urls) {
  test(`fallback discards incoming query: ${url}`, async () => {
    // Vercel passes a Request at runtime even though the handler needs no input.
    const invoke = handler as (_request: Request) => Response;
    const response = invoke(new Request(url));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), store);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
  });
}

test("fallback requires no request and performs no network/access lookup", async () => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("fallback must not fetch content or access"); };
  try {
    assert.equal(handler().headers.get("location"), store);
    assert.equal(runtime, "edge");
  } finally {
    globalThis.fetch = priorFetch;
  }
});

test("public set route reaches the query-stripping handler instead of a static redirect", () => {
  const routes = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(routes.rewrites.filter((route: { source: string }) => route.source === "/echo-set"), [
    { source: "/echo-set", destination: "/api/echo-set" },
  ]);
  assert.equal(routes.redirects.some((route: { source: string }) => route.source === "/echo-set"), false);
});
