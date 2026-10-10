// Reads a project's local `.scratch` tracker and assigns each ticket a hub column.
// Used by generate-hub.mjs. No side effects on import.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_STATUS = 'ready-for-agent';

const DONE_STATUSES = ['resolved', 'done', 'closed'];
const IN_PROGRESS_STATUSES = ['claimed', 'in-progress'];
const BACKLOG_STATUSES = ['wontfix', 'needs-triage', 'backlog', 'needs-info'];
// A blocker only counts as cleared when its ticket is in one of these statuses.
const BLOCKER_RESOLVED_STATUSES = ['resolved', 'done'];

/** Column for a ticket given its raw status and whether any blocker is still open. */
export function columnFor(rawStatus, hasUnresolvedBlocker = false) {
  if (DONE_STATUSES.includes(rawStatus)) return 'done';
  if (IN_PROGRESS_STATUSES.includes(rawStatus)) return 'in-progress';
  if (BACKLOG_STATUSES.includes(rawStatus)) return 'backlog';
  if (rawStatus === 'blocked' || hasUnresolvedBlocker) return 'blocked';
  return 'ready-for-agent';
}

/**
 * Parse one ticket Markdown file. Returns null if it cannot be read.
 * `relativeTo` sets the base for `relPath` (defaults to the file's directory).
 */
export function parseTicketFile(filePath, featureName, relativeTo = path.dirname(filePath)) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const filename = path.basename(filePath, '.md');

  // ID: leading number of the filename (01 from 01-setup)
  const idMatch = filename.match(/^(\d+)/);
  const id = idMatch ? idMatch[1] : filename;

  let title = filename;
  const titleLine = content.split('\n').find(l => l.startsWith('# '));
  if (titleLine) {
    title = titleLine.replace(/^#\s+(\d+:)?\s*/, '').trim();
  }

  let status = DEFAULT_STATUS;
  const statusMatch = content.match(/(?:\*\*Status:\*\*|Status:)\s*([a-zA-Z0-9_-]+)/i);
  if (statusMatch) {
    status = statusMatch[1].trim().toLowerCase();
  }

  let blockedBy = [];
  const blockedMatch = content.match(/(?:\*\*Blocked by:\*\*|Blocked by:)\s*([^\n]+)/i);
  if (blockedMatch) {
    const rawBlocked = blockedMatch[1].trim();
    if (!rawBlocked.toLowerCase().startsWith('none')) {
      blockedBy = rawBlocked.split(/[,\s]+/).map(s => s.trim().replace(/^#/, '')).filter(Boolean);
    }
  }

  const criteria = [];
  for (const m of content.matchAll(/^-\s*\[([ xX])\]\s*(.+)$/gm)) {
    criteria.push({ done: m[1].toLowerCase() === 'x', text: m[2].trim() });
  }

  let whatToBuild = '';
  const buildMatch = content.match(/(?:\*\*What to build:\*\*|What to build:)\s*([^\n]+)/i);
  if (buildMatch) whatToBuild = buildMatch[1].trim();

  return {
    id,
    slug: filename,
    feature: featureName,
    title,
    rawStatus: status,
    blockedBy,
    criteria,
    whatToBuild,
    relPath: path.relative(relativeTo, filePath),
    content,
  };
}

/** Tickets from `<scratchDir>/<feature>/issues/*.md`, in directory order. Columns not yet computed. */
export function readScratchTickets(scratchDir, relativeTo = scratchDir) {
  const tickets = [];
  if (!fs.existsSync(scratchDir)) return tickets;
  try {
    const entries = fs.readdirSync(scratchDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const issuesDir = path.join(scratchDir, e.name, 'issues');
      if (!fs.existsSync(issuesDir)) continue;
      for (const f of fs.readdirSync(issuesDir)) {
        if (!f.endsWith('.md')) continue;
        const t = parseTicketFile(path.join(issuesDir, f), e.name, relativeTo);
        if (t) tickets.push(t);
      }
    }
  } catch {}
  return tickets;
}

/**
 * Resolve blockers and set `blockersDetail` and `computedColumn` on every ticket (in place).
 * Blocker ids are looked up by bare id first, then `<feature>/<id>`; when ids repeat,
 * the later ticket in the array wins. Returns the same array.
 */
export function assignColumns(tickets) {
  const statusById = new Map();
  for (const t of tickets) {
    statusById.set(t.id, t.rawStatus);
    statusById.set(`${t.feature}/${t.id}`, t.rawStatus);
  }
  for (const t of tickets) {
    const blockersDetail = [];
    let hasUnresolvedBlocker = false;
    for (const bId of t.blockedBy) {
      const bStatus = statusById.get(bId) || statusById.get(`${t.feature}/${bId}`) || 'unknown';
      const resolved = BLOCKER_RESOLVED_STATUSES.includes(bStatus);
      blockersDetail.push({ id: bId, status: bStatus, resolved });
      if (!resolved) hasUnresolvedBlocker = true;
    }
    t.blockersDetail = blockersDetail;
    t.computedColumn = columnFor(t.rawStatus, hasUnresolvedBlocker);
  }
  return tickets;
}
