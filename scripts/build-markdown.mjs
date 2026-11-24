#!/usr/bin/env node
/**
 * Markdown twins of the getreps.io pages, for AI agents (Peec agent-readiness, 2026-11-24).
 *
 * For every URL in sitemap-pages.xml, sitemap-compare.xml and sitemap-features.xml this reads the page's
 * source HTML, takes its primary content (<main>, else a single <article>, else <body> without
 * header/nav/footer) and writes a Markdown copy that is served at the page URL + ".md":
 *
 *   /                      -> home.md        (served at /home.md; `Accept: text/markdown` on / is answered by middleware.ts)
 *   /about                 -> about.md
 *   /compare               -> compare.md      (twin of compare/index.html, next to the compare/ folder)
 *   /compare/<slug>        -> compare/<slug>.md
 *
 * vercel.json carries, per page, a `Link: <…md>; rel="alternate"; type="text/markdown"` header and, per twin,
 * `Content-Type: text/markdown; charset=utf-8` + `Link: <page>; rel="canonical"`. scripts/build-markdown.test.mjs
 * fails when a twin is missing, stale, or lacks those vercel.json entries.
 *
 *   node scripts/build-markdown.mjs          # (re)write every twin
 *   node scripts/build-markdown.mjs --check  # exit 1 if any twin is out of date (writes nothing)
 *
 * Re-run after editing any page in the sitemaps. No dependencies: a small HTML parser for our own
 * hand-written static pages, not a general-purpose converter.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://www.getreps.io';
const SITEMAPS = ['sitemap-pages.xml', 'sitemap-compare.xml', 'sitemap-features.xml'];

// ---------------------------------------------------------------------------------------------- page set

/** Every sitemap page: { path, url, source (html file), twin (md file), twinUrl }. */
export function pages() {
  const out = [];
  for (const sm of SITEMAPS) {
    const xml = readFileSync(join(ROOT, sm), 'utf8');
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const url = m[1];
      const path = new URL(url).pathname.replace(/\/+$/, '') || '/';
      out.push({ path, url, ...filesFor(path) });
    }
  }
  return out;
}

export function filesFor(path) {
  if (path === '/') return { source: 'cs-c-lora.html', twin: 'home.md', twinUrl: `${ORIGIN}/home.md` };
  const rel = path.slice(1);
  const source = existsSync(join(ROOT, `${rel}.html`)) ? `${rel}.html` : `${rel}/index.html`;
  return { source, twin: `${rel}.md`, twinUrl: `${ORIGIN}/${rel}.md` };
}

// ---------------------------------------------------------------------------------------------- HTML parsing

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
// opening one of these closes an open element of the listed kinds (the cases our pages lean on)
const AUTO_CLOSE = { p: ['p'], li: ['li'], dt: ['dt', 'dd'], dd: ['dt', 'dd'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'] };

export function parse(html) {
  const root = { type: 'el', tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[i] === '<' && html[i + 1] === '!') {
      const end = html.indexOf('>', i);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    if (html[i] === '<' && html[i + 1] === '/') {
      const end = html.indexOf('>', i);
      const tag = html.slice(i + 2, end).trim().toLowerCase();
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      i = end + 1;
      continue;
    }
    if (html[i] === '<' && /[a-zA-Z]/.test(html[i + 1] || '')) {
      const m = /^<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(html.slice(i));
      if (!m) { pushText(top(), html[i]); i++; continue; }
      const tag = m[1].toLowerCase();
      const attrs = {};
      for (const a of m[2].matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
        attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      }
      const closes = AUTO_CLOSE[tag];
      if (closes && closes.includes(top().tag)) stack.pop();
      const el = { type: 'el', tag, attrs, children: [] };
      top().children.push(el);
      i += m[0].length;
      if (RAW.has(tag)) {
        const close = html.toLowerCase().indexOf(`</${tag}`, i);
        const stop = close < 0 ? html.length : close;
        el.children.push({ type: 'text', text: tag === 'title' ? decode(html.slice(i, stop)) : html.slice(i, stop) });
        i = close < 0 ? html.length : html.indexOf('>', close) + 1;
      } else if (!VOID.has(tag) && !m[3]) {
        stack.push(el);
      }
      continue;
    }
    const next = html.indexOf('<', i + 1);
    const stop = next < 0 ? html.length : next;
    pushText(top(), decode(html.slice(i, stop)));
    i = stop;
  }
  return root;
}

function pushText(parent, text) {
  const last = parent.children[parent.children.length - 1];
  if (last && last.type === 'text') last.text += text;
  else parent.children.push({ type: 'text', text });
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', hellip: '…', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', times: '×',
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', harr: '↔', check: '✓', star: '☆', starf: '★', minus: '−', deg: '°',
  eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', oacute: 'ó', ouml: 'ö', uuml: 'ü', auml: 'ä',
  ccedil: 'ç', ntilde: 'ñ', iacute: 'í', uacute: 'ú', thinsp: ' ', ensp: ' ', emsp: ' ', zwj: '', zwnj: '', shy: '',
};
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (all, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : all;
    }
    const v = ENTITIES[e.toLowerCase()];
    return v === undefined ? all : v;
  });
}

