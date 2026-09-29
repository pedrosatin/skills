---
name: pr-loop
description: "Deliver backlog items with subagents: one implements in a worktree, a second reviews code and prose, a third applies corrections, and the main agent publishes the PR and merges with authorization before moving on. Use when explicitly requested through '/pr-loop', 'run the delivery loop', 'full workflow with subagents', 'roda o loop de entrega', 'fluxo completo com subagents', or 'trabalha a lista do roadmap com review e correção'. Do not invoke for a standalone PR or implementation request that does not ask for this loop and merge workflow."
---

# pr-loop

Deliver one backlog item per iteration through preparation, implementation by a subagent, code and prose review by a second subagent, corrections by a third subagent, and Git publication and merge by the main agent. Each step depends on the previous one, so the three subagents run sequentially.

The main agent alone performs pushes, rebases, force pushes, merges, and GitHub operations. Subagents write code and create local commits. The main agent has the full conversation and the operator's authorization for external actions.

## Invariants for each iteration

1. Merging requires authorization. Requesting the loop authorizes work through opening a PR. Each merge requires authorization in the conversation unless the operator approved the entire batch beforehand, for example "merge everything", "mescla tudo", or "vai até o fim".
2. Commits, PRs, and issues must have no AI attribution: no Co-authored-by, "Generated with", or model attribution. Author and committer are always the human operator; never use --author or GIT_AUTHOR/GIT_COMMITTER variables.
3. Tests and typecheck must pass before each commit. Discover the commands in step 0. If a package has no tests, the implementer adds them following the repo's conventions.
4. /tmp is volatile. A worktree may disappear between sessions; its branch must be on origin before the iteration is considered finished. Resume with `git worktree add -b <branch> /tmp/opencode/<slug> origin/<branch>`, or start from origin/main if there is no remote branch.
5. Use `gh-axi` for GitHub. Read TOON output without piping it to jq.
6. Follow the target project's language conventions for commits, PRs, docs, comments, and UI strings. Use the user's language for conversation. For PT-BR prose, apply `../unslop-br/SKILL.md`. For English prose, use an installed English writing skill such as `humanizer`; if none is available, apply the prose rules in step 4. Do not apply Portuguese vocabulary rules to other languages.
7. For checks through rtk, use `pnpm -C <pkg> <script>`. rtk does not yet forward `--filter` to `tsc`; `pnpm --filter <pkg> <script>` can run the compiler at the monorepo root, print help, and exit 1 as a false typecheck failure. A subagent interrupted by a usage limit or timeout may leave completed work uncommitted: inspect `git status` and `git diff` before starting over.

## When subagents are unavailable

If usage limits, missing subagent tools, or a persistent subagent failure prevent delegation, run steps 1 through 3 sequentially in the main conversation. Keep the same scope, checks, and attribution rules. Review the full diff, verify in the code the facts assumed by the tests (helpers, seeds, counts), and audit each quoted passage before committing. Self-review requires extra care because it lacks a fresh reader.

## Step 0, prepare the item

- Take the items from the repo roadmap (in todo-jarvis, `docs/05-roadmap.md` and `docs/06-questoes-abertas.md`) or the operator's list. Confirm the list and order before the first iteration.
- Run `git fetch origin` and create a clean worktree with `git worktree add -b feat/<slug> /tmp/opencode/<slug> origin/main`. The /tmp/opencode directory is preapproved. If a worktree remains from a previous iteration, enter it and inspect `git status` and `git log --oneline -3`.
- Discover the validation commands in each affected package.json (test, typecheck, lint). Include them in all three subagent prompts.
- Define the scope, exclusions, and completion criteria in a few sentences. An open scope makes the PR larger and harder to review.
- Establish the language for each output from the project's instructions and existing files or commit history. Pass that choice to all three subagents.

## Step 1, implementation subagent

The subagent starts without context, so its prompt must be self-contained. Use this structure:

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
Explain the mechanism in comments. Apply [writing skill selected for the
output language, or the prose rules from step 4]. Use active voice and
concrete mechanisms. Avoid decorative dashes, trailing filler clauses,
false dichotomies, inflated vocabulary, and vague verbs.

REQUIRED CHECKS before committing: [test and typecheck commands].
Fix failures.

COMMIT: one local commit with the full change; use the repo log's language
and style. No AI attribution, Co-authored-by, or --author.

