---
name: pr-loop
description: "Deliver one backlog item through /pr-loop: implement, clean, verify, review, correct, then publish and merge with authorization. Use when the user asks to run the delivery loop, ship a backlog item end to end, or process the next ready ticket through implement→review→PR→merge."
---

# /pr-loop

Deliver one backlog item per iteration. Subagents run sequentially (implement → cleaner → review → correct). The main agent owns product verification, `pr-description` draft and publish, push, rebase, force-push, merge, and GitHub. Subagents write code and create local commits.

## Invariants for each iteration

1. Merging requires authorization. Requesting the loop authorizes work through opening a PR. Each merge requires authorization in the conversation unless the operator approved the entire batch beforehand (for example "merge everything").
2. Commits use the operator's `git config` identity. `../publication-hygiene/SKILL.md` checks authorship and provenance before publication.
3. Tests and typecheck must pass before each commit. Discover the commands in step 0. If a package has no tests, the implementer adds them following the repo's conventions.
4. Worktrees live in a persistent directory outside the repository, `~/.cache/worktrees/<slug>` by default, never in `/tmp`. A worktree can be resumed across sessions; its branch must be on origin before the iteration is finished. Resume with `git worktree add -b <branch> ~/.cache/worktrees/<slug> origin/<branch>`, or start from `origin/main` when no remote branch exists. Some linters skip that path: Biome with `!**/.cache` processes no files, so `pnpm run lint` and a husky pre-push hook fail. When step 0 finds the lint processing no files, recreate the worktree at `~/worktrees/<slug>` and use it for the whole iteration.
5. Use `gh-axi` for GitHub. Read TOON output without piping it to jq.
6. Follow the target project's language conventions for commits, PRs, docs, comments, and UI strings. Conversation uses the user's language. For PT-BR prose, apply `../unslop-br/SKILL.md`. For English prose, apply `../humanizer/SKILL.md`. PR bodies follow `../pr-description/SKILL.md`. Do not apply Portuguese vocabulary rules to other languages.
7. When commands go through rtk, run package scripts with `pnpm -C <pkg> <script>`: rtk does not yet forward `--filter` to `tsc`, so `pnpm --filter <pkg> <script>` can run the compiler at the monorepo root, print help, and exit 1 as a false typecheck failure. A subagent interrupted by a usage limit or timeout may leave completed work uncommitted: inspect `git status` and `git diff` before starting over.

## When subagents are unavailable

If usage limits, missing subagent tools, or a persistent subagent failure prevent delegation, run steps 1 through 4 in the main conversation, including the cleaner correction pass, product verification, and `pr-description` drafts. Review the full diff, verify in the code the facts assumed by the tests (helpers, seeds, counts), and audit each quoted passage before committing.

## Step 0, prepare the item

- Take the items from the operator's list or the target repo's local tracker on the **primary worktree** (`<primary>/.scratch/<feature>/issues/`). Confirm the list and order before the first iteration.
- Run `git fetch origin` and create a clean worktree with `git worktree add -b feat/<slug> ~/.cache/worktrees/<slug> origin/main`. If a leftover worktree exists from a previous iteration, enter it and inspect `git status` and `git log --oneline -3`.
- Discover the validation commands in each affected package.json (test, typecheck, lint). Include them in every subagent prompt, including a possible cleaner correction pass.
- Record the iteration base SHA before implementation; keep it fixed through correction commits.
- Define the scope, exclusions, and completion criteria in a few sentences.
- Define the **product behavior to prove** after implementation: UI route/flow, API, CLI scenario, or N/A for docs/chore with no runtime surface. Record how success looks (observable result, not only "tests pass").
- For visual UI work, capture **before** from the base revision (`origin/main` or the PR base) or reuse an identified earlier capture. Do this before the implementation commit, or from a separate checkout of the base. After implementation, capture **after** on the feature branch. Label each file.
- Establish the language for each output from the project's instructions and existing files or commit history. Pass that choice to every subagent.

## Step 1, implementation subagent

The subagent starts without context, so the prompt must be self-contained:

