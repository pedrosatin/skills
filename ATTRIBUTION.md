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
| humanizer | [blader/humanizer](https://skills.sh/blader/humanizer) (see `skills/humanizer/LICENSE`) | installed through skills.sh | MIT © 2025 Siqi Chen |

## Local adaptations

`grilling` uses each agent's native question interface instead of waiting for
prose replies. Reapply the "Ask through the harness question UI" section after
syncing upstream.

`graphify` has a local installation-confirmation comment; its instruction and
example question are in English. `to-spec` uses the English term "test boundaries"
without a duplicate Portuguese gloss. Preserve these edits when syncing upstream.

Original skills (MIT, this repo): unslop-br, publication-hygiene, babysit-prs,
pr-loop, validate-agent-config, setup, board.

Known exception: `unslop` (EN) is absent from this repo because the local version
derives from unlicensed text (pstack/unslop, cursor/plugins).
