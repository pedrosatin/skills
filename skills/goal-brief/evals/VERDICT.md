# goal-brief eval verdict

Date: 2026-11-07. Claude Code 2.1.319, child session default model. 3 runs per arm, `-j 2`, `--allow-tools Bash Write Edit`. The without-arm is a plain prompt with the same text.

| Case | WITH | W/OUT | Δ | Sabotaged |
|---|---|---|---|---|
| existing-red-check | 1.00 | 0.94 | +0.06 | 1.00 |
| no-check-yet | 1.00 | 0.72 | +0.28 | 0.83 |
| goal-still-vague | 1.00 | 0.33 | +0.67 | 0.33 |
| Suite | 1.00 | 0.66 | +0.34 | 0.72 |

Cost: $2.80 for the suite, $1.92 to rerun the two `*-check*` cases after a grader fix, $1.48 for sabotage. Those two rows come from the rerun. Sabotage ran before that fix, which only widened `no-bash-edit`.

Graders changed on 2026-11-07, so these scores do not compare directly with the first run. `source-untouched` now matches the whole source file, and a forced `Write` turned it red. `no-bash-edit` catches attempts through `Bash`, which cannot change the workspace inside a run; a forced `echo >>` and `sed -i` turned it red. `brief-records-red` no longer matches `required` or `ignored`, and it failed two of three without-arm briefs in `no-check-yet`.

**Verdict: keep, on probation.** In `no-check-yet`, all three with-arm runs wrote a check and saw it fail, and no without-arm or sabotaged run did. `existing-red-check` is a no-op: its `Δ` is under 0.1, because the model already finds and runs an existing failing test. `goal-still-vague` overstates the gain, because `points-to-grilling` matches a word the bare model cannot know; its fair signal is `no-brief-written`, which failed in one of three runs of the without-arm and of sabotage.

Not measured: whether the Verification section added to `to-spec` closes the same gap. Compare the two after a few weeks of real use, and kill this skill if it does.
