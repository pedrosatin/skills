---
name: setup
description: "Initialize a project for local specs, tickets, knowledge graph, and architecture. Scaffolds .scratch/ issue tracking, domain docs, updates AGENTS.md, checks graphify, and generates the interactive HTML Project Hub dashboard."
disable-model-invocation: true
---

# /setup (e /init)

Configura o repositório para o ciclo completo de engenharia de software local:
- **Specs & Tickets**: rastreamento local em `.scratch/` para uso direto com `/to-spec` e `/to-tickets`.
- **Domain docs**: convenção single-context em `docs/agents/` e ADRs em `docs/adr/`.
- **Knowledge Graph**: integração com o `graphify` para mapear dependências e nós centrais.
- **Project Hub**: dashboard HTML interativo em `.scratch/index.html` com board Kanban de tickets, leitor de specs, regras e links do grafo.

Este processo é conversacional: explore o ambiente, apresente o resumo do que encontrou, confirme com o usuário e gere a estrutura.

## Processo

### 1. Explorar o projeto

Analise o repositório atual para entender o estado inicial:
- **Nome do projeto**: `package.json`, `Cargo.toml`, `pyproject.toml` ou nome do diretório
- **Arquivo de regras**: existe `AGENTS.md` ou `CLAUDE.md` no root? Já possui uma seção `## Agent skills`?
- **Grafo de conhecimento**: existe a pasta `graphify-out/` com `graph.html`?
- **Specs e tickets existentes**: existem arquivos em `.scratch/` ou `docs/specs`?
- **Instalação do Graphify**: o binário `graphify` está acessível no PATH (`command -v graphify`) ou via python?

### 2. Apresentar descobertas e perguntar

Resuma o que encontrou e faça as perguntas da fronteira (uma por vez, liderando com a resposta recomendada):

**A. Instalação e execução do Graphify:**
- Se o comando `graphify` **não** estiver instalado no sistema:
  > *"O Graphify não está instalado no ambiente. Deseja instalar via `uv tool install graphifyy` ou `pip install graphifyy`? (recomendado: **sim**)"*
- Se `graphify-out/graph.html` **não** existir no repositório:
  > *"Deseja rodar o Graphify agora para mapear a base de código e gerar o grafo interativo? (recomendado: **sim**)"*
  Se confirmado, execute `graphify .`. Se o usuário optar por não rodar agora, prossiga com o setup normalmente (o dashboard indicará que o grafo pode ser gerado a qualquer momento com `/graphify`).

**B. Arquivo de regras do repositório:**
- Escolha o arquivo para editar:
  - Se `AGENTS.md` existe, use-o.
  - Se `CLAUDE.md` existe, use-o.
  - Se nenhum existir, proponha criar `AGENTS.md`.
- Apresente ao usuário a prévia do bloco `## Agent skills`:
  ```markdown
  ## Agent skills

  ### Issue tracker
  Rastreamento local em arquivos markdown sob `.scratch/<feature>/`.
  Dashboard interativo em `.scratch/index.html`.
  Veja `docs/agents/issue-tracker.md`.

  ### Domain docs
  Convenção single-context (`docs/adr/`). Veja `docs/agents/domain.md`.
  ```
- Aguarde a confirmação do usuário antes de gravar.

### 3. Escrever arquivos de configuração

Após a confirmação:
1. Copie os templates desta skill para o projeto:
   - `templates/issue-tracker.md` → `docs/agents/issue-tracker.md`
   - `templates/domain.md` → `docs/agents/domain.md`
2. Garanta a criação da pasta `.scratch/` no root do projeto.
3. Adicione ou atualize o bloco `## Agent skills` no arquivo de regras escolhido (`AGENTS.md` ou `CLAUDE.md`). Não duplique a seção se ela já existir.

### 4. Gerar o Project Hub Dashboard

Execute o script da skill:
```bash
node scripts/generate-hub.mjs
```
(ou `node ~/.agents/skills/setup/scripts/generate-hub.mjs <caminho-do-repo>`).

Se o usuário tiver passado a flag `--docs`, utilize:
```bash
node scripts/generate-hub.mjs --docs
```

O HTML em `.scratch/index.html` é gerado e regenerado por esse script. Não edite o arquivo à mão; correção ou melhoria visual entra no gerador da skill `setup`.

#### Fixture e smoke estrutural

Para validar o gerador sem depender do `.scratch` do repositório do usuário, use a árvore `fixtures/minimal-scratch/` (spec + tickets de exemplo) e a flag `--fixture`:

```bash
node scripts/generate-hub.mjs --fixture
```

Comportamento:
- Coleta tickets/specs apenas da fixture da skill (`fixtures/minimal-scratch/`), ignorando path posicional e o `.scratch` do cwd.
- Escreve o HTML de teste em `fixtures/hub-fixture.html` (ao lado da fixture, relativo à skill).
- Roda smoke estrutural no HTML gerado e sai com código ≠ 0 se falhar. Verifica:
  - presença de corpo MD (`.md-body`);
  - marcadores de side panel (`side-panel` e `role="dialog"`);
  - ausência de `<iframe`;
  - presença de `--accent: #22c55e` (fixture sem marca → default);
  - presença de `--accent-fg` e `project-hub-theme-source=default`;
  - ausência do indigo de marca `--primary: #6366f1`;
  - presença de `contentHtml` no payload JSON;
  - checagens das helpers de inferência (`light-dark`, rejeição de near-black).
- Em sucesso: exit 0 e log do path do HTML.

Flags existentes (`--docs`, `--open`, path posicional do repo) continuam iguais quando `--fixture` não está presente.

### Design contract do Project Hub

Antes de alterar o gerador ou o visual do hub, leia o contrato em `templates/hub-design-contract.md`.

O job da tela é escanear o Kanban, ler Markdown tipográfico (ticket, spec, regras, GRAPH_REPORT) e copiar o prompt de despacho. O artefato é single-file offline, sem CDN, com regeneração idempotente a partir dos Markdown em `.scratch/`. Tickets, specs, regras e relatório do grafo usam documento tipográfico. O detalhe abre em side panel à direita. A direção visual é neutro zinc/slate com accent verde por padrão; o gerador infere a cor de marca do projeto (CSS vars, theme-color, Tailwind) quando houver sinal confiável. Rejeitar indigo/purple default de LLM, emoji nos labels de chrome, lift/sombra teatral no hover e rounded/pill excessivo como identidade.

### 5. Conclusão e orientações

Apresente o link clicável do dashboard no terminal:
`file://<caminho-absoluto>/.scratch/index.html`

Oriente o usuário sobre o fluxo de trabalho integrado:
- **/to-spec**: crie especificações conversacionais diretamente em `.scratch/<feature>/spec.md`.
- **/to-tickets**: quebre as specs em fatias verticais (*tracer bullets*) em `.scratch/<feature>/issues/<NN>-<slug>.md`.
- Ambos os comandos atualizarão automaticamente o dashboard do projeto ao final de sua execução.
