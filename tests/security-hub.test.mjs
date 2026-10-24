import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { parseTicketFile } from '../skills/setup/scripts/scratch-tickets.mjs';

test('parseTicketFile rejects symlinks and files outside root', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-ticket-test-'));
  try {
    const secretFile = path.join(tmpDir, 'secret.txt');
    fs.writeFileSync(secretFile, 'SUPER_SECRET_KEY');

    const issuesDir = path.join(tmpDir, 'issues');
    fs.mkdirSync(issuesDir, { recursive: true });

    // 1. Regular valid ticket inside issuesDir
    const validTicket = path.join(issuesDir, '01-valid.md');
    fs.writeFileSync(validTicket, '# 01: Test Valid\n**Status:** ready-for-agent\n- [ ] Task 1');
    const parsedValid = parseTicketFile(validTicket, 'feature', issuesDir, tmpDir);
    assert.ok(parsedValid, 'Valid ticket must be parsed');
    assert.equal(parsedValid.id, '01');

    // 2. Symlink pointing to external secret file
    const symlinkTicket = path.join(issuesDir, '02-symlink.md');
    fs.symlinkSync(secretFile, symlinkTicket);

    const parsedSymlink = parseTicketFile(symlinkTicket, 'feature', issuesDir, tmpDir);
    assert.equal(parsedSymlink, null, 'Symlink ticket must be rejected');

    // 3. Ticket referencing file outside repoRoot
    const outsideTicket = path.join(tmpDir, '03-outside.md');
    fs.writeFileSync(outsideTicket, '# 03: Outside\n**Status:** ready-for-agent');
    const parsedOutside = parseTicketFile(outsideTicket, 'feature', issuesDir, issuesDir);
    assert.equal(parsedOutside, null, 'File outside repoRoot must be rejected');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
