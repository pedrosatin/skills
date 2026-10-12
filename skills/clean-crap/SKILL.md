---
name: clean-crap
description: Measure JavaScript and TypeScript function complexity, join LCOV test coverage, compute CRAP scores, and gate delivery on a threshold. Use when running /clean-crap or as a deterministic complexity-and-coverage check before code review.
---

# clean-crap

Run the bundled CLI against the target project. Install the skill-local dependency once, then run from any directory:

```sh
npm ci --prefix /path/to/skills/clean-crap
node /path/to/skills/clean-crap/scripts/clean-crap.mjs --root /path/to/project
```

Flags, coverage modes, threshold, positional path filters, and exit codes live in `node /path/to/skills/clean-crap/scripts/clean-crap.mjs --help`.

CRAP = complexity² × (1 − coverage)³ + complexity. Only entries with numeric CRAP gate; null-CRAP entries never fail.

## Parser

The TypeScript parser reports top-level functions, variable-assigned functions/arrows, and class methods/accessors/constructors/property arrows. Nested callbacks and local functions increment the enclosing entry; they are not separate report rows. Complexity starts at 1 and increments for each if, loop, catch, ternary, switch label including default, logical `&&`, `||`, `??`, and explicit `?.` operation.

Sources include `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, and `.cjs`. Dependencies, generated output, declarations, test files, and `.worktrees/` copies are excluded by default.

## Coverage join

LCOV is discovered as `*.info` files under any directory named `coverage` below the root. Multiple files merge per source path; later files win on overlapping line and function records. `SF:` paths may be absolute, or relative to the directory that contains the `coverage` folder.

Per-entry coverage prefers `DA:` line records inside the entry's line range (covered lines / total instrumented lines in range). When the file has no DA records in range, it falls back to binary `FNDA:` function hit counts (exact name or last `.`/`#` segment match). Entries whose file has no LCOV section keep null coverage.

## Git selection

`--changed` limits analysis to files added, modified, untracked, or unmerged in git. The root must be inside a git repository. Deletions are excluded. Renamed files count under their new path. The filter intersects with positional path arguments.

`--since <revision>` selects files changed from the revision’s merge-base with HEAD through HEAD, plus current staged, unstaged, and untracked changes. Use it for committed delivery work and subsequent corrections. It excludes deletions, uses rename destinations, and intersects positional filters. Choose either `--since` or `--changed`.

## Report

The CLI writes `<root>/.metrics/crap.json`. `.metrics/` is a local untracked artifact: keep it ignored and never commit it.

Use the report to choose a small refactor, then run the project's existing tests and regenerate. Reduce CRAP by splitting complex functions or adding tests that exercise uncovered branches.
