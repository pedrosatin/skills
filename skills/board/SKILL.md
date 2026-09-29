---
name: board
description: "Abre a board do projeto (Project Hub em .scratch/index.html) no navegador padrão. Use quando o usuário pedir para abrir, mostrar ou visualizar a board do .scratch. Se .scratch/ ou o index.html não existirem, aponta para o /setup e o fluxo /to-spec + /to-tickets que popula a board."
---

# /board

Abre o Project Hub do projeto: o `index.html` gerado dentro de `.scratch/`.

## Processo

### 1. Rodar o script

```sh
node scripts/board.mjs
```

Instalada, a skill fica em `~/.agents/skills/board`:

```sh
node ~/.agents/skills/board/scripts/board.mjs [--root <dir>]
```

O script localiza a raiz do projeto subindo do `cwd` até achar `.scratch/` ou o
root do git, confere se `.scratch/index.html` existe e abre o arquivo no
navegador padrão (`xdg-open`, `open` ou `Start-Process`).

Flags:

- `--root <dir>` — força a raiz do projeto.
- `--print`, `-p` — só resolve e imprime o caminho e a URL `file://`, sem abrir.
- `--json` — saída `{found, root, scratch, path, url, opened}` para o agente decidir.
- `--help`, `-h` — ajuda.

### 2. Interpretar o resultado

**Exit 0** — a board existe. Foi aberta no navegador (ou só impressa com
`--print`). Se a abertura falhar, o script imprime o motivo e a URL para abrir à mão.

**Exit 1** — a board não existe. Não invente um `index.html` nem crie `.scratch/` à
mão. Apresente a orientação do script:

1. `/setup` — cria `.scratch/`, os docs de agente e gera o `index.html`.
2. `/to-spec` — escreve a spec em `.scratch/<feature>/spec.md`.
3. `/to-tickets` — quebra a spec em fatias verticais em
   `.scratch/<feature>/issues/` e regenera a board.

A board nasce vazia; spec e tickets preenchem as colunas. Se o usuário topar,
rode `/setup` em seguida.

### 3. Não editar o HTML à mão

`.scratch/index.html` é gerado pela skill `setup`. Mudança de visual ou de
comportamento entra no gerador, não no arquivo. Se o hub precisar de ajuste,
aponte para a skill `setup` (e para o contrato de design do hub).

## Exemplos

```sh
# Abre a board do diretório atual
node scripts/board.mjs

# Só confere e imprime a URL
node scripts/board.mjs --print

# Projeto em outro diretório, saída estruturada
node scripts/board.mjs --root ~/projetos/app --json
```
