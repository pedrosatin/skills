---
name: board
description: "Open the project board (Project Hub at .scratch/index.html) in the default browser. When .scratch/ or index.html is missing, explain how /setup and /to-spec + /to-tickets create and populate the board."
disable-model-invocation: true
---

# /board

Open the project's Project Hub: the `index.html` generated inside `.scratch/`.

## Process

### 1. Run the script

From this skill directory: `node scripts/board.mjs`. From elsewhere, resolve `<board>` as the `board` folder next to this skill: `node <board>/scripts/board.mjs`. Flags live in `--help`.

### 2. Interpret the result

**Exit 0**: the board exists. It opened in the browser, or the script printed
its location. If opening fails, the script prints the reason and the URL to
open manually.

**Exit 1**: the board is missing. Present the script's guidance. If the user
agrees, run `/setup` next.

### 3. Hub HTML is generated

`.scratch/index.html` comes from setup's generator
(`node ../setup/scripts/generate-hub.mjs`, owned by `/setup`).
Visual or behavioral changes belong in that generator. Point operators at
`/setup` and its design contract.