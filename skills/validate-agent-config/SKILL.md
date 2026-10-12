---
name: validate-agent-config
description: "Validate the machine's agent configuration: instruction files (CONTEXT.md, AGENTS.md, CLAUDE.md, GEMINI.md), symlinks, @ imports, skill frontmatter, and referenced binaries. Use when asked to validate, audit, or check the health of skills, rules, or harness integration."
---

# Validate agent configuration

Run the validator and report the result. The script is the home for what is
checked and in which order.

```sh
bash "$HOME/.agents/skills/validate-agent-config/scripts/validate.sh"
```

From a clone of this repository, `bash skills/validate-agent-config/scripts/validate.sh`
lints the checkout's `skills/` catalog as well as the installed skill roots.

## Interpreting results

- `ERROR` requires a fix before treating the machine as healthy: broken
  symlinks, missing paths, missing SKILL.md files, or `name:` not matching
  the directory. Exit 1.
- `WARNING` is a deviation that may have a reason: a missing optional tool, a
  skill without trigger phrases, or a SKILL.md over 350 lines (the threshold
  applies even when `references/` or `scripts/` exist). Exit 0.
- After fixes, rerun until the result is `CLEAN`, or `CLEAN WITH WARNINGS`
  you can justify.
- Layout: general rules live in `~/.agents/CONTEXT.md`; skills live at
  `~/.agents/skills/<name>` with harness directories as symlinks.
