---
type: regex
target: { source: file, path: pr-body.md }
pattern: '\*\*(What|Why|Result):?\*\*'
match: not_contains
---
