#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));

const repoRoot = path.resolve(positional[0] || process.cwd());
const useDocsDir = flags.has('--docs');
const shouldOpen = flags.has('--open');

const outputDir = useDocsDir ? path.join(repoRoot, 'docs') : path.join(repoRoot, '.scratch');
const outputFile = path.join(outputDir, 'index.html');

// 1. Gather Project Info
let projectName = path.basename(repoRoot);
try {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name) projectName = pkg.name;
  }
} catch {}

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
            relPath: path.relative(repoRoot, full),
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
const scratchDir = path.join(repoRoot, '.scratch');
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

// 8. Generate Standalone HTML
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
  <title>${escapeHtml(projectName)} — Project Hub</title>
  <style>
    :root {
      --bg: #090a0f;
      --surface: #12131c;
      --surface-hover: #181a27;
      --surface-border: #23263b;
      --text: #e2e8f0;
      --text-muted: #8e95ad;
      --primary: #6366f1;
      --primary-light: #818cf8;
      --success: #10b981;
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
      background: #181926;
      color: var(--text-muted);
    }
    .badge.success { border-color: rgba(16, 185, 129, 0.4); color: #34d399; background: rgba(16, 185, 129, 0.1); }
    .badge.primary { border-color: rgba(99, 102, 241, 0.4); color: #818cf8; background: rgba(99, 102, 241, 0.1); }
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
    .tab-btn.active { color: #fff; background: var(--primary); }

    main { flex: 1; padding: 1.5rem; max-width: 1600px; width: 100%; margin: 0 auto; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

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
    .filter-pill:hover { color: #fff; border-color: var(--primary); }
    .filter-pill.active { background: var(--surface-hover); color: var(--primary-light); border-color: var(--primary); font-weight: 700; }
    .search-input {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 0.45rem 0.85rem;
      color: #fff;
      font-size: 0.875rem;
      min-width: 240px;
    }
    .search-input:focus { outline: none; border-color: var(--primary); }

    /* Kanban Grid */
    .kanban-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      align-items: start;
    }
    .kanban-col {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 400px;
    }
    .col-header {
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
      background: #171926;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .ticket-card:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .card-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .card-feature {
      font-size: 0.7rem;
      background: rgba(99, 102, 241, 0.15);
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
      display: flex;
      align-items: center;
      gap: 0.3rem;
      transition: all 0.15s ease;
    }
    .btn-copy:hover { color: #fff; background: var(--primary); border-color: var(--primary); }

    /* Modal */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .modal-backdrop.active { display: flex; }
    .modal-box {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      width: 100%;
      max-width: 800px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .modal-header {
      padding: 1.25rem;
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-title { font-size: 1.15rem; font-weight: 700; color: #fff; }
    .modal-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
    }
    .modal-body {
      padding: 1.25rem;
      overflow-y: auto;
      font-size: 0.9rem;
      line-height: 1.6;
    }
    .modal-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--surface-border);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
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
    .spec-section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--primary-light); margin-top: 0.5rem; }
    .spec-text { font-size: 0.875rem; color: var(--text-muted); line-height: 1.5; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: var(--primary);
      color: #fff;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.25s ease;
      z-index: 2000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }

    pre {
      background: #0d0e15;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid var(--surface-border);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <div class="project-title">
        <span>📦</span>
        <span>${escapeHtml(projectName)}</span>
      </div>
      <div class="badge primary">Hub v1.0</div>
      ${hasGraph ? '<div class="badge success">🕸️ Graphify Ativo</div>' : '<div class="badge">🕸️ Sem Grafo</div>'}
    </div>
    <div class="header-right" style="display: flex; gap: 0.5rem;">
      <div class="badge">${metrics.totalSpecs} Specs</div>
      <div class="badge">${metrics.totalTickets} Tickets (${metrics.done}/${metrics.totalTickets} concluídos)</div>
    </div>
  </header>

  <nav class="nav-tabs">
    <button class="tab-btn active" data-tab="tab-board">📋 Board Kanban</button>
    <button class="tab-btn" data-tab="tab-specs">📖 Specs (${metrics.totalSpecs})</button>
    <button class="tab-btn" data-tab="tab-graph">🕸️ Knowledge Graph</button>
    <button class="tab-btn" data-tab="tab-rules">📄 Regras (${rulesFile || 'N/A'})</button>
    ${archifyDiagrams.length > 0 ? `<button class="tab-btn" data-tab="tab-arch">🏛️ Arquitetura (${archifyDiagrams.length})</button>` : ''}
  </nav>

  <main>
    <!-- TAB 1: BOARD -->
    <div id="tab-board" class="tab-content active">
      <div class="board-controls">
        <div class="filter-pills" id="feature-filters">
          <button class="filter-pill active" data-feature="all">Todas as features (${tickets.length})</button>
          ${features.map(f => `<button class="filter-pill" data-feature="${escapeHtml(f)}">${escapeHtml(f)} (${tickets.filter(t => t.feature === f).length})</button>`).join('')}
        </div>
        <input type="text" id="board-search" class="search-input" placeholder="🔍 Buscar tickets por título ou #ID...">
      </div>

      <div class="kanban-grid">
        <!-- Backlog -->
        <div class="kanban-col" data-col="backlog">
          <div class="col-header">
            <span>📥 Backlog</span>
            <span class="col-count" id="count-backlog">0</span>
          </div>
          <div class="col-cards" id="cards-backlog"></div>
        </div>

        <!-- Blocked -->
        <div class="kanban-col" data-col="blocked">
          <div class="col-header" style="color: var(--danger);">
            <span>⛔ Bloqueado</span>
            <span class="col-count" id="count-blocked">0</span>
          </div>
          <div class="col-cards" id="cards-blocked"></div>
        </div>

        <!-- Ready for Agent -->
        <div class="kanban-col" data-col="ready-for-agent">
          <div class="col-header" style="color: var(--primary-light);">
            <span>⚡ Ready for Agent</span>
            <span class="col-count" id="count-ready-for-agent">0</span>
          </div>
          <div class="col-cards" id="cards-ready-for-agent"></div>
        </div>

        <!-- In Progress -->
        <div class="kanban-col" data-col="in-progress">
          <div class="col-header" style="color: var(--warning);">
            <span>⏳ Em Andamento</span>
            <span class="col-count" id="count-in-progress">0</span>
          </div>
          <div class="col-cards" id="cards-in-progress"></div>
        </div>

        <!-- Done -->
        <div class="kanban-col" data-col="done">
          <div class="col-header" style="color: var(--success);">
            <span>✅ Concluído</span>
            <span class="col-count" id="count-done">0</span>
          </div>
          <div class="col-cards" id="cards-done"></div>
        </div>
      </div>
    </div>

    <!-- TAB 2: SPECS -->
    <div id="tab-specs" class="tab-content">
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.1rem; color: #fff;">Especificações de Features</h2>
        <span class="badge">${specs.length} encontradas</span>
      </div>
      <div id="specs-list">
        ${specs.length === 0 ? '<p style="color: var(--text-muted);">Nenhuma spec encontrada em <code>.scratch/</code> ou <code>docs/specs/</code>. Crie uma nova com <code>/to-spec</code>.</p>' : ''}
        ${specs.map((s, idx) => `
          <div class="spec-card">
            <div class="spec-header">
              <span class="spec-title">📖 ${escapeHtml(s.title)}</span>
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
              <button class="btn-copy" onclick="openSpecModal(${idx})">Ver Spec Completa ↗</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- TAB 3: GRAPHIFY -->
    <div id="tab-graph" class="tab-content">
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.1rem; color: #fff;">Grafo de Conhecimento (Graphify)</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Estrutura de dependências, comunidades de código e nós centrais do projeto.</p>
        </div>
        ${hasGraph ? `
          <a href="../graphify-out/graph.html" target="_blank" style="text-decoration: none;">
            <button class="btn-copy" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: var(--primary); color: #fff; border-color: var(--primary);">
              Abrir Grafo Interativo Completo em Nova Aba ↗
            </button>
          </a>
        ` : ''}
      </div>

      ${hasGraph ? `
        <div style="background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius); overflow: hidden; margin-bottom: 1.5rem;">
          <iframe src="../graphify-out/graph.html" style="width: 100%; height: 600px; border: none; background: #000;"></iframe>
        </div>
        ${graphReport ? `
          <h3 style="font-size: 1rem; color: #fff; margin-bottom: 0.75rem;">Relatório do Grafo (GRAPH_REPORT.md)</h3>
          <pre style="max-height: 400px; overflow-y: auto;">${escapeHtml(graphReport)}</pre>
        ` : ''}
      ` : `
        <div style="text-align: center; padding: 4rem 1rem; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🕸️</div>
          <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.5rem;">Nenhum grafo gerado ainda</h3>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem auto; font-size: 0.9rem;">
            O Graphify analisa toda a base de código, descobre os god nodes e comunidades lógicas, gerando uma visualização interativa em 2D/3D.
          </p>
          <div class="badge primary" style="font-size: 0.9rem; padding: 0.5rem 1rem;">Execute: /graphify</div>
        </div>
      `}
    </div>

    <!-- TAB 4: RULES -->
    <div id="tab-rules" class="tab-content">
      <div style="margin-bottom: 1rem;">
        <h2 style="font-size: 1.1rem; color: #fff;">Regras do Projeto (${rulesFile || 'Nenhuma'})</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Instruções fornecidas para os agentes em <code>${rulesFile || 'AGENTS.md'}</code>.</p>
      </div>
      ${rulesContent ? `
        <pre style="max-height: 70vh; overflow-y: auto; white-space: pre-wrap;">${escapeHtml(rulesContent)}</pre>
      ` : '<p style="color: var(--text-muted);">Nenhum arquivo <code>AGENTS.md</code>, <code>CLAUDE.md</code> ou <code>CONTEXT.md</code> encontrado na raiz do projeto.</p>'}
    </div>

    <!-- TAB 5: ARCHITECTURE (ARCHIFY) -->
    ${archifyDiagrams.length > 0 ? `
      <div id="tab-arch" class="tab-content">
        <div style="margin-bottom: 1rem;">
          <h2 style="font-size: 1.1rem; color: #fff;">Diagramas de Arquitetura (Archify)</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Diagramas interativos de arquitetura gerados em <code>.archify/</code>.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
          ${archifyDiagrams.map(d => `
            <div class="spec-card">
              <div class="spec-title">🏛️ ${escapeHtml(d.name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(d.relPath)}</div>
              <a href="../${escapeHtml(d.relPath)}" target="_blank" style="text-decoration: none; margin-top: 0.5rem;">
                <button class="btn-copy" style="width: 100%; justify-content: center;">Abrir Diagrama ↗</button>
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  </main>

  <!-- Modal Detalhe do Ticket / Spec -->
  <div class="modal-backdrop" id="modal">
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title" id="modal-title">Detalhe</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
      <div class="modal-footer" id="modal-footer"></div>
    </div>
  </div>

  <div class="toast" id="toast">Copiado para a área de transferência!</div>

  <script id="hub-data" type="application/json">
    ${JSON.stringify(payload).replace(/</g, '\\u003c')}
  </script>

  <script>
    const data = JSON.parse(document.getElementById('hub-data').textContent);
    let activeFeature = 'all';
    let searchQuery = '';

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
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

        const card = document.createElement('div');
        card.className = 'ticket-card';
        card.onclick = (e) => {
          if (e.target.closest('.btn-copy')) return;
          openTicketModal(t);
        };

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
                  \${b.resolved ? '✓' : '⛔'} #\${escapeHtml(b.id)}
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
            <button class="btn-copy" onclick="copyAgentPrompt('\${escapeHtml(t.id)}', '\${escapeJsString(t.title)}', '\${escapeJsString(t.relPath)}')">
              📋 Copiar Prompt
            </button>
          </div>
        \`;

        colCards[col].appendChild(card);
      });

      cols.forEach(c => {
        document.getElementById('count-' + c).textContent = counts[c];
      });
    }

    function copyAgentPrompt(id, title, relPath) {
      const prompt = \`Implemente o ticket \${id} (\${title}): leia os requisitos e critérios em \${relPath}, execute a implementação, valide os testes e marque o status do arquivo como resolved ao concluir.\`;
      navigator.clipboard.writeText(prompt).then(() => {
        showToast('Prompt do agente copiado para a área de transferência!');
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function openTicketModal(t) {
      document.getElementById('modal-title').textContent = \`Ticket #\${t.id}: \${t.title}\`;
      const modalBody = document.getElementById('modal-body');
      modalBody.innerHTML = \`
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;">
          <span class="card-feature">\${escapeHtml(t.feature)}</span>
          <span class="badge \${t.computedColumn === 'done' ? 'success' : (t.computedColumn === 'blocked' ? 'danger' : 'primary')}">
            Status: \${t.rawStatus} (Coluna: \${t.computedColumn})
          </span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Arquivo: <code>\${escapeHtml(t.relPath)}</code></span>
        </div>
        <pre style="white-space: pre-wrap; font-size: 0.85rem;">\${escapeHtml(t.content)}</pre>
      \`;
      document.getElementById('modal-footer').innerHTML = \`
        <button class="btn-copy" onclick="copyAgentPrompt('\${escapeHtml(t.id)}', '\${escapeJsString(t.title)}', '\${escapeJsString(t.relPath)}')">
          📋 Copiar Prompt para Agente
        </button>
        <button class="btn-copy" onclick="closeModal()">Fechar</button>
      \`;
      document.getElementById('modal').classList.add('active');
    }

    function openSpecModal(idx) {
      const s = data.specs[idx];
      document.getElementById('modal-title').textContent = \`Spec: \${s.title}\`;
      document.getElementById('modal-body').innerHTML = \`
        <div style="margin-bottom: 1rem;">
          <span class="card-feature">\${escapeHtml(s.feature)}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">Arquivo: <code>\${escapeHtml(s.relPath)}</code></span>
        </div>
        <pre style="white-space: pre-wrap; font-size: 0.85rem;">\${escapeHtml(s.content)}</pre>
      \`;
      document.getElementById('modal-footer').innerHTML = \`
        <button class="btn-copy" onclick="closeModal()">Fechar</button>
      \`;
      document.getElementById('modal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
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

    function escapeJsString(str) {
      if (!str) return '';
      return String(str).replace(/'/g, "\\\\'");
    }

    // Initial render
    renderBoard();
  </script>
</body>
</html>
`;

// Helper for escaping html in template literals
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 9. Write HTML
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');

console.log(`[Project Hub] Dashboard gerado com sucesso em:`);
console.log(`  file://${outputFile}`);
console.log(`  Specs: ${metrics.totalSpecs} | Tickets: ${metrics.totalTickets} (${metrics.ready} ready, ${metrics.inProgress} in progress, ${metrics.blocked} blocked, ${metrics.done} done)`);

if (shouldOpen) {
  try {
    const cmd = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
    execSync(`${cmd} "${outputFile}"`);
  } catch {}
}
