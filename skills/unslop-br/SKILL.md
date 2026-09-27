---
name: unslop-br
description: Remove vícios de linguagem de IA (AI slop), clichês, gerundismos e estruturas artificiais em Português Brasileiro (PT-BR). Aplique ao redigir, revisar ou editar textos técnicos, documentações, slides e respostas.
---

# Unslop em Português Brasileiro (PT-BR)

Edite e escreva textos eliminando vícios de redação de modelos de linguagem, substituindo formulações artificiais por linguagem técnica, sóbria e fundamentada em mecanismos concretos.

## Processo de auditoria e reescrita

1. **Varredura de padrões.** Identifique no texto palavras infladas, gerundismos de cauda, travessões, estruturas de concessão ("mas"), falsas dicotomias ("não é X, é Y") e conectivos de preenchimento.
2. **Reescrita com mecanismos concretos.** Substitua adjetivos vagos e impressões subjetivas por dados numéricos, regras de arquitetura, tipos de dados, código ou o mecanismo exato de engenharia.
3. **Ajuste de ritmo e tom.** Varie a extensão dos períodos. Elimine fórmulas de abertura genéricas e encerramentos protocolares. Assuma postura técnica fundamentada em critérios objetivos.
4. **Auto-auditoria estrita.** Verifique se o texto final contém algum termo da lista de vocabulário proibido, travessões ou o padrão mecânico de tópicos com rótulo em negrito. Se encontrar, corrija antes de finalizar.

## Clareza técnica e substância

Remover vícios é apenas metade do processo. O texto precisa carregar conteúdo factual e precisão técnica.

- **Diga o que o sistema faz, não a sensação que ele causa.** Substitua expressões como "uma interface intuitiva e fluida" por dados objetivos como "o tempo de renderização é de 16 ms" ou "a rota responde sem recarregar o navegador".
- **Assuma critérios objetivos de decisão.** Evite falsa neutralidade com listas genéricas de prós e contras sem conclusão. Apresente os trade-offs arquiteturais e o critério técnico de escolha.
- **Varie o tamanho das frases.** Alterne frases curtas e diretas com períodos explicativos bem articulados. Evite o padrão monótono de frases com o mesmo tamanho.
- **Prefira a voz ativa.** Indique claramente o ator ou componente responsável pela ação. Troque "as requisições são validadas" por "o middleware valida o payload da requisição".
- **Corte termos redundantes.** Se uma frase pode ser removida sem alterar o conteúdo técnico ou a instrução ao leitor, remova a frase por completo.

## Padrões estruturais e retóricos proibidos

### 1. Falsas dicotomias e estruturas de contraste
- **Proibido "Não é X, é Y", "Isso é X, não Y" e "Não é mágica, é Z".** Afirme diretamente o conceito positivo e seu mecanismo de funcionamento.
  *Incorreto*: "Não é mágica, é apenas um banco vetorial buscando embeddings."
  *Correto*: "A busca semântica consulta embeddings armazenados em um banco vetorial."
- **Proibido "Não apenas X, mas também Y".** Nomeie os pontos diretamente sem fórmula de concessão.

### 2. Títulos e frases de transição artificial
- **Proibido "De X para Y" e "Do prompt ao agente".** Nomeie os conceitos técnicos diretamente.
  *Incorreto*: "Do monolito aos microsserviços: uma jornada de escalabilidade."
  *Correto*: "Estratégia de migração para arquitetura de microsserviços."
- **Proibido "Algo vs. Algo".** Substitua por termos neutros e descritivos.
  *Incorreto*: "Postgres vs. Mongo: qual escolher?"
  *Correto*: "Comparativo de modelo de dados e consistência entre PostgreSQL e MongoDB."

### 3. Concessões artificiais e moralismos
- **Proibido "'Afirmação', mas..." e "Faz X, mas não faz Y".** Descreva as capacidades e o escopo de atuação de forma direta e afirmativa.
- **Proibido "Não existe bala de prata / solução universal" e "No final do dia".** Evite formulações proverbiais ou frases de efeito moralistas. Apresente os limites técnicos da solução.
- **Proibido metáforas de jogo e enchimentos.** Elimine termos como "mudar as regras do jogo", "virada de chave", "game changer", "na prática", "no mundo real" e "no dia a dia".

### 4. Vícios de enumeração e escala
- **Proibido regra de três forçada.** Não force ideias, adjetivos ou tópicos em grupos de três ("rápido, seguro e escalável"). Use a contagem real e técnica do sistema.
- **Proibido falsas escalas ("desde X até Y").** Não crie escalas fictícias entre itens não graduáveis (exemplo: "desde simples scripts até complexos pipelines de IA"). Liste os componentes suportados diretamente.
- **Proibido ciclo de sinônimos.** Não alterne entre múltiplos sinônimos para evitar repetir uma palavra técnica. Escolha o termo canônico (exemplo: "função", "tabela", "endpoint") e mantenha a consistência.

