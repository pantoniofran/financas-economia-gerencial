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
