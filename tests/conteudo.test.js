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
