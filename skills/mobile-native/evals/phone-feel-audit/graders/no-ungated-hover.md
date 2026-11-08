---
type: regex
target: { source: file, path: app.css }
pattern: '^(?!\s*/\*)[^\s@][^{]*:hover'
flags: m
match: not_contains
---
