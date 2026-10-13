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

test('as fontes vêm depois do programa, para não segurar a primeira tela', () => {
  const html = corpoDaPagina(partes());
  assert.ok(html.indexOf('<link rel="stylesheet"') > html.indexOf('id="programa"'));
  assert.ok(html.endsWith('display=swap">'));
});

test('corpoDaPagina fecha exatamente três tags script', () => {
  assert.equal(corpoDaPagina(partes()).split('</script>').length - 1, 3);
});

test('documentoCompleto tem o esqueleto que a ferramenta Artifact reconhece', () => {
  const html = documentoCompleto(partes());
  const inicio = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>';
  assert.ok(html.startsWith(inicio));
  assert.ok(html.includes(`${RESET_PADRAO}</style></head><body>\n<title>`));
  assert.ok(html.endsWith('\n</body></html>'));
});

test('documentoCompleto usa o reset informado', () => {
  assert.ok(documentoCompleto(partes(), 'x{y:z}').includes('<style>x{y:z}</style></head>'));
});
