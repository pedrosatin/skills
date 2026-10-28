---
name: to-spec
description: "Turn the current conversation into a spec and publish it to the project issue tracker. Use when settled requirements or design decisions need a written specification; synthesize the existing discussion without a new interview."
---

This skill takes the current conversation context and codebase understanding and produces a spec. Do NOT interview the user; just synthesize what you already know.

The issue tracker and domain docs should have been configured for this repo. If not, tell the user to run `/setup`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching. Follow `docs/agents/domain.md` when present.

2. Domain catch-up (before drafting the spec). Scan the conversation for project-specific terms and hard decisions that settled but are not yet on disk. Follow `docs/agents/domain.md` for glossary vocabulary and ADR criteria. This step must not interview the user:
   - Write missing settled terms into the glossary path domain.md names (root `GLOSSARY.md`, or the mapped context glossary if `GLOSSARY-MAP.md` exists). Create the file lazily. If the map does not resolve a path, fall back to root `GLOSSARY.md` and note that in the catch-up summary. If a teach-style glossary already owns the path, leave it alone and use the product glossary path from `docs/agents/domain.md`.
   - Write an ADR under `docs/adr/` for each conversation decision that qualifies under domain.md and is not already recorded. Create the directory lazily. Skip quietly when nothing qualifies. Do not ask whether to write; list every path you created in the catch-up summary.
   - If the grilling close already wrote these files, verify they match the conversation and fill any gaps. Still do not re-interview.

3. Sketch the **test boundaries**: the external surfaces where you will observe the feature's behavior without opening internal implementation. Prefer existing boundaries. Prefer the highest (outermost) boundary that still gives confidence. Propose new ones only when needed, and keep the count low. Ideally one.

Check with the user that these test boundaries match their expectations.

4. Write the spec using the template below, then publish it to the project issue tracker. For local tracking, resolve the **primary worktree** (`git worktree list --porcelain | awk '/^worktree / { print $2; exit }'`) and save to `<primary>/.scratch/<feature-slug>/spec.md` — never only inside a disposable agent worktree. See `docs/agents/issue-tracker.md` (Scratch root). Apply the `ready-for-agent` triage label - no need for additional triage.

5. Refresh the Project Hub with setup's generator: resolve `<setup>` as the `setup` folder next to this skill, then `node <setup>/scripts/generate-hub.mjs <primary>` (owned by `/setup`). Provide the user with the clickable dashboard link (`file://<primary>/.scratch/index.html`).

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- The agreed test boundaries and why they sit where they do
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested through those boundaries
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
