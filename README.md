# skills

Agent skills for Claude Code, OpenCode, Codex, Gemini, Cursor, and other agents
used in my projects. They cover writing in Brazilian Portuguese, publication
hygiene, the grill → spec → tickets → PR workflow, and architecture diagrams.

Criado por [@pedrosatin](https://github.com/pedrosatin)

Each folder in `skills/` is self-contained (`SKILL.md` and supporting files).

## Language conventions

Skill instructions, descriptions, internal prompts, supporting documentation,
and code comments are in English. `unslop-br` stays entirely in Brazilian
Portuguese because its rules and examples target PT-BR writing.

Conversation follows the user's language. Generated prose follows the target
project's language conventions. Portuguese trigger examples, quoted sources,
proper names, and localization catalogs retain their original language.
The Project Hub interface currently uses Portuguese; its labels are maintained
separately from the skill instructions.

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
It skips existing directories and links pointing outside the repo, with a
warning. The script is idempotent and removes broken links pointing to the repo
or `~/.agents/skills`. Run it again after each `git pull`.

OpenCode reads `~/.agents/skills` directly. Claude Code, Codex, and Gemini read
from their respective skill roots via the created symlinks.

## Contents

Original skills:

- `unslop-br`: removes AI writing patterns in PT-BR.
- `publication-hygiene`: checks commits and PRs for agent provenance before publication.
- `babysit-prs`: reviews and merges open PRs.
- `pr-loop`: delivers backlog items with implementation, review, and corrections by subagents.
- `validate-agent-config`: validates instruction entry points and skill configuration consistency.
- `setup`: initializes local specs, tickets, and the HTML Project Hub.
- `board`: opens `.scratch/index.html` and points to `/setup` when the board is missing.

Vendored skills and tools (see `ATTRIBUTION.md`):

- `graphify`: knowledge graphs and codebase navigation, from Graphify-Labs, Apache-2.0.
- `archify`: interactive HTML/SVG architecture diagrams, from tt-a1i.
- `grilling`, `to-spec`, `to-tickets`, `research`, `teach`: Matt Pocock's planning and learning workflow.
- `humanizer`: prose editing, from Siqi Chen.

## Contributing

To contribute a skill or report a bug, [open an issue](https://github.com/pedrosatin/skills/issues)
with a description of the proposed change or the observed behavior.
