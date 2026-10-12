# Credits

`pr-description` adapts the PR-body evidence pattern from Matt Pocock's
[`pr` skill](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/pr/SKILL.md)
(MIT © 2026 Matt Pocock), pinned at `49dd158d1076134a641b33efb035946536778336`.

That upstream skill credits Dex Horthy / HumanLayer's
[`show-me`](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)
(MIT © 2026 HumanLayer) for the visual-summary menu. This package points at the
local `show-me` skill for visuals instead of vendoring that menu verbatim.

Local additions: draft vs publish modes, `gh-axi` create/edit with idempotent
head lookup, GitHub-only media via `--attach`, failure taxonomy for
execution/capture/upload, and contracts with `pr-loop` and `publication-hygiene`.

These notices document third-party source lineage for the skill package. They
must not appear as authorship footers in generated pull requests or commits.
