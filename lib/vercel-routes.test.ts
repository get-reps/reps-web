import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Route = { source: string; destination: string; permanent?: boolean };
const config = JSON.parse(
  readFileSync(fileURLToPath(new URL("../vercel.json", import.meta.url)), "utf8"),
) as { cleanUrls?: boolean; rewrites: Route[]; redirects: Route[] };

test("with cleanUrls on, no route destination points at a .html file", () => {
  assert.equal(config.cleanUrls, true);
  for (const r of [...config.rewrites, ...config.redirects]) {
    assert.ok(
      !/\.html(\?|$)/.test(r.destination),
      `${r.source} -> ${r.destination} must be extensionless (cleanUrls 404s .html rewrites)`,
    );
  }
});

test("/i/<code> redirects to /invite with the code in the real URL, so invite.html can read it", () => {
  const r = config.redirects.find((x) => x.source === "/i/:code");
  assert.ok(r, "missing /i/:code redirect");
  assert.equal(r.destination, "/invite?code=:code");
});

test("every other /i/ address (/i, /i/, /i/a/b) is caught and sent to the invite page", () => {
  const r = config.rewrites.find((x) => x.source === "/i/:path*");
  assert.ok(r, "missing /i/:path* catch-all");
  assert.equal(r.destination, "/invite");
});
