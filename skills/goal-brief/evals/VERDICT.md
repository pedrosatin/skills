# goal-brief eval verdict

Date: 2026-11-06. Claude Code 2.1.319, child session default model. 3 runs per arm, `-j 2`, `--allow-tools Bash Write Edit`. The without-arm is a plain prompt with the same text.

| Case | WITH | W/OUT | Δ | Sabotaged |
|---|---|---|---|---|
| existing-red-check | 1.00 | 1.00 | 0.00 | 1.00 |
| no-check-yet | 1.00 | 0.67 | +0.33 | 0.67 |
| goal-still-vague | 1.00 | 0.33 | +0.67 | 0.50 |
| Suite | 1.00 | 0.67 | +0.33 | 0.72 |

Cost: $2.79 for the suite, $1.39 for sabotage.

**Verdict: keep, on probation.** In `no-check-yet`, all three with-arm runs wrote a check and saw it fail, and no without-arm or sabotaged run did. `existing-red-check` is a no-op: the model already finds and runs an existing failing test. `goal-still-vague` overstates the gain, because `points-to-grilling` matches a word the bare model cannot know; its fair signal is `no-brief-written`, which failed in one of three without-arm runs.

Not measured: whether the Verification section added to `to-spec` closes the same gap. Compare the two after a few weeks of real use, and kill this skill if it does.
