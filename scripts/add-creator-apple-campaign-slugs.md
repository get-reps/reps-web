# Apple campaign tags for Maria + Enzo on the `getreps.io/r/` gateway

Crew task `ea4966db-0f13-402a-b1a8-89de051d72b8` · prepared 2026-09-22 · **not yet live**.

Companion to `scripts/add-creator-apple-campaign-slugs.sql`, which holds the exact
statement to run. This file is the reasoning, the evidence, and the open decisions.

## The point

REPS pays Maria and Enzo partly per install. The meter currently pointed at their pay is
AppsFlyer, which counts a first *app open* it can trace to a click — and in REPS that is
gated behind a tracking prompt held until roughly the third app open. A person who
downloads and never returns is invisible to it forever. Apple's own campaign counter
records the download at the store, before the app is opened. Wiring `pt=`/`ct=` onto the
creators' links is what turns that counter on. Full reasoning:
`reps-cleo/data/reports/b0df09aa-16d4-4df0-a8c5-adf47eb3fb36.md`.

## What the task brief said, and what is actually true

The brief described this as repointing two existing gateway entries, "same shortpath, so
no reissue to the creator needed". Probed live on 2026-09-22, that is not the situation:

| Probe (iOS UA, `HEAD`, no scan logged) | Result |
|---|---|
| `https://www.getreps.io/r/maria` | `302 → https://getreps.io/?ref=maria` |
| `https://www.getreps.io/r/enzo` | `302 → https://getreps.io/?ref=enzo` |
| `https://www.getreps.io/r/kendra` | `302 → https://apps.apple.com/app/id6759216018?pt=128464401&ct=kendra&mt=8` |

`?ref=<slug>` is `api/resolve.ts`'s unknown-slug fallback. A `select` against
`public.links` confirms it: the table holds a `kendra` row and **no `maria` or `enzo`
row at all**. So this is an insert of two new slugs, not an update of two existing ones.

The untagged App Store links in the brief are the creators' *AppsFlyer* links —
`repsapp.onelink.me/1zdF/maria` and `/1zdF/enzo`, both landing on
`https://apps.apple.com/GB/app/id6759216018?mt=8` with no Apple tags, confirmed live.

**Consequence, and it is the one thing the brief got wrong that changes what happens
next: Maria and Enzo must be sent their new `getreps.io/r/<name>` links.** Their current
links are not repointed by this change.

## What the new links give up — read this before sending anything to a creator

This is the part the brief did not cover and it deserves a decision, because handing a
creator a new link is the irreversible step here.

Maria's and Enzo's existing OneLinks are **not** untracked. Read from the AppsFlyer
account directly on 2026-09-22, both were created by `mike@getreps.io` on 2026-09-10 and
carry per-creator attribution:

- `repsapp.onelink.me/1zdF/maria` → `pid=maria_creator&c=maria-trial-2026-09&af_sub1=maria`
- `repsapp.onelink.me/1zdF/enzo` → `pid=enzo_creator&c=enzo-trial-2026-09&af_sub1=enzo`

The new gateway links go straight to `apps.apple.com` and bypass AppsFlyer entirely.
**If a creator swaps their link, Apple starts counting downloads and AppsFlyer stops
telling you anything about that creator's audience** — no post-install behaviour, no
`af_sub1`. `QR_GATEWAY.md` records the same forfeit for `kendra` and notes it runs
counter to the standing direction in decision #112.

**A correction to something this file said in an earlier draft:** it is *not* true that
the gateway is the only place Apple's tags can be attached. Template `GL2W` is configured
in AppsFlyer's Web-URL mode and delivers **both** meters on one click — verified live
today, `/r/founding-appstore?u=21` ends at
`apps.apple.com/app/id6759216018?ct=founder_email&mt=8&pt=128464401&c=founding_waitlist&af_ad=appstore_cta&af_sub1=21`.
What is true is narrower: template `1zdF`, the one Maria's and Enzo's links run through,
is native-mode and structurally cannot carry an Apple tag — that is fixed when a template
is created, not per link.

