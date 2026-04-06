# REPS Website (getreps.io)

Static marketing site for REPS. Hosted on Vercel with auto-deploy on push to `main`.

## Structure

- `index.html` — Landing page (Tailwind v4 CDN + Viral Loops waitlist)
- `start.html` — Educational article ("Why You Forget Everything You Read") — loaded in-app via WebView
- `privacy.html` — Privacy policy
- `terms.html` — Terms of service
- `icons/` — SVG icons
- `vercel.json` — Route config (clean URLs, referral redirects)

## Routes

| URL | File | Notes |
|-----|------|-------|
| `/` | index.html | Landing page |
| `/start` | start.html | In-app WebView target (`GUIDED_PREFILL_URL` in reps-app) |
| `/privacy` | privacy.html | |
| `/terms` | terms.html | |
| `/r/:code` | Redirects to `/?ref=:code` | Referral links from reps-app `SocialScreen` |

`cleanUrls: true` in vercel.json strips `.html` extensions automatically.

## Brand Rules

- **Aesthetic:** Premium wellness (Headspace/Oura Ring vibe)
- **Colors:** Cream (`#fffaf7`), coral (`#ff6b6b`), peach (`#ff8e53`), charcoal (`#2a2320`)
- **Typography:** System sans-serif for product voice; Lora serif for content/editorial text
- **Mascot:** Echo the elephant — warm grey with cream undertone, coral headband, gold glasses, silver whistle
- **Voice:** "Save it or lose it" — motivational, urgent, empowering. Never guilt-tripping.

## Deployment

Push to `main` auto-deploys via Vercel. Use Vercel MCP from Claude Code to monitor deployments and check build logs.

## Related Repos

| Repo | What |
|------|------|
| `get-reps/reps-app` | Mobile app (React Native / Expo) |
| `get-reps/reps-ops` | Backend ops, scripts, n8n, Supabase migrations |
