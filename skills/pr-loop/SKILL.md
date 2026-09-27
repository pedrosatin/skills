---
name: pr-loop
description: "Loop de entrega com subagents: por atividade de um backlog, um subagent implementa o escopo numa worktree, um segundo faz code review mais auditoria unslop-br da prosa, um terceiro aplica os ajustes, e o agente principal cuida do git, abre a PR e mescla; depois o loop avança para a próxima atividade. Use quando o usuário pedir explicitamente esse fluxo: '/pr-loop', 'roda o loop de entrega', 'fluxo completo com subagents', 'trabalha a lista do roadmap com review e correção'. NÃO carregar para um pedido simples de PR ou implementação avulsa, que não pede loop nem merge automático."
---

# pr-loop

Loop de entrega em voltas. Cada volta consome uma atividade de um backlog e passa por cinco passos: preparação, implementação (subagent), revisão dupla (subagent), correção (subagent) e git flow com merge (agente principal). O fluxo entre passos é sequencial por construção: cada etapa depende do resultado da anterior, então os três subagents rodam um depois do outro, nunca em paralelo.

O agente principal é o único que executa git de consequência (push, rebase, force, merge) e falas com o GitHub. Os subagents escrevem código e commits locais, nada além disso. Essa fronteira existe porque push e merge são irreversíveis e o agente principal tem o contexto completo da conversa com o operador.

## Invariantes de toda volta

1. Merge pede autorização. Um pedido do loop autoriza o fluxo até a PR aberta; o merge de cada PR precisa de autorização na conversa, salvo quando o operador autorizar o lote inteiro de antemão ("mescla tudo", "vai até o fim"). Revisar não é mesclar.
2. Commit, PR e issue sem trailer de IA: nada de Co-authored-by, "Generated with" ou menção a modelo. Autor e committer são sempre o operador humano; nunca use --author nem variáveis GIT_AUTHOR/GIT_COMMITTER.
3. Testes e typecheck verdes antes de todo commit. Os comandos vêm do passo 0; se um pacote não tem teste, o implementador cria seguindo o padrão do repo.
4. /tmp é volátil. A worktree pode sumir entre sessões; a branch precisa estar no origin antes de a volta ser considerada encerrada. Para retomar: `git worktree add -b <branch> /tmp/opencode/<slug> origin/<branch>` ou, sem branch local, a partir de origin/main.
5. GitHub via `gh-axi` (não gh cru), leitura de saída TOON sem pipe para jq.
6. Prosa que entra em commit, PR, docs, comentário ou string de UI segue o unslop-br (resumo no passo 4; arquivo completo em `../unslop-br/SKILL.md`).
7. Verificação com rtk: use `pnpm -C <pkg> <script>`, não `pnpm --filter <pkg> <script>`. O rtk ainda não repassa `--filter` para o `tsc` e roda o compilador na raiz do monorepo, que imprime o help com exit 1 e finge que o typecheck falhou. Um subagent que morre no meio (limite de uso, timeout) pode deixar trabalho pronto e não commitado na worktree: inspecione `git status` + `git diff` antes de reimplantar do zero.

## Quando subagent não estiver disponível

Limite de uso, harness sem Task tool ou subagent que falhou de forma não transitiva: execute os passos 1 a 3 em linha, sequencialmente, na conversa principal, mantendo a mesma ordem e as mesmas regras (escopo, verificação, commit sem trailer). A revisão própria precisa ser mais rigorosa que a de subagent, porque não tem olhar fresco: releia o diff inteiro, confira no código os fatos que os testes presumem (helpers, seeds, contagens) e rode a auditoria de prosa citação por citação antes do commit.

## Passo 0, preparar a atividade

