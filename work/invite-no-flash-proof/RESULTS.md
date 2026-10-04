# Invite page: hold-then-reveal runtime proof (2026-10-04)

Chromium (Playwright MCP), 390x844, local static server on 127.0.0.1:8731 serving this worktree.
`/api/invite-preview` and the avatar image were mocked with `context.route`; nothing reached production.
Re-run: `browser_run_code_unsafe` with `run-proof.js`, then `run-cls-names.js`.

Each scenario records screenshots at the target times (actual capture time in brackets is a few ms
later; the 100 ms shot lands ~280 ms because the first screenshot takes that long) plus a per-frame
(requestAnimationFrame) log of every distinct visible state of the headline.

| Scenario | Per-frame state log | CLS |
|---|---|---|
| a. personal, lookup 800 ms | HOLD @133 ms -> "Sam is inviting you to REPS" + photo @1069 ms. Generic text never visible. | 0 |
| b. lookup 500 | HOLD @82 ms -> generic @365 ms | 0 |
| c. lookup 4 s | HOLD @92 ms -> generic @2627 ms (deadline), the 4 s answer is ignored | 0 |
| d. JavaScript off | generic at the first frame, no hold, no lookup | 0 |
| e. lookup 300 ms, photo 4 s | HOLD -> "Sam" + monogram @2636 ms (deadline) -> photo fades in over the monogram @4489 ms | 0 |
| f. instant (cache hit) | HOLD @74 ms -> "Sam" + photo @242 ms | 0 |
| g. no code in the URL | generic at the first frame, no hold, no lookup | 0 |

Primary button href is identical in a, b, c, e, f (OneLink with the code); it is visible and clickable
through the hold. No-JS / no-code keep the App Store default, as before.

Layout shift by name length (`frames/cls-names/`), lookup 600 ms, no photo:

| Viewport | Al / Sam / Christopher (2 lines) | Maximilianoalexandrovich (24 chars, 3 lines) |
|---|---|---|
| 390 | 0 | 0.0264 |
| 360 | 0 | 0.0312 |
| 1440 | 0 | 0.0054 |

The headline reserves two lines; only a name long enough to force a third line shifts the button down,
still well under the 0.1 "good" CLS threshold.
