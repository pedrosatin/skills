---
name: board
description: "Open the project board (Project Hub at .scratch/index.html) in the default browser. When .scratch/ or index.html is missing, explain how /setup and /to-spec + /to-tickets create and populate the board."
disable-model-invocation: true
---

# /board

Open the project's Project Hub: the `index.html` generated inside `.scratch/`.

## Process

### 1. Run the script

Resolve `<board>` as the folder containing this skill and `<project-root>` as the repository's **primary worktree** (`git worktree list --porcelain | awk '/^worktree / { print $2; exit }'`), even when the session sits on a linked agent checkout. Durable hub files live there — see `docs/agents/issue-tracker.md` (Scratch root). Run `node <board>/scripts/board.mjs --root <project-root>` from any directory. Other flags live in `--help`.

### 2. Interpret the result

**Exit 0**: the board exists. It opened in the browser, or the script printed
its location. If opening fails, the script prints the reason and the URL to
open manually.

**Exit 1**: the board is missing. Present the script's guidance. If the user
agrees, run `/setup` next.

### 3. Hub HTML is generated

`.scratch/index.html` comes from setup's generator. Resolve `<setup>` as the `setup` folder next to this skill, then `node <setup>/scripts/generate-hub.mjs <project-root>` (owned by `/setup`).
Visual or behavioral changes belong in that generator. Point operators at
`/setup` and its design contract.
