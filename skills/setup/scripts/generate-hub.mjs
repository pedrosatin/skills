#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));

const useFixture = flags.has('--fixture');
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(skillDir, 'fixtures', 'minimal-scratch');

// --fixture: collect from skill fixtures/, write hub-fixture.html beside them
const repoRoot = useFixture
  ? fixtureDir
  : path.resolve(positional[0] || process.cwd());
const useDocsDir = flags.has('--docs');
const shouldOpen = flags.has('--open');

const outputDir = useFixture
  ? path.join(skillDir, 'fixtures')
  : (useDocsDir ? path.join(repoRoot, 'docs') : path.join(repoRoot, '.scratch'));
const outputFile = useFixture
  ? path.join(outputDir, 'hub-fixture.html')
  : path.join(outputDir, 'index.html');

// 1. Gather Project Info
let projectName = path.basename(repoRoot);
try {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name) projectName = pkg.name;
  }
} catch {}

// 1b. Infer project brand accent (CSS vars, theme-color, Tailwind) → hub tokens
const DEFAULT_ACCENT = '#22c55e';
const DEFAULT_ACCENT_FG = '#09090b';

function normalizeHex(raw) {
  if (!raw) return null;
  let h = String(raw).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (/^[0-9a-fA-F]{8}$/.test(h)) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return `#${h.toLowerCase()}`;
}

function parseRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

function relativeLuminance(hex) {
  const rgb = parseRgb(hex);
  if (!rgb) return 0;
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

function hexChroma(hex) {
  const rgb = parseRgb(hex);
  if (!rgb) return 0;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return (max - min) / 255;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function accentFgFor(hex) {
  const dark = DEFAULT_ACCENT_FG;
  const light = '#fafafa';
  return contrastRatio(hex, dark) >= contrastRatio(hex, light) ? dark : light;
}

function isUsableBrandHex(hex) {
  const n = normalizeHex(hex);
  if (!n) return false;
  const L = relativeLuminance(n);
  const C = hexChroma(n);
  // Near-white chrome
  if (L > 0.92) return false;
  // Near-black/near-gray: reject low luminance only with low chroma; allow dark saturated brands
  if (L < 0.08 && C < 0.12) return false;
  if (C < 0.12) return false;
  return true;
}

function extractHexFromCssValue(value) {
  if (!value) return null;
  const v = String(value).trim();
  const ld = v.match(/light-dark\s*\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/i);
  if (ld) {
    // Hub is dark: prefer the dark leg of light-dark()
    const dark = normalizeHex(ld[2]);
    if (isUsableBrandHex(dark)) return dark;
    const light = normalizeHex(ld[1]);
    if (isUsableBrandHex(light)) return light;
  }
  const hex = v.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
  if (hex) {
    const n = normalizeHex(hex[0]);
    if (isUsableBrandHex(n)) return n;
  }
  const rgb = v.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const toHex = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    const n = normalizeHex(`#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`);
    if (isUsableBrandHex(n)) return n;
  }
  return null;
}

const BRAND_VAR_SCORE = [
  [/^--(?:color-)?primary$/i, 100],
  [/^--brand(?:-color)?$/i, 98],
  [/^--color-brand$/i, 97],
  [/^--(?:color-)?action$/i, 94],
  [/^--accent-regular$/i, 92],
  [/^--(?:color-)?accent$/i, 90],
  [/^--color-theme$/i, 88],
  [/^--accent-light$/i, 86],
  [/^--gold$/i, 84],
  [/^--(?:color-)?link$/i, 70],
  [/^--msapplication-tilecolor$/i, 60],
];

const BRAND_VAR_SKIP = /success|error|danger|warning|hit|miss|near|found|level|gray|grey|muted|text|border|canvas|surface|overlay|background|foreground|bg\b|fg\b|shadow|hit-hc|near-hc/i;

function scoreBrandVar(name) {
  if (BRAND_VAR_SKIP.test(name)) return 0;
  for (const [re, score] of BRAND_VAR_SCORE) {
    if (re.test(name)) return score;
  }
  if (/primary|brand|accent|action|gold|theme/i.test(name)) return 50;
  return 0;
}

function collectThemeFiles(root) {
  const SKIP = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage', 'vendor',
    '.scratch', 'graphify-out', '.next', 'out', 'target', '.turbo',
    '.cache', '.archify', 'fixtures', 'storybook-static',
  ]);
  const files = [];
  const maxFiles = 100;
  const walk = (dir, depth) => {
    if (files.length >= maxFiles || depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (files.length >= maxFiles) return;
      const name = e.name;
      if (name.startsWith('.') && name !== '.scratch') {
        if (e.isDirectory()) continue;
      }
      const full = path.join(dir, name);
      if (e.isDirectory()) {
        if (SKIP.has(name)) continue;
        walk(full, depth + 1);
      } else if (e.isFile()) {
        const lower = name.toLowerCase();
        const ok =
          lower.endsWith('.css') ||
          lower.endsWith('.scss') ||
          lower.endsWith('.sass') ||
          lower === 'index.html' ||
          /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(lower) ||
          lower === 'globals.css' ||
          lower === 'global.css' ||
          lower === 'variables.css' ||
          lower === 'tokens.css' ||
          lower === 'tokens.scss';
        if (ok) files.push(full);
      }
    }
  };
  // Prefer shallow brand surfaces first
  const preferred = [
    'index.html',
    'public/index.html',
    'src/index.css',
    'src/styles/global.css',
    'src/styles/globals.css',
    'src/styles/tokens.css',
    'src/styles/variables.css',
    'styles.css',
    'web/index.html',
    'web/src/styles/variables.css',
    'web/src/styles/tokens.css',
    'app/globals.css',
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
  ];
  for (const rel of preferred) {
    const full = path.join(root, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) files.push(full);
  }
  walk(root, 0);
  return [...new Set(files)];
}

function defaultProjectTheme() {
  return {
    accent: DEFAULT_ACCENT,
    accentFg: DEFAULT_ACCENT_FG,
    source: 'default',
  };
}

function pushThemeCandidate(candidates, hex, score, source) {
  const n = normalizeHex(hex);
  if (!n || !isUsableBrandHex(n)) return;
  candidates.push({ hex: n, score, source });
}

