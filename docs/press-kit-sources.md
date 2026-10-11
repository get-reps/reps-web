# /press — sources, positioning and pending slots

Page: `press/index.html` (served at `/press`, `noindex`, not in `sitemap.xml`). Built 2026-10-11, crew task `ad5a00cb`.
Spec: Step 1 checklist of `faculty-dashboard/work/digital-employees-261011/grok-reps-pr-playbook.docx`, scoped by Cleo.

## Positioning (round 3 rewrite, 2026-10-11)

Mike rejected the first positioning ("an iOS app that helps people remember … quick daily games"): REPS is an **AI knowledge companion**. What you read, watch and hear becomes a living knowledge base you can ask, and the AI companion (Echo) plays it back to you. Games are one way it works, not the headline. All copy on the page was re-derived from the sources below.

### The exact current positioning words, and where they live

| Words | Source | What the source says about scope |
| --- | --- | --- |
| "Your Knowledge Companion" | `reps-app/docs/truth/DESIGN_DECISIONS.md` § Canonical brand lines (row 2) and `DESIGN_DECISIONS_DETAIL.md` line ~65 | "Website tagline and share image (Mike, 2026-10-05, replacing 'Supercharge your memory.'; live on getreps.io). A **website tagline only** — NOT the name of any in-app feature or string". Outcome `web-tagline-knowledge-companion` in `reps-cleo/data/outcomes.json`. |
| "Your Personal Knowledge Companion" | `reps-web/v3c.html` line 957 (live homepage `<h1>`); `DESIGN_DECISIONS_DETAIL.md` ~65: "The website home headline separately reads 'Your Personal Knowledge Companion'." | Homepage headline. |
| "REPS · Your Knowledge Companion" | `v3c.html` line 19 (`og:title`) | Homepage share title. |
| "Your personal **knowledge** assistant. / Remember everything, effortlessly." | `reps-app/docs/truth/PITCH.md` § App Store screenshots, RESOLVED note (verified via the App Store Connect API 2026-07-29) | Live App Store screenshot 1 as of that date. |
| "REPS - Supercharge your memory" + subtitle "Remember everything you save." | `PITCH.md` § Tagline delivery notes | App Store name and subtitle. |
| "Companion" = the Ask Echo chat | `DESIGN_DECISIONS_DETAIL.md` ~302: "'Companion' is already the internal name of the Ask Echo chat." | Internal name only. |
| Ask Echo capabilities | `reps-app/docs/truth/PRODUCT_TRUTH.md` §2 "Ask Echo": "Two-way chat with Echo about saved material. It can also search what other people (and your friends) have published and add a recommended set to your library … save new content you mention, look up and recap a named book or film … Live." | Basis for every Echo claim on the page. |
| Voice sessions | `PRODUCT_TRUTH.md` §2 "Voice training": "English, French, German, Spanish, Italian, Portuguese". | Fact sheet row. |
| The knowledge map | `PRODUCT_TRUTH.md` §1: "Saved knowledge also renders as a connected graph the user can explore"; §2 "Second Brain": "interactive 3D knowledge graph … coloured by topic". | Described, not named (see disagreement 4). |

How the page uses them: it says "an AI knowledge companion" in lower case, as a description, not as a feature name. Echo is "your AI companion". The knowledge base is "a living knowledge base you can talk to". The graph is described ("a map of everything you know", "Your knowledge, connected"), never named.

### Where the truth docs disagree with each other (or with Mike's direction)

1. **Press tagline.** `DESIGN_DECISIONS.md` (brand-lines row 1) and `PITCH.md` § Tagline still list **"Supercharge your memory."** as the line for "App Store listing, paid ads, decks, **press**". Mike's 2026-10-11 direction and the 2026-10-05 website change both point to the knowledge companion. The page follows Mike; those two rows need updating.
2. **Canonical self-definition.** `DESIGN_DECISIONS_DETAIL.md` § X-for-Y (~126) says REPS's canonical self-definition is "Save anything. Remember everything." plus "next day it returns as a daily game built from your own material". That is memory-and-games-led, which Mike has now rejected as the headline.
3. **What REPS is.** `PRODUCT_TRUTH.md` §1 "What REPS is, stated accurately" describes saving → questions → games → graph and does not mention Ask Echo, even though §2 lists Ask Echo as live. §1 reads as the old positioning.
4. **"Your Second Brain".** `PRODUCT_TRUTH.md` §2 says the graph's user-facing name "is always 'Your Second Brain'". The 2026-10-07 amendment in `DESIGN_DECISIONS_DETAIL.md` (~302) says it is being phased out ("do not LEAD new copy with 'Second Brain'") and its replacement name is "UNDECIDED — Mike's call; do not invent one." The page describes the map without naming it. The real capture still shows the in-app title "Your Second Brain".
5. **"Companion" as a name.** `DESIGN_DECISIONS.md` says "Your Knowledge Companion" is a website tagline only and not a feature name, yet "Companion" is the internal name of the Ask Echo chat. The app also has an unreleased string "Your knowledge companion, one text away" (`reps-app/lib/i18n/locales/en.json:2430`, the Text Echo / iMessage screen). `PRODUCT_TRUTH.md` §4 says Echo over iMessage is **not live**, so the page does not mention it.
6. **Homepage copy is still mixed.** `v3c.html` line 16 meta description ("quick games that make it stick") and line 983 tagline ("A quick daily game makes it stick.") are games-led and use "stick", which `DESIGN_DECISIONS.md` § lexicon (2026-08-26) bans in new copy. They sit under the new "Knowledge Companion" headline.
7. **App Store listing.** The truth docs record the name/subtitle above and the screenshot-1 headline as of 2026-07-29. A later live set (app version 1.6.2, pulled 2026-09-22) exists in a reps-backend worktree but is not summarised in any truth doc. I did not re-verify the live listing text.

