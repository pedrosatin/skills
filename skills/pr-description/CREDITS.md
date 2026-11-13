# Credits

`pr-description` adapts the PR-body evidence pattern from Matt Pocock's
[`pr` skill](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/pr/SKILL.md)
(MIT © 2026 Matt Pocock), pinned at `49dd158d1076134a641b33efb035946536778336`.

That upstream skill credits Dex Horthy / HumanLayer's
[`show-me`](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)
(MIT © 2026 HumanLayer) for the visual-summary menu. This package points at the
local `show-me` skill for visuals instead of vendoring that menu verbatim.

The cover-note framing, the Summary sizing table, the title rules, and the
refresh rule are rewritten from ideas in Sentry's
[`pr-writer`](https://github.com/getsentry/skills/tree/e94f222/skills/pr-writer)
(Apache-2.0); no text was copied.

Local additions: draft vs publish modes, `gh-axi` create/edit with idempotent
head lookup, GitHub-only media via `--attach`, failure taxonomy for
execution/capture/upload, and contracts with `pr-loop` and `publication-hygiene`.

These notices document third-party source lineage for the skill package. They
must not appear as authorship footers in generated pull requests or commits.
