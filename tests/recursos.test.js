import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indiceDeBusca, buscar, normalizar } from '../src/nucleo/busca.js';
import { lerProgresso, alternarVista, registrarUltima, contarVistas } from '../src/nucleo/progresso.js';
import { ehNovo, novidades, proximosEventos, linkAgenda, dataCurta } from '../src/nucleo/agenda.js';
import { conteudoExemplo } from './fixtura.js';

test('normalizar tira acento e caixa', () => {
  assert.equal(normalizar('Cálculo do VPL'), 'calculo do vpl');
});

test('busca acha aula, disciplina, laboratório e texto, sem diferenciar acento', () => {
  const indice = indiceDeBusca(conteudoExemplo());
  assert.equal(buscar(indice, 'curva')[0].rota, '#a-eg-1-1');
  assert.equal(buscar(indice, 'economia')[0].tipo, 'disciplina');
  assert.equal(buscar(indice, 'capm')[0].contexto, 'Laboratório · Planilhas');
  assert.equal(buscar(indice, 'financas verdes')[0].rota, '#t-financas-verdes');
  assert.equal(buscar(indice, 'definicoes')[0].rota, '#a-eg-2-1');
});

test('busca exige todos os termos e ignora consulta curta', () => {
  const indice = indiceDeBusca(conteudoExemplo());
  assert.deepEqual(buscar(indice, 'curva capm'), []);
  assert.deepEqual(buscar(indice, 'a'), []);
  assert.deepEqual(buscar(indice, '   '), []);
});

test('material de nome padrão leva o nome da aula, e o endereço não entra na busca', () => {
  const indice = indiceDeBusca(conteudoExemplo());
  assert.ok(buscar(indice, 'slides').some((r) => r.titulo === 'Slides: Curva de Demanda'));
  assert.deepEqual(buscar(indice, 'exemplo.com'), []);
});

test('progresso: leitura tolerante, marcar, desmarcar e contar', () => {
  assert.deepEqual(lerProgresso('lixo'), { vistas: {}, ultima: null });
  assert.deepEqual(lerProgresso(null), { vistas: {}, ultima: null });
  let p = lerProgresso('{"vistas":{"eg-1-1":"2026-10-01"},"ultima":"eg-1-1"}');
  assert.equal(p.ultima, 'eg-1-1');
  p = alternarVista(p, 'eg-1-2', '2026-10-14');
  assert.deepEqual(contarVistas(conteudoExemplo().disciplinas[0], p.vistas), { vistas: 2, total: 3 });
  p = alternarVista(p, 'eg-1-1', '2026-10-14');
  assert.deepEqual(Object.keys(p.vistas), ['eg-1-2']);
  assert.equal(registrarUltima(p, 'eg-2-1').ultima, 'eg-2-1');
});

test('novo vale por 14 dias a partir da data em que foi adicionado', () => {
  assert.equal(ehNovo('2026-10-14', '2026-10-14'), true);
  assert.equal(ehNovo('2026-10-01', '2026-10-14'), true);
  assert.equal(ehNovo('2026-09-30', '2026-10-14'), false);
  assert.equal(ehNovo('2026-10-20', '2026-10-14'), false);
  assert.equal(ehNovo(undefined, '2026-10-14'), false);
});

test('novidades: aula nova entra inteira, material novo entra sozinho, mais recente primeiro', () => {
  const c = conteudoExemplo();
  c.disciplinas[0].modulos[0].aulas[1].adicionadoEm = '2026-10-10';
  c.disciplinas[0].modulos[0].aulas[1].materiais.push({ id: 'x', tipo: 'slides', nome: 'Slides da aula', url: 'https://e.com/x.pdf', adicionadoEm: '2026-10-10' });
  c.disciplinas[0].modulos[0].aulas[0].materiais[0].adicionadoEm = '2026-10-12';
  const n = novidades(c, '2026-10-14');
  assert.deepEqual(n.map((x) => [x.tipo, x.titulo]), [['material', 'Slides da aula'], ['aula', 'Custos da Firma']]);
});

test('cronograma: só datas de hoje em diante, em ordem', () => {
  const eventos = [
    { id: 'a', data: '2026-11-20', tipo: 'prova', titulo: 'P2' },
    { id: 'b', data: '2026-10-01', tipo: 'prova', titulo: 'P1' },
    { id: 'c', data: '2026-10-14', tipo: 'entrega', titulo: 'Trabalho' },
    { id: 'd', data: '', tipo: 'aula', titulo: 'Sem data' },
  ];
  assert.deepEqual(proximosEventos(eventos, '2026-10-14').map((e) => e.id), ['c', 'a']);
});

test('link do Google Agenda vem preenchido como dia inteiro', () => {
  const url = new URL(linkAgenda({ data: '2026-11-20', tipo: 'prova', titulo: 'P2' }, 'Economia Gerencial'));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('dates'), '20261120/20261121');
  assert.equal(url.searchParams.get('text'), 'Prova: P2 (Economia Gerencial)');
});

test('data curta com dia da semana', () => {
  assert.equal(dataCurta('2026-11-20'), 'sex, 20/11');
  assert.equal(dataCurta(''), '');
});
