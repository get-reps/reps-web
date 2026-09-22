#!/usr/bin/env node
// Offline check on scripts/add-creator-apple-campaign-slugs.sql.
//
// The gateway's silent killer is that api/resolve.ts FAILS OPEN: a destination whose
// host is not in ALLOWED_HOSTS 302s every visitor to the homepage with nothing anywhere
// to say so. A substring check for "pt=" / "ct=" would happily pass a typo in the host,
// the scheme or the app id. So this compares the SQL's URL literals to the live kendra
// destination by exact string equality, character for character.
//
// Touches no database and needs no credentials, so anyone reviewing or landing this
// branch can re-run it:  node scripts/verify-creator-apple-campaign-sql.mjs
//
// KENDRA_URL below is the destination read from the live `kendra` row in public.links
// (reps-app Supabase, vciosaulrfvddcenblmo) on 2026-09-22, on all three of its
// ios/android/fallback keys. If kendra is ever repointed, this constant goes stale and
// the SQL's own in-transaction assertion — which reads kendra live — is the one that
// still holds.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const KENDRA_URL =
  "https://apps.apple.com/app/id6759216018?pt=128464401&ct=kendra&mt=8";
const ANDROID_URL = "https://www.getreps.io/android";
const SLUGS = ["maria", "enzo"];
// maria and enzo mirror kendra on ios and fallback, and deliberately differ on android:
// kendra sends Android viewers to an iPhone-only App Store listing, these two send them
// to the "Android is coming" page (Mike's call, 2026-09-22).
const APPLE_KEYS_PER_SLUG = 2; // ios, fallback

const here = dirname(fileURLToPath(import.meta.url));
// Optional path argument so the check can be pointed at a deliberately corrupted copy
// to prove it is not vacuous. Defaults to the real file.
const sqlPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(here, "add-creator-apple-campaign-slugs.sql");
const sql = readFileSync(sqlPath, "utf8");

const failures = [];
const note = (msg) => console.log(msg);

const countLiteral = (haystack, value) =>
  haystack.split(`'${value}'`).length - 1;

const expectedFor = (slug) => KENDRA_URL.replace("ct=kendra", `ct=${slug}`);

// Counts are taken against the INSERT statement alone, not the whole file: the header
// comments quote these URLs to explain them, and the assertion declares them as
// constants. Counting the file would tally all three and mean nothing.
const insertMatch = sql.match(/insert\s+into\s+public\.links[\s\S]*?;\s*$/im);
const insertSql = insertMatch ? insertMatch[0] : "";
if (!insertSql) {
  failures.push("could not locate the INSERT INTO public.links statement in the file");
}

// 1. The kendra reference pinned inside the SQL's assertion must be the real one.
if (countLiteral(sql, KENDRA_URL) < 1) {
  failures.push(
    `the SQL does not contain the live kendra destination as a literal, so its assertion is pinned to something else: ${KENDRA_URL}`,
  );
} else {
  note(`ok  kendra reference pinned in the SQL matches the live row`);
}

// 2. Each new slug's tagged App Store URL must appear exactly twice: ios and fallback.
for (const slug of SLUGS) {
  const expected = expectedFor(slug);
  const hits = countLiteral(insertSql, expected);
  if (hits === APPLE_KEYS_PER_SLUG) {
    note(`ok  ${slug}: ${hits}/${APPLE_KEYS_PER_SLUG} Apple-tagged keys carry ${expected}`);
  } else {
    failures.push(
      `${slug}: expected ${APPLE_KEYS_PER_SLUG} occurrences of '${expected}' (ios + fallback), found ${hits}`,
    );
  }
}

// 2b. And the Android page must appear once per slug. An Android viewer must never be
//     sent to the iPhone-only App Store listing.
const androidHits = countLiteral(insertSql, ANDROID_URL);
if (androidHits === SLUGS.length) {
  note(`ok  android: ${androidHits}/${SLUGS.length} rows point at ${ANDROID_URL}`);
} else {
  failures.push(
    `expected ${SLUGS.length} occurrences of '${ANDROID_URL}' (one per slug), found ${androidHits}`,
  );
}

// 3. No other apps.apple.com literal may appear in the insert. A stray one is exactly
//    the typo class that survives a pt=/ct= substring check.
const appStoreLiterals = [
  ...sql.matchAll(/'(https:\/\/apps\.apple\.com[^']*)'/g),
].map((m) => m[1]);
const allowed = new Set([KENDRA_URL, ...SLUGS.map(expectedFor)]);
const stray = [...new Set(appStoreLiterals)].filter((u) => !allowed.has(u));
if (stray.length) {
  failures.push(`unexpected apps.apple.com literal(s): ${stray.join(", ")}`);
} else {
  note(`ok  no stray apps.apple.com literals`);
}

// 4. Both Apple tags present in every one of them, stated explicitly because it is the
//    thing Apple silently drops the whole campaign over.
for (const slug of SLUGS) {
  const expected = expectedFor(slug);
  if (!expected.includes("pt=128464401") || !expected.includes(`ct=${slug}`)) {
    failures.push(`${slug}: derived URL is missing pt= or ct=: ${expected}`);
  }
}

// 5. Nothing invisible hiding in a URL literal.
const nonAscii = appStoreLiterals.filter((u) => /[^\x20-\x7E]/.test(u));
if (nonAscii.length) {
  failures.push(`non-ASCII characters inside URL literal(s): ${nonAscii.join(", ")}`);
} else {
  note(`ok  all URL literals are plain ASCII`);
}

// 6. The insert must not have been softened into an upsert: a duplicate slug has to
//    fail loudly rather than overwrite a permanent slug. Comments are stripped first —
//    the file talks about ON CONFLICT at length in order to explain its absence.
const executable = sql.replace(/--[^\n]*/g, "");
if (/on\s+conflict/i.test(executable)) {
  failures.push(
    "the insert contains ON CONFLICT — a duplicate slug must fail loudly, not no-op",
  );
} else {
  note(`ok  no ON CONFLICT clause (duplicate slugs fail loudly)`);
}

if (failures.length) {
  console.error(`\nFAIL (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `\nPASS — ${sqlPath}: ios/fallback mirror kendra character for character, android goes to the "Android is coming" page.`,
);
