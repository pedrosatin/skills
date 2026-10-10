#!/usr/bin/env node
// Portfolio Hub: one offline HTML indexing every project with a `.scratch/`
// under the configured roots. Sibling of generate-hub.mjs; ticket columns come
// from the shared scratch-tickets.mjs module so both screens agree.
//
// Usage:
//   node generate-portfolio.mjs                 # default roots, writes ~/Work/.scratch/portfolio.html
//   node generate-portfolio.mjs --out <file>    # write elsewhere
//   node generate-portfolio.mjs --root <dir> [--root <dir>...] [--top <dir>]
//   node generate-portfolio.mjs --fixture       # fixture roots + structural smoke (exit 1 on failure)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readProjectScratch } from './scratch-tickets.mjs';

const MAX_DEPTH = 4;
const IGNORED_DIRS = new Set(['cdk.out', 'node_modules', '.cache', '.git', 'fixtures', '.worktrees', '.scratch']);
const WAITING_STATUSES = new Set(['blocked', 'needs-triage', 'needs-info']);
const NEXT_LIMIT = 3;
const TOP_GROUP = 'work';

const COLUMN_LABELS = [
  ['backlog', 'backlog'],
  ['blocked', 'bloqueado'],
  ['ready-for-agent', 'pronto'],
  ['in-progress', 'em andamento'],
  ['done', 'concluído'],
];

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureBase = path.join(skillDir, 'fixtures', 'portfolio-scratch');

// ---------------------------------------------------------------- CLI

function usage(code) {
  const msg = `Usage: generate-portfolio.mjs [--out <file>] [--root <dir>]... [--top <dir>] [--fixture]

  --root <dir>   Root to walk (group = basename). Repeatable. Replaces the default roots.
  --top <dir>    Directory whose own .scratch is the "${TOP_GROUP}" group (no walk).
  --out <file>   Output HTML (default ~/Work/.scratch/portfolio.html).
  --fixture      Use fixtures/portfolio-scratch, write fixtures/portfolio-fixture.html, run the smoke.
  --help         Show this help.`;
  (code ? console.error : console.log)(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { roots: [], top: null, out: null, fixture: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) { console.error(`Missing value for ${a}`); usage(2); }
      return v;
    };
    if (a === '--fixture') opts.fixture = true;
    else if (a === '--root') opts.roots.push(value());
    else if (a === '--top') opts.top = value();
    else if (a === '--out') opts.out = value();
    else if (a === '--help' || a === '-h') usage(0);
    else { console.error(`Unknown argument: ${a}`); usage(2); }
  }
  return opts;
}

function expandHome(p) {
  return p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
}

const opts = parseArgs(process.argv.slice(2));
const workDir = path.join(os.homedir(), 'Work');

let roots;
let outputFile;
if (opts.fixture) {
  roots = [
    { dir: path.join(fixtureBase, 'alpha'), group: 'alpha', walk: true },
    { dir: path.join(fixtureBase, 'beta'), group: 'beta', walk: true },
    { dir: fixtureBase, group: TOP_GROUP, walk: false },
  ];
  outputFile = opts.out ? path.resolve(expandHome(opts.out)) : path.join(skillDir, 'fixtures', 'portfolio-fixture.html');
} else {
  const explicit = opts.roots.length > 0 || opts.top;
  const rootDirs = explicit ? opts.roots : ['personal', 'bliss', 'unicesumar'].map(n => path.join(workDir, n));
  const topDir = explicit ? opts.top : workDir;
  roots = rootDirs.map(d => {
    const dir = path.resolve(expandHome(d));
    return { dir, group: path.basename(dir), walk: true };
  });
  if (topDir) roots.push({ dir: path.resolve(expandHome(topDir)), group: TOP_GROUP, walk: false });
  outputFile = path.resolve(expandHome(opts.out || path.join(workDir, '.scratch', 'portfolio.html')));
}

// ---------------------------------------------------------------- discovery

function hasScratchDir(dir) {
  try {
    return fs.statSync(path.join(dir, '.scratch')).isDirectory();
  } catch {
    return false;
  }
}

