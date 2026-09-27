---
name: validate-agent-config
description: Valida a configuração de agentes da máquina — entry points de instruções (CONTEXT.md, AGENTS.md, CLAUDE.md, GEMINI.md), symlinks, imports @, paths citados nos markdowns, frontmatter das skills (name/description), skills duplicadas/quebradas e binários RTK/AXI referenciados. Use quando pedirem para validar, auditar, lintar ou checar a saúde de skills, rules, CONTEXT.md ou a integração entre harnesses.
---

# Validar configuração de agentes

Rode o validador e reporte o resultado. Ele sai com código 1 se achar problema.

```sh
bash "$HOME/.agents/skills/validate-agent-config/scripts/validate.sh"
```

O que ele checa (nesta ordem):

1. **Entry points de instruções** — os arquivos que injetam o `~/.agents/CONTEXT.md`
   em cada harness (OpenCode, Cursor CLI, Copilot, Claude Code + perfis w/p,
   Codex, Gemini, Grok): existem, symlinks resolvem para o alvo certo, imports
   `@caminho` dos `CLAUDE.md` resolvem, e o ponteiro do Copilot está no lugar.
2. **Higiene do CONTEXT.md** — todo path `~/...` citado no texto existe; toda
   skill citada por caminho existe; binários citados (rtk, *-axi) estão no PATH.
3. **Skills** (raízes `~/.agents/skills` e `~/.claude/skills`):
   - symlink quebrado;
   - diretório sem `SKILL.md`;
   - frontmatter sem `description:` (a skill não é anunciada ao modelo — o
     OpenCode só lista skills com description) ou sem `name:`;
   - mesma skill como diretório REAL nas duas raízes (drift — uma deve ser
     symlink da outra; exceção: `ai-memory-*`, gerenciadas pelo instalador);
   - diretório real em `~/.claude/skills` que não seja `ai-memory-*`/`synced`
     (deveria morar em `~/.agents/skills` com symlink de volta).

## Como interpretar

- `ERRO` corrige na hora: symlink apontando errado, path citado que não existe,
  SKILL.md faltando.
- `AVISO` é aceitável com motivo: skill sem `description` de propósito
  (command-only), diretório real justificado.
- Depois de corrigir, rode o validador de novo até sair limpo.
- Regra de ouro do layout: regra geral → `~/.agents/CONTEXT.md`; skill →
  `~/.agents/skills/<nome>` + symlinks nas harnesses (ver `~/.agents/SKILLS.md`).