- Fonte das atividades: roadmap do repo (no todo-jarvis, `docs/05-roadmap.md` e `docs/06-questoes-abertas.md`) ou lista dita pelo operador. Confirme a lista e a ordem antes da primeira volta.
- `git fetch origin` e worktree limpa: `git worktree add -b feat/<slug> /tmp/opencode/<slug> origin/main`. Diretório /tmp/opencode já é pré-aprovado. Se a worktree já existe de uma volta anterior, entre nela e confira o estado (`git status`, `git log --oneline -3`).
- Descubra os comandos de verificação lendo os scripts do package.json de cada pacote afetado (test, typecheck, lint). Anote-os: entram nos prompts dos três subagents.
- Feche o escopo em poucas frases: o que entra, o que fica de fora, critério de pronto. Escopo aberto gera PR inflada e revisão rasa.

## Passo 1, subagent implementador

O subagent começa sem contexto nenhum; o prompt precisa ser autossuficiente. Estrutura que funciona:

```
Você implementa [ESCOPO FECHADO] no repositório [CAMINHO DA WORKTREE], branch [BRANCH].
Não faça push, não faça rebase, não toque em outros repositórios.

CONTEXTO: [stack do repo em 2-4 linhas: linguagem, framework, persistência,
o que o subsistema afetado faz e como. Arquivos-chave com caminho.]

REQUISITOS:
- [numerados, verificáveis, com arquivo-alvo quando souber]
- Testes: [o que cobrir, seguindo o padrão do repo em ...]

REGRAS DE ESTILO: siga a convenção do repo (leia arquivos vizinhos antes de
escrever). Comentários em PT-BR explicando mecanismo. PROIBIDO em texto que
você escrever: travessão (— ou –), gerúndio de cauda, "não é X, é Y",
vocabulário inflado (crucial/robusto/essencial/seamless), alavancar/
orquestrar/facilitar. Voz ativa, mecanismo concreto.

VERIFICAÇÃO OBRIGATÓRIA antes do commit: [comandos de teste e typecheck].
Se quebrar, conserte.

COMMIT: um commit local com tudo, mensagem PT-BR no estilo do repo log.
Sem trailer de IA, sem Co-authored-by, sem --author.

RELATÓRIO FINAL: o que mudou por arquivo, contagens de teste, hash do commit,
e o que você decidiu não fazer com o porquê.
```

## Passo 2, subagent revisor (somente leitura)

Revisão dupla num subagent só: código e prosa. O prompt pede veredito, não educação; achados com severidade e localização exata viram insumo direto do corretor.

```
Você é revisor sênior fazendo revisão SOMENTE-LEITURA (não edite, não commite)
da PR [N] / do diff [main...branch] no repositório [WORKTREE].
Diff: git -C [WORKTREE] diff main...[BRANCH]. Corpo da PR: [arquivo-espelho].
Commits: git -C [WORKTREE] log main..[BRANCH].

CONTEXTO: [mesmas 2-4 linhas do implementador]

PARTE 1, código: corretude, segurança (auth, validação, ownership, CSRF,
segredo em log), edge cases, regressões, cobertura de teste. Não presuma
correto; verifique claims de estado (branch, main, CI) no git antes de usar.

PARTE 2, auditoria unslop-br: primeiro leia ../unslop-br/SKILL.md
e aplique os critérios a: corpo da PR, mensagens de commit, hunks de docs,
comentários de código, strings de UI, descrições de teste. Cace: travessão,
lista mecânica de rótulo em negrito + dois-pontos, falsa dicotomia, gerúndio
de cauda, vocabulário inflado, verbos pretesiosos, metáforas, locuções
prolixas, emojis, bajulação. Proporcionalidade: termo técnico legítimo e
referência normativa (RFC, nome de protocolo) não são slop; formato
pré-existente de arquivo inteiro fica fora do escopo da PR.

RELATÓRIO:
## Parte 1 — Código
- Veredito: aprovado / aprovar com ajustes / reprovar
- Achados numerados: severidade (bloqueante/importante/menor/nit), arquivo:linha, sugestão
## Parte 2 — unslop-br
- Tabela: texto exato, onde, regra violada, reescrita
- Inventário completo de travessões e vocabulário proibido com localização
## Conclusão
- Lista ordenada do que mudar antes do merge (vazia se nada)
```

