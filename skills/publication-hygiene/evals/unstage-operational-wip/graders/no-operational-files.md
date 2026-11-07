---
type: regex
target: { source: file, path: commit-paths.txt }
pattern: '\.scratch|agent-session\.log|graphify-out'
match: not_contains
---
