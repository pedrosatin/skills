---
name: publication-hygiene
description: Validate Git commits, pushes, and GitHub pull-request activity before publishing, removing agent provenance and operational WIP while preserving product documentation.
metadata:
  short-description: Check publication hygiene
---

# Publication hygiene

Run this mandatory gate immediately before creating or amending a commit, pushing to a remote, or creating, editing, commenting on, closing, or merging a GitHub pull request.

## Check

- Inspect the exact commit or PR title, body, trailers, branch name, staged diff, and newly added files.
- Confirm author and committer come from the operator's current `git config user.name` and `user.email`.
- Remove provenance of assistance: model, provider, agent, tool or skill names; session/task/log URLs and IDs; prompts; automatic footers; co-author trailers; checkpoint/WIP labels; and generated progress-report framing such as `What/Why/Result`.
- Keep product documentation that genuinely describes an AI feature, but rewrite it so it does not disclose the authoring workflow.
- Treat local agent configuration, session/log output, generated graphs, reports, plans, spike notes, coverage, and worktree files as unpublishable unless the operator explicitly designates them as public product material. Remove accidental additions and add a targeted `.gitignore` entry.

## Resolve findings

Correct all findings before publishing, then repeat the same inspection. Do not publish while any provenance or unintended WIP remains.

For GitHub PRs, also remove matching text from the title, body, and any new comment before submitting it. Use a factual, concise description of the change instead.

## Report

State that the gate passed and identify only the checks performed. If a finding cannot be corrected without changing product scope, stop and ask the operator.
