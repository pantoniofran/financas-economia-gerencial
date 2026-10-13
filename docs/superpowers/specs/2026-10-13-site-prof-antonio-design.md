# Site do Prof. Antonio Francisco: especificação do MVP

Data: 13/10/2026
Autor do pedido: Pedro (surpresa para o pai)
Site atual: https://pantoniofran.wixsite.com/sitio

## 1. Objetivo

Substituir o site Wix do Prof. Dr. Antonio Francisco de A. da Silva Jr. (Escola de Administração da UFBA, "Finanças e Economia Gerencial") por um site rápido, legível para alunos e editável por ele dentro da própria página.

O MVP é publicado como Artifact no Claude e serve para mostrar ao professor. Domínio próprio é a fase 2.

### Critérios de sucesso

1. Todo o conteúdo do site atual está no novo, com cada material rotulado por nome.
2. O aluno chega a qualquer aula em até dois toques a partir do Início.
3. O professor altera texto, aula, material e aviso sem sair da página e sem ajuda.
4. Abertura com até 15 requisições e até 500 KB antes do vídeo (Wix hoje: 146 requisições, cerca de 1 MB).

## 2. Diagnóstico do site atual

- 7 disciplinas: Economia Gerencial, Finanças Corporativas 1, Finanças Corporativas 2, Seminários em Finanças (graduação); Finanças Corporativas, Avaliação Econômica de Projetos, Finanças Sustentáveis/Verdes (pós).
- Conteúdo farto e escondido: só Economia Gerencial tem 62 links (PDF, YouTube, planilha) em 7 módulos, exibidos como ícones sem texto.
- Páginas "Graduação" e "Pós-grad" vazias. Rótulos abreviados no Laboratório. Blog parado em 09/2020, com um post de exemplo do Wix.
- Todos os arquivos estão hospedados no Wix (`filesusr.com`).

## 3. Decisões tomadas

| Tema | Decisão |
|---|---|
| Edição | Dentro do próprio site, com botão "Editar" |
| Escopo de conteúdo | Tudo migrado; arquivos continuam no Wix nesta fase |
| Novidades | Mural de avisos, ficha da disciplina, página de publicações e projetos, página Sobre |
| Fora do MVP | Busca e progresso do aluno |
| Visual | Direção "Caderno acadêmico", enxugada: fundo quase branco, títulos em serifa, um único verde escuro, minimalista |
| Arquitetura | Página única que se republica (capacidade `artifact`, forma `html`) |
| Vídeo | Estrutura de player em cada aula; no Claude abre o YouTube em nova aba; fora do Claude toca embutido |
| Anexos | Colar link ou enviar arquivo (até 20 MB) |
| Imagens | Higgsfield: 1 vídeo em loop na abertura e 7 capas estáticas, abstratas; nenhuma imagem do professor gerada por IA |

## 4. Páginas

| Página | Rota | Conteúdo | Origem |
|---|---|---|---|
| Início | `#inicio` | Abertura com vídeo em loop, avisos recentes, disciplinas por nível, últimos textos | Site atual |
| Disciplina | `#d-<id>` | Capa, mural de avisos, ficha recolhida, módulos e aulas com materiais nomeados | Site atual; ficha e avisos vazios |
| Aula | `#a-<id>` | Player, materiais, aula anterior e próxima | Site atual |
| Laboratório | `#laboratorio` | Planilhas, scripts em R, vídeos, com nomes por extenso | Site atual |
| Textos | `#textos`, `#t-<id>` | 3 artigos reais | Site atual, sem o post de exemplo |
| Pesquisa | `#pesquisa` | Linhas, projetos, grupo CNPq, publicações agrupadas por ano | Site atual |
| Sobre | `#sobre` | Resumo, linha do tempo de formação, áreas, orientações concluídas, Lattes, contato, resumo em inglês | Escavador (Lattes de 02/04/2025) e site atual |

As rotas usam apenas letras, dígitos e hífen, pois o Artifact só repassa âncoras simples.

