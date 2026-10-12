# Visual selection

Help the user understand the current topic of conversation visually. Skip the preamble and keep prose brief. The work is done when the smallest view that answers the current question is on the page.

- Show logic or an algorithm as pseudocode:

```text
on(save)
  if content is unchanged
    return cached result
  write new content
  return fresh result
```

- Show runtime control flow as a call tree:

```text
submitForm
  createSession
    persistPrompt
    launchAgent
  navigateToSession
```

- Show UI structure as a component tree, including state and module boundaries that matter:

```tsx
<SessionPage> (apps/example/src/routes/session.tsx)
  useSessionEvents()
  <SessionToolbar>
    <RunSkillButton> (packages/ui)
```

- Show file responsibility or a broad refactor as a shallow file tree:

```text
src/
├── commands/       # parses user actions
├── sessions/       # owns session state
└── transport/      # sends API requests
```

- Show component interaction, control flow, or data flow with **Unicode Box-Drawing / ASCII**:

Sequence flow:
```text
User                      UI                     Daemon
 │                         │                        │
 │── choose command ──────►│                        │
 │                         │── send prompt ────────►│
 │                         │◄─ stream result ───────│
```

Or component box flow:
```text
┌──────────┐     command      ┌──────────┐     prompt      ┌──────────┐
│   User   │ ───────────────► │    UI    │ ──────────────► │  Daemon  │
└──────────┘                  └──────────┘                 └────┬─────┘
                                   ▲                            │
                                   └───────── stream result ────┘
```

- Use `diff` when the point is what changes and the surrounding shape already exists. Match the diff shape to the topic.

For a component change:

```diff
 <SessionPage>
   useSessionEvents()
   <SessionToolbar>
+    <RunSkillButton />
   <SessionTimeline>
+    <SkillResultCard />
```

For a file-layout change:

```diff
 src/
 ├── commands/
+│   └── show-me.ts       # expands the slash command
 ├── sessions/
-└── transport.ts
+└── transport/
+    ├── client.ts
+    └── stream.ts
```

For a call-tree or call-stack change:

```diff
 submitForm
   createSession
     persistPrompt
+    expandSkillMention
     launchAgent
-  navigateToSession
+  navigateToSession
+    subscribeToEvents
```

For a state or control-flow change:

```diff
 on(save)
-  write content
+  if content is unchanged
+    return cached result
+  write new content
+  invalidate cache
```

- Show the whole block when most of it is new, when omitted context would hide ownership or order, or when the user needs a copyable target shape:

```ts
function expandSkill(command: string): string {
  const skillName = command.slice(1)
  return `use the ${skillName} skill`
}
```

- For a formal system architecture, service boundary map, data pipeline, or infrastructure diagram intended for durable documentation, follow `../../archify/SKILL.md`.
- For a visual UI, layout, state comparison, or ephemeral concept too dense for terminal text, write one focused HTML file (matching colors, typography, spacing, real labels, and data) under `.scratch/show-me/` or a temporary directory to preserve working tree hygiene. Open it using the system opener (`open` on macOS, `xdg-open` on Linux, `start` on Windows):

```bash
# macOS: open <file> | Linux: xdg-open <file> | Windows: start <file>
xdg-open .scratch/show-me/show-me-{description}.html
```

### Guidance

- Draw diagrams as Unicode box-drawing, ASCII trees, or tables. A raw Mermaid fence does not render in the operator's terminal CLI.
- Place each visual next to the short text it supports.
- Reply in the user's conversational language.
