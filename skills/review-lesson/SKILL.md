---
name: review-lesson
description: Turn one review miss or false positive into the cheapest durable guard and prove it.
disable-model-invocation: true
argument-hint: "<PR, diff, or review comment>"
---

# Review lesson

A review that found or missed something is a _lesson_ only once a guard keeps it from repeating. `/code-review` and `pr-loop` find problems; this skill handles what follows when one escaped, was flagged wrongly, or keeps coming back. Take one lesson per run.

## Steps

1. **Classify.** Name the case: _escaped bug_ (it reached a later stage or production), _false positive_ (the reviewer flagged correct code), or _noise_ (true but not worth a comment). Capture the diff and the exact review comment, or the absence of one. Done when you can state the failure in one sentence with a file and line.
2. **Pick the home.** Take the lowest rung that would catch it, using [`references/homes.md`](references/homes.md):
   1. Test or lint rule
   2. Hook or CI check
   3. `REVIEW.md` in the target repo
   4. Skill
   5. `AGENTS.md` line

   Deterministic homes run whether or not an agent is paying attention, and a line in an always-loaded file charges every session, so climb only when the rung below cannot express the rule. Done when you can name why each lower rung fails.
3. **Write the guard** in the target repo, on a branch. Follow that repo's conventions, and leave `REVIEW.md` short.
4. **Prove it.** Done when the guard goes _red_ on the original diff and green on the fix. For a false positive or noise, done when a fresh review of that diff, with the guard in place, stays quiet there. A guard you did not see fail is unproven.

Report the classification, the home and why, and the two observed runs. Publication follows the target repo's normal path.
