---
type: regex
target: { source: file, path: commit-message.txt }
pattern: 'co-authored-by|claude\.ai/code|made with cursor'
flags: i
match: not_contains
---
