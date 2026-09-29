# Demo Feature

## Problem Statement

Operadores precisam de uma feature de demonstracao com Markdown tipografico
para validar o Project Hub sem depender de um repositorio real.

## Solution

Manter uma arvore minima sob `fixtures/minimal-scratch` com spec e tickets
que exercitam headings, listas, enfase e bloqueios entre issues.

## Escopo

1. Como operador, quero ver a spec renderizada com tipografia.
2. Como operador, quero um ticket pronto e outro bloqueado no Kanban.

### Detalhes

- Texto com **negrito**, *italico* e `codigo inline`
- Lista numerada e com marcadores
- Citacao curta:

> Fixture local, sem CDN e sem clones externos.

### Checklist da spec

- [x] Headings e paragrafos
- [ ] Exemplo opcional ainda aberto

---

Codigo de exemplo:

```js
console.log('fixture ok');
```
