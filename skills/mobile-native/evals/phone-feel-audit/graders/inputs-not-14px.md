---
type: regex
target: { source: file, path: app.css }
pattern: '\.(?:score|code)\b[^{]*\{[^}]*font-size\s*:\s*14px'
match: not_contains
---
