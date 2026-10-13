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
  assert.match(html, /<a class="chip" href="https:\/\/exemplo\.com\/a\.pdf" target="_blank" rel="noopener"[^>]*><svg class="ic"[\s\S]*?<\/svg>Slides</);
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
});

test('navegação em caixas: disciplinas, materiais e aulas vizinhas', () => {
  const inicio = ver('#inicio');
  assert.match(inicio, /<a class="caixa" href="#d-eg">[\s\S]*?Economia Gerencial[\s\S]*?2 módulos · 3 aulas[\s\S]*?1 aviso/);
  assert.match(inicio, /<a class="caixa caixa-aviso" href="#d-eg">[\s\S]*?Prova na quinta/);
  assert.match(inicio, /<a class="caixa" href="#laboratorio">[\s\S]*?1 material/);

  const aula = ver('#a-eg-1-1');
  // "Slides da aula" já diz o tipo, então a linha de apoio traz só o formato.
  assert.match(aula, /<a class="caixa caixa-material" href="https:\/\/exemplo\.com\/a\.pdf" target="_blank" rel="noopener"><svg class="ic"[\s\S]*?<\/svg><span class="caixa-info">PDF<\/span><span class="caixa-titulo">Slides da aula</);
  const c = conteudoExemplo();
  c.disciplinas[0].modulos[0].aulas[0].materiais[0].nome = 'Caso do sorvete';
  assert.ok(ver('#a-eg-1-1', leitura, c).includes('<span class="caixa-info">Slides · PDF</span><span class="caixa-titulo">Caso do sorvete'));
  assert.ok(ver('#d-aep').includes('ainda não foram publicadas'));
  assert.match(aula, /<a class="caixa" href="#a-eg-1-2"><span class="caixa-info">Próxima aula ›<\/span><span class="caixa-titulo">Custos da Firma</);
  assert.ok(!aula.includes('Aula anterior'));

  assert.match(ver('#textos'), /<a class="caixa" href="#t-financas-verdes">[\s\S]*?27\/09\/2020[\s\S]*?Como financiar projetos\./);
  assert.match(ver('#d-eg'), /aria-current="page">Disciplinas</);
});

test('índice de módulos aparece a partir de três módulos e só em leitura', () => {
  const c = conteudoExemplo();
  assert.ok(!ver('#d-eg', leitura, c).includes('data-ir='));
  c.disciplinas[0].modulos.push({ id: 'eg-3', titulo: 'Escala e escopo', aulas: [] });
  const html = ver('#d-eg', leitura, c);
  assert.match(html, /<button type="button" class="caixa" data-ir="m-eg-3"><span class="caixa-info">Módulo 3 · 0 aulas</);
  assert.ok(html.includes('<section class="modulo" id="m-eg-3"'));
  assert.ok(!ver('#d-eg', edicao, c).includes('data-ir='));
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

test('pesquisa agrupa publicações por categoria, da mais nova para a mais antiga', () => {
  const c = conteudoExemplo();
  c.pesquisa.publicacoes.reverse();
  c.pesquisa.publicacoes.push({ id: 'pb-3', ano: '2011', tipo: 'capitulo', referencia: 'SILVA JUNIOR, A. F. A. Performance Attribution.' });
  const html = ver('#pesquisa', leitura, c);
  assert.ok(html.indexOf('SANTOS, J. P.') < html.indexOf('CALDAS, A. V. S.'));
  assert.ok(html.indexOf('Artigos em periódicos') < html.indexOf('Capítulos de livros'));
  assert.ok(!html.includes('Trabalhos em anais de eventos'));
  assert.ok(html.includes('Grupo de Pesquisa em Finanças - UFBA'));
});

test('texto: parágrafos separados e data em formato brasileiro', () => {
  const html = ver('#t-financas-verdes');
  assert.ok(html.includes('<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>'));
  assert.ok(html.includes('27/09/2020'));
});

test('endereço no meio de um texto vira link, sem levar a pontuação nem abrir brecha', () => {
  const c = conteudoExemplo();
  c.textos[0].corpo = 'Saiu no jornal: https://www.exemplo.com.br/noticia/escolhas-estrategicas/ , em 2013.\n\nVeja (https://exemplo.com/a?x=1&y=2). E "https://exemplo.com/b" <script>alert(1)</script>';
  const html = ver('#t-financas-verdes', leitura, c);
  assert.ok(html.includes('<a href="https://www.exemplo.com.br/noticia/escolhas-estrategicas/" target="_blank" rel="noopener">https://www.exemplo.com.br/noticia/escolhas-estrategicas/</a> , em 2013.'));
  assert.ok(html.includes('(<a href="https://exemplo.com/a?x=1&amp;y=2" target="_blank" rel="noopener">https://exemplo.com/a?x=1&amp;y=2</a>).'));
  assert.ok(html.includes('&quot;<a href="https://exemplo.com/b" target="_blank" rel="noopener">https://exemplo.com/b</a>&quot;'));
  assert.ok(!html.includes('<script>alert'));
});

test('nome com barra pode quebrar depois da barra', () => {
  const c = conteudoExemplo();
  c.disciplinas[0].nome = 'Finanças Sustentáveis/Verdes';
  assert.ok(ver('#inicio', leitura, c).includes('Finanças Sustentáveis/<wbr>Verdes'));
  assert.ok(ver('#d-eg', leitura, c).includes('<h1>Finanças Sustentáveis/<wbr>Verdes</h1>'));
  assert.ok(!ver('#d-eg', edicao, c).includes('<wbr>'));
});

test('capa e abertura só aparecem quando há mídia', () => {
  // A faixa de abertura existe sempre, com o resumo do site; a arte de fundo só com mídia.
  assert.match(ver('#inicio'), /class="abertura-resumo">2 disciplinas · 3 aulas · 2 materiais</);
  assert.ok(!ver('#inicio').includes('abertura-arte'));
  const midia = { poster: '/_blob/p', hero: '/_blob/h', 'capa-eg': '/_blob/c' };
  assert.match(ver('#inicio', { ...leitura, midia }), /<video[^>]*data-src="\/_blob\/h"/);
  assert.ok(ver('#d-eg', { ...leitura, midia }).includes('<div class="capa"><img src="/_blob/c"'));
});
