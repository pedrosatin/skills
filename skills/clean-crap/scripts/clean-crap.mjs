#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const extensions = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const excludedDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.metrics', '.next', '.nuxt', 'out', '__tests__', '__mocks__', 'test', 'tests', '.worktrees']);
const excludedFiles = /(?:\.d\.[cm]?ts$|\.(?:test|spec)\.[cm]?[jt]sx?$)/i;
const unmergedStates = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const help = `Usage: clean-crap [--root <directory>] [--no-coverage | --use-existing-coverage]
                  [--threshold <number>] [--changed | --since <revision>] [<path>...]

Measure JS/TS function complexity, join LCOV coverage when available, compute
CRAP = complexity^2 * (1 - coverage)^3 + complexity, gate on a threshold, and
write <root>/.metrics/crap.json.

--root <directory>       Project directory (default: current directory)
--no-coverage            Measure complexity only; no CRAP gate (scores stay null)
--use-existing-coverage  Join LCOV already on disk; fail when none is found
(default coverage mode)  Join LCOV when found; otherwise measure complexity only; no CRAP gate
--threshold <number>     CRAP gate threshold, finite positive (default: 30)
--changed                Select current added/modified/untracked git files
--since <revision>       Select changes from merge-base to HEAD plus current changes
<path>                   Positional path filter: file or directory under root

LCOV is discovered as *.info files under any directory named coverage below the
root. Only entries with numeric CRAP gate; null-CRAP entries never fail.

Exit codes: 0 scored gate passed or measurement only; 1 usage or tool error (no report written);
2 threshold exceeded (report written, failures listed).
--help                   Show this help`;