## Images — every one is a real file

Screenshots are byte-for-byte copies (md5 checked) of frames already on the site, served under neutral press names. The shared originals are untouched.

| Caption on the page | File served | Copied from | Evidence it is a real capture |
| --- | --- | --- | --- |
| Talk it through with Echo | `/press/assets/reps-talk-with-echo.jpg` (600×1300) | `creator/demo-assets/voice.jpg` (creator deck, Sept 2026, `f5053a3`) | iPhone status bar + red screen-recording dot in frame |
| Your knowledge, connected | `/press/assets/reps-knowledge-map.jpg` (1080×2340) | `beats/constellation-poster.jpg` (also `creator/demo-assets/brain.jpg`; homepage recordings, June 2026) | same |
| Echo raises the bar | `/press/assets/reps-echos-challenge.jpg` (1080×2340) | `beats/quiz-single-poster.jpg` (also `creator/demo-assets/recall.jpg`) | same |
| Your knowledge, played back | `/press/assets/reps-daily-game.jpg` (1080×2340) | `beats/quiz-all-sped-poster.jpg` | same |
| Daily Crossword | `/press/assets/reps-daily-crossword.jpg` (1080×2340) | `beats/game-crossword-poster.jpg` | same |
| Built from what you saved | `/press/assets/reps-fill-in-the-blank.jpg` (1080×2340) | `beats/quiz-frame.jpg` | same |
| App icon, full size | `/press/assets/reps-app-icon-1024.png` | byte-for-byte copy of `reps-app/assets/icon.png` (the icon `app.json` ships) | md5 `67ed3c42…` matches |
| App icon, rounded | `/press/assets/reps-app-icon-rounded-256.png` | copy of `creator/app-mark.png` | md5 `d09a801e…` matches |

There is **no real Ask Echo chat capture** in this repo. It is the screen that best shows the companion, so it is listed as pending below.

Not used, and why:

