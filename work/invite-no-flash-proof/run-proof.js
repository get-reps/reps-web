// Runtime proof for the invite page hold-then-reveal (no generic -> personal flash).
// Run through the Playwright MCP `browser_run_code_unsafe` tool with this file, against a local
// static server on 127.0.0.1:8731 serving the worktree. Every /api/invite-preview call and the
// avatar image are mocked here; nothing reaches production.
async (page) => {
  const ROOT = 'C:/Projects/reps-web-worktrees/crew-invite-page-no-flash-from-generic-to-per-2749e5/work/invite-no-flash-proof/frames';
  const BASE = 'http://127.0.0.1:8731/invite.html?code=ABCD2345&source=share';
  const AVATAR = 'https://vciosaulrfvddcenblmo.supabase.co/storage/v1/object/public/avatars/proof.png';
  const SHOTS = [0, 100, 300, 600, 1000, 2000, 3000];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const png = await (await page.request.get('http://127.0.0.1:8731/logo.png')).body();

  const scenarios = [
    { name: 'a-personal-800ms', api: { delay: 800, status: 200, body: { first_name: 'Sam', avatar_url: AVATAR } }, avatarDelay: 0 },
    { name: 'b-route-500', api: { delay: 150, status: 500, body: { error: 'boom' } } },
    { name: 'c-route-slow-4s', api: { delay: 4000, status: 200, body: { first_name: 'Sam', avatar_url: AVATAR } }, shots: [...SHOTS, 2600, 4500] },
    { name: 'd-no-js', js: false, api: { delay: 0, status: 200, body: { first_name: 'Sam', avatar_url: AVATAR } } },
    { name: 'e-slow-avatar-4s', api: { delay: 300, status: 200, body: { first_name: 'Sam', avatar_url: AVATAR } }, avatarDelay: 4000, shots: [...SHOTS, 2600, 4800] },
    { name: 'f-instant-cache-hit', api: { delay: 0, status: 200, body: { first_name: 'Sam', avatar_url: AVATAR } }, avatarDelay: 0 },
    { name: 'g-no-code', url: 'http://127.0.0.1:8731/invite.html', api: { delay: 0, status: 200, body: {} } },
  ];

  const results = [];
  for (const s of scenarios) {
    const ctx = await page.context().browser().newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      javaScriptEnabled: s.js !== false,
    });
    let apiCalls = 0;
    await ctx.route('**/api/invite-preview**', async (route) => {
      apiCalls++;
      await sleep(s.api.delay);
      await route.fulfill({ status: s.api.status, contentType: 'application/json', body: JSON.stringify(s.api.body) }).catch(() => {});
    });
    await ctx.route(AVATAR, async (route) => {
      await sleep(s.avatarDelay || 0);
      await route.fulfill({ status: 200, contentType: 'image/png', body: png }).catch(() => {});
    });
    // Records every distinct visible state of the inviter-dependent area, once per frame,
    // plus layout shifts. The page's own scripts are untouched.
    await ctx.addInitScript(() => {
      window.__states = [];
      window.__cls = 0;
      window.__shifts = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ t: Math.round(e.startTime), v: e.value }); }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
      let last = '';
      const tick = () => {
        const h1 = document.getElementById('headline');
        const slot = document.getElementById('hero-slot');
        if (h1 && slot) {
          const cs = getComputedStyle(h1);
          const shown = cs.visibility === 'visible' && parseFloat(cs.opacity) > 0;
          const hero = slot.firstElementChild ? (slot.firstElementChild.className || slot.firstElementChild.tagName) : '';
          const photo = slot.querySelector('img.late.shown, img:not(.echo):not(.late)') ? 'photo' : '';
          const state = shown ? 'SHOWN: "' + h1.textContent.trim() + '" hero=' + hero + (photo ? '+photo' : '') : 'HOLD (headline hidden)';
          if (state !== last) { window.__states.push({ t: Math.round(performance.now()), state }); last = state; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const p = await ctx.newPage();
    const t0 = Date.now();
    const nav = p.goto(s.url || BASE, { waitUntil: 'commit' });
    await nav;
    const shotsTaken = [];
    for (const at of (s.shots || SHOTS).sort((x, y) => x - y)) {
      const wait = at - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
      const actual = Date.now() - t0;
      const file = `${ROOT}/${s.name}/t${String(at).padStart(4, '0')}ms.png`;
      await p.screenshot({ path: file });
      const visible = await p.evaluate(() => {
        const h1 = document.getElementById('headline');
        const cs = h1 && getComputedStyle(h1);
        return cs ? (cs.visibility === 'visible' ? `opacity ${(+cs.opacity).toFixed(2)}: ${h1.textContent.trim()}` : 'held (hidden)') : 'not parsed yet';
      }).catch((e) => 'eval failed: ' + e.message);
      shotsTaken.push({ target: at, actualMs: actual, headline: visible, file });
    }
    const out = await p.evaluate(() => ({
      states: window.__states || [],
      cls: window.__cls || 0,
      shifts: window.__shifts || [],
      hrefs: { open: document.getElementById('open-link').href, app: document.getElementById('app-link').href },
      title: document.title,
    })).catch(() => ({ note: 'no-js: page scripts cannot be evaluated' }));
    results.push({ scenario: s.name, apiCalls, shots: shotsTaken, ...out });
    await ctx.close();
  }
  return JSON.stringify(results, null, 2);
}
