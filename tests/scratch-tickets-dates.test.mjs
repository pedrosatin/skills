import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  assignColumns,
  columnFor,
  parseTicketDate,
  parseTicketFile,
} from '../skills/setup/scripts/scratch-tickets.mjs';

function writeTicket(dir, name, body) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, body);
  return filePath;
}

test('parseTicketDate accepts calendar days and rejects invalid ones', () => {
  assert.equal(parseTicketDate('2026-11-14'), '2026-11-14');
  assert.equal(parseTicketDate(' 2026-11-20 '), '2026-11-20');
  assert.equal(parseTicketDate('2026-02-30'), null);
  assert.equal(parseTicketDate('2026-13-01'), null);
  assert.equal(parseTicketDate('2026-11'), null);
  assert.equal(parseTicketDate('2025-02-29'), null);
  assert.equal(parseTicketDate('not-a-date'), null);
  assert.equal(parseTicketDate(''), null);
  assert.equal(parseTicketDate(null), null);
});

test('parseTicketFile exposes updated and resolved dates', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-ticket-dates-'));
  try {
    const issuesDir = path.join(tmpDir, 'issues');
    fs.mkdirSync(issuesDir, { recursive: true });

    const both = writeTicket(
      issuesDir,
      '01-both.md',
      [
        '# 01: Both dates',
        '**Status:** resolved',
        '**Updated:** 2026-11-14',
        '**Resolved:** 2026-11-20',
        '- [x] Done',
      ].join('\n'),
    );
    const parsedBoth = parseTicketFile(both, 'feature', issuesDir, tmpDir);
    assert.ok(parsedBoth);
    assert.equal(parsedBoth.updated, '2026-11-14');
    assert.equal(parsedBoth.resolved, '2026-11-20');
    assert.equal(parsedBoth.rawStatus, 'resolved');

    const onlyUpdated = writeTicket(
      issuesDir,
      '02-updated.md',
      [
        '# 02: Only Updated',
        '**Status:** claimed',
        'Updated: 2026-11-15',
        '- [ ] Still open',
      ].join('\n'),
    );
    const parsedUpdated = parseTicketFile(onlyUpdated, 'feature', issuesDir, tmpDir);
    assert.ok(parsedUpdated);
    assert.equal(parsedUpdated.updated, '2026-11-15');
    assert.equal(parsedUpdated.resolved, null);
    assert.equal(parsedUpdated.rawStatus, 'claimed');

    const none = writeTicket(
      issuesDir,
      '03-legacy.md',
      ['# 03: Legacy ticket', '**Status:** ready-for-agent', '- [ ] No dates'].join('\n'),
    );
    const parsedNone = parseTicketFile(none, 'feature', issuesDir, tmpDir);
    assert.ok(parsedNone);
    assert.equal(parsedNone.updated, null);
    assert.equal(parsedNone.resolved, null);
    assert.equal(parsedNone.rawStatus, 'ready-for-agent');

    const invalid = writeTicket(
      issuesDir,
      '04-invalid.md',
      [
        '# 04: Invalid dates',
        '**Status:** in-progress',
        '**Updated:** 2026-02-30',
        '**Resolved:** 2026-13-01',
        '- [ ] Bad calendar day',
      ].join('\n'),
    );
    const parsedInvalid = parseTicketFile(invalid, 'feature', issuesDir, tmpDir);
    assert.ok(parsedInvalid);
    assert.equal(parsedInvalid.updated, null);
    assert.equal(parsedInvalid.resolved, null);
    assert.equal(parsedInvalid.rawStatus, 'in-progress');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updated and resolved do not change column or blocker resolution', () => {
  const tickets = [
    {
      id: '01',
      feature: 'demo',
      rawStatus: 'resolved',
      updated: '2026-11-14',
      resolved: '2026-11-20',
      blockedBy: [],
    },
    {
      id: '02',
      feature: 'demo',
      rawStatus: 'ready-for-agent',
      updated: null,
      resolved: null,
      blockedBy: ['01'],
    },
  ];
  assignColumns(tickets);
  assert.equal(tickets[0].computedColumn, 'done');
  assert.equal(tickets[1].computedColumn, 'ready-for-agent');
  assert.equal(tickets[1].blockersDetail[0].resolved, true);
  assert.equal(columnFor('claimed', false), 'in-progress');
  assert.equal(columnFor('ready-for-agent', true), 'blocked');
});

