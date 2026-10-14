import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderizar, interpretarRota } from '../src/nucleo/telas.js';
import { indiceDeBusca, buscar } from '../src/nucleo/busca.js';
import { conteudoExemplo } from './fixtura.js';

const leitura = {
  editando: false, podeEditar: false, alteracoes: 0, publicando: false, confirmando: null,
  formulario: null, mensagem: '', hoje: '2026-10-14', ambiente: 'local', midia: {},
  progresso: { vistas: {}, ultima: null }, siteUrl: 'https://site.exemplo/', zips: {},
};
const ver = (hash, ctx = leitura, c = conteudoExemplo()) => renderizar(c, interpretarRota(hash), ctx);

function comTextos() {
  const c = conteudoExemplo();
  const a = c.disciplinas[0].modulos[0].aulas[0];
  a.descricao = 'A relação entre preço e quantidade. Com um exemplo do sorvete.';
  a.dica = 'Some as demandas individuais.';
  c.disciplinas[0].modulos[0].descricao = 'As bases de microeconomia.';
  return c;
}

test('modo de estudo: vídeo e leitor de PDF lado a lado, com descrição e dica', () => {
  const html = ver('#a-eg-1-1', leitura, comTextos());
  assert.match(html, /class="estudo"/);
  assert.match(html, /class="leitor" data-pdf="https:\/\/exemplo.com\/a.pdf"/);
  assert.match(html, /data-op="tocar"/);
  assert.match(html, /Nesta aula/);
  assert.match(html, /class="dica"/);
  assert.match(html, /data-op="vista" data-aula="eg-1-1" aria-pressed="false"/);
});

test('no Claude a aula fica com links, sem leitor embutido', () => {
  const html = ver('#a-eg-1-1', { ...leitura, ambiente: 'artifact' }, comTextos());
  assert.doesNotMatch(html, /class="leitor"/);
  assert.match(html, /Dica de estudo/);
});

test('lista de aulas mostra só a primeira frase e o módulo mostra o que o aluno vai ver', () => {
  const html = ver('#d-eg', leitura, comTextos());
  assert.match(html, /<p class="aula-resumo">A relação entre preço e quantidade\.<\/p>/);
  assert.match(html, /modulo-descricao[^>]*><p>As bases de microeconomia\.<\/p>/);
});

test('progresso: aula vista marcada e contagem na disciplina', () => {
  const ctx = { ...leitura, progresso: { vistas: { 'eg-1-1': '2026-10-14' }, ultima: 'eg-1-1' } };
  assert.match(ver('#d-eg', ctx), /✓ vista/);
  assert.match(ver('#d-eg', ctx), /Você viu 1 de 3 aulas/);
  assert.match(ver('#inicio', ctx), /Continuar de onde parei/);
});

test('zip do módulo aparece quando existe', () => {
  const ctx = { ...leitura, zips: { 'eg-1': { url: 'https://site.exemplo/arquivos/zip/eg-modulo-1.zip', tamanho: '1,2 MB' } } };
  assert.match(ver('#d-eg', ctx), /eg-modulo-1\.zip">.*Baixar os materiais do módulo <small>ZIP · 1,2 MB/);
});

test('QR codes: um para o site e um por disciplina', () => {
  const html = ver('#qr');
  assert.equal((html.match(/data-qr=/g) || []).length, 3);
  assert.match(html, /data-qr="https:\/\/site.exemplo\/#d-eg"/);
});

test('a busca encontra a aula pela descrição', () => {
  assert.equal(buscar(indiceDeBusca(comTextos()), 'sorvete')[0].rota, '#a-eg-1-1');
});
