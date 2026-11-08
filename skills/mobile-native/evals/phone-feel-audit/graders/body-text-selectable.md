---
type: regex
target: { source: file, path: app.css }
pattern: '(?:^|[,\s])body[^{]*\{[^}]*user-select\s*:\s*none'
match: not_contains
---
