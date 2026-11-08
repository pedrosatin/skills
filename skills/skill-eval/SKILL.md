---
name: skill-eval
description: Run a with/without eval on one local skill and record keep, patch, or kill.
disable-model-invocation: true
argument-hint: "<skill-name>"
---

# Skill eval

Measure what one skill adds over a bare model, then record a verdict. Reach for it on a new skill, a large edit, a new model, or doubt that a skill still earns its load.

This runs on Claude Code only: `link.sh` publishes the folder to every harness, but `claude plugin eval` exists only here. In another harness, say so and stop.

## Steps

1. **Target.** Resolve the real folder with `readlink -f ~/.agents/skills/<name>`. A folder holding `SKILL.md` is a valid target; it needs no `.claude-plugin/`. Read `claude plugin eval --help` for current flags. Done when you know the folder and every branch the skill handles.
2. **Cases.** Write one case per branch under `<skill>/evals/<case>/`, with graders that can go _red_. Outside a terminal the `init` interview cannot run, so start each case with `claude plugin eval init --bare <case>` from the skill folder. Recipes by skill type, fixtures, and grader traps are in [`references/case-recipes.md`](references/case-recipes.md). Done when every branch has a case and every case grades the result, not only that the skill fired.
3. **Pilot.** Run one case once with `--case <case> --runs 1 --ablation none`. Fix tool grants and fixtures here, while a mistake costs one run. Done when the pilot scores without a run error.
4. **Run.** From the skill folder:

   ```sh
   claude plugin eval . --no-publish --trust-plugin --scaffold \
     --runs 3 -j 2 --max-cost-usd 5 --allow-tools Write
   ```

   `--no-publish` keeps private prompts off claude.ai, which is otherwise the default. `-j 2` is the ceiling on this laptop. `--max-cost-usd 5` is the operator's ceiling per run of the suite; exit 2 means it was hit and the report is partial. Grant only the tools the cases need; a case that runs commands needs plain `Bash`, for the reason in the recipes. Pass `--scaffold` and `--trust-plugin` only for suites you wrote. Exit 1 means a case scored below `--threshold`, not that the run broke.
5. **Sabotage.** Copy the skill to `~/.cache/scratch/skill-eval-lab/<name>-sabotaged`, keep the frontmatter, replace the body with a sentence telling the agent there is nothing to check, and run the same suite with `--ablation none`. For a user-invoked skill, first change each copied prompt's prefix to `/<name>-sabotaged:<skill>`. Done when the sabotaged score falls below the real one. A case that stays green under sabotage marks a branch the model handles alone; if every case stays green, the suite proves nothing, so tighten its graders and run again.
6. **Verdict.** Write `<skill>/evals/VERDICT.md`: date, `claude --version`, model, per-case `WITH`, `W/OUT`, `Δ`, sabotage score, cost, verdict, and one line of reasoning. Done when the verdict is on disk and `git status` shows no `evals/results/`.

## Verdict

- **keep**: `Δ` is clearly positive on at least one branch, the with-arm passes, and sabotage goes red.
- **patch**: the with-arm fails a case, or `skill-fired` fails, which usually means the description misses that phrasing. Fix it and run again.
- **kill**: `Δ` is zero on every branch. The model already does this, so the skill is a no-op on this model.

With three runs per arm, read a `Δ` under 0.1 as zero, and discount a grader that matches the skill's own vocabulary: the bare model cannot pass it.

## Reading the baseline

Runs are isolated: the without-arm loads no `CLAUDE.md`, no `CONTEXT.md`, no other skill, and no hooks. `Δ` therefore compares the skill with a bare model, not with this machine's setup, so a rule that also sits in `CONTEXT.md` still shows a high `Δ`. To test that duplication, give the rule to both arms through `append_system_prompt` in the case and run again: a `Δ` that drops to zero means one of the two copies can go. When the skill's copy goes, keep the rule there, in the `prompt.md` frontmatter, or the isolated with-arm loses it. If the suite then stays green under sabotage, the remaining cases test the rule, not the skill; add a case for what only the skill holds.
