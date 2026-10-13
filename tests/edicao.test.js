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