function collectHtmlMetaThemeCandidates(text, rel, push) {
  // meta theme-color / tile / mask-icon (skip pure bg chrome later via isUsableBrandHex)
  const themeColor = text.match(/<meta\s+[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
    || text.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
  if (themeColor) push(themeColor[1], 55, `meta:theme-color@${rel}`);
  const tile = text.match(/<meta\s+[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']/i)
    || text.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']msapplication-TileColor["']/i);
  if (tile) push(tile[1], 58, `meta:tile@${rel}`);
  const mask = text.match(/<link\s+[^>]*rel=["']mask-icon["'][^>]*color=["']([^"']+)["']/i)
    || text.match(/<link\s+[^>]*color=["']([^"']+)["'][^>]*rel=["']mask-icon["']/i);
  if (mask) push(mask[1], 62, `mask-icon@${rel}`);
}

function collectCssVarThemeCandidates(text, rel, push) {
  const varRe = /(--[A-Za-z0-9-_]+)\s*:\s*([^;{}]+)/g;
  let m;
  while ((m = varRe.exec(text)) !== null) {
    const name = m[1];
    const score = scoreBrandVar(name);
    if (score <= 0) continue;
    const hex = extractHexFromCssValue(m[2]);
    if (hex) push(hex, score, `css:${name}@${rel}`);
  }
}

function collectTailwindPrimaryCandidates(text, base, rel, push) {
  if (!/^tailwind\.config\./.test(base)) return;
  const primaryBlock = text.match(/primary\s*:\s*\{([^}]{0,800})\}/);
  if (primaryBlock) {
    const def = primaryBlock[1].match(/DEFAULT\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/i)
      || primaryBlock[1].match(/500\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/i)
      || primaryBlock[1].match(/['"](#[0-9a-fA-F]{3,8})['"]/);
    if (def) push(def[1], 96, `tailwind:primary@${rel}`);
  }
  const primaryFlat = text.match(/primary\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/i);
  if (primaryFlat) push(primaryFlat[1], 96, `tailwind:primary@${rel}`);
}

function collectBrandClassThemeCandidates(text, base, rel, push) {
  if (!(/\.(css|scss|sass)$/i.test(base) || base.endsWith('.html'))) return;
  const classRe = /\.(brand-mark|btn-primary|button-primary|primary|brand)[^{.]*\{([^}]{0,400})\}/gi;
  let cm;
  while ((cm = classRe.exec(text)) !== null) {
    const hex = extractHexFromCssValue(cm[2])
      || (cm[2].match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/) || [])[0];
    if (hex) push(hex, 75, `class:.${cm[1]}@${rel}`);
  }
}

function readThemeFileText(file) {
  try {
    const st = fs.statSync(file);
    if (st.size > 400_000) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function collectThemeCandidatesFromFiles(root, files) {
  const candidates = [];
  const push = (hex, score, source) => pushThemeCandidate(candidates, hex, score, source);

  for (const file of files) {
    const text = readThemeFileText(file);
    if (text === null) continue;
    const base = path.basename(file).toLowerCase();
    const rel = path.relative(root, file).split(path.sep).join('/');

    if (base.endsWith('.html')) {
      collectHtmlMetaThemeCandidates(text, rel, push);
    }
    collectCssVarThemeCandidates(text, rel, push);
    collectTailwindPrimaryCandidates(text, base, rel, push);
    collectBrandClassThemeCandidates(text, base, rel, push);
  }

  return candidates;
}

function selectBestProjectTheme(candidates, fallback) {
  if (!candidates.length) return fallback;
  candidates.sort((a, b) => b.score - a.score || hexChroma(b.hex) - hexChroma(a.hex));
  const best = candidates[0];
  return {
    accent: best.hex,
    accentFg: accentFgFor(best.hex),
    source: best.source,
  };
}

function inferProjectTheme(root) {
  const fallback = defaultProjectTheme();
  if (useFixture) return fallback;
  const candidates = collectThemeCandidatesFromFiles(root, collectThemeFiles(root));
  return selectBestProjectTheme(candidates, fallback);
}

const projectTheme = inferProjectTheme(repoRoot);

// 2. Discover Rules File
let rulesFile = null;
let rulesContent = '';
for (const cand of ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md']) {
  const candPath = path.join(repoRoot, cand);
  if (fs.existsSync(candPath)) {
    rulesFile = cand;
    rulesContent = fs.readFileSync(candPath, 'utf8');
    break;
  }
}

// 3. Discover Graphify
const graphHtmlPath = path.join(repoRoot, 'graphify-out', 'graph.html');
const graphReportPath = path.join(repoRoot, 'graphify-out', 'GRAPH_REPORT.md');
const hasGraph = fs.existsSync(graphHtmlPath);
const graphReport = fs.existsSync(graphReportPath) ? fs.readFileSync(graphReportPath, 'utf8') : '';
const graphHtmlRel = hasGraph
  ? path.relative(outputDir, graphHtmlPath).split(path.sep).join('/')
  : '';

// 4. Discover Archify Diagrams
const archifyDiagrams = [];
const archifyDir = path.join(repoRoot, '.archify');
if (fs.existsSync(archifyDir)) {
  const findHtml = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) findHtml(full);
        else if (e.isFile() && e.name.endsWith('.html') && !e.name.startsWith('.')) {
          archifyDiagrams.push({
            name: e.name,
            relPath: path.relative(outputDir, full).split(path.sep).join('/'),
            mtime: fs.statSync(full).mtime.toISOString(),
          });
        }
      }
    } catch {}
  };
  findHtml(archifyDir);
}

// 5. Discover Specs
const specs = [];
// Fixture tree is already the scratch layout (feature/issues), not repo/.scratch
const scratchDir = useFixture ? repoRoot : path.join(repoRoot, '.scratch');
const docsSpecsDir = path.join(repoRoot, 'docs', 'specs');

function parseSpecFile(filePath, featureName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let title = featureName;
    for (const l of lines) {
      if (l.startsWith('# ')) {
        title = l.replace(/^#\s+/, '').trim();
        break;
      }
    }

    // Problem Statement extract
    let problem = '';
    const probIdx = content.indexOf('## Problem Statement');
    if (probIdx !== -1) {
      const nextSec = content.indexOf('## ', probIdx + 20);
      problem = content.slice(probIdx + 20, nextSec !== -1 ? nextSec : probIdx + 500).trim();
    }

    // Solution extract
    let solution = '';
    const solIdx = content.indexOf('## Solution');
    if (solIdx !== -1) {
      const nextSec = content.indexOf('## ', solIdx + 11);
      solution = content.slice(solIdx + 11, nextSec !== -1 ? nextSec : solIdx + 500).trim();
    }

    // User stories count
    const storiesCount = (content.match(/^\d+\.\s+As an?\s+/gim) || []).length;

    specs.push({
      feature: featureName,
      title,
      relPath: path.relative(repoRoot, filePath),
      problem,
      solution,
      storiesCount,
      content,
    });
  } catch {}
}

if (fs.existsSync(scratchDir)) {
  try {
    const entries = fs.readdirSync(scratchDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const specPath = path.join(scratchDir, e.name, 'spec.md');
        if (fs.existsSync(specPath)) {
          parseSpecFile(specPath, e.name);
        }
      }
    }
    const rootSpec = path.join(scratchDir, 'spec.md');
    if (fs.existsSync(rootSpec)) parseSpecFile(rootSpec, 'main');
  } catch {}
}

if (fs.existsSync(docsSpecsDir)) {
  try {
    const entries = fs.readdirSync(docsSpecsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) {
        parseSpecFile(path.join(docsSpecsDir, e.name), e.name.replace(/\.md$/, ''));
      }
    }
  } catch {}
}

// 6. Discover Tickets
const tickets = [];

function parseTicketFile(filePath, featureName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath, '.md');
    
    // Extract ID (e.g. 01 from 01-setup)
    const idMatch = filename.match(/^(\d+)/);
    const id = idMatch ? idMatch[1] : filename;

    // Extract Title
    let title = filename;
    const titleLine = content.split('\n').find(l => l.startsWith('# '));
    if (titleLine) {
      title = titleLine.replace(/^#\s+(\d+:)?\s*/, '').trim();
    }

    // Extract Status
    let status = 'ready-for-agent';
    const statusMatch = content.match(/(?:\*\*Status:\*\*|Status:)\s*([a-zA-Z0-9_-]+)/i);
    if (statusMatch) {
      status = statusMatch[1].trim().toLowerCase();
    }

    // Extract Blocked By
    let blockedBy = [];
    const blockedMatch = content.match(/(?:\*\*Blocked by:\*\*|Blocked by:)\s*([^\n]+)/i);
    if (blockedMatch) {
      const rawBlocked = blockedMatch[1].trim();
      if (!rawBlocked.toLowerCase().startsWith('none')) {
        blockedBy = rawBlocked.split(/[,\s]+/).map(s => s.trim().replace(/^#/, '')).filter(Boolean);
      }
    }

    // Extract Acceptance Criteria
    const criteria = [];
    const critMatches = content.matchAll(/^-\s*\[([ xX])\]\s*(.+)$/gm);
    for (const m of critMatches) {
      criteria.push({
        done: m[1].toLowerCase() === 'x',
        text: m[2].trim(),
      });
    }

    // Extract What to build
    let whatToBuild = '';
    const buildMatch = content.match(/(?:\*\*What to build:\*\*|What to build:)\s*([^\n]+)/i);
    if (buildMatch) whatToBuild = buildMatch[1].trim();

    tickets.push({
      id,
      slug: filename,
      feature: featureName,
      title,
      rawStatus: status,
      blockedBy,
      criteria,
      whatToBuild,
      relPath: path.relative(repoRoot, filePath),
      content,
    });
  } catch {}
}

if (fs.existsSync(scratchDir)) {
  try {
    const entries = fs.readdirSync(scratchDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const issuesDir = path.join(scratchDir, e.name, 'issues');
        if (fs.existsSync(issuesDir)) {
          const files = fs.readdirSync(issuesDir);
          for (const f of files) {
            if (f.endsWith('.md')) {
              parseTicketFile(path.join(issuesDir, f), e.name);
            }
          }
        }
      }
    }
  } catch {}
}

const docsTicketsDir = path.join(repoRoot, 'docs', 'tickets');
if (fs.existsSync(docsTicketsDir)) {
  try {
    const files = fs.readdirSync(docsTicketsDir);
    for (const f of files) {
      if (f.endsWith('.md')) {
        parseTicketFile(path.join(docsTicketsDir, f), 'docs');
      }
    }
  } catch {}
}

// 7. Dynamic Blocked Evaluation
// Build ticket index by ID and by feature+ID
const ticketStatusMap = new Map();
for (const t of tickets) {
  ticketStatusMap.set(t.id, t.rawStatus);
  ticketStatusMap.set(`${t.feature}/${t.id}`, t.rawStatus);
}

for (const t of tickets) {
  // Check if blockers are resolved
  const blockersDetail = [];
  let hasUnresolvedBlocker = false;

  for (const bId of t.blockedBy) {
    const bStatus = ticketStatusMap.get(bId) || ticketStatusMap.get(`${t.feature}/${bId}`) || 'unknown';
    const isResolved = bStatus === 'resolved' || bStatus === 'done';
    blockersDetail.push({ id: bId, status: bStatus, resolved: isResolved });
    if (!isResolved) hasUnresolvedBlocker = true;
  }

  t.blockersDetail = blockersDetail;

  // Compute column:
  // Columns: 'backlog', 'blocked', 'ready-for-agent', 'in-progress', 'done'
  if (['resolved', 'done', 'closed'].includes(t.rawStatus)) {
    t.computedColumn = 'done';
  } else if (['claimed', 'in-progress'].includes(t.rawStatus)) {
    t.computedColumn = 'in-progress';
  } else if (['wontfix', 'needs-triage', 'backlog', 'needs-info'].includes(t.rawStatus)) {
    t.computedColumn = 'backlog';
  } else if (t.rawStatus === 'blocked' || hasUnresolvedBlocker) {
    t.computedColumn = 'blocked';
  } else {
    t.computedColumn = 'ready-for-agent';
  }
}

// Sort tickets by ID
tickets.sort((a, b) => {
  const numA = parseInt(a.id, 10);
  const numB = parseInt(b.id, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  return a.id.localeCompare(b.id);
});

// Features list
const features = Array.from(new Set(tickets.map(t => t.feature).concat(specs.map(s => s.feature)))).filter(Boolean);

// Metrics
const metrics = {
  totalTickets: tickets.length,
  ready: tickets.filter(t => t.computedColumn === 'ready-for-agent').length,
  inProgress: tickets.filter(t => t.computedColumn === 'in-progress').length,
  blocked: tickets.filter(t => t.computedColumn === 'blocked').length,
  done: tickets.filter(t => t.computedColumn === 'done').length,
  backlog: tickets.filter(t => t.computedColumn === 'backlog').length,
  totalSpecs: specs.length,
  hasGraph,
  hasRules: !!rulesFile,
  updatedAt: new Date().toISOString(),
};

// 8. Markdown mini-parser (allowlist only; raw HTML escaped)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSafeHref(href) {
  const h = String(href || '').trim();
  if (!h) return false;
  if (h.startsWith('#')) return true;
  // Protocol-relative (//evil.com) and non-HTTP schemes
  if (h.startsWith('//')) return false;
  // Relative path without a scheme (no ":")
  if (!h.includes(':')) return true;
  try {
    const u = new URL(h);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderInline(text) {
  const stashed = [];
  const stash = (html) => {
    const key = `\uE000${stashed.length}\uE001`;
    stashed.push(html);
    return key;
  };

  let s = String(text);

  s = s.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));

  s = s.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (full, label, href) => {
    const h = href.trim();
    if (!isSafeHref(h)) return full;
    return stash(`<a href="${escapeHtml(h)}">${renderInlineBasic(label)}</a>`);
  });

  s = escapeHtml(s);
  s = applyEmphasis(s);
  s = s.replace(/\uE000(\d+)\uE001/g, (_, i) => stashed[Number(i)]);
  return s;
}

function renderInlineBasic(text) {
  let s = String(text);
  const stashed = [];
  const stash = (html) => {
    const key = `\uE000${stashed.length}\uE001`;
    stashed.push(html);
    return key;
  };
  s = s.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  s = escapeHtml(s);
  s = applyEmphasis(s);
  s = s.replace(/\uE000(\d+)\uE001/g, (_, i) => stashed[Number(i)]);
  return s;
}

function applyEmphasis(s) {
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^A-Za-z0-9_])_([^_]+)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>');
  return s;
}

