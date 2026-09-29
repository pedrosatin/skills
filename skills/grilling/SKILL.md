---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round.

## Ask through the harness question UI

Put the round's questions to the user through the harness's structured question interface, so they answer by picking options instead of typing a prose reply. When the harness exposes a question tool, do not post the frontier as a numbered list in the chat and wait for text.

The control has a different name in each harness:

| Harness | Tool | Shape |
| --- | --- | --- |
| Claude Code | `AskUserQuestion` | up to 4 questions per call, 2 to 4 options each, header ≤ 12 chars, optional multi-select; an "Other" free-text choice is always added |
| OpenCode | `question` | a list of questions, each with a header, the question text, and options; the user moves between them and can type a custom answer |
| Codex CLI | `request_user_input` | option-based question prompt (Plan mode) |
| Gemini CLI | `ask_user` | one or more questions, from yes/no to multiple choice to open-ended |
| Cursor CLI | `AskQuestion` | question with selectable options |

Use whichever one the current harness exposes. Check your tool list for the right name before giving up on it.

Build each question like this:

| Field | What goes in it |
| --- | --- |
| `header` | One to four words naming the decision, short enough for the harness limit (12 characters on Claude Code). |
| `question` | The decision and the trade-offs that make the options meaningful. Put longer context in the message that carries the call. |
| `options` | The real branches, two to four of them, each with a one-line description of what choosing it commits to. List your recommended answer first and mark it `(Recommended)`. |
| `multi-select` | Only when more than one branch can hold at the same time. |

If the harness limits how many questions one call takes (Claude Code allows four), split the round across several calls. Collect the answers to the whole round before asking the next.

If the harness has no question tool, or the user turned it off, fall back to prose: number each question and state your recommended answer under it.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
