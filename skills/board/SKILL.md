---
name: board
description: "Open the project board (Project Hub at .scratch/index.html) in the default browser. When .scratch/ or index.html is missing, explain how /setup and /to-spec + /to-tickets create and populate the board."
disable-model-invocation: true
---

# /board

Open the project's Project Hub: the `index.html` generated inside `.scratch/`.

## Process

### 1. Run the script

```sh
node scripts/board.mjs
```

The installed skill lives at `~/.agents/skills/board`:

```sh
node ~/.agents/skills/board/scripts/board.mjs [--root <dir>]
```

The script finds the project root by walking up from `cwd` until it finds
`.scratch/` or the Git root. It checks that `.scratch/index.html` is a regular
file and opens the board in the default browser (`xdg-open`, `open`, or
PowerShell's `Start-Process` on Windows).

Flags:

- `--root <dir>`: override the project root.
- `--print`, `-p`: resolve and print the path and `file://` URL without opening it.
- `--json`: print the result as JSON (`{found, root, scratch, path, url, opened|guidance|openError}`) for the agent to interpret.
- `--help`, `-h`: show help.

### 2. Interpret the result

**Exit 0**: the board exists. It opened in the browser, or the script printed
its location with `--print`. If opening fails, the script prints the reason
and the URL to open manually.

**Exit 1**: the board does not exist. Do not invent an `index.html` or create
`.scratch/` manually. Present the script's guidance:

1. `/setup`: creates `.scratch/`, the agent docs, and `index.html`.
2. `/to-spec`: writes the spec at `.scratch/<feature>/spec.md`.
3. `/to-tickets`: splits the spec into vertical slices at
   `.scratch/<feature>/issues/` and regenerates the board.

The board starts without cards; specs and tickets add cards. If the user agrees,
run `/setup` next.

### 3. Do not edit the HTML manually

The `setup` skill generates `.scratch/index.html`. Visual or behavioral changes
belong in the `setup` skill's generator. If the board needs changes, point to
the `setup` skill and the board's design contract.

## Examples

```sh
# Open the board in the current directory
node scripts/board.mjs

# Check and print the URL only
node scripts/board.mjs --print

# Project in another directory, structured output
node scripts/board.mjs --root ~/projetos/app --json
```
