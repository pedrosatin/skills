# Demo Feature

## Problem Statement

Operadores precisam de uma feature de demonstração com Markdown tipográfico
para validar o Project Hub sem depender de um repositório real.

## Solution

Manter uma árvore mínima sob `fixtures/minimal-scratch` com spec e tickets
que exercitam headings, listas, ênfase e bloqueios entre issues.

## Escopo

1. Como operador, quero ver a spec renderizada com tipografia.
2. Como operador, quero um ticket pronto e outro bloqueado no Kanban.

### Detalhes

- Texto com **negrito**, *itálico* e `código inline`
- Lista numerada e com marcadores
- Citação curta:

> Fixture local, sem CDN e sem clones externos.

### Checklist da spec

- [x] Headings e parágrafos
- [ ] Exemplo opcional ainda aberto

---

Código de exemplo:

```js
console.log('fixture ok');
```
