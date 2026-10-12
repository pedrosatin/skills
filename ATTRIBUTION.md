# Attribution

Original skills in this repo use MIT (see `LICENSE`). Vendored skills retain
their upstream licenses, listed below. Local adaptations are documented here
so they can be reapplied when syncing upstream updates. Update the vendored
revision when replacing a package.

| Skill | Source | Vendored revision | License |
|---|---|---|---|
| archify | [tt-a1i/archify](https://github.com/tt-a1i/archify) | `0e4949f910a8` (2026-09-28) | MIT |
| graphify | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | v0.9.71 | Apache-2.0 |
| grilling, teach, to-spec, to-tickets, research | [mattpocock/skills](https://github.com/mattpocock/skills) | `c55ee46073ed` (2026-09-18) | MIT |
| writing-for-agents | [mattpocock/skills](https://github.com/mattpocock/skills) `skills/productivity/writing-for-agents` | `321658273cb1` (2026-08-19) | MIT © 2026 Matt Pocock |
| humanizer | [blader/humanizer](https://skills.sh/blader/humanizer) (see `skills/humanizer/LICENSE`) | installed through skills.sh | MIT © 2025 Siqi Chen |
| show-me | [humanlayer/skills](https://github.com/humanlayer/skills) | `bba9d13ab34f` (2026-09-12) | MIT © 2026 HumanLayer |
| pr-description (adapted from `pr`) | [mattpocock/skills](https://github.com/mattpocock/skills) `pr` skill; visual kinds via local `show-me` / HumanLayer | `49dd158d1076` (2026-10-09) | MIT © 2026 Matt Pocock; show-me lineage MIT © 2026 HumanLayer |

## Local adaptations

`show-me` keeps its visual selection and examples in `references/visual-selection.md`, shared directly with pr-description. This local split fixes the user-only invocation dependency. It isolates temporary HTML artifacts under `.scratch/show-me/` to protect repository hygiene, supports platform openers (`open` on macOS, `xdg-open` on Linux, `start` on Windows), and integrates with `archify` for formal architecture diagrams. One English Mermaid warning: a raw Mermaid fence does not render in the operator's terminal CLI. Formal architecture diagrams follow `../archify/SKILL.md`. Do not restore a second Mermaid ban or the Portuguese "NUNCA emita blocos mermaid" line.

`pr-description` adapts Matt Pocock's `pr` body/evidence pattern into draft and publish modes with `gh-axi` create/edit, idempotent head lookup, GitHub-only `--attach` media, and an execution/capture/upload failure taxonomy. It reads the shared `show-me/references/visual-selection.md` for visuals without invoking the user-only skill. See `skills/pr-description/CREDITS.md`. Source notices stay in the skill package and must not appear as PR/commit authorship footers.

`grilling` uses each agent's native question interface instead of waiting for
prose replies, and adds a repo-only close step that writes settled terms into
`GLOSSARY.md` after shared understanding is confirmed, then confirms each
qualifying ADR through the same question UI (see `docs/agents/domain.md`).
Reapply the "Ask through the harness question UI" and "Capture domain docs at
the close" sections after syncing upstream. Point the close at
`docs/agents/domain.md` for glossary layout, vocabulary-only entries, and the
three ADR conditions; do not recopy those rules into the skill.

`to-spec` runs a domain catch-up before drafting so missing settled terms and
qualifying ADRs from the conversation are written to disk without a new
interview, even when the grilling close was skipped. Preserve that step when
syncing upstream. Point the catch-up at `docs/agents/domain.md` for glossary
and ADR rules; do not recopy those rules. Keep the English term "test
boundaries" without a duplicate Portuguese gloss.

`graphify` Step 1: when graphify is missing from PATH and `import graphify`
fails, ask the operator and wait before `uv tool install graphifyy` /
`pip install graphifyy`. Detection must not auto-install and must not fetch
the package: inspect `uv tool dir` for an already-installed interpreter; do
not run `uv tool run --from graphifyy`. English question: "Graphify is not
installed in this environment. Install it with 'uv tool install graphifyy'
or 'pip install graphifyy'?" Keep the rest of the pipeline in SKILL.md. Semantic dispatch uses a unique chunk directory and an explicit current-run path manifest; collection validates each chunk, skips failures, and aborts when more than half fail. Preserve that collector overlay.

`research` stays short and model-invoked. Overlay: primary sources; one
Markdown file; each claim cites the owning source; save path follows the
repo's notes convention, else `.scratch/research/<slug>.md`, and tell the
operator the path. Done when every claim has a primary source, the file is
written, and the path is reported.

`humanizer` description is scoped to English prose ("Rewrite AI-sounding
English prose", "editing or reviewing English prose") so it does not steal
PT-BR from `unslop-br`.

`unslop-br` (original): in PT-BR, the em-dash and parenthetical-crutch ban
holds even when humanizer is loaded (humanizer §8 otherwise allows parentheses
as a dash replacement).

Original skills (MIT, this repo): unslop-br, publication-hygiene, babysit-prs,
pr-loop, validate-agent-config, setup, board, clean-crap. `pr-description` is
original orchestration with attributed upstream body/evidence lineage (table above).

Known exception: `unslop` (EN) is absent from this repo because the local version
derives from unlicensed text (pstack/unslop, cursor/plugins).

## Follow-ups (upstream / next sync)

P2 structural splits. Do not apply them locally; they stay with upstream or
the next vendor sync. ADR 0001: vendored SKILL.md structure stays.

- graphify: move the pipeline body from SKILL.md into `references/pipeline.md`
- humanizer: move Before/After examples into `references/patterns.md`
- archify: split `references/delivery-contract.md` and
  `references/authoring-contract.md`
