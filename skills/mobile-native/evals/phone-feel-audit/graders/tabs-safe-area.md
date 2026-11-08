---
type: regex
target: { source: file, path: app.css }
pattern: '\.(?:tabs?|app)\b[^{]*\{[^}]*padding[^;}]*(?:env\(\s*safe-area-inset-bottom|var\(--[\w-]*safe)'
---
