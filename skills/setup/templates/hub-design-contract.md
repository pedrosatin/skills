# Project Hub design contract

Reference document for anyone generating or changing the dashboard in `.scratch/index.html` through the `setup` skill. It aligns the hub with `frontend-ui-engineering` and prevents regression to generic LLM visuals.

## Screen purpose

The hub supports three operator tasks:

1. Scan the ticket Kanban board for status, blockers, and acceptance criteria progress.
2. Read tickets, specs, repository rules, and `GRAPH_REPORT` as formatted documents.
3. Copy a ticket dispatch prompt from a card or detail panel.

Any change to the layout or interface controls must preserve these tasks. Decoration with no operational purpose is outside the scope.

## Artifact and regeneration

- Single-file output. One `.scratch/index.html` per repository.
- Offline. No CDN and no external CSS, JavaScript, or font fetches at runtime.
- Idempotent regeneration. Running `node scripts/generate-hub.mjs`, or the installed path `~/.agents/skills/setup/scripts/generate-hub.mjs`, produces the same visual contract from the Markdown in `.scratch/`.
- Do not edit `.scratch/index.html` by hand. Make bug fixes and visual improvements in the `setup` skill's generator. Manual patches disappear on the next regeneration through `/setup`, `/to-tickets`, or a direct script invocation.

## Markdown as a document

Tickets, specs, rules (AGENTS/CLAUDE/CONTEXT), and graph reports use formatted Markdown. Use proportional typography, a heading hierarchy, lists, emphasis, task lists, and code blocks visually distinct from prose.

The main reader must not dump escaped source into `<pre>` or an equivalent monospaced view. Reserve `pre`/`code` for fenced blocks and inline code.

Parser implementation details and the Markdown body class belong in later tickets. This contract defines observable behavior.

## Details in a side panel

Ticket and spec details open in a side panel on the right, with the board still visible on desktop. On narrow viewports, the panel fills the screen. A centered modal with backdrop blur is outside the detail view convention.

## Token direction

Use a neutral zinc/slate palette for backgrounds, surfaces, borders, and text. Use a green accent (`#22c55e`) by default for success/ready states and relevant calls to action. Use semantic danger and warning colors for error and alert states.

When the repository exposes an identifiable brand color through CSS variables such as `--color-primary` / `--accent` / `--color-action`, `theme-color` / tile / mask-icon with useful chroma, or `primary` in Tailwind configuration, the generator uses it for `--accent` and `--success`. Choose `--accent-fg` by contrast. Keep the zinc neutrals. Without reliable evidence, use the default green.

CSS values and variable names are defined in the generator. Tokens use operational neutrals with the project's brand accent or the default green. Generic LLM indigo/purple must not become the hub's default.

## Rejected patterns

These terms align with the `frontend-ui-engineering` skill's "Avoid the AI Aesthetic" section and the hub's decisions:

| Rejected pattern | Reason |
|---|---|
| Default indigo/purple (`#6366f1` and equivalents) as the primary brand color | This is a model's predictable palette. The hub should look like an operational tool. |
| Emoji in interface labels (header, tabs, columns, main buttons) | These labels are unstable and noisy for screen readers. Interface controls use plain text. |
| Lift (`translateY`) and theatrical shadows on card hover | Feedback on a dense board uses a border or surface change. |
| Raw Markdown in `<pre>` as the ticket/spec/rules/report reader | This prevents formatted reading. See "Markdown as a document". |
| Required CDN (remote CSS/JavaScript/fonts) | The hub must open offline through `file://`. |
| Excessive rounded corners or pills as the visual identity | Maximum rounding and widespread pills signal generic LLM aesthetics. |

Future generator improvements must follow this contract. A proposal that reintroduces a pattern from the table is rejected until an explicit decision updates this document and the corresponding section in `SKILL.md`.
