# Skills catalog

Agent skills packaged in this repository, original and vendored, plus the local overlay policy that keeps upstream sync possible.

## Language

**Original skill**:
A skill whose canonical source is this repository, published under MIT.
_Avoid_: first-party skill, local skill

**Vendored skill**:
A skill copied from an upstream package. Local adaptations are listed in ATTRIBUTION.md and reapplied when syncing.
_Avoid_: third-party skill, copied skill

**Overlay**:
A local edit to a vendored skill that keeps that skill's SKILL.md structure.
_Avoid_: fork, rewrite, split

**Home**:
The single authoritative file for a rule, list, or command. Other skills point at it instead of restating it.
_Avoid_: source of truth

**Model-invoked skill**:
A skill whose description stays loaded so the agent may start it on its own, and other skills may reach it.
_Avoid_: always-on skill, autonomous skill

**User-invoked skill**:
A skill with `disable-model-invocation: true`. The operator starts it by name.
_Avoid_: slash-only skill, command-only skill

**Project Hub**:
The generated `.scratch/index.html` dashboard for specs and tickets.
_Avoid_: board (the HTML artifact; `/board` is the command that opens it)
