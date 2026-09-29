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

# ou por symlink, a partir do clone (uma skill por link)
git clone https://github.com/pedrosatin/skills.git
./skills/link.sh
```

O `link.sh` cria `~/.agents/skills/<nome>` apontando para cada pasta de
`skills/`, sem tocar nas skills de fora do repo. Ele é idempotente, pula
pastas reais e apaga links quebrados de skills removidas do repo (também nas
raízes de Claude Code, Codex e Gemini). Rode de novo depois de cada `git pull`.

OpenCode lê `~/.agents/skills` nativamente. Claude Code, Codex e Gemini leem
por symlink (`ln -s ../../.agents/skills/<nome> ~/.claude/skills/<nome>`).

## Conteúdo

**Autorais** — `unslop-br` (anti-AI-slop PT-BR), `publication-hygiene`
(valida commit/PR sem proveniência de agente antes do push), `babysit-prs`
(revisar/mesclar PRs abertas), `pr-loop` (loop de entrega com subagents e
code review), `validate-agent-config` (validação de entry points e paridade de skills),
`setup` (inicialização de projeto, specs/tickets locais e Project Hub HTML),
`board` (abre o Project Hub em `.scratch/index.html` e aponta o `/setup` quando
a board ainda não existe).

**Vendored / Ferramentas** (ver `ATTRIBUTION.md`): `graphify` (grafo de
conhecimento e navegação de codebase, Graphify-Labs, Apache-2.0), `archify` (diagramas de
arquitetura em HTML/SVG interativo, tt-a1i), fluxo de planejamento do Matt
Pocock (`grilling`, `to-spec`, `to-tickets`, `research`, `teach`)
e `humanizer` (Siqi Chen).
