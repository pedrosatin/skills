## Agent skills

### Language conventions

Write skill instructions, descriptions, internal prompts, supporting documentation, and code comments in English. Keep `unslop-br` entirely in Brazilian Portuguese. Preserve Portuguese trigger examples, proper names, quoted source material, and localization catalogs when their language is part of their function.

Use the user's language for conversation and follow each target project's language conventions for generated prose. English instructions do not require English output. Keep interface localization separate from instruction translation.

### Tests
Run `node --test tests/`, and `npm test --prefix skills/clean-crap` after `npm ci --prefix skills/clean-crap`. `node skills/setup/scripts/generate-hub.mjs --fixture` smokes the Project Hub generator, and `bash skills/validate-agent-config/scripts/validate.sh` lints the catalog and the installed skill roots (run `./link.sh` first; errors outside `skills/` describe the machine, not the change).

### Issue tracker
Track issues locally in Markdown files under `.scratch/<feature>/` on the primary worktree.
The interactive dashboard is at `.scratch/index.html`.
See `docs/agents/issue-tracker.md`.

### Domain docs
Use the single-context convention (`GLOSSARY.md`, `docs/adr/`). See `docs/agents/domain.md`.
