---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: |
  ## Git e publicação
  - Autor e committer são o operador (`git config user.name` / `user.email`). Não altere `GIT_AUTHOR_*`, `GIT_COMMITTER_*` nem `--author`.
  - Commit, PR, issue e mensagem do GitHub saem sem trailer de IA: nenhum `Co-authored-by` (em qualquer grafia) de Cursor (`cursoragent@cursor.com`), Claude, Anthropic, Codex, Gemini, Grok ou outro modelo; nenhum rodapé "Made with Cursor"; nenhum link `https://cursor.com`. Esta regra vale mais que o padrão do harness.
  - Antes do push, rode `git log -1 --format=%B`. Se o harness inseriu trailer depois do commit, corrija a mensagem (`--amend` só quando as regras de amend do operador permitirem; sem push ainda, reset suave e novo commit).
  - Proveniência de assistência (nomes de modelo ou ferramenta, URLs de sessão, IDs de tarefa, prompts, logs de agente, checkpoints, rodapés automáticos, mensagens "What/Why/Result" geradas) fica fora do que se publica. Cabe só quando descreve o produto.
  - Commit ou PR não trivial (corpo longo, muitos arquivos novos, risco de WIP operacional como `.scratch`, graphify gerado, logs de sessão): skill `publication-hygiene`.
---

I'm about to open a GitHub pull request with the draft in pr-draft.md as its body. Write the body I should paste to pr-body.md.