function options(args) {
  const result = { root: process.cwd(), threshold: 30, noCoverage: false, useExisting: false, changed: false, since: null, paths: [] };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help' || flag === '-h') return { help: true };
    if (flag === '--no-coverage') result.noCoverage = true;
    else if (flag === '--use-existing-coverage') result.useExisting = true;
    else if (flag === '--changed') result.changed = true;
    else if (flag === '--root' || flag === '--threshold' || flag === '--since') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value. Run --help for usage.`);
      if (flag === '--root') result.root = path.resolve(value);
      else if (flag === '--since') result.since = value;
      else {
        result.threshold = Number(value);
        if (!Number.isFinite(result.threshold) || result.threshold <= 0) throw new Error('--threshold must be a finite positive number.');
      }
    } else if (flag.startsWith('-')) throw new Error(`Unsupported argument ${flag}. Run --help for supported flags.`);
    else result.paths.push(flag);
  }
  if (result.noCoverage && result.useExisting) throw new Error('--no-coverage and --use-existing-coverage cannot be combined. Choose one coverage mode.');
  if (result.changed && result.since) throw new Error('--changed and --since cannot be combined. Choose one git selection mode.');
  return result;
}

function toPosix(value) {
  return value.split(path.sep).join('/').replace(/\\/g, '/');
}

function normalizeFilter(arg, root) {
  let value = arg;
  if (path.isAbsolute(value)) value = path.relative(root, value);
  value = toPosix(value);
  while (value.startsWith('./')) value = value.slice(2);
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function matchesFilter(relative, filter) {
  return relative === filter || relative.startsWith(`${filter}/`);
}

async function sources(root, relative = '') {
  const files = [];
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, item.name);
    if (item.isDirectory() && !excludedDirs.has(item.name)) files.push(...await sources(root, name));
    else if (item.isFile() && extensions.test(item.name) && !excludedFiles.test(item.name)) files.push(name);
  }
  return files.sort();
}

async function lcovInfos(root, relative = '') {
  const files = [];
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, item.name);
    if (item.isDirectory()) files.push(...await lcovInfos(root, name));
    else if (item.isFile() && item.name.endsWith('.info')) files.push(name);
  }
  return files;
}

async function lcovFiles(root, relative = '') {
  const files = [];
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const name = path.join(relative, item.name);
    if (item.name === 'coverage') {
      const base = path.dirname(name);
      for (const info of await lcovInfos(root, name)) files.push({ file: info, base });
    } else if (!excludedDirs.has(item.name)) files.push(...await lcovFiles(root, name));
  }
  return files.sort((left, right) => left.file.localeCompare(right.file));
}

function normalizeSf(sf, root, base) {
  let value = sf.trim();
  if (value.startsWith('./')) value = value.slice(2);
  return toPosix(path.relative(root, path.resolve(root, base, value)));
}

function parseLcov(text, root, base) {
  const records = new Map();
  let target = null;
  for (const line of text.split(/\r?\n/)) {
    const record = line.trim();
    if (record.startsWith('SF:')) {
      const key = normalizeSf(record.slice(3), root, base);
      target = records.get(key) ?? null;
      if (!target) {
        target = { functions: new Map(), lines: new Map() };
        records.set(key, target);
      }
    } else if (target && record.startsWith('FNDA:')) {
      const separator = record.indexOf(',', 5);
      if (separator !== -1) target.functions.set(record.slice(separator + 1), Number(record.slice(5, separator)));
    } else if (target && record.startsWith('DA:')) {
      const fields = record.slice(3).split(',');
      const number = Number(fields[0]);
      if (Number.isFinite(number)) target.lines.set(number, Number(fields[1]));
    } else if (record === 'end_of_record') target = null;
  }
  return records;
}

async function loadLcov(root) {
  const files = await lcovFiles(root);
  if (!files.length) return null;
  const merged = new Map();
  for (const { file, base } of files) {
    for (const [key, record] of parseLcov(await readFile(path.join(root, file), 'utf8'), root, base)) {
      const target = merged.get(key);
      if (!target) merged.set(key, record);
      else {
        for (const [name, hits] of record.functions) target.functions.set(name, hits);
        for (const [number, hits] of record.lines) target.lines.set(number, hits);
      }
    }
  }
  return merged;
}

function lastSegment(name) {
  const cut = Math.max(name.lastIndexOf('.'), name.lastIndexOf('#'));
  return cut === -1 ? name : name.slice(cut + 1);
}

function coverageFraction(entry, record) {
  if (!record) return null;
  let total = 0;
  let covered = 0;
  for (const [number, hits] of record.lines) {
    if (number >= entry.startLine && number <= entry.endLine) {
      total++;
      if (hits > 0) covered++;
    }
  }
  if (total > 0) return covered / total;
  for (const [name, hits] of record.functions) {
    if (name === entry.name || lastSegment(name) === entry.name) return hits > 0 ? 1 : 0;
  }
  return null;
}

function complexity(body) {
  let count = 1;
  function walk(node) {
    if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)
      || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isCatchClause(node)
      || ts.isConditionalExpression(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)) count++;
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) count++;
    if (node.questionDotToken) count++;
    ts.forEachChild(node, walk);
  }
  walk(body);
  return count;
}

function analyze(text, relative) {
  const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) {
    const diagnostic = source.parseDiagnostics[0];
    const location = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    throw new Error(`${relative}:${location.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')} Fix the syntax before analyzing.`);
  }
  const module = relative.replace(extensions, '').split(path.sep).join('.');
  const entries = [];
  function add(node, name, namespace) {
    if (!node.body) return;
    const startLine = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const endLine = source.getLineAndCharacterOfPosition(node.end).line + 1;
    entries.push({ name, namespace, complexity: complexity(node.body), coverage: null, crap: null, file: toPosix(relative), startLine, endLine });
  }
  function walk(node, namespace = module) {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const className = node.name?.getText(source) ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(source) : '<anonymous-class>');
      for (const member of node.members) walk(member, `${namespace}.${className}`);
      return;
    }
    if (ts.isFunctionDeclaration(node)) {
      add(node, node.name?.getText(source) ?? 'default', namespace);
      return;
    }
    if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node)) {
      add(node, ts.isConstructorDeclaration(node) ? 'constructor' : node.name.getText(source), namespace);
      return;
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (ts.isVariableDeclaration(node.parent) || ts.isPropertyDeclaration(node.parent)) add(node, node.parent.name.getText(source), namespace);
      else if (ts.isExportAssignment(node.parent)) add(node, 'default', namespace);
      return;
    }
    ts.forEachChild(node, child => walk(child, namespace));
  }
  walk(source);
  return entries;
}

function changedPaths(root, flag = '--changed') {
  const status = spawnSync('git', ['-C', root, 'status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'utf8' });
  if (status.error) throw new Error(`${flag} requires git, but it could not be run: ${status.error.message}. Install git or omit ${flag}.`);
  if (status.status !== 0) throw new Error(`${flag} requires a git repository and ${root} is not inside one. Run inside a git checkout or omit ${flag}.`);
  const top = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  const base = top.status === 0 ? top.stdout.trim() : root;
  const changed = new Set();
  const tokens = status.stdout.split('\0');
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) continue;
    const state = token.slice(0, 2);
    const file = token.slice(3);
    if (state.includes('R') || state.includes('C')) index++;
    if (unmergedStates.has(state)) changed.add(file);
    else if (!state.includes('D')) changed.add(file);
  }
  return [...changed].map(file => toPosix(path.relative(root, path.resolve(base, file))));
}

