#!/usr/bin/env node
/**
 * IndexNow ping — tells Bing (and IndexNow partners) that URLs are new/updated.
 *
 * WHY THIS MATTERS FOR REPS: ChatGPT sources a large share of its citations from
 * top Bing results, so fast Bing indexing is disproportionately valuable for the
 * GEO/answer-engine goal (GTM item 9). IndexNow is the fastest way to nudge Bing.
 *
 * KEY (public, not a secret): a3f9c1e7b28d4f6a9c05e1b7d84f2a60
 *   The matching key file is hosted at:
 *   https://getreps.io/a3f9c1e7b28d4f6a9c05e1b7d84f2a60.txt
 *   IndexNow verifies ownership by fetching that file, so it MUST be deployed
 *   (live) before this ping will be accepted.
 *
 * WHEN TO RUN (Mike, post-deploy): AFTER the /compare pages are deployed and
 * reachable. Do NOT ping URLs that are not yet live — IndexNow validates that the
 * URLs exist. Run again whenever you publish or meaningfully update a page.
 *
 *   node scripts/indexnow-ping.mjs                 # pings the default REPS URL set below
 *   node scripts/indexnow-ping.mjs https://getreps.io/compare/best-anki-alternatives
 *                                                  # pings only the URL(s) you pass
 *
 * No dependencies (Node 18+ global fetch). Exits non-zero on a non-2xx response.
 */

const KEY = "a3f9c1e7b28d4f6a9c05e1b7d84f2a60";
const HOST = "getreps.io";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

const DEFAULT_URLS = [
  `https://${HOST}/compare`,
  `https://${HOST}/compare/best-apps-to-remember-what-you-read`,
  `https://${HOST}/compare/best-readwise-alternatives`,
  `https://${HOST}/compare/best-spaced-repetition-apps`,
  `https://${HOST}/compare/best-anki-alternatives`,
  `https://${HOST}/compare/reps-vs-readwise`,
  `https://${HOST}/compare/best-pocket-alternatives`,
  `https://${HOST}/compare/best-obsidian-alternatives`,
  `https://${HOST}/blog`,
];

const urlList = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;

// Guard: every URL must be on our host (IndexNow rejects cross-host lists).
const bad = urlList.filter((u) => {
  try {
    return new URL(u).hostname !== HOST;
  } catch {
    return true;
  }
});
if (bad.length) {
  console.error(`Refusing to ping — these are not https://${HOST} URLs:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}

const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

console.log(`IndexNow ping to ${ENDPOINT}`);
console.log(`  keyLocation: ${KEY_LOCATION}`);
console.log(`  urls (${urlList.length}):`);
urlList.forEach((u) => console.log(`    ${u}`));

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(`\nHTTP ${res.status} ${res.statusText}`);
if (text.trim()) console.log(text.trim());

// IndexNow returns 200 (accepted) or 202 (accepted, pending). Anything else is a failure.
if (res.status !== 200 && res.status !== 202) {
  console.error(
    "\nPing was NOT accepted. Common causes: the key file is not live yet " +
      `(${KEY_LOCATION}), or a URL is not reachable. Deploy first, then retry.`,
  );
  process.exit(1);
}
console.log("\nAccepted. Bing will crawl these URLs shortly.");
