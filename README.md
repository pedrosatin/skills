# skills

Skills de agentes (Claude Code, OpenCode, Codex, Gemini, Cursor...) usadas
nos meus projetos: escrita sem "cara de IA" em PT-BR, higiene de publicação
(sem trailer/provenância de agente), fluxo grill → spec → tickets → PR, e
diagramas de arquitetura.

Cada pasta em `skills/` é autocontida (`SKILL.md` + arquivos de apoio).

## Instalar

```sh
# skills.sh (instala em todos os agents configurados)
npx skills add pedrosatin/skills

# ou manual: copiar para a raiz compartilhada
git clone https://github.com/pedrosatin/skills.git
cp -r skills/skills/* ~/.agents/skills/
```

OpenCode lê `~/.agents/skills` nativamente; Claude Code via symlink
(`ln -s ../../.agents/skills/<nome> ~/.claude/skills/<nome>`).

## Conteúdo

**Autorais** — `unslop-br` (anti-AI-slop PT-BR), `publication-hygiene`
(valida commit/PR sem proveniência de agente antes do push), `babysit-prs`
(revisar/mesclar PRs abertas), `pr-loop` (loop de entrega com subagents e
code review), `archify` (diagramas de arquitetura em HTML/SVG).

**Vendored MIT** (ver `ATTRIBUTION.md`): fluxo de planejamento do Matt
Pocock (`grill-me`, `grilling`, `to-spec`, `to-tickets`, `research`,
`teach`), engenharia do Addy Osmani (`spec-driven-development`,
`code-review-and-quality`, `documentation-and-adrs`,
`frontend-ui-engineering`, `code-simplification`, `interview-me`,
`browser-testing-with-devtools`) e `humanizer` (Siqi Chen).
