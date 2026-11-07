---
type: regex
target: { source: file, path: commit-paths.txt }
pattern: 'src/cart\.js[\s\S]*test/cart\.test\.js|test/cart\.test\.js[\s\S]*src/cart\.js'
---
