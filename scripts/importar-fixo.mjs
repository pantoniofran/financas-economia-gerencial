// Roda uma vez: preenche laboratório, textos, publicações, orientações e o resumo em inglês
// em src/conteudo.json, a partir das páginas salvas em migracao/bruto/html e de
// migracao/bruto/orientacoes.txt (ano|nível|papel|aluno|título, extraído do Escavador).
import { readFile, writeFile } from 'node:fs/promises';

const HTML = 'migracao/bruto/html';
const ACENTOS = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' };
const NOMEADAS = {
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', hellip: '…', ordm: 'º', ordf: 'ª', deg: '°', trade: '™', copy: '©', reg: '®',
};

function decodificar(s) {
  return s
    .replace(/&([a-zA-Z])(acute|grave|circ|tilde|uml|cedil);/g, (_, letra, acento) => (letra + ACENTOS[acento]).normalize('NFC'))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/g, (tudo, nome) => NOMEADAS[nome] ?? tudo);
}

const texto = (html) => decodificar(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
  .replace(/[​ \s]+/g, ' ').trim();
const trecho = (html, tag) => {
  const i = html.indexOf(`<${tag}`);
  return html.slice(i, html.indexOf(`</${tag}>`, i));
};
// Nos posts, as citações em destaque vêm em <blockquote> com <div> dentro, sem <p>.
const blocos = (html) => [...html.matchAll(/<(p|h[1-6]|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/g)]
  .map((m) => ({ tag: m[1], t: texto(m[2]) })).filter((b) => b.t);
const ler = (nome) => readFile(`${HTML}/${nome}.html`, 'utf8');
const avisos = [];

// ---------- laboratório ----------
const LAB = [
  ['Notas de Aula', 'Notas de aula', 'material', 'Notas'],
  ['Planilha Índices', 'Planilha de índices financeiros', 'planilha', 'Planilhas'],
  ['Planilha CAPM', 'Planilha do modelo CAPM', 'planilha', 'Planilhas'],
  ['OpReal Proj Solar', 'Planilha: opções reais em projeto solar', 'planilha', 'Planilhas'],
  ['Proj H2 verde', 'Planilha: projeto de hidrogênio verde', 'planilha', 'Planilhas'],
  ['Plan. Max Três Prod', 'Planilha: maximização com três produtos', 'planilha', 'Planilhas'],
  ['Instala R', 'Vídeo: instalação do R', 'video', 'R e código'],
  ['Introd. R', 'Vídeo: introdução ao R', 'video', 'R e código'],
  ['Retornos R', 'Vídeo: cálculo de retornos no R', 'video', 'R e código'],
  ['Dados BCB no R', 'Script em R: dados do Banco Central', 'codigo', 'R e código'],
  ['GitSemináriosFinanças', 'Repositório no GitHub: Seminários em Finanças', 'codigo', 'R e código'],
  ['Vídeo MaxLuc', 'Vídeo: maximização de lucro', 'video', 'Vídeos'],
  ['Vídeo Prog. Linear', 'Vídeo: programação linear', 'video', 'Vídeos'],
  ['Vídeo Critérios Decis.', 'Vídeo: critérios de decisão', 'video', 'Vídeos'],
  ['Vídeo Árvore de Decis.', 'Vídeo: árvore de decisão', 'video', 'Vídeos'],
];
const linksDoLab = [...trecho(await ler('anotacoes'), 'main').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map((m) => ({ rotulo: texto(m[2]), url: decodificar(m[1]) }));
const laboratorio = ['Notas', 'Planilhas', 'R e código', 'Vídeos'].map((grupo) => ({ grupo, itens: [] }));
LAB.forEach(([rotulo, nome, tipo, grupo], k) => {
  const achado = linksDoLab.find((l) => l.rotulo === rotulo);
  if (!achado) throw new Error(`laboratório: não achei "${rotulo}"`);
  laboratorio.find((g) => g.grupo === grupo).itens.push({ id: `lab-${k + 1}`, tipo, nome, url: achado.url });
});
if (linksDoLab.length !== LAB.length) avisos.push(`laboratório: a página tem ${linksDoLab.length} links e a tabela tem ${LAB.length}`);

// ---------- textos ----------
const POSTS = [
  ['financas-verdes', 'post-financas-verdes', '2020-09-27'],
  ['integrar-ou-nao-verticalmente', 'post-integrar', '2020-09-26'],
  ['porto-sul-e-fiol', 'post-porto-sul', '2020-05-31'],
];
const textos = [];
for (const [id, arquivo, data] of POSTS) {
  const artigo = trecho(await ler(arquivo), 'article');
  const bs = blocos(artigo);
  const titulo = bs.find((b) => b.tag === 'h1').t;
  const ps = bs.filter((b) => b.tag !== 'h1' && !/^Atualizado:/.test(b.t)).map((b) => b.t);
  const temResumo = ps[0].length < 120 && /[.!?]$/.test(ps[0]);
  const corpo = (temResumo ? ps.slice(1) : ps).join('\n\n');
  textos.push({ id, titulo, data, resumo: temResumo ? ps[0] : '', corpo });
  console.log(`texto ${id}: ${ps.length} parágrafos, ${corpo.length} caracteres (artigo inteiro: ${texto(artigo).length})`);
}

// ---------- publicações ----------
const CATEGORIAS = [
  [/^Artigos completos/, 'artigo'], [/^Cap[ií]tulos/, 'capitulo'], [/^Trabalhos publicados em anais/, 'anais'],
  [/^Artigos em jornal/, 'jornal'], [/^Apresenta/, 'palestra'], [/^Demais/, 'outro'],
];
const publicacoes = [];
let tipo = null;
for (const b of blocos(trecho(await ler('producao'), 'main'))) {
  const categoria = CATEGORIAS.find(([padrao]) => padrao.test(b.t));
  if (categoria) { tipo = categoria[1]; continue; }
  if (!tipo) continue;
  const anos = b.t.match(/\b(19[89]\d|20[0-2]\d)\b/g);
  // Sem ano na referência (trabalho ainda não publicado): entra com ano vazio e aparece no topo da categoria.
  if (!anos) avisos.push(`publicações: sem ano: "${b.t.slice(0, 80)}"`);
  publicacoes.push({ id: `pb-${publicacoes.length + 1}`, ano: anos ? anos.at(-1) : '', tipo, referencia: b.t });
}

// ---------- orientações ----------
const NIVEL = { D: 'Doutorado', M: 'Mestrado', E: 'Especialização' };
const MINUSCULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const nomeProprio = (n) => (n !== n.toUpperCase() ? n : n.toLowerCase().split(' ')
  .map((p, i) => (i && MINUSCULAS.has(p) ? p : p[0].toUpperCase() + p.slice(1))).join(' '));
const orientacoes = (await readFile('migracao/bruto/orientacoes.txt', 'utf8')).split(/\r?\n/).filter(Boolean).map((linha, k) => {
  const [ano, nivel, , aluno, ...titulo] = linha.split('|');
  return { id: `or-${k + 1}`, ano, nivel: NIVEL[nivel], aluno: nomeProprio(aluno), titulo: titulo.join('|').trim() };
});

// ---------- resumo em inglês ----------
const vitae = blocos(trecho(await ler('english'), 'main')).find((b) => b.t.startsWith('Antonio Francisco')).t;
const site = blocos(trecho(await ler('thesite'), 'main')).map((b) => b.t);
// Na página "The site" os títulos e os textos ficam em duas colunas; esta é a correspondência na ordem do HTML.
const PARES = [[0, 2, 'microeconomics'], [1, 3, 'balance sheet'], [4, 5, 'cash flow'], [6, 7, 'global warming'], [8, 9, 'real options']];
const cursos = PARES.map(([t, p, pista]) => {
  if (!site[p]?.includes(pista)) throw new Error(`The site: o texto ${p} não fala de "${pista}"`);
  return `${site[t]}. ${site[p]}`;
});

// ---------- gravação ----------
const conteudo = JSON.parse(await readFile('src/conteudo.json', 'utf8'));
conteudo.laboratorio = laboratorio;
conteudo.textos = textos;
conteudo.pesquisa.publicacoes = publicacoes;
conteudo.sobre.orientacoes = orientacoes;
conteudo.sobre.english = [vitae, ...cursos].join('\n\n');
const saida = `${JSON.stringify(conteudo, null, 2)}\n`;
const sobras = saida.match(/&[a-zA-Z]+;/g);
if (sobras) avisos.push(`entidades HTML não decodificadas: ${[...new Set(sobras)].join(' ')}`);
await writeFile('src/conteudo.json', saida);

const porTipo = Object.groupBy(publicacoes, (p) => p.tipo);
console.log(`laboratório: ${laboratorio.flatMap((g) => g.itens).length} itens`);
console.log(`publicações: ${publicacoes.length} (${Object.entries(porTipo).map(([t, l]) => `${t} ${l.length}`).join(', ')})`);
console.log(`orientações: ${orientacoes.length}`);
console.log(`inglês: ${conteudo.sobre.english.length} caracteres`);
console.log(avisos.length ? `AVISOS:\n- ${avisos.join('\n- ')}` : 'sem avisos');
