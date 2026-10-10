# Demo feature

## Problem Statement

Operators need a demonstration feature with formatted Markdown
to validate the Project Hub without relying on a real repository.

## Solution

Keep a minimal tree under `fixtures/minimal-scratch` with a spec and tickets
that exercise headings, lists, emphasis, and issue dependencies.

## Scope

1. As an operator, I want to see the spec rendered with document typography.
2. As an operator, I want ready, blocked, and done tickets on the Kanban board.

### Details

- Text with **bold**, *italics*, and `inline code`
- Numbered and bulleted lists
- A short quotation:

> Local fixture, with no CDN or external clones.

### Spec checklist

- [x] Headings and paragraphs
- [ ] Optional example still open

---

Example code:

```js
console.log('fixture ok');
```
