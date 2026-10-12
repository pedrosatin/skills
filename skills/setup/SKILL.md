---
name: setup
description: "Initialize a project for local specs and tickets: scaffolds .scratch/, domain docs, and AGENTS.md, checks graphify, and generates the HTML Project Hub."
disable-model-invocation: true
---

# /setup (and /init)

Configure the repository for the full local software engineering workflow:
- **Specs & tickets**: local tracking in `.scratch/` for direct use with `/to-spec` and `/to-tickets`.
- **Domain docs**: a single-context convention in `docs/agents/`, glossary in `GLOSSARY.md`, and ADRs in `docs/adr/`.
- **Knowledge graph**: integration with `graphify` to map dependencies and central nodes.
- **Project Hub**: an interactive HTML dashboard in `.scratch/index.html` with a ticket Kanban board, spec reader, rules, and graph links.

This is a conversational process: explore the environment, summarize your findings, confirm with the user, and generate the structure. Use the user's or project's language for the conversation and deliverables. Agent instruction templates are maintained in English.

## Process

### 1. Explore the project

Inspect the current repository to understand its initial state:
- **Project name**: `package.json`, `Cargo.toml`, `pyproject.toml`, or directory name.
- **Rules file**: is there an `AGENTS.md` or `CLAUDE.md` at the root? Does it already have an `## Agent skills` section?
- **Knowledge graph**: is there a `graphify-out/` directory with `graph.html`?
- **Existing specs and tickets**: are there files in `.scratch/` or `docs/specs`?
- **Graphify installation**: is the `graphify` binary available on PATH (`command -v graphify`) or through Python?

### 2. Present findings and ask

Summarize what you found and ask the questions needed before proceeding, one at a time, leading with the recommended answer. Adapt the example questions below to the user's language.

**A. Install and run Graphify:**
- If the `graphify` command is **not** installed:
  > *"Graphify is not installed in this environment. Would you like to install it with `uv tool install graphifyy` or `pip install graphifyy`? (recommended: **yes**)"*
- If `graphify-out/graph.html` does **not** exist in the repository:
  > *"Would you like to run Graphify now to map the codebase and generate the interactive graph? (recommended: **yes**)"*
  If confirmed, run `graphify .`. If the user chooses not to run it now, continue setup normally. The dashboard will indicate that the graph can be generated at any time with `/graphify`.

**B. Repository rules file:**
- Choose the file to edit:
  - If `AGENTS.md` exists, use it.
  - If `CLAUDE.md` exists, use it.
  - If neither exists, propose creating `AGENTS.md`.
- Show the user a preview of the `## Agent skills` block:
  ```markdown
  ## Agent skills

  ### Issue tracker
  Local tracking in Markdown files under `.scratch/<feature>/`.
  Interactive dashboard at `.scratch/index.html`.
  See `docs/agents/issue-tracker.md`.

  ### Domain docs
  Single-context convention (`GLOSSARY.md`, `docs/adr/`). See `docs/agents/domain.md`.
  ```
- Wait for the user's confirmation before writing.

### 3. Write configuration files

After confirmation:
1. Copy this skill's templates into the project:
   - `templates/issue-tracker.md` → `docs/agents/issue-tracker.md`
   - `templates/domain.md` → `docs/agents/domain.md`
2. Ensure the `.scratch/` directory exists at the project root.
3. Add or update the `## Agent skills` block in the chosen rules file (`AGENTS.md` or `CLAUDE.md`). Do not duplicate the section if it already exists.

### 4. Generate the Project Hub dashboard

This skill owns hub regeneration. From this skill directory:

```bash
node scripts/generate-hub.mjs [<repository-path>]
```

Sibling skills run `node ../setup/scripts/generate-hub.mjs [<repository-path>]`. Default repository is the current working directory.

If the user supplied `--docs`, pass `--docs`. Fixes and visual changes belong in this generator; regenerate `.scratch/index.html` instead of patching it.

Maintainers: `node scripts/generate-hub.mjs --fixture` smokes the generator against `fixtures/minimal-scratch/`.

### Project Hub design contract

Before changing the generator or the hub's appearance, read `templates/hub-design-contract.md`.

Operator-facing constraints: one offline file, no CDN; Kanban scan, formatted Markdown (tickets, specs, rules, GRAPH_REPORT), and a copyable dispatch prompt; details in a right-hand side panel; zinc/slate neutrals with a green accent by default, brand color inferred from CSS variables, theme-color, or Tailwind when the evidence is reliable. Generic LLM indigo/purple, emoji in interface labels, theatrical hover lift, and pill-heavy rounding stay out of the visual identity.

### 5. Finish and explain the workflow

Present a clickable dashboard link in the terminal:
`file://<absolute-path>/.scratch/index.html`

Explain the integrated workflow to the user:
- **/to-spec**: create conversational specifications directly in `.scratch/<feature>/spec.md`.
- **/to-tickets**: split specs into vertical slices (*tracer bullets*) in `.scratch/<feature>/issues/<NN>-<slug>.md`.
- Both commands automatically update the project dashboard when they finish.
