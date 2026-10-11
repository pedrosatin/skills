import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const skill = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(skill, 'scripts/clean-crap.mjs');
const cache = path.join(os.homedir(), '.cache/clean-crap-tests');

async function workspace(t) {
  await mkdir(cache, { recursive: true });
  const root = await mkdtemp(path.join(cache, 'cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function run(root, ...flags) {
  return spawnSync(process.execPath, [cli, '--root', root, ...flags], { encoding: 'utf8' });
}

async function report(root) {
  return JSON.parse(await readFile(path.join(root, '.metrics/crap.json'), 'utf8'));
}

async function lcov(root, body) {
  await mkdir(path.join(root, 'coverage'), { recursive: true });
  await writeFile(path.join(root, 'coverage/lcov.info'), body);
}

test('fixture report contains structural complexity, null scores, and worst-first output', async t => {
  const root = await workspace(t);
  await cp(path.join(skill, 'fixtures/example.ts'), path.join(root, 'example.ts'));
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const snapshot = await report(root);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.threshold, 30);
  assert.ok(Number.isFinite(Date.parse(snapshot.generatedAt)));
  assert.deepEqual(snapshot.entries, [
    { name: 'choose', namespace: 'example', complexity: 6, coverage: null, crap: null },
    { name: 'read', namespace: 'example.Reader', complexity: 4, coverage: null, crap: null },
    { name: 'enabled', namespace: 'example', complexity: 2, coverage: null, crap: null },
    { name: 'identity', namespace: 'example', complexity: 1, coverage: null, crap: null },
  ]);
  assert.ok(result.stdout.indexOf('choose') < result.stdout.indexOf('identity'));
  assert.match(result.stdout, /Coverage\s+CRAP/);
  assert.match(result.stdout, /N\/A/);
});

test('threshold is stored without gating and a successful analysis replaces the snapshot', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'sample.ts'), 'export function sample(x: boolean) { if (x) return 1; return 0; }');
  assert.equal(run(root, '--no-coverage', '--threshold', '1').status, 0);
  assert.equal((await report(root)).threshold, 1);
  await writeFile(path.join(root, 'sample.ts'), 'export function renamed() { return 1; }');
  assert.equal(run(root, '--no-coverage', '--threshold', '42').status, 0);
  const snapshot = await report(root);
  assert.equal(snapshot.threshold, 42);
  assert.deepEqual(snapshot.entries.map(entry => entry.name), ['renamed']);
});

test('decision kinds include default switch labels and nested callbacks in the enclosing entry', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'decisions.ts'), `
export function decisions(items: number[], obj?: { run?: () => number }) {
  if (items.length && obj || false) items = [];
  for (let i = 0; i < 2; i++) {}
  for (const item of items) {}
  for (const key in obj) {}
  while (false) {}
  do {} while (false);
  try {} catch {}
  switch (items.length) { case 1: break; case 2: break; default: break; }
  items.map(item => item > 0 ? item : 0);
  function local() { if (true) return 1; return 0; }
  return obj?.run?.() ?? 0;
}`);
  const result = run(root, '--no-coverage');
  assert.equal(result.status, 0, result.stderr);
  const entries = (await report(root)).entries;
  assert.equal(entries.length, 1);
  // Base 1 + if 1 + logical 2 + loops 5 + catch 1 + switch 3
  // + callback ternary 1 + local if 1 + optional operations 2 + nullish 1.
  assert.equal(entries[0].complexity, 18);
});

test('JS/TS variants, class entries, namespaces, and default exclusions', async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, 'src'), { recursive: true });
  for (const extension of ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts', 'mjs', 'cjs']) {
    await writeFile(path.join(root, 'src', `sample.${extension}`), 'export const sample = function (value) { return value ? 1 : 0; };');
  }
  await writeFile(path.join(root, 'src/reader.ts'), `export class Reader {
constructor() {} get value() { return 1; } set value(x: number) { if (x) {} }
read = (x: boolean) => x ? 1 : 0;
}`);
  await writeFile(path.join(root, 'src/default.ts'), 'export default (value: boolean) => value ? 1 : 0;');
  for (const folder of ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__', 'test', 'tests', '.metrics', '.worktrees']) {
    await mkdir(path.join(root, folder), { recursive: true });
    await writeFile(path.join(root, folder, 'ignored.ts'), 'invalid source {');
  }
  for (const name of ['ignored.test.ts', 'ignored.spec.jsx', 'types.d.ts', 'types.d.mts']) {
    await writeFile(path.join(root, name), 'invalid source {');
  }
  const result = run(root, '--no-coverage');
  assert.equal(result.status, 0, result.stderr);
  const entries = (await report(root)).entries;
  assert.equal(entries.length, 13);
  assert.equal(entries.filter(entry => entry.namespace === 'src.sample' && entry.complexity === 2).length, 8);
  assert.equal(entries.filter(entry => entry.namespace === 'src.reader.Reader').length, 4);
  assert.ok(entries.some(entry => entry.name === 'constructor'));
  assert.ok(entries.some(entry => entry.name === 'default' && entry.namespace === 'src.default' && entry.complexity === 2));
});

