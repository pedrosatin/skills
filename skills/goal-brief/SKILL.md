---
name: goal-brief
description: Turn a vague task into one prompt with a goal and a check that is red today.
disable-model-invocation: true
argument-hint: "<task>"
---

# Goal brief

A long unattended run keeps going only while it has something to fail. Find that check in the repo, prove it fails now, and hand the operator one prompt built around it. Reach for it before `/goal`, `claude --cloud`, or a long session nobody will watch.

This skill is on probation. It overlaps `grilling` (what to build) and `to-spec` (the written record), and it stays only if `../skill-eval/SKILL.md` shows a gain over a plain prompt. Read `evals/VERDICT.md` for the current verdict. When the goal is still uncertain, stop and point to `/grilling`; when a spec exists, take its verification section as the check.

## Steps

1. **Find the check.** Read the repo for the runnable check that decides this task: a test, a build, a metric, or a scripted drive. Done when you have one command with an observable pass or fail.
2. **Turn it red.** Run it on the current state and confirm it fails for the reason the task names. If no check exists, write it first, failing, and name the file. A check that is green today cannot steer anything; record the command, exit code, and failure line.
3. **Write the prompt.** Emit one fenced block:

   ```
   Goal: <the outcome, one sentence>
   Check: <command>, red now with <failure line>
   Constraints: <only what the code cannot show>
   Report: the command and its output showing the check green
   ```

Done when the operator can paste the prompt into a new session, `/goal`, or `claude --cloud` with no further context. Run nothing beyond the check: the implementation belongs to that session.