FINAL REPORT: changes by file, test counts, commit hash,
and omitted work with reasons.
```

## Step 2, review subagent (read only)

One subagent reviews both code and prose. Request a verdict and findings with severity and exact locations so the correction agent can act on them.

```
Perform a READ-ONLY senior review (no edits or commits) of PR [N] /
diff [main...branch] in repository [WORKTREE].
Diff: git -C [WORKTREE] diff main...[BRANCH]. PR body: [local copy file].
Commits: git -C [WORKTREE] log main..[BRANCH].

CONTEXT: [same 2-4 lines as the implementer]

PART 1, code: correctness, security (auth, validation, ownership, CSRF,
secrets in logs), edge cases, regressions, and test coverage. Verify claims
about branch, main, and CI state in Git before relying on them.

PART 2, prose: apply [writing skill selected for the output language,
or the prose rules from step 4] to the PR body, commit messages, changed
documentation, code comments, UI strings, and test descriptions.
For PT-BR, first read ../unslop-br/SKILL.md. For English, use an installed
English writing skill such as humanizer when available.
Find decorative dashes, mechanical bold-label lists, false dichotomies,
trailing filler clauses, inflated vocabulary, pretentious verbs, metaphors,
wordy phrases, emojis, and flattery. Legitimate technical terms and normative
references (RFCs, protocol names) are acceptable. Preexisting formatting
outside the changed text is outside this review's scope.

REPORT:
## Part 1, code
- Verdict: approved / approve with changes / rejected
- Numbered findings: severity (blocking/important/minor/nit), file:line, suggestion
## Part 2, prose
- Table: exact text, location, violated rule, rewrite
- Full inventory of decorative dashes and prohibited vocabulary with locations
## Conclusion
- Ordered changes required before merge (empty if none)
```

## Step 3, correction subagent

Turn the reviewer's ordered findings into numbered instructions with file:line and the intended correction. Skip this step if the reviewer requires no changes.

```
Apply review corrections in worktree [WORKTREE], branch [BRANCH].
Do not push, rebase, or touch other repositories. Create one local commit.

[NUMBERED LIST: file:line, problem, and exact correction for each item.
For bugs, include the new test case that demonstrates the correction.]

STYLE: [same language conventions and prose rules as the implementer]

REQUIRED CHECKS before committing: [commands]. Fix failures.

COMMIT: [repo log's language and style, no AI attribution]

FINAL REPORT: changes by file, test counts, commit hash,
and unapplied items with reasons.
```

## Step 4, Git publication and merge (main agent)

Follow this order:

1. Inspect the correction commit. Its message must have no AI attribution (`git log -1 --format=%B | grep -ci 'co-authored\|generated with'` must print 0).
2. Run `git push origin <branch>`.
3. Create the PR with `gh-axi pr create --base main --head <branch> --title ... --body-file <file>`. Apply the prose rules below to its body.
4. If main already contains the feature tree from an earlier squash of the same branch, remove the duplicate history with `git rebase --onto origin/main <old-commit> <branch>`. Confirm identical trees with `git rev-parse <new>^{tree} <old>^{tree}`, then run `git push --force-with-lease`. Force push only your own unmerged branch after checking tree equality.
5. With merge authorization, run `gh-axi pr merge <N> --squash --delete-branch --subject "... (#N)" --body "..."`. Set the subject and body explicitly without AI attribution.
6. Clean up with `git pull --ff-only` in the main repo, `git worktree remove --force <worktree>`, and `git branch -D <branch>`.
7. If main deploys automatically through CI, check the merge run with `gh-axi run list`. Record migrations and secrets not covered by CI as follow-up work.

For the PR body, use plain file bullets such as "- `path`: description", sentence case headings, and colons only before lists, code, or definitions. Avoid decorative dashes, false dichotomies, trailing filler clauses, emojis, and flattery. Support claims with a mechanism, parameter, or number (test counts, hashes, RFCs). Describe what the system does. Apply vocabulary rules appropriate to the prose's language. Keep code identifiers, protocol names, and quoted source material intact.

## Step 5, next item

- Update the roadmap, open questions, and ADRs affected by the item. Include those changes in the correction commit when appropriate.
- Report the iteration briefly: scope, PR/commit, test counts, and recorded follow-ups.
- Return to step 0 for the next item.

Stop when the list ends, the operator requests a pause, or an item requires an external action you cannot perform (setting a secret, testing on a physical device, or settling an open product decision). Report the current state and follow-ups.

## Check before advancing

- Step 1 → 2: worktree has a local commit, tests pass, and the scope is delivered.
- Step 2 → 3: review conclusions have become numbered instructions with exact locations, or no changes are needed and you skip to step 4.
- Step 3 → 4: tests pass again and the commit has been checked for attribution.
- Step 4 → 5: PR merged with authorization, local main updated, worktree and branch removed, and main CI passing when present.
