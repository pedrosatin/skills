---
name: publication-hygiene
description: Keep operational WIP out of Git and apply the provenance rules at publication. Use when committing, including when choosing the paths or message for a commit the operator will run; pushing; or creating, editing, commenting on, or merging a GitHub pull request.
metadata:
  short-description: Check publication hygiene
---

# Publication hygiene

Run this gate immediately before creating or amending a commit, pushing to a remote, or creating, editing, commenting on, closing, or merging a GitHub pull request. When the operator will run the commit, the gate still applies: its result is the path list or message you hand them.

## Operational WIP

List every path going out. Before a commit: `git diff --cached --name-status`. Before a push or PR: `git log --format='%h%n%B' --name-status --diff-merges=first-parent <base>..HEAD` — the three-dot diff only shows the branch tip balance and misses WIP that entered then left a middle commit, while the push publishes every commit; without `--diff-merges=first-parent`, merge commits hide their paths. When the operator supplies the paths, use that list. Done when each path is classified as the change or as operational WIP.

Operational WIP records the work instead of being the work: local agent configuration, session and agent logs, plans, reports, spike notes, `.scratch/`, generated graphs such as `graphify-out/`, coverage, and worktree files. It stays unpublished unless the operator explicitly designates it public product material.

For each operational path, check remotes first: `git fetch` (or rely on a recent fetch), then `git log --remotes --oneline -- <path>`. A non-empty result means the path already appears in some remote history (base tip, PR branch tip, or an older commit that left the tip). Stop and ask the operator before any unstage, delete, or rewrite: a later commit leaves it in history, and a force-push leaves it reachable by SHA.

Otherwise:

- **Staged and not yet in HEAD:** unstage with `git restore --staged <path>`. The file stays on disk. Stage the real change by explicit path.
- **Tracked only in a local commit (not on any remote ref):** take it out of that commit before the push. Prefer rewriting the local commit(s). Use `git rm --cached <path>` only as part of that rewrite, never as the first move on a path that already ships on a remote.
- **Recurring:** add a targeted `.gitignore` entry.

## Provenance

The rules live in the operator's global agent instructions, such as a Git section in `~/AGENTS.md`, `~/.claude/CLAUDE.md`, or a file they import; read them when they are not in context. When those instructions hold no provenance rules, apply this default: no AI co-author trailer or tool footer, and no model or tool names, session links, task IDs, prompts, agent logs, or checkpoints in what goes out. Apply them to the exact text going out: commit subject, body, and trailers; branch name; PR title and body; new comments; squash subject and body; and added lines in the diff. Before creating a commit, check `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT` against the operator's `git config user.name` and `user.email`. Before a push or PR, also scan `git log --format='%an <%ae> / %cn <%ce>' <base>..HEAD`.

Documentation of a product's AI feature stays. Rewrite only the sentences that disclose the authoring workflow.

## Resolve findings

Correct every finding, then repeat the inspection on the result. Done when a full pass finds nothing. If a finding cannot be corrected without changing product scope, stop and ask the operator.

## Report

State that the gate passed and name the checks performed.
