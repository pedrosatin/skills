---
name: pr-description
description: "Draft a local PR body from the diff and observed validation, or create/edit the remote PR with evidence attachments. Use when writing or updating a PR description, opening a PR, or editing PR #N via '/pr-description', 'escreve a descrição da PR', 'abre a PR', 'cria a PR', or 'edita o body da #N'. Organizes and publishes evidence; does not run product verification or merge."
---

# pr-description

Turn the current diff and **observed** validation into a PR description. In `draft` mode, write a local body file. In `publish` mode, create or edit the remote PR (with optional `--attach` media).

This skill does not run UI/API/CLI verification, merge, or replace `publication-hygiene`. The caller supplies what was actually run.

## Modes

Infer from the operator's wording. Bare `/pr-description` with no publish verb and no PR number/URL defaults to **draft**.

| Mode | Triggers | Effect |
|---|---|---|
| `draft` | "escreve/atualiza a descrição", "atualiza o body local", review prep in `pr-loop`, bare `/pr-description` | Write or refresh a local body file only |
| `publish` | "abre/cria a PR", "edita/atualiza a PR #N", `pr-loop` publish phase | Hygiene preflight, then `gh-axi pr create` or `pr edit`, with attaches as needed |

"Write a description" must not open a PR. "Open/update the PR" must publish.

## Draft

1. Read the repo PR template (for example `.github/PULL_REQUEST_TEMPLATE.md`) and language conventions. Map onto the template when present.
2. Collect the diff (`git diff <base>...<head>`), commits, and **observed** checks from the caller (commands, exits, notes, temp media paths). Do not invent results.
3. Write the body to `<repo>/.scratch/pr-description/body.md` (create the directory). Do not commit this file.
4. Apply `../unslop-br/SKILL.md` for PT-BR prose, or `../humanizer/SKILL.md` for English. Keep code identifiers and quoted material intact. Follow `../publication-hygiene/SKILL.md` for provenance in the body.
5. Report the body path and which Evidence claims are observed vs planned vs N/A.

## Publish

1. Ensure a current draft body exists (run draft first if missing or stale vs the final diff).
2. Run `../publication-hygiene/SKILL.md` on the body, title, and diff. Fix findings before calling GitHub.
3. Caller must have pushed the branch when creating a new PR.
4. Resolve the target PR:
   - If the operator named `#N` or a URL, fetch it with `gh-axi pr view <n> --full` and `gh-axi api /repos/{owner}/{repo}/pulls/<n>`. Edit it only when `head.repo` matches this checkout's remote and `head.ref` matches the branch whose diff you drafted. If repo, base, or head disagree, stop and ask. Do not publish a local diff onto a different PR.
   - Else list open PRs for this `head` (and `base` when known) with `gh-axi pr list`. If one exists, **edit it**. Only `pr create` when none exists.
5. Create or edit with `gh-axi` (requires `gh >= 2.99.0` for `--attach`):

```sh
gh-axi pr create --title "..." --body-file <repo>/.scratch/pr-description/body.md --base <base> --head <head> [--attach 'path#alt']...
gh-axi pr edit <n> --title "..." --body-file <repo>/.scratch/pr-description/body.md [--attach 'path#alt']...
```

On a later edit of the same PR, read the remote body first (`gh-axi pr view <n> --full`). Keep existing GitHub asset URLs. Re-attach only new local files. Do not `--body-file` a draft that still contains deleted temp paths.

6. Confirm the remote body (and attachments) with `gh-axi pr view <n> --full`. Copy that confirmed remote body, with GitHub asset URLs, into `<repo>/.scratch/pr-description/body.md`. Delete temp media only after that copy. On upload failure, keep the temp file for retry; do not commit it.
7. When `link_pull_request` is available in the harness, link the PR URL for the thread.
8. Never merge, close, or approve from this skill.

Partial create failures matter: `pr create` can open the PR and still fail on an attachment. Before any create retry, list again by `head` and switch to edit.

## Body shape

Default sections when the repo has no template (headings in the project language):

1. **Summary** — problem and resulting behavior. Add a visual only when it beats a short paragraph (see Visuals). Docs/config-only PRs may stay prose-only.
2. **Evidence** — observed validation only:
   - UI: before/after screenshot or short recording via `--attach` on publish.
   - Behavior/API/CLI: command, exit, relevant output, or failing→passing test at a named revision.
   - Docs/chore: state that runtime verification is N/A and why.
3. **Impact and rollback** — who/what is affected; git undo **and** irreversible data or external effects. Concrete statements only.

### Evidence rules

- Report only checks that ran. Mark planned checks as planned.
- Keep diagrams/pseudocode distinct from execution proof.
- Never fabricate baselines, screenshots, or green suites.
- Stay proportional: no screenshot theater for non-visual work; no log dumps when a test name and exit code suffice.

### Failure taxonomy

| Situation | Body must say |
|---|---|
| Execution failed | Scenario/command, failure, behavior **not** confirmed |
| Capture failed | Verification ran (if it did); **artifact** missing |
| Upload failed | Verification result separate; media **not** on the PR |
| Not applicable | No runtime surface; do not invent one |

A missing screenshot does not invalidate a verification that already ran. Do not claim before/after UI proof unless the GitHub asset is present.

## Visuals

For a Summary visual of ownership, flow, or change shape, follow `../show-me/SKILL.md`.

## Media lifecycle

1. Capture outside the repo (harness temp or `/tmp`).
2. Keep through draft review when useful.
3. On publish, `--attach '<path>#<alt>'` (repeatable).
4. After `pr view` shows the assets, replace the local body with the remote body (GitHub URLs), then delete local temps.
5. On upload failure, retain for retry; never commit media.
6. Later edits start from the remote body so published URLs survive.

## Non-goals

Merge, close, CI watch, full `pr-loop`, product verification execution, feature maps, and pushing commits.
