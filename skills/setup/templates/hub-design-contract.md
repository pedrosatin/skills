# Contrato de design do Project Hub

Documento de referência para quem gera ou altera o dashboard em `.scratch/index.html` via skill `setup`. Alinha o hub à skill `frontend-ui-engineering` e evita regressão ao visual genérico de LLM.

## Job da tela

O hub serve para três tarefas do operador:

1. Escanear o board Kanban de tickets (status, blockers, progresso de critérios).
2. Ler ticket, spec, regras do repositório e `GRAPH_REPORT` como documento tipográfico.
3. Copiar o prompt de despacho de um ticket (card e painel de detalhe).

Qualquer mudança de layout ou chrome deve preservar essas três tarefas. Decoração sem função operacional fica fora do escopo.

## Artefato e regeneração

- Saída single-file: um único `.scratch/index.html` por repositório.
- Offline: sem CDN, sem fetch de CSS/JS/fontes externos em runtime.
- Regeneração idempotente: rodar `node scripts/generate-hub.mjs` (ou o path instalado em `~/.agents/skills/setup/scripts/generate-hub.mjs`) produz o mesmo contrato visual a partir dos Markdown em `.scratch/`.
- Proibido editar `.scratch/index.html` à mão. Correção de bug ou melhoria visual entra no gerador da skill `setup`. Patch manual some na próxima regeneração (`/setup`, `/to-tickets`, ou invocação direta do script).

## Markdown como documento

Ticket, spec, regras (AGENTS/CLAUDE/CONTEXT) e relatório do grafo devem aparecer como Markdown tipográfico: tipografia proporcional, hierarquia de headings, listas, ênfase, task lists e blocos de código distintos da prosa.

Rejeitado: dump do fonte escapado dentro de `<pre>` (ou equivalente monoespaçado) como leitor principal. `pre`/`code` ficam para fences e código inline, não para o corpo do documento.

Detalhe de implementação do parser e da classe de corpo MD fica em tickets posteriores. Este contrato fixa o comportamento observável.

## Detalhe em side panel

O detalhe de ticket e de spec abre em side panel à direita, com o board ainda visível em desktop. Em viewport estreita o panel ocupa a tela.

Rejeitado como padrão de detalhe: modal centrado com backdrop blur.

## Tokens (direção)

Família neutra zinc/slate para fundo, surface, borda e texto. Accent verde para estados de sucesso/ready e CTA relevantes. Danger e warning semânticos quando houver estado de erro ou alerta.

Detalhe de valores CSS e nomes de variáveis fica em tickets posteriores. O contrato fixa a direção: neutro operacional com accent verde, sem indigo/purple como cor de marca.

## Anti-patterns rejeitados

Vocabulário alinhado à skill `frontend-ui-engineering` (seção "Avoid the AI Aesthetic") e às decisões do hub:

| Padrão rejeitado | Motivo |
|---|---|
| Indigo/purple default (`#6366f1` e equivalentes) como primary de marca | Paleta "segura" de modelo; o hub deve parecer ferramenta operacional, não dashboard template |
| Emoji nos labels de chrome (header, tabs, colunas, botões principais) | Rótulos instáveis e ruidosos para leitores de tela; chrome usa texto puro |
| Lift (`translateY`) e sombra teatral no hover de cards | Feedback de board denso é borda ou surface, não profundidade cênica |
| Markdown cru em `<pre>` como leitor de ticket/spec/regras/report | Impede leitura tipográfica; ver seção "Markdown como documento" |
| CDN obrigatória (CSS/JS/fontes remotos) | O hub precisa abrir via `file://` offline |
| Rounded/pill excessivo como identidade visual | Cantos máximos e pills em massa sinalizam estética genérica de LLM |

Melhorias futuras do gerador devem passar por este contrato. Se uma proposta reintroduz um padrão da tabela, ela é rejeitada até haver decisão explícita que atualize este documento e a seção correspondente em `SKILL.md`.
