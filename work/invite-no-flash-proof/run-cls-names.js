// Layout-shift check across name lengths and viewports (mocked lookup, no avatar).
async (page) => {
  const ROOT = 'C:/Projects/reps-web-worktrees/crew-invite-page-no-flash-from-generic-to-per-2749e5/work/invite-no-flash-proof/frames/cls-names';
  const names = ['Al', 'Sam', 'Christopher', 'Maximilianoalexandrovich'];
  const viewports = [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 1440, height: 900 }];
  const out = [];
  for (const vp of viewports) {
    for (const name of names) {
      const ctx = await page.context().browser().newContext({ viewport: vp });
      await ctx.route('**/api/invite-preview**', async (route) => {
        await new Promise((r) => setTimeout(r, 600));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ first_name: name, avatar_url: null }) });
      });
      await ctx.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
      });
      const p = await ctx.newPage();
      await p.goto('http://127.0.0.1:8731/invite.html?code=ABCD2345');
      const btnBefore = await p.evaluate(() => document.getElementById('open-link').getBoundingClientRect().top);
      await p.waitForTimeout(1500);
      const r = await p.evaluate(() => ({
        cls: window.__cls,
        btnAfter: document.getElementById('open-link').getBoundingClientRect().top,
        h1Lines: Math.round(document.getElementById('headline').getBoundingClientRect().height / parseFloat(getComputedStyle(document.getElementById('headline')).lineHeight)),
      }));
      await p.screenshot({ path: `${ROOT}/${vp.width}-${name}.png` });
      out.push({ vp: vp.width, name, btnBefore: Math.round(btnBefore), btnAfter: Math.round(r.btnAfter), h1Lines: r.h1Lines, cls: +r.cls.toFixed(4) });
      await ctx.close();
    }
  }
  return JSON.stringify(out);
}
