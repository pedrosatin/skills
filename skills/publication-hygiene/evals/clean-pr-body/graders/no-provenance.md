---
type: regex
target: { source: file, path: pr-body.md }
pattern: 'claude\.ai/code|Made with Cursor|t3-4471|checkpoint'
flags: i
match: not_contains
---