- `beats/save-share-ext-poster.jpg`, `creator/demo-assets/save.jpg`: mostly a National Geographic page, not REPS.
- `creator/demo-assets/trivia.jpg`: shows a real friend's name and profile photo.
- `creator/demo-assets/discover.jpg`: other users' names and third-party news photos.
- `beats/save-composite-poster.jpg`: a camera view of a bookshelf, no REPS UI.
- `creator/demo-assets/quotle.jpg`: a "Coming soon" placeholder card, not a capture.
- `og-card-v3.png`: still says "Join the waitlist" (the page's share image is the 1024 app icon).
- `product-2026/assets/icon.png`: a different crop from the shipped icon.

## Facts — where each came from

- Description, sources, Echo, voice languages, the knowledge map, games, platform (iOS only, no Android or web), price (free): `PRODUCT_TRUTH.md` §1–§4. The price line carries "as of October 2026".
- Saving: links, text and single images come from the share sheet; PDFs and bookshelf photos are added in REPS (`PRODUCT_TRUTH.md` §2 "Saving — how" and §3).
- Launch month (July 2026): `reps-app/docs/truth/WEBSITE.md` (App Store badge replaced the waitlist 2026-07-20) and `EMAIL.md` (App Store launch send 2026-07-14).
- Company name and number: `terms.html` / `privacy.html`.
- App Store, Chrome Web Store and `/watch` links: existing site pages.

## Founder bio (draft, built only from `reps-app/docs/truth/PERSONAL_STORY.md`)

Uses public-tagged threads only: 1 (entrepreneurial family), 2 (bankruptcy at McGill and the self-reliance wake-up, kept to the public facts), 3 (career dates, twelve years), 5 (2025 AI deep dive), 10 (nephews and nieces on short videos), 11 (recycling social-media mechanics into something healthier) and 15 (left Inovia 30 June 2026, his 34th birthday). No family names and no named individuals. The sensitive threads (6–9, 12, 13, 16) are not used.

**50 words:**

> Mike McGraw is the founder of REPS. He spent twelve years investing, helping launch CDPQ's technology investment team and Inovia's European office. In 2025 he went deep on AI while worrying what endless feeds were doing to attention, and in June 2026 he left Inovia to build REPS full time.

**150 words:**

> Mike McGraw is the founder of REPS. He grew up between two kinds of entrepreneur: his mother has run a magazine business in Quebec for 25 years, and his father's startup went bankrupt while Mike was a student at McGill University. It taught him early that his success would depend on himself.
>
> He spent the next twelve years in investing: natural resources at PSP Investments, then helping launch the technology investment team at CDPQ, then Inovia, where he became a Principal and helped set up the firm's European office.
>
> In 2025 he went deep on AI, building with language models in his spare time, while watching his nephews and nieces grow up on endless short videos. REPS came out of both: the technology built to keep people scrolling could instead help them build knowledge they keep. He left Inovia on 30 June 2026, his 34th birthday, to build it full time.

## Proposed App Store review quotes (three picks for Mike)

All are 5★ and verbatim from the homepage block headed "Set 1 — real, verbatim App Store reviews (App Store id 6759216018)" (`reps-web/v3c.html` ~line 1016). They were picked for fit with the companion positioning: a knowledge base you grow, discovery, and a better use of attention.

1. **24601_London** (5★, 2026-07-30, titled "My new obsession!"): "It's replaced scrolling Instagram on my phone, and it's helping me re-engage with books I read years ago, and actively seek out interesting knowledge to add to my second brain." Source: `v3c.html` ~1034, also cross-checked against the stored review per `reps-app/components/onboarding/SocialProofScreen.tsx:47-53`. *Why:* building a personal knowledge base, re-engaging with books, seeking out new knowledge.
2. **Cathb1234** (5★): "Such a fun and easy way to remember the things that matter the most to me! New content is also great to discover! Definitely one of my favorite apps!" Source: `v3c.html` ~1063. *Why:* your own knowledge plus discovery of new material.
3. **jsdldn** (5★, titled "Great app for nerds like me"): "Really enjoying using this app as a better way to spend 5/10 minutes at bus stop etc. vs brain rotting on Insta/X." Source: `v3c.html` ~1020; title per `reps-app/docs/truth/GENERATED_ASSET_INTEGRITY.md:81`. *Why:* attention worth spending.

Not picked: **Sizeret74** ("Very nice and fun way to retrain your brain – love a competition with friends. Love that app!", `v3c.html` ~1049), which is games-led. **Mooselake4** ("As a non-techy over 60 year old, this app is simple and intuitive to navigate.", `v3c.html` ~1078) is about ease of use, and `reps-growth/work/gtm-sprint-260904/SOURCES-AND-GAPS.md:16` traces it to a `user_feedback` row, so confirm its App Store origin first. Not usable: "Karen" in the angel deck (a private email); "Sam B." in onboarding (an invented name on 24601_London's text); the unattributed "REPS effortlessly organizes my knowledge…" quote in `PITCH.md` § v13 (no reviewer name on disk).

None of the three is on the page yet: the three review slots stay pending until Mike approves.

## Pending Mike (visible `.pending` label on the page)

1. Founder bio sign-off (the 50- and 150-word drafts above, also on the page). The Copy buttons prepend "DRAFT, not yet approved" until then (`data-draft`; remove it at sign-off).
2. Headshots: one portrait, one landscape. (A 400×400 photo is already public at `compare/assets/mike-mcgraw.jpg`; not reused because the brief reserves headshots for Mike.)
3. Three App Store review quotes. The proposal is above.
4. Press contact email. No press address exists in this repo (`support@` and `privacy@` do).
5. Wordmark logo (SVG + PNG, light + dark). No standalone file exists.
6. A real capture of a chat with Echo (Ask Echo), plus fresh full-resolution captures of the current app. Raw device captures exist in `reps-backend/work/app-store-screenshots-freshvariants-20260721/screens/` (the `-clean` files are edited: redrawn status bar, one avatar swapped). The Sept 2026 recordings are on Drive (`Shared drives/REPS/3. Sales & Marketing/Media Assets/Canonical Media/September 2026 Update/`, catalogued in `Edited/TRACKER.md`).

Indexing: when items 1–4 are filled, remove the `noindex` meta and add `/press` to `sitemap.xml` together (see the CLAUDE.md routes row).

Playbook items deliberately not built (outside Cleo's scope): founder quotes, memory-science explainer, X/LinkedIn handles, a zipped asset folder.
