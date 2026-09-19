# Echo gateway claim page

Removable static gateway surface at `/echo/`. It reuses the existing login page's REPS palette, system font and text wordmark. No external scripts, analytics, fonts, storage or new assets.

The gateway sends a link whose fragment contains `claim` and `token_hash`. The page reads them into memory and immediately clears the fragment and query using `history.replaceState`. It performs **no request until the person presses Connect my saves and open REPS**. Prefetching or merely opening the page cannot consume a claim.

The click POSTs `{ claim, token_hash }` to the fixed production Supabase `/functions/v1/echo-gateway/claim` endpoint. `#environment=staging` selects only the fixed staging project `ecxgtkoaerunnfklhglx`; arbitrary hosts are never accepted. The endpoint must allow the deployed web origin in its CORS response. It enforces the gateway feature flag, expiry, ownership and one-time redemption server-side; the static page is not the security gate.

Production success accepts only `https://www.getreps.io/login#token_hash=...&type=magiclink`, with no query, alternate credentials or extra fragment fields. The existing login page stays untouched. Staging success requires `{connected:true,environment:"staging"}` and stays on a clear trial confirmation, without navigating or minting a production-app login. Trial saves remain separate from the real library. A production-shaped redirect in staging, or a trial result in production, is refused.

Missing/malformed links, disabled gateway, expired claims, rejected redirects and network failures all show the same recovery: **Text or email Echo CLAIM for a fresh link.** Reloading intentionally loses in-memory credentials; reopening the original message link restores them if still valid. Requests time out after 20 seconds. No response body or token is logged or displayed.

## Unplug

1. Disable the gateway's feature flag at its server-side claim endpoint (and inbound/proactive tasks).
2. Remove the vendor webhook and channel adapter as covered by the backend runbook.
3. Delete `echo/` when the gateway is retired. No shared page or route configuration depends on it.

## Verify

`node --test echo/claim.test.mjs` exercises the real inline controller with browser-like globals: fragment scrubbing, no automatic POST, explicit click, fixed staging destination, refusal of untrusted redirects, expired/disabled handling, and duplicate-click suppression. It uses synthetic credentials only and makes no real network requests.

Browser smoke: serve the repository locally, open `/echo/#claim=<synthetic 32+ character token>&token_hash=<synthetic 32+ character token>`, intercept the claim request in Playwright, then confirm no request before clicking, no fragment after load, readable layout on a narrow phone, and generic recovery for a mocked 410 response. Do not test with real credentials, log request bodies, or contact the production endpoint for this UI smoke.

Verified 2026-09-19: all six controller tests passed. An isolated Chromium context at 390 × 844, with the exact page served through a Playwright route and the gateway mocked, confirmed zero automatic requests, immediate fragment removal, exactly one request after clicking, the 410 recovery state, no page errors and no horizontal overflow. Ready/recovery screenshots were inspected locally; no real credentials or vendor requests were used. This is UI proof, not a deployed gateway or app-login end-to-end result.
