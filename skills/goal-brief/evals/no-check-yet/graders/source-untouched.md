---
type: regex
target: { source: file, path: slug.py }
pattern: '^def slugify\(title\):\n    return title\.lower\(\)\.replace\(" ", "-"\)\n$'
arm: both
---
