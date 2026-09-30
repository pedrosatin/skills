---
name: validate-agent-config
description: "Validate the machine's agent configuration: instruction files (CONTEXT.md, AGENTS.md, CLAUDE.md, GEMINI.md), symlinks, @ imports, skill frontmatter, and referenced binaries. Use when asked to validate, audit, or check the health of skills, rules, or harness integration."
---

# Validate agent configuration

Run the validator and report the result. It exits with code 1 when it finds errors.

```sh
bash "$HOME/.agents/skills/validate-agent-config/scripts/validate.sh"
```

It checks the following, in this order:

1. **Instruction entry points**: files that inject `~/.agents/CONTEXT.md`
   into each harness (OpenCode, Cursor CLI, Copilot, Claude Code and its w/p
   profiles, Codex, Gemini, Grok). Check existence, symlinks to the correct
   target, `@path` imports in `CLAUDE.md`, and the Copilot pointer.
2. **CONTEXT.md hygiene**: `~/...` paths cited in the text, skills referenced
   by path, and referenced binaries (rtk, *-axi) available on PATH.
3. **Skill structure** in `~/.agents/skills` and `~/.claude/skills`:
   - broken symlinks;
   - directories without `SKILL.md`;
   - the same skill stored as a real directory in both roots (drift; one must
     be a symlink to the other, except for `ai-memory-*`);
   - real directories in `~/.claude/skills` outside `ai-memory-*` or `synced`
     (they should live in `~/.agents/skills` with a symlink from the other root).
4. **Skill content lint**:
   - kebab-case IDs with a limit of 64 characters;
   - a `name:` field matching the directory name;
   - a `description:` field with at most 1024 characters;
   - invocation parity (`disable-model-invocation: true` aligned with
     `agents/openai.yaml`);
   - trigger terms in model-invoked skills (`use when`, `quando`,
     `use ao`, `aplique ao`);
   - sprawl warnings: SKILL.md files longer than 350 lines without `references/`
     or `scripts/` directories (suggest splitting into `references/`);
   - relative references in the body (`references/`, `scripts/`, `assets/`,
     `agents/`) resolving to existing files;
   - dependencies on installed skills.
5. **Live probes**:
   - Copilot CLI (`copilot instruction list` with a 5-second timeout and
     null input to avoid hanging in an interactive terminal);
   - availability of the `agent` and `opencode` executables.
6. **Repository sync**:
   - the skill's entry in `ATTRIBUTION.md`;
   - identical files in the repository and installed directory;
   - locally authored installed skills present in the repository.

## Interpreting results

- `ERROR` requires immediate correction: symlinks with invalid targets, missing
  paths, missing SKILL.md files, or a mismatch between `name:` and the directory.
- `WARNING` indicates a deviation that may have a justification: a skill without
  triggers by design, a long file without external references, or a missing optional tool.
- After making corrections, rerun the validator until the status is clean.
- Layout rule: general rules live in `~/.agents/CONTEXT.md`; skills live at
  `~/.agents/skills/<nome>` with symlinks in the harness directories.
