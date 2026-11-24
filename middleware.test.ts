import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config, handle, MARKDOWN_TWINS, wantsMarkdown } from "./middleware.ts";

const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const sitemapPaths = ["sitemap-pages.xml", "sitemap-compare.xml", "sitemap-features.xml"]
  .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<loc>https:\/\/www\.getreps\.io([^<]*)<\/loc>/g)].map((m) => m[1] || "/"))
  .sort();

test("matcher, twin map and sitemaps list the same pages", () => {
  assert.deepEqual([...config.matcher].sort(), sitemapPaths);
  assert.deepEqual(Object.keys(MARKDOWN_TWINS).sort(), sitemapPaths);
  for (const md of Object.values(MARKDOWN_TWINS)) assert.ok(readFileSync(`.${md}`, "utf8").length > 300, md);
});

test("only an Accept that asks for markdown matches", () => {
  assert.equal(wantsMarkdown(BROWSER), false);
  assert.equal(wantsMarkdown(null), false);
  assert.equal(wantsMarkdown("*/*"), false);
  assert.equal(wantsMarkdown("text/markdown"), true);
  assert.equal(wantsMarkdown("text/markdown, text/html;q=0.9"), true);
  assert.equal(wantsMarkdown("text/html, text/markdown;q=0.5"), true);
  assert.equal(wantsMarkdown("text/html, text/markdown;q=0"), false);
});

const okFetch = (seen: string[]) =>
  (async (u: string | URL | Request) => {
    seen.push(String(u));
    return new Response("# About REPS\n", { status: 200, headers: { Link: '<https://www.getreps.io/about>; rel="canonical"' } });
  }) as typeof fetch;

test("a markdown request for a page gets its twin with Vary: Accept", async () => {
  const seen: string[] = [];
  const res = await handle(new Request("https://www.getreps.io/about", { headers: { accept: "text/markdown" } }), okFetch(seen));
  assert.ok(res);
  assert.deepEqual(seen, ["https://www.getreps.io/about.md"]);
  assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(res.headers.get("vary"), "Accept");
  assert.match(res.headers.get("link") ?? "", /rel="canonical"/);
  assert.equal(await res.text(), "# About REPS\n");
});

test("the homepage maps to home.md", async () => {
  const seen: string[] = [];
  await handle(new Request("https://www.getreps.io/", { headers: { accept: "text/markdown" } }), okFetch(seen));
  assert.deepEqual(seen, ["https://www.getreps.io/home.md"]);
});

test("browsers, unknown paths and POSTs fall through to HTML untouched", async () => {
  const seen: string[] = [];
  assert.equal(await handle(new Request("https://www.getreps.io/about", { headers: { accept: BROWSER } }), okFetch(seen)), undefined);
  assert.equal(await handle(new Request("https://www.getreps.io/support", { headers: { accept: "text/markdown" } }), okFetch(seen)), undefined);
  assert.equal(
    await handle(new Request("https://www.getreps.io/about", { method: "POST", headers: { accept: "text/markdown" } }), okFetch(seen)),
    undefined,
  );
  assert.deepEqual(seen, []);
});

test("a missing or failing twin falls back to HTML instead of erroring", async () => {
  const notFound = (async () => new Response("nope", { status: 404 })) as typeof fetch;
  const thrower = (async () => {
    throw new Error("network");
  }) as typeof fetch;
  const req = () => new Request("https://www.getreps.io/facts", { headers: { accept: "text/markdown" } });
  assert.equal(await handle(req(), notFound), undefined);
  assert.equal(await handle(req(), thrower), undefined);
});
