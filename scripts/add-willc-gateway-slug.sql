-- getreps.io/r/ gateway — Will Cook (pub quizzes), repointable redirect + QR code
-- Crew task 1cc02408-d3d5-408c-8fc1-ff4091a6050f · prepared 2026-09-23 · NOT YET RUN.
--
-- WHAT THIS IS
-- Gateway destinations do not live in this repo. api/resolve.ts is a generic resolver;
-- it reads destinations from public.links in the reps-app Supabase project
-- (vciosaulrfvddcenblmo). So the only way to add a new gateway slug is a production row
-- insert. This file is the repo record of the exact statement; running it IS the live
-- step. Hand it to whoever owns the production database write — do not run it as part
-- of merging this branch.
--
-- WHY getreps.io/r/willc AND NOT A DIRECT APP STORE LINK
-- Mike's explicit call: the QR code printed for Will's pub quizzes must encode
-- https://www.getreps.io/r/willc, not an App Store URL directly. A gateway row is
-- re-pointable (this is api/resolve.ts's whole design, see its own header comment) —
-- so the same printed QR code can later be repointed at a specific pub-quiz set once
-- that feature exists, with no reprint. Pointing the QR straight at the App Store would
-- forfeit that; this insert is what keeps it available.
--
-- WHAT "repointable redirect" MEANS HERE, EXACTLY (Mike, 2026-09-23)
-- api/resolve.ts's unknown-slug path 302s to https://getreps.io/?ref=<slug> — a website
-- landing page, not the store. That fallback is ONLY what an unrecognized slug gets.
-- The entire point of this insert is that once it runs, 'willc' stops being unknown:
-- resolveDestination() picks the row's ios/android/fallback destination by platform,
-- and for both ios and fallback that destination IS the App Store URL below. So a tap
-- on getreps.io/r/willc, once this row exists, 302s STRAIGHT to the App Store — it does
-- NOT stop at a getreps.io website page. See step 4 for the live proof of that.
--
-- SLUG — 'willc', not 'will' (Mike's correction, 2026-09-23)
-- The first draft of this file used 'will', assumed for consistency with the other
-- first-name creator slugs already live (maria, enzo, kendra). Mike corrected it to
-- 'willc' for both the slug and the Apple ct= token. Nothing else about the shape
-- changed. Confirm with Mike before the QR code goes to print if the slug is to change
-- again; it is cheap to change now and expensive once it is on physical material.
--
-- WHY AN INSERT AND NOT AN UPDATE (verified live 2026-09-23)
-- Slug `willc` does NOT exist in public.links. A `select` against public.links (below)
-- confirms the table holds `kendra`, `maria`, and `enzo` and no `willc` row at all
-- (and no `will` row either — that slug was never run).
--
-- SHAPE
-- The ios and fallback keys are character-for-character the live `kendra` row's App
-- Store URL, only the ct= token differing — the same pattern used to add `maria` and
-- `enzo` (scripts/add-creator-apple-campaign-slugs.sql, task ea4966db, reviewed
-- 0b3bd5f6). BOTH pt=128464401 AND ct=willc must be present; Apple reports nothing if
-- either is missing, and that silence is indistinguishable from "no downloads". android
-- mirrors maria/enzo (not kendra): an Android viewer goes to the "Android is coming"
-- page, not an iPhone-only App Store listing. channel/variant mirror the maria/enzo/
-- kendra pattern (team_share / <slug>), so all named-partner links share a channel
-- label (readable by joining link_scans.link_id -> links.channel).
--
-- PREREQUISITE THAT IS NOT SQL — the Apple campaign does not exist yet
-- App Store Connect -> Apps -> REPS -> Analytics -> Acquisition -> Campaigns does not
-- yet hold a campaign named `willc` (not yet created — a separate attended step, not
-- part of this insert). Until it is created, ct=willc will not count downloads: taps
-- still land on the real App Store listing and still install correctly, but Apple's
-- campaign counter attributes nothing to the tap because it only aggregates by a
-- campaign it has been told to create. The redirect works from the moment this insert
-- runs; the counter comes alive only once the ASC campaign exists.
--
-- NO REPS-WEB DEPLOY IS NEEDED
-- apps.apple.com and the getreps.io/android page are already in ALLOWED_HOSTS
-- (api/resolve.ts) and already proven live by kendra/maria/enzo.
--
-- HOW TO RUN IT SAFELY
-- Run the whole file as one unit with psql and ON_ERROR_STOP, so a failed assertion
-- aborts before COMMIT:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/add-willc-gateway-slug.sql
-- If your surface cannot do that (e.g. the Supabase SQL editor, which manages its own
-- transaction wrapping), run steps 1-3 as one block first, read the output, and only
-- then run COMMIT. Either way the assertion in step 3 raises on any mismatch, which
-- aborts the transaction, so a subsequent COMMIT rolls back rather than shipping a bad
-- row. The COMMIT below is not a human gate on its own — the assertion is.

begin;

-- ---------------------------------------------------------------------------
-- 1. Pre-flight. Expect kendra present and NOTHING for willc. If willc appears
--    here, STOP and investigate: slugs are permanent and must never be
--    silently overwritten.
-- ---------------------------------------------------------------------------
select slug, destination, channel, variant, is_archived
from public.links
where slug in ('kendra', 'willc');

-- ---------------------------------------------------------------------------
-- 2. The insert. No ON CONFLICT clause on purpose: a duplicate slug must fail
--    loudly rather than no-op silently. links_slug_uniq enforces it.
-- ---------------------------------------------------------------------------
insert into public.links (slug, destination, channel, variant)
values
  (
    'willc',
    jsonb_build_object(
      'ios',      'https://apps.apple.com/app/id6759216018?pt=128464401&ct=willc&mt=8',
      'android',  'https://www.getreps.io/android',
      'fallback', 'https://apps.apple.com/app/id6759216018?pt=128464401&ct=willc&mt=8'
    ),
    'team_share',
    'willc'
  );

-- ---------------------------------------------------------------------------
-- 3. An assertion, not a hopeful SELECT. Both checks are EXACT string equality,
--    because a substring check for pt=/ct= would happily pass a typo in the host,
--    the scheme or the app id — and that is this gateway's silent killer:
--    resolveDestination() FAILS OPEN, so a destination whose host is not in
--    ALLOWED_HOSTS 302s every visitor to the homepage with nothing anywhere to
--    say so.
--
--    (a) kendra is pinned to its expected literal rather than trusted blindly, so
--        a drifted reference cannot be mirrored into the new row.
--    (b) willc's ios and fallback must equal kendra's with only the ct token
--        swapped, and its android must be the "Android is coming" page. Setting
--        android to the App Store URL is treated as a mistake, not a variation.
--    Any mismatch raises, which aborts the transaction.
-- ---------------------------------------------------------------------------
do $assert$
declare
  kendra_url  constant text :=
    'https://apps.apple.com/app/id6759216018?pt=128464401&ct=kendra&mt=8';
  android_url constant text := 'https://www.getreps.io/android';
  k        jsonb;
  r        record;
  expected text;
  dkey     text;
begin
  select destination into k from public.links where slug = 'kendra';

  if k is null then
    raise exception
      'kendra row is missing — the reference this change mirrors does not exist';
  end if;

  -- kendra carries the App Store URL on all three of its own keys. Unchanged here.
  foreach dkey in array array['ios', 'android', 'fallback'] loop
    if k ->> dkey is distinct from kendra_url then
      raise exception
        'kendra.% drifted from the expected reference. expected %, found %',
        dkey, kendra_url, coalesce(k ->> dkey, '<null>');
    end if;
  end loop;

  for r in
    select slug, destination from public.links where slug = 'willc'
  loop
    foreach dkey in array array['ios', 'android', 'fallback'] loop
      expected := case
        when dkey = 'android' then android_url
        else replace(kendra_url, 'ct=kendra', 'ct=' || r.slug)
      end;
      if r.destination ->> dkey is distinct from expected then
        raise exception
          '%.% is wrong. expected %, found %',
          r.slug, dkey, expected, coalesce(r.destination ->> dkey, '<null>');
      end if;
    end loop;
  end loop;

  raise notice
    'OK: willc carries the Apple tag on ios/fallback and the Android page on android.';
end
$assert$;

-- Human-readable confirmation of what is about to be committed.
select
  slug,
  destination ->> 'ios'      as ios,
  destination ->> 'android'  as android,
  destination ->> 'fallback' as fallback,
  channel,
  variant,
  is_archived
from public.links
where slug in ('kendra', 'willc')
order by slug;

commit;

-- ---------------------------------------------------------------------------
-- 4. After committing, confirm from outside the database. Use HEAD — a GET on
--    this host writes a row to link_scans.
--      curl -sI -A "<iPhone UA>" https://www.getreps.io/r/willc
--    Expect: 302 -> https://apps.apple.com/app/id6759216018?pt=128464401&ct=willc&mt=8
--    That Location header is the App Store itself, not a getreps.io page — this is
--    the "straight to the App Store" proof.
--    With an Android UA, expect: 302 -> https://www.getreps.io/android
--    A 302 to https://getreps.io/ (bare homepage) means the destination was refused
--    by the host allowlist. A 302 to https://getreps.io/?ref=willc means the row is
--    not there at all yet — this is the "unknown slug" fallback that step 4's proof
--    is checking has been replaced by the real destination.
--
-- 5. Separately, and NOT part of this insert: create a campaign named exactly `willc`
--    in App Store Connect -> Apps -> REPS -> Analytics -> Acquisition -> Campaigns.
--    Until that exists, ct=willc installs correctly but is not counted by Apple.
--
-- 6. Later, to repoint the QR (e.g. once a pub-quiz set exists to attach): update
--    this row's destination in place. The printed QR code never needs to change —
--    that repointability is the entire reason this is a gateway slug and not a
--    direct App Store link.
--      update public.links set destination = jsonb_build_object(...) where slug = 'willc';
-- ---------------------------------------------------------------------------
