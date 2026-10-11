# /press — sources and pending slots

Page: `press/index.html` (served at `/press`). Built 2026-10-11, crew task `ad5a00cb`.
Spec: Step 1 checklist of `faculty-dashboard/work/digital-employees-261011/grok-reps-pr-playbook.docx`, scoped by Cleo.

## Images — every one is a real file

| On the page | File served | Original source | Evidence it is a real capture |
| --- | --- | --- | --- |
| The daily game | `/beats/quiz-all-sped-poster.jpg` (1080×2340) | homepage recording beats, June 2026 | iPhone status bar + red screen-recording dot in frame |
| Fill in the blank | `/beats/quiz-frame.jpg` (1080×2340) | same | same |
| Echo's challenge | `/beats/quiz-single-poster.jpg` (1080×2340) | same | same (byte-identical frame also at `creator/demo-assets/recall.jpg`) |
| Daily Crossword | `/beats/game-crossword-poster.jpg` (1080×2340) | same | same |
| Your Second Brain | `/beats/constellation-poster.jpg` (1080×2340) | same | same (also at `creator/demo-assets/brain.jpg`) |
| Voice training | `/creator/demo-assets/voice.jpg` (600×1300) | creator deck, Sept 2026 (`f5053a3`) | status bar + recording dot in frame |
| App icon 1024 | `/press/assets/reps-app-icon-1024.png` | byte-for-byte copy of `reps-app/assets/icon.png` (the icon `app.json` ships) | md5 `67ed3c42…` matches |
| App icon rounded 256 | `/press/assets/reps-app-icon-rounded-256.png` | copy of `creator/app-mark.png` | md5 `d09a801e…` matches |

Not used, and why:

- `beats/save-share-ext-poster.jpg`, `creator/demo-assets/save.jpg`: mostly a National Geographic page, not REPS.
- `creator/demo-assets/trivia.jpg`: shows a real friend's name and profile photo.
- `creator/demo-assets/discover.jpg`: other users' names and third-party news photos.
- `beats/save-composite-poster.jpg`: a camera view of a bookshelf, no REPS UI.
- `creator/demo-assets/quotle.jpg`: a "Coming soon" placeholder card, not a capture.
- `og-card-v3.png`: still says "Join the waitlist" (kept only as the page's social share image, matching `/planet`).
- `product-2026/assets/icon.png`: a different crop from the shipped icon.

## Facts — where each came from

- Product description, sources, games, platform (iOS only, no Android/web), price (free): `reps-app/docs/truth/PRODUCT_TRUTH.md` §1–§4.
- Launch month (July 2026): `reps-app/docs/truth/WEBSITE.md` (App Store badge replaced the waitlist 2026-07-20) and `EMAIL.md` (App Store launch send 2026-07-14).
- Company name and number: `terms.html` / `privacy.html`.
- Founder bio: `reps-app/docs/truth/PERSONAL_STORY.md`, public-tagged threads only (1, 2, 3, 5, 10, 15). No family names, no named individuals.
- App Store, Chrome Web Store, `/watch` links: existing site pages.

## Pending Mike (visible `.pending` label on the page)

1. Founder bio sign-off (short + long drafts).
2. Headshots: one portrait, one landscape. (An existing 400×400 photo is already public at `compare/assets/mike-mcgraw.jpg`; not reused here because the brief reserves headshots for Mike.)
3. Three App Store review quotes. Candidates, all 5★, verbatim from this repo's own homepage block headed "Set 1 — real, verbatim App Store reviews (App Store id 6759216018)" (`v3c.html` ~line 1016). The first three are also the playbook's pick. Not re-checked against Apple's records in this task:
   - **24601_London** (2026-07-30, "My new obsession!"; also cross-checked against the stored review per `reps-app/components/onboarding/SocialProofScreen.tsx`): "It's replaced scrolling Instagram on my phone, and it's helping me re-engage with books I read years ago, and actively seek out interesting knowledge to add to my second brain." (`v3c.html` ~1034)
   - **jsdldn** ("Great app for nerds like me"): "Really enjoying using this app as a better way to spend 5/10 minutes at bus stop etc. vs brain rotting on Insta/X." (`v3c.html` ~1020)
   - **Mooselake4**: "As a non-techy over 60 year old, this app is simple and intuitive to navigate." (`v3c.html` ~1078). Caveat: `reps-growth/work/gtm-sprint-260904/SOURCES-AND-GAPS.md:16` traces it to a `user_feedback` row, so confirm it really is an App Store review before quoting.
   - **Sizeret74**: "Very nice and fun way to retrain your brain – love a competition with friends. Love that app!" (`v3c.html` ~1049)
   - **Cathb1234**: "Such a fun and easy way to remember the things that matter the most to me! New content is also great to discover! Definitely one of my favorite apps!" (`v3c.html` ~1063)
   - Not usable: "Karen" in the angel deck (a private email, not a review); "Sam B." in onboarding (an invented name on 24601_London's text).
4. Press contact email. No press address exists in this repo (`support@` and `privacy@` do).
5. Wordmark logo (SVG + PNG, light + dark). No standalone file exists.
6. Optional: fresh full-resolution captures of the current app, including the share-sheet save and Quotle. Better sources already exist outside this repo: `reps-backend/work/app-store-screenshots-freshvariants-20260721/screens/` (raw device captures; the `-clean` files have a redrawn status bar and one avatar swapped, so they are edited) and the Sept 2026 recordings on Drive (`Shared drives/REPS/3. Sales & Marketing/Media Assets/Canonical Media/September 2026 Update/`, catalogued in `Edited/TRACKER.md`). The page uses only unedited frames already served by this site.

Playbook items deliberately not built (outside Cleo's scope): founder quotes, memory-science explainer, X/LinkedIn handles, a zipped asset folder.