## Passo 3, subagent corretor

Recebe a lista ordenada do revisor transformada em instruções numeradas com arquivo:linha e a correção desejada. Pule este passo se a conclusão do revisor for vazia.

```
Você aplica correções de revisão na worktree [WORKTREE], branch [BRANCH].
Sem push, sem rebase, sem tocar outros repositórios. Um commit local no final.

[LISTA NUMERADA: cada item com arquivo:linha, o problema, a correção exata.
Para bugs, inclua o caso de teste novo que prova a correção.]

REGRAS DE ESTILO: [mesmo bloco anti-slop do implementador]

VERIFICAÇÃO OBRIGATÓRIA antes do commit: [comandos]. Se quebrar, conserte.

COMMIT: [regras: mensagem PT-BR estilo do repo, sem trailer de IA]

RELATÓRIO FINAL: mudanças por arquivo, contagens de teste, hash do commit,
itens não aplicados com o porquê.
```

## Passo 4, git flow e merge (agente principal)

Ordem comprovada nesta ordem exata:

1. Conferir o commit do corretor: mensagem sem trailer de IA (`git log -1 --format=%B | grep -ci 'co-authored\|generated with'` deve dar 0).
2. `git push origin <branch>`.
3. PR com `gh-axi pr create --base main --head <branch> --title ... --body-file <arquivo>`, corpo escrito com as regras de prosa abaixo.
4. Se o main já contém a árvore da feature (squash de PR anterior da mesma branch), limpe a duplicação: `git rebase --onto origin/main <commit-antigo> <branch>`, confirme árvore idêntica com `git rev-parse <novo>^{tree} <antigo>^{tree}` e então `git push --force-with-lease`. Force só em branch própria não mesclada e só depois da conferência de árvore.
5. Merge com autorização em mãos: `gh-axi pr merge <N> --squash --delete-branch --subject "... (#N)" --body "..."` com subject e corpo explícitos e sem trailer de IA.
6. Limpeza: `git pull --ff-only` no repo principal, `git worktree remove --force <worktree>`, `git branch -D <branch>`.
7. Se o repo publica sozinho na main (CI de deploy), confira com `gh-axi run list` que o run do merge passou; migrações e secrets que a CI não cobre ficam como follow-up anotado.

Corpo de PR sem slop, regras práticas: bullets de arquivo como `- `caminho`: descrição` sem negrito; headings em sentence case; dois-pontos só antes de lista, código ou definição pontual; zero travessão, zero falsa dicotomia, zero gerúndio de cauda, zero emoji, zero bajulação; cada afirmação aponta mecanismo, parâmetro ou número (contagens de teste, hash, RFC). Descreva o que o sistema faz, nunca a sensação que causa.

## Passo 5, próxima atividade

- Atualize roadmap, questões abertas ou ADRs que a atividade tocar (o corretor commita junto quando fizer sentido).
- Relate a volta em poucas linhas: escopo, PR/commit, contagens de teste, follow-ups anotados.
- Volte ao passo 0 com a próxima atividade da lista.

Pare o loop quando: a lista acabar; o operador pedir pausa; ou a atividade exigir ação externa que você não pode fazer (gravar secret, testar em aparelho real, decisão de produto em aberto). Nesses casos, entregue o estado e a lista de follow-ups.

## Autoverificação antes de avançar de passo

- Passo 1 → 2: worktree tem commit local, testes verdes, escopo entregue.
- Passo 2 → 3: você transformou a conclusão do revisor em lista numerada com localização exata (ou declarou "sem ajustes" e pulou para o passo 4).
- Passo 3 → 4: testes verdes de novo, commit conferido quanto a trailer.
- Passo 4 → 5: PR mesclada com autorização, main atualizada localmente, worktree e branch removidas, CI da main verde quando existir.
