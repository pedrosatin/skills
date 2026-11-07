# publication-hygiene eval verdict

Date: 2026-11-06. Claude Code 2.1.319, child session default model. 3 runs per arm, `-j 2`, `--allow-tools Write`. Costs are list-price estimates on the operator's credential.

Eval runs cannot execute `git` here, so cases grade the decision through files.

| Case | WITH | W/OUT | Δ | Sabotaged | W/OUT with the `CONTEXT.md` Git section |
|---|---|---|---|---|---|
| clean-pr-body | 1.00 | 0.56 | +0.44 | 0.50 | 1.00 |
| strip-provenance-commit | 1.00 | 0.78 | +0.22 | 0.33 | 1.00 |
| unstage-operational-wip | 0.83 | 0.50 | +0.33 | 0.33 | 0.67 |
| keep-product-ai-docs | 1.00 | 1.00 | 0.00 | 0.67 | 1.00 |
| Suite | 0.96 | 0.71 | +0.25 | 0.46 | 0.92 |

Sabotaged scores come from `--ablation none`, which also scores `skill-fired`. Cost: $1.96 for the suite, $0.96 for sabotage, $1.88 for the `CONTEXT.md` arm.

**Verdict: patch.** The skill beats a bare model on three branches and sabotage goes red, but one `unstage-operational-wip` run missed the skill, and that run is the only with-arm failure.

The duplication arm matters more than the headline `Δ`. Once the `CONTEXT.md` Git section is in the prompt, the bare model passes the trailer and PR branches, so those rules exist twice. Operational WIP is the branch the skill adds: its without-arm stays at 0.67, on three runs per arm. `keep-product-ai-docs` is an over-trigger guard, so its zero `Δ` is expected.

Open: tighten the description for the case where the operator runs the commit, and decide which copy of the provenance rules stays. Neither is applied.