Regras de leitura:
- Sem banner de entrada: a primeira tela do Início já lista as disciplinas.
- Ficha da disciplina recolhida por padrão; campos vazios não aparecem para o aluno.
- Aviso com data "mostrar até"; depois dela some sozinho. Sem avisos válidos, o bloco não aparece.
- E-mail exibido como texto com botão de copiar (links `mailto:` não são confiáveis no Artifact).
- Todo link tem texto visível. Links externos abrem em nova aba.

Página Sobre: usar só o que confere com o site do professor. Não publicar nível de idioma nem participação em bancas. Sem foto real, exibir monograma "AF".

## 5. Modo de edição

- O botão "Editar" só aparece para quem pode escrever no Artifact. A primeira recusa de escrita (`not_writer`, `not_granted`) esconde o modo de edição de vez.
- Em edição, uma barra fixa mostra o número de alterações, "Descartar" e "Publicar".
- Texto: toca e digita no lugar.
- Listas (avisos, módulos, aulas, materiais, itens do laboratório, textos, publicações, projetos, formação, orientações): adicionar, reordenar com setas, remover com confirmação na própria linha.
- Novo material: tipo (Slides, Vídeo, Exercícios, Planilha, Código, Link), endereço colado ou arquivo enviado, nome visível com padrão definido pelo tipo. Link do YouTube é reconhecido e vira tipo Vídeo.
- O primeiro material do tipo Vídeo de uma aula é o que aparece no player.
- Nada vai ao ar antes de "Publicar"; todas as alterações sobem em uma única publicação.
- Rascunho não publicado fica guardado no navegador e é restaurado ao voltar.

Fora do MVP: criar ou apagar disciplinas e páginas, trocar imagens e cores, edição simultânea.

### Erros

| Situação | Comportamento |
|---|---|
| Arquivo acima de 20 MB | Mensagem com o limite e sugestão de colar um link |
| Endereço inválido | Campo marcado, material não é adicionado |
| Publicação concorrente (`conflict`) | Rascunho preservado; a página recarrega na versão vencedora e oferece reaplicar |
| Falha temporária | Uma nova tentativa; depois, mensagem "Não foi possível publicar. Suas alterações continuam salvas neste navegador." |
| Publicação muito frequente (`rate_limited`) | Mensagem pedindo para aguardar; sem repetição automática |

## 6. Arquitetura

Um arquivo HTML, sem framework, montado por um script Node a partir de módulos pequenos.

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `conteudo` | Dados do site (JSON) e validação do formato | Nada |
| `telas` | Funções puras: conteúdo → HTML de cada tela | `conteudo` |
| `rotas` | Navegação por âncora | `telas` |
| `edicao` | Rascunho, operações de lista, contagem de alterações, rascunho local | `conteudo` |
| `armazenamento` | Interface `podeEditar()`, `publicar(conteudo)`, `enviarArquivo(blob)` | Ambiente |
| `video` | Player embutido ou link, conforme configuração | Configuração |

Só `armazenamento` e `video` conhecem o ambiente. A montagem gera duas saídas:
- `dist/artifact.html`: salvamento pelo Claude, vídeo como link.
- `dist/local/index.html`: somente leitura, vídeo embutido (`youtube-nocookie.com`, carregado ao clicar).

### Publicação pela própria página

O conteúdo fica num bloco `<script type="application/json">`. Ao publicar, a página regenera o documento completo (esqueleto, título, estilo, dados, script) a partir do seu código-fonte canônico e do conteúdo novo, e chama `artifact.publish(html)`. Nunca serializa o DOM.

Usa-se a forma `html`, e não a de arquivos, porque esta é recusada em artifacts com link público.

Capacidades declaradas: `artifact`, `assets`, `user`.

### Mídia

Imagens, vídeo de abertura e miniaturas ficam no armazenamento de arquivos do Artifact, fora da página, para sobreviver às republicações. A página referencia cada arquivo pelo endereço devolvido no envio.

