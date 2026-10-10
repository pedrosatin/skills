// Reads a project's local `.scratch` tracker and assigns each ticket a hub column.
// Used by generate-hub.mjs. No side effects on import.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_STATUS = 'ready-for-agent';

const DONE_STATUSES = ['resolved', 'done', 'closed'];
const IN_PROGRESS_STATUSES = ['claimed', 'in-progress'];
const BACKLOG_STATUSES = ['wontfix', 'needs-triage', 'backlog', 'needs-info'];
// `Blocked by` values that mean "no blocker": none, nenhum(a), n/a, empty, or only dashes.
const NO_BLOCKER = /^(?:none|nenhuma?|n\/a)\b|^[-—–\s]*$/i;
// A blocker reference: `01`, `3`, `feat-a/02` (after stripping a leading `#`).
const BLOCKER_ID = /^(?:[\w-]+\/)?\d+[\w.-]*$/;
// Words joining ids inside one comma segment (`01 e 02`, `01 and 02`, `01 & 02`).
const BLOCKER_CONNECTOR = /^(?:e|and|&)$/i;

/**
 * Blocker ids from a `Blocked by` value. Split on commas; in each segment, take
 * leading tokens while they are ids or connectors and stop at the first other
 * token, so free text after the ids (`01 — title`, `#01 (setup)`) is ignored.
 */
function parseBlockedBy(rawBlocked) {
  if (NO_BLOCKER.test(rawBlocked)) return [];
  const ids = [];
  for (const segment of rawBlocked.split(',')) {
    for (const token of segment.trim().split(/\s+/)) {
      if (BLOCKER_CONNECTOR.test(token)) continue;
      const id = token.replace(/^#/, '');
      if (!BLOCKER_ID.test(id)) break;
      ids.push(id);
    }
  }
  return ids;
}

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

  // `[ \t]*` keeps an empty `Blocked by:` from capturing the next line.
  const blockedMatch = content.match(/(?:\*\*Blocked by:\*\*|Blocked by:)[ \t]*([^\n]*)/i);
  const blockedBy = blockedMatch ? parseBlockedBy(blockedMatch[1].trim()) : [];

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
 * A blocker id is looked up in the ticket's own feature first (`<feature>/<id>`), then as
 * an explicit `<feature>/<id>`, then as a bare id in another feature only when exactly one
 * feature has it; a bare id found in several features gets status `ambiguous`, and one
 * found nowhere gets `unknown` (both keep the ticket blocked). Returns the same array.
 */
export function assignColumns(tickets) {
  const statusByKey = new Map();
  const statusesByBareId = new Map();
  for (const t of tickets) {
    statusByKey.set(`${t.feature}/${t.id}`, t.rawStatus);
    if (!statusesByBareId.has(t.id)) statusesByBareId.set(t.id, []);
    statusesByBareId.get(t.id).push(t.rawStatus);
  }
  const lookup = (feature, bId) => {
    const own = statusByKey.get(`${feature}/${bId}`) ?? statusByKey.get(bId);
    if (own !== undefined) return own;
    const matches = statusesByBareId.get(bId) || [];
    if (matches.length === 1) return matches[0];
    return matches.length > 1 ? 'ambiguous' : 'unknown';
  };
  for (const t of tickets) {
    const blockersDetail = [];
    let hasUnresolvedBlocker = false;
    for (const bId of t.blockedBy) {
      const bStatus = lookup(t.feature, bId);
      // A blocker counts as cleared when its ticket is in the done column.
      const resolved = DONE_STATUSES.includes(bStatus);
      blockersDetail.push({ id: bId, status: bStatus, resolved });
      if (!resolved) hasUnresolvedBlocker = true;
    }
    t.blockersDetail = blockersDetail;
    t.computedColumn = columnFor(t.rawStatus, hasUnresolvedBlocker);
  }
  return tickets;
}
