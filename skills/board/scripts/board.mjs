#!/usr/bin/env node
// board: check and open the project board (Project Hub at .scratch/index.html).
//
// Usage:
//   node scripts/board.mjs [--root <dir>] [--print] [--json]
//
// Exit codes:
//   0  board found (opened, or only resolved with --print/--json)
//   1  board missing: .scratch/ or .scratch/index.html is absent
//   2  usage error (invalid flag)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: node scripts/board.mjs [options]

Check whether .scratch/index.html exists and open the board in the default browser.

Options:
  --root <dir>   project root (default: walk up from cwd to .scratch/ or the Git root)
  --print, -p    resolve and print the path/URL without opening the browser
  --json         print the result as JSON ({found, root, scratch, path, url, opened|guidance|openError})
  --help, -h     show this help`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { root: null, print: false, json: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const value = argv[i + 1];
      // Reject a missing value and cases where the next flag is consumed
      // as a value (`--root --print` becomes root "--print").
      if (!value || value.startsWith('-')) throw new UsageError('--root requires a directory');
      opts.root = value;
      i += 1;
    } else if (arg.startsWith('--root=')) {
      const value = arg.slice('--root='.length);
      if (!value) throw new UsageError('--root requires a directory');
      opts.root = value;
    } else if (arg === '--print' || arg === '-p') {
      opts.print = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new UsageError(`unknown flag: ${arg}`);
    }
  }
  return opts;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

// Only a regular file counts as a board; a directory named index.html does not.
function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

// Walk up from `start` looking for a .scratch/ directory. Stop at the first
// match or the Git root to avoid crossing into a parent repository.
function locate(start) {
  const initial = path.resolve(start);
  let dir = initial;
  while (true) {
    const scratch = path.join(dir, '.scratch');
    if (isDirectory(scratch)) {
      return { root: dir, scratch, found: true };
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      return { root: dir, scratch: path.join(dir, '.scratch'), found: false };
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return { root: initial, scratch: path.join(initial, '.scratch'), found: false };
    }
    dir = parent;
  }
}

// Open the target in the default browser. The argument depends on the platform. On Windows,
// the command is constant and the target travels only through a child process
// environment variable, so the path is never interpolated into PowerShell source.
function openTarget(target) {
  const platform = process.platform;
  let command;
  let args;
  let timeout;
  if (platform === 'darwin') {
    command = 'open';
    args = [target];
    timeout = 5000;
  } else if (platform === 'win32') {
    command = 'powershell.exe';
    args = ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:BOARD_OPEN_TARGET'];
    timeout = 15000;
  } else {
    command = 'xdg-open';
    args = [target];
    timeout = 5000;
  }

  const spawnOptions = {
    encoding: 'utf8',
    shell: false,
    stdio: 'ignore',
    timeout,
    windowsHide: true,
  };
  if (platform === 'win32') {
    spawnOptions.env = { ...process.env, BOARD_OPEN_TARGET: target };
  }

  let result;
  try {
    result = spawnSync(command, args, spawnOptions);
  } catch (error) {
    result = { error };
  }

  if (result.error) {
    const reason =
      result.error.code === 'ENOENT'
        ? `${command} not found on PATH`
        : result.error.message;
    return { ok: false, reason };
  }
  if (result.signal) {
    return { ok: false, reason: `${command} terminated by ${result.signal}` };
  }
  if (result.status !== 0) {
    return { ok: false, reason: `${command} exited with code ${result.status}` };
  }
  return { ok: true };
}

function guidance({ hasScratch, indexPath }) {
  const lines = [];
  if (hasScratch) {
    lines.push(`The .scratch/ directory exists, but the following file is missing: ${indexPath}.`);
    lines.push('Run /setup (or `node ~/.agents/skills/setup/scripts/generate-hub.mjs`) to generate the Project Hub.');
  } else {
    lines.push('This project has no .scratch/ directory.');
    lines.push('Run /setup to create .scratch/, the docs, and .scratch/index.html.');
  }
  lines.push('Then use /to-spec and /to-tickets to populate the board with a spec and tickets.');
  lines.push('The board starts without cards; specs and tickets add cards.');
  return lines;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n`);
      console.error(USAGE);
      return 2;
    }
    throw error;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const { root, scratch, found: hasScratch } = locate(opts.root || process.cwd());
  const indexPath = path.join(scratch, 'index.html');
  const exists = hasScratch && isFile(indexPath);

  if (!exists) {
    const lines = guidance({ hasScratch, indexPath });
    if (opts.json) {
      console.log(
        JSON.stringify({ found: false, root, scratch, path: null, url: null, guidance: lines }, null, 2),
      );
    } else {
      console.log(`Board not found at ${root}\n`);
      for (const line of lines) console.log(`  ${line}`);
    }
    return 1;
  }

  const url = pathToFileURL(indexPath).href;
  const relativeToCwd = path.relative(process.cwd(), indexPath);
  const display =
    relativeToCwd && !relativeToCwd.startsWith('..') && !path.isAbsolute(relativeToCwd)
      ? relativeToCwd
      : indexPath;

  let opened = { ok: false };
  if (!opts.print) opened = openTarget(url);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          found: true,
          root,
          scratch,
          path: indexPath,
          url,
          opened: opts.print ? false : opened.ok,
          ...(opened.ok || opts.print ? {} : { openError: opened.reason }),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`Board: ${display}`);
  console.log(`  ${url}`);
  if (opts.print) return 0;
  if (opened.ok) {
    console.log('  Opening in the default browser...');
  } else {
    console.log(`  Could not open the browser (${opened.reason}).`);
    console.log('  Open the link above manually.');
  }
  return 0;
}

process.exitCode = main();