So there are two honest routes, and the scout report weighed them:

| | What it gives | Cost |
|---|---|---|
| **A — gateway direct** (this file; mirrors `kendra`) | Apple counts downloads at the store, no app open needed | Loses the per-creator AppsFlyer signal Mike set up on 10 Sep |
| **B — a Web-URL-mode OneLink template per creator**, behind the same gateway slug | Both meters on one click, like `GL2W` | One hand-built AppsFlyer template per creator, no API on this plan; the report judged it doesn't scale past a handful |

**DECIDED 2026-09-22 — Mike chose route A, with the forfeit named and accepted.** Apple's
download count is the number the payout is based on, and it is the one AppsFlyer
structurally cannot produce. The per-creator AppsFlyer signal on
`pid=maria_creator` / `pid=enzo_creator` goes quiet once the creators switch links; the
OneLinks themselves are left in place and are not deleted by this change, so route B
remains available later without redoing anything. The SQL implements route A.

## Why there is no code change in this repo

`api/resolve.ts` is a generic resolver; destinations live in `public.links` in the
reps-app Supabase project (`vciosaulrfvddcenblmo`). Adding a slug touches no reps-web
source. `apps.apple.com` is already in `ALLOWED_HOSTS`, proven live by `/r/kendra`, so
the standing "add the host and deploy reps-web first" trap in `QR_GATEWAY.md` does not
apply. **No Vercel deploy makes this live — the SQL does.** A repo-wide grep confirms
nothing else here references `maria` or `enzo`; `vercel.json`, `creator/` and the
landing pages need no change.

## What was verified first-hand on 2026-09-22

- `/r/maria`, `/r/enzo`, `/r/kendra` under iOS, Android and desktop user agents (table
  above; kendra returns the tagged App Store URL on all three platforms).
- The `kendra` row's stored destination: all three keys identical, both tags present.
- `maria` and `enzo` absent from `public.links`; `links_slug_uniq` is a real unique index,
  so the insert fails loudly on a duplicate rather than silently overwriting.
- Maria's and Enzo's OneLink parameters, read from the AppsFlyer account.
- `GL2W` delivering Apple and AppsFlyer tags on the same click (above).
- Every URL literal in the SQL's INSERT, compared character for character against the
  live `kendra` destination by `scripts/verify-creator-apple-campaign-sql.mjs` — which
  also refuses a stray App Store URL, a missing tag, non-ASCII in a URL, an Android key
  pointed at the App Store, and an `ON CONFLICT` clause. It needs no credentials:
  `node scripts/verify-creator-apple-campaign-sql.mjs`. It was itself tested against five
  deliberately corrupted copies (host typo, dropped `pt=`, wrong app id, Android sent to
  the iPhone-only listing, softened to an upsert) and rejected all five, so it is not a
  check that passes everything.
- `https://www.getreps.io/android` returns 200, `android.html` is titled "Android is
  coming — REPS", and `/r/fb` under an Android agent already resolves there — so the
  Android destination chosen below is a page that exists and is already in use.

## Unverified: the SQL has never been executed

The in-transaction assertion in step 3 of the SQL is **unrun**. A read-only dry run of it
against production was refused by the production-database gate (request
`#c5730d5d-d288-48cf-9623-6821d6bcd562`) and not retried, and there is no local Postgres
on this machine to syntax-check PL/pgSQL against. So: the URL literals are verified, the
assertion's *logic* is reviewed but its *syntax* is not. Whoever runs step 3 should run
the file with `ON_ERROR_STOP` as described in the SQL header and treat a PL/pgSQL syntax
error as a stop-and-fix, not a reason to delete the assertion and insert anyway.

## What was *not* verified, and is a claim

- **That Apple will actually count these.** Under any iOS user agent — Safari,
  Instagram's in-app browser, TikTok's — Apple answers the tagged URL with
  `301 → itms-appss://apps.apple.com/app/id6759216018?mt=8`, and the tags are dropped
  from that hop. Apple's guidance is that the campaign is logged server-side at the
  `apps.apple.com` hit before the hand-off. That is a claim from Apple's documentation,
  not something a terminal can confirm.