- Vídeo de abertura: sem som, em loop, até 1,5 MB, carregado depois do texto, com imagem de espera. Com "reduzir movimento" ativo, fica só a imagem.
- Capas: WebP, cerca de 60 KB cada, carregamento tardio.
- Miniaturas do YouTube: baixadas uma vez na migração. Vídeo novo adicionado no Claude usa um quadro padrão.

### Modelo de dados (resumo)

```
site: { titulo, professor }
disciplinas[]: { id, nivel, nome, capa, ficha{ementa, objetivos, avaliacao, bibliografia},
                 avisos[]{id, texto, ate},
                 modulos[]{id, titulo, aulas[]{id, titulo, materiais[]{id, tipo, nome, url}}} }
laboratorio[]: { grupo, itens[]{id, nome, tipo, url} }
textos[]: { id, titulo, data, resumo, corpo }
pesquisa: { linhas, grupo{nome, url}, projetos[]{id, titulo, descricao}, publicacoes[]{id, ano, tipo, referencia} }
sobre: { resumo, formacao[]{periodo, titulo, instituicao, detalhe}, areas[], orientacoes[]{ano, nivel, aluno, titulo},
         lattes, email, english }
```

## 7. Migração

1. Extrair todas as páginas do Wix para `conteudo.json`.
2. Tipo do material inferido do ícone e do endereço. Quando não for possível distinguir (dois PDFs na mesma aula), rotular "Material" e listar para conferência do Pedro. Nenhum rótulo é inventado.
3. Ficha da disciplina e avisos entram vazios. Nenhum conteúdo acadêmico é inventado.
4. Publicações e projetos: texto do site atual. Formação e orientações: Escavador.

## 8. Visual

- Cores como tokens, temas claro e escuro: fundo quase branco com leve viés verde, texto quase preto esverdeado, um verde escuro de destaque, um cinza-esverdeado para linhas e texto secundário.
- Tipografia: serifa para títulos, sem serifa para texto e rótulos, algarismos tabulares em listas numéricas. Fontes do Google Fonts com pilha de reserva.
- Leitura em coluna de cerca de 65 caracteres. Margem lateral mínima de 16 px. Nada rola na horizontal.
- Estilo de cartão só no aviso e no player; o resto é lista com linhas finas.
- Movimento: transição curta entre telas e ao abrir a ficha; respeita "reduzir movimento".
- Foco de teclado visível em todos os controles.

## 9. Verificação

1. Paridade: contagem de módulos, aulas e materiais por disciplina igual à do Wix.
2. Links: todos os endereços migrados testados, com relatório dos quebrados.
3. Edição: criar aviso, publicar, reler e confirmar; confirmar que leitor comum não vê controles de edição.
4. Telas: celular e desktop, claro e escuro.
5. Testes automáticos (`node:test`) nas funções puras: validade de aviso, operações de lista, leitura de link do YouTube, validação do conteúdo, geração do documento para publicação.
6. Versão local: player embutido tocando.

## 10. Riscos

| Risco | Tratamento |
|---|---|
| Arquivos somem se a conta Wix for cancelada | Avisar o Pedro; copiar na fase 2 |
| Custo de créditos no Higgsfield | Mostrar saldo e custo; gerar só com confirmação |
| Mídia não persistir após republicação | Primeiro passo da implementação é um teste mínimo; se falhar, embutir imagens na página e dispensar o vídeo |
| Professor sem conta no Claude | Pedro demonstra pela própria conta; acesso dele é pendência |
| Escavador pode misturar homônimos | Usar só dados coerentes com o site do professor; tudo editável |

## 11. Pendências do Pedro

- Foto real do professor.
- Confirmar se o professor tem conta no Claude.
- Aprovar o gasto de créditos no Higgsfield.

## 12. Fase 2 (fora deste documento)

Domínio próprio, hospedagem pública, cópia dos arquivos para fora do Wix, login do professor fora do Claude, player embutido para os alunos.
