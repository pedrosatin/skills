---
name: board
description: "Abre a board do projeto (Project Hub em .scratch/index.html) no navegador padrão e, quando .scratch/ ou o index.html não existem, aponta o /setup e o fluxo /to-spec + /to-tickets que popula a board."
disable-model-invocation: true
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
root do git, confere se `.scratch/index.html` é um arquivo regular e abre a board
no navegador padrão (`xdg-open`, `open` ou `Start-Process` do PowerShell no
Windows).

Flags:

- `--root <dir>`: força a raiz do projeto.
- `--print`, `-p`: só resolve e imprime o caminho e a URL `file://`, sem abrir.
- `--json`: imprime JSON com o resultado (`{found, root, scratch, path, url, opened|guidance|openError}`) para o agente decidir.
- `--help`, `-h`: ajuda.

### 2. Interpretar o resultado

**Exit 0**: a board existe. Foi aberta no navegador (ou só impressa com
`--print`). Se a abertura falhar, o script imprime o motivo e a URL para abrir à
mão.

**Exit 1**: a board não existe. Não invente um `index.html` nem crie `.scratch/` à
mão. Apresente a orientação do script:

1. `/setup`: cria `.scratch/`, os docs de agente e gera o `index.html`.
2. `/to-spec`: escreve a spec em `.scratch/<feature>/spec.md`.
3. `/to-tickets`: quebra a spec em fatias verticais em
   `.scratch/<feature>/issues/` e regenera a board.

A board começa sem cards; spec e tickets adicionam os cards. Se o usuário topar,
rode `/setup` em seguida.

### 3. Não editar o HTML à mão

`.scratch/index.html` é gerado pela skill `setup`. Mudança de visual ou
comportamento entra no gerador da skill `setup`. Se a board precisar de ajuste,
aponte para a skill `setup` (e para o contrato de design da board).

## Exemplos

```sh
# Abre a board do diretório atual
node scripts/board.mjs

# Só confere e imprime a URL
node scripts/board.mjs --print

# Projeto em outro diretório, saída estruturada
node scripts/board.mjs --root ~/projetos/app --json
```
