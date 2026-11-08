---
type: regex
target: { source: file, path: index.html }
pattern: 'user-scalable\s*=\s*(?:no|0)|maximum-scale'
flags: i
match: not_contains
---
