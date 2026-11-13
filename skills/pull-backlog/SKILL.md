---
name: pull-backlog
description: "Pull ready tickets from the backlog and deliver them through merge unprompted. Use when the user asks whether the backlog has something to pull or tickets are ready (\"tem coisa no backlog para puxarmos?\"), or to work the whole queue of ready tickets (\"continua os tickets\")."
---

# /pull-backlog

"Anything in the backlog to pull?" gets its answer as work already underway: survey the tickets, plan a queue, and drive each one through `../pr-loop/SKILL.md`, then bring local `main` and the knowledge graph up to date. Invoking this skill is the go-ahead `pr-loop` asks for: it confirms the list and order (step 0) and authorizes each merge (invariant 1). The list is every unblocked ticket, ordered by blockers.

The agent that receives the invocation is the orchestrator. Subagents write the code; the orchestrator decides, dispatches, and inspects every delivery.

A message that only asks for status (what is open, how far along) gets a report and no start.

## 1. Survey

Done when every open ticket (not `resolved`, `wontfix`, or `closed`) has one class, checked against the repo: **ready**; **ready, human step** (the code goes ahead; the step, such as a variable to set or a contact to supply, goes in the report); **needs-triage**; **blocked** (name what unblocks it); or **claimed** (another run holds it).

- Tickets live on the primary worktree (`docs/agents/issue-tracker.md`, Scratch root); a linked session worktree has no `.scratch/`. A repo with no `.scratch/` tickets gets a pointer to `/setup` and `/to-tickets`, and the run ends there.
- Read `<primary>/.scratch/STATUS.md` when present, every `<primary>/.scratch/*/issues/*.md`, and any orchestration or routing note in `.scratch/` (`orquestracao-*.md`, `agent-routing.md`). Those notes hold the operator's earlier decisions for this scope.
- Read each ticket's `Status:` and `Blocked by:` lines. `Status:` appears as `**Status:** x` and as `Status: x`; match both and list files with neither, so no ticket is skipped. `in-progress` reads as `claimed` and `closed` as `resolved`.
- The `ready-for-agent` label outlives its blockers: a ticket whose `Blocked by:` entries are not all `resolved` is blocked, however it is labelled.
- STATUS.md lags the repo. Check each candidate against `origin/main` history, open and merged PRs (`gh-axi pr list`), and live worktrees. A `claimed` ticket with an open PR or a live worktree belongs to another run; with neither it is stale and counts as ready. A ticket whose acceptance criteria `main` already meets closes as `resolved`, or as `wontfix` pointing at the PR that covered it.

## 2. Plan the run

Done when `.scratch/orquestracao-<scope>.md` on the primary worktree holds the scope, the queue table, each role with the model chosen for it, the merge policy, and the quota snapshot. An existing note for the scope is appended, not replaced ("same flow as yesterday").

- **Queue**: ready tickets in blocker order, two **slots** at a time. A ticket holds its slot from claim to merge, and its implementer, reviewer, and fixer take turns in it, so two agents run at once at most. Tickets in a slot touch disjoint areas; tickets that share a module run one after the other.
- **Roles**: one implementer subagent per ticket, in an isolated worktree, following `pr-loop` up to the open PR. One read-only reviewer from a different provider than the implementer, at most 2 rounds per PR. The orchestrator makes small corrections; a larger one goes to a subagent.
- **Routing**: the orchestrator chooses the provider and model for each task. Discover what can be launched (the harness's capabilities listing, and any quota tool the global instructions name), put the strongest available model on diagnosis, review, and hard tickets and a cheaper one on scripted or mechanical work, and re-check before each batch. The routing rules in the global instructions (forbidden models, reviewer from another provider, concurrency caps, spend priority) bind every choice. When a provider runs dry or a model fails twice on one ticket, switch and keep going.
- **Merge**: a PR merges once the reviewer approves it, its checks are green on the head, and no human gate (draft, required review) stands, per `pr-loop` steps 6 and 7. A PR still unapproved after round 2 stays open and goes in the report. The style (rebase, squash, merge commit) comes from the scope's note, then the repo's history.

## 3. Start

Done when the first slots are `claimed` on the primary, their implementers run, and the operator has the first table.

- Before every dispatch, check `git status` and `gh-axi pr list`. A run resumed after a usage limit can repeat old work in the same tree or open a duplicate PR; close the duplicate unmerged, and keep one writer per tree.
- Set `Status: claimed`, then dispatch with the `pr-loop` step 1 prompt plus the ticket path and the validation commands.
- Send the operator one message in their language: a table of what started (ticket, implementer, reviewer), what waits on a blocker, and what needs them, with the specific need per ticket.

## 4. Drain

Done when no ticket is **ready**.

- A PR opens: its reviewer runs in the same slot (`pr-loop` steps 3 to 5).
- A merge lands: run `pr-loop` step 6 and refresh `STATUS.md` when present, then survey again, because merges unblock tickets, and fill the free slot.
- Checks pending for 30 minutes with Actions healthy: close and reopen the PR to retrigger them.
- A ticket that needs a decision or an external action: mark it `blocked`, note the need, and continue with the rest.

## 5. Sync

Done when the primary checkout's `main` equals `origin/main`, every generated graph reflects that head, and the operator has the final table.

- Run `git fetch origin`, then compare `git rev-parse main origin/main` in the primary checkout. A difference gets `git pull --ff-only`. A primary on another branch, with local commits, or with uncommitted changes is left as found and reported.
- Refresh each generated graph or index the repo keeps, with the command its `AGENTS.md` names. For `graphify-out/` that is `graphify update .` from the primary root (`../graphify/SKILL.md`). Generated graphs stay out of Git, so nothing is committed.
- The final table lists ticket, PR, state (merged, open and unapproved, held by a human gate, blocked), what was not proved, and follow-ups, with the `main` SHA and whether the graph was refreshed.