test('parseTicketFile ignores fenced examples, strips HTML comments, and rejects trailing text', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-ticket-dates-edge-'));
  try {
    const issuesDir = path.join(tmpDir, 'issues');
    fs.mkdirSync(issuesDir, { recursive: true });

    const fencedOnly = writeTicket(
      issuesDir,
      '10-fenced.md',
      [
        '# 10: Dates only inside a fence',
        '**Status:** claimed',
        '',
        '```markdown',
        '**Updated:** 2026-11-14',
        '**Resolved:** 2026-11-20   <!-- só quando o status vira concluído -->',
        '```',
        '',
        '- [ ] Outside the fence there is no date field',
      ].join('\n'),
    );
    const parsedFenced = parseTicketFile(fencedOnly, 'feature', issuesDir, tmpDir);
    assert.ok(parsedFenced);
    assert.equal(parsedFenced.updated, null);
    assert.equal(parsedFenced.resolved, null);
    assert.equal(parsedFenced.rawStatus, 'claimed');

    const withComment = writeTicket(
      issuesDir,
      '11-comment.md',
      [
        '# 11: HTML comment after date',
        '**Status:** resolved',
        '**Updated:** 2026-11-14',
        '**Resolved:** 2026-11-20   <!-- comment -->',
        '- [x] Done',
      ].join('\n'),
    );
    const parsedComment = parseTicketFile(withComment, 'feature', issuesDir, tmpDir);
    assert.ok(parsedComment);
    assert.equal(parsedComment.updated, '2026-11-14');
    assert.equal(parsedComment.resolved, '2026-11-20');

    const emptyThenNext = writeTicket(
      issuesDir,
      '12-empty.md',
      [
        '# 12: Empty Updated then next line',
        '**Status:** in-progress',
        '**Updated:**',
        '**Resolved:** 2026-11-20',
        '- [ ] Open',
      ].join('\n'),
    );
    const parsedEmpty = parseTicketFile(emptyThenNext, 'feature', issuesDir, tmpDir);
    assert.ok(parsedEmpty);
    assert.equal(parsedEmpty.updated, null);
    assert.equal(parsedEmpty.resolved, '2026-11-20');

    const trailingText = writeTicket(
      issuesDir,
      '13-trailing.md',
      [
        '# 13: Trailing prose after date',
        '**Status:** claimed',
        '**Updated:** 2026-11-14 yesterday',
        '**Resolved:** 2026-11',
        '- [ ] Open',
      ].join('\n'),
    );
    const parsedTrailing = parseTicketFile(trailingText, 'feature', issuesDir, tmpDir);
    assert.ok(parsedTrailing);
    assert.equal(parsedTrailing.updated, null);
    assert.equal(parsedTrailing.resolved, null);

    const tildeFence = writeTicket(
      issuesDir,
      '14-tilde.md',
      [
        '# 14: Tilde fence example',
        '**Status:** ready-for-agent',
        '~~~',
        '**Updated:** 2026-01-01',
        '~~~',
        '**Updated:** 2026-11-15',
        '- [ ] Has a real Updated outside the fence',
      ].join('\n'),
    );
    const parsedTilde = parseTicketFile(tildeFence, 'feature', issuesDir, tmpDir);
    assert.ok(parsedTilde);
    assert.equal(parsedTilde.updated, '2026-11-15');
    assert.equal(parsedTilde.resolved, null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('hub fixture shows escaped Atualizado date from Updated field', async () => {
  const { spawnSync } = await import('node:child_process');
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const generateHub = path.join(repoRoot, 'skills/setup/scripts/generate-hub.mjs');
  const fixtureHtml = path.join(repoRoot, 'skills/setup/fixtures/hub-fixture.html');
  const result = spawnSync(process.execPath, [generateHub, '--fixture'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const html = fs.readFileSync(fixtureHtml, 'utf8');
  assert.match(html, /"updated"\s*:\s*"2026-11-14"/);
  assert.match(html, /Atualizado: \$\{escapeHtml\(t\.updated\)\}/);
  assert.match(html, /class="card-updated"/);
});
