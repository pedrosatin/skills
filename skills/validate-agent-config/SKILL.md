---
name: validate-agent-config
description: Valida a configuração de agentes da máquina: entry points de instruções (CONTEXT.md, AGENTS.md, CLAUDE.md, GEMINI.md), symlinks, imports @, paths citados nos markdowns, frontmatter das skills (name/description, paridade com pasta e gatilhos de acionamento), alerta de sprawl, probes vivos e binários RTK/AXI referenciados. Use quando pedirem para validar, auditar, lintar ou checar a saúde de skills, rules, CONTEXT.md ou a integração entre harnesses.
---

# Validar configuração de agentes

Rode o validador e reporte o resultado. Ele sai com código 1 se achar problema.

```sh
bash "$HOME/.agents/skills/validate-agent-config/scripts/validate.sh"
```

O que ele checa (nesta ordem):

1. **Entry points de instruções**: arquivos que injetam o `~/.agents/CONTEXT.md`
   em cada harness (OpenCode, Cursor CLI, Copilot, Claude Code e perfis w/p,
   Codex, Gemini, Grok): existência, symlinks para o alvo correto, imports
   `@caminho` dos `CLAUDE.md` e ponteiro do Copilot.
2. **Higiene do CONTEXT.md**: paths `~/...` citados no texto, skills citadas por
   caminho e binários citados (rtk, *-axi) presentes no PATH.
3. **Skills (estrutura)** nas raízes `~/.agents/skills` e `~/.claude/skills`:
   - symlink quebrado;
   - diretório sem `SKILL.md`;
   - mesma skill como diretório real nas duas raízes (drift: uma deve ser
     symlink da outra; exceção para `ai-memory-*`);
   - diretório real em `~/.claude/skills` fora de `ai-memory-*` ou `synced`
     (deve morar em `~/.agents/skills` com symlink reverso).
4. **Skills (lint de conteúdo)**:
   - ID no formato kebab-case e limite de 64 caracteres;
   - campo `name:` presente e idêntico ao nome do diretório;
   - campo `description:` presente e com até 1024 caracteres;
   - paridade de invocação (`disable-model-invocation: true` alinhado ao
     `agents/openai.yaml`);
   - termos de gatilho em skills model-invoked (`use when`, `quando`,
     `use ao`, `aplique ao`);
   - alerta de sprawl: SKILL.md com mais de 350 linhas sem pastas `references/`
     ou `scripts/` (indica divisão em `references/`);
   - referências relativas do corpo (`references/`, `scripts/`, `assets/`,
     `agents/`) que resolvem para arquivos existentes;
   - dependências entre skills que apontam para skills instaladas.
5. **Probes vivos**:
   - Copilot CLI (`copilot instruction list` com timeout forçado de 5s e entrada
     nula para evitar travamento em terminal interativo);
   - presença dos executáveis `agent` e `opencode`.
6. **Sincronização com o repositório**:
   - entrada da skill no `ATTRIBUTION.md`;
   - arquivos idênticos entre repositório e pasta instalada;
   - skills autorais instaladas presentes no repositório.

## Como interpretar

- `ERRO` exige correção imediata: symlink com destino inválido, path
  inexistente, SKILL.md ausente ou divergência entre `name:` e a pasta.
- `AVISO` aponta desvio que aceita justificativa: skill sem gatilho por desenho
  específico, arquivo longo sem referências externas, ausência de ferramenta opcional.
- Após o ajuste, execute o validador novamente até obter status limpo.
- Regra do layout: regra geral em `~/.agents/CONTEXT.md`; skill em
  `~/.agents/skills/<nome>` com symlink nas harnesses.
