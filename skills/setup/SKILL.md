---
name: setup
description: "Initialize a project for local specs, tickets, knowledge graph, and architecture. Scaffolds .scratch/ issue tracking, domain docs, updates AGENTS.md, checks graphify, and generates the interactive HTML Project Hub dashboard."
disable-model-invocation: true
---

# /setup (and /init)

Configure the repository for the full local software engineering workflow:
- **Specs & tickets**: local tracking in `.scratch/` for direct use with `/to-spec` and `/to-tickets`.
- **Domain docs**: a single-context convention in `docs/agents/` and ADRs in `docs/adr/`.
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
  Single-context convention (`docs/adr/`). See `docs/agents/domain.md`.
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

Run the skill's script:
```bash
node scripts/generate-hub.mjs
```
Or use `node ~/.agents/skills/setup/scripts/generate-hub.mjs <repository-path>`.

If the user supplied the `--docs` flag, use:
```bash
node scripts/generate-hub.mjs --docs
```

This script generates and regenerates `.scratch/index.html`. Do not edit the HTML file by hand. Make fixes and visual improvements in the `setup` skill's generator.

#### Fixture and structural smoke check

To validate the generator independently of the user's `.scratch` directory, use the `fixtures/minimal-scratch/` tree, which contains a sample spec and tickets, and the `--fixture` flag:

```bash
node scripts/generate-hub.mjs --fixture
```

Behavior:
- Collects tickets and specs only from the skill's fixture (`fixtures/minimal-scratch/`), ignoring the positional path and the current directory's `.scratch`.
- Writes the test HTML to `fixtures/hub-fixture.html`, beside the fixture and relative to the skill.
- Runs a structural smoke check on the generated HTML and exits with a nonzero code on failure. Checks:
  - presence of the Markdown body (`.md-body`);
  - side panel markers (`side-panel` and `role="dialog"`);
  - absence of `<iframe`;
  - presence of `--accent: #22c55e`, the default for a fixture without a brand;
  - presence of `--accent-fg` and `project-hub-theme-source=default`;
  - absence of the brand indigo `--primary: #6366f1`;
  - presence of `contentHtml` in the JSON payload;
  - inference helper checks (`light-dark`, rejection of near-black colors).
- On success: exits with code 0 and logs the HTML path.

Existing flags (`--docs`, `--open`, and the positional repository path) behave as before when `--fixture` is absent.

### Project Hub design contract

Before changing the generator or the hub's appearance, read `templates/hub-design-contract.md`.

The screen supports scanning the Kanban board, reading formatted Markdown (tickets, specs, rules, and GRAPH_REPORT), and copying a ticket dispatch prompt. The artifact is a single offline file with no CDN dependencies, regenerated idempotently from the Markdown in `.scratch/`. Tickets, specs, rules, and the graph report appear as formatted documents. Details open in a side panel on the right. Use neutral zinc/slate colors with a green accent by default. The generator infers the project's brand color from CSS variables, theme-color, or Tailwind when the evidence is reliable. Reject generic LLM indigo/purple defaults, emoji in interface labels, lift or theatrical shadows on hover, and excessive rounded corners or pills as a visual identity.

### 5. Finish and explain the workflow

Present a clickable dashboard link in the terminal:
`file://<absolute-path>/.scratch/index.html`

Explain the integrated workflow to the user:
- **/to-spec**: create conversational specifications directly in `.scratch/<feature>/spec.md`.
- **/to-tickets**: split specs into vertical slices (*tracer bullets*) in `.scratch/<feature>/issues/<NN>-<slug>.md`.
- Both commands automatically update the project dashboard when they finish.