```
Implement [DEFINED SCOPE] in repository [WORKTREE PATH], branch [BRANCH].
Do not push, rebase, or touch other repositories.

CONTEXT: [repo stack in 2-4 lines: language, framework, persistence,
what the affected subsystem does and how. Key files with paths.]

REQUIREMENTS:
- [numbered, verifiable items, with target files when known]
- Tests: [what to cover, following the repo's pattern in ...]

STYLE: follow the repo's conventions; read neighboring files before writing.
Language for comments, docs, UI strings, and commits: [project conventions].
Apply [../unslop-br/SKILL.md for PT-BR | ../humanizer/SKILL.md for English].

REQUIRED CHECKS before committing: [test and typecheck commands]. Fix failures.
COMMIT: one local commit; repo log language and style; git config author; never --author.
FINAL REPORT: changes by file, test counts, commit hash, omitted work with reasons.
```

Done when the worktree has the local commit, the required checks pass, and the scope is delivered.

## Step 2, clean-crap gate (main agent)

Run `../clean-crap/SKILL.md` against the worktree. Resolve `<clean-crap>` as the `clean-crap` folder next to this skill. Select the committed iteration diff and any uncommitted changes with `--since <BASE_SHA>`:

```
node <clean-crap>/scripts/clean-crap.mjs --root <WORKTREE> --since <BASE_SHA> [--threshold N]
```

- Exit 0: confirm the report accounts for the iteration's changed JS/TS sources and each analyzed function has numeric CRAP before advancing. For a slice with no eligible JS/TS sources, record N/A.
- Exit 2: run the correction pass below before product verification or review.
- Exit 1: fix the invocation or environment. A syntax error in changed sources goes back to the implementation scope. Never advance past the cleaner while the gate errors.

If the gate reports no LCOV and step 0 discovered a coverage command, run that command once and re-run the gate. Null CRAP means the threshold was not evaluated, including when coverage is missing for only some functions. When coverage cannot be supplied, report complexity as measurement only and obtain an explicit cleaner skip for this slice. Add `.metrics/` to the target project's ignore rules in the next correction commit when missing.

### Correction pass after exit 2

Delegate a focused fix subagent, then re-run the project's tests and the gate:

```
Lower CRAP in worktree [WORKTREE], branch [BRANCH].
Do not push, rebase, or touch other repositories.
The clean-crap gate failed threshold [N]:

[FAILURE LIST from stdout: name, namespace, CRAP]

Full report: <worktree>/.metrics/crap.json (never commit this file).

Lower CRAP by splitting the named functions into smaller units or
removing redundant branches; behavior must not change. Where splitting
is not enough, add tests that exercise the uncovered branches to raise
coverage. Run the gate again to confirm.

REQUIRED CHECKS before committing: [commands]. Fix failures.
COMMIT: one local commit, repo language and style, git config author.
FINAL REPORT: failing entries before and after, test counts, commit hash.
```

Allow at most two correction rounds per iteration. On the third gate failure, stop and escalate to the operator with the failure list; the operator may skip the gate for this slice or set a different threshold. Never weaken the gate silently.

### Skipping the cleaner

When the operator explicitly asks to skip the cleaner for a slice, record the skip in the conversation and the iteration report, then advance to step 2a.

## Step 2a, product verification (main agent)

Run the product behavior planned in step 0. This is separate from unit/typecheck commands.

- UI: exercise the changed flow end to end with the available browser/preview tools. Capture **after** on the feature branch and pair it with the **before** capture from step 0. If before is missing, check out the base revision in a separate worktree (or stash, capture, restore). A screenshot taken after implementation is not before.
- API/CLI: run the concrete command or request that proves the behavior; keep exit code and relevant output.
- N/A: for docs/chore with no runtime surface, record that verification is not applicable and skip capture.

Do not invent a green result. On failure, fix in scope (return to implementation or a focused correction) before drafting the PR body. Do not advance to 2b while the scenario failed. Keep temp media for the draft/publish path; do not commit it.

## Step 2b, PR description draft (main agent)