// ---------------------------------------------------------------------------------------------- tree helpers

const walk = (node, fn) => { fn(node); if (node.children) for (const c of node.children) walk(c, fn); };
export function find(node, pred) {
  let hit = null;
  walk(node, (n) => { if (!hit && n.type === 'el' && pred(n)) hit = n; });
  return hit;
}
export function findAll(node, pred) {
  const hits = [];
  walk(node, (n) => { if (n.type === 'el' && pred(n)) hits.push(n); });
  return hits;
}
const hasClass = (n, c) => (n.attrs.class || '').split(/\s+/).includes(c);
export const textOf = (n) => (n.type === 'text' ? n.text : (n.children || []).map(textOf).join(''));
const squash = (s) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------- HTML -> Markdown

// dropped with everything inside them
const SKIP = new Set([
  'head', 'script', 'style', 'template', 'svg', 'noscript', 'button', 'dialog', 'video', 'audio', 'canvas', 'iframe',
  'form', 'input', 'select', 'textarea', 'nav', 'header', 'footer', 'link', 'meta', 'source', 'picture-source',
]);
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'main', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'blockquote', 'figure', 'figcaption', 'details', 'summary', 'dl', 'dt',
  'dd', 'pre', 'hr', 'address', 'hgroup', '#root', 'body', 'html', 'picture',
]);

function skipped(n) {
  if (n.type !== 'el') return false;
  if (n.attrs.id === 'story-static') return false; // the crawler copy of the homepage hero is deliberately hidden
  if (SKIP.has(n.tag)) return true;
  if (n.attrs['aria-hidden'] === 'true' || 'hidden' in n.attrs) return true;
  if (hasClass(n, 'scroll-cue')) return true;
  return false;
}

/** Converts one primary-content element into Markdown. `base` resolves relative links. */
export function toMarkdown(node, base) {
  const ctx = { base, level: 1 };
  return tidy(blocks(node.children, ctx).join('\n\n'));
}

function blocks(nodes, ctx) {
  const out = [];
  let run = [];
  const flush = () => {
    const text = squash(inlineJoin(run, ctx));
    if (text && /[\p{L}\p{N}]/u.test(text.replace(/\]\([^)]*\)/g, ''))) out.push(escapeStart(text));
    run = [];
  };
  for (const n of nodes) {
    if (skipped(n)) continue;
    if (n.type === 'el' && BLOCK.has(n.tag)) { flush(); out.push(...block(n, ctx)); }
    else if (n.type === 'el' && n.tag === 'a' && find(n, (d) => d !== n && /^(h[1-6]|p|div|ul|ol)$/.test(d.tag))) {
      flush(); out.push(...cardLink(n, ctx)); // a whole card wrapped in one link
    } else run.push(n);
  }
  flush();
  return out.filter(Boolean);
}

