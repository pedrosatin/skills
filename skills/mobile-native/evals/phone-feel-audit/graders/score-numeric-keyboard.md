---
type: regex
target: { source: file, path: index.html }
pattern: '<input(?=[^>]*class="score")(?=[^>]*(?:inputmode\s*=\s*"(?:numeric|decimal)|type\s*=\s*"(?:number|tel)"))[^>]*>'
---
