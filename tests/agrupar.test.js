import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, tipoDoLink, nomeDoLink } from '../scripts/agrupar.mjs';

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
  assert.equal(tipoDoLink({ href: 'https://x/b.pdf', icone: DOCUMENTO }), 'notas');
  assert.equal(tipoDoLink({ href: 'https://x/b.pdf', icone: 'outro' }), 'material');
  assert.equal(tipoDoLink({ href: 'https://x/c.xlsx?dn=a.xlsx', icone: DOCUMENTO }), 'planilha');
  assert.equal(tipoDoLink({ href: 'https://x/archives/p.zip?dn=Pac.zip', icone: DOCUMENTO }), 'codigo');
  assert.equal(nomeDoLink({ href: 'https://x/n.ipynb?dn=Ind.ipynb' }, 'codigo'), 'Notebook em Python');
  assert.equal(nomeDoLink({ href: 'https://x/a.pdf' }, 'slides'), 'Slides da aula');
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
  assert.deepEqual(a1.materiais.map((m) => m.tipo), ['slides', 'video', 'notas']);
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