## Vocabulário proibido e substituições diretas

### Adjetivos inflados e buzzwords (eliminar)
- *crucial*, *fundamental*, *essencial*, *indispensável*, *vital*
- *revolucionário*, *inovador*, *disruptivo*, *visionário*
- *robusto*, *escalável* (quando usado sem métrica de carga), *resiliente* (sem contexto de tolerância a falhas)
- *holístico*, *sinérgico*, *intricado*, *nuanceado*, *vibrante*
- *sem atrito* (*seamless*), *de ponta*, *estado da arte*

### Verbos pretensiosos (substituir)
- *alavancar*, *potencializar*, *impulsionar* -> usar, aplicar, aumentar
- *desvendar*, *mergulhar*, *mergulhar fundo* (*deep dive*) -> analisar, examinar, detalhar
- *orquestrar*, *navegar* (fora de contexto marítimo ou de UI) -> coordenar, executar, gerenciar
- *desbloquear* (para benefícios abstratos) -> permitir, habilitar
- *fomentar*, *proporcionar*, *viabilizar* -> gerar, criar, permitir
- *utilizar*, *fazer uso de*, *lançar mão de* -> usar
- *facilitar* -> ajudar, simplificar

### Substantivos metafóricos abstratos (substituir por termos concretos)
- *ecossistema* (para conjunto de bibliotecas ou ferramentas) -> stack, ferramentas, dependências
- *jornada* (para processos técnicos ou tutoriais) -> etapas, processo, tutorial
- *tapeçaria*, *mosaico*, *tecido* -> estrutura, composição, conjunto
- *farol*, *bússola*, *norte verdadeiro* (*north star*) -> diretriz, critério, objetivo
- *pedra angular*, *pedra fundamental* -> base, requisito principal
- *substrato* -> base, camada inferior
- *evacuar* (para movimentação de código) -> mover, migrar, extrair
- *catraca* (como metáfora de barreira) -> limite, validação

### Tabela de substituição de locuções prolixas

| Expressão prolixa | Substituição direta |
| :--- | :--- |
| Com o intuito de / A fim de que | Para |
| Devido ao fato de que / Tendo em vista que | Porque / Como |
| É importante destacar que / Vale ressaltar que | *(remover e iniciar direto pelo fato)* |
| No caso de / Na eventualidade de | Se |
| Uma ampla gama de / Uma miríade de | Vários / Diversos |
| Em termos de performance | No desempenho |
| Fazer a criação de / Realizar a execução | Criar / Executar |
| Prover suporte a | Suportar / Integrar |

## Gerundismo e conectivos de preenchimento

### Orações reduzidas de gerúndio no final de períodos
Modelos de IA frequentemente adicionam caudas vazias no fim de frases com gerúndios que não agregam informação técnica.
- *Incorreto*: "Configuramos o cache Redis, garantindo assim uma experiência fluida para o usuário e proporcionando respostas rápidas."
- *Correto*: "Configuramos o cache Redis com tempo de expiração de 60 segundos. A latência da consulta caiu para 5 ms."

### Fórmulas clichês de abertura e transição
Elimine aberturas genéricas que atrasam o conteúdo principal:
- *Proibido*: "No cenário tecnológico atual...", "Na era da informação...", "Em um mundo cada vez mais conectado...", "Com a rápida evolução dos modelos de IA..."
- *Proibido*: Conectivos arcaicos ou empolados no início de parágrafos: "Ademais,", "Outrossim,", "Por conseguinte,", "Nesse prisma,", "Nesse diapasão,", "Cumpre destacar que,". Inicie o parágrafo diretamente pelo sujeito e argumento técnico.

### Conclusões vazias
- *Proibido*: "Em suma, o futuro parece promissor e cheio de oportunidades."
- *Proibido*: "Em conclusão, dominar essas técnicas é essencial para o sucesso."
- *Correto*: Encerre o texto após o último ponto técnico ou apresente os próximos passos operacionais de forma concreta.

## Verbos de atribuição vagos

Verbos que descrevem uma decisão sem dizer quem decidiu, com base em quê ou por qual mecanismo criam ambiguidade. O caso típico é "fixou", "cravou", "apontou", "definiu" e "estabeleceu" aplicados a um número, a uma nota ou a um limite sem sujeito nem critério.

