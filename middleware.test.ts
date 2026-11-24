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

const md = (path: string, method = "GET") =>
  handle(new Request(`https://www.getreps.io${path}`, { method, headers: { accept: "text/markdown" } }));

test("a markdown request is rewritten to the page's static twin, varying on Accept", () => {
  for (const [path, twin] of [["/about", "/about.md"], ["/", "/home.md"], ["/compare/reps-vs-readwise", "/compare/reps-vs-readwise.md"]]) {
    const res = md(path);
    assert.ok(res, path);
    assert.equal(res.headers.get("x-middleware-rewrite"), `https://www.getreps.io${twin}`);
    assert.equal(res.headers.get("vary"), "Accept");
  }
  assert.equal(md("/facts", "HEAD")?.headers.get("x-middleware-rewrite"), "https://www.getreps.io/facts.md");
});

test("browsers, unknown paths and POSTs fall through to HTML untouched", () => {
  assert.equal(handle(new Request("https://www.getreps.io/about", { headers: { accept: BROWSER } })), undefined);
  assert.equal(handle(new Request("https://www.getreps.io/about")), undefined);
  assert.equal(md("/support"), undefined);
  assert.equal(md("/about.md"), undefined);
  assert.equal(md("/about", "POST"), undefined);
});