test('root, flag, and syntax failures are actionable and leave no report', async t => {
  const root = await workspace(t);
  const missing = run(path.join(root, 'missing'));
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Project root.*--root/);
  for (const args of [['--threshold', 'NaN'], ['--threshold', '0'], ['--threshold'], ['--bogus']]) {
    const result = run(root, '--no-coverage', ...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /threshold|Unsupported argument/);
  }
  await writeFile(path.join(root, 'broken.ts'), 'export function broken( {');
  const result = run(root, '--no-coverage');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /broken\.ts:1:.*Fix the syntax/);
  await assert.rejects(readFile(path.join(root, '.metrics/crap.json')), { code: 'ENOENT' });
});

test('help succeeds and documents flags and exit codes', async () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: clean-crap/);
  assert.match(help.stdout, /--use-existing-coverage/);
  assert.match(help.stdout, /--changed/);
  assert.match(help.stdout, /Exit codes/);
});

test('LCOV join computes exact coverage and CRAP on a controlled stub', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'calc.ts'), `export function half(value: number) {
  if (value > 0) {
    return value / 2;
  }
  return 0;
}
export function other(value: number) {
  return value;
}
`);
  await lcov(root, `TN:
SF:calc.ts
FN:1,6,half
FN:7,9,other
FNDA:1,half
FNDA:1,other
DA:2,1
DA:3,0
DA:8,1
end_of_record
`);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const half = (await report(root)).entries.find(entry => entry.name === 'half');
  assert.equal(half.complexity, 2);
  assert.equal(half.coverage, 50);
  assert.equal(half.crap, 2.5);
  assert.match(result.stdout, /50\.00%/);
  assert.match(result.stdout, /2\.5/);
  const existing = run(root, '--use-existing-coverage');
  assert.equal(existing.status, 0, existing.stderr);
  assert.equal((await report(root)).entries.find(entry => entry.name === 'half').crap, 2.5);
});

test('fully covered complex entry stays below the threshold and exits 0', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'safe.ts'), `export function safe(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean) {
  if (a) {}
  if (b) {}
  if (c) {}
  if (d) {}
  if (e) {}
  return 0;
}
`);
  await lcov(root, `SF:safe.ts
DA:2,1
DA:3,1
DA:4,1
DA:5,1
DA:6,1
DA:7,1
end_of_record
`);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const entry = (await report(root)).entries[0];
  assert.equal(entry.complexity, 6);
  assert.equal(entry.coverage, 100);
  assert.equal(entry.crap, 6);
  assert.match(result.stdout, /all scored entries within threshold 30/);
});

test('uncovered complex entry exceeds the threshold: exit 2, report written, failure named', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'risky.ts'), `export function risky(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean) {
  if (a) {}
  if (b) {}
  if (c) {}
  if (d) {}
  if (e) {}
  return 0;
}
export function fine() {
  return 1;
}
`);
  await lcov(root, `SF:risky.ts
DA:2,0
DA:3,0
DA:4,0
DA:5,0
DA:6,0
DA:7,0
DA:11,1
end_of_record
`);
  const result = run(root);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /1\/2 entries exceed CRAP threshold 30/);
  assert.match(result.stdout, /risky \(risky\) CRAP 42 > 30/);
  const entries = (await report(root)).entries;
  const risky = entries.find(entry => entry.name === 'risky');
  assert.equal(risky.coverage, 0);
  assert.equal(risky.crap, 42);
  assert.equal(entries.find(entry => entry.name === 'fine').crap, 1);
});

test('--use-existing-coverage without any LCOV fails actionably and writes no report', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'sample.ts'), 'export function sample() { return 1; }');
  const result = run(root, '--use-existing-coverage');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--use-existing-coverage/);
  assert.match(result.stderr, /LCOV/);
  await assert.rejects(readFile(path.join(root, '.metrics/crap.json')), { code: 'ENOENT' });
});

