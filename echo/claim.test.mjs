import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const controller = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const claim = 'synthetic_claim_'.padEnd(48, 'x');
const tokenHash = 'synthetic_hash_'.padEnd(64, 'a');
const fragment = `#claim=${claim}&token_hash=${tokenHash}`;
const redirect = `https://www.getreps.io/login#token_hash=${tokenHash}&type=magiclink`;

function browser({ hash = fragment, response = { ok: true, json: async () => ({ redirect }) }, scrubFails = false } = {}) {
  const elements = Object.fromEntries(['connect', 'title', 'description', 'status', 'recovery'].map(id => [id, {
    disabled: id === 'connect', hidden: id === 'recovery', textContent: '',
    addEventListener(event, callback) { this[event] = callback; },
  }]));
  const calls = [];
  const navigations = [];
  let onReady;
  const window = {
    location: { hash, pathname: '/echo/', replace: url => navigations.push(url) },
    history: { replaceState: (_state, _title, path) => {
      if (scrubFails) throw new Error('blocked');
      assert.equal(path, '/echo/');
      window.location.hash = '';
    } },
  };
  vm.runInNewContext(controller, {
    window, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    document: { addEventListener: (_event, fn) => { onReady = fn; }, getElementById: id => elements[id] },
    fetch: async (url, options) => { calls.push({ url, options }); return typeof response === 'function' ? response() : response; },
  });
  assert.equal(window.location.hash, scrubFails ? hash : '');
  onReady();
  return { elements, calls, navigations, click: () => elements.connect.click?.() };
}

test('scrubs credentials immediately and requires a click before contacting gateway', async () => {
  const page = browser();
  assert.equal(page.calls.length, 0);
  assert.equal(page.elements.connect.disabled, false);
  await page.click();
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].url, 'https://vciosaulrfvddcenblmo.supabase.co/functions/v1/echo-gateway/claim');
  assert.deepEqual(JSON.parse(page.calls[0].options.body), { claim, token_hash: tokenHash });
  assert.equal(page.calls[0].options.credentials, 'omit');
  assert.equal(page.calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(page.calls[0].options.redirect, 'error');
  assert.deepEqual(page.navigations, [redirect]);
});

test('staging selects exactly the known staging host', async () => {
  const page = browser({ hash: `${fragment}&environment=staging`, response: { ok: true, json: async () => ({ connected: true, environment: 'staging' }) } });
  await page.click();
  assert.equal(page.calls[0].url, 'https://ecxgtkoaerunnfklhglx.supabase.co/functions/v1/echo-gateway/claim');
  assert.equal(page.navigations.length, 0);
  assert.equal(page.elements.title.textContent, 'Your trial saves are connected');
  assert.equal(page.elements.connect.hidden, true);
});

test('staging refuses a production login handoff and production refuses a trial result', async () => {
  for (const page of [browser({ hash: `${fragment}&environment=staging` }), browser({ response: { ok: true, json: async () => ({ connected: true, environment: 'staging' }) } })]) {
    await page.click();
    assert.equal(page.navigations.length, 0);
    assert.equal(page.elements.recovery.hidden, false);
  }
});

test('invalid credentials or environment cannot start a claim', async () => {
  for (const hash of ['', '#claim=short&token_hash=short', `${fragment}&environment=https://evil.example`, `${fragment}&claim=${claim}`, `${fragment}&environment=staging&environment=production`]) {
    const page = browser({ hash });
    await page.click();
    assert.equal(page.calls.length, 0);
    assert.equal(page.elements.recovery.hidden, false);
    assert.equal(page.elements.connect.hidden, true);
  }
  const page = browser({ scrubFails: true });
  await page.click();
  assert.equal(page.calls.length, 0);
});

test('disabled, expired and network errors offer generic recovery without provider data', async () => {
  for (const response of [{ ok: false, status: 410 }, { ok: false, status: 503 }, () => { throw new Error('sensitive provider error'); }]) {
    const page = browser({ response });
    await page.click();
    assert.equal(page.elements.connect.hidden, true);
    assert.equal(page.elements.recovery.hidden, false);
    assert.equal(page.elements.description.textContent, 'This link has expired or connecting saves is temporarily unavailable.');
    assert.equal(page.navigations.length, 0);
  }
});

test('untrusted destinations and unexpected login fields never receive a credential', async () => {
  for (const badRedirect of [
    `https://evil.example/login#token_hash=${tokenHash}&type=magiclink`,
    `https://www.getreps.io.evil.example/login#token_hash=${tokenHash}&type=magiclink`,
    `https://www.getreps.io/other#token_hash=${tokenHash}&type=magiclink`,
    `https://www.getreps.io/login?token_hash=${tokenHash}`,
    `https://someone@www.getreps.io/login#token_hash=${tokenHash}&type=magiclink`,
    `${redirect}&next=https://evil.example`,
    `${redirect}&token_hash=${tokenHash}`,
    '/login', 'javascript:alert(1)', null,
  ]) {
    const page = browser({ response: { ok: true, json: async () => ({ redirect: badRedirect }) } });
    await page.click();
    assert.equal(page.navigations.length, 0);
    assert.equal(page.elements.recovery.hidden, false);
  }
});

test('rapid repeated clicks make one request', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const page = browser({ response: () => pending });
  const first = page.click();
  await page.click();
  assert.equal(page.calls.length, 1);
  complete({ ok: true, json: async () => ({ redirect }) });
  await first;
  assert.equal(page.navigations.length, 1);
});
