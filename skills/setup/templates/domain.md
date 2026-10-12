# Domain docs: single-context

This repository follows a single-context domain documentation layout.

## Layout

- `CONTEXT.md` (or `AGENTS.md` / `CLAUDE.md`) at the repository root contains the core rules, architecture overview, and conventions.
- `GLOSSARY.md` at the repository root holds the project's ubiquitous language (terms only).
- Architectural Decision Records (ADRs) live in `docs/adr/` as numbered markdown files (e.g. `docs/adr/0001-use-postgres.md`).
- If the repo grows multiple bounded contexts, add a root `GLOSSARY-MAP.md` that points at each context's `GLOSSARY.md` (and optional per-context `docs/adr/`).

Create `GLOSSARY.md` and `docs/adr/` lazily: only when the first term or ADR is ready to write.

## Glossary (`GLOSSARY.md`)

Vocabulary only. Define what a thing **is** in one or two sentences. Pick one canonical term; list rejected synonyms under `_Avoid_`. No implementation details, no specs, no scratch notes, no general programming concepts.

```md
# {Context Name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**:
A customer's request to purchase one or more products.
_Avoid_: Purchase, transaction

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## ADRs (`docs/adr/`)

Number files as `NNNN-slug.md`. Keep the body short:

```md
# {Short title of the decision}

{1–3 sentences: context, choice, and why.}
```

Offer an ADR only when **all three** are true:

1. **Hard to reverse** — changing your mind later is costly
2. **Surprising without context** — a future reader would wonder why it is this way
3. **Real trade-off** — genuine alternatives existed and one was chosen for specific reasons

If any condition is missing, skip the ADR. Optional sections (Status, Considered Options, Consequences) only when they add real value.

## Consumer rules

- `/grilling` (repo sessions): after the frontier is empty, capture settled terms into `GLOSSARY.md` and offer ADRs that clear the bar, before acting on the plan.
- `/to-spec` must use the glossary vocabulary, respect ADRs in the area it touches, and catch up any settled terms or qualifying ADRs from the conversation that are not on disk yet.
- `/to-tickets` must respect existing architecture decisions and use the same vocabulary.
- When an agent makes a non-trivial architectural choice outside those flows, it should propose recording an ADR in `docs/adr/` if the three conditions hold.