test('default mode without LCOV succeeds with null scores and prints a note', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'sample.ts'), 'export function sample(x: boolean) { if (x) return 1; return 0; }');
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No LCOV coverage found/);
  assert.match(result.stdout, /--no-coverage/);
  const snapshot = await report(root);
  assert.equal(snapshot.entries[0].complexity, 2);
  assert.equal(snapshot.entries[0].coverage, null);
  assert.equal(snapshot.entries[0].crap, null);
});

test('--no-coverage never gates and conflicting coverage flags are a usage error', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'risky.ts'), 'export function risky(a) { if (a) {} if (a) {} if (a) {} if (a) {} if (a) {} return 0; }\n');
  const result = run(root, '--no-coverage', '--threshold', '30');
  assert.equal(result.status, 0, result.stderr);
  const snapshot = await report(root);
  assert.equal(snapshot.entries[0].complexity, 6);
  assert.ok(snapshot.entries.every(entry => entry.coverage === null && entry.crap === null));
  const conflict = run(root, '--no-coverage', '--use-existing-coverage');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /cannot be combined/);
});

test('--changed limits analysis to added/modified files in git', async t => {
  const root = await workspace(t);
  const git = (...args) => spawnSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(git('init', '-q', '-b', 'main', '.').status, 0, 'git init failed');
  await writeFile(path.join(root, 'a.ts'), 'export function a(x: boolean) { return x ? 1 : 0; }');
  await writeFile(path.join(root, 'b.ts'), 'export function b(x: boolean) { return x ? 1 : 0; }');
  assert.equal(git('add', 'a.ts', 'b.ts').status, 0);
  assert.equal(git('commit', '-qm', 'init').status, 0);
  await writeFile(path.join(root, 'a.ts'), 'export function a(x: boolean) { return x ? 2 : 0; }');
  await writeFile(path.join(root, 'c.ts'), 'export function c(x: boolean) { return x ? 1 : 0; }');
  await rm(path.join(root, 'b.ts'));
  const result = run(root, '--no-coverage', '--changed');
  assert.equal(result.status, 0, result.stderr);
  const namespaces = (await report(root)).entries.map(entry => entry.namespace);
  assert.deepEqual(namespaces.sort(), ['a', 'c']);
});

test('--changed outside a git repository fails actionably', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'sample.ts'), 'export function sample() { return 1; }');
  const result = run(root, '--no-coverage', '--changed');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /git repository/);
  assert.match(result.stderr, /--changed/);
});

test('positional path filters limit analysis to matching files', async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, 'src/deep'), { recursive: true });
  await mkdir(path.join(root, 'lib'), { recursive: true });
  await writeFile(path.join(root, 'src/deep/one.ts'), 'export function one() { return 1; }');
  await writeFile(path.join(root, 'lib/two.ts'), 'export function two() { return 2; }');
  const result = run(root, '--no-coverage', 'src');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await report(root)).entries.map(entry => entry.namespace), ['src.deep.one']);
  const absolute = run(root, '--no-coverage', path.join(root, 'lib/two.ts'));
  assert.equal(absolute.status, 0, absolute.stderr);
  assert.deepEqual((await report(root)).entries.map(entry => entry.namespace), ['lib.two']);
});

test('FNDA fallback scores binary coverage when the file has no DA records', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'fns.ts'), `export function safe() { return 1; }
export function risky() { return 2; }
`);
  await lcov(root, `SF:fns.ts
FN:1,1,fns.ts.safe
FN:2,2,fns.ts.risky
FNDA:3,fns.ts.safe
FNDA:0,risky
end_of_record
`);
  const result = run(root, '--use-existing-coverage');
  assert.equal(result.status, 0, result.stderr);
  const entries = (await report(root)).entries;
  const safe = entries.find(entry => entry.name === 'safe');
  const risky = entries.find(entry => entry.name === 'risky');
  assert.equal(safe.coverage, 100);
  assert.equal(safe.crap, 1);
  assert.equal(risky.coverage, 0);
  assert.equal(risky.crap, 2);
  assert.match(result.stdout, /0\.00%/);
  assert.match(result.stdout, /100\.00%/);
});