- An earlier draft of this file said Apple echoing both tags back under a desktop agent
  "proves it parses and accepts them". **That was wrong.** A deliberately fake token
  (`pt=999999999&ct=zzz_not_a_real_campaign_qq`) is echoed back identically. The echo is
  query-string passthrough on a canonicalising redirect and proves nothing.
- Whether an App Store Connect campaign must pre-exist for a `ct=` token to be reported.
  Treat it as required (see below).

## The test that actually settles it — and an honest caveat about the reference

`kendra` behaves identically to what maria and enzo will do, so mirroring it is the right
move mechanically. But **`kendra` being correctly formed has never been the same as
`kendra` being shown to count** — nobody has read a download against it in App Store
Connect. This change inherits that open question rather than answering it.

And an `itms-appss://` hop is exactly the shape of the open `/r/ig` white-page bug in
`QR_GATEWAY.md` — a bio link that rendered blank inside Instagram's in-app browser for
weeks before anyone noticed. So the real-phone test is not a formality:

> Tap `getreps.io/r/maria` and `getreps.io/r/enzo` on a real iPhone, **from inside the
> TikTok app and from inside the Instagram app**, and confirm each lands on the REPS App
> Store listing rather than a blank page. Then check App Store Connect about three days
> later — Apple needs 24h to show a campaign plus a two-day completeness lag.

Apple also hides any campaign with fewer than five first-time downloads in the window
being viewed, so read a cumulative campaign-to-date figure, never a weekly slice.

## Order of operations

1. Check whether `kendra` has a campaign in App Store Connect (Apps → REPS → Analytics →
   Acquisition → Campaigns). That answers the prerequisite question for all three links
   at once. Create campaigns named exactly `maria` and `enzo`.
2. Run `node scripts/verify-creator-apple-campaign-sql.mjs` (offline, no credentials),
   then run `scripts/add-creator-apple-campaign-slugs.sql` against
   `vciosaulrfvddcenblmo`. **This is the live step.**
3. Re-probe both links with `curl -sI` and confirm the tagged 302 on an iPhone UA, and
   `https://www.getreps.io/android` on an Android UA.
4. Real-phone test from inside TikTok and Instagram (above).
5. Send Maria and Enzo their new links. **Irreversible.** Worth telling them in the same
   message that the counter was on REPS's side of the fence, not theirs.
6. Record both slugs in `reps-growth/docs/truth/QR_GATEWAY.md` § Current slugs, including
   the AppsFlyer forfeit and the Android departure from `kendra`. That doc is the
   gateway's source of truth and lives in another repo, so this branch cannot update it
   — **it belongs to whoever runs step 2**, in the same pass, or it becomes the next
   piece of staleness that doc keeps warning about.

## Android: a deliberate departure from kendra (decided 2026-09-22)

`kendra` puts its App Store URL on the `android` key too, so an Android viewer of a
creator's video lands on an iPhone-only listing they cannot install from. Mike chose the
house pattern instead: maria and enzo send Android viewers to
`https://www.getreps.io/android`, the "Android is coming" page already used by `fb`,
`threads`, `ig` and `threads-bio`. So these two rows mirror `kendra` on `ios` and
`fallback` and intentionally differ on `android`; the SQL's assertion encodes exactly
that and will fail if the Android key is ever set back to the App Store URL. `kendra`
itself is untouched — the task was explicit about not changing other creators' entries.
When the Android app ships, that same key takes a Play link carrying the creator token.

## One naming note, not a blocker

`kendra`'s row carries `channel = 'team_share'` — the only row in the table with that
value — which reads oddly for a paid creator link, and `QR_GATEWAY.md` records its
channel as `kendra` (the doc is stale; its channel column actually holds the variant).
Maria and Enzo mirror the live value so the three named-partner links share a label.
Renaming all three to something like `creator` would be tidier and would touch kendra,
which this task was explicitly told not to touch. Left alone.
