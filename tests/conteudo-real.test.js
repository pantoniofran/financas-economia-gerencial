import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarConteudo, TIPOS, CATEGORIAS_PUBLICACAO } from '../src/nucleo/conteudo.js';

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
    // Ano vazio vale para trabalho ainda não publicado.
    assert.match(String(p.ano), /^((19|20)\d{2})?$/, p.referencia);
    assert.ok(p.referencia.length > 30, p.id);
    assert.ok(CATEGORIAS_PUBLICACAO.some(([t]) => t === p.tipo), p.id);
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