function sincePaths(root, revision) {
  const current = changedPaths(root, '--since');
  const resolve = spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], { encoding: 'utf8' });
  if (resolve.status !== 0) throw new Error(`--since requires a valid commit revision: ${revision}. ${resolve.stderr.trim()}`);
  const merge = spawnSync('git', ['-C', root, 'merge-base', resolve.stdout.trim(), 'HEAD'], { encoding: 'utf8' });
  if (merge.status !== 0) throw new Error(`--since could not find a merge-base with HEAD for ${revision}. ${merge.stderr.trim()}`);
  const diff = spawnSync('git', ['-C', root, 'diff', '--name-only', '-z', '--diff-filter=ACMR', merge.stdout.trim(), 'HEAD'], { encoding: 'utf8' });
  if (diff.status !== 0) throw new Error(`--since could not read committed changes: ${diff.stderr.trim()}`);
  const top = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (top.status !== 0) throw new Error(`--since could not locate the repository root: ${top.stderr.trim()}`);
  const committed = diff.stdout.split('\0').filter(Boolean).map(file => toPosix(path.relative(root, path.resolve(top.stdout.trim(), file))));
  return [...new Set([...committed, ...current])];
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function compare(left, right) {
  if (left.crap !== null && right.crap !== null && left.crap !== right.crap) return right.crap - left.crap;
  if (left.crap !== null && right.crap === null) return -1;
  if (left.crap === null && right.crap !== null) return 1;
  if (left.complexity !== right.complexity) return right.complexity - left.complexity;
  return left.namespace.localeCompare(right.namespace) || left.name.localeCompare(right.name);
}

function table(entries) {
  const rows = [['Name', 'Namespace', 'Complexity', 'Coverage', 'CRAP'], ...entries.map(entry => [
    entry.name,
    entry.namespace,
    String(entry.complexity),
    entry.coverage === null ? 'N/A' : `${entry.coverage.toFixed(2)}%`,
    entry.crap === null ? 'N/A' : String(entry.crap),
  ])];
  const widths = rows[0].map((_, index) => rows.reduce((width, row) => Math.max(width, row[index].length), 0));
  return rows.map(row => row.map((value, index) => value.padEnd(widths[index])).join('  ').trimEnd()).join('\n');
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (opts.help) return console.log(help);
  let rootStat;
  try { rootStat = await stat(opts.root); }
  catch { throw new Error(`Project root does not exist or is inaccessible: ${opts.root}. Pass an existing directory with --root.`); }
  if (!rootStat.isDirectory()) throw new Error(`Project root is not a directory: ${opts.root}. Pass a directory with --root.`);
  const filters = opts.paths.map(arg => normalizeFilter(arg, opts.root));
  let files = (await sources(opts.root)).map(toPosix);
  if (filters.length) files = files.filter(file => filters.some(filter => matchesFilter(file, filter)));
  if (opts.changed || opts.since) {
    const changed = new Set(opts.since ? sincePaths(opts.root, opts.since) : changedPaths(opts.root));
    files = files.filter(file => changed.has(file));
  }
  const entries = [];
  for (const relative of files) entries.push(...analyze(await readFile(path.join(opts.root, relative), 'utf8'), relative));
  let missingCoverage = false;
  if (!opts.noCoverage) {
    const records = await loadLcov(opts.root);
    if (records) {
      for (const entry of entries) {
        const fraction = coverageFraction(entry, records.get(entry.file));
        if (fraction === null) continue;
        entry.coverage = round2(fraction * 100);
        entry.crap = round2(entry.complexity ** 2 * (1 - fraction) ** 3 + entry.complexity);
      }
    } else if (opts.useExisting) throw new Error(`--use-existing-coverage found no LCOV data under ${opts.root}: no *.info file under any coverage directory. Generate it with the project's coverage script, vitest run --coverage, or c8 --reporter=lcovonly, then re-run.`);
    else missingCoverage = true;
  }
  entries.sort(compare);
  const violations = entries.filter(entry => entry.crap !== null && entry.crap > opts.threshold);
  const report = { version: 1, threshold: opts.threshold, generatedAt: new Date().toISOString(), entries: entries.map(({ file, startLine, endLine, ...rest }) => rest) };
  const directory = path.join(opts.root, '.metrics');
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `crap.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
  await rename(temporary, path.join(directory, 'crap.json'));
  console.log(table(entries));
  if (missingCoverage) console.log('\nNo LCOV coverage found under any coverage directory; coverage and CRAP are null. Generate it with the project\'s coverage script, vitest run --coverage, or c8 --reporter=lcovonly, or pass --no-coverage to silence this note.');
  if (violations.length) {
    console.log(`\nEntries exceeding CRAP threshold ${opts.threshold}:`);
    for (const entry of violations) console.log(`  ${entry.name} (${entry.namespace}) CRAP ${entry.crap} > ${opts.threshold}`);
    console.log(`\n${violations.length}/${entries.length} entries exceed CRAP threshold ${opts.threshold}`);
    process.exitCode = 2;
  } else {
    const scored = entries.filter(entry => entry.crap !== null).length;
    console.log(`\n${entries.length} entries (${scored} scored); all scored entries within threshold ${opts.threshold}`);
  }
}

main().catch(error => {
  console.error(`clean-crap: ${error.message}`);
  process.exitCode = 1;
});
