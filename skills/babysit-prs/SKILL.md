---
name: babysit-prs
description: Review open PRs in the current repository, merge the safe ones, and leave a draft comment on the rest.
disable-model-invocation: true
---

# /babysit-prs

Review every open PR in the current repository. Merge what is safe. Flag what is not. Never guess. Never merge with doubts.

Use `gh-axi` for GitHub. Read TOON output without piping it to jq.

## Workflow

### 1. List all open PRs

```bash
gh-axi pr list --state open
```

Raise `--limit` when the count line shows a truncated page. If no open PRs, report and stop.

### 2. For each PR, fetch the diff and context

```bash
gh-axi pr diff <number> --full
gh-axi pr view <number> --full --comments
gh-axi api /repos/{owner}/{repo}/pulls/<number>
```

`--full` keeps the complete diff and body; the default truncates. `pr view` supplies title, body, draft, author, and comments. `pr list` and `pr view` omit mergeability and git refs; the REST pull object supplies `mergeable`, `mergeable_state`, `head.ref`, `head.sha`, and `base.ref`. Record the reviewed head SHA. Treat `mergeable: false` or `mergeable_state: dirty` as conflicting. If `mergeable` is null, GitHub has not computed it yet: retry once, and skip merge while it stays null.

### 3. Cross-PR conflict detection

Before reviewing individually, scan all diffs together for:
- **Duplicate changes**: two PRs touching the same lines with the same intent → flag the older one as superseded
- **Conflicting changes**: two PRs modifying the same file in incompatible ways → flag both, explain which to keep
- **Sequential dependencies**: PR A must merge before PR B can be valid (e.g., B adds tests for a function A removes)

### 4. Review criteria: MERGE only if ALL true

- No bugs introduced (logic errors, off-by-one, null dereference, broken control flow)
- No security regressions (XSS, injection, auth bypass, exposed secrets, weakened sandbox)
- No breaking API/type changes without migration path
- No dead code added or critical code removed without clear justification
- Not superseded by another PR in this batch
- Not a major version dependency bump (requires manual test before merge)
- REST `mergeable` is true and `mergeable_state` is `clean`

When in doubt → **do not merge**. Leave draft + comment.

### 5. Resolve conflicts before merging

For every PR you intend to merge, first attempt `gh-axi pr update-branch <number>`.

After any branch update or conflict resolution, fetch the resulting head SHA, inspect the new diff, and run the target project's required checks against that head. Repeat the review criteria for the updated diff; record the verified SHA. If checks fail or cannot be run, leave the PR unmerged with the specific blocker.

If `update-branch` fails with conflicts → **attempt to resolve them yourself** before giving up:

```bash
git fetch origin
git checkout -b local-pr-<N> origin/<head.ref>
git merge origin/<base.ref> --no-edit
# inspect conflicting files, resolve, then:
git add <resolved-files>
git merge --continue
git push origin local-pr-<N>:<head.ref>
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

Run `../publication-hygiene/SKILL.md` on squash `--subject` and `--body`, and on any comment body, before calling GitHub.

**To merge a verified PR:**

Re-read the REST pull object immediately before merging: require `head.sha` to equal the verified SHA and mergeability to satisfy step 4. If the SHA changed, return to review and checks. For a draft, mark it ready first; for an already-ready PR, omit `pr ready`. The merge command binds the action to the verified head:

```bash
gh-axi pr ready <number>
gh-axi pr merge <number> --match-head-commit <verified-sha> --squash --subject "<type>(<scope>): <short description>" --body "<body>"
```

Never pass `--admin`. Merge only what GitHub already lets merge normally (`mergeable_state` is `clean`). If the merge is refused by branch protection — required reviews, required checks not yet green, or an unmet gate — leave the PR as-is and comment that it's ready but blocked on `<the specific gate>`, for the author to merge.

Commit subject format: Conventional Commits (`fix:`, `feat:`, `chore:`, `perf:`, `test:`, `refactor:`). Keep ≤72 chars. Set `--subject` and `--body` explicitly from the PR.

**To leave a PR as draft with comment** (already draft):

```bash
gh-axi pr comment <number> --body "<explanation>"
```

**To convert a non-draft PR to draft:** `gh-axi pr ready` has no `--undo`. Convert with GitHub's `convertPullRequestToDraft` mutation, then comment. Default `gh-axi api` output drops `node_id`; pass `--full` to keep it.

```bash
gh-axi api /repos/{owner}/{repo}/pulls/<number> --full
gh-axi api POST graphql --raw-field query='mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){pullRequest{isDraft}}}' --raw-field variables='{"id":"<node_id>"}'
gh-axi pr comment <number> --body "<explanation>"
```

**To close a PR you are leaving as draft+comment** (superseded / duplicate / no-op only):

```bash
gh-axi pr close <number>
```

Only close if BOTH:
- the PR's author is the authenticated user (read `login` from `gh-axi api /user`) or a bot acting on their behalf (e.g. `jules[bot]`) — never close a PR authored by someone else
- the reason is superseded-by-merged-PR, duplicate-in-batch, or no-op (analysis/doc only, zero diff) — i.e. reasons where reopening later has no cost

Do NOT close PRs flagged for author-judgment conflicts, ambiguous intent, or "needs manual test" — those need the author's eyes, not deletion. Do NOT force-push. Do NOT rebase branches.

### 7. Report

After processing all PRs, output a summary table:

| PR | Title | Action | Reason |
|----|-------|--------|--------|
| #N | title | ✅ Merged / 🗑️ Closed+comment / ⚠️ Draft+comment / ⏭️ Skipped | one line |

---

## Decision guide

Cases the merge criteria do not already cover:

| Situation | Action |
|-----------|--------|
| Duplicate of an already-merged PR | Comment naming the merged PR; close if own |
| Adds tests for a file another PR removes | Comment about the conflict; leave as draft (do not close) |
| No code changes (analysis/doc only PR) | Comment explaining it's a no-op; close if own |

---

## Notes

- **Language**: comment in the same language as the PR body (PT-BR or EN)
- **One pass**: process all PRs in one session. Cross-check duplicates before acting on any individual PR.
- **Idempotent**: if a PR already has a comment from a previous run of this skill, don't duplicate it — check existing comments first with `gh-axi pr view <number> --comments`.
