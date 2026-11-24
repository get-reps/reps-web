// Markdown twins of the sitemap pages (scripts/build-markdown.mjs). Fails when a twin is missing, thin or stale, or when
// vercel.json lacks the headers that point agents at it. Fix a failure with: node scripts/build-markdown.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pages, render, lf, ROOT, ORIGIN } from './build-markdown.mjs';

const all = pages();
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const headersFor = (source) =>
  Object.fromEntries((vercel.headers.find((h) => h.source === source && !h.has)?.headers || []).map((h) => [h.key.toLowerCase(), h.value]));

test('the sitemaps list the pages we expect to mirror', () => {
  assert.ok(all.length >= 18, `only ${all.length} sitemap URLs`);
  assert.ok(all.some((p) => p.path === '/'));
});

for (const page of all) {
  test(`${page.path}: twin ${page.twin} exists, is substantial and is up to date`, () => {
    const file = join(ROOT, page.twin);
    assert.ok(existsSync(file), `missing ${page.twin}: run node scripts/build-markdown.mjs`);
    const onDisk = lf(readFileSync(file, 'utf8'));
    assert.ok(onDisk.length > 300, `${page.twin} is only ${onDisk.length} chars`);
    assert.equal(onDisk, render(page), `${page.twin} is stale: run node scripts/build-markdown.mjs`);
  });

  test(`${page.path}: vercel.json advertises the twin and serves it as Markdown`, () => {
    const pageHeaders = headersFor(page.path);
    assert.equal(pageHeaders.link, `<${page.twinUrl}>; rel="alternate"; type="text/markdown"`, `vercel.json: add a Link header on ${page.path}`);
    const twinHeaders = headersFor(`/${page.twin}`);
    assert.equal(twinHeaders['content-type'], 'text/markdown; charset=utf-8', `vercel.json: Content-Type on /${page.twin}`);
    const canonical = page.path === '/' ? `${ORIGIN}/` : `${ORIGIN}${page.path}`;
    assert.equal(twinHeaders.link, `<${canonical}>; rel="canonical"`, `vercel.json: canonical Link on /${page.twin}`);
  });
}

test('homepage twin carries the hero headline that only JavaScript paints on the page', () => {
  const home = lf(readFileSync(join(ROOT, 'home.md'), 'utf8'));
  assert.match(home, /^# Turn what you consume/m);
});

// Accept: text/markdown is answered by middleware.ts (tested in middleware.test.ts); here, every page's
// HTML response must say it varies on Accept so caches keep the two answers apart.
test('every page varies on Accept, and no vercel.json rewrite competes with the middleware', () => {
  for (const page of all) assert.equal(headersFor(page.path).vary, 'Accept', `vercel.json: Vary: Accept on ${page.path}`);
  assert.ok(!vercel.rewrites.some((r) => r.destination.endsWith('.md')), 'markdown negotiation lives in middleware.ts');
});
