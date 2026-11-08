---
type: regex
target: { source: file, path: app.css }
pattern: '\.sheet(?:-list)?\b[^{]*\{[^}]*padding[^;}]*(?:env\(\s*safe-area-inset-bottom|var\(--[\w-]*safe)'
---
