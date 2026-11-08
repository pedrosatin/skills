# skills

Agent skills for Claude Code, OpenCode, Codex, Gemini, Cursor, and other agents
used in my projects. They cover writing in Brazilian Portuguese, publication
hygiene, the grill → spec → tickets → PR workflow, and architecture diagrams.

Criado por [@pedrosatin](https://github.com/pedrosatin)

Each folder in `skills/` is self-contained (`SKILL.md` and supporting files).

Skill text is in English, except `unslop-br`, which targets PT-BR writing and
stays in Brazilian Portuguese (`AGENTS.md` has the full convention). The
Project Hub interface is in Portuguese.

## Install

```sh
# skills.sh (installs into all configured agents)
npx skills add pedrosatin/skills

# Or create symlinks from the clone (one link per skill)
git clone https://github.com/pedrosatin/skills.git
./skills/link.sh
```

`link.sh` creates `~/.agents/skills/<name>` pointing to each folder under
`skills/`. In interactive sessions, it detects other installed harnesses
(Claude Code, Codex, Gemini) and prompts you to link them as well.
Use `./link.sh --all` to link all detected harnesses without prompting, or
`./link.sh -y` for non-interactive default mode.
A harness counts as installed when its config directory exists (`~/.claude`,
`~/.codex`, `~/.gemini`); the skill root is created when missing.
It skips existing directories and links pointing outside the repo, with a
warning. Run it from the primary checkout: it refuses to run from a linked git
worktree, because installed skills would break when the worktree is removed.
Links an earlier run made into another worktree of this repo, or into a checkout
that no longer exists, are replaced.
The script is idempotent and removes broken links pointing to the repo
or `~/.agents/skills`. Run it again after each `git pull`.

OpenCode reads `~/.agents/skills` directly. Claude Code, Codex, and Gemini read
from their respective skill roots via the created symlinks.

## Requirements

- Bash for `link.sh` and `validate-agent-config`.
- Node.js 20 or later for the bundled scripts (`setup`, `board`, `clean-crap`,
  `archify`). `clean-crap` also needs `npm ci --prefix skills/clean-crap` once.
- [`gh-axi`](https://github.com/kunchenguid/gh-axi) for the GitHub skills
  (`babysit-prs`, `pr-description`, `pr-loop`); `pr-description` attachments
  need `gh` 2.99.0 or later.
- Claude Code for `skill-eval`, which runs `claude plugin eval`.
- Optional: Graphify (`uv tool install graphifyy`) for `graphify` and the
  graph links in the Project Hub.

## Contents

Original skills:

- `unslop-br`: removes AI writing patterns in PT-BR.
- `skill-eval`: measures one skill with and without it through `claude plugin eval` and records keep, patch, or kill (Claude Code only).
- `prune-agent-config`: periodic pass that prunes instruction files and skills across harnesses, proving each cut.
- `review-lesson`: turns one review miss or false positive into the cheapest durable guard.
- `goal-brief`: turns a vague task into one prompt with a goal and a check that is red today.
- `publication-hygiene`: keeps operational WIP out of commits and PRs and applies the provenance rules before publication.
- `pr-description`: drafts a local PR body from observed validation, or creates/edits the remote PR with evidence attachments (adapted from Matt Pocock's `pr`; see `ATTRIBUTION.md`).
- `babysit-prs`: reviews and merges open PRs.
- `pr-loop`: delivers backlog items with implementation, product verification, review, and corrections by subagents.
- `clean-crap`: gates delivery on a CRAP threshold (cyclomatic complexity joined with LCOV coverage) via a bundled JS/TS CLI.
- `validate-agent-config`: validates instruction entry points and skill configuration consistency.
- `setup`: initializes local specs, tickets, and the HTML Project Hub.
- `board`: opens `.scratch/index.html` and points to `/setup` when the board is missing.

Vendored skills and tools (see `ATTRIBUTION.md`):

- `graphify`: knowledge graphs and codebase navigation, from Graphify-Labs, Apache-2.0.
- `archify`: interactive HTML/SVG architecture diagrams, from tt-a1i.
- `grilling`, `to-spec`, `to-tickets`, `research`, `teach`: Matt Pocock's planning and learning workflow (local adaptations: harness question UI; grilling close + to-spec catch-up for `GLOSSARY.md` / ADRs; see `ATTRIBUTION.md`).
- `writing-for-agents`: rubric for documents an agent consumes (skills, `AGENTS.md`, `CLAUDE.md`), from Matt Pocock.
- `humanizer`: prose editing, from Siqi Chen.
- `show-me`: concise visual sketches for conversation and PR summaries, from HumanLayer (local path and opener adaptations; see `ATTRIBUTION.md`).
- `mobile-native`, `break-ui`: make mobile web apps feel native and stress-test UI with worst-case data, from Emil Kowalski (shorter descriptions; see `ATTRIBUTION.md`).

## Contributing

To contribute a skill or report a bug, [open an issue](https://github.com/pedrosatin/skills/issues)
with a description of the proposed change or the observed behavior.
