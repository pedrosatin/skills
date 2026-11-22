import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
