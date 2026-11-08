---
type: regex
target: { source: file, path: commit-paths.txt }
pattern: '\.claude/|coverage/|docs/plans/|docs/spikes/|reports/'
match: not_contains
---
