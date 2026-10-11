---
name: clean-crap
description: Measure JavaScript and TypeScript function complexity, join LCOV test coverage, compute CRAP scores, and gate delivery on a threshold. Use for /clean-crap or as a deterministic complexity-and-coverage check before code review.
---

# clean-crap

Run the bundled CLI against the target project. It measures cyclomatic complexity per function-like entry, joins LCOV coverage when available, computes CRAP = complexity² × (1 − coverage)³ + complexity, prints a worst-first report, replaces `<root>/.metrics/crap.json`, and exits non-zero when a scored entry exceeds the threshold.

Install the skill-local dependency once, then run the executable from any directory:

```sh
npm ci --prefix /path/to/skills/clean-crap
node /path/to/skills/clean-crap/scripts/clean-crap.mjs --root /path/to/project
```

## Flags

- `--root <directory>`: project directory (default: current directory).
- Coverage modes (at most one of the two flags):
  - default: discover LCOV under the root; when found, join and score CRAP; when none is found, succeed with null coverage/CRAP and print a note explaining how to generate LCOV.
  - `--use-existing-coverage`: require LCOV already on disk; exit 1 when none is found.
  - `--no-coverage`: skip coverage entirely; coverage and CRAP stay null and never gate; silences the missing-LCOV note.
- `--threshold <number>`: finite positive CRAP gate threshold (default 30). Only entries with numeric CRAP gate; entries at or below the threshold pass, null-CRAP entries never fail. The gate compares the rounded CRAP value.
- `--changed`: limit analysis to files added, modified, untracked, or unmerged in git (root must be inside a git repository; deletions are excluded; renamed files count under their new path). Combines with any coverage mode and with positional paths (filters intersect).
- Positional `<path>` arguments: filter analysis to files under that path (a file or directory, written root-relative or absolute; matching is the exact relative path or anything beneath it).
- `--help`: usage and exit codes.

## Exit codes

- 0: analysis succeeded and every scored entry is within the threshold.
- 1: usage or tool error — bad flags, missing root, syntax error, `--changed` outside a git repository, or `--use-existing-coverage` with no LCOV on disk. No report is written.
- 2: analysis succeeded and the report was written, but one or more scored entries exceed the threshold. A per-entry failure list names each offender.

## Coverage input

LCOV is discovered as `*.info` files under any directory named `coverage` below the root (the usual excluded directories such as `node_modules` are skipped during discovery). Multiple files are merged per source path; later files win on conflicts. `SF:` paths may be absolute, or relative to the directory that contains the `coverage` folder (the package directory in monorepos, matching how Vitest and c8 emit them when run inside a package).

To produce LCOV in a real project, run whichever of these applies:

- the project's existing coverage script, e.g. `npm run coverage`;
- Vitest with a coverage provider: `vitest run --coverage` (needs `@vitest/coverage-v8` or `@vitest/coverage-istanbul`) with the LCOV reporter enabled (`coverage.reporter` including `lcov` or `lcovonly`);
- or c8 wrapping the test run: `c8 --reporter=lcovonly -- npm test`.

Then run this CLI in default mode or with `--use-existing-coverage`.

Per-entry coverage prefers `DA:` line records inside the entry's line range (covered lines / total instrumented lines in range). When the file has no DA records in range, it falls back to binary `FNDA:` function hit counts (exact name or last `.`/`#` segment match). Entries whose file has no LCOV section keep null coverage.

## Output

The CLI prints a worst-first table (numeric CRAP descending, then complexity descending, then namespace/name; unscored entries sort after scored ones by complexity). Coverage shows as `NN.NN%` and CRAP as a number when scored, `N/A` when null. The footer states the gate outcome.

The JSON snapshot (`.metrics/crap.json`, schema version 1) keeps the same fields per entry: name, dotted namespace, complexity, coverage (percent 0–100 or null), and crap (number or null). Add `.metrics/` to the target project's ignore rules before publishing changes.

Sources include `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, and `.cjs`. Dependencies, generated output, declarations, test files, and `.worktrees/` copies are excluded by default. The TypeScript parser identifies top-level functions, variable-assigned functions/arrows, and class methods/accessors/constructors/property arrows. Nested callbacks and local functions contribute to their enclosing entry, since they are not separate report entries. Complexity starts at 1 and increments for each if, loop, catch, ternary, switch label including default, logical `&&`, `||`, `??`, and explicit `?.` operation.

Use the report to choose a small refactor, then run the project's existing tests and regenerate the report. Reduce CRAP by splitting complex functions or adding tests that exercise uncovered branches.

## Smoke procedure (todo-jarvis)

After install, confirm discovery against a real Vitest/pnpm monorepo once:

```sh
cd ~/Work/personal/todo-jarvis
node ~/.agents/skills/clean-crap/scripts/clean-crap.mjs --root . --no-coverage
```

Observe: the CLI discovers TS sources across `apps/` and `packages/`, prints the worst-first table, writes `.metrics/crap.json`, and exits 0. In default coverage mode (drop `--no-coverage`), expect the no-LCOV note when the monorepo has no `coverage/` output; run the monorepo's coverage command first when you want scored CRAP. For a delivery slice, add `--changed` to limit the gate to the touched files. The generated `.metrics/` directory is a local artifact: keep it ignored and never commit it; remove it when the check is done.

## Tests

Run the CLI boundary tests locally:

```sh
npm ci --prefix /path/to/skills/clean-crap
npm test --prefix /path/to/skills/clean-crap
```

The tests copy the included TypeScript fixture and hand-written LCOV stubs into disposable directories under `~/.cache/clean-crap-tests/` and remove them afterward.