function isMdBlockStart(line) {
  if (/^\s*$/.test(line)) return true;
  if (/^```/.test(line)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (/^\s*[-*]\s+/.test(line)) return true;
  if (/^\s*\d+\.\s+/.test(line)) return true;
  return false;
}

function consumeFencedCodeBlock(lines, start) {
  const buf = [];
  let i = start + 1;
  while (i < lines.length && !/^```\s*$/.test(lines[i])) {
    buf.push(lines[i]);
    i++;
  }
  if (i < lines.length) i++;
  return {
    html: `<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`,
    next: i,
  };
}

function consumeBlockquote(lines, start) {
  const buf = [];
  let i = start;
  while (i < lines.length && /^>\s?/.test(lines[i])) {
    buf.push(lines[i].replace(/^>\s?/, ''));
    i++;
  }
  return {
    html: `<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`,
    next: i,
  };
}

function renderMarkdownListItem(raw) {
  const task = raw.match(/^\[([ xX])\]\s+(.*)$/);
  if (task) {
    const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
    return `<li><input type="checkbox" disabled${checked}> ${renderInline(task[2])}</li>`;
  }
  return `<li>${renderInline(raw)}</li>`;
}

function consumeMarkdownList(lines, start, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const items = [];
  let i = start;
  while (i < lines.length) {
    const u = lines[i].match(/^(\s*)([-*])\s+(.*)$/);
    const o = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (ordered) {
      if (!o) break;
      items.push(o[3]);
    } else {
      if (!u) break;
      items.push(u[3]);
    }
    i++;
  }
  return {
    html: `<${tag}>${items.map(renderMarkdownListItem).join('')}</${tag}>`,
    next: i,
  };
}