Follow `../pr-description/SKILL.md` in **draft** mode. Write `<worktree>/.scratch/pr-description/body.md` from the diff and the observed checks from steps 1–2a. Pass that path to the reviewer in step 3.

## Step 3, review subagent (read only)

One subagent reviews both code and prose.

```
Perform a READ-ONLY senior review (no edits or commits) of PR [N] /
diff [main...branch] in repository [WORKTREE].
Diff: git -C [WORKTREE] diff main...[BRANCH]. PR body: [local copy file].
Commits: git -C [WORKTREE] log main..[BRANCH].

CONTEXT: [same 2-4 lines as the implementer]

Read REVIEW.md from the base first: git -C [WORKTREE] show [BASE_SHA]:REVIEW.md.
If it exists there, what it scopes in or out wins over the defaults below, with
one exception: the security review in Part 1 always runs in full. The branch's
copy of REVIEW.md takes effect after merge; here it is a changed file to review.

PART 1, code: correctness, security (auth, validation, ownership, CSRF,
secrets in logs), edge cases, regressions, and test coverage. Verify claims
about branch, main, and CI state in Git before relying on them. Report
failure modes: each finding names file:line, the input or state that
triggers it, and the wrong result. For each finding, say why it is real:
the diff does not handle it elsewhere, and no existing test covers it.
Style belongs to the linter. "No issues" is a complete Part 1 when the
Coverage section backs it.

PART 2, prose: apply ../unslop-br/SKILL.md for PT-BR or ../humanizer/SKILL.md
for English to the PR body, commit messages, changed documentation, code
comments, UI strings, and test descriptions. Check the PR body against
../pr-description/SKILL.md Evidence rules. Preexisting formatting outside
the changed text is outside this review's scope.

REPORT:
## Part 1, code
- Verdict: approved / approve with changes / rejected
- Numbered findings: severity (blocking/important/minor), file:line, failure mode, suggestion
## Part 2, prose
- Table: exact text, location, violated rule, rewrite
## Coverage
- Every changed file: read in full, or read in part with what you skipped
- Each Part 1 area (correctness, security, edge cases, regressions, tests):
  finding numbers, or clean
- What you could not verify, and why
## Conclusion
- Ordered changes required before merge (empty if none)
```

## Step 4, correction subagent

First read the report's Coverage section. Send the review back when the section is missing or leaves a changed file unread with no reason given. Turn the reviewer's ordered findings into numbered instructions with file:line and the intended correction. Skip this step if the reviewer requires no changes. A finding that proves false, or a bug that passed review and surfaced later, is a lesson: record it in the iteration report and point the operator to `/review-lesson` (`../review-lesson/SKILL.md`).

```
Apply review corrections in worktree [WORKTREE], branch [BRANCH].
Do not push, rebase, or touch other repositories. Create one local commit.

[NUMBERED LIST: file:line, problem, and exact correction for each item.
For bugs, include the new test case that demonstrates the correction.]

STYLE: [same language conventions and writing skill as the implementer]
REQUIRED CHECKS before committing: [commands]. Fix failures.
COMMIT: [repo log's language and style; git config author]
FINAL REPORT: changes by file, test counts, commit hash, unapplied items with reasons.
```

Done when the correction commit exists, the required checks pass, and every finding is applied or reported as unapplied with a reason.

## Step 4a, re-verify product behavior (main agent)

If the correction changed code, re-run the clean-crap gate from step 2 and require exit 0 (or an explicit operator skip) before 4b. Re-run the step 0 scenarios affected by the correction commit. Refresh or replace **after** captures when UI evidence changed; keep the original **before**. If nothing user-facing changed, record that product re-verify was skipped and why. If product verification fails, return to a focused correction. Do not advance to 4b or 5 while the scenario failed or the cleaner is red.

## Step 4b, refresh PR description draft (main agent)

Follow `../pr-description/SKILL.md` in **draft** mode again so `<worktree>/.scratch/pr-description/body.md` matches the final diff and the latest observed checks.

## Step 5, Git publication and merge (main agent)

