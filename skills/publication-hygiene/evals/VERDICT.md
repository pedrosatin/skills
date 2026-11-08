# publication-hygiene eval verdict

Date: 2026-11-07. Claude Code 2.1.319, child session default model. 3 runs per arm, `-j 2`, `--allow-tools Write`. Costs are list-price estimates on the operator's credential.

Eval runs cannot execute `git` here, so cases grade the decision through files. Each `prompt.md` carries the `CONTEXT.md` Git section in `append_system_prompt`, so both arms see the rules the skill no longer repeats and `Δ` measures the skill on top of them.

| Case | WITH | W/OUT | Δ | Sabotaged |
|---|---|---|---|---|
| clean-pr-body | 1.00 | 1.00 | 0.00 | 1.00 |
| strip-provenance-commit | 1.00 | 1.00 | 0.00 | 1.00 |
| unstage-operational-wip | 1.00 | 1.00 | 0.00 | 1.00 |
| keep-product-ai-docs | 1.00 | 1.00 | 0.00 | 1.00 |
| wip-that-looks-like-docs | 1.00 | 0.67 | +0.33 | 0.89 |
| Suite | 1.00 | 0.93 | +0.07 | 0.98 |

Sabotaged scores come from `--ablation none`, which also scores `skill-fired`. Cost: $2.36 for the suite, $1.19 for sabotage.

**Verdict: keep, narrowed to operational WIP.** The 2026-11-06 run returned patch, with the trailer and PR rules duplicated in `CONTEXT.md` and one `unstage-operational-wip` run missing the skill. Both are applied: `CONTEXT.md` keeps the rules, this skill keeps the procedure, and the description now names commits the operator runs.

Only `wip-that-looks-like-docs` separates the arms: plans, reports, and spike notes under ordinary paths, which `CONTEXT.md` does not name. It rests on three runs per arm, and sabotage failed one of three, so read it as direction. The other four cases stay green under sabotage: they guard the rules against regression and prove nothing about the skill. The 0.67 that `unstage-operational-wip` scored in the earlier duplication arm did not repeat.

`skill-fired` passed in all 15 with-arm runs, but `CONTEXT.md` also names this skill, so that result does not isolate the description change. The remote and already-tracked branches of the skill have no case, because they need `git`.

Later SKILL.md edits (list commits with `git log --name-status --diff-merges=first-parent`, detect remote history via `git log --remotes`, author checks with `git var`, and a default rule set for machines whose global instructions hold no provenance rules) were not re-run through this suite. The table above is from the narrowed skill before those procedure fixes.
