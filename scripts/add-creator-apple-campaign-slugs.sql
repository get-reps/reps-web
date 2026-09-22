-- getreps.io/r/ gateway — Apple campaign tags for Maria + Enzo (creator payout counter)
-- Crew task ea4966db-0f13-402a-b1a8-89de051d72b8 · prepared 2026-09-22 · NOT YET RUN.
--
-- WHAT THIS IS
-- Gateway destinations do not live in this repo. api/resolve.ts is a generic resolver;
-- it reads destinations from public.links in the reps-app Supabase project
-- (vciosaulrfvddcenblmo). So the only way to add a creator link is a production row
-- insert. This file is the repo record of the exact statement; running it IS the live
-- step. Hand it to whoever owns the production database write — do not run it as part
-- of merging this branch.
--
-- WHY AN INSERT AND NOT AN UPDATE (verified live 2026-09-22)
-- Slugs `maria` and `enzo` do NOT exist in public.links. Today getreps.io/r/maria and
-- /r/enzo hit resolve.ts's unknown-slug path and 302 to https://getreps.io/?ref=<slug>.
-- The untagged App Store links described in the task brief are the creators' AppsFlyer
-- OneLinks (repsapp.onelink.me/1zdF/maria and /1zdF/enzo), not gateway slugs.
-- CONSEQUENCE: both creators must be GIVEN the new getreps.io/r/<name> links. Their
-- existing OneLinks are not repointed by this, and swapping them has a cost — read
-- scripts/add-creator-apple-campaign-slugs.md § "What the new links give up" BEFORE
-- sending anything to a creator. That hand-off is the irreversible step, not this insert.
--
-- SHAPE
-- The ios and fallback keys are character-for-character the live `kendra` row, only the
-- ct= token differing. BOTH pt=128464401 AND ct=<name> must be present; Apple reports
-- nothing if either is missing, and that silence is indistinguishable from "no
-- downloads". A tap on either lands straight on the App Store listing and never passes
-- through getreps.io or Waitlister. channel/variant mirror `kendra` so the three
-- named-partner links share a channel label (readable by joining link_scans.link_id ->
-- links.channel).
--
-- ANDROID — a deliberate departure from kendra (Mike's call, 2026-09-22)
-- kendra puts its App Store URL on the `android` key too, which sends an Android viewer
-- of a creator's video to an iOS-only listing they cannot install from. Mike chose the
-- house pattern used by most other live rows (fb, threads, ig, threads-bio) instead:
--   https://www.getreps.io/android
-- a real "Android is coming" page that already exists in this repo (android.html),
-- returns 200 live, and whose host is already in ALLOWED_HOSTS. So maria and enzo mirror
-- kendra on ios and fallback and intentionally differ on android; the assertion in step
-- 3 encodes exactly that and will fail if the android key is ever set to the App Store
-- URL by mistake. kendra itself is NOT touched — the task was explicit about that.
-- When the Android app ships, this same key takes a Play link carrying the creator
-- token, e.g.
--   https://play.google.com/store/apps/details?id=<pkg>&referrer=utm_source%3Dmaria
-- play.google.com is already in ALLOWED_HOSTS too, so that later change needs no deploy.
--
-- NO REPS-WEB DEPLOY IS NEEDED
-- apps.apple.com is already in ALLOWED_HOSTS (api/resolve.ts), proven live by /r/kendra.
-- The standing "add the host and deploy reps-web FIRST" trap in
-- reps-growth/docs/truth/QR_GATEWAY.md does not apply here.
--
-- PREREQUISITE THAT IS NOT SQL
-- App Store Connect -> Apps -> REPS -> Analytics -> Acquisition -> Campaigns must hold
-- a campaign named exactly `maria` and one named exactly `enzo`. Apple's guidance is
-- that campaign links are generated there; a ct= token alone is not documented to be
-- enough. Cheapest way to settle it for all three at once: look at whether `kendra`
-- already has a campaign there. If it does not, that alone may explain why nothing has
-- ever been read against kendra — in which case "mirror kendra" is mirroring a link
-- that is correctly formed but has never been shown to count.
--
-- HOW TO RUN IT SAFELY
-- Run the whole file as one unit with psql and ON_ERROR_STOP, so a failed assertion
-- aborts before COMMIT:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/add-creator-apple-campaign-slugs.sql
-- If your surface cannot do that (e.g. the Supabase SQL editor, which manages its own
-- transaction wrapping), run steps 1-3 as one block first, read the output, and only
-- then run COMMIT. Either way the assertion in step 3 raises on any mismatch, which
-- aborts the transaction, so a subsequent COMMIT rolls back rather than shipping a bad
-- row. The COMMIT below is not a human gate on its own — the assertion is.

begin;

-- ---------------------------------------------------------------------------
-- 1. Pre-flight. Expect exactly ONE row (kendra) and NOTHING for maria/enzo.
--    If maria or enzo appears here, STOP and investigate: slugs are permanent
--    and must never be silently overwritten.
-- ---------------------------------------------------------------------------
select slug, destination, channel, variant, is_archived
from public.links
where slug in ('kendra', 'maria', 'enzo');

-- ---------------------------------------------------------------------------
-- 2. The insert. No ON CONFLICT clause on purpose: a duplicate slug must fail
--    loudly rather than no-op silently. links_slug_uniq enforces it, and a
--    conflict aborts the whole multi-row VALUES, so neither row lands.
-- ---------------------------------------------------------------------------
insert into public.links (slug, destination, channel, variant)
values
  (
    'maria',
    jsonb_build_object(
      'ios',      'https://apps.apple.com/app/id6759216018?pt=128464401&ct=maria&mt=8',
      'android',  'https://www.getreps.io/android',
      'fallback', 'https://apps.apple.com/app/id6759216018?pt=128464401&ct=maria&mt=8'
    ),
    'team_share',
    'maria'
  ),
  (
    'enzo',
    jsonb_build_object(
      'ios',      'https://apps.apple.com/app/id6759216018?pt=128464401&ct=enzo&mt=8',
      'android',  'https://www.getreps.io/android',
      'fallback', 'https://apps.apple.com/app/id6759216018?pt=128464401&ct=enzo&mt=8'
    ),
    'team_share',
    'enzo'
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
--        a drifted reference cannot be mirrored into two new rows.
--    (b) each new row's ios and fallback must equal kendra's with only the ct token
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
    select slug, destination from public.links where slug in ('maria', 'enzo')
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
    'OK: maria and enzo carry both Apple tags on ios/fallback and the Android page on android.';
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
where slug in ('kendra', 'maria', 'enzo')
order by slug;

commit;

-- ---------------------------------------------------------------------------
-- 4. After committing, confirm from outside the database. Use HEAD — a GET on
--    this host writes a row to link_scans.
--      curl -sI -A "<iPhone UA>" https://www.getreps.io/r/maria
--      curl -sI -A "<iPhone UA>" https://www.getreps.io/r/enzo
--    Expect: 302 -> https://apps.apple.com/app/id6759216018?pt=128464401&ct=<name>&mt=8
--    With an Android UA, expect: 302 -> https://www.getreps.io/android
--    A 302 to https://getreps.io/ (bare homepage) means the destination was refused
--    by the host allowlist. A 302 to https://getreps.io/?ref=<name> means the row is
--    not there at all.
--
-- 5. Then the real-phone test, which curl cannot stand in for, and the creator
--    hand-off decision — both in scripts/add-creator-apple-campaign-slugs.md.
-- ---------------------------------------------------------------------------
