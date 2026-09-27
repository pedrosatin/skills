---
name: babysit-prs
description: "COMMAND-ONLY skill: run ONLY when the user explicitly types /babysit-prs. Reviews all open PRs in the current repo, merges safe ones, leaves draft+comment on risky ones. Do NOT load this skill contextually for PR review requests without the /babysit-prs command — a plain 'review these PRs' ask means review and report only, with no merges."
trigger: /babysit-prs
disable-model-invocation: true
---

# /babysit-prs

Review every open PR in the current repository. Merge what is safe. Flag what is not. Never guess. Never merge with doubts.

## Workflow

### 1. List all open PRs

```bash
gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,author,mergeable,mergeStateStatus
```

If no open PRs → report and stop.

### 2. For each PR, fetch the diff

```bash
gh pr diff <number>
```

Also fetch the PR body for context:
```bash
gh pr view <number> --json title,body,mergeable,mergeStateStatus,baseRefName
```

### 3. Cross-PR conflict detection

Before reviewing individually, scan all diffs together for:
- **Duplicate changes**: two PRs touching the same lines with the same intent → flag the older one as superseded
- **Conflicting changes**: two PRs modifying the same file in incompatible ways → flag both, explain which to keep
- **Sequential dependencies**: PR A must merge before PR B can be valid (e.g., B adds tests for a function A removes)

### 4. Review criteria — MERGE only if ALL true

- No bugs introduced (logic errors, off-by-one, null dereference, broken control flow)
- No security regressions (XSS, injection, auth bypass, exposed secrets, weakened sandbox)
- No breaking API/type changes without migration path
- No dead code added or critical code removed without clear justification
- Not superseded by another PR in this batch
- Not a major version dependency bump (requires manual test before merge)
- `mergeable` is `MERGEABLE` (not `CONFLICTING`)

When in doubt → **do not merge**. Leave draft + comment.

### 5. Resolve conflicts before merging

For every PR you intend to merge, first attempt `gh pr update-branch <number>`.

If `update-branch` succeeds → proceed to merge.

If `update-branch` fails with conflicts → **attempt to resolve them yourself** before giving up:

```bash
git fetch origin
git checkout -b local-pr-<N> origin/<headRefName>
git merge origin/<baseRefName> --no-edit
# inspect conflicting files, resolve, then:
git add <resolved-files>
git merge --continue
git push origin local-pr-<N>:<headRefName>
```

Conflicts that are safe to resolve autonomously:
- **Formatting-only**: same logic, different line wrapping → take the formatter's version
- **Additive-only**: both sides add different content at the same location → keep both
- **Stale expectation**: a test expects old behavior that a merged fix changed → update the test to match the new (correct) behavior — read the current implementation first to verify
- **Delete/modify**: one side deletes a file, the other modified it → move the modified content to where it belongs, then delete

Only leave a conflict for the author when:
- The resolution requires understanding **intent** that isn't derivable from the code (e.g., two incompatible business logic changes)
- A test expectation conflicts with implementation and you can't determine which is correct without running the suite
- A security-relevant decision is unclear

### 6. Take action

**To merge a draft PR:**
```bash
gh pr ready <number>
gh pr update-branch <number>
gh pr merge <number> --squash --subject "<type>(<scope>): <short description>"
```

Never pass `--admin`. Merge only what GitHub already lets merge normally (`mergeStateStatus` is `CLEAN`). If the merge is refused by branch protection — required reviews, required checks not yet green, or an unmet gate — do not try to bypass it: leave the PR as-is and comment that it's ready but blocked on `<the specific gate>`, for the author to merge.

Commit subject format: Conventional Commits (`fix:`, `feat:`, `chore:`, `perf:`, `test:`, `refactor:`). Keep ≤72 chars.

**To leave a PR as draft with comment** (already draft):
```bash
gh pr comment <number> --body "<explanation>"
```

**To convert a non-draft PR to draft**:
```bash
gh pr ready <number> --undo
gh pr comment <number> --body "<explanation>"
```

**To close a PR you are leaving as draft+comment** (superseded / duplicate / no-op only):
```bash
gh pr close <number>
```
Only close if BOTH:
- the PR's author is the authenticated user (`gh api user --jq .login`) or a bot acting on their behalf (e.g. `jules[bot]`) — never close a PR authored by someone else
- the reason is superseded-by-merged-PR, duplicate-in-batch, or no-op (analysis/doc only, zero diff) — i.e. reasons where reopening later has no cost

Do NOT close PRs flagged for author-judgment conflicts, ambiguous intent, or "needs manual test" — those need the author's eyes, not deletion. Do NOT force-push. Do NOT rebase branches.

### 7. Report

After processing all PRs, output a summary table:

| PR | Title | Action | Reason |
|----|-------|--------|--------|
| #N | title | ✅ Merged / 🗑️ Closed+comment / ⚠️ Draft+comment / ⏭️ Skipped | one line |

---

## Decision guide (quick reference)

| Situation | Action |
|-----------|--------|
| Clean diff, no conflicts, no red flags | Merge |
| Major version dependency bump (e.g. TS 6→7) | Comment: needs manual `npm run build && npm test` |
| `CONFLICTING` mergeable status | Attempt to resolve the conflict (see §5). Only leave as draft if resolution requires author judgment |
| Duplicate of already-merged PR | Comment naming the merged PR, close if own PR |
| Superseded by another open PR in same batch | Comment naming the superseding PR, close the superseded one if own PR |
| Adds tests for a file another PR removes | Comment about the conflict, leave as draft (do not close) |
| No code changes (analysis/doc only PR) | Comment explaining it's a no-op, close if own PR |
| Security fix — verify it actually fixes and doesn't regress | Merge only if fix is clear and complete |
| Feature PR with merge conflicts | Try to resolve (see §5). Leave as draft only if intent is ambiguous |
| Any doubt whatsoever | Leave as draft with comment — never merge with doubts |

---

## Notes

- **Language**: comment in the same language as the PR body (PT-BR or EN)
- **One pass**: process all PRs in one session. Cross-check duplicates before acting on any individual PR.
- **Idempotent**: if a PR already has a comment from a previous run of this skill, don't duplicate it — check existing comments first with `gh pr view <number> --json comments`.
- **Loop mode**: this skill pairs well with `/loop` for continuous monitoring:
  ```
  /loop /babysit-prs
  ```