/** Project dirs under `root` (root included), down to MAX_DEPTH levels. Never follows dir symlinks. */
function discoverProjects(root) {
  const found = [];
  const walk = (dir, depth) => {
    if (hasScratchDir(dir)) found.push(dir);
    if (depth >= MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      // Dirent.isDirectory() is false for symlinks, so links are never followed.
      if (!e.isDirectory() || IGNORED_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

/** Newest mtime among `.md` files under the scratch dir, as local YYYY-MM-DD, or null. */
function lastMarkdownChange(scratchDir) {
  let newest = 0;
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.md')) {
        try {
          newest = Math.max(newest, fs.statSync(p).mtimeMs);
        } catch {}
      }
    }
  };
  walk(scratchDir);
  if (!newest) return null;
  const d = new Date(newest);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildProject(dir, group) {
  const scratch = readProjectScratch(dir);
  const hubFile = path.join(scratch.scratchDir, 'index.html');
  const hasHub = fs.existsSync(hubFile);
  return {
    name: path.basename(dir),
    path: dir,
    group,
    features: scratch.features.length,
    counts: scratch.counts,
    tickets: scratch.tickets.length,
    open: scratch.tickets.length - scratch.counts.done,
    waiting: scratch.tickets.filter(t => WAITING_STATUSES.has(t.rawStatus)).length,
    next: scratch.tickets
      .filter(t => t.computedColumn === 'ready-for-agent')
      .slice(0, NEXT_LIMIT)
      .map(t => ({ feature: t.feature, id: t.id, title: t.title })),
    lastChange: lastMarkdownChange(scratch.scratchDir),
    hubUrl: hasHub ? pathToFileURL(hubFile).href : null,
  };
}

const groups = [];
const seen = new Set();
for (const root of roots) {
  let group = groups.find(g => g.name === root.group);
  if (!group) {
    group = { name: root.group, roots: [], projects: [] };
    groups.push(group);
  }
  group.roots.push(root.dir);
  if (!fs.existsSync(root.dir)) {
    console.warn(`[Portfolio Hub] root ausente, ignorado: ${root.dir}`);
    continue;
  }
  const dirs = root.walk ? discoverProjects(root.dir) : (hasScratchDir(root.dir) ? [root.dir] : []);
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    group.projects.push(buildProject(dir, root.group));
  }
}
for (const g of groups) g.projects.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

// ---------------------------------------------------------------- HTML

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugId(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo';
}

function renderCard(p) {
  const countAttrs = COLUMN_LABELS.map(([id]) => `data-count-${id}="${p.counts[id] || 0}"`).join(' ');
  const counts = COLUMN_LABELS.map(([id, label]) =>
    `<div class="count col-${id}" data-col="${id}"><dt>${label}</dt><dd>${p.counts[id] || 0}</dd></div>`).join('');
  const nameHtml = p.hubUrl
    ? `<a class="hub-link" href="${escapeHtml(p.hubUrl)}">${escapeHtml(p.name)}</a>`
    : escapeHtml(p.name);
  const hubHtml = p.hubUrl
    ? ''
    : '<p class="hub-missing" data-hub-missing>Hub ausente: rode generate-hub neste projeto para criar .scratch/index.html.</p>';
  const nextHtml = p.next.length
    ? `<ol class="next-list">${p.next.map(t =>
      `<li data-next="${escapeHtml(`${t.feature}/${t.id}`)}"><span class="tid">${escapeHtml(t.id)}</span> ${escapeHtml(t.title)} <span class="feat">${escapeHtml(t.feature)}</span></li>`).join('')}</ol>`
    : '<p class="muted">Nenhum ticket pronto.</p>';
  return `<article class="card" data-group="${escapeHtml(p.group)}" data-path="${escapeHtml(p.path)}" data-name="${escapeHtml(p.name)}" data-features="${p.features}" data-tickets="${p.tickets}" data-open="${p.open}" data-waiting="${p.waiting}" data-hub="${p.hubUrl ? 'yes' : 'no'}" data-last-change="${escapeHtml(p.lastChange || '')}" ${countAttrs}>
  <header class="card-head">
    <h3 class="card-title">${nameHtml}</h3>
    <span class="group-label">${escapeHtml(p.group)}</span>
  </header>
  <p class="card-path">${escapeHtml(p.path)}</p>
  ${hubHtml}
  <p class="meta"><span>${p.features} ${p.features === 1 ? 'feature' : 'features'}</span><span>${p.tickets} tickets</span><span class="waiting${p.waiting ? ' has-waiting' : ''}">esperando você: <strong>${p.waiting}</strong></span></p>
  <dl class="counts">${counts}</dl>
  <section class="next" aria-label="Próximos tickets de ${escapeHtml(p.name)}">
    <h4>Próximos</h4>
    ${nextHtml}
  </section>
  <p class="last-change">Última mudança: <time${p.lastChange ? ` datetime="${p.lastChange}"` : ''}>${p.lastChange || 'sem .md'}</time></p>
</article>`;
}

function renderGroup(g) {
  const id = `group-${slugId(g.name)}`;
  const n = g.projects.length;
  const body = n
    ? `<div class="grid">${g.projects.map(renderCard).join('\n')}</div>`
    : '<p class="muted">Nenhum projeto com .scratch neste grupo.</p>';
  return `<section class="group" data-group="${escapeHtml(g.name)}" aria-labelledby="${id}">
  <h2 id="${id}" class="group-title"><span class="group-name">${escapeHtml(g.name)}</span> <span class="group-count">${n} ${n === 1 ? 'projeto' : 'projetos'}</span></h2>
  <p class="group-roots">${g.roots.map(escapeHtml).join(' · ')}</p>
  ${body}
</section>`;
}

function renderHtml() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const generated = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Hub</title>
  <style>
    :root {
      --bg: #09090b;
      --surface: #18181b;
      --surface-hover: #27272a;
      --surface-border: #3f3f46;
      --text: #e4e4e7;
      --text-muted: #a1a1aa;
      --accent: #22c55e;
      --accent-fg: #09090b;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #06b6d4;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      line-height: 1.4;
    }
    .page-header {
      background: var(--surface);
      border-bottom: 1px solid var(--surface-border);
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .page-title { font-size: 1.25rem; font-weight: 700; color: #fff; }
    .generated { color: var(--text-muted); font-size: 0.8rem; }
    main { padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem; }
    .group-title { font-size: 1rem; font-weight: 700; color: #fff; display: flex; gap: 0.6rem; align-items: baseline; }
    .group-count { color: var(--text-muted); font-size: 0.8rem; font-weight: 500; }
    .group-roots { color: var(--text-muted); font-size: 0.75rem; margin: 0.15rem 0 0.75rem; word-break: break-all; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 0.85rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 0.9rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .card:hover { border-color: var(--text-muted); }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
    .card-title { font-size: 1rem; font-weight: 700; color: #fff; word-break: break-word; }
    .hub-link { color: var(--accent); text-decoration: none; }
    .hub-link:hover, .hub-link:focus-visible { text-decoration: underline; }
    .hub-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .group-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      border: 1px solid var(--surface-border);
      border-radius: 4px;
      padding: 0.05rem 0.4rem;
      white-space: nowrap;
    }
    .card-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; color: var(--text-muted); word-break: break-all; }
    .hub-missing { font-size: 0.78rem; color: var(--warning); border-left: 2px solid var(--warning); padding-left: 0.5rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-muted); }
    .waiting.has-waiting { color: var(--warning); }
    .waiting strong { color: inherit; }
    .counts { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .count { flex: 1 1 0; min-width: min-content; background: var(--bg); border: 1px solid var(--surface-border); border-radius: 4px; padding: 0.3rem 0.2rem; text-align: center; }
    .count dt { font-size: 0.64rem; line-height: 1.2; color: var(--text-muted); }
    .count dd { font-size: 1rem; font-weight: 700; color: var(--text); }
    .col-blocked dd { color: var(--danger); }
    .col-ready-for-agent dd { color: var(--success); }
    .col-in-progress dd { color: var(--info); }
    .next h4 { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 0.25rem; }
    .next-list { list-style: none; display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; }
    .tid { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent); }
    .feat { color: var(--text-muted); font-size: 0.72rem; }
    .muted { color: var(--text-muted); font-size: 0.8rem; }
    .last-change { font-size: 0.75rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <header class="page-header">
    <h1 class="page-title">Portfolio Hub</h1>
    <span class="generated">gerado em ${generated}</span>
  </header>
  <main>
${groups.map(renderGroup).join('\n')}
  </main>
</body>
</html>
`;
}

const html = renderHtml();
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, html);

const totalProjects = groups.reduce((n, g) => n + g.projects.length, 0);

// ---------------------------------------------------------------- fixture smoke

function decodeAttr(v) {
  return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Cards as read back from the HTML artifact: attributes plus inner markup. */
function cardsFromHtml(doc) {
  const cards = [];
  for (const m of doc.matchAll(/<article class="card"([^>]*)>([\s\S]*?)<\/article>/g)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([a-z-]+)="([^"]*)"/g)) attrs[a[1]] = decodeAttr(a[2]);
    cards.push({ attrs, inner: m[2] });
  }
  return cards;
}

function runSmoke(doc) {
  const failures = [];
  const abs = rel => (rel === '.' ? fixtureBase : path.join(fixtureBase, rel));
  const zero = { backlog: 0, blocked: 0, 'ready-for-agent': 0, 'in-progress': 0, done: 0 };
  const expected = [
    { rel: 'alpha', group: 'alpha', features: 1, counts: { ...zero, backlog: 1 }, waiting: 1, next: [], hub: false },
    {
      rel: 'alpha/app-one', group: 'alpha', features: 2,
      counts: { backlog: 1, blocked: 1, 'ready-for-agent': 4, 'in-progress': 1, done: 1 }, waiting: 1,
      next: [['feat-a/01', 'Configurar &lt;build&gt; &amp; deploy'], ['feat-a/04', 'Ticket com status open'], ['feat-a/06', 'Ticket sem bloqueador']],
      hub: true,
    },
    {
      rel: 'alpha/app-one/services/inner-svc', group: 'alpha', features: 1,
      counts: { ...zero, 'ready-for-agent': 1, done: 1 }, waiting: 0, next: [['feat-n/02', 'Depois da base']], hub: false,
    },
    {
      rel: 'beta/app-two', group: 'beta', features: 1,
      counts: { ...zero, backlog: 1, blocked: 1, 'ready-for-agent': 1 }, waiting: 2, next: [['feat-c/03', 'Ajustar export']], hub: false,
    },
    { rel: 'beta/empty-proj', group: 'beta', features: 0, counts: zero, waiting: 0, next: [], hub: false },
    { rel: '.', group: TOP_GROUP, features: 1, counts: { ...zero, 'ready-for-agent': 1 }, waiting: 0, next: [['coord/01', 'Alinhar roots do portfolio']], hub: true },
  ];

  if (/cdk\.out/.test(doc) || doc.includes('Ruído do cdk.out')) failures.push('noise path under cdk.out is present in the HTML');
  if (/https?:\/\//.test(doc.replace(/xmlns="[^"]*"/g, ''))) failures.push('external http(s) URL present (no CDN allowed)');
  if (!/--accent\s*:\s*#22c55e/.test(doc)) failures.push('missing default --accent: #22c55e');
  if (/#6366f1/i.test(doc)) failures.push('indigo #6366f1 present');

  for (const g of ['alpha', 'beta', TOP_GROUP]) {
    const re = new RegExp(`<section class="group" data-group="${g}"[^>]*>\\s*<h2[^>]*><span class="group-name">${g}</span>`);
    if (!re.test(doc)) failures.push(`missing group section/label "${g}"`);
  }

  const cards = cardsFromHtml(doc);
  const actualOrder = cards.map(c => c.attrs['data-path']);
  const expectedOrder = expected.map(e => abs(e.rel));
  if (actualOrder.length !== expectedOrder.length) {
    failures.push(`expected ${expectedOrder.length} cards, got ${actualOrder.length}: ${actualOrder.join(', ')}`);
  } else if (actualOrder.some((p, i) => p !== expectedOrder[i])) {
    failures.push(`card order differs: ${actualOrder.join(', ')}`);
  }

  for (const e of expected) {
    const p = abs(e.rel);
    const card = cards.find(c => c.attrs['data-path'] === p);
    if (!card) {
      failures.push(`missing project card ${e.rel}`);
      continue;
    }
    const a = card.attrs;
    if (a['data-group'] !== e.group) failures.push(`${e.rel}: group ${a['data-group']} != ${e.group}`);
    if (!card.inner.includes(`<span class="group-label">${e.group}</span>`)) failures.push(`${e.rel}: group label not shown on card`);
    if (!card.inner.includes(`<p class="card-path">${escapeHtml(p)}</p>`)) failures.push(`${e.rel}: absolute path not shown`);
    if (Number(a['data-features']) !== e.features) failures.push(`${e.rel}: features ${a['data-features']} != ${e.features}`);
    for (const [col] of COLUMN_LABELS) {
      const got = Number(a[`data-count-${col}`]);
      if (got !== e.counts[col]) failures.push(`${e.rel}: ${col} count ${got} != ${e.counts[col]}`);
      const shown = card.inner.match(new RegExp(`data-col="${col}"><dt>[^<]*</dt><dd>(\\d+)</dd>`));
      if (!shown || Number(shown[1]) !== e.counts[col]) failures.push(`${e.rel}: visible ${col} count differs`);
    }
    if (Number(a['data-waiting']) !== e.waiting) failures.push(`${e.rel}: waiting ${a['data-waiting']} != ${e.waiting}`);
    if (!card.inner.includes(`esperando você: <strong>${e.waiting}</strong>`)) failures.push(`${e.rel}: visible waiting counter differs`);
    const nextItems = [...card.inner.matchAll(/<li data-next="([^"]*)"><span class="tid">[^<]*<\/span> ([^<]*) <span/g)].map(m => [m[1], m[2]]);
    if (JSON.stringify(nextItems) !== JSON.stringify(e.next)) failures.push(`${e.rel}: next tickets ${JSON.stringify(nextItems)} != ${JSON.stringify(e.next)}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a['data-last-change'] || '') && e.rel !== 'beta/empty-proj') failures.push(`${e.rel}: last change is not YYYY-MM-DD`);
    const hubHref = pathToFileURL(path.join(p, '.scratch', 'index.html')).href;
    if (e.hub) {
      if (a['data-hub'] !== 'yes' || !card.inner.includes(`href="${escapeHtml(hubHref)}"`)) failures.push(`${e.rel}: missing file:// link to known hub`);
    } else {
      if (a['data-hub'] !== 'no' || !card.inner.includes('data-hub-missing')) failures.push(`${e.rel}: missing hub-absent notice`);
      if (/href="file:/.test(card.inner)) failures.push(`${e.rel}: has a hub link but no hub exists`);
    }
  }
  if (/dias? atrás|há \d+ dia/i.test(doc)) failures.push('relative date found; last change must be absolute');
  return failures;
}

if (opts.fixture) {
  const failures = runSmoke(fs.readFileSync(outputFile, 'utf8'));
  if (failures.length) {
    console.error('[Portfolio Hub] Smoke --fixture FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('[Portfolio Hub] Fixture OK (smoke passed):');
  console.log(`  file://${outputFile}`);
  console.log(`  Projects: ${totalProjects} in ${groups.length} groups`);
  process.exit(0);
}

console.log('[Portfolio Hub] Portfolio gerado em:');
console.log(`  file://${outputFile}`);
for (const g of groups) console.log(`  ${g.name}: ${g.projects.length} projetos`);