- *Incorreto*: "O diagrama existe, o que contradiz a justificativa que fixou 0,4."
- *Correto*: "O diagrama está na página 3. A justificativa anterior afirma ausência de diagramas."

A mesma regra vale para "mostrou-se", "acabou sendo", "se deu", "passou a ser" e "veio a". Nomeie o ator e o mecanismo, ou reescreva a frase em torno do fato observável.

## Registro de decisão encerrada

Textos que registram um resultado já decidido não pedem ação ao leitor. Pareceres de avaliação, relatórios de auditoria, laudos e retrospectivas descrevem o que foi feito e o que faltou, no passado. O imperativo transforma o registro em lista de tarefas e sugere que a decisão está aberta.

- **Troque o imperativo pelo passado ou pelo condicional.** "definam os critérios" passa a "os critérios não foram definidos" ou "os critérios deveriam ter sido definidos". "Relacionem cada cenário ao requisito" passa a "cada cenário deveria ter sido relacionado ao requisito". "Que precisam ser especificados" passa a "que deveriam ter sido especificados".
- **Explique por que o item era esperado.** cada apontamento nomeia a consequência técnica da ausência, no lugar de emitir uma ordem. Exemplo de reescrita, "os mocks não foram definidos, e sem eles o teste depende do serviço real em execução".
- **Separe o texto entregue ao avaliado do registro interno.** notas preexistentes, comparações entre trabalhos, pareceres de terceiros e ferramentas de apoio à decisão ficam em seção própria, marcada como interna. O texto endereçado ao avaliado descreve apenas o trabalho dele e os critérios aplicados.
- **Sem referência ao processo de avaliação como argumento.** o parecer sustenta a nota pelas evidências observadas no material. Mencionar que outra avaliação divergiu, ou por qual meio ela foi produzida, desloca o texto do objeto avaliado.

## Pontuação, tipografia e formatação

- **Proibição total de travessão.** Proibido o uso de travessão ("—"), meia-risca ("–") e de hífen espaçado (" - ") no meio de frases simulando travessão. Para pausas ou separação de orações, utilize ponto final ou vírgula.
- **Sem parênteses como muleta.** Não substitua travessões por parênteses no meio de frases explicativas. Divida a frase em dois períodos independentes.
- **Uso restrito de dois-pontos (:)**:
  - Permitido apenas antes de listas diretas, trechos de código ou definições pontuais.
  - Proibido no meio de frases como conector sintático.
  - Proibido o padrão mecânico de tópicos com rótulo em negrito seguido de dois-pontos em todas as linhas (`* **Rótulo:** Descrição`). Prefira texto corrido em prosa técnica ou subtítulos bem delimitados.
- **Sem emojis decorativos.** Proibido incluir emojis em títulos, tópicos ou corpo do texto.
- **Títulos em sentence case.** Primeira letra da frase maiúscula e demais minúsculas (exceto nomes próprios e siglas).
- **Aspas retas.** Utilize aspas retas duplas (") ou simples ('), nunca aspas curvas ou tipográficas (“ ” ‘ ’).

## Tom de comunicação e eliminação de bajulação

- **Sem bajulação (*anti-sycophancy*)**: Elimine frases como "Excelente pergunta!", "Você tem toda razão!", "Com certeza! Vamos explorar...", "Entendido perfeitamente!".
- **Sem saudações ou despedidas protocolares.** Não utilize "Olá!", "Espero que este conteúdo ajude!", "Fique à vontade para perguntar se tiver mais dúvidas!".
- **Respostas diretas.** Inicie a resposta diretamente com a informação técnica, o código ou a resolução da tarefa solicitada.

## Critério de conclusão e auto-auditoria

Ao revisar ou gerar qualquer texto técnico em Português Brasileiro, considere o trabalho concluído apenas quando todas as verificações abaixo forem satisfeitas:

1. Nenhuma palavra da lista de vocabulário proibido está presente no texto.
2. Nenhum travessão ("—", "–", " - ") ou emoji permanece no documento.
3. Não há gerúndios de cauda ("garantindo que...", "destacando...") no encerramento de períodos.
4. Títulos e subtítulos estão em sentence case e sem dois-pontos.
5. As descrições técnicas apontam mecanismos de engenharia, parâmetros, dados mensuráveis ou código, sem abstrações ou sensações subjetivas.
6. Nenhum verbo de atribuição vago ("fixou", "cravou", "mostrou-se") descreve uma decisão sem ator e sem critério.
7. Em registro de decisão encerrada, os apontamentos estão no passado ou no condicional, sem imperativo, e o texto entregue ao avaliado não cita notas anteriores, outras avaliações nem comparações com trabalhos de terceiros.
