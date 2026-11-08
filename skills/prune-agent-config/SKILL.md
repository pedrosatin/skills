---
name: prune-agent-config
description: Periodic pass that prunes instruction files and skills across harnesses, proving each cut.
disable-model-invocation: true
---

# Prune agent config

Cut what no longer earns its load from the instruction files and skills, without breaking a harness that still needs it. Run it after a new model, monthly, or when `/context` looks swollen. The concepts (no-op, sediment, duplication, cache, single source of truth) are defined under Pruning in `../writing-for-agents/SKILL.md`; read that section first.

Step 2's audit and every `/` command below are Claude Code only. In another harness, run the rest and mark them as skipped.

## Steps

1. **Inventory.** Run `../validate-agent-config/SKILL.md` and fix its errors first. Measure instruction load with `claude -p "/context" --no-session-persistence` from the home directory and from one project per Claude Code config directory, keeping each `Memory Files` table. In one message, ask the operator for what only they can run: `/skill-doctor`, and `/skills` then `t`. Done when each instruction file has a token count and each skill has a usage and a cost, or a recorded gap.
2. **Findings.** Invoke the `claude-api` skill with the argument `prompt-audit <path>` for each file to audit, starting with the shared rules file that harness entry points link to or import (for example `~/AGENTS.md`). This is the agent's route to `/doctor prompt-audit`; without a named path it covers only the working directory and leaves user configuration out. Expect about $1 per file. Then read each harness file and the always-loaded skill descriptions sentence by sentence, hunting no-ops, sediment, duplication, and caches. Done when every sentence of the shared rules file has been judged.
3. **Route by reach.** Send each finding to the narrowest home that serves every reader:
   - The shared rules file reaches every harness that links to or imports it. The audit judges only the session's model, so its no-op verdict is one vote: keep a shared line while any of those harnesses still needs it, or move it to the harness files that do.
   - A line one harness needs moves to that harness's file.
   - A line one workflow needs moves into that skill.
   - A managed block, such as one a tool writes between start and end markers, changes at its source; a local edit dies on the next refresh. Record it as a request to the owner.
4. **Cut.** Copy each file to a dated backup directory outside every repository first, then edit. Skills live in their source repository: resolve the symlink before editing. A skill cut or removal needs a `../skill-eval/SKILL.md` verdict; an instruction line needs a run of the behavior it guards, or a stated reason why none is possible.
5. **Report.** Repeat the step 1 measurements and rerun the validator. Report a table of finding, action (cut, moved, kept), reason, and tokens before and after.

Done when every finding is cut, moved, or kept with a reason, every skill cut has a verdict, and the validator ends `CLEAN` or with warnings you can justify.
