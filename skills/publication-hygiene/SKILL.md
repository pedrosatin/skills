---
name: publication-hygiene
description: Keep operational WIP out of Git and apply the provenance rules at publication. Use when committing, including when choosing the paths or message for a commit the operator will run; pushing; or creating, editing, commenting on, or merging a GitHub pull request.
metadata:
  short-description: Check publication hygiene
---

# Publication hygiene

Run this gate immediately before creating or amending a commit, pushing to a remote, or creating, editing, commenting on, closing, or merging a GitHub pull request. When the operator will run the commit, the gate still applies: its result is the path list or message you hand them.

## Operational WIP

List every path going out. Before a commit: `git diff --cached --name-status`. Before a push or PR: `git log --format='%h%n%B' --name-status <base>..HEAD` — the three-dot diff only shows the branch tip balance and misses WIP that entered then left a middle commit, while the push publishes every commit. When the operator supplies the paths, use that list. Done when each path is classified as the change or as operational WIP.

Operational WIP records the work instead of being the work: local agent configuration, session and agent logs, plans, reports, spike notes, `.scratch/`, generated graphs such as `graphify-out/`, coverage, and worktree files. It stays unpublished unless the operator explicitly designates it public product material.

For each operational path, check the remote first (`git ls-tree origin/<base> -- <path>` or the equivalent for the push target). If the path already exists on the remote, stop and ask the operator before any unstage or delete: a later commit leaves it in history, and a force-push leaves it reachable by SHA.

Otherwise:

- **Staged and not yet in HEAD:** unstage with `git restore --staged <path>`. The file stays on disk. Stage the real change by explicit path.
- **Tracked only in a local commit (not on the remote):** take it out of that commit before the push. Prefer rewriting the local commit(s). Use `git rm --cached <path>` only as part of that rewrite, never as the first move on a path that already ships on the remote.
- **Recurring:** add a targeted `.gitignore` entry.

## Provenance

The rules live in the Git section of `~/.agents/CONTEXT.md`; read it when it is not in context. If that file cannot be read, stop and ask the operator — do not pass the gate without the rules. Apply them to the exact text going out: commit subject, body, and trailers; branch name; PR title and body; new comments; squash subject and body; and added lines in the diff. Also check author and committer with `git log --format='%an <%ae> / %cn <%ce>' -1` (or `<base>..HEAD` before a push) against the operator's `git config user.name` and `user.email`.

Documentation of a product's AI feature stays. Rewrite only the sentences that disclose the authoring workflow.

## Resolve findings

Correct every finding, then repeat the inspection on the result. Done when a full pass finds nothing. If a finding cannot be corrected without changing product scope, stop and ask the operator.

## Report

State that the gate passed and name the checks performed.