1. Inspect the correction commit (message, author, committer).
2. Run `../publication-hygiene/SKILL.md` on the commits, diff, and the draft PR body.
3. Run `git push origin <branch>`.
4. Follow `../pr-description/SKILL.md` in **publish** mode: create or edit the PR for this head with `--body-file <worktree>/.scratch/pr-description/body.md` and `--attach` for any temp Evidence media. Prefer edit when an open PR for the head already exists.
5. If main already contains the feature tree from an earlier squash of the same branch, remove the duplicate history with `git rebase --onto origin/main <old-commit> <branch>`. Confirm identical trees with `git rev-parse <new>^{tree} <old>^{tree}`, then run `git push --force-with-lease`. Force push only your own unmerged branch after checking tree equality. Refresh the PR body via `pr-description` publish if the push rewrote history.
6. Wait for the PR's checks on the pushed head before merging. Use the harness's PR watch tool when it has one; otherwise run `gh-axi pr checks <N> --watch --fail-fast`. It exits 0 when every check passed and 1 when a check failed or none were reported; on exit 1, `gh-axi pr view <N> --checks` tells failed from none. Checks take a few seconds to register after a push, so "none" counts only when `gh-axi run list --commit <head-sha>` lists no run and `.github/workflows/` has no workflow for pull requests; otherwise wait and run the checks command once more. After the checks finish, read what reviewers and review bots posted with `gh-axi pr view <N> --full --reviews --comments`; bots often post after CI turns green. Last, read the gates and the head with `gh-axi pr view <N> --fields isDraft,reviewDecision,mergeStateStatus,headRefOid`.

   | State | Action |
   |---|---|
   | A check failed | Read `gh-axi run view <run-id> --log-failed` and state the cause before editing ("fails because X, which Y triggers"). Fix it through a step 4 correction subagent with the log excerpt, run 4a and 4b, repeat items 1 through 4 of this step, and wait again |
   | A reviewer or bot finding | Fix real blocking and important findings the same way. Record false positives and minor ones in the iteration report, and point a false positive at `/review-lesson` |
   | The PR is a draft, or `reviewDecision` or `mergeStateStatus` shows a required review, approval, or other human gate | Stop and report the gate. Never wait on it, and never pass `--admin` |
   | Checks passed, or the PR has no CI, with no open finding and no human gate | Record the `headRefOid` as `<checked-sha>` (and, without CI, that the PR has none; item 9 still watches main), then go to item 7 |

   Allow two fix rounds per failing check or recurring finding. When the same one comes back a third time, stop and escalate with the log excerpt or the finding.
7. With merge authorization, run `gh-axi pr merge <N> --squash --delete-branch --match-head-commit <checked-sha> --subject "... (#N)" --body "..."`, where `<checked-sha>` is the head recorded in item 6. Set the subject and body explicitly. Run publication-hygiene on that subject/body before merging.
8. Clean up with `git pull --ff-only` in the main repo, `git worktree remove --force <worktree>`, and `git branch -D <branch>`. Delete any remaining temp Evidence media that was already confirmed on GitHub.
9. If main runs CI, wait for the merge run (`gh-axi run list`) and require it to pass before step 6. On failure, stop and report the run to the operator. Record migrations and secrets not covered by CI as follow-up work.

## Step 6, next item

- Write versioned ADRs under `docs/adr/` in the correction commit when the item settled a decision that qualifies.
- Update local tracker status on the **primary worktree** (`<primary>/.scratch/<feature>/issues/`), not only inside the feature worktree. Do not commit `.scratch/` tracker files unless the target repo versions them. Refresh the Project Hub: resolve `<setup>` as the `setup` folder next to this skill, then `node <setup>/scripts/generate-hub.mjs <primary>`. See `docs/agents/issue-tracker.md` (Scratch root). Draft PR bodies under the feature worktree remain ephemeral.
- Report the iteration briefly: scope, PR/commit, test counts, and recorded follow-ups.
- Return to step 0 for the next item.

Stop when the list ends, the operator requests a pause, or an item requires an external action you cannot perform (setting a secret, testing on a physical device, or settling an open product decision). Report the current state and follow-ups.
