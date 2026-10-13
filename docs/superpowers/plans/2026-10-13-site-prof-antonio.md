# Site do Prof. Antonio Francisco: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar como Artifact no Claude um site de página única, rápido e editável no lugar, com todo o conteúdo do site Wix do Prof. Antonio Francisco.

**Architecture:** Funções puras transformam um bloco de conteúdo JSON em HTML; uma camada de aplicação cuida de eventos, rascunho e publicação. A página se republica chamando `artifact.publish(html)` com o documento regenerado a partir do próprio código-fonte e do conteúdo novo. Um script Node gera duas saídas do mesmo código: `dist/artifact.html` (Claude) e `dist/local/index.html` (player do YouTube embutido).

**Tech Stack:** JavaScript (ES modules) sem framework, Node 24, `node:test`, esbuild 0.25.0 (única dependência, só de desenvolvimento), ffmpeg para comprimir mídia, Higgsfield para gerar imagens.

**Spec:** `docs/superpowers/specs/2026-10-13-site-prof-antonio-design.md`

## Global Constraints

- Raiz do projeto: `C:\Users\pedro\Downloads\Claude Code\site-prof-antonio`. Todos os caminhos abaixo são relativos a ela. Ela tem repositório git próprio; nunca rodar `git` um nível acima.
- Todo texto visível em português do Brasil. Nenhum conteúdo acadêmico inventado: ementa, objetivos, avaliação, bibliografia e avisos entram vazios.
- Nenhuma imagem do professor gerada por IA. Sem foto real, usar o monograma "AF".
- Rotas só com letras, dígitos e hífen (`#inicio`, `#d-eg`, `#a-eg-1-3`).
- No Artifact é proibido: iframe, imagem ou mídia de outro domínio, `fetch` externo, `alert/confirm/prompt`, link `mailto:` como única forma de contato, `<a download>`.
- Scripts externos: nenhum. Folha de estilo externa: só `https://fonts.googleapis.com`.
- Toda cor vem de token definido em `:root`, com versão escura nos dois blocos (`prefers-color-scheme` e `[data-theme="dark"]`).
- Margem lateral mínima de 16 px; o corpo da página nunca rola na horizontal a 400 px de largura.
- Orçamento: `dist/artifact.html` até 300 KB; vídeo de abertura até 1,5 MB; cada capa até 90 KB.
- Capacidades declaradas na publicação: `{ artifact: {}, assets: {} }`.
- Mensagens de commit em inglês, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gasto de créditos no Higgsfield só depois de mostrar saldo e custo ao Pedro e receber "sim".

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Scripts `test` e `build`; dependência esbuild |
| `src/conteudo.json` | Todo o conteúdo do site |
| `src/midia.artifact.json`, `src/midia.local.json` | Mapa nome → endereço de cada imagem e vídeo, por ambiente |
| `src/estilo.css` | Toda a aparência |
| `src/nucleo/youtube.js` | Ler id de vídeo, inferir tipo pelo endereço, validar endereço |
| `src/nucleo/caminhos.js` | Ler e gravar por caminho (`disciplinas.0.nome`) sem mutar |
| `src/nucleo/listas.js` | Mover, remover, inserir, gerar id |
| `src/nucleo/conteudo.js` | Tipos de material, validação, avisos válidos, localizar aula |
| `src/nucleo/edicao.js` | `aplicar(conteudo, op)` e `novoItem(tipo)` |
| `src/nucleo/rascunho.js` | Hash e decisão sobre rascunho salvo |
| `src/nucleo/mensagens.js` | Código de erro → frase em português |
| `src/nucleo/documento.js` | Montar o HTML da página e o documento completo |
| `src/nucleo/telas.js` | Conteúdo → HTML de cada tela, em leitura e em edição |
| `src/app/armazenamento.js` | Única peça que fala com `window.claude` |
| `src/app/principal.js` | Eventos, estado, rascunho local, publicação, vídeo |
| `build.mjs` | Gera `dist/artifact.html` e `dist/local/index.html` |
| `servidor.mjs` | Servidor estático local na porta 4173 |
| `scripts/agrupar.mjs` | Coordenadas extraídas do Wix → módulos, aulas, materiais |
| `scripts/importar-disciplinas.mjs` | Aplica `agrupar` às 7 disciplinas e escreve o relatório |
| `scripts/conferir-links.mjs` | Testa todos os endereços do conteúdo |
| `tests/*.test.js`, `tests/fixtura.js` | Testes do núcleo e dos scripts |
| `migracao/bruto/*.json`, `migracao/*.md` | Dados extraídos e relatórios para o Pedro |
| `midia/` | Imagens e vídeo finais, já comprimidos |

---

### Task 1: Projeto e leitura de endereços

**Files:**
- Create: `package.json`, `src/nucleo/youtube.js`
- Test: `tests/youtube.test.js`

**Interfaces:**
- Produces: `idDoYoutube(url: string): string | null`; `tipoPorUrl(url: string): 'video' | 'planilha' | 'codigo' | 'slides' | 'link'`; `urlValida(url: string): boolean`

- [ ] **Step 1: Criar `package.json` e instalar**

```json
{
  "name": "site-prof-antonio",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.mjs"
  },
  "devDependencies": {
    "esbuild": "0.25.0"
  }
}
```

Run: `npm install`
Expected: cria `node_modules/` e `package-lock.json`, sem erros.

- [ ] **Step 2: Escrever o teste que falha**

`tests/youtube.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idDoYoutube, tipoPorUrl, urlValida } from '../src/nucleo/youtube.js';

test('idDoYoutube lê os formatos usados no site', () => {
  assert.equal(idDoYoutube('https://youtu.be/YHzoeE7-0sc'), 'YHzoeE7-0sc');
  assert.equal(idDoYoutube('https://www.youtube.com/watch?v=X7ANRp74wfk'), 'X7ANRp74wfk');
  assert.equal(idDoYoutube('https://www.youtube.com/watch?feature=share&v=_-iSF1mci-o'), '_-iSF1mci-o');
  assert.equal(idDoYoutube('https://www.youtube.com/embed/r3zU1NqWwG0'), 'r3zU1NqWwG0');
});

test('idDoYoutube devolve null para o que não é vídeo', () => {
  assert.equal(idDoYoutube('https://exemplo.com/a.pdf'), null);
  assert.equal(idDoYoutube(''), null);
  assert.equal(idDoYoutube(undefined), null);
});

test('tipoPorUrl ignora o que vem depois de ? e reconhece arquivos do Wix', () => {
  assert.equal(tipoPorUrl('https://youtu.be/YHzoeE7-0sc'), 'video');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_05f7.xlsx?dn=Sorvete.xlsx'), 'planilha');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_64bd.xls?dn=E'), 'planilha');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_521d.txt?dn=P'), 'codigo');
  assert.equal(tipoPorUrl('https://github.com/pantoniofran/GitSeminarioFinancas.git'), 'codigo');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_0926.pdf'), 'slides');
  assert.equal(tipoPorUrl('https://exemplo.com/pagina'), 'link');
});

test('urlValida aceita só http e https', () => {
  assert.equal(urlValida('https://exemplo.com/a.pdf'), true);
  assert.equal(urlValida('http://dgp.cnpq.br/dgp/espelhogrupo/185576'), true);
  assert.equal(urlValida('exemplo.com'), false);
  assert.equal(urlValida('javascript:alert(1)'), false);
  assert.equal(urlValida(''), false);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module ... src/nucleo/youtube.js`

- [ ] **Step 4: Implementar**

`src/nucleo/youtube.js`:

```js
const PADRAO = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;

export function idDoYoutube(url) {
  const m = PADRAO.exec(String(url ?? ''));
  return m ? m[1] : null;
}

export function tipoPorUrl(url) {
  if (idDoYoutube(url)) return 'video';
  const base = String(url ?? '').split(/[?#]/)[0].toLowerCase();
  if (/\.(xlsx?|csv|ods)$/.test(base)) return 'planilha';
  if (/\.(r|py|ipynb|txt)$/.test(base) || base.includes('github.com')) return 'codigo';
  if (base.endsWith('.pdf')) return 'slides';
  return 'link';
}

export function urlValida(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: 4 testes, 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/nucleo/youtube.js tests/youtube.test.js
git commit -m "feat: project scaffold and URL helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Operações de edição

**Files:**
- Create: `src/nucleo/caminhos.js`, `src/nucleo/listas.js`, `src/nucleo/edicao.js`
- Test: `tests/edicao.test.js`

**Interfaces:**
- Produces:
  - `ler(obj, caminho: string): any`; `gravar(obj, caminho: string, valor): obj` (cópia; não muta)
  - `mover(lista, i, delta): lista`; `remover(lista, i): lista`; `inserir(lista, item): lista`; `novoId(prefixo: string, rand?: () => number): string`
  - `aplicar(conteudo, op): conteudo`, com `op` em um destes formatos: `{ op: 'gravar', caminho, valor }`, `{ op: 'subir' | 'descer' | 'remover', lista, i }`, `{ op: 'adicionar', lista, item }`
  - `novoItem(tipo, hoje: 'AAAA-MM-DD', rand?): object`, com `tipo` em `'aviso' | 'modulo' | 'aula' | 'texto' | 'projeto' | 'publicacao' | 'formacao' | 'orientacao'`

- [ ] **Step 1: Escrever o teste que falha**

`tests/edicao.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ler, gravar } from '../src/nucleo/caminhos.js';
import { mover, remover, inserir, novoId } from '../src/nucleo/listas.js';
import { aplicar, novoItem } from '../src/nucleo/edicao.js';

const base = () => ({ site: { titulo: 'A' }, itens: [{ n: 'um' }, { n: 'dois' }, { n: 'três' }] });

test('ler segue o caminho e devolve undefined se não existe', () => {
  assert.equal(ler(base(), 'itens.1.n'), 'dois');
  assert.equal(ler(base(), 'itens.9.n'), undefined);
});

test('gravar copia o caminho e não muta o original', () => {
  const antes = base();
  const depois = gravar(antes, 'itens.1.n', 'DOIS');
  assert.equal(depois.itens[1].n, 'DOIS');
  assert.equal(antes.itens[1].n, 'dois');
  assert.equal(depois.itens[0], antes.itens[0]);
  assert.notEqual(depois.itens, antes.itens);
});