/** A link wrapping a block card: render the card, and make its heading the link (or append the link). */
function cardLink(n, ctx) {
  const href = (n.attrs.href || '').trim();
  const inner = blocks(n.children, ctx);
  if (!href || href.startsWith('#')) return inner;
  const url = abs(href, ctx.base);
  const h = inner.findIndex((b) => /^#{1,6} /.test(b));
  if (h >= 0) inner[h] = inner[h].replace(/^(#{1,6}) (.*)$/, (_, m, text) => `${m} [${text}](${url})`);
  else if (inner.length && !/[\n[\]]/.test(inner[0])) inner[0] = `[${inner[0].replace(/\s*→$/, '')}](${url})`; // first line is the title
  else inner.push(`[${squash(textOf(n)) || url}](${url})`);
  return inner;
}

function block(n, ctx) {
  const t = n.tag;
  if (/^h[1-6]$/.test(t)) {
    const level = Number(t[1]);
    ctx.level = level;
    const text = squash(inline(n, ctx));
    return text ? [`${'#'.repeat(level)} ${text}`] : [];
  }
  if (t === 'p' || t === 'figcaption' || t === 'address') {
    const text = squash(inline(n, ctx));
    return text ? [escapeStart(text)] : [];
  }
  if (t === 'hr') return ['---'];
  if (t === 'pre') return ['```\n' + textOf(n).replace(/\n+$/, '') + '\n```'];
  if (t === 'ul' || t === 'ol') return [list(n, ctx)].filter(Boolean);
  if (t === 'blockquote') {
    const inner = blocks(n.children, ctx).join('\n\n');
    return inner ? [inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')] : [];
  }
  if (t === 'table') return [table(n, ctx)].filter(Boolean);
  if (t === 'dl') return [definitions(n, ctx)].filter(Boolean);
  if (t === 'details') {
    const summary = n.children.find((c) => c.type === 'el' && c.tag === 'summary');
    const rest = n.children.filter((c) => c !== summary);
    const head = summary ? squash(inline(summary, ctx)) : '';
    const level = Math.min(6, ctx.level + 1);
    const saved = ctx.level;
    const body = blocks(rest, { ...ctx, level });
    ctx.level = saved;
    return [head ? `${'#'.repeat(level)} ${head}` : '', ...body].filter(Boolean);
  }
  if (t === 'summary') {
    const text = squash(inline(n, ctx));
    return text ? [`**${text}**`] : [];
  }
  return blocks(n.children, ctx); // div, section, figure, li-less containers …
}

function list(n, ctx, depth = 0) {
  const ordered = n.tag === 'ol';
  let k = Number(n.attrs.start) || 1;
  const items = [];
  for (const li of n.children) {
    if (li.type !== 'el' || li.tag !== 'li' || skipped(li)) continue;
    const marker = ordered ? `${k++}.` : '-';
    const pad = ' '.repeat(marker.length + 1);
    const nested = [];
    const own = li.children.filter((c) => {
      if (c.type === 'el' && (c.tag === 'ul' || c.tag === 'ol')) { nested.push(c); return false; }
      return true;
    });
    // <li><span>Label</span><span>Value</span></li> (key/value fact lists) reads as "**Label:** Value"
    const els = own.filter((c) => c.type === 'el' && !skipped(c));
    const pair = els.length === 2 && els.every((c) => c.tag === 'span') && own.every((c) => c.type === 'el' || !c.text.trim()) &&
      squash(textOf(els[0])).split(' ').length <= 3;
    const body = pair
      ? `**${squash(inline(els[0], ctx)).replace(/:$/, '')}:** ${squash(inline(els[1], ctx))}`
      : blocks(own, ctx).join('\n\n');
    if (!body && !nested.length) continue;
    let item = `${marker} ${body.split('\n').join(`\n${pad}`)}`;
    for (const sub of nested) {
      const s = list(sub, ctx, depth + 1);
      if (s) item += `\n${s.split('\n').map((l) => pad + l).join('\n')}`;
    }
    items.push(item);
  }
  return items.join('\n');
}

function table(n, ctx) {
  const rows = findAll(n, (x) => x.tag === 'tr');
  if (!rows.length) return '';
  const cell = (c) => squash(inline(c, ctx)).replace(/\|/g, '\\|');
  const grid = rows.map((r) => r.children.filter((c) => c.type === 'el' && (c.tag === 'td' || c.tag === 'th')).map(cell));
  const width = Math.max(...grid.map((r) => r.length));
  const pad = (r) => [...r, ...Array(width - r.length).fill('')];
  const [head, ...body] = grid.map(pad);
  const line = (r) => `| ${r.join(' | ')} |`;
  return [line(head), line(Array(width).fill('---')), ...body.map(line)].join('\n');
}

function definitions(n, ctx) {
  const out = [];
  let term = null;
  for (const c of n.children) {
    if (c.type !== 'el' || skipped(c)) continue;
    if (c.tag === 'dt') term = squash(inline(c, ctx));
    else if (c.tag === 'dd') {
      const def = squash(blocks(c.children, ctx).join(' '));
      out.push(term ? `- **${term.replace(/:$/, '')}:** ${def}` : `- ${def}`);
      term = null;
    } else if (c.tag === 'div') {
      const inner = definitions(c, ctx); // <dl><div><dt/><dd/></div></dl> is valid HTML
      if (inner) out.push(inner);
    }
  }
  return out.join('\n');
}

// ---- inline

function inline(n, ctx) { return inlineJoin(n.children || [], ctx); }

function inlineJoin(nodes, ctx) {
  let s = '';
  let prevEl = false;
  for (const c of nodes) {
    if (skipped(c)) continue;
    if (c.type === 'text') { s += escapeText(c.text); prevEl = false; continue; }
    const piece = inlineEl(c, ctx);
    // two adjacent elements with no whitespace between them (flex/grid layouts, split headline lines) read as separate
    // words; so does a span/link set flush against a sentence ("…17271160).<span>More: …", "…1950s<span>Mike McGraw")
    if (piece && /^\S/.test(piece)) {
      if (prevEl && /\S$/.test(s)) s += ' ';
      else if (!prevEl && (c.tag === 'span' || c.tag === 'a') && /[\p{L}\p{N}.!?:;)]$/u.test(s) && /^[\p{L}\p{N}]/u.test(piece)) s += ' ';
    }
    s += piece;
    prevEl = true;
  }
  return s;
}

function inlineEl(n, ctx) {
  const t = n.tag;
  if (t === 'br') return '  \n';
  if (t === 'img') {
    const alt = squash(n.attrs.alt || '');
    // logos and icons ("REPS", "Anki") repeat the text beside them; keep only descriptive alt text
    if (alt.split(' ').length < 3 || !n.attrs.src) return '';
    return `![${alt.replace(/[[\]]/g, '')}](${abs(n.attrs.src, ctx.base)})`;
  }
  // a glyph-only element with an aria-label ("★★★★★" labelled "5 stars") reads as its label
  const label = n.attrs['aria-label'];
  const raw = squash(textOf(n));
  if (label && raw && !/[\p{L}\p{N}]/u.test(raw)) return escapeText(label);
  if (BLOCK.has(t)) return ` ${squash(blocks(n.children, ctx).join(' '))} `;
  const inner = inline(n, ctx);
  if (t === 'a') {
    const text = squash(inner);
    const href = (n.attrs.href || '').trim();
    if (!text) return '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return inner;
    return `[${text}](${abs(href, ctx.base)})`;
  }
  if (t === 'strong' || t === 'b') return wrap(inner, '**');
  if (t === 'em' || t === 'i' || t === 'cite') return wrap(inner, '*');
  if (t === 'code' || t === 'kbd') return inner.trim() ? `\`${textOf(n).trim()}\`` : '';
  if (t === 'q') return `“${inner}”`;
  return inner;
}

function wrap(inner, mark) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
}

function abs(href, base) {
  try {
    const u = new URL(href, base);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      if (u.hostname === 'getreps.io') u.hostname = 'www.getreps.io';
      return u.href.replace(/ /g, '%20').replace(/\)/g, '%29');
    }
    return u.href;
  } catch {
    return href;
  }
}