test('CRAP at exactly the threshold passes and rounding is compared, not truncated', async t => {
  const root = await workspace(t);
  await writeFile(path.join(root, 'thirds.ts'), `export function thirds(a: boolean, b: boolean) {
  if (a) {
    return 1;
  }
  if (b) {
    return 2;
  }
  return 0;
}
`);
  await lcov(root, `SF:thirds.ts
DA:2,1
DA:5,0
DA:8,0
end_of_record
`);
  // cc=3, 1 of 3 lines covered: 9 * (2/3)^3 + 3 = 5.666... -> 5.67.
  const at = run(root, '--threshold', '5.67');
  assert.equal(at.status, 0, at.stderr);
  const below = run(root, '--threshold', '5.66');
  assert.equal(below.status, 2);
  assert.match(below.stdout, /thirds .*CRAP 5\.67 > 5\.66/);
  assert.equal((await report(root)).entries[0].crap, 5.67);
});

test('absolute SF paths, nested coverage dirs, and later LCOV files win the merge', async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, 'packages/x/coverage'), { recursive: true });
  await writeFile(path.join(root, 'packages/x/calc.ts'), 'export function calc(x: boolean) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\n');
  await writeFile(path.join(root, 'packages/x/coverage/a-first.info'), `SF:${path.join(root, 'packages/x/calc.ts')}
DA:2,0
DA:4,0
DA:6,0
end_of_record
`);
  await writeFile(path.join(root, 'packages/x/coverage/b-second.info'), `SF:calc.ts
DA:2,1
DA:4,1
DA:6,1
end_of_record
`);
  const result = run(root, '--use-existing-coverage');
  assert.equal(result.status, 0, result.stderr);
  const entry = (await report(root)).entries[0];
  assert.equal(entry.complexity, 2);
  assert.equal(entry.coverage, 100);
  assert.equal(entry.crap, 2);
});

test('worst-first order: scored by CRAP descending, then unscored by complexity', async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, 'a'), { recursive: true });
  await writeFile(path.join(root, 'a/low.ts'), 'export function low(x: boolean) { return x ? 1 : 0; }\n');
  await writeFile(path.join(root, 'a/high.ts'), 'export function high(a: boolean, b: boolean, c: boolean) { if (a) {} if (b) {} if (c) {} return 0; }\n');
  await mkdir(path.join(root, 'b'), { recursive: true });
  await writeFile(path.join(root, 'b/hot.ts'), 'export function hot(a: boolean, b: boolean, c: boolean) { if (a) {} if (b) {} if (c) {} return 0; }\n');
  await writeFile(path.join(root, 'b/cold.ts'), 'export function cold() { return 1; }\n');
  await lcov(root, `SF:a/low.ts
DA:1,1
end_of_record
SF:b/hot.ts
DA:1,0
DA:1,0
end_of_record
`);
  const result = run(root, '--threshold', '15');
  assert.equal(result.status, 2, result.stderr);
  const names = (await report(root)).entries.map(entry => `${entry.name}:${entry.crap ?? 'null'}`);
  assert.deepEqual(names, ['hot:20', 'low:2', 'high:null', 'cold:null']);
});

test('--changed keeps the new path of a staged rename and intersects with positional filters', async t => {
  const root = await workspace(t);
  const git = (...args) => spawnSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(git('init', '-q', '-b', 'main', '.').status, 0, 'git init failed');
  await writeFile(path.join(root, 'old.ts'), 'export function old(x: boolean) { return x ? 1 : 0; }\n');
  await mkdir(path.join(root, 'pkg'), { recursive: true });
  await writeFile(path.join(root, 'pkg/other.ts'), 'export function other() { return 1; }\n');
  assert.equal(git('add', '-A').status, 0);
  assert.equal(git('commit', '-qm', 'init').status, 0);
  assert.equal(git('mv', 'old.ts', 'renamed.ts').status, 0);
  await writeFile(path.join(root, 'pkg/other.ts'), 'export function other() { return 2; }\n');
  const result = run(root, '--no-coverage', '--changed');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await report(root)).entries.map(entry => entry.name).sort(), ['old', 'other']);
  const filtered = run(root, '--no-coverage', '--changed', 'pkg');
  assert.equal(filtered.status, 0, filtered.stderr);
  assert.deepEqual((await report(root)).entries.map(entry => entry.name), ['other']);
});

test('a root with no sources and a filter matching nothing both exit 0 with an empty report', async t => {
  const root = await workspace(t);
  const empty = run(root, '--no-coverage');
  assert.equal(empty.status, 0, empty.stderr);
  assert.deepEqual((await report(root)).entries, []);
  await writeFile(path.join(root, 'sample.ts'), 'export function sample() { return 1; }\n');
  const none = run(root, '--no-coverage', 'nonexistent');
  assert.equal(none.status, 0, none.stderr);
  assert.deepEqual((await report(root)).entries, []);
  assert.match(none.stdout, /0 entries/);
});