test('mover troca vizinhos e ignora movimento para fora da lista', () => {
  assert.deepEqual(mover(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(mover(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b']);
  const l = ['a', 'b'];
  assert.equal(mover(l, 0, -1), l);
  assert.equal(mover(l, 1, 1), l);
});

test('remover e inserir devolvem lista nova', () => {
  assert.deepEqual(remover(['a', 'b', 'c'], 1), ['a', 'c']);
  assert.deepEqual(inserir(['a'], 'b'), ['a', 'b']);
});

test('novoId usa só letras minúsculas, dígitos e hífen', () => {
  assert.match(novoId('au'), /^au-[a-z0-9]{5}$/);
  assert.equal(novoId('au', () => 0), 'au-00000');
});

test('aplicar cobre gravar, subir, descer, remover e adicionar', () => {
  const c = base();
  assert.equal(aplicar(c, { op: 'gravar', caminho: 'site.titulo', valor: 'B' }).site.titulo, 'B');
  assert.deepEqual(aplicar(c, { op: 'subir', lista: 'itens', i: 2 }).itens.map((x) => x.n), ['um', 'três', 'dois']);
  assert.deepEqual(aplicar(c, { op: 'descer', lista: 'itens', i: 0 }).itens.map((x) => x.n), ['dois', 'um', 'três']);
  assert.deepEqual(aplicar(c, { op: 'remover', lista: 'itens', i: 0 }).itens.map((x) => x.n), ['dois', 'três']);
  assert.equal(aplicar(c, { op: 'adicionar', lista: 'itens', item: { n: 'quatro' } }).itens.length, 4);
  assert.equal(c.itens.length, 3);
});

test('aplicar rejeita operação desconhecida', () => {
  assert.throws(() => aplicar(base(), { op: 'explodir' }), /operação desconhecida/);
});

test('novoItem cria cada tipo com os campos que as telas esperam', () => {
  const r = () => 0;
  assert.deepEqual(novoItem('aviso', '2026-10-13', r), { id: 'av-00000', texto: '', ate: '' });
  assert.deepEqual(novoItem('modulo', '2026-10-13', r), { id: 'mo-00000', titulo: '', aulas: [] });
  assert.deepEqual(novoItem('aula', '2026-10-13', r), { id: 'au-00000', titulo: '', materiais: [] });
  assert.deepEqual(novoItem('texto', '2026-10-13', r), { id: 'tx-00000', titulo: '', data: '2026-10-13', resumo: '', corpo: '' });
  assert.deepEqual(novoItem('projeto', '2026-10-13', r), { id: 'pj-00000', titulo: '', descricao: '' });
  assert.deepEqual(novoItem('publicacao', '2026-10-13', r), { id: 'pb-00000', ano: '2026', tipo: 'artigo', referencia: '' });
  assert.deepEqual(novoItem('formacao', '2026-10-13', r), { id: 'fo-00000', periodo: '', titulo: '', instituicao: '', detalhe: '' });
  assert.deepEqual(novoItem('orientacao', '2026-10-13', r), { id: 'or-00000', ano: '2026', nivel: 'Mestrado', aluno: '', titulo: '' });
  assert.throws(() => novoItem('foguete', '2026-10-13'), /tipo desconhecido/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module ... src/nucleo/caminhos.js`

- [ ] **Step 3: Implementar os três arquivos**

`src/nucleo/caminhos.js`:

```js
export function ler(obj, caminho) {
  return caminho.split('.').reduce((o, k) => o?.[k], obj);
}

const copiar = (v) => (Array.isArray(v) ? v.slice() : { ...v });

export function gravar(obj, caminho, valor) {
  const chaves = caminho.split('.');
  const raiz = copiar(obj);
  let o = raiz;
  for (const k of chaves.slice(0, -1)) {
    o[k] = copiar(o[k]);
    o = o[k];
  }
  o[chaves.at(-1)] = valor;
  return raiz;
}
```

`src/nucleo/listas.js`:

```js
export function mover(lista, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const c = lista.slice();
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export const remover = (lista, i) => lista.filter((_, k) => k !== i);

export const inserir = (lista, item) => [...lista, item];

export function novoId(prefixo, rand = Math.random) {
  const n = Math.floor(rand() * 36 ** 5);
  return `${prefixo}-${n.toString(36).padStart(5, '0')}`;
}
```

`src/nucleo/edicao.js`:

```js
import { ler, gravar } from './caminhos.js';
import { mover, remover, inserir, novoId } from './listas.js';

export function aplicar(conteudo, op) {
  switch (op.op) {
    case 'gravar':
      return gravar(conteudo, op.caminho, op.valor);
    case 'subir':
      return gravar(conteudo, op.lista, mover(ler(conteudo, op.lista), op.i, -1));
    case 'descer':
      return gravar(conteudo, op.lista, mover(ler(conteudo, op.lista), op.i, 1));
    case 'remover':
      return gravar(conteudo, op.lista, remover(ler(conteudo, op.lista), op.i));
    case 'adicionar':
      return gravar(conteudo, op.lista, inserir(ler(conteudo, op.lista), op.item));
    default:
      throw new Error(`operação desconhecida: ${op.op}`);
  }
}

export function novoItem(tipo, hoje, rand) {
  const ano = hoje.slice(0, 4);
  switch (tipo) {
    case 'aviso': return { id: novoId('av', rand), texto: '', ate: '' };
    case 'modulo': return { id: novoId('mo', rand), titulo: '', aulas: [] };
    case 'aula': return { id: novoId('au', rand), titulo: '', materiais: [] };
    case 'texto': return { id: novoId('tx', rand), titulo: '', data: hoje, resumo: '', corpo: '' };
    case 'projeto': return { id: novoId('pj', rand), titulo: '', descricao: '' };
    case 'publicacao': return { id: novoId('pb', rand), ano, tipo: 'artigo', referencia: '' };
    case 'formacao': return { id: novoId('fo', rand), periodo: '', titulo: '', instituicao: '', detalhe: '' };
    case 'orientacao': return { id: novoId('or', rand), ano, nivel: 'Mestrado', aluno: '', titulo: '' };
    default: throw new Error(`tipo desconhecido: ${tipo}`);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: 12 testes no total, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo/caminhos.js src/nucleo/listas.js src/nucleo/edicao.js tests/edicao.test.js
git commit -m "feat: immutable edit operations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Regras do conteúdo

**Files:**
- Create: `src/nucleo/conteudo.js`, `tests/fixtura.js`
- Test: `tests/conteudo.test.js`

**Interfaces:**
- Produces:
  - `TIPOS: Record<'slides'|'video'|'exercicios'|'planilha'|'codigo'|'link'|'material', { rotulo: string, nome: string }>`
  - `NIVEIS: { graduacao: 'Graduação', pos: 'Pós-graduação' }`
  - `hojeISO(d?: Date): 'AAAA-MM-DD'`
  - `avisosValidos(avisos, hoje): aviso[]`
  - `avisosRecentes(conteudo, hoje): { disciplina, aviso }[]`
  - `acharAula(conteudo, idAula): { disciplina, idx, modulo, aula, im, ia, anterior, proxima } | null`
  - `videoPrincipal(aula): material | null`
  - `validarConteudo(conteudo): string[]` (lista vazia quando válido)
  - `conteudoExemplo(): conteudo` em `tests/fixtura.js`, usado pelos testes das tasks seguintes

- [ ] **Step 1: Criar a fixtura**

`tests/fixtura.js`:

```js
const fichaVazia = () => ({ ementa: '', objetivos: '', avaliacao: '', bibliografia: '' });

export function conteudoExemplo() {
  return {
    site: {
      titulo: 'Finanças e Economia Gerencial',
      professor: 'Prof. Dr. Antonio Francisco',
      instituicao: 'Escola de Administração da UFBA',
      chamada: 'Material de aula, pesquisa e textos em um só lugar.',
      laboratorio: 'Planilhas, scripts e vídeos de apoio às disciplinas.',
      proposito: 'Texto do propósito.',
    },
    disciplinas: [
      {
        id: 'eg', nivel: 'graduacao', nome: 'Economia Gerencial', ficha: fichaVazia(),
        avisos: [
          { id: 'av-1', texto: 'Prova na quinta', ate: '2026-11-12' },
          { id: 'av-2', texto: 'Aviso vencido', ate: '2026-01-01' },
        ],
        modulos: [
          {
            id: 'eg-1', titulo: 'Princípios de Microeconomia',
            aulas: [
              {
                id: 'eg-1-1', titulo: 'Curva de Demanda',
                materiais: [
                  { id: 'eg-1-1-m1', tipo: 'slides', nome: 'Slides da aula', url: 'https://exemplo.com/a.pdf' },
                  { id: 'eg-1-1-m2', tipo: 'video', nome: 'Vídeo da aula', url: 'https://youtu.be/YHzoeE7-0sc' },
                ],
              },
              { id: 'eg-1-2', titulo: 'Custos da Firma', materiais: [] },
            ],
          },
          { id: 'eg-2', titulo: 'Teoria dos Jogos', aulas: [{ id: 'eg-2-1', titulo: 'Definições', materiais: [] }] },
        ],
      },
      { id: 'aep', nivel: 'pos', nome: 'Avaliação Econômica de Projetos', ficha: fichaVazia(), avisos: [], modulos: [] },
    ],
    laboratorio: [
      { grupo: 'Planilhas', itens: [{ id: 'lab-1', tipo: 'planilha', nome: 'Planilha do modelo CAPM', url: 'https://exemplo.com/capm.xls' }] },
    ],
    textos: [
      { id: 'financas-verdes', titulo: 'Finanças Verdes', data: '2020-09-27', resumo: 'Como financiar projetos.', corpo: 'Primeiro parágrafo.\n\nSegundo parágrafo.' },
    ],
    pesquisa: {
      linhas: 'Análise de investimentos e gestão de riscos.',
      grupo: { nome: 'Grupo de Pesquisa em Finanças - UFBA', url: 'http://dgp.cnpq.br/dgp/espelhogrupo/185576' },
      projetos: [{ id: 'pj-1', titulo: 'Green Finance no Brasil', descricao: '' }],
      publicacoes: [
        { id: 'pb-1', ano: '2023', tipo: 'artigo', referencia: 'SANTOS, J. P. Análise envoltória de dados.' },
        { id: 'pb-2', ano: '2021', tipo: 'artigo', referencia: 'CALDAS, A. V. S. Comparative evaluation.' },
      ],
    },
    sobre: {
      nome: 'Antonio Francisco de Almeida da Silva Junior',
      cargo: 'Professor da Escola de Administração da UFBA',
      resumo: 'Resumo do currículo.',
      formacao: [{ id: 'fo-1', periodo: '2004 – 2006', titulo: 'Doutorado', instituicao: 'ITA', detalhe: '' }],
      areas: 'Finanças: risco\nFinanças: investimento',
      orientacoes: [{ id: 'or-1', ano: '2022', nivel: 'Doutorado', aluno: 'Viviane Helena Torinelli', titulo: 'Environmental and Climate Risk Management' }],
      lattes: 'http://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K4796527A6',
      email: 'p.antoniofran@gmail.com',
      english: 'Short vitae.',
    },
  };
}
```

- [ ] **Step 2: Escrever o teste que falha**

`tests/conteudo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, hojeISO, avisosValidos, avisosRecentes, acharAula, videoPrincipal, validarConteudo } from '../src/nucleo/conteudo.js';
import { conteudoExemplo } from './fixtura.js';

test('hojeISO usa a data local', () => {
  assert.equal(hojeISO(new Date(2026, 9, 3)), '2026-10-03');
});

test('avisosValidos descarta vencidos e vazios, e aceita aviso sem data', () => {
  const avisos = [
    { texto: 'vale', ate: '2026-10-13' },
    { texto: 'venceu ontem', ate: '2026-10-12' },
    { texto: 'sem data', ate: '' },
    { texto: '   ', ate: '' },
  ];
  assert.deepEqual(avisosValidos(avisos, '2026-10-13').map((a) => a.texto), ['vale', 'sem data']);
});

test('avisosRecentes junta os avisos válidos de todas as disciplinas', () => {
  const r = avisosRecentes(conteudoExemplo(), '2026-10-13');
  assert.equal(r.length, 1);
  assert.equal(r[0].disciplina.id, 'eg');
  assert.equal(r[0].aviso.texto, 'Prova na quinta');
});

test('acharAula devolve posição e vizinhas, atravessando módulos', () => {
  const c = conteudoExemplo();
  const meio = acharAula(c, 'eg-1-2');
  assert.equal(meio.disciplina.id, 'eg');
  assert.deepEqual([meio.idx, meio.im, meio.ia], [0, 0, 1]);
  assert.equal(meio.anterior.id, 'eg-1-1');
  assert.equal(meio.proxima.id, 'eg-2-1');
  assert.equal(acharAula(c, 'eg-1-1').anterior, null);
  assert.equal(acharAula(c, 'eg-2-1').proxima, null);
  assert.equal(acharAula(c, 'nao-existe'), null);
});

test('videoPrincipal é o primeiro material do tipo vídeo', () => {
  const c = conteudoExemplo();
  assert.equal(videoPrincipal(c.disciplinas[0].modulos[0].aulas[0]).id, 'eg-1-1-m2');
  assert.equal(videoPrincipal(c.disciplinas[0].modulos[0].aulas[1]), null);
});

test('validarConteudo aceita a fixtura', () => {
  assert.deepEqual(validarConteudo(conteudoExemplo()), []);
});

test('validarConteudo aponta id repetido, tipo inválido e material incompleto', () => {
  const c = conteudoExemplo();
  c.disciplinas[0].modulos[1].aulas[0].id = 'eg-1-1';
  c.disciplinas[0].modulos[0].aulas[0].materiais[0].tipo = 'holograma';
  c.disciplinas[0].modulos[0].aulas[0].materiais[1].url = '';
  const erros = validarConteudo(c).join('\n');
  assert.match(erros, /id repetido "eg-1-1"/);
  assert.match(erros, /tipo inválido "holograma"/);
  assert.match(erros, /material sem endereço/);
});

test('validarConteudo aponta seções ausentes sem lançar erro', () => {
  assert.ok(validarConteudo({}).length > 0);
  assert.ok(validarConteudo(null).length > 0);
});

test('todo tipo tem rótulo e nome padrão', () => {
  for (const t of Object.values(TIPOS)) assert.ok(t.rotulo && t.nome);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module ... src/nucleo/conteudo.js`

- [ ] **Step 4: Implementar**

`src/nucleo/conteudo.js`:

```js
export const TIPOS = {
  slides: { rotulo: 'Slides', nome: 'Slides da aula' },
  video: { rotulo: 'Vídeo', nome: 'Vídeo da aula' },
  exercicios: { rotulo: 'Exercícios', nome: 'Lista de exercícios' },
  planilha: { rotulo: 'Planilha', nome: 'Planilha' },
  codigo: { rotulo: 'Código', nome: 'Código' },
  link: { rotulo: 'Link', nome: 'Link' },
  material: { rotulo: 'Material', nome: 'Material' },
};

export const NIVEIS = { graduacao: 'Graduação', pos: 'Pós-graduação' };

export function hojeISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function avisosValidos(avisos = [], hoje) {
  return avisos.filter((a) => a.texto?.trim() && (!a.ate || a.ate >= hoje));
}

export function avisosRecentes(conteudo, hoje) {
  return conteudo.disciplinas.flatMap((disciplina) =>
    avisosValidos(disciplina.avisos, hoje).map((aviso) => ({ disciplina, aviso })));
}

const listarAulas = (disciplina) =>
  disciplina.modulos.flatMap((modulo, im) => modulo.aulas.map((aula, ia) => ({ modulo, aula, im, ia })));

export function acharAula(conteudo, idAula) {
  for (const [idx, disciplina] of conteudo.disciplinas.entries()) {
    const todas = listarAulas(disciplina);
    const i = todas.findIndex((x) => x.aula.id === idAula);
    if (i >= 0) {
      return { disciplina, idx, ...todas[i], anterior: todas[i - 1]?.aula ?? null, proxima: todas[i + 1]?.aula ?? null };
    }
  }
  return null;
}

export function videoPrincipal(aula) {
  return aula.materiais.find((m) => m.tipo === 'video') ?? null;
}

const ID = /^[a-z0-9-]+$/;

export function validarConteudo(c) {
  const erros = [];
  if (!c?.site?.titulo) erros.push('site.titulo ausente');
  for (const chave of ['disciplinas', 'laboratorio', 'textos']) {
    if (!Array.isArray(c?.[chave])) erros.push(`${chave} deve ser uma lista`);
  }
  if (!c?.pesquisa) erros.push('pesquisa ausente');
  if (!c?.sobre) erros.push('sobre ausente');
  if (erros.length) return erros;

  const vistos = new Set();
  const conferirId = (id, onde) => {
    if (typeof id !== 'string' || !ID.test(id)) erros.push(`${onde}: id inválido "${id}"`);
    else if (vistos.has(id)) erros.push(`${onde}: id repetido "${id}"`);
    else vistos.add(id);
  };
  const conferirMaterial = (m, onde) => {
    if (!TIPOS[m.tipo]) erros.push(`${onde}: tipo inválido "${m.tipo}"`);
    if (!m.url) erros.push(`${onde}: material sem endereço`);
    if (!m.nome?.trim()) erros.push(`${onde}: material sem nome`);
  };

  for (const d of c.disciplinas) {
    conferirId(d.id, 'disciplina');
    if (!NIVEIS[d.nivel]) erros.push(`disciplina ${d.id}: nível inválido "${d.nivel}"`);
    for (const m of d.modulos ?? []) {
      for (const a of m.aulas ?? []) {
        conferirId(a.id, `aula em ${d.id}`);
        for (const mat of a.materiais ?? []) conferirMaterial(mat, `aula ${a.id}`);
      }
    }
  }
  for (const g of c.laboratorio) for (const it of g.itens ?? []) conferirMaterial(it, `laboratório, ${g.grupo}`);
  for (const t of c.textos) conferirId(t.id, 'texto');
  return erros;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: 21 testes no total, 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add src/nucleo/conteudo.js tests/fixtura.js tests/conteudo.test.js
git commit -m "feat: content rules and validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Documento, rascunho e mensagens

**Files:**
- Create: `src/nucleo/documento.js`, `src/nucleo/rascunho.js`, `src/nucleo/mensagens.js`
- Test: `tests/documento.test.js`, `tests/rascunho.test.js`

**Interfaces:**
- Produces:
  - `RESET_PADRAO: string`; `jsonSeguro(valor): string`
  - `corpoDaPagina({ titulo, fontes, css, js, conteudo, config }): string` (sem doctype; é o que a ferramenta Artifact recebe)
  - `documentoCompleto(partes, reset?: string): string` (com doctype; é o que `artifact.publish` e a versão local recebem)
  - `hash(texto: string): string`
  - `decidirRascunho(salvo, hashPublicado): 'nenhum' | 'publicado' | 'restaurar' | 'restaurar-desatualizado'`, com `salvo = { base, conteudo, alteracoes } | null`
  - `SEM_ESCRITA: Set<string>`; `NAO_REPETIR: Set<string>`
  - `mensagemDePublicacao(code?: string): string`; `mensagemDeEnvio(code?: string): string`

- [ ] **Step 1: Escrever os testes que falham**

`tests/documento.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonSeguro, corpoDaPagina, documentoCompleto, RESET_PADRAO } from '../src/nucleo/documento.js';

const partes = () => ({
  titulo: 'Finanças & Economia',
  fontes: 'https://fonts.googleapis.com/css2?family=Newsreader&display=swap',
  css: 'body{margin:0}',
  js: 'console.log(1)',
  conteudo: { nome: '</script><b>oi</b>' },
  config: { ambiente: 'artifact', midia: {} },
});

test('jsonSeguro não contém < e volta ao valor original', () => {
  const texto = jsonSeguro({ a: '</script><b>' });
  assert.ok(!texto.includes('<'));
  assert.deepEqual(JSON.parse(texto), { a: '</script><b>' });
});

test('corpoDaPagina começa pelo título, escapado, e não tem doctype', () => {
  const html = corpoDaPagina(partes());
  assert.ok(html.startsWith('<title>Finanças &amp; Economia</title>'));
  assert.ok(!/doctype/i.test(html));
});

test('corpoDaPagina tem os quatro blocos com os ids que o programa lê', () => {
  const html = corpoDaPagina(partes());
  for (const id of ['estilo', 'app', 'conteudo', 'config', 'programa']) assert.ok(html.includes(`id="${id}"`), id);
  const dados = /<script type="application\/json" id="conteudo">(.*?)<\/script>/s.exec(html)[1];
  assert.deepEqual(JSON.parse(dados), { nome: '</script><b>oi</b>' });
});

test('corpoDaPagina fecha exatamente três tags script', () => {
  assert.equal(corpoDaPagina(partes()).split('</script>').length - 1, 3);
});

test('documentoCompleto tem o esqueleto que a ferramenta Artifact reconhece', () => {
  const html = documentoCompleto(partes());
  const inicio = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>';
  assert.ok(html.startsWith(inicio));
  assert.ok(html.includes(`${RESET_PADRAO}</style></head><body><title>`));
  assert.ok(html.endsWith('</body></html>'));
});

test('documentoCompleto usa o reset informado', () => {
  assert.ok(documentoCompleto(partes(), 'x{y:z}').includes('<style>x{y:z}</style></head>'));
});
```

`tests/rascunho.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, decidirRascunho } from '../src/nucleo/rascunho.js';
import { SEM_ESCRITA, NAO_REPETIR, mensagemDePublicacao, mensagemDeEnvio } from '../src/nucleo/mensagens.js';

test('hash é estável e muda com o texto', () => {
  assert.equal(hash('abc'), hash('abc'));
  assert.notEqual(hash('abc'), hash('abd'));
  assert.match(hash(''), /^[0-9a-z]+$/);
});

test('decidirRascunho', () => {
  const publicado = { v: 1 };
  const hp = hash(JSON.stringify(publicado));
  assert.equal(decidirRascunho(null, hp), 'nenhum');
  assert.equal(decidirRascunho({ base: 'velho', conteudo: publicado, alteracoes: 2 }, hp), 'publicado');
  assert.equal(decidirRascunho({ base: hp, conteudo: { v: 2 }, alteracoes: 1 }, hp), 'restaurar');
  assert.equal(decidirRascunho({ base: 'outro', conteudo: { v: 2 }, alteracoes: 1 }, hp), 'restaurar-desatualizado');
  assert.equal(decidirRascunho({ base: hp }, hp), 'nenhum');
});

test('códigos de somente leitura nunca são repetidos', () => {
  for (const c of SEM_ESCRITA) assert.ok(NAO_REPETIR.has(c), c);
  assert.ok(!NAO_REPETIR.has('upstream_error'));
});

test('mensagens de publicação', () => {
  assert.match(mensagemDePublicacao('conflict'), /outra aba|outra pessoa/);
  assert.match(mensagemDePublicacao('not_writer'), /somente leitura/);
  assert.match(mensagemDePublicacao('rate_limited'), /Aguarde/);
  assert.match(mensagemDePublicacao('too_large'), /tamanho/);
  assert.match(mensagemDePublicacao('upstream_error'), /continuam salvas neste navegador/);
  assert.match(mensagemDePublicacao(undefined), /continuam salvas neste navegador/);
});

test('mensagens de envio de arquivo', () => {
  assert.match(mensagemDeEnvio('too_large'), /20 MB/);
  assert.match(mensagemDeEnvio('unsupported_type'), /link/);
  assert.match(mensagemDeEnvio('qualquer'), /Não foi possível enviar/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module ... src/nucleo/documento.js`

- [ ] **Step 3: Implementar os três arquivos**

`src/nucleo/documento.js` (atenção: as tags de fechamento são escritas como `<\/script>` para que o código possa ser embutido numa página sem fechar a tag que o contém):

```js
export const RESET_PADRAO =
  ':root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}' +
  'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}';

const escHtml = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function jsonSeguro(valor) {
  return JSON.stringify(valor)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function corpoDaPagina({ titulo, fontes, css, js, conteudo, config }) {
  return (
    `<title>${escHtml(titulo)}</title>` +
    (fontes ? `<link rel="stylesheet" href="${escHtml(fontes)}">` : '') +
    `<style id="estilo">${css}</style>` +
    `<div id="app"></div>` +
    `<script type="application/json" id="conteudo">${jsonSeguro(conteudo)}<\/script>` +
    `<script type="application/json" id="config">${jsonSeguro(config)}<\/script>` +
    `<script id="programa">${js}<\/script>`
  );
}

export function documentoCompleto(partes, reset = RESET_PADRAO) {
  return (
    '<!doctype html><html><head><meta charset=utf8>' +
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    `<style>${reset}</style></head><body>${corpoDaPagina(partes)}</body></html>`
  );
}
```

`src/nucleo/rascunho.js`:

```js
export function hash(texto) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function decidirRascunho(salvo, hashPublicado) {
  if (!salvo?.conteudo) return 'nenhum';
  if (hash(JSON.stringify(salvo.conteudo)) === hashPublicado) return 'publicado';
  return salvo.base === hashPublicado ? 'restaurar' : 'restaurar-desatualizado';
}
```

`src/nucleo/mensagens.js`:

```js
export const SEM_ESCRITA = new Set([
  'not_writer', 'not_granted', 'not_declared', 'capability_disabled', 'capability_removed', 'consent_required',
]);

export const NAO_REPETIR = new Set([
  ...SEM_ESCRITA, 'conflict', 'too_large', 'invalid_content', 'read_only_path', 'rate_limited', 'transform_error',
]);

export function mensagemDePublicacao(code) {
  if (code === 'conflict') return 'O site foi publicado por outra aba ou outra pessoa. Suas alterações foram guardadas e reaparecem quando a página recarregar.';
  if (SEM_ESCRITA.has(code)) return 'Esta visualização é somente leitura. Entre com a conta que tem permissão de edição.';
  if (code === 'rate_limited') return 'Muitas publicações seguidas. Aguarde um minuto e publique de novo.';
  if (code === 'too_large') return 'O site passou do tamanho máximo. Remova textos muito longos e publique de novo.';
  if (code === 'invalid_content' || code === 'transform_error') return 'O site não pôde ser montado para publicação. Suas alterações continuam salvas neste navegador.';
  return 'Não foi possível publicar. Suas alterações continuam salvas neste navegador.';
}

export function mensagemDeEnvio(code) {
  if (code === 'too_large') return 'O arquivo passa de 20 MB. Cole um link para ele (do Drive, por exemplo).';
  if (code === 'unsupported_type') return 'Esse tipo de arquivo não é aceito aqui. Envie um PDF ou cole um link.';
  if (code === 'quota_or_state') return 'O espaço de arquivos do site está cheio. Cole um link no lugar.';
  if (code === 'rate_limited') return 'Muitos envios seguidos. Aguarde um minuto e tente de novo.';
  if (SEM_ESCRITA.has(code) || code === 'not_uploader') return 'Esta conta não pode enviar arquivos. Cole um link no lugar.';
  return 'Não foi possível enviar o arquivo. Tente de novo ou cole um link.';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: 32 testes no total, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo/documento.js src/nucleo/rascunho.js src/nucleo/mensagens.js tests/documento.test.js tests/rascunho.test.js
git commit -m "feat: page document builder, draft decision and error messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Telas

**Files:**
- Create: `src/nucleo/telas.js`
- Test: `tests/telas.test.js`

**Interfaces:**
- Consumes: `TIPOS`, `NIVEIS`, `avisosValidos`, `avisosRecentes`, `acharAula`, `videoPrincipal` de `conteudo.js`; `idDoYoutube` de `youtube.js`
- Produces:
  - `esc(texto): string`; `dataBR('AAAA-MM-DD'): 'DD/MM/AAAA' | ''`
  - `interpretarRota(hash: string): { nome: string, id?: string }`, com `nome` em `inicio | disciplina | aula | laboratorio | textos | texto | pesquisa | sobre` ou qualquer outra coisa (vira página não encontrada)
  - `barraEdicao(ctx): string`
  - `renderizar(conteudo, rota, ctx): string`
  - `ctx = { editando, podeEditar, alteracoes, publicando, confirmando, formulario, mensagem, hoje, ambiente, midia }`
  - `ctx.formulario = { lista, tipo, url, nome, arquivo, erro, enviando, podeEnviar } | null`
  - Contrato de atributos que `principal.js` (Task 6) lê: `data-campo="<caminho>"` em todo texto editável; `data-op` com `data-lista`, `data-i`, `data-novo`, `data-yt`, `data-texto` em todo botão de ação. Valores de `data-op`: `editar`, `descartar`, `descartar-sim`, `publicar`, `subir`, `descer`, `remover`, `remover-sim`, `remover-nao`, `adicionar`, `novo-material`, `cancelar-material`, `copiar`, `tocar`.
  - Chaves de `ctx.midia`: `poster`, `hero`, `foto`, e `capa-<id da disciplina>`

- [ ] **Step 1: Escrever o teste que falha**

`tests/telas.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderizar, interpretarRota, barraEdicao, esc, dataBR } from '../src/nucleo/telas.js';
import { conteudoExemplo } from './fixtura.js';

const leitura = {
  editando: false, podeEditar: false, alteracoes: 0, publicando: false, confirmando: null,
  formulario: null, mensagem: '', hoje: '2026-10-13', ambiente: 'artifact', midia: {},
};
const edicao = { ...leitura, editando: true, podeEditar: true };
const ver = (hash, ctx = leitura, c = conteudoExemplo()) => renderizar(c, interpretarRota(hash), ctx);

test('interpretarRota', () => {
  assert.deepEqual(interpretarRota(''), { nome: 'inicio' });
  assert.deepEqual(interpretarRota('#inicio'), { nome: 'inicio' });
  assert.deepEqual(interpretarRota('#d-eg'), { nome: 'disciplina', id: 'eg' });
  assert.deepEqual(interpretarRota('#a-eg-1-3'), { nome: 'aula', id: 'eg-1-3' });
  assert.deepEqual(interpretarRota('#t-financas-verdes'), { nome: 'texto', id: 'financas-verdes' });
  assert.deepEqual(interpretarRota('#textos'), { nome: 'textos' });
});

test('esc e dataBR', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(dataBR('2020-09-27'), '27/09/2020');
  assert.equal(dataBR(''), '');
});

test('início lista disciplinas por nível e só os avisos válidos', () => {
  const html = ver('#inicio');
  assert.match(html, /Graduação[\s\S]*Economia Gerencial[\s\S]*Pós-graduação[\s\S]*Avaliação Econômica de Projetos/);
  assert.ok(html.includes('Prova na quinta'));
  assert.ok(!html.includes('Aviso vencido'));
  assert.ok(html.includes('href="#d-eg"'));
});

test('disciplina em leitura: material com nome visível e nenhum controle de edição', () => {
  const html = ver('#d-eg');
  assert.match(html, /<a class="chip" href="https:\/\/exemplo\.com\/a\.pdf" target="_blank" rel="noopener"[^>]*>Slides</);
  assert.ok(html.includes('href="#a-eg-1-1"'));
  assert.ok(!/data-op=|contenteditable|data-campo/.test(html));
});

test('ficha vazia não aparece em leitura; campo preenchido aparece sozinho', () => {
  assert.ok(!ver('#d-eg').includes('class="ficha"'));
  const c = conteudoExemplo();
  c.disciplinas[0].ficha.ementa = 'Microeconomia aplicada.';
  const html = ver('#d-eg', leitura, c);
  assert.ok(html.includes('<summary>Ementa</summary>'));
  assert.ok(!html.includes('<summary>Bibliografia</summary>'));
});

test('aviso vencido some em leitura e continua visível em edição', () => {
  assert.ok(!ver('#d-eg').includes('Aviso vencido'));
  assert.ok(ver('#d-eg', edicao).includes('Aviso vencido'));
});

test('aula no Claude: player é link para o YouTube, sem iframe nem imagem externa', () => {
  const html = ver('#a-eg-1-1');
  assert.match(html, /<a class="player" href="https:\/\/youtu\.be\/YHzoeE7-0sc" target="_blank" rel="noopener">/);
  assert.ok(!html.includes('<iframe'));
  assert.ok(!html.includes('ytimg'));
  assert.equal(html.split('youtu.be').length - 1, 1);
  assert.ok(html.includes('Slides da aula'));
  assert.match(html, /href="#a-eg-1-2">Custos da Firma ›/);
});

test('aula na versão local: player é botão que carrega o vídeo', () => {
  const html = ver('#a-eg-1-1', { ...leitura, ambiente: 'local' });
  assert.match(html, /<button type="button" class="player" data-op="tocar" data-yt="YHzoeE7-0sc"/);
});

test('aula sem vídeo não tem player', () => {
  assert.ok(!ver('#a-eg-1-2').includes('class="player"'));
});

test('edição: campos, ferramentas e botões de adicionar', () => {
  const html = ver('#d-eg', edicao);
  assert.ok(html.includes('data-campo="disciplinas.0.modulos.0.aulas.0.titulo"'));
  assert.ok(html.includes('data-campo="disciplinas.0.ficha.ementa"'));
  assert.ok(html.includes('data-op="novo-material" data-lista="disciplinas.0.modulos.0.aulas.0.materiais"'));
  assert.ok(html.includes('data-op="adicionar" data-novo="aula" data-lista="disciplinas.0.modulos.0.aulas"'));
  assert.ok(html.includes('data-op="adicionar" data-novo="aviso" data-lista="disciplinas.0.avisos"'));
  assert.match(html, /data-op="subir" data-lista="disciplinas\.0\.modulos" data-i="0"[^>]*disabled/);
  assert.match(html, /data-op="descer" data-lista="disciplinas\.0\.modulos" data-i="1"[^>]*disabled/);
});

test('remover pede confirmação na própria linha', () => {
  const html = ver('#d-eg', { ...edicao, confirmando: 'disciplinas.0.modulos.1' });
  assert.match(html, /Remover\?[\s\S]*data-op="remover-sim" data-lista="disciplinas\.0\.modulos" data-i="1"/);
});

test('barra de edição', () => {
  assert.equal(barraEdicao(leitura), '');
  assert.ok(barraEdicao({ ...leitura, podeEditar: true }).includes('data-op="editar"'));
  assert.ok(barraEdicao({ ...edicao, alteracoes: 3 }).includes('Editando · 3 alterações'));
  assert.ok(barraEdicao({ ...edicao, alteracoes: 1 }).includes('1 alteração<'));
  assert.match(barraEdicao(edicao), /data-op="publicar"[^>]*disabled/);
  assert.ok(barraEdicao({ ...edicao, alteracoes: 2, confirmando: 'descartar' }).includes('data-op="descartar-sim"'));
});

test('formulário de material', () => {
  const formulario = { lista: 'x', tipo: 'video', url: 'https://youtu.be/abc', nome: 'Vídeo da aula', arquivo: '', erro: 'Endereço inválido', enviando: false, podeEnviar: true };
  const html = ver('#d-eg', { ...edicao, formulario });
  assert.ok(html.includes('id="form-material"'));
  assert.match(html, /value="video" checked/);
  assert.ok(html.includes('Endereço inválido'));
  assert.ok(html.includes('id="mat-arquivo"'));
  assert.ok(!ver('#d-eg', { ...edicao, formulario: { ...formulario, podeEnviar: false } }).includes('id="mat-arquivo"'));
});

test('texto vindo do conteúdo é sempre escapado', () => {
  const c = conteudoExemplo();
  c.disciplinas[0].nome = '<img src=x onerror=alert(1)>';
  for (const ctx of [leitura, edicao]) {
    const html = ver('#d-eg', ctx, c);
    assert.ok(html.includes('&lt;img src=x'));
    assert.ok(!html.includes('<img src=x'));
  }
});

test('rota desconhecida mostra página não encontrada', () => {
  assert.ok(ver('#d-nada').includes('Página não encontrada'));
  assert.ok(ver('#a-nada').includes('Página não encontrada'));
  assert.ok(ver('#qualquer').includes('Página não encontrada'));
});

test('sobre: monograma sem foto, e-mail copiável e nenhum mailto', () => {
  const html = ver('#sobre');
  assert.ok(html.includes('class="foto mono"'));
  assert.ok(html.includes('p.antoniofran@gmail.com'));
  assert.ok(html.includes('data-op="copiar"'));
  assert.ok(!html.includes('mailto:'));
  assert.ok(ver('#sobre', { ...leitura, midia: { foto: '/_blob/abc' } }).includes('<img class="foto" src="/_blob/abc"'));
});

test('pesquisa agrupa publicações por ano, do mais novo para o mais antigo', () => {
  const html = ver('#pesquisa');
  assert.ok(html.indexOf('>2023<') < html.indexOf('>2021<'));
  assert.ok(html.includes('Grupo de Pesquisa em Finanças - UFBA'));
});

test('texto: parágrafos separados e data em formato brasileiro', () => {
  const html = ver('#t-financas-verdes');
  assert.ok(html.includes('<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>'));
  assert.ok(html.includes('27/09/2020'));
});

test('capa e abertura só aparecem quando há mídia', () => {
  assert.ok(!ver('#inicio').includes('class="abertura"'));
  const midia = { poster: '/_blob/p', hero: '/_blob/h', 'capa-eg': '/_blob/c' };
  assert.match(ver('#inicio', { ...leitura, midia }), /<video[^>]*data-src="\/_blob\/h"/);
  assert.ok(ver('#d-eg', { ...leitura, midia }).includes('<div class="capa"><img src="/_blob/c"'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module ... src/nucleo/telas.js`

- [ ] **Step 3: Implementar**

`src/nucleo/telas.js`:

```js
import { TIPOS, NIVEIS, avisosValidos, avisosRecentes, acharAula, videoPrincipal } from './conteudo.js';
import { idDoYoutube } from './youtube.js';

// ---------- utilidades ----------

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function interpretarRota(hash) {
  const h = String(hash ?? '').replace(/^#/, '') || 'inicio';
  const m = /^([adt])-(.+)$/.exec(h);
  return m ? { nome: { a: 'aula', d: 'disciplina', t: 'texto' }[m[1]], id: m[2] } : { nome: h };
}

const tem = (v) => Boolean(String(v ?? '').trim());

const paragrafos = (t) => String(t ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

// Texto de uma linha: em leitura devolve o texto; em edição, um trecho editável ligado ao caminho.
function campo(caminho, valor, ctx, vazio) {
  if (!ctx.editando) return esc(valor);
  return `<span class="ed" contenteditable="plaintext-only" role="textbox" aria-label="${esc(vazio)}" data-campo="${caminho}" data-vazio="${esc(vazio)}">${esc(valor)}</span>`;
}

// Texto de vários parágrafos.
function bloco(caminho, valor, ctx, vazio) {
  if (!ctx.editando) return paragrafos(valor);
  return `<div class="ed ed-bloco" contenteditable="plaintext-only" role="textbox" aria-multiline="true" aria-label="${esc(vazio)}" data-campo="${caminho}" data-vazio="${esc(vazio)}">${esc(valor)}</div>`;
}

function ferramentas(lista, i, n, ctx, oQue, ordem = true) {
  if (!ctx.editando) return '';
  const alvo = `data-lista="${lista}" data-i="${i}"`;
  if (ctx.confirmando === `${lista}.${i}`) {
    return `<span class="tools conf">Remover? <button type="button" data-op="remover-sim" ${alvo}>Sim</button><button type="button" data-op="remover-nao">Não</button></span>`;
  }
  const setas = ordem
    ? `<button type="button" data-op="subir" ${alvo} aria-label="Subir ${esc(oQue)}"${i === 0 ? ' disabled' : ''}>↑</button>` +
      `<button type="button" data-op="descer" ${alvo} aria-label="Descer ${esc(oQue)}"${i === n - 1 ? ' disabled' : ''}>↓</button>`
    : '';
  return `<span class="tools">${setas}<button type="button" data-op="remover" ${alvo} aria-label="Remover ${esc(oQue)}">×</button></span>`;
}

const adicionar = (ctx, tipo, lista, rotulo) => (ctx.editando
  ? `<button type="button" class="add" data-op="adicionar" data-novo="${tipo}" data-lista="${lista}">+ ${rotulo}</button>`
  : '');

const novoMaterial = (ctx, lista, rotulo, classe = 'add') => (ctx.editando
  ? `<button type="button" class="${classe}" data-op="novo-material" data-lista="${lista}">+ ${rotulo}</button>`
  : '');

const rotuloDoTipo = (mat) => TIPOS[mat.tipo]?.rotulo ?? 'Material';

// No chip aparece o tipo; se o professor deu um nome próprio ao material, aparece o nome.
const rotuloDoChip = (mat) => (mat.nome === TIPOS[mat.tipo]?.nome ? rotuloDoTipo(mat) : mat.nome);

// ---------- moldura ----------

const MENU = [['inicio', 'Início'], ['laboratorio', 'Laboratório'], ['textos', 'Textos'], ['pesquisa', 'Pesquisa'], ['sobre', 'Sobre']];

function cabecalho(c, rota) {
  const itens = MENU.map(([r, nome]) => `<a href="#${r}"${rota.nome === r ? ' aria-current="page"' : ''}>${nome}</a>`).join('');
  return `<header class="topo"><a class="marca" href="#inicio">${esc(c.site.titulo)}</a><nav aria-label="Seções">${itens}</nav></header>`;
}

const rodape = (c) => `<footer class="rodape"><span>${esc(c.site.professor)} · ${esc(c.site.instituicao)}</span><a href="#sobre">Contato</a></footer>`;

export function barraEdicao(ctx) {
  if (!ctx.podeEditar) return '';
  if (!ctx.editando) return '<button type="button" class="btn-editar" data-op="editar">Editar</button>';
  const n = ctx.alteracoes;
  const estado = n === 0 ? 'Editando' : `Editando · ${n} ${n === 1 ? 'alteração' : 'alterações'}`;
  if (ctx.confirmando === 'descartar') {
    return `<div class="barra" role="region" aria-label="Edição"><span>Descartar todas as alterações?</span><span class="grupo"><button type="button" data-op="descartar-sim">Sim, descartar</button><button type="button" class="pri" data-op="remover-nao">Não</button></span></div>`;
  }
  const parado = n === 0 || ctx.publicando;
  return `<div class="barra" role="region" aria-label="Edição"><span>${estado}</span><span class="grupo"><button type="button" data-op="descartar">${n === 0 ? 'Sair' : 'Descartar'}</button><button type="button" class="pri" data-op="publicar"${parado ? ' disabled' : ''}>${ctx.publicando ? 'Publicando…' : 'Publicar'}</button></span></div>`;
}

const tela404 = () => '<div class="col"><h1>Página não encontrada</h1><p><a href="#inicio">Voltar ao início</a></p></div>';

// ---------- início ----------

function abertura(ctx) {
  const m = ctx.midia;
  if (!m.poster) return '';
  const video = m.hero && !ctx.editando
    ? `<video muted loop playsinline preload="none" aria-hidden="true" data-src="${esc(m.hero)}"></video>`
    : '';
  return `<div class="abertura"><img src="${esc(m.poster)}" alt="" width="1600" height="600">${video}</div>`;
}

function telaInicio(c, ctx) {
  const recentes = avisosRecentes(c, ctx.hoje);
  const contagem = (d) => (d.modulos.length ? `${d.modulos.length} ${d.modulos.length === 1 ? 'módulo' : 'módulos'}` : '');
  const nivel = (chave) => {
    const lista = c.disciplinas.filter((d) => d.nivel === chave);
    if (!lista.length) return '';
    return `<section><h2 class="eye">${NIVEIS[chave]}</h2><ul class="lista">${lista.map((d) => `<li><a href="#d-${d.id}"><span>${esc(d.nome)}</span><small>${contagem(d)}</small></a></li>`).join('')}</ul></section>`;
  };
  const textos = c.textos.filter((t) => tem(t.titulo)).slice(0, 3);
  return `${abertura(ctx)}<div class="col">
<p class="eye">${esc(c.site.professor)} · ${esc(c.site.instituicao)}</p>
<h1>${campo('site.chamada', c.site.chamada, ctx, 'Frase de abertura')}</h1>
${recentes.length ? `<section><h2 class="eye">Avisos recentes</h2><ul class="lista">${recentes.map(({ disciplina, aviso }) => `<li><a href="#d-${disciplina.id}"><span>${esc(aviso.texto)}</span><small>${esc(disciplina.nome)}</small></a></li>`).join('')}</ul></section>` : ''}
${nivel('graduacao')}${nivel('pos')}
${textos.length ? `<section><h2 class="eye">Últimos textos</h2><ul class="lista">${textos.map((t) => `<li><a href="#t-${t.id}"><span>${esc(t.titulo)}</span><small>${dataBR(t.data)}</small></a></li>`).join('')}</ul></section>` : ''}
</div>`;
}

// ---------- disciplina ----------

function avisos(d, base, ctx) {
  const visiveis = d.avisos.map((a, k) => ({ a, k }))
    .filter(({ a }) => ctx.editando || avisosValidos([a], ctx.hoje).length);
  if (!visiveis.length && !ctx.editando) return '';
  // O texto vem antes da data: ao criar um aviso, o foco cai no primeiro campo, que deve ser o texto.
  const um = ({ a, k }) => `<div class="aviso"><div><b>Aviso</b><p>${campo(`${base}.avisos.${k}.texto`, a.texto, ctx, 'Texto do aviso')}</p>${ctx.editando ? `<label class="ate">Mostrar até <input type="date" id="ate-${a.id}" data-campo="${base}.avisos.${k}.ate" value="${esc(a.ate)}"></label>` : ''}</div>${ferramentas(`${base}.avisos`, k, d.avisos.length, ctx, 'aviso')}</div>`;
  return `<section class="avisos" aria-label="Avisos">${visiveis.map(um).join('')}${adicionar(ctx, 'aviso', `${base}.avisos`, 'Novo aviso')}</section>`;
}

const FICHA = [['ementa', 'Ementa'], ['objetivos', 'Objetivos'], ['avaliacao', 'Avaliação'], ['bibliografia', 'Bibliografia']];

function ficha(d, base, ctx) {
  const itens = FICHA.filter(([k]) => ctx.editando || tem(d.ficha[k]));
  if (!itens.length) return '';
  return `<section class="ficha" aria-label="Ficha da disciplina">${itens.map(([k, rotulo]) => `<details${ctx.editando ? ' open' : ''}><summary>${rotulo}</summary><div class="ficha-corpo">${bloco(`${base}.ficha.${k}`, d.ficha[k], ctx, `${rotulo}: escreva aqui`)}</div></details>`).join('')}</section>`;
}

function chip(mat, lista, k, ctx) {
  if (!ctx.editando) {
    return `<a class="chip" href="${esc(mat.url)}" target="_blank" rel="noopener" title="${esc(mat.nome)}">${esc(rotuloDoChip(mat))}<span class="sr"> (${esc(mat.nome)}, abre em nova aba)</span></a>`;
  }
  const alvo = `data-lista="${lista}" data-i="${k}"`;
  if (ctx.confirmando === `${lista}.${k}`) {
    return `<span class="chip">Remover? <button type="button" data-op="remover-sim" ${alvo}>Sim</button><button type="button" data-op="remover-nao">Não</button></span>`;
  }
  return `<span class="chip">${esc(rotuloDoChip(mat))}<button type="button" data-op="remover" ${alvo} aria-label="Remover ${esc(mat.nome)}">×</button></span>`;
}

function linhaDaAula(a, ia, m, bm, ctx) {
  const ba = `${bm}.aulas.${ia}`;
  const titulo = ctx.editando
    ? `${campo(`${ba}.titulo`, a.titulo, ctx, 'Título da aula')}<a class="abrir" href="#a-${a.id}">abrir</a>`
    : `<a href="#a-${a.id}">${esc(a.titulo)}</a>`;
  return `<li class="aula"><div><small>Aula ${ia + 1}</small><div class="aula-titulo">${titulo}</div><div class="mats">${a.materiais.map((mat, k) => chip(mat, `${ba}.materiais`, k, ctx)).join('')}${novoMaterial(ctx, `${ba}.materiais`, 'material', 'chip novo')}</div></div>${ferramentas(`${bm}.aulas`, ia, m.aulas.length, ctx, 'aula')}</li>`;
}

function modulo(m, im, d, base, ctx) {
  const bm = `${base}.modulos.${im}`;
  const aulas = m.aulas.map((a, ia) => ({ a, ia })).filter(({ a }) => ctx.editando || tem(a.titulo));
  return `<section class="modulo"><div class="linha-titulo"><h2><span class="num">${im + 1}.</span> ${campo(`${bm}.titulo`, m.titulo, ctx, 'Título do módulo')}</h2>${ferramentas(`${base}.modulos`, im, d.modulos.length, ctx, 'módulo')}</div><ol class="aulas">${aulas.map(({ a, ia }) => linhaDaAula(a, ia, m, bm, ctx)).join('')}</ol>${adicionar(ctx, 'aula', `${bm}.aulas`, 'Nova aula')}</section>`;
}

function telaDisciplina(c, id, ctx) {
  const i = c.disciplinas.findIndex((d) => d.id === id);
  if (i < 0) return tela404();
  const d = c.disciplinas[i];
  const base = `disciplinas.${i}`;
  const capa = ctx.midia[`capa-${d.id}`];
  return `${capa ? `<div class="capa"><img src="${esc(capa)}" alt="" width="1600" height="400"></div>` : ''}<div class="col">
<p class="eye"><a href="#inicio">${NIVEIS[d.nivel]}</a></p>
<h1>${campo(`${base}.nome`, d.nome, ctx, 'Nome da disciplina')}</h1>
${avisos(d, base, ctx)}${ficha(d, base, ctx)}
${d.modulos.map((m, im) => modulo(m, im, d, base, ctx)).join('')}
${adicionar(ctx, 'modulo', `${base}.modulos`, 'Novo módulo')}
</div>`;
}

// ---------- aula ----------

function linhaDoMaterial(mat, lista, k, n, ctx) {
  if (!ctx.editando) {
    return `<li><a href="${esc(mat.url)}" target="_blank" rel="noopener"><span>${esc(mat.nome)}</span><small>${esc(rotuloDoTipo(mat))} ↗</small></a></li>`;
  }
  return `<li class="editavel"><span>${campo(`${lista}.${k}.nome`, mat.nome, ctx, 'Nome do material')} <small>${esc(rotuloDoTipo(mat))}</small></span>${ferramentas(lista, k, n, ctx, 'material')}</li>`;
}

function player(video, aula, disciplina, ctx) {
  const id = idDoYoutube(video.url);
  if (ctx.ambiente === 'local' && id) {
    return `<button type="button" class="player" data-op="tocar" data-yt="${id}" aria-label="Assistir: ${esc(aula.titulo)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="play"></span></button>`;
  }
  const capa = ctx.midia[`capa-${disciplina.id}`];
  return `<a class="player" href="${esc(video.url)}" target="_blank" rel="noopener">${capa ? `<img src="${esc(capa)}" alt="" loading="lazy">` : ''}<span class="play"></span><span class="legenda">Assistir no YouTube ↗</span></a>`;
}

function telaAula(c, id, ctx) {
  const achada = acharAula(c, id);
  if (!achada) return tela404();
  const { disciplina: d, idx, im, ia, aula: a, anterior, proxima } = achada;
  const lista = `disciplinas.${idx}.modulos.${im}.aulas.${ia}.materiais`;
  const video = videoPrincipal(a);
  const linhas = a.materiais.map((mat, k) => ({ mat, k })).filter(({ mat }) => ctx.editando || mat !== video);
  const materiais = linhas.length || ctx.editando
    ? `<ul class="lista mat-lista">${linhas.map(({ mat, k }) => linhaDoMaterial(mat, lista, k, a.materiais.length, ctx)).join('')}</ul>`
    : `<p class="suave">${video ? 'Esta aula tem apenas o vídeo.' : 'Esta aula ainda não tem materiais.'}</p>`;
  return `<div class="col">
<p class="eye"><a href="#d-${d.id}">${esc(d.nome)}</a> · Módulo ${im + 1} · Aula ${ia + 1}</p>
<h1>${campo(`disciplinas.${idx}.modulos.${im}.aulas.${ia}.titulo`, a.titulo, ctx, 'Título da aula')}</h1>
${video ? player(video, a, d, ctx) : ''}
<section><h2 class="eye">Materiais desta aula</h2>${materiais}${novoMaterial(ctx, lista, 'Novo material')}</section>
<nav class="vizinhas" aria-label="Outras aulas">${anterior ? `<a href="#a-${anterior.id}">‹ ${esc(anterior.titulo)}</a>` : '<span></span>'}${proxima ? `<a href="#a-${proxima.id}">${esc(proxima.titulo)} ›</a>` : ''}</nav>
</div>`;
}

// ---------- laboratório, textos ----------

function telaLaboratorio(c, ctx) {
  const grupo = (g, ig) => `<section><h2 class="eye">${campo(`laboratorio.${ig}.grupo`, g.grupo, ctx, 'Nome do grupo')}</h2><ul class="lista mat-lista">${g.itens.map((it, k) => linhaDoMaterial(it, `laboratorio.${ig}.itens`, k, g.itens.length, ctx)).join('')}</ul>${novoMaterial(ctx, `laboratorio.${ig}.itens`, 'Novo item')}</section>`;
  return `<div class="col"><h1>Laboratório</h1><p class="lead">${campo('site.laboratorio', c.site.laboratorio, ctx, 'Apresentação do laboratório')}</p>${c.laboratorio.map(grupo).join('')}</div>`;
}

function telaTextos(c, ctx) {
  const linhas = c.textos.map((t, k) => ({ t, k })).filter(({ t }) => ctx.editando || tem(t.titulo));
  return `<div class="col"><h1>Textos</h1><ul class="lista">${linhas.map(({ t, k }) => `<li${ctx.editando ? ' class="editavel"' : ''}><a href="#t-${t.id}"><span>${esc(t.titulo || 'Sem título')}</span><small>${dataBR(t.data)}</small></a>${ferramentas('textos', k, c.textos.length, ctx, 'texto')}</li>`).join('')}</ul>${adicionar(ctx, 'texto', 'textos', 'Novo texto')}</div>`;
}

function telaTexto(c, id, ctx) {
  const k = c.textos.findIndex((t) => t.id === id);
  if (k < 0) return tela404();
  const t = c.textos[k];
  const data = ctx.editando
    ? `<input type="date" id="data-${t.id}" data-campo="textos.${k}.data" value="${esc(t.data)}" aria-label="Data do texto">`
    : dataBR(t.data);
  return `<article class="col"><p class="eye"><a href="#textos">Textos</a> · ${data}</p><h1>${campo(`textos.${k}.titulo`, t.titulo, ctx, 'Título')}</h1>${tem(t.resumo) || ctx.editando ? `<p class="lead">${campo(`textos.${k}.resumo`, t.resumo, ctx, 'Resumo em uma frase')}</p>` : ''}<div class="prosa">${bloco(`textos.${k}.corpo`, t.corpo, ctx, 'Escreva o texto aqui')}</div></article>`;
}

// ---------- pesquisa ----------

function telaPesquisa(c, ctx) {
  const p = c.pesquisa;
  const anos = [...new Set(p.publicacoes.map((x) => String(x.ano)))].sort((a, b) => b.localeCompare(a));
  const projeto = (x, k) => `<li><div><h3>${campo(`pesquisa.projetos.${k}.titulo`, x.titulo, ctx, 'Título do projeto')}</h3>${tem(x.descricao) || ctx.editando ? `<p class="suave">${campo(`pesquisa.projetos.${k}.descricao`, x.descricao, ctx, 'Descrição (opcional)')}</p>` : ''}</div>${ferramentas('pesquisa.projetos', k, p.projetos.length, ctx, 'projeto')}</li>`;
  const publicacao = ({ x, k }) => `<li><div>${ctx.editando ? `<input class="ano-in" id="ano-${x.id}" data-campo="pesquisa.publicacoes.${k}.ano" value="${esc(x.ano)}" inputmode="numeric" size="4" aria-label="Ano"> ` : ''}${campo(`pesquisa.publicacoes.${k}.referencia`, x.referencia, ctx, 'Referência completa')}</div>${ferramentas('pesquisa.publicacoes', k, p.publicacoes.length, ctx, 'publicação', false)}</li>`;
  const doAno = (ano) => p.publicacoes.map((x, k) => ({ x, k })).filter(({ x }) => String(x.ano) === ano && (ctx.editando || tem(x.referencia)));
  return `<div class="col"><h1>Pesquisa</h1><div class="prosa">${bloco('pesquisa.linhas', p.linhas, ctx, 'Linhas de pesquisa')}</div>
${p.grupo?.url ? `<p><a href="${esc(p.grupo.url)}" target="_blank" rel="noopener">${esc(p.grupo.nome)} ↗</a></p>` : ''}
<section><h2 class="eye">Projetos</h2><ul class="projetos">${p.projetos.map(projeto).join('')}</ul>${adicionar(ctx, 'projeto', 'pesquisa.projetos', 'Novo projeto')}</section>
<section><h2 class="eye">Publicações</h2>${adicionar(ctx, 'publicacao', 'pesquisa.publicacoes', 'Nova publicação')}${anos.map((ano) => `<h3 class="ano">${esc(ano)}</h3><ul class="pubs">${doAno(ano).map(publicacao).join('')}</ul>`).join('')}</section></div>`;
}

// ---------- sobre ----------

const NIVEIS_ORIENTACAO = ['Doutorado', 'Mestrado', 'Especialização'];

function orientacoes(s, ctx) {
  const item = ({ o, k }) => `<li><div><h3>${campo(`sobre.orientacoes.${k}.titulo`, o.titulo, ctx, 'Título do trabalho')}</h3><p class="suave">${campo(`sobre.orientacoes.${k}.aluno`, o.aluno, ctx, 'Nome do orientando')}, ${campo(`sobre.orientacoes.${k}.ano`, o.ano, ctx, 'Ano')}${ctx.editando ? ` <select id="nivel-${o.id}" data-campo="sobre.orientacoes.${k}.nivel" aria-label="Nível">${NIVEIS_ORIENTACAO.map((n) => `<option${n === o.nivel ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}</p></div>${ferramentas('sobre.orientacoes', k, s.orientacoes.length, ctx, 'orientação', false)}</li>`;
  const grupos = NIVEIS_ORIENTACAO.map((n) => ({ n, itens: s.orientacoes.map((o, k) => ({ o, k })).filter(({ o }) => o.nivel === n) })).filter((g) => g.itens.length);
  if (!grupos.length && !ctx.editando) return '';
  return `<section><h2 class="eye">Orientações concluídas</h2>${grupos.map((g) => `<h3 class="ano">${g.n}</h3><ul class="orientacoes">${g.itens.map(item).join('')}</ul>`).join('')}${adicionar(ctx, 'orientacao', 'sobre.orientacoes', 'Nova orientação')}</section>`;
}

function telaSobre(c, ctx) {
  const s = c.sobre;
  const foto = ctx.midia.foto
    ? `<img class="foto" src="${esc(ctx.midia.foto)}" alt="Retrato de ${esc(s.nome)}" width="112" height="112">`
    : '<div class="foto mono" aria-hidden="true">AF</div>';
  const formacao = (f, k) => `<li><span class="periodo">${campo(`sobre.formacao.${k}.periodo`, f.periodo, ctx, 'Período')}</span><div><h3>${campo(`sobre.formacao.${k}.titulo`, f.titulo, ctx, 'Título')}</h3><p class="suave">${campo(`sobre.formacao.${k}.instituicao`, f.instituicao, ctx, 'Instituição')}</p>${tem(f.detalhe) || ctx.editando ? `<p>${campo(`sobre.formacao.${k}.detalhe`, f.detalhe, ctx, 'Detalhe (opcional)')}</p>` : ''}</div>${ferramentas('sobre.formacao', k, s.formacao.length, ctx, 'formação')}</li>`;
  return `<div class="col">
<div class="perfil">${foto}<div><h1>${esc(s.nome)}</h1><p class="suave">${campo('sobre.cargo', s.cargo, ctx, 'Cargo e instituição')}</p></div></div>
<div class="prosa">${bloco('sobre.resumo', s.resumo, ctx, 'Resumo do currículo')}</div>
<p><a href="${esc(s.lattes)}" target="_blank" rel="noopener">Currículo Lattes ↗</a></p>
<section><h2 class="eye">Formação</h2><ol class="tempo">${s.formacao.map(formacao).join('')}</ol>${adicionar(ctx, 'formacao', 'sobre.formacao', 'Nova formação')}</section>
${tem(s.areas) || ctx.editando ? `<section><h2 class="eye">Áreas de atuação</h2><div class="areas">${bloco('sobre.areas', s.areas, ctx, 'Uma área por linha')}</div></section>` : ''}
${orientacoes(s, ctx)}
<section><h2 class="eye">Contato</h2><p class="contato"><span id="email">${campo('sobre.email', s.email, ctx, 'E-mail')}</span>${ctx.editando ? '' : `<button type="button" data-op="copiar" data-texto="${esc(s.email)}">Copiar</button>`}</p></section>
${tem(c.site.proposito) || ctx.editando ? `<section><h2 class="eye">Sobre este sítio</h2><div class="prosa">${bloco('site.proposito', c.site.proposito, ctx, 'Propósito do sítio')}</div></section>` : ''}
${tem(s.english) || ctx.editando ? `<section lang="en"><h2 class="eye">In English</h2><div class="prosa">${bloco('sobre.english', s.english, ctx, 'Short vitae in English')}</div></section>` : ''}
</div>`;
}

// ---------- formulário de material ----------

const TIPOS_DO_FORMULARIO = ['slides', 'video', 'exercicios', 'planilha', 'codigo', 'link'];

function formularioMaterial(f) {
  if (!f) return '';
  const travado = f.enviando ? ' disabled' : '';
  const tipos = TIPOS_DO_FORMULARIO.map((t) => `<label><input type="radio" name="tipo" id="tipo-${t}" value="${t}"${f.tipo === t ? ' checked' : ''}><span>${TIPOS[t].rotulo}</span></label>`).join('');
  const envio = f.podeEnviar
    ? `<label class="drop" for="mat-arquivo">${f.enviando ? 'Enviando…' : 'ou envie um PDF de até 20 MB'}<input class="sr" id="mat-arquivo" name="arquivo" type="file" accept="application/pdf,image/*,text/plain,text/csv"${travado}></label><p class="suave nota">Para planilhas, cole um link (do Drive, por exemplo).</p>`
    : '';
  return `<div class="folha-fundo"><form class="folha" id="form-material" novalidate aria-label="Novo material">
<h2>Novo material</h2>
<fieldset><legend>Tipo</legend><div class="seg">${tipos}</div></fieldset>
<label for="mat-url">Endereço</label><input id="mat-url" name="url" type="url" inputmode="url" placeholder="https://" value="${esc(f.url)}"${travado}>
${f.arquivo ? `<p class="ok">Arquivo enviado: ${esc(f.arquivo)}</p>` : ''}${envio}
<label for="mat-nome">Nome que o aluno vê</label><input id="mat-nome" name="nome" type="text" value="${esc(f.nome)}">
${f.erro ? `<p class="erro" role="alert">${esc(f.erro)}</p>` : ''}
<div class="acoes"><button type="button" data-op="cancelar-material">Cancelar</button><button type="submit" class="pri"${travado}>Adicionar</button></div>
</form></div>`;
}

// ---------- entrada ----------

export function renderizar(c, rota, ctx) {
  const telas = {
    inicio: () => telaInicio(c, ctx),
    disciplina: () => telaDisciplina(c, rota.id, ctx),
    aula: () => telaAula(c, rota.id, ctx),
    laboratorio: () => telaLaboratorio(c, ctx),
    textos: () => telaTextos(c, ctx),
    texto: () => telaTexto(c, rota.id, ctx),
    pesquisa: () => telaPesquisa(c, ctx),
    sobre: () => telaSobre(c, ctx),
  };
  const corpo = (Object.hasOwn(telas, rota.nome) ? telas[rota.nome] : tela404)();
  const mensagem = ctx.mensagem ? `<p class="msg" role="status">${esc(ctx.mensagem)}</p>` : '';
  return `${barraEdicao(ctx)}${cabecalho(c, rota)}<main id="conteudo-principal" tabindex="-1">${corpo}</main>${rodape(c)}${mensagem}${formularioMaterial(ctx.formulario)}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: 51 testes no total, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo/telas.js tests/telas.test.js
git commit -m "feat: screens for reading and editing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Aplicação, montagem e versão local

**Files:**
- Create: `src/app/armazenamento.js`, `src/app/principal.js`, `build.mjs`, `servidor.mjs`, `src/midia.artifact.json`, `src/midia.local.json`, `src/conteudo.json` (provisório, vindo da fixtura), `src/estilo.css` (vazio por enquanto)
- Modify: `C:\Users\pedro\Downloads\Claude Code\.claude\launch.json` (criar se não existir)

**Interfaces:**
- Consumes: tudo o que as Tasks 1 a 5 produzem, com os nomes exatos listados nelas.
- Produces:
  - `criarArmazenamento(ambiente): Promise<{ podeEnviar: boolean, podeEditar(): Promise<boolean>, publicar(html): Promise<any>, enviarArquivo(blob): Promise<string> }>`
  - `armazenamentoDeEnsaio(aoPublicar: (html) => void)`: mesma interface, para testar a edição fora do Claude
  - `npm run build` gera `dist/artifact.html` (sem doctype) e `dist/local/index.html` (documento completo)
  - `node servidor.mjs` serve `dist/local` em `http://localhost:4173`
  - `http://localhost:4173/?ensaio` liga o modo de edição local, que "publica" no `localStorage`
  - Formato do `config` embutido: `{ ambiente: 'artifact' | 'local', titulo, fontes, midia }`

- [ ] **Step 1: Criar `src/app/armazenamento.js`**

```js
// Única peça que conhece o Claude. Na fase do domínio próprio, troca-se só este arquivo.
const SEM_ACESSO = {
  podeEnviar: false,
  async podeEditar() { return false; },
  async publicar() { throw { code: 'not_granted' }; },
  async enviarArquivo() { throw { code: 'not_granted' }; },
};

export async function criarArmazenamento(ambiente) {
  if (ambiente !== 'artifact' || !window.claude?.use) return SEM_ACESSO;
  const pedir = (nome) => window.claude.use(nome).catch(() => null);
  const [artifact, assets, user] = await Promise.all([pedir('artifact'), pedir('assets'), pedir('user')]);
  if (!artifact) return SEM_ACESSO;
  return {
    podeEnviar: Boolean(assets),
    async podeEditar() {
      try { return user ? await user.canEdit() : true; } catch { return false; }
    },
    publicar: (html) => artifact.publish(html),
    async enviarArquivo(blob) {
      if (!assets) throw { code: 'not_granted' };
      return (await assets.upload(blob)).url;
    },
  };
}

export function armazenamentoDeEnsaio(aoPublicar) {
  return {
    podeEnviar: false,
    async podeEditar() { return true; },
    async publicar(html) { aoPublicar(html); },
    async enviarArquivo() { throw { code: 'not_granted' }; },
  };
}
```

- [ ] **Step 2: Criar `src/app/principal.js`**

```js
import { renderizar, interpretarRota, barraEdicao } from '../nucleo/telas.js';
import { TIPOS, hojeISO, validarConteudo } from '../nucleo/conteudo.js';
import { aplicar, novoItem } from '../nucleo/edicao.js';
import { ler } from '../nucleo/caminhos.js';
import { novoId } from '../nucleo/listas.js';
import { idDoYoutube, urlValida } from '../nucleo/youtube.js';
import { documentoCompleto, RESET_PADRAO } from '../nucleo/documento.js';
import { hash, decidirRascunho } from '../nucleo/rascunho.js';
import { SEM_ESCRITA, NAO_REPETIR, mensagemDePublicacao, mensagemDeEnvio } from '../nucleo/mensagens.js';
import { criarArmazenamento, armazenamentoDeEnsaio } from './armazenamento.js';

const CHAVE_RASCUNHO = 'rascunho-v1';
const CHAVE_ENSAIO = 'publicado-ensaio';
const LIMITE_ARQUIVO = 20 * 1024 * 1024;

// O armazenamento do navegador pode falhar (janela privada, bloqueio): o site segue sem rascunho.
const cofre = {
  ler(chave) { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue */ } },
  limpar(chave) { try { localStorage.removeItem(chave); } catch { /* segue */ } },
};

const lerBloco = (id) => JSON.parse(document.getElementById(id).textContent);
const config = lerBloco('config');
// Código-fonte canônico da página, usado para regenerar o documento ao publicar.
const fonte = {
  css: document.getElementById('estilo').textContent,
  js: document.getElementById('programa').textContent,
};
const ENSAIO = config.ambiente === 'local' && new URLSearchParams(location.search).has('ensaio');
const publicado = (ENSAIO && cofre.ler(CHAVE_ENSAIO)) || lerBloco('conteudo');
const hashPublicado = hash(JSON.stringify(publicado));
const app = document.getElementById('app');
const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)');
const SO_TEXTO = (() => {
  try { document.createElement('div').contentEditable = 'plaintext-only'; return true; } catch { return false; }
})();

const estado = {
  rascunho: null, alteracoes: 0, editando: false, podeEditar: false,
  publicando: false, confirmando: null, formulario: null, mensagem: '',
};
const tocados = new Set();
let armazenamento = null;

const atual = () => estado.rascunho ?? publicado;
const contexto = () => ({ ...estado, hoje: hojeISO(), ambiente: config.ambiente, midia: config.midia ?? {} });
const fragmento = (html) => document.createRange().createContextualFragment(html);

// ---------- desenho ----------

function desenhar({ foco } = {}) {
  app.innerHTML = renderizar(atual(), interpretarRota(location.hash), contexto());
  if (!SO_TEXTO) for (const el of app.querySelectorAll('.ed')) el.contentEditable = 'true';
  iniciarVideo();
  if (foco) app.querySelector(foco)?.focus();
}

function navegar() {
  Object.assign(estado, { confirmando: null, formulario: null, mensagem: '' });
  const trocar = () => {
    desenhar();
    scrollTo(0, 0);
    document.getElementById('conteudo-principal')?.focus({ preventScroll: true });
  };
  if (document.startViewTransition && !movimentoReduzido.matches) document.startViewTransition(trocar);
  else trocar();
}

function iniciarVideo() {
  const video = app.querySelector('video[data-src]');
  if (!video || movimentoReduzido.matches) return;
  const carregar = () => {
    video.addEventListener('playing', () => video.classList.add('tocando'), { once: true });
    video.src = video.dataset.src;
    video.play().catch(() => { /* reprodução automática recusada: fica a imagem */ });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(carregar, { timeout: 2000 });
  else setTimeout(carregar, 600);
}

// ---------- edição ----------

function mudar(op, opcoes = {}) {
  estado.rascunho = aplicar(atual(), op);
  const chave = op.op === 'gravar' ? op.caminho : null;
  if (!chave || !tocados.has(chave)) estado.alteracoes += 1;
  if (chave) tocados.add(chave); else tocados.clear();
  cofre.gravar(CHAVE_RASCUNHO, { base: hashPublicado, conteudo: estado.rascunho, alteracoes: estado.alteracoes });
  if (opcoes.semDesenho) app.querySelector('.barra')?.replaceWith(fragmento(barraEdicao(contexto())));
  else desenhar(opcoes);
}

function descartar() {
  Object.assign(estado, { rascunho: null, alteracoes: 0, editando: false, confirmando: null, formulario: null, mensagem: '' });
  tocados.clear();
  cofre.limpar(CHAVE_RASCUNHO);
  desenhar();
}

async function comUmaRepeticao(fn) {
  try {
    return await fn();
  } catch (erro) {
    if (NAO_REPETIR.has(erro?.code)) throw erro;
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500));
    return fn();
  }
}

async function publicar() {
  const erros = validarConteudo(estado.rascunho);
  if (erros.length) {
    estado.mensagem = `Não dá para publicar ainda: ${erros[0]}.`;
    return desenhar();
  }
  Object.assign(estado, { publicando: true, mensagem: '', confirmando: null });
  desenhar();
  const reset = document.head.querySelector('style')?.textContent || RESET_PADRAO;
  const html = documentoCompleto(
    { titulo: config.titulo, fontes: config.fontes, css: fonte.css, js: fonte.js, conteudo: estado.rascunho, config },
    reset,
  );
  try {
    await comUmaRepeticao(() => armazenamento.publicar(html));
    // Depois de publicar, a página recarrega sozinha na versão nova. Este aviso só aparece se isso não acontecer.
    setTimeout(() => {
      Object.assign(estado, { publicando: false, mensagem: 'Publicado. Recarregue a página para ver a versão nova.' });
      desenhar();
    }, 8000);
  } catch (erro) {
    if (SEM_ESCRITA.has(erro?.code)) Object.assign(estado, { podeEditar: false, editando: false });
    Object.assign(estado, { publicando: false, mensagem: mensagemDePublicacao(erro?.code) });
    desenhar();
  }
}

function publicarEnsaio(html) {
  if (!html.startsWith('<!doctype html>')) throw { code: 'invalid_content' };
  cofre.gravar(CHAVE_ENSAIO, estado.rascunho);
  location.reload();
}

// ---------- formulário de material ----------

function abrirFormulario(lista) {
  estado.formulario = {
    lista, tipo: 'slides', url: '', nome: TIPOS.slides.nome, arquivo: '', erro: '',
    enviando: false, podeEnviar: armazenamento.podeEnviar,
  };
  desenhar({ foco: '#mat-url' });
}

function trocarTipo(f, tipo, foco) {
  const nomeAntigo = TIPOS[f.tipo].nome;
  f.tipo = tipo;
  if (!f.nome.trim() || f.nome === nomeAntigo) f.nome = TIPOS[tipo].nome;
  desenhar({ foco });
}

async function enviarArquivo(arquivo) {
  const f = estado.formulario;
  if (arquivo.size > LIMITE_ARQUIVO) {
    f.erro = mensagemDeEnvio('too_large');
    return desenhar();
  }
  Object.assign(f, { enviando: true, erro: '' });
  desenhar();
  try {
    f.url = await armazenamento.enviarArquivo(arquivo);
    f.arquivo = arquivo.name;
  } catch (erro) {
    f.erro = mensagemDeEnvio(erro?.code);
  }
  f.enviando = false;
  if (estado.formulario === f) desenhar({ foco: '#mat-nome' });
}

function concluirFormulario() {
  const f = estado.formulario;
  const url = f.url.trim();
  const nome = f.nome.trim();
  if (!f.arquivo && !urlValida(url)) {
    f.erro = 'Informe o endereço completo, começando com https://';
    return desenhar({ foco: '#mat-url' });
  }
  if (!nome) {
    f.erro = 'Dê um nome ao material.';
    return desenhar({ foco: '#mat-nome' });
  }
  estado.formulario = null;
  mudar({ op: 'adicionar', lista: f.lista, item: { id: novoId('ma'), tipo: f.tipo, nome, url } });
}

// ---------- ações avulsas ----------

function tocar(botao) {
  const quadro = document.createElement('iframe');
  quadro.className = 'player';
  quadro.src = `https://www.youtube-nocookie.com/embed/${botao.dataset.yt}?autoplay=1&rel=0`;
  quadro.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  quadro.allowFullscreen = true;
  quadro.title = botao.getAttribute('aria-label');
  botao.replaceWith(quadro);
}

async function copiar(botao) {
  try {
    await navigator.clipboard.writeText(botao.dataset.texto);
    botao.textContent = 'Copiado';
  } catch {
    const faixa = document.createRange();
    faixa.selectNodeContents(document.getElementById('email'));
    const selecao = getSelection();
    selecao.removeAllRanges();
    selecao.addRange(faixa);
    botao.textContent = 'Selecionado';
  }
}

// ---------- eventos ----------

function aoClicar(e) {
  const b = e.target.closest('[data-op]');
  if (!b) return;
  const { op, lista, novo } = b.dataset;
  const i = Number(b.dataset.i);
  switch (op) {
    case 'editar': Object.assign(estado, { editando: true, mensagem: '' }); return desenhar();
    case 'descartar':
      if (estado.alteracoes === 0) return descartar();
      estado.confirmando = 'descartar';
      return desenhar();
    case 'descartar-sim': return descartar();
    case 'publicar': return publicar();
    case 'subir': return mudar({ op: 'subir', lista, i });
    case 'descer': return mudar({ op: 'descer', lista, i });
    case 'remover': estado.confirmando = `${lista}.${i}`; return desenhar();
    case 'remover-nao': estado.confirmando = null; return desenhar();
    case 'remover-sim': estado.confirmando = null; return mudar({ op: 'remover', lista, i });
    case 'adicionar': {
      const posicao = ler(atual(), lista).length;
      return mudar({ op: 'adicionar', lista, item: novoItem(novo, hojeISO()) }, { foco: `[data-campo^="${lista}.${posicao}."]` });
    }
    case 'novo-material': return abrirFormulario(lista);
    case 'cancelar-material': estado.formulario = null; return desenhar();
    case 'copiar': return copiar(b);
    case 'tocar': return tocar(b);
    default: return undefined;
  }
}

function aoDigitar(e) {
  const el = e.target;
  if (el.matches('.ed[data-campo]')) {
    const bruto = el.textContent.replace(/\u00a0/g, ' ');
    const valor = el.classList.contains('ed-bloco') ? bruto : bruto.replace(/\s*\n\s*/g, ' ');
    mudar({ op: 'gravar', caminho: el.dataset.campo, valor }, { semDesenho: true });
  } else if (estado.formulario && el.form?.id === 'form-material' && (el.name === 'url' || el.name === 'nome')) {
    estado.formulario[el.name] = el.value;
  }
}

function aoMudar(e) {
  const el = e.target;
  if (el.matches('input[data-campo], select[data-campo]')) {
    return mudar({ op: 'gravar', caminho: el.dataset.campo, valor: el.value });
  }
  const f = estado.formulario;
  if (!f || el.form?.id !== 'form-material') return undefined;
  if (el.name === 'tipo') return trocarTipo(f, el.value, `#tipo-${el.value}`);
  if (el.name === 'url' && idDoYoutube(f.url) && f.tipo !== 'video') return trocarTipo(f, 'video', '#mat-nome');
  if (el.name === 'arquivo' && el.files[0]) return enviarArquivo(el.files[0]);
  return undefined;
}

function aoEnviar(e) {
  e.preventDefault();
  if (estado.formulario) concluirFormulario();
}

function aoTeclar(e) {
  if (e.key === 'Enter' && e.target.matches?.('.ed:not(.ed-bloco)')) {
    e.preventDefault();
    e.target.blur();
  } else if (e.key === 'Escape' && estado.formulario) {
    estado.formulario = null;
    desenhar();
  }
}

function aoColar(e) {
  if (SO_TEXTO || !e.target.closest?.('.ed')) return;
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
}

// ---------- partida ----------

async function iniciar() {
  desenhar();
  armazenamento = ENSAIO ? armazenamentoDeEnsaio(publicarEnsaio) : await criarArmazenamento(config.ambiente);
  estado.podeEditar = await armazenamento.podeEditar();
  if (!estado.podeEditar) return;
  const salvo = cofre.ler(CHAVE_RASCUNHO);
  const decisao = decidirRascunho(salvo, hashPublicado);
  if (decisao === 'publicado') {
    cofre.limpar(CHAVE_RASCUNHO);
    estado.mensagem = 'Publicado.';
  } else if (decisao !== 'nenhum') {
    Object.assign(estado, { rascunho: salvo.conteudo, alteracoes: salvo.alteracoes || 1, editando: true });
    estado.mensagem = decisao === 'restaurar'
      ? 'Suas alterações não publicadas foram restauradas.'
      : 'Rascunho restaurado. O site mudou desde então: publicar substitui a versão atual.';
  }
  desenhar();
}

app.addEventListener('click', aoClicar);
app.addEventListener('input', aoDigitar);
app.addEventListener('change', aoMudar);
app.addEventListener('submit', aoEnviar);
app.addEventListener('keydown', aoTeclar);
app.addEventListener('paste', aoColar);
addEventListener('hashchange', navegar);
iniciar();
```

- [ ] **Step 3: Criar `build.mjs`**

```js
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { corpoDaPagina, documentoCompleto } from './src/nucleo/documento.js';
import { validarConteudo } from './src/nucleo/conteudo.js';

const TITULO = 'Finanças e Economia Gerencial';
const FONTES = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap';

const lerJSON = async (arquivo, padrao) => {
  try { return JSON.parse(await readFile(arquivo, 'utf8')); } catch (erro) { if (padrao === undefined) throw erro; return padrao; }
};

const conteudo = await lerJSON('src/conteudo.json');
const erros = validarConteudo(conteudo);
if (erros.length) {
  console.error(`conteudo.json inválido:\n- ${erros.join('\n- ')}`);
  process.exit(1);
}

const css = await readFile('src/estilo.css', 'utf8');
const resultado = await build({
  entryPoints: ['src/app/principal.js'], bundle: true, format: 'iife', minify: true,
  target: 'es2022', charset: 'utf8', write: false,
});
// O programa vai dentro de uma tag <script>: nenhum fechamento de tag pode aparecer no texto dele.
const js = resultado.outputFiles[0].text.replace(/<\/(script|style)/gi, '<\\/$1');
if (/<\/style/i.test(css)) throw new Error('estilo.css contém "</style"');
// "<!--" seguido de "<script" dentro de um script muda o modo do leitor de HTML e quebra a página.
if (js.includes('<!--')) throw new Error('o programa contém "<!--"');

await mkdir('dist/local', { recursive: true });
await cp('midia', 'dist/local/midia', { recursive: true }).catch(() => { /* ainda sem mídia */ });

const saidas = [
  ['artifact', 'dist/artifact.html', corpoDaPagina],
  ['local', 'dist/local/index.html', documentoCompleto],
];
for (const [ambiente, arquivo, montar] of saidas) {
  const config = { ambiente, titulo: TITULO, fontes: FONTES, midia: await lerJSON(`src/midia.${ambiente}.json`, {}) };
  const html = montar({ titulo: TITULO, fontes: FONTES, css, js, conteudo, config });
  await writeFile(arquivo, html);
  console.log(`${arquivo}: ${Math.round(Buffer.byteLength(html) / 1024)} KB`);
}
```

- [ ] **Step 4: Criar `servidor.mjs`**

```js
// Servidor estático só para a versão local. O player do YouTube não funciona em file://.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const RAIZ = join(import.meta.dirname, 'dist', 'local');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  const pedido = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const arquivo = normalize(join(RAIZ, pedido === '/' ? 'index.html' : pedido));
  if (arquivo !== RAIZ && !arquivo.startsWith(RAIZ + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const dados = await readFile(arquivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' }).end(dados);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(4173, '127.0.0.1', () => console.log('http://localhost:4173'));
```

- [ ] **Step 5: Criar os arquivos de apoio**

`src/midia.artifact.json` e `src/midia.local.json`, ambos com:

```json
{}
```

`src/estilo.css`: arquivo vazio (a Task 7 preenche).

Conteúdo provisório, até a migração das Tasks 8 e 9:

```bash
node --input-type=module -e "import { conteudoExemplo } from './tests/fixtura.js'; import { writeFileSync } from 'node:fs'; writeFileSync('src/conteudo.json', JSON.stringify(conteudoExemplo(), null, 2) + '\n');"
```

- [ ] **Step 6: Montar**

Run: `npm run build`
Expected: duas linhas, `dist/artifact.html: NN KB` e `dist/local/index.html: NN KB`, ambas abaixo de 100 KB.

Run: `node -e "const h=require('fs').readFileSync('dist/artifact.html','utf8');console.log(h.startsWith('<title>'), h.split('</script>').length-1, /doctype/i.test(h.slice(0,200)))"`
Expected: `true 3 false`

- [ ] **Step 7: Registrar o servidor de pré-visualização**

Ler `C:\Users\pedro\Downloads\Claude Code\.claude\launch.json` se existir. Acrescentar esta configuração à lista `configurations`, mantendo as que já houver (se o arquivo não existir, criá-lo com `"version": "0.0.1"` e só esta configuração):

```json
{
  "name": "site-prof-antonio",
  "runtimeExecutable": "node",
  "runtimeArgs": ["site-prof-antonio/servidor.mjs"],
  "port": 4173
}
```

- [ ] **Step 8: Verificar a leitura no navegador**

Iniciar com a ferramenta `preview_start` (`name: "site-prof-antonio"`). Depois:

1. `navigate` para `http://localhost:4173/#d-eg`, `read_page`. Esperado: título "Economia Gerencial", aviso "Prova na quinta", links "Slides" e "Vídeo", nenhum botão "Editar".
2. `navigate` para `http://localhost:4173/#a-eg-1-1`, clicar no botão "Assistir: Curva de Demanda". Esperado: `find` por `iframe` devolve um elemento com `src` começando em `https://www.youtube-nocookie.com/embed/YHzoeE7-0sc`.
3. `read_console_messages` com `onlyErrors: true`. Esperado: nenhum erro do próprio site.

- [ ] **Step 9: Verificar a edição no modo de ensaio**

1. `navigate` para `http://localhost:4173/?ensaio#d-eg`. Esperado: botão "Editar" visível.
2. Clicar em "Editar", depois em "+ Novo aviso". Digitar `Aviso de teste` no campo que recebeu o foco. Esperado: barra mostra "Editando · 2 alterações".
3. Clicar em "Publicar". Esperado: a página recarrega, mostra a mensagem "Publicado." e o aviso "Aviso de teste" aparece fora do modo de edição.
4. Clicar em "Editar", no "×" do aviso de teste, em "Sim", e em "Publicar". Esperado: o aviso some.
5. Limpar o ensaio: `javascript_tool` com `localStorage.clear()`.

Se algum passo falhar, corrigir o código antes de seguir.

- [ ] **Step 10: Commit**

```bash
git add src/app src/midia.artifact.json src/midia.local.json src/conteudo.json src/estilo.css build.mjs servidor.mjs
git commit -m "feat: app shell, build and local preview server

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Aparência

**Files:**
- Modify: `src/estilo.css` (arquivo inteiro)

**Interfaces:**
- Consumes: as classes que `telas.js` emite (Task 5).
- Produces: tokens `--fundo`, `--papel`, `--tinta`, `--suave`, `--linha`, `--verde`, `--sobre-verde`, `--erro`, `--palco`, `--sobre-palco`, `--sombra`, `--serifa`, `--sans`, `--margem`, `--largura`.

- [ ] **Step 1: Escrever `src/estilo.css`**

```css
/* Layout: uma coluna de leitura; listas separadas por linhas finas; cartão só no aviso e no player. */
:root {
  --fundo: #fbfcfa; --papel: #eef3ef; --tinta: #17201b; --suave: #5a665f; --linha: #dfe5e0;
  --verde: #1d5a44; --sobre-verde: #fbfcfa; --erro: #9a3412;
  --palco: #141b17; --sobre-palco: #f4f7f5; --sombra: rgba(20, 27, 23, .55);
  --serifa: 'Newsreader', Georgia, 'Times New Roman', serif;
  --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --margem: clamp(16px, 5vw, 40px);
  --largura: 44rem;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fundo: #111613; --papel: #1a221d; --tinta: #e8eee9; --suave: #9aa8a0; --linha: #2a342e;
    --verde: #86c9ab; --sobre-verde: #111613; --erro: #f0a27c;
    --palco: #0b0f0d; --sobre-palco: #f4f7f5; --sombra: rgba(0, 0, 0, .65);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --fundo: #111613; --papel: #1a221d; --tinta: #e8eee9; --suave: #9aa8a0; --linha: #2a342e;
  --verde: #86c9ab; --sobre-verde: #111613; --erro: #f0a27c;
  --palco: #0b0f0d; --sobre-palco: #f4f7f5; --sombra: rgba(0, 0, 0, .65);
  color-scheme: dark;
}

/* Base */
* { box-sizing: border-box; }
body { background: var(--fundo); color: var(--tinta); font: 400 1rem/1.6 var(--sans); -webkit-text-size-adjust: 100%; }
h1, h2, h3, p, ul, ol, fieldset { margin: 0; padding: 0; }
ul, ol { list-style: none; }
fieldset { border: 0; min-width: 0; }
a { color: var(--verde); text-decoration-thickness: 1px; text-underline-offset: .2em; }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }
:focus-visible { outline: 2px solid var(--verde); outline-offset: 3px; border-radius: 2px; }
main:focus { outline: 0; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* Tipografia */
h1 { font: 400 clamp(2rem, 6vw, 3rem)/1.08 var(--serifa); letter-spacing: -.015em; text-wrap: balance; }
h2 { font: 500 1.375rem/1.25 var(--serifa); text-wrap: balance; }
h3 { font: 500 1.0625rem/1.35 var(--serifa); }
.eye { font: 600 .75rem/1.4 var(--sans); letter-spacing: .09em; text-transform: uppercase; color: var(--verde); }
.eye a { text-decoration: none; }
.lead { font: 400 1.25rem/1.45 var(--serifa); color: var(--suave); }
.suave, small { color: var(--suave); }
small { font-size: .8125rem; }
.prosa { display: grid; gap: 1em; font: 400 1.125rem/1.65 var(--serifa); }

/* Moldura */
.topo { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; padding: 16px var(--margem); border-bottom: 1px solid var(--linha); }
.marca { font: 500 1.0625rem/1.2 var(--serifa); color: var(--tinta); text-decoration: none; }
.topo nav { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: .875rem; }
.topo nav a { color: var(--suave); text-decoration: none; padding: 4px 0; }
.topo nav a:hover, .topo nav a[aria-current] { color: var(--tinta); }
.topo nav a[aria-current] { box-shadow: 0 1px 0 var(--tinta); }
.col { max-width: calc(var(--largura) + 2 * var(--margem)); margin-inline: auto; padding-inline: var(--margem); padding-block: clamp(28px, 6vw, 56px); display: grid; gap: 24px; }
.col > * { min-width: 0; }
.col section { display: grid; gap: 10px; }
.col section.modulo { margin-top: 12px; }
.rodape { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 24px; padding: 20px var(--margem); border-top: 1px solid var(--linha); font-size: .8125rem; color: var(--suave); }

/* Imagens de abertura e capa */
.abertura, .capa { position: relative; overflow: hidden; background: var(--papel); }
.abertura img, .capa img { display: block; width: 100%; height: auto; object-fit: cover; }
.abertura img { aspect-ratio: 8 / 3; max-height: 42vh; }
.capa img { aspect-ratio: 4 / 1; max-height: 30vh; }
.abertura video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .8s ease; }
.abertura video.tocando { opacity: 1; }

/* Listas */
.lista { border-top: 1px solid var(--linha); }
.lista > li { border-bottom: 1px solid var(--linha); }
.lista > li > a, .lista > li.editavel { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 12px 0; color: var(--tinta); text-decoration: none; }
.lista > li.editavel > a { flex: 1; padding: 0; }
.lista > li > a > span:first-child, .lista > li.editavel > span:first-child { font: 400 1.125rem/1.35 var(--serifa); min-width: 0; }
.lista > li > a > small { flex: none; text-align: right; }
.lista > li > a:hover > span:first-child { color: var(--verde); }

/* Avisos e ficha */
.avisos { display: grid; gap: 8px; }
.aviso { display: flex; justify-content: space-between; gap: 12px; background: var(--papel); border-radius: 6px; padding: 12px 14px; }
.aviso > div { min-width: 0; flex: 1; }
.aviso b { display: block; font: 600 .75rem/1.4 var(--sans); letter-spacing: .09em; text-transform: uppercase; color: var(--verde); }
.aviso .ate { display: block; font-size: .8125rem; color: var(--suave); margin: 4px 0; }
.ficha { border-top: 1px solid var(--linha); gap: 0; }
.ficha details { border-bottom: 1px solid var(--linha); }
.ficha summary { display: flex; justify-content: space-between; padding: 10px 0; color: var(--suave); cursor: pointer; list-style: none; }
.ficha summary::-webkit-details-marker { display: none; }
.ficha summary::after { content: '+'; color: var(--verde); }
.ficha details[open] summary::after { content: '–'; }
.ficha-corpo { display: grid; gap: .8em; padding-bottom: 14px; }

/* Módulos e aulas */
.linha-titulo { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.linha-titulo h2 { min-width: 0; }
.num { color: var(--verde); }
.aulas { border-top: 1px solid var(--linha); }
.aula { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--linha); }
.aula > div { min-width: 0; flex: 1; }
.aula small { display: block; font-size: .6875rem; letter-spacing: .08em; text-transform: uppercase; }
.aula-titulo { font: 400 1.125rem/1.35 var(--serifa); }
.aula-titulo a { color: var(--tinta); text-decoration: none; }
.aula-titulo a:hover { color: var(--verde); }
.aula-titulo .abrir { font: 400 .8125rem var(--sans); color: var(--verde); margin-left: 10px; }
.mats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { display: inline-flex; align-items: center; gap: 6px; font: 500 .8125rem/1.2 var(--sans); color: var(--verde); border: 1px solid var(--verde); border-radius: 3px; padding: 4px 9px; background: none; text-decoration: none; transition: background-color .15s ease, color .15s ease; }
a.chip:hover { background: var(--verde); color: var(--sobre-verde); }
.chip.novo { border-style: dashed; }
.chip > button { border: 0; background: none; color: inherit; padding: 0 2px; }

/* Aula: player e vizinhas */
.player { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; padding: 0; border-radius: 6px; overflow: hidden; background: var(--palco); color: var(--sobre-palco); text-decoration: none; }
.player img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .5; }
.play { position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; background: var(--sobre-palco); transition: transform .2s ease; }
.play::after { content: ''; position: absolute; left: 26px; top: 20px; border-left: 18px solid var(--palco); border-top: 12px solid transparent; border-bottom: 12px solid transparent; }
.player:hover .play { transform: scale(1.06); }
.legenda { position: absolute; left: 0; right: 0; bottom: 14px; text-align: center; font-size: .875rem; }
.vizinhas { display: flex; justify-content: space-between; gap: 16px; font-size: .9375rem; }
.vizinhas a { text-decoration: none; max-width: 48%; }
.vizinhas a:last-child { text-align: right; margin-left: auto; }

/* Pesquisa e Sobre */
.projetos, .pubs, .orientacoes { display: grid; gap: 14px; }
.projetos > li, .pubs > li, .orientacoes > li, .tempo > li { display: flex; justify-content: space-between; gap: 12px; }
.projetos > li > div, .pubs > li > div, .orientacoes > li > div { min-width: 0; flex: 1; }
.ano { font: 600 .8125rem/1.4 var(--sans); color: var(--suave); font-variant-numeric: tabular-nums; margin-top: 10px; }
.pubs { font-size: .9375rem; }
.perfil { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
.perfil > div { flex: 1 1 16rem; min-width: 0; }
.foto { width: 112px; height: 112px; border-radius: 50%; object-fit: cover; flex: none; }
.foto.mono { display: grid; place-items: center; background: var(--papel); color: var(--verde); font: 400 2.25rem/1 var(--serifa); }
.tempo { display: grid; gap: 18px; }
.tempo > li { justify-content: flex-start; gap: 16px; }
.tempo > li > div { flex: 1; min-width: 0; }
.periodo { flex: 0 0 6.5rem; font-size: .8125rem; color: var(--suave); font-variant-numeric: tabular-nums; padding-top: .25em; }
.areas p { margin: 0; }
.contato { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }

/* Edição */
.btn-editar { position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 5; background: var(--tinta); color: var(--fundo); border: 0; border-radius: 999px; padding: 10px 18px; font-weight: 500; }
.barra { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px; padding: 10px var(--margem); background: var(--tinta); color: var(--fundo); font-size: .875rem; }
.grupo { display: flex; gap: 8px; }
.barra button, .acoes button, .contato button { border: 1px solid currentColor; background: none; border-radius: 4px; padding: 5px 12px; }
.barra .pri { background: var(--fundo); color: var(--tinta); border-color: var(--fundo); }
.acoes .pri { background: var(--verde); color: var(--sobre-verde); border-color: var(--verde); }
.ed { display: inline-block; min-width: 3ch; outline: 1px dashed color-mix(in srgb, var(--verde) 55%, transparent); outline-offset: 3px; border-radius: 2px; }
.ed:focus { outline: 2px solid var(--verde); }
.ed:empty::before { content: attr(data-vazio); color: var(--suave); }
.ed-bloco { display: block; white-space: pre-wrap; min-height: 4.5em; }
.tools { flex: none; display: flex; align-items: center; gap: 2px; font: 400 .875rem var(--sans); color: var(--suave); }
.tools > button { border: 0; background: none; padding: 4px 8px; border-radius: 4px; }
.tools > button:hover:not(:disabled) { background: var(--papel); color: var(--tinta); }
.tools.conf { gap: 6px; }
.tools.conf > button { border: 1px solid currentColor; }
.add { justify-self: start; border: 1px dashed var(--verde); background: none; color: var(--verde); border-radius: 4px; padding: 7px 12px; font: 500 .875rem var(--sans); }
input[type="date"], select, .ano-in { border: 1px solid var(--linha); border-radius: 4px; background: var(--fundo); padding: 3px 6px; }
.msg { position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 6; width: max-content; max-width: min(92vw, 32rem); background: var(--tinta); color: var(--fundo); padding: 10px 16px; border-radius: 6px; font-size: .875rem; }

/* Formulário de material */
.folha-fundo { position: fixed; inset: 0; z-index: 10; background: var(--sombra); display: grid; place-items: end center; }
.folha { width: min(100%, 30rem); max-height: 92vh; overflow: auto; background: var(--fundo); border-radius: 12px 12px 0 0; padding: 20px var(--margem) calc(20px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 10px; }
.folha label, .folha legend { font: 600 .8125rem var(--sans); color: var(--suave); }
.folha input[type="url"], .folha input[type="text"] { width: 100%; border: 1px solid var(--linha); border-radius: 5px; padding: 9px 11px; background: var(--fundo); }
.seg { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.seg input { position: absolute; opacity: 0; }
.seg span { display: block; border: 1px solid var(--linha); border-radius: 999px; padding: 5px 12px; font: 400 .875rem var(--sans); color: var(--tinta); cursor: pointer; }
.seg input:checked + span { background: var(--verde); border-color: var(--verde); color: var(--sobre-verde); }
.seg input:focus-visible + span { outline: 2px solid var(--verde); outline-offset: 2px; }
.folha .drop { display: block; border: 1px dashed var(--verde); border-radius: 6px; padding: 14px; text-align: center; color: var(--verde); cursor: pointer; }
.ok { color: var(--verde); font-size: .875rem; }
.erro { color: var(--erro); font-size: .875rem; }
.nota { font-size: .8125rem; }
.acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
@media (min-width: 640px) {
  .folha-fundo { place-items: center; }
  .folha { border-radius: 12px; padding-inline: 24px; }
}

/* Movimento */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .18s; }
@media (prefers-reduced-motion: reduce) {
  *, ::view-transition-old(root), ::view-transition-new(root) { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 2: Montar e conferir tamanho**

Run: `npm run build`
Expected: os dois arquivos abaixo de 100 KB.

- [ ] **Step 3: Verificar no navegador, em quatro combinações**

Com o servidor `site-prof-antonio` rodando, para cada uma das rotas `#inicio`, `#d-eg`, `#a-eg-1-1`, `#pesquisa`, `#sobre`:

1. `resize_window` com `preset: "mobile"`, `colorScheme: "light"`; `navigate`; `screenshot`.
2. Repetir com `colorScheme: "dark"`.
3. `resize_window` com `preset: "desktop"`, nos dois temas.

Em cada tela, conferir com `javascript_tool`:

```js
({ rolaDeLado: document.documentElement.scrollWidth > innerWidth, fonteTitulo: getComputedStyle(document.querySelector('h1')).fontFamily })
```

Expected: `rolaDeLado: false` em todas; `fonteTitulo` começa com `Newsreader`.

Critérios visuais, olhando as capturas: texto legível nos dois temas; nenhum elemento encostado na borda; chips em linha, quebrando sem estourar; player com botão centralizado.

- [ ] **Step 4: Verificar a edição com estilo**

Em `http://localhost:4173/?ensaio#d-eg`, largura de celular: clicar em "Editar" e em "+ material". Expected: formulário aparece como folha na base da tela, os seis tipos cabem sem rolagem horizontal, o campo "Endereço" está com o foco. Captura de tela. Depois `localStorage.clear()` e `resize_window` com `preset: "desktop"`.

- [ ] **Step 5: Commit**

```bash
git add src/estilo.css
git commit -m "feat: visual design, light and dark themes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Conteúdo fixo (laboratório, textos, pesquisa, sobre)

**Files:**
- Modify: `src/conteudo.json` (arquivo inteiro; substitui o provisório)
- Create: `tests/conteudo-real.test.js`, `migracao/conferir.md`

**Interfaces:**
- Consumes: `validarConteudo`, `TIPOS` (Task 3).
- Produces: `src/conteudo.json` com `site`, `laboratorio`, `textos`, `pesquisa`, `sobre` reais e `disciplinas: []` (a Task 9 preenche). `migracao/conferir.md` com o que o Pedro precisa revisar.

Fontes, todas lidas com as ferramentas do navegador embutido (`navigate` + `get_page_text`):

| Conteúdo | Endereço |
|---|---|
| Laboratório | `https://pantoniofran.wixsite.com/sitio/anotacoes` |
| Lista de textos | `https://pantoniofran.wixsite.com/sitio/blog` |
| Publicações | `https://pantoniofran.wixsite.com/sitio/produção` |
| Resumo em inglês | `https://pantoniofran.wixsite.com/sitio/englishvitae` e `/the-site` |
| Orientações | `https://www.escavador.com/sobre/6457334/antonio-francisco-de-almeida-da-silva-junior` |

Se alguma página pedir CAPTCHA ou login, não contornar: registrar em `migracao/conferir.md` e seguir com o que já existe.

- [ ] **Step 1: Escrever o teste que falha**

`tests/conteudo-real.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarConteudo, TIPOS } from '../src/nucleo/conteudo.js';

const c = JSON.parse(readFileSync(new URL('../src/conteudo.json', import.meta.url), 'utf8'));
const tudo = JSON.stringify(c);

test('conteúdo real é válido', () => {
  assert.deepEqual(validarConteudo(c), []);
});

test('laboratório tem os 15 itens do site atual, com nome por extenso', () => {
  const itens = c.laboratorio.flatMap((g) => g.itens);
  assert.equal(itens.length, 15);
  for (const it of itens) {
    assert.ok(TIPOS[it.tipo], it.nome);
    assert.ok(/^https?:\/\//.test(it.url), it.nome);
    assert.ok(!/\.\s|Introd|Decis\b|MaxLuc|OpReal/.test(it.nome), `abreviação em "${it.nome}"`);
  }
});

test('textos: os três reais, sem o post de exemplo do Wix', () => {
  assert.deepEqual(c.textos.map((t) => t.id), ['financas-verdes', 'integrar-ou-nao-verticalmente', 'porto-sul-e-fiol']);
  for (const t of c.textos) {
    assert.match(t.data, /^2020-\d{2}-\d{2}$/);
    assert.ok(t.corpo.length > 400, t.id);
  }
  assert.ok(!tudo.includes('Crie um subtítulo'));
  assert.ok(!tudo.includes('Análise do quarto trimestre'));
});

test('publicações: pelo menos 30, cada uma com ano e referência', () => {
  assert.ok(c.pesquisa.publicacoes.length >= 30, `só ${c.pesquisa.publicacoes.length}`);
  for (const p of c.pesquisa.publicacoes) {
    assert.match(String(p.ano), /^(19|20)\d{2}$/, p.referencia);
    assert.ok(p.referencia.length > 30, p.id);
    assert.ok(['artigo', 'capitulo', 'outro'].includes(p.tipo), p.id);
  }
  assert.equal(c.pesquisa.projetos.length, 7);
});

test('sobre: formação, orientações e contato', () => {
  assert.equal(c.sobre.formacao.length, 7);
  assert.ok(c.sobre.orientacoes.length >= 20, `só ${c.sobre.orientacoes.length}`);
  for (const o of c.sobre.orientacoes) {
    assert.ok(['Doutorado', 'Mestrado', 'Especialização'].includes(o.nivel), o.aluno);
    assert.ok(o.aluno !== o.aluno.toUpperCase(), `nome em maiúsculas: ${o.aluno}`);
  }
  assert.equal(c.sobre.email, 'p.antoniofran@gmail.com');
  assert.ok(c.sobre.english.length > 200);
});

test('nada do que o Pedro pediu para deixar de fora', () => {
  assert.ok(!/Fala Razoavelmente|Compreende Bem|PARTICIPAÇÃO EM BANCAS/i.test(tudo));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em "laboratório tem os 15 itens" (o conteúdo provisório tem 1).

- [ ] **Step 3: Extrair os endereços do laboratório**

`navigate` para `/anotacoes` e rodar no `javascript_tool`:

```js
JSON.stringify([...document.querySelectorAll('main a[href]')].map((a) => ({ rotulo: a.innerText.trim().replace(/\s+/g, ' '), url: a.href })))
```

Montar `laboratorio` com esta tabela (o `url` é o extraído, completo; `id` é `lab-1` a `lab-15` na ordem abaixo):

| Rótulo no Wix | `nome` | `tipo` | `grupo` |
|---|---|---|---|
| Notas de Aula | Notas de aula | material | Notas |
| Planilha Índices | Planilha de índices financeiros | planilha | Planilhas |
| Planilha CAPM | Planilha do modelo CAPM | planilha | Planilhas |
| OpReal Proj Solar | Planilha: opções reais em projeto solar | planilha | Planilhas |
| Proj H2 verde | Planilha: projeto de hidrogênio verde | planilha | Planilhas |
| Plan. Max Três Prod | Planilha: maximização com três produtos | planilha | Planilhas |
| Instala R | Vídeo: instalação do R | video | R e código |
| Introd. R | Vídeo: introdução ao R | video | R e código |
| Retornos R | Vídeo: cálculo de retornos no R | video | R e código |
| Dados BCB no R | Script em R: dados do Banco Central | codigo | R e código |
| GitSemináriosFinanças | Repositório no GitHub: Seminários em Finanças | codigo | R e código |
| Vídeo MaxLuc | Vídeo: maximização de lucro | video | Vídeos |
| Vídeo Prog. Linear | Vídeo: programação linear | video | Vídeos |
| Vídeo Critérios Decis. | Vídeo: critérios de decisão | video | Vídeos |
| Vídeo Árvore de Decis. | Vídeo: árvore de decisão | video | Vídeos |

Ordem dos grupos: Notas, Planilhas, R e código, Vídeos.

- [ ] **Step 4: Extrair os três textos**

Em `/blog`, pegar o endereço de cada post (`a[href*="/post/"]`). Abrir os três posts reais e ler com `get_page_text`. Para cada um:

| `id` | Título no Wix | `data` |
|---|---|---|
| `financas-verdes` | Finanças Verdes | `2020-09-27` |
| `integrar-ou-nao-verticalmente` | Integrar ou não verticalmente – Petrobras, Ferbasa e Hapvida | `2020-09-26` |
| `porto-sul-e-fiol` | Porto Sul (Ilhéus) e a Ferrovia de Integração Oeste-Leste | `2020-05-31` |

- `titulo`: como está no Wix.
- `resumo`: a primeira frase do post, se ela funciona como subtítulo (ex.: "A decisão que exige visão estratégica."); senão, string vazia.
- `corpo`: o texto integral do post, sem título, autor, data, "min de leitura", contadores e botões. Parágrafos separados por linha em branco (`\n\n`). Não reescrever nem resumir.
- Ignorar o post "Análise do quarto trimestre" (texto de exemplo do Wix).

- [ ] **Step 5: Extrair publicações e orientações**

Publicações: `get_page_text` em `/produção` com `max_chars: 40000`. Cada parágrafo de referência vira um item, na ordem da página:
- `id`: `pb-1`, `pb-2`, ...
- `referencia`: o texto, com espaços duplicados reduzidos a um e sem caracteres invisíveis (`\u200b`).
- `ano`: o último número de quatro dígitos entre 1990 e 2026 da referência, como string.
- `tipo`: `artigo` sob "Artigos completos publicados em periódicos"; `capitulo` sob "Capítulos de livros publicados"; `outro` sob qualquer outro título.

Orientações: `get_page_text` no Escavador com `max_chars: 60000`. Usar só a seção "ORIENTOU". Entra cada item em que ele é "Orientador" ou "Coorientador" de Dissertação (`nivel: "Mestrado"`), Tese (`nivel: "Doutorado"`) ou Monografia de especialização (`nivel: "Especialização"`). Ficam de fora: trabalho de conclusão de graduação, iniciação científica e toda a seção "PARTICIPAÇÃO EM BANCAS".
- `id`: `or-1`, `or-2`, ...
- `aluno`: o nome; se vier todo em maiúsculas, converter para iniciais maiúsculas mantendo "de", "da", "do", "dos", "das" em minúsculas.
- `titulo`: o título do trabalho, sem ponto e vírgula final.
- `ano`: o ano indicado, como string.
- Se o mesmo aluno aparecer duas vezes no mesmo nível, manter os dois e anotar em `migracao/conferir.md`.

- [ ] **Step 6: Escrever `src/conteudo.json`**

Estrutura completa. As listas `laboratorio`, `textos`, `pesquisa.publicacoes` e `sobre.orientacoes` recebem o que foi extraído nos Steps 3 a 5; o resto é exatamente o que está abaixo. O campo `sobre.english` recebe o primeiro parágrafo de `/englishvitae` (o que começa com "Antonio Francisco de A. da Silva Junior teaches Finance"), seguido do texto de `/the-site` como segundo parágrafo, se essa página tiver texto.

```json
{
  "site": {
    "titulo": "Finanças e Economia Gerencial",
    "professor": "Prof. Dr. Antonio Francisco",
    "instituicao": "Escola de Administração da UFBA",
    "chamada": "Material de aula, pesquisa e textos em um só lugar.",
    "laboratorio": "Planilhas, scripts e vídeos de apoio às disciplinas.",
    "proposito": "Economia Gerencial é um campo de estudos que aplica técnicas e conceitos de microeconomia, teoria da decisão, pesquisa operacional, matemática, estatística, contabilidade, engenharia de produção e administração, para apoio na solução de problemas enfrentados pelas organizações. Em geral, esses problemas se associam às decisões sobre o que e como produzir, para quem produzir e qual a quantidade a ser produzida, considerando a escassez de recursos e o ambiente competitivo.\n\nFinanças é um campo de estudos dedicado a administração do dinheiro e dos investimentos, que utiliza técnicas e conceitos de matemática, estatística, economia, contabilidade e administração. Este sítio tem o propósito de promover educação e pesquisa em Finanças e Economia Gerencial.\n\nFoi criado para contribuir no desenvolvimento da capacidade analítica de estudantes e pessoas envolvidas no processo de decisão e formulação de estratégias para o crescimento sustentável."
  },
  "disciplinas": [],
  "laboratorio": [],
  "textos": [],
  "pesquisa": {
    "linhas": "As pesquisas desenvolvidas estão no campo das Finanças e Economia Gerencial e se concentram em análise de investimentos, gestão de riscos, finanças verdes e governança corporativa.\n\nOs projetos de pesquisa estão em sintonia com as linhas definidas no grupo de pesquisa cadastrado no CNPq.\n\nOs projetos de Finanças Verdes buscam identificar alternativas de financiamento e de análise de carteiras com ativos relacionados à sustentabilidade.\n\nOs projetos em parceria com a Deten Química tiveram entre seus objetivos o desenvolvimento e aplicação de ferramentas de gestão de riscos financeiros como apoio ao processo de decisão da empresa. Um deles contou com apoio do CNPq e da Fieb, no âmbito do projeto Inovatec.",
    "grupo": { "nome": "Grupo de Pesquisa em Finanças - UFBA", "url": "http://dgp.cnpq.br/dgp/espelhogrupo/185576" },
    "projetos": [
      { "id": "pj-1", "titulo": "Seleção de carteiras de investimentos com responsabilidade ambiental", "descricao": "" },
      { "id": "pj-2", "titulo": "Avaliação de alternativas para a promoção de Green Finance no Brasil", "descricao": "" },
      { "id": "pj-3", "titulo": "Avaliação de Projetos de Energia Renovável com o uso de Opções Reais e de alternativas de financiamento", "descricao": "" },
      { "id": "pj-4", "titulo": "Modelagem de riscos financeiros e o processo de tomada de decisão", "descricao": "Em parceria com a Deten Química." },
      { "id": "pj-5", "titulo": "Desenvolvimento de inovações em simulador para análise de riscos financeiros", "descricao": "Em parceria com a Deten Química." },
      { "id": "pj-6", "titulo": "Gestão de Riscos Financeiros na Deten Química", "descricao": "Em parceria com a Deten Química." },
      { "id": "pj-7", "titulo": "Desenvolvimento de ferramenta para apoio à decisão financeira na indústria", "descricao": "Em parceria com a Deten Química." }
    ],
    "publicacoes": []
  },
  "sobre": {
    "nome": "Antonio Francisco de Almeida da Silva Junior",
    "cargo": "Professor da Escola de Administração da UFBA, onde leciona disciplinas nas áreas de Finanças e Economia Gerencial.",
    "resumo": "Pós-doutorado como Pesquisador visitante na New York University 2015-2016 (Finance and Risk Engineering Department). Doutor em Engenharia Aeronáutica e Mecânica, em 2006, pelo departamento de Engenharia de Produção, do Instituto Tecnológico de Aeronáutica (ITA), com tese em intervenções cambiais em crises financeiras. Graduado em 1988 em Engenharia Química, concluiu mestrado em Engenharia, em 1998, com dissertação na área de Automação de Processos Industriais, e mestrado em Administração, em 2000, com dissertação na área de gerenciamento de risco de mercado, pela Universidade Federal da Bahia - UFBA.\n\nTrabalha na área de gestão de riscos, é professor na faculdade de Administração da UFBA, atua como professor participante do Programa de Pós-graduação em Engenharia Industrial, da UFBA, e é professor permanente do Núcleo de Pós-graduação em Administração NPGA-UFBA. Seus trabalhos acadêmicos estão orientados para a gestão de riscos e decisões de investimento em condições de incerteza, com ênfase em investimentos que consideram impactos ESG.",
    "formacao": [
      { "id": "fo-1", "periodo": "2015 – 2016", "titulo": "Pós-doutorado", "instituicao": "New York University, Finance and Risk Engineering Department", "detalhe": "Pesquisador visitante, com bolsa da CAPES." },
      { "id": "fo-2", "periodo": "2014 – 2015", "titulo": "Financial Risk Manager (FRM)", "instituicao": "Global Association of Risk Professionals (GARP)", "detalhe": "" },
      { "id": "fo-3", "periodo": "2004 – 2006", "titulo": "Doutorado em Engenharia Aeronáutica e Mecânica", "instituicao": "Instituto Tecnológico de Aeronáutica (ITA)", "detalhe": "Tese: Intervenções cambiais em crises: uma abordagem de controle estocástico com impulso." },
      { "id": "fo-4", "periodo": "1998 – 2000", "titulo": "Mestrado em Administração", "instituicao": "Universidade Federal da Bahia", "detalhe": "Dissertação: Avaliação de Modelos de Gerenciamento de Risco de Mercado." },
      { "id": "fo-5", "periodo": "1994 – 1998", "titulo": "Mestrado em Engenharia Química", "instituicao": "Universidade Federal da Bahia", "detalhe": "Dissertação: Sintonia de Controladores Proporcional, Integral e Derivativo." },
      { "id": "fo-6", "periodo": "1988 – 1989", "titulo": "Aperfeiçoamento em Engenharia de Processamento Petroquímico", "instituicao": "Petrobras", "detalhe": "" },
      { "id": "fo-7", "periodo": "1984 – 1988", "titulo": "Graduação em Engenharia Química", "instituicao": "Universidade Federal da Bahia", "detalhe": "" }
    ],
    "areas": "Administração › Finanças › Risco\nAdministração › Finanças › Investimento",
    "orientacoes": [],
    "lattes": "http://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K4796527A6",
    "email": "p.antoniofran@gmail.com",
    "english": ""
  }
}
```

- [ ] **Step 7: Escrever `migracao/conferir.md`**

```markdown
# Para o Pedro conferir

## Frases que eu escrevi (não são do professor)
- Abertura do Início: "Material de aula, pesquisa e textos em um só lugar."
- Apresentação do Laboratório: "Planilhas, scripts e vídeos de apoio às disciplinas."

## Texto do professor que eu adaptei
- Página Pesquisa: os dois parágrafos sobre os projetos (Finanças Verdes e Deten Química) foram reescritos de leve para fazer sentido antes da lista. Os fatos são os mesmos do site atual.
- Projetos com a Deten Química: a descrição "Em parceria com a Deten Química." foi condensada da frase original.

## Nomes do Laboratório expandidos por mim
(tabela: rótulo original → nome novo, as 15 linhas do Step 3)

## Página Sobre
- Fonte: Escavador, com dados do Lattes coletados em 02/04/2025. Pode estar desatualizado.
- Ficaram de fora, a seu pedido: nível de idioma e participação em bancas.
- Orientações repetidas ou duvidosas: (listar aqui, ou "nenhuma")

## Páginas que não consegui ler
(listar aqui, ou "nenhuma")
```

Preencher as partes entre parênteses com o que foi de fato encontrado.

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test`
Expected: 57 testes no total, 0 falhas.

Run: `npm run build`
Expected: os dois arquivos gerados, sem "conteudo.json inválido".

- [ ] **Step 9: Commit**

```bash
git add src/conteudo.json tests/conteudo-real.test.js migracao/conferir.md
git commit -m "feat: real content for lab, texts, research and about pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Migração das sete disciplinas

**Files:**
- Create: `scripts/agrupar.mjs`, `scripts/importar-disciplinas.mjs`, `scripts/conferir-links.mjs`, `migracao/bruto/{eg,fc1,fc2,sem,pfc,aep,fv}.json`, `migracao/disciplinas.md`, `migracao/links.md`
- Modify: `src/conteudo.json` (só `disciplinas`), `tests/conteudo-real.test.js`, `migracao/conferir.md`
- Test: `tests/agrupar.test.js`

**Interfaces:**
- Consumes: `idDoYoutube`, `tipoPorUrl` (Task 1); `TIPOS` (Task 3).
- Produces:
  - Formato bruto: `{ url, titulo, linhas: [{ t: string, r: [x, y, largura, altura] }], links: [{ href, r, icone: string }] }`
  - `tipoDoLink(link): string`; `agrupar(bruto, idDisciplina): { modulos, orfaos: string[] }`
  - `src/conteudo.json` com as 7 disciplinas

Como o Wix monta a página (verificado em Economia Gerencial): cada módulo é um bloco de texto "N. Título"; as aulas de um módulo ficam num único bloco, uma por parágrafo ("Aula N: Título"), às vezes com uma segunda linha de continuação; os materiais são ícones soltos, alinhados na altura da aula. Há três ícones, identificados pelo atributo `data-bbox` do SVG: `38.001 50 123.999 100` (apresentação), `1.6 2 56.8 56` (vídeo) e `42.5 29.5 115 141` (documento).

| `id` | Nível | Nome | Página |
|---|---|---|---|
| `eg` | graduacao | Economia Gerencial | `/graduacao/economia-gerencial` |
| `fc1` | graduacao | Finanças Corporativas 1 | `/graduacao/financascorporativas1` |
| `fc2` | graduacao | Finanças Corporativas 2 | `/graduacao/financascorporativas2` |
| `sem` | graduacao | Seminários em Finanças | `/graduacao/seminariosfinancas` |
| `pfc` | pos | Finanças Corporativas | `/fincorpposgrad` |
| `aep` | pos | Avaliação Econômica de Projetos | `/avaliacaoprojetos` |
| `fv` | pos | Finanças Sustentáveis/Verdes | `/financasverdes` |

- [ ] **Step 1: Escrever o teste que falha**

`tests/agrupar.test.js` (coordenadas reais da página de Economia Gerencial):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, tipoDoLink } from '../scripts/agrupar.mjs';

const APRESENTACAO = '38.001 50 123.999 100';
const VIDEO = '1.6 2 56.8 56';
const DOCUMENTO = '42.5 29.5 115 141';

const bruto = () => ({
  linhas: [
    { t: 'Economia Gerencial', r: [35, 297, 780, 66] },
    { t: '2. Introdução à Teoria dos Jogos', r: [129, 824, 516, 34] },
    { t: 'Aula 1: Definições', r: [153, 873, 360, 40] },
    { t: '1. Princípios de Microeconomia', r: [126, 521, 513, 34] },
    { t: 'Aula 1: Curva de Demanda', r: [159, 555, 354, 40] },
    { t: 'Aula 2: Custos da Firma', r: [159, 595, 354, 40] },
    { t: 'Aula 5: Cesta de produtos', r: [159, 715, 354, 40] },
    { t: '(Pesq Oper)', r: [159, 755, 354, 40] },
    { t: 'Precisa de mais informações?', r: [100, 2400, 500, 40] },
  ],
  links: [
    { href: 'https://x.filesusr.com/ugd/b.pdf', r: [624, 555, 22, 27], icone: DOCUMENTO },
    { href: 'https://x.filesusr.com/ugd/a.pdf', r: [549, 558, 33, 27], icone: APRESENTACAO },
    { href: 'https://youtu.be/YHzoeE7-0sc', r: [588, 558, 25, 25], icone: VIDEO },
    { href: 'https://x.filesusr.com/ugd/c.xlsx?dn=Sorvete.xlsx', r: [624, 598, 22, 27], icone: DOCUMENTO },
    { href: 'https://youtu.be/UnDA482Imdo', r: [588, 760, 25, 24], icone: VIDEO },
    { href: 'https://x.filesusr.com/ugd/perdido.pdf', r: [549, 1500, 33, 27], icone: APRESENTACAO },
  ],
});

test('tipoDoLink usa o endereço e, para PDF, o ícone', () => {
  assert.equal(tipoDoLink({ href: 'https://youtu.be/YHzoeE7-0sc', icone: VIDEO }), 'video');
  assert.equal(tipoDoLink({ href: 'https://x/a.pdf', icone: APRESENTACAO }), 'slides');
  assert.equal(tipoDoLink({ href: 'https://x/b.pdf', icone: DOCUMENTO }), 'material');
  assert.equal(tipoDoLink({ href: 'https://x/c.xlsx?dn=a.xlsx', icone: DOCUMENTO }), 'planilha');
});

test('agrupar ordena módulos pela posição na página, não pela ordem do HTML', () => {
  const { modulos } = agrupar(bruto(), 'eg');
  assert.deepEqual(modulos.map((m) => m.titulo), ['Princípios de Microeconomia', 'Introdução à Teoria dos Jogos']);
  assert.deepEqual(modulos.map((m) => m.id), ['eg-1', 'eg-2']);
});

test('agrupar tira o prefixo "Aula N:" e junta a linha de continuação', () => {
  const { modulos } = agrupar(bruto(), 'eg');
  assert.deepEqual(modulos[0].aulas.map((a) => a.titulo), ['Curva de Demanda', 'Custos da Firma', 'Cesta de produtos (Pesq Oper)']);
  assert.deepEqual(modulos[0].aulas.map((a) => a.id), ['eg-1-1', 'eg-1-2', 'eg-1-3']);
  assert.equal(modulos[1].aulas[0].titulo, 'Definições');
});

test('agrupar liga cada ícone à aula da mesma altura, da esquerda para a direita', () => {
  const [a1, a2, a3] = agrupar(bruto(), 'eg').modulos[0].aulas;
  assert.deepEqual(a1.materiais.map((m) => m.tipo), ['slides', 'video', 'material']);
  assert.deepEqual(a1.materiais.map((m) => m.id), ['eg-1-1-m1', 'eg-1-1-m2', 'eg-1-1-m3']);
  assert.equal(a1.materiais[0].nome, 'Slides da aula');
  assert.deepEqual(a2.materiais.map((m) => m.tipo), ['planilha']);
  assert.deepEqual(a3.materiais.map((m) => m.url), ['https://youtu.be/UnDA482Imdo']);
});

test('agrupar não cola o rodapé na última aula e devolve os links sem aula', () => {
  const { modulos, orfaos } = agrupar(bruto(), 'eg');
  assert.ok(!JSON.stringify(modulos).includes('Precisa de mais'));
  assert.deepEqual(orfaos, ['https://x.filesusr.com/ugd/perdido.pdf']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module ... scripts/agrupar.mjs`

- [ ] **Step 3: Implementar `scripts/agrupar.mjs`**

```js
import { idDoYoutube, tipoPorUrl } from '../src/nucleo/youtube.js';
import { TIPOS } from '../src/nucleo/conteudo.js';

export const ICONE_APRESENTACAO = '38.001 50 123.999 100';
const DISTANCIA_MAXIMA = 30; // px entre o centro do ícone e o centro da linha da aula
const SALTO_DE_LINHA = 60;   // px: acima disso, a linha não é continuação da aula anterior

const centroY = (r) => r[1] + r[3] / 2;

export function tipoDoLink(link) {
  if (idDoYoutube(link.href)) return 'video';
  const tipo = tipoPorUrl(link.href);
  if (tipo !== 'slides') return tipo;
  return link.icone === ICONE_APRESENTACAO ? 'slides' : 'material';
}

export function agrupar(bruto, idDisciplina) {
  const modulos = [];
  const alvos = []; // { y, aula, links: [] }
  let aula = null;

  for (const linha of [...bruto.linhas].sort((a, b) => a.r[1] - b.r[1])) {
    const y = centroY(linha.r);
    const eModulo = /^(\d+)\.\s+(.+)$/.exec(linha.t);
    const eAula = /^Aula\s+\d+\s*:\s*(.+)$/i.exec(linha.t);
    if (eModulo) {
      modulos.push({ id: `${idDisciplina}-${modulos.length + 1}`, titulo: eModulo[2].trim(), aulas: [] });
      aula = null;
    } else if (eAula && modulos.length) {
      const modulo = modulos.at(-1);
      aula = { id: `${modulo.id}-${modulo.aulas.length + 1}`, titulo: eAula[1].trim(), materiais: [] };
      modulo.aulas.push(aula);
      alvos.push({ y, aula, links: [] });
    } else if (aula && y - alvos.at(-1).y < SALTO_DE_LINHA) {
      aula.titulo += ` ${linha.t}`;
      alvos.push({ y, aula, links: [] });
    } else {
      aula = null;
    }
  }

  const orfaos = [];
  for (const link of bruto.links) {
    const y = centroY(link.r);
    const perto = alvos.reduce((melhor, alvo) => (!melhor || Math.abs(alvo.y - y) < Math.abs(melhor.y - y) ? alvo : melhor), null);
    if (!perto || Math.abs(perto.y - y) > DISTANCIA_MAXIMA) orfaos.push(link.href);
    else perto.links.push(link);
  }

  const porAula = new Map();
  for (const alvo of alvos) porAula.set(alvo.aula, [...(porAula.get(alvo.aula) ?? []), ...alvo.links]);
  for (const [a, links] of porAula) {
    a.materiais = links.sort((p, q) => p.r[0] - q.r[0]).map((link, k) => {
      const tipo = tipoDoLink(link);
      return { id: `${a.id}-m${k + 1}`, tipo, nome: TIPOS[tipo].nome, url: link.href };
    });
  }
  return { modulos, orfaos };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: 62 testes no total, 0 falhas.

- [ ] **Step 5: Extrair as sete páginas**

Para cada linha da tabela de disciplinas: `navigate` para `https://pantoniofran.wixsite.com/sitio` + página, esperar 3 segundos, e rodar no `javascript_tool`:

```js
(() => {
  const principal = document.querySelector('main');
  const caixa = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left + scrollX), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; };
  const linhas = [];
  for (const texto of principal.querySelectorAll('[data-testid="richTextElement"]')) {
    const partes = texto.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    for (const parte of (partes.length ? partes : [texto])) {
      const t = parte.innerText.replace(/[\u200b\s]+/g, ' ').trim();
      if (t) linhas.push({ t, r: caixa(parte) });
    }
  }
  const links = [...principal.querySelectorAll('a[href]')]
    .filter((a) => !a.href.includes('pantoniofran.wixsite.com'))
    .map((a) => ({ href: a.href, r: caixa(a), icone: a.querySelector('svg')?.getAttribute('data-bbox') ?? '' }));
  return JSON.stringify({ url: location.href, titulo: document.title, linhas, links });
})()
```

Gravar o resultado, sem alterar, em `migracao/bruto/<id>.json`.

Conferir também `https://pantoniofran.wixsite.com/sitio/cópia-avaliação-econômica-de-projetos` (página sem link no menu). Se tiver conteúdo diferente de `/avaliacaoprojetos`, anotar em `migracao/conferir.md`; não migrar.

- [ ] **Step 6: Criar `scripts/importar-disciplinas.mjs`**

```js
// Roda uma vez: substitui "disciplinas" em src/conteudo.json. Ajustes manuais vêm depois.
import { readFile, writeFile } from 'node:fs/promises';
import { agrupar } from './agrupar.mjs';

const DISCIPLINAS = [
  ['eg', 'graduacao', 'Economia Gerencial'],
  ['fc1', 'graduacao', 'Finanças Corporativas 1'],
  ['fc2', 'graduacao', 'Finanças Corporativas 2'],
  ['sem', 'graduacao', 'Seminários em Finanças'],
  ['pfc', 'pos', 'Finanças Corporativas'],
  ['aep', 'pos', 'Avaliação Econômica de Projetos'],
  ['fv', 'pos', 'Finanças Sustentáveis/Verdes'],
];

const conteudo = JSON.parse(await readFile('src/conteudo.json', 'utf8'));
const tabela = ['| Disciplina | Módulos | Aulas | Links no Wix | Migrados | Sem aula | Rotulados "Material" |', '|---|---|---|---|---|---|---|'];
const pendencias = [];
conteudo.disciplinas = [];

for (const [id, nivel, nome] of DISCIPLINAS) {
  const bruto = JSON.parse(await readFile(`migracao/bruto/${id}.json`, 'utf8'));
  const { modulos, orfaos } = agrupar(bruto, id);
  const aulas = modulos.flatMap((m) => m.aulas);
  const materiais = aulas.flatMap((a) => a.materiais);
  const genericos = materiais.filter((m) => m.tipo === 'material').length;
  tabela.push(`| ${nome} | ${modulos.length} | ${aulas.length} | ${bruto.links.length} | ${materiais.length} | ${orfaos.length} | ${genericos} |`);
  for (const url of orfaos) pendencias.push(`- ${nome}: link sem aula correspondente: ${url}`);
  if (materiais.length + orfaos.length !== bruto.links.length) pendencias.push(`- ${nome}: a soma não fecha com o Wix`);
  conteudo.disciplinas.push({
    id, nivel, nome,
    ficha: { ementa: '', objetivos: '', avaliacao: '', bibliografia: '' },
    avisos: [],
    modulos,
  });
}

await writeFile('src/conteudo.json', `${JSON.stringify(conteudo, null, 2)}\n`);
await writeFile('migracao/disciplinas.md', ['# Migração das disciplinas', '', ...tabela, '', '## Pendências', '', ...(pendencias.length ? pendencias : ['Nenhuma.']), ''].join('\n'));
console.log(tabela.join('\n'));
console.log(pendencias.length ? `\n${pendencias.length} pendência(s): ver migracao/disciplinas.md` : '\nSem pendências.');
```

Run: `node scripts/importar-disciplinas.mjs`
Expected: tabela com 7 linhas. Economia Gerencial com 7 módulos e "Migrados" + "Sem aula" igual a "Links no Wix".

- [ ] **Step 7: Resolver o que o script não resolveu**

Para cada disciplina, na ordem:

1. **Módulos ou aulas zerados.** A página usa outro formato. Abrir `migracao/bruto/<id>.json`, ler as linhas em ordem de `r[1]` e montar `modulos` à mão em `src/conteudo.json`, com o mesmo formato de ids (`<id>-<módulo>-<aula>`, materiais `-m<n>`). Página sem aulas e sem links: deixar `modulos: []` e anotar em `migracao/conferir.md`.
2. **Links sem aula.** Abrir a página no navegador, localizar o ícone pela posição e ligar o material à aula certa. Se não houver aula visível ao lado, criar no módulo mais próximo uma aula chamada "Material complementar".
3. **Materiais rotulados "Material".** São PDFs com o ícone de documento. Abrir três deles, de disciplinas diferentes, com `navigate` e olhar a primeira página.
   - Se os três forem listas de exercícios: trocar todos os PDFs com esse ícone para `tipo: "exercicios"`, `nome: "Lista de exercícios"`.
   - Se os três forem texto corrido ou notas: manter `tipo: "material"` e trocar o nome para `"Texto de apoio"`.
   - Se divergirem: manter `tipo: "material"`, `nome: "Material"`, e listar em `migracao/conferir.md` as aulas afetadas, para o Pedro decidir.
4. Depois de qualquer ajuste manual, acrescentar em `migracao/disciplinas.md` uma seção "Ajustes manuais" dizendo o que foi feito.

- [ ] **Step 8: Ampliar o teste do conteúdo real**

Acrescentar ao fim de `tests/conteudo-real.test.js`:

```js
test('as sete disciplinas, na ordem do site atual', () => {
  assert.deepEqual(c.disciplinas.map((d) => d.id), ['eg', 'fc1', 'fc2', 'sem', 'pfc', 'aep', 'fv']);
  assert.deepEqual(c.disciplinas.map((d) => d.nivel), ['graduacao', 'graduacao', 'graduacao', 'graduacao', 'pos', 'pos', 'pos']);
});

test('Economia Gerencial: 7 módulos, e toda aula com vídeo tem player', () => {
  const eg = c.disciplinas[0];
  assert.equal(eg.modulos.length, 7);
  assert.equal(eg.modulos[0].titulo, 'Princípios de Microeconomia');
  assert.equal(eg.modulos[0].aulas[0].titulo, 'Curva de Demanda');
  const materiais = eg.modulos.flatMap((m) => m.aulas.flatMap((a) => a.materiais));
  assert.ok(materiais.length >= 55, `só ${materiais.length} materiais`);
});

test('nenhum conteúdo acadêmico inventado', () => {
  for (const d of c.disciplinas) {
    assert.deepEqual(d.ficha, { ementa: '', objetivos: '', avaliacao: '', bibliografia: '' }, d.id);
    assert.deepEqual(d.avisos, [], d.id);
  }
});

test('todo material tem endereço http e nome', () => {
  for (const d of c.disciplinas) for (const m of d.modulos) for (const a of m.aulas) for (const mat of a.materiais) {
    assert.match(mat.url, /^https?:\/\//, `${a.id}`);
    assert.ok(mat.nome.trim(), `${a.id}`);
  }
});
```

Run: `npm test`
Expected: 66 testes no total, 0 falhas.

- [ ] **Step 9: Criar `scripts/conferir-links.mjs` e rodar**

```js
import { readFile, writeFile } from 'node:fs/promises';
import { idDoYoutube } from '../src/nucleo/youtube.js';

const c = JSON.parse(await readFile('src/conteudo.json', 'utf8'));
const itens = [];
for (const d of c.disciplinas) for (const m of d.modulos) for (const a of m.aulas) for (const mat of a.materiais) {
  itens.push({ onde: `${d.nome} › ${m.titulo} › ${a.titulo} › ${mat.nome}`, url: mat.url });
}
for (const g of c.laboratorio) for (const it of g.itens) itens.push({ onde: `Laboratório › ${it.nome}`, url: it.url });

async function pedir(url, opcoes) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), ...opcoes });
  await r.body?.cancel();
  return r.status;
}

async function conferir(url) {
  try {
    // Vídeo: o oEmbed do YouTube responde 200 só se o vídeo existe e é público ou não listado.
    if (idDoYoutube(url)) return await pedir(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    const status = await pedir(url, { method: 'HEAD' });
    return status === 403 || status === 405 ? await pedir(url, { headers: { range: 'bytes=0-0' } }) : status;
  } catch (erro) {
    return `erro (${erro.name})`;
  }
}

const resultados = [];
let proximo = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (proximo < itens.length) {
    const item = itens[proximo++];
    resultados.push({ ...item, status: await conferir(item.url) });
  }
}));

const ruins = resultados.filter((r) => r.status !== 200 && r.status !== 206);
await writeFile('migracao/links.md', [
  '# Conferência de links', '',
  `${resultados.length} endereços testados, ${ruins.length} com problema.`, '',
  ...(ruins.length ? ['| Onde | Resposta | Endereço |', '|---|---|---|', ...ruins.map((r) => `| ${r.onde} | ${r.status} | ${r.url} |`)] : ['Todos responderam.']),
  '',
].join('\n'));
console.log(`${resultados.length} endereços, ${ruins.length} com problema. Ver migracao/links.md`);
```

Run: `node scripts/conferir-links.mjs`
Expected: `NNN endereços, N com problema.` O número de problemas pode ser maior que zero: link quebrado no site original continua no novo e entra no relatório. Não remover material por conta disso.

- [ ] **Step 10: Montar e olhar o resultado**

Run: `npm run build`
Expected: `dist/artifact.html` abaixo de 300 KB.

No navegador (`http://localhost:4173/#d-eg`): conferir com `get_page_text` que os 7 módulos aparecem na ordem do Wix e que a "Aula 1: Curva de Demanda" tem os mesmos três materiais.

- [ ] **Step 11: Commit**

```bash
git add scripts tests/agrupar.test.js tests/conteudo-real.test.js src/conteudo.json migracao
git commit -m "feat: migrate the seven courses from the Wix site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Imagens e vídeo de abertura

**Files:**
- Create: `midia/poster.webp`, `midia/hero.mp4`, `midia/capa-{eg,fc1,fc2,sem,pfc,aep,fv}.webp`
- Modify: `src/midia.local.json`, `.gitignore`

**Interfaces:**
- Consumes: chaves de mídia definidas na Task 5 (`poster`, `hero`, `capa-<id>`).
- Produces: nove arquivos em `midia/`; `src/midia.local.json` apontando para eles. A Task 11 envia os mesmos arquivos ao Artifact.

Se o Pedro não aprovar o gasto, pular esta task inteira. O site funciona sem imagens (os testes da Task 5 cobrem esse caso), e a Task 11 segue sem o envio de mídia.

- [ ] **Step 1: Carregar as ferramentas e levantar custo**

`ToolSearch` com `select:mcp__higgsfield__balance,mcp__higgsfield__models_explore,mcp__higgsfield__generate_image,mcp__higgsfield__generate_video,mcp__higgsfield__jobs_wait,mcp__higgsfield__show_generation_by_ids`.

Chamar `balance`. Chamar `models_explore` para escolher um modelo de imagem que aceite proporção 16:9 e um modelo de imagem para vídeo de 5 segundos, anotando o custo em créditos de cada geração.

- [ ] **Step 2: Pedir a confirmação do Pedro**

Usar `AskUserQuestion` com o saldo atual, o custo de 8 imagens e 1 vídeo, e o saldo que sobra. Opções: "Gerar tudo", "Só as imagens, sem vídeo", "Não gerar". Seguir conforme a resposta. Sem resposta afirmativa, não gerar nada.

- [ ] **Step 3: Gerar as oito imagens**

Proporção 16:9. Todas com este estilo, anexado ao fim de cada pedido:

```
Minimal abstract editorial illustration. Thin deep-green ink lines (#1d5a44) on an off-white paper background (#fbfcfa). Generous empty space, flat, calm, subtle paper grain. No text, no letters, no numbers, no axes labels, no people, no logos. Composition centered in a wide horizontal band.
```

| Arquivo | Assunto |
|---|---|
| `hero` | A few smooth curves crossing gently, suggesting supply and demand and a rising yield curve |
| `capa-eg` | Two curves crossing, one rising and one falling, with a single small dot at the crossing point |
| `capa-fc1` | Stacked horizontal bars of different lengths, like a simplified balance sheet |
| `capa-fc2` | A thin branching tree growing from left to right, like a decision tree |
| `capa-sem` | Thin concentric arcs spreading from two centers and overlapping, like ripples |
| `capa-pfc` | One smooth convex curve touched by a straight tangent line, like an efficient frontier |
| `capa-aep` | A row of thin vertical bars above and below a baseline, like cash flows over time |
| `capa-fv` | Thin contour lines of a hill with a small three-line wind turbine on top |

Olhar cada resultado. Refazer, no máximo duas vezes por imagem, se tiver texto, número, pessoa, cor fora do verde, ou fundo que não seja quase branco. Se depois de duas tentativas continuar ruim, ficar sem aquela capa e avisar o Pedro.

- [ ] **Step 4: Gerar o vídeo a partir da imagem `hero`**

Imagem para vídeo, 5 segundos, com este pedido:

```
The lines drift very slowly and subtly, like ink settling on paper. No camera movement, no zoom, no new elements, no text. Calm and almost still.
```

- [ ] **Step 5: Baixar os originais**

Acrescentar `midia/bruto/` ao `.gitignore`. Baixar cada arquivo gerado para `midia/bruto/` com `curl -L -o midia/bruto/<nome>.<ext> "<endereço devolvido pela geração>"`, usando os nomes da tabela (`hero.png`, `hero.mp4`, `capa-eg.png`, ...).

- [ ] **Step 6: Comprimir**

Capas (proporção 4:1), uma vez para cada um dos sete ids:

```bash
ffmpeg -y -i midia/bruto/capa-eg.png -vf "scale=1600:-2,crop=1600:400" -c:v libwebp -quality 74 midia/capa-eg.webp
```

Vídeo (proporção 8:3, ida e volta para o loop não ter corte):

```bash
ffmpeg -y -i midia/bruto/hero.mp4 -an -filter_complex "[0:v]scale=1280:-2,crop=1280:480,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]" -map "[v]" -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart midia/hero.mp4
```

Imagem de espera, tirada do primeiro quadro do vídeo final para não haver salto:

```bash
ffmpeg -y -i midia/hero.mp4 -frames:v 1 -c:v libwebp -quality 78 midia/poster.webp
```

Se o Pedro escolheu "só as imagens": gerar o `poster.webp` a partir de `midia/bruto/hero.png` com `-vf "scale=1280:-2,crop=1280:480"` e não criar `hero.mp4`.

Run: `ls -l midia/*.webp midia/*.mp4`
Expected: `hero.mp4` até 1.500.000 bytes; cada `.webp` até 90.000 bytes. Se o vídeo passar, repetir o comando com `-crf 34`. Se uma capa passar, repetir com `-quality 60`.

- [ ] **Step 7: Apontar a versão local para os arquivos**

`src/midia.local.json` (remover a linha `hero` se não houver vídeo, e a linha de qualquer capa que não foi gerada):

```json
{
  "poster": "midia/poster.webp",
  "hero": "midia/hero.mp4",
  "capa-eg": "midia/capa-eg.webp",
  "capa-fc1": "midia/capa-fc1.webp",
  "capa-fc2": "midia/capa-fc2.webp",
  "capa-sem": "midia/capa-sem.webp",
  "capa-pfc": "midia/capa-pfc.webp",
  "capa-aep": "midia/capa-aep.webp",
  "capa-fv": "midia/capa-fv.webp"
}
```

- [ ] **Step 8: Verificar**

Run: `npm run build`

No navegador, `http://localhost:4173/#inicio`: captura de tela nos temas claro e escuro. Conferir que a imagem aparece, o vídeo entra por cima com transição suave e o texto abaixo continua legível. Em `#d-eg` e `#a-eg-1-1`: capa no topo.

Com `javascript_tool`: `performance.getEntriesByType('resource').length`
Expected: até 15.

- [ ] **Step 9: Commit**

```bash
git add midia/*.webp midia/*.mp4 src/midia.local.json .gitignore
git commit -m "feat: opening loop and course covers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Publicar no Claude

**Files:**
- Modify: `src/midia.artifact.json`
- Create: `migracao/artifact.txt` (endereço do Artifact, para as tasks seguintes)

**Interfaces:**
- Consumes: `dist/artifact.html` (Task 6), arquivos de `midia/` (Task 10).
- Produces: Artifact publicado e privado, com as capacidades `{ artifact: {}, assets: {} }`; `src/midia.artifact.json` com os endereços devolvidos pelo envio.

- [ ] **Step 1: Carregar as regras de publicação**

Invocar as skills `artifact-design` e `artifact-capabilities` antes de qualquer chamada à ferramenta `Artifact`. Conferir `dist/artifact.html` contra o contrato da página: começa com `<title>`, sem doctype, cores por token, nenhum recurso externo além do Google Fonts.

- [ ] **Step 2: Primeira publicação, sem mídia**

Run: `npm test && npm run build`
Expected: 0 falhas; `dist/artifact.html` abaixo de 300 KB.

Chamar `Artifact` com:
- `file_path`: `C:\Users\pedro\Downloads\Claude Code\site-prof-antonio\dist\artifact.html`
- `icon`: `book`
- `description`: `Material de aula, pesquisa e textos do Prof. Antonio Francisco, da UFBA, editável no próprio site.`
- `capabilities`: `{ "artifact": {}, "assets": {} }`

Gravar o endereço devolvido em `migracao/artifact.txt`.

- [ ] **Step 3: Enviar a mídia**

Pular se a Task 10 foi pulada.

Chamar `Artifact` com `url` (o endereço do Step 2), `asset: true` e `file_paths` com os nove arquivos de `midia/` (os que existirem). Copiar o `url` de cada arquivo, exatamente como devolvido, para `src/midia.artifact.json`, com as mesmas chaves de `src/midia.local.json`.

- [ ] **Step 4: Republicar com a mídia**

Run: `npm run build`

Chamar `Artifact` de novo com o mesmo `file_path`, sem `icon` e sem `capabilities` (assim o endereço, o ícone e as capacidades se mantêm).

- [ ] **Step 5: Conferir o que foi publicado**

1. `Artifact` com `action: "list"`, `scope: "assets"`, `url`: a lista tem os arquivos enviados.
2. Se existir a ferramenta `ArtifactCheck` (procurar com `ToolSearch`), rodar uma pré-visualização e corrigir o que ela apontar: estouro lateral, cor fora do tema, carregamento bloqueado, erro no console.
3. `Artifact` com `action: "read"`, `url`: o conteúdo devolvido contém `id="conteudo"` e `Economia Gerencial`.

- [ ] **Step 6: Testar a edição de verdade**

Abrir o endereço do Artifact no navegador embutido. Se a página pedir login no Claude, não entrar com credenciais: pedir ao Pedro que faça os passos abaixo e conte o resultado.

1. Abrir "Economia Gerencial". Clicar em "Editar".
2. "+ Novo aviso", digitar `Teste de publicação`. Clicar em "Publicar".
3. Esperado: a página recarrega, mostra "Publicado." e o aviso aparece. As imagens continuam carregando.
4. "Editar", remover o aviso de teste ("×", "Sim"), "Publicar". Esperado: o aviso some.

Se a publicação falhar, a mensagem na tela indica o código. `invalid_content`: o documento regenerado não começa com doctype ou está malformado; revisar `documentoCompleto` e o Step 6 da Task 6. Imagens sumindo depois de publicar: os endereços da mídia não sobreviveram à nova versão; nesse caso, embutir as capas como `data:` em `src/midia.artifact.json`, remover `hero` e republicar, avisando o Pedro.

- [ ] **Step 7: Commit**

```bash
git add src/midia.artifact.json migracao/artifact.txt
git commit -m "chore: publish to Claude and record asset addresses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Polimento e entrega

**Files:**
- Modify: `src/estilo.css`, `src/nucleo/telas.js` (só o que a revisão apontar)

**Interfaces:**
- Consumes: site montado e publicado.
- Produces: versão final republicada; resumo para o Pedro.

- [ ] **Step 1: Auditoria técnica**

Invocar a skill `audit` sobre a versão local (`http://localhost:4173`), cobrindo `#inicio`, `#d-eg`, `#a-eg-1-1`, `#sobre` e o modo de edição (`?ensaio#d-eg`). Corrigir todos os achados P0 e P1. Achados P2 e P3: corrigir os que custam menos de dez minutos cada; listar os demais para o Pedro.

- [ ] **Step 2: Acabamento visual**

Invocar a skill `polish` com o mesmo escopo. Restrições que valem mais que qualquer sugestão da skill: a direção aprovada (fundo quase branco, serifa nos títulos, um único verde, minimalista); nenhuma cor nova fora dos tokens; nenhuma animação além das transições já existentes.

- [ ] **Step 3: Conferir os critérios de sucesso da especificação**

| Critério | Como medir | Esperado |
|---|---|---|
| Todo o conteúdo migrado | `migracao/disciplinas.md` | Em cada linha, "Migrados" + "Sem aula" igual a "Links no Wix", e todo link sem aula resolvido |
| Aula em até dois toques | A partir de `#inicio`: clicar numa disciplina, clicar numa aula | Chega na tela da aula |
| Edição sem ajuda | Passos do Step 6 da Task 11 | Funcionam |
| Peso | `npm run build` | `dist/artifact.html` até 300 KB |
| Requisições | `performance.getEntriesByType('resource').length` em `#inicio` | Até 15 |
| Sem rolagem lateral | `document.documentElement.scrollWidth > innerWidth` a 375 px | `false` em todas as rotas |

- [ ] **Step 4: Testar, montar e republicar**

Run: `npm test && npm run build`
Expected: 0 falhas.

Republicar com `Artifact` e o mesmo `file_path`, sem `icon` e sem `capabilities`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish: audit fixes and final pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Entregar ao Pedro**

Mensagem final com:
- O endereço do Artifact (de `migracao/artifact.txt`), dizendo que está privado até ele compartilhar.
- Como ver a versão local com o player embutido: `node servidor.mjs` dentro de `site-prof-antonio`, depois `http://localhost:4173`.
- Os números da migração (de `migracao/disciplinas.md`) e quantos links do site original já estavam quebrados (de `migracao/links.md`).
- O que ele precisa conferir (de `migracao/conferir.md`).
- Pendências: foto real do professor; conta dele no Claude para editar sozinho; os arquivos seguem hospedados no Wix e somem se a conta for cancelada.
- O que ficou para a fase 2: domínio, cópia dos arquivos, login fora do Claude, player embutido para os alunos.

