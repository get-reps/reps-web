import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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

function settingsRedirect(to: string, userAgent = "iPhone", attribution = "") {
  const html = readFileSync(new URL("../r.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  let href = "https://apps.apple.com/app/id6759216018";
  let autoOpened = "";
  vm.runInNewContext(script, {
    URLSearchParams,
    navigator: { userAgent },
    document: { getElementById: () => ({ setAttribute: (_: string, value: string) => { href = value; } }) },
    window: { location: { search: `?to=${encodeURIComponent(to)}${attribution}`, set href(value: string) { autoOpened = value; } } },
    setTimeout: (fn: () => void) => fn(),
  });
  return { href, autoOpened };
}

test("iPhone setup targets regular REPS even with REPS Dev installed", () => {
  const p = settingsRedirect("reps://settings?settings=connections");
  assert.equal(p.href, "io.getreps.app://settings?settings=connections");
  assert.equal(p.autoOpened, p.href);
});

test("iPad settings preferences and attribution preserve their exact destination", () => {
  const p = settingsRedirect("reps://settings?settings=email-reminders", "iPad", "&reminder_id=abc&rc=email&rch=founder&rdate=2026-10-13");
  assert.equal(p.href, "io.getreps.app://settings?settings=email-reminders&reminder_id=abc&rc=email&rch=founder&rdate=2026-10-13");
  assert.equal(p.autoOpened, p.href);
});

test("other routes and non-iOS schemes retain existing behavior", () => {
  for (const to of ["reps://login#token_hash=example&type=magiclink", "reps://daily-review", "reps://settings-other?settings=connections", "reps://settings/nested", "reps://settings.example/settings"]) {
    const p = settingsRedirect(to);
    assert.equal(p.href, to);
    assert.equal(p.autoOpened, to);
  }
  assert.equal(settingsRedirect("reps://settings?settings=connections", "Android").href, "reps://settings?settings=connections");
  assert.equal(settingsRedirect("reps://settings?settings=connections", "Desktop").autoOpened, "");
});

test("invalid external destinations never become app launches", () => {
  for (const to of ["", "https://example.invalid", "javascript:alert(1)"]) {
    const p = settingsRedirect(to);
    assert.equal(p.href, "https://apps.apple.com/app/id6759216018");
    assert.equal(p.autoOpened, "");
  }
});
