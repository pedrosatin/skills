---
name: publication-hygiene
description: Keep operational WIP out of Git and apply the provenance rules at publication. Use when committing, including when choosing the paths or message for a commit the operator will run; pushing; or creating, editing, commenting on, or merging a GitHub pull request.
metadata:
  short-description: Check publication hygiene
---

# Publication hygiene

Run this gate immediately before creating or amending a commit, pushing to a remote, or creating, editing, commenting on, closing, or merging a GitHub pull request. When the operator will run the commit, the gate still applies: its result is the path list or message you hand them.

## Operational WIP

List every path going out: `git diff --cached --name-status` before a commit, `git diff --name-status <base>...HEAD` before a push or PR. When the operator supplies the paths, use that list. Done when each path is classified as the change or as operational WIP.

Operational WIP records the work instead of being the work: local agent configuration, session and agent logs, plans, reports, spike notes, `.scratch/`, generated graphs such as `graphify-out/`, coverage, and worktree files. It stays unpublished unless the operator explicitly designates it public product material.

For each operational path:

- **Staged:** unstage it with `git restore --staged <path>`, or `git rm --cached <path>` when `HEAD` already tracks it. The file stays on disk. Stage the real change by explicit path.
- **Recurring:** add a targeted `.gitignore` entry.
- **In a local commit:** take it out of that commit before the push.
- **Already on a remote:** stop and ask the operator. A later commit leaves it in history, and a force-push leaves it reachable by SHA.

## Provenance

The rules live in the Git section of `~/.agents/CONTEXT.md`; read it when it is not in context. Apply them to the exact text going out: commit subject, body, and trailers; branch name; PR title and body; new comments; squash subject and body; and added lines in the diff.

Documentation of a product's AI feature stays. Rewrite only the sentences that disclose the authoring workflow.

## Resolve findings

Correct every finding, then repeat the inspection on the result. Done when a full pass finds nothing. If a finding cannot be corrected without changing product scope, stop and ask the operator.

## Report

State that the gate passed and name the checks performed.
