---
type: regex
target: { source: file, path: README.final.md }
pattern: 'drafted by|claude\.ai/code'
flags: i
match: not_contains
---
