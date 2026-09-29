## Agent skills

### Language conventions

Write skill instructions, descriptions, internal prompts, supporting documentation, and code comments in English. Keep `unslop-br` entirely in Brazilian Portuguese. Preserve Portuguese trigger examples, proper names, quoted source material, and localization catalogs when their language is part of their function.

Use the user's language for conversation and follow each target project's language conventions for generated prose. English instructions do not require English output. Keep interface localization separate from instruction translation.

### Issue tracker
Track issues locally in Markdown files under `.scratch/<feature>/`.
The interactive dashboard is at `.scratch/index.html`.
See `docs/agents/issue-tracker.md`.

### Domain docs
Use the single-context convention (`docs/adr/`). See `docs/agents/domain.md`.