function consumeParagraph(lines, start) {
  const buf = [lines[start]];
  let i = start + 1;
  while (i < lines.length && !isMdBlockStart(lines[i])) {
    buf.push(lines[i]);
    i++;
  }
  return {
    html: `<p>${renderInline(buf.join(' '))}</p>`,
    next: i,
  };
}

function renderMarkdown(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```(\w*)\s*$/.test(line)) {
      const block = consumeFencedCodeBlock(lines, i);
      out.push(block.html);
      i = block.next;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const block = consumeBlockquote(lines, i);
      out.push(block.html);
      i = block.next;
      continue;
    }

    const ulStart = line.match(/^(\s*)([-*])\s+(.*)$/);
    const olStart = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (ulStart || olStart) {
      const block = consumeMarkdownList(lines, i, !!olStart);
      out.push(block.html);
      i = block.next;
      continue;
    }

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    const block = consumeParagraph(lines, i);
    out.push(block.html);
    i = block.next;
  }

  return out.join('\n');
}

for (const t of tickets) {
  t.contentHtml = renderMarkdown(t.content);
}
for (const s of specs) {
  s.contentHtml = renderMarkdown(s.content);
}
const rulesHtml = rulesContent ? renderMarkdown(rulesContent) : '';
const graphReportHtml = graphReport ? renderMarkdown(graphReport) : '';

// 9. Generate Standalone HTML
const payload = {
  projectName,
  repoRoot,
  metrics,
  features,
  tickets,
  specs,
  rulesFile,
  rulesContent,
  hasGraph,
  graphReport,
  archifyDiagrams,
};

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)} · Project Hub</title>
  <meta name="project-hub-theme-source" content="${escapeHtml(projectTheme.source)}">
  <style>
    :root {
      --bg: #09090b;
      --surface: #18181b;
      --surface-hover: #27272a;
      --surface-border: #3f3f46;
      --text: #e4e4e7;
      --text-muted: #a1a1aa;
      --primary: #71717a;
      --primary-light: #a1a1aa;
      --accent: ${projectTheme.accent};
      --accent-fg: ${projectTheme.accentFg};
      --success: ${projectTheme.accent};
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #06b6d4;
      --radius: 10px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--surface-border);
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .project-title { font-size: 1.25rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--surface-border);
      background: #27272a;
      color: var(--text-muted);
    }
    .badge.success {
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      color: color-mix(in srgb, var(--accent) 72%, white);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .badge.primary { border-color: rgba(113, 113, 122, 0.4); color: #a1a1aa; background: rgba(113, 113, 122, 0.1); }
    .badge.warning { border-color: rgba(245, 158, 11, 0.4); color: #fbbf24; background: rgba(245, 158, 11, 0.1); }
    .badge.danger { border-color: rgba(239, 68, 68, 0.4); color: #f87171; background: rgba(239, 68, 68, 0.1); }
    
    .nav-tabs {
      display: flex;
      gap: 0.5rem;
      background: var(--surface);
      padding: 0.5rem 1.5rem;
      border-bottom: 1px solid var(--surface-border);
      overflow-x: auto;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
    }
    .tab-btn:hover { color: #fff; background: var(--surface-hover); }
    .tab-btn.active { color: #fff; background: var(--surface-hover); box-shadow: inset 0 -2px 0 var(--accent); }

    main { flex: 1; padding: 1.5rem; max-width: 1600px; width: 100%; margin: 0 auto; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .tab-content[hidden] { display: none !important; }

    /* Board Controls */
    .board-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .filter-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .filter-pill {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: var(--text-muted);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    .filter-pill:hover { color: #fff; border-color: var(--primary-light); }
    .filter-pill.active { background: var(--surface-hover); color: #fff; border-color: var(--accent); font-weight: 700; }
    .search-input {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 0.45rem 0.85rem;
      color: #fff;
      font-size: 0.875rem;
      min-width: 240px;
    }
    .search-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
    .tab-btn:focus-visible,
    .filter-pill:focus-visible,
    .btn-copy:focus-visible,
    .side-panel-close:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* Kanban Grid */
    .kanban-grid {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(260px, 1fr);
      gap: 1rem;
      align-items: stretch;
      justify-content: start;
      overflow-x: auto;
      /* Fixed height so each column scrolls internally instead of growing the page. */
      height: max(26rem, calc(100dvh - 14rem));
    }
    .kanban-col {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
      max-width: 300px;
      min-height: 0;
    }
    .col-cards {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      /* Padding leaves room for the card focus ring, which overflow would clip. */
      margin: -4px -0.5rem -4px -4px;
      padding: 4px 0.5rem 4px 4px;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: var(--surface-border) transparent;
    }
    .col-header {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
      color: var(--text-muted);
    }
    .col-count {
      background: rgba(255, 255, 255, 0.1);
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      font-size: 0.75rem;
    }

    /* Ticket Card */
    .ticket-card {
      background: #1c1c1f;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
      position: relative;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .ticket-card:hover {
      border-color: var(--primary-light);
      background: var(--surface-hover);
    }
    .ticket-card:focus { outline: none; }
    .ticket-card:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-color: var(--accent);
    }
    .card-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .card-feature {
      font-size: 0.7rem;
      background: rgba(113, 113, 122, 0.2);
      color: var(--primary-light);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .card-id { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
    .card-title { font-size: 0.92rem; font-weight: 600; color: #fff; line-height: 1.35; }
    .card-blockers { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .blocker-chip {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .blocker-chip.pending { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .blocker-chip.resolved { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    
    .criteria-progress {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.72rem;
      color: var(--text-muted);
    }
    .progress-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-fill { height: 100%; background: var(--success); transition: width 0.3s; }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.2rem;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .btn-copy {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--surface-border);
      color: var(--text-muted);
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      text-decoration: none;
      box-sizing: border-box;
      transition: all 0.15s ease;
    }
    .btn-copy:hover { color: #fff; background: var(--accent); border-color: var(--accent); }

    /* Side panel (drawer) */
    .side-panel-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      z-index: 1000;
    }
    .side-panel-overlay.active { display: block; }
    .side-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: min(480px, 100vw);
      max-width: 520px;
      min-width: min(440px, 100vw);
      height: 100vh;
      height: 100dvh;
      background: var(--surface);
      border-left: 1px solid var(--surface-border);
      z-index: 1001;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      visibility: hidden;
      transition: transform 0.2s ease, visibility 0.2s;
      box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);
    }
    .side-panel.active {
      transform: translateX(0);
      visibility: visible;
    }
    .side-panel-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .side-panel-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.35;
      margin: 0;
    }
    .side-panel-close {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0.25rem 0.45rem;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .side-panel-close:hover { color: #fff; background: var(--surface-hover); }
    .side-panel-body {
      padding: 1.25rem;
      overflow-y: auto;
      flex: 1;
      font-size: 0.9rem;
      line-height: 1.6;
    }
    .side-panel-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--surface-border);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    @media (max-width: 768px) {
      .kanban-grid {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        grid-template-columns: 1fr;
        height: auto;
        overflow-x: visible;
      }
      .kanban-col { max-width: none; }
      .col-cards { overflow-y: visible; overscroll-behavior: auto; }
      .side-panel {
        width: 100vw;
        max-width: 100vw;
        min-width: 0;
        border-left: none;
      }
    }

    /* Specs & Other Tabs */
    .spec-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .spec-header { display: flex; justify-content: space-between; align-items: baseline; }
    .spec-title { font-size: 1.1rem; font-weight: 700; color: #fff; }
    .spec-section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-top: 0.5rem; }
    .spec-text { font-size: 0.875rem; color: var(--text-muted); line-height: 1.5; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: var(--accent);
      color: var(--accent-fg);
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transform: translateY(100px);
      opacity: 0;
      transition: transform 0.25s ease, opacity 0.25s ease;
      z-index: 2000;
      pointer-events: none;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.error {
      background: var(--danger);
      color: #fff;
    }

    pre {
      background: #0d0e15;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid var(--surface-border);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
    }

    .md-body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 0.925rem;
      line-height: 1.65;
      color: var(--text);
      max-width: 72ch;
    }
    .md-body h1, .md-body h2, .md-body h3,
    .md-body h4, .md-body h5, .md-body h6 {
      color: #fff;
      line-height: 1.3;
      margin: 1.25em 0 0.5em;
      font-weight: 650;
    }
    .md-body h1 { font-size: 1.5rem; }
    .md-body h2 { font-size: 1.25rem; }
    .md-body h3 { font-size: 1.1rem; }
    .md-body h4, .md-body h5, .md-body h6 { font-size: 1rem; }
    .md-body p { margin: 0.75em 0; }
    .md-body ul, .md-body ol {
      margin: 0.75em 0;
      padding-left: 1.5em;
    }
    .md-body li { margin: 0.35em 0; }
    .md-body li > input[type="checkbox"] {
      margin-right: 0.5em;
      vertical-align: middle;
    }
    .md-body blockquote {
      margin: 0.75em 0;
      padding: 0.15em 0 0.15em 1em;
      border-left: 3px solid var(--surface-border);
      color: var(--text-muted);
    }
    .md-body hr {
      border: none;
      border-top: 1px solid var(--surface-border);
      margin: 1.5em 0;
    }
    .md-body a { color: var(--accent); text-decoration: underline; }
    .md-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      background: #0d0e15;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
    }
    .md-body pre {
      max-width: 100%;
      line-height: 1.45;
      white-space: pre;
    }
    .md-body pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: inherit;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <div class="project-title">
        <span>${escapeHtml(projectName)}</span>
      </div>
      ${hasGraph ? '<div class="badge success">Graphify ativo</div>' : '<div class="badge">Sem grafo</div>'}
    </div>
    <div class="header-right" style="display: flex; gap: 0.5rem;">
      <div class="badge">${metrics.totalSpecs} Specs</div>
      <div class="badge">${metrics.totalTickets} Tickets (${metrics.done}/${metrics.totalTickets} concluídos)</div>
    </div>
  </header>

  <nav class="nav-tabs" role="tablist" aria-label="Seções do hub">
    <button type="button" class="tab-btn active" role="tab" id="tab-btn-board" data-tab="tab-board" aria-controls="tab-board" aria-selected="true">Board</button>
    <button type="button" class="tab-btn" role="tab" id="tab-btn-specs" data-tab="tab-specs" aria-controls="tab-specs" aria-selected="false">Specs (${metrics.totalSpecs})</button>
    <button type="button" class="tab-btn" role="tab" id="tab-btn-graph" data-tab="tab-graph" aria-controls="tab-graph" aria-selected="false">Knowledge Graph</button>
    <button type="button" class="tab-btn" role="tab" id="tab-btn-rules" data-tab="tab-rules" aria-controls="tab-rules" aria-selected="false">Regras (${rulesFile || 'N/A'})</button>
    ${archifyDiagrams.length > 0 ? `<button type="button" class="tab-btn" role="tab" id="tab-btn-arch" data-tab="tab-arch" aria-controls="tab-arch" aria-selected="false">Arquitetura (${archifyDiagrams.length})</button>` : ''}
  </nav>

  <main>
    <!-- TAB 1: BOARD -->
    <div id="tab-board" class="tab-content active" role="tabpanel" aria-labelledby="tab-btn-board">
      <div class="board-controls">
        <div class="filter-pills" id="feature-filters">
          <button class="filter-pill active" data-feature="all">Todas as features (${tickets.length})</button>
          ${features.map(f => `<button class="filter-pill" data-feature="${escapeHtml(f)}">${escapeHtml(f)} (${tickets.filter(t => t.feature === f).length})</button>`).join('')}
        </div>
        <input type="search" id="board-search" class="search-input" placeholder="Buscar tickets por título ou #ID..." aria-label="Buscar tickets por título ou ID">
      </div>

      <div class="kanban-grid">
        <!-- Backlog -->
        <div class="kanban-col" data-col="backlog">
          <div class="col-header">
            <span>Backlog</span>
            <span class="col-count" id="count-backlog">0</span>
          </div>
          <div class="col-cards" id="cards-backlog"></div>
        </div>

        <!-- Blocked -->
        <div class="kanban-col" data-col="blocked">
          <div class="col-header" style="color: var(--danger);">
            <span>Bloqueado</span>
            <span class="col-count" id="count-blocked">0</span>
          </div>
          <div class="col-cards" id="cards-blocked"></div>
        </div>

        <!-- Ready for Agent -->
        <div class="kanban-col" data-col="ready-for-agent">
          <div class="col-header" style="color: var(--accent);">
            <span>Ready for Agent</span>
            <span class="col-count" id="count-ready-for-agent">0</span>
          </div>
          <div class="col-cards" id="cards-ready-for-agent"></div>
        </div>

        <!-- In Progress -->
        <div class="kanban-col" data-col="in-progress">
          <div class="col-header" style="color: var(--warning);">
            <span>Em andamento</span>
            <span class="col-count" id="count-in-progress">0</span>
          </div>
          <div class="col-cards" id="cards-in-progress"></div>
        </div>

        <!-- Done -->
        <div class="kanban-col" data-col="done">
          <div class="col-header" style="color: var(--success);">
            <span>Concluído</span>
            <span class="col-count" id="count-done">0</span>
          </div>
          <div class="col-cards" id="cards-done"></div>
        </div>
      </div>
    </div>

    <!-- TAB 2: SPECS -->
    <div id="tab-specs" class="tab-content" role="tabpanel" aria-labelledby="tab-btn-specs" hidden>
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.1rem; color: #fff;">Especificações de Features</h2>
        <span class="badge">${specs.length} encontradas</span>
      </div>
      <div id="specs-list">
        ${specs.length === 0 ? '<p style="color: var(--text-muted);">Nenhuma spec encontrada em <code>.scratch/</code> ou <code>docs/specs/</code>. Crie uma nova com <code>/to-spec</code>.</p>' : ''}
        ${specs.map((s, idx) => `
          <div class="spec-card">
            <div class="spec-header">
              <span class="spec-title">${escapeHtml(s.title)}</span>
              <span class="card-feature">${escapeHtml(s.feature)}</span>
            </div>
            ${s.problem ? `
              <div class="spec-section-title">Problem Statement</div>
              <p class="spec-text">${escapeHtml(s.problem.slice(0, 300))}${s.problem.length > 300 ? '...' : ''}</p>
            ` : ''}
            ${s.solution ? `
              <div class="spec-section-title">Solution</div>
              <p class="spec-text">${escapeHtml(s.solution.slice(0, 300))}${s.solution.length > 300 ? '...' : ''}</p>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--surface-border);">
              <span style="font-size: 0.75rem; color: var(--text-muted);">${s.storiesCount} User Stories declaradas</span>
              <button type="button" class="btn-copy" data-action="open-spec" data-spec-idx="${idx}">Ver Spec Completa</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- TAB 3: GRAPHIFY -->
    <div id="tab-graph" class="tab-content" role="tabpanel" aria-labelledby="tab-btn-graph" hidden>
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.1rem; color: #fff;">Grafo de Conhecimento (Graphify)</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Estrutura de dependências, comunidades de código e nós centrais do projeto.</p>
        </div>
        ${hasGraph ? `
          <a class="btn-copy" href="${escapeHtml(graphHtmlRel)}" target="_blank" rel="noopener" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">
            Abrir grafo em nova aba
          </a>
        ` : ''}
      </div>

      ${hasGraph ? `
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          O preview embutido foi omitido de propósito: <code>graph.html</code> pesa megabytes e um iframe com <code>src</code> carrega mesmo com a aba oculta, travando o hub. Use o link acima.
        </p>
        ${graphReportHtml ? `
          <h3 style="font-size: 1rem; color: #fff; margin-bottom: 0.75rem;">Relatório do Grafo (GRAPH_REPORT.md)</h3>
          <div class="md-body" style="max-height: 400px; overflow-y: auto; max-width: none;">${graphReportHtml}</div>
        ` : ''}
      ` : `
        <div style="text-align: center; padding: 4rem 1rem; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius);">
          <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.5rem;">Nenhum grafo gerado ainda</h3>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem auto; font-size: 0.9rem;">
            O Graphify analisa toda a base de código, descobre os god nodes e comunidades lógicas, gerando uma visualização interativa em 2D/3D.
          </p>
          <div class="badge primary" style="font-size: 0.9rem; padding: 0.5rem 1rem;">Execute: /graphify</div>
        </div>
      `}
    </div>

    <!-- TAB 4: RULES -->
    <div id="tab-rules" class="tab-content" role="tabpanel" aria-labelledby="tab-btn-rules" hidden>
      <div style="margin-bottom: 1rem;">
        <h2 style="font-size: 1.1rem; color: #fff;">Regras do Projeto (${rulesFile || 'Nenhuma'})</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Instruções fornecidas para os agentes em <code>${rulesFile || 'AGENTS.md'}</code>.</p>
      </div>
      ${rulesHtml ? `
        <div class="md-body" style="max-height: 70vh; overflow-y: auto; max-width: none;">${rulesHtml}</div>
      ` : '<p style="color: var(--text-muted);">Nenhum arquivo <code>AGENTS.md</code>, <code>CLAUDE.md</code> ou <code>CONTEXT.md</code> encontrado na raiz do projeto.</p>'}
    </div>

    <!-- TAB 5: ARCHITECTURE (ARCHIFY) -->
    ${archifyDiagrams.length > 0 ? `
      <div id="tab-arch" class="tab-content" role="tabpanel" aria-labelledby="tab-btn-arch" hidden>
        <div style="margin-bottom: 1rem;">
          <h2 style="font-size: 1.1rem; color: #fff;">Diagramas de Arquitetura (Archify)</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Diagramas interativos de arquitetura gerados em <code>.archify/</code>.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
          ${archifyDiagrams.map(d => `
            <div class="spec-card">
              <div class="spec-title">${escapeHtml(d.name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(d.relPath)}</div>
              <a class="btn-copy" href="${escapeHtml(d.relPath)}" target="_blank" rel="noopener" style="width: 100%; justify-content: center; margin-top: 0.5rem;">
                Abrir diagrama
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  </main>

  <!-- Side panel: ticket / spec detail -->
  <div class="side-panel-overlay" id="panel-overlay" hidden></div>
  <aside
    class="side-panel"
    id="side-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="panel-title"
    hidden
  >
    <div class="side-panel-header">
      <h2 class="side-panel-title" id="panel-title">Detalhe</h2>
      <button type="button" class="side-panel-close" id="panel-close" aria-label="Fechar">&times;</button>
    </div>
    <div class="side-panel-body" id="panel-body"></div>
    <div class="side-panel-footer" id="panel-footer"></div>
  </aside>

  <div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>

  <script id="hub-data" type="application/json">
    ${JSON.stringify(payload).replace(/</g, '\\u003c')}
  </script>

  <script>
    let data;
    try {
      data = JSON.parse(document.getElementById('hub-data').textContent);
    } catch (err) {
      const main = document.querySelector('main');
      if (main) {
        main.innerHTML = '<p>Erro ao carregar os dados do hub.</p>';
      }
      data = null;
    }

    if (data) {
    let activeFeature = 'all';
    let searchQuery = '';
    let panelOpener = null;

    const panelEl = document.getElementById('side-panel');
    const panelOverlay = document.getElementById('panel-overlay');
    const panelCloseBtn = document.getElementById('panel-close');
    const panelFooter = document.getElementById('panel-footer');
    const boardEl = document.getElementById('tab-board');

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-content').forEach(c => {
          c.classList.remove('active');
          c.hidden = true;
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(btn.dataset.tab);
        if (panel) {
          panel.classList.add('active');
          panel.hidden = false;
        }
      });
    });

    // Feature Filters
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFeature = pill.dataset.feature;
        renderBoard();
      });
    });

    // Search
    document.getElementById('board-search').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderBoard();
    });

    function renderBoard() {
      const cols = ['backlog', 'blocked', 'ready-for-agent', 'in-progress', 'done'];
      const colCards = {
        'backlog': document.getElementById('cards-backlog'),
        'blocked': document.getElementById('cards-blocked'),
        'ready-for-agent': document.getElementById('cards-ready-for-agent'),
        'in-progress': document.getElementById('cards-in-progress'),
        'done': document.getElementById('cards-done'),
      };

      cols.forEach(c => {
        colCards[c].innerHTML = '';
      });

      const counts = { 'backlog': 0, 'blocked': 0, 'ready-for-agent': 0, 'in-progress': 0, 'done': 0 };

      data.tickets.forEach(t => {
        if (activeFeature !== 'all' && t.feature !== activeFeature) return;
        if (searchQuery) {
          const matchTitle = t.title.toLowerCase().includes(searchQuery);
          const matchId = t.id.toLowerCase().includes(searchQuery);
          const matchWhat = (t.whatToBuild || '').toLowerCase().includes(searchQuery);
          if (!matchTitle && !matchId && !matchWhat) return;
        }

        const col = t.computedColumn;
        counts[col]++;

        // role=button (not <button>) to allow a nested copy-prompt button
        const card = document.createElement('div');
        card.className = 'ticket-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', \`Abrir ticket #\${t.id}: \${t.title}\`);
        const openFromCard = () => openTicketPanel(t, card);
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-copy')) return;
          openFromCard();
        });
        card.addEventListener('keydown', (e) => {
          if (e.target.closest('.btn-copy')) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFromCard();
          }
        });

        const totalCrit = t.criteria.length;
        const doneCrit = t.criteria.filter(c => c.done).length;
        const pct = totalCrit > 0 ? (doneCrit / totalCrit) * 100 : 0;

        card.innerHTML = \`
          <div class="card-top">
            <span class="card-feature">\${escapeHtml(t.feature)}</span>
            <span class="card-id">#\${escapeHtml(t.id)}</span>
          </div>
          <div class="card-title">\${escapeHtml(t.title)}</div>
          
          \${t.blockersDetail.length > 0 ? \`
            <div class="card-blockers">
              \${t.blockersDetail.map(b => \`
                <span class="blocker-chip \${b.resolved ? 'resolved' : 'pending'}">
                  \${b.resolved ? 'ok' : 'bloq'} #\${escapeHtml(b.id)}
                </span>
              \`).join('')}
            </div>
          \` : ''}

          \${totalCrit > 0 ? \`
            <div class="criteria-progress">
              <span>\${doneCrit}/\${totalCrit} critérios</span>
              <div class="progress-bar">
                <div class="progress-fill" style="width: \${pct}%;"></div>
              </div>
            </div>
          \` : ''}

          <div class="card-actions">
            <button type="button" class="btn-copy" data-action="copy-prompt" data-id="\${escapeHtml(t.id)}" data-title="\${escapeHtml(t.title)}" data-path="\${escapeHtml(t.relPath)}">
              Copiar prompt
            </button>
          </div>
        \`;

        colCards[col].appendChild(card);
      });

      cols.forEach(c => {
        document.getElementById('count-' + c).textContent = counts[c];
        const colEl = document.querySelector('.kanban-col[data-col="' + c + '"]');
        if (colEl) colEl.style.display = counts[c] === 0 ? 'none' : '';
      });
    }

    function copyTextFallback(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }

    async function copyText(text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (_) {
          /* fall through to execCommand fallback (common on file://) */
        }
      }
      return copyTextFallback(text);
    }

    async function copyAgentPrompt(id, title, relPath) {
      const prompt = \`Implement ticket \${id} (\${title}): read the requirements and acceptance criteria in \${relPath}, implement the change, validate the tests, and set the file status to resolved when complete. Follow the project's language conventions for generated prose.\`;
      const ok = await copyText(prompt);
      if (ok) {
        showToast('Prompt do agente copiado para a área de transferência!', false);
      } else {
        showToast('Não foi possível copiar o prompt. Selecione e copie manualmente.', true);
      }
    }

    let toastTimer = null;
    function showToast(msg, isError) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.toggle('error', !!isError);
      toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.remove('error');
      }, 2500);
    }

    function openPanel(opener) {
      panelOpener = opener || document.activeElement;
      panelOverlay.hidden = false;
      panelOverlay.classList.add('active');
      panelEl.hidden = false;
      panelEl.classList.add('active');
      panelCloseBtn.focus();
    }

    function closePanel() {
      if (!panelEl.classList.contains('active')) return;
      panelEl.classList.remove('active');
      panelOverlay.classList.remove('active');
      panelEl.hidden = true;
      panelOverlay.hidden = true;
      const opener = panelOpener;
      panelOpener = null;
      if (opener && typeof opener.focus === 'function') {
        try { opener.focus(); } catch (_) {}
      }
    }

    function openTicketPanel(t, opener) {
      document.getElementById('panel-title').textContent = \`Ticket #\${t.id}: \${t.title}\`;
      const panelBody = document.getElementById('panel-body');
      panelBody.innerHTML = \`
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;">
          <span class="card-feature">\${escapeHtml(t.feature)}</span>
          <span class="badge \${t.computedColumn === 'done' ? 'success' : (t.computedColumn === 'blocked' ? 'danger' : 'primary')}">
            Status: \${t.rawStatus} (Coluna: \${t.computedColumn})
          </span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Arquivo: <code>\${escapeHtml(t.relPath)}</code></span>
        </div>
        <div class="md-body"></div>
      \`;
      const mdEl = panelBody.querySelector('.md-body');
      mdEl.innerHTML = t.contentHtml || \`<p>\${escapeHtml(t.content)}</p>\`;
      panelFooter.innerHTML = \`
        <button type="button" class="btn-copy" data-action="copy-prompt" data-id="\${escapeHtml(t.id)}" data-title="\${escapeHtml(t.title)}" data-path="\${escapeHtml(t.relPath)}">
          Copiar prompt
        </button>
        <button type="button" class="btn-copy" data-action="close-panel">Fechar</button>
      \`;
      openPanel(opener);
    }

    function openSpecPanel(idx, opener) {
      const s = data.specs[idx];
      if (!s) return;
      document.getElementById('panel-title').textContent = \`Spec: \${s.title}\`;
      const panelBody = document.getElementById('panel-body');
      panelBody.innerHTML = \`
        <div style="margin-bottom: 1rem;">
          <span class="card-feature">\${escapeHtml(s.feature)}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">Arquivo: <code>\${escapeHtml(s.relPath)}</code></span>
        </div>
        <div class="md-body"></div>
      \`;
      panelBody.querySelector('.md-body').innerHTML = s.contentHtml || \`<p>\${escapeHtml(s.content)}</p>\`;
      panelFooter.innerHTML = \`
        <button type="button" class="btn-copy" data-action="close-panel">Fechar</button>
      \`;
      openPanel(opener || document.activeElement);
    }

    function onActionClick(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'copy-prompt') {
        e.preventDefault();
        e.stopPropagation();
        copyAgentPrompt(btn.dataset.id, btn.dataset.title, btn.dataset.path);
      } else if (action === 'close-panel') {
        e.preventDefault();
        closePanel();
      } else if (action === 'open-spec') {
        e.preventDefault();
        openSpecPanel(Number(btn.dataset.specIdx), btn);
      }
    }

    if (boardEl) boardEl.addEventListener('click', onActionClick);
    if (panelFooter) panelFooter.addEventListener('click', onActionClick);
    document.getElementById('tab-specs')?.addEventListener('click', onActionClick);

    panelCloseBtn.addEventListener('click', closePanel);
    panelOverlay.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelEl.classList.contains('active')) {
        e.preventDefault();
        closePanel();
      }
    });

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Initial render
    renderBoard();
    }
  </script>
</body>
</html>
`;

// 10. Write HTML
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');

if (useFixture) {
  const smokeFailures = [];
  if (!html.includes('md-body') && !html.includes('class="md-body"')) {
    smokeFailures.push('missing .md-body (Markdown body container)');
  }
  if (!html.includes('side-panel')) {
    smokeFailures.push('missing side-panel marker');
  }
  if (!html.includes('role="dialog"')) {
    smokeFailures.push('missing role="dialog" on side panel');
  }
  if (html.includes('<iframe')) {
    smokeFailures.push('unexpected <iframe present');
  }
  if (!/--accent\s*:\s*#22c55e\b/.test(html)) {
    smokeFailures.push('fixture missing default --accent: #22c55e');
  }
  if (!/--accent-fg\s*:/.test(html)) {
    smokeFailures.push('missing --accent-fg');
  }
  if (!html.includes('project-hub-theme-source') || !html.includes('content="default"')) {
    smokeFailures.push('fixture theme source should be default');
  }
  if (/--primary\s*:\s*#6366f1\b/i.test(html)) {
    smokeFailures.push('brand indigo --primary: #6366f1 present');
  }
  if (!html.includes('contentHtml')) {
    smokeFailures.push('missing contentHtml in JSON payload');
  }
  // Infer helpers: brand CSS var wins; near-black theme-color is ignored
  const fromCss = extractHexFromCssValue('light-dark(#B31555, #FF74AC)');
  if (fromCss !== '#ff74ac') {
    smokeFailures.push(`light-dark extract expected #ff74ac, got ${fromCss}`);
  }
  if (isUsableBrandHex('#0d0d0d')) {
    smokeFailures.push('near-black #0d0d0d should not count as brand accent');
  }
  if (!isUsableBrandHex('#4a154b')) {
    smokeFailures.push('dark high-chroma #4a154b should count as brand accent');
  }
  if (!isUsableBrandHex('#49f21b')) {
    smokeFailures.push('#49f21b should count as brand accent');
  }
  if (isSafeHref('//evil.com')) {
    smokeFailures.push('protocol-relative //evil.com should be rejected');
  }
  if (!isSafeHref('./x.md') || !isSafeHref('graphify-out/graph.html')) {
    smokeFailures.push('safe relative hrefs should be allowed');
  }
  if (isSafeHref('javascript:alert(1)') || isSafeHref('data:text/html,x')) {
    smokeFailures.push('javascript:/data: hrefs should be rejected');
  }
  if (smokeFailures.length) {
    console.error('[Project Hub] Smoke --fixture FAILED:');
    for (const f of smokeFailures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`[Project Hub] Fixture OK (smoke passed):`);
  console.log(`  file://${outputFile}`);
  console.log(`  Theme: ${projectTheme.accent} (${projectTheme.source})`);
  console.log(`  Specs: ${metrics.totalSpecs} | Tickets: ${metrics.totalTickets} (${metrics.ready} ready, ${metrics.inProgress} in progress, ${metrics.blocked} blocked, ${metrics.done} done)`);
  process.exit(0);
}

console.log(`[Project Hub] Dashboard gerado com sucesso em:`);
console.log(`  file://${outputFile}`);
console.log(`  Theme: ${projectTheme.accent} (${projectTheme.source})`);
console.log(`  Specs: ${metrics.totalSpecs} | Tickets: ${metrics.totalTickets} (${metrics.ready} ready, ${metrics.inProgress} in progress, ${metrics.blocked} blocked, ${metrics.done} done)`);

if (shouldOpen) {
  try {
    const cmd = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
    execSync(`${cmd} "${outputFile}"`);
  } catch {}
}