function escapeText(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/(^|[^\p{L}\p{N}])_|_(?=[^\p{L}\p{N}]|$)/gu, (m) => m.replace('_', '\\_'));
}

const escapeStart = (s) => s.replace(/^(#{1,6}\s|>|[-+]\s|\d+[.)]\s)/, '\\$1');

function tidy(md) {
  // a heading left with nothing under it (its content was a video or a button) is dropped
  const parts = md.split(/\n{2,}/);
  const level = (b) => (/^(#{1,6}) /.exec(b) || [])[1]?.length;
  const kept = parts.filter((b, i) => {
    const l = level(b);
    if (!l) return true;
    const next = parts.slice(i + 1).find(Boolean);
    return next !== undefined && !(level(next) && level(next) <= l);
  });
  return kept
    .join('\n\n')
    .split('\n')
    .map((l) => (l.trim() ? l.replace(/[ \t]+$/g, (m) => (m === '  ' ? m : '')) : ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------------------------- one page

/** git autocrlf checkouts on Windows hold CRLF; compare and parse on LF. */
export const lf = (s) => s.replace(/\r\n?/g, '\n');

export function render(page) {
  const html = lf(readFileSync(join(ROOT, page.source), 'utf8'));
  const doc = parse(html);
  const title = squash(textOf(find(doc, (n) => n.tag === 'title') || { type: 'text', text: '' }));
  const canonical = find(doc, (n) => n.tag === 'link' && /(^|\s)canonical(\s|$)/i.test(n.attrs.rel || ''))?.attrs.href;

  const mains = findAll(doc, (n) => n.tag === 'main');
  const articles = findAll(doc, (n) => n.tag === 'article');
  const body = find(doc, (n) => n.tag === 'body') || doc;
  const primary = mains[0] || (articles.length === 1 ? articles[0] : body);

  let md = toMarkdown(primary, page.url);

  // Homepage: the hero headline and scene captions live in <template id="tpl"> and are stamped in by JS. When the page
  // does not yet carry a crawler-readable copy (#story-static, with an <h1>), take them from the template.
  if (page.path === '/' && !/^# /m.test(md)) {
    const tpl = find(doc, (n) => n.tag === 'template' && n.attrs.id === 'tpl');
    if (tpl) {
      const hero = find(tpl, (n) => hasClass(n, 'hero'));
      const eyebrow = hero && find(hero, (n) => hasClass(n, 'eyebrow'));
      const h1 = hero && find(hero, (n) => n.tag === 'h1');
      const caps = findAll(tpl, (n) => hasClass(n, 'cap')).map((c) => squash(inline(c, { base: page.url, level: 1 })));
      const lead = [
        eyebrow ? squash(textOf(eyebrow)) : '',
        h1 ? `# ${squash(inline(h1, { base: page.url, level: 1 }))}` : '',
        caps.length ? caps.map((c) => `- ${c}`).join('\n') : '',
      ].filter(Boolean);
      md = [...lead, md].join('\n\n');
    }
  }

  const header = [];
  if (!/^# /m.test(md) && title) header.push(`# ${title}`);
  header.push(`Source: ${canonical ? abs(canonical, page.url) : page.url}`);
  return `${header.join('\n\n')}\n\n${md}\n`;
}

// ---------------------------------------------------------------------------------------------- CLI

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const page of pages()) {
    const md = render(page);
    const file = join(ROOT, page.twin);
    const current = existsSync(file) ? lf(readFileSync(file, 'utf8')) : null;
    if (current === md) continue;
    if (check) { console.error(`stale: ${page.twin} (run node scripts/build-markdown.mjs)`); stale++; continue; }
    writeFileSync(file, md);
    console.log(`wrote ${page.twin} (${md.length} chars)`);
  }
  if (stale) process.exit(1);
}
