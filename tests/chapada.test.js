import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CENAS, desenhoDaChapada, LARGURA, ALTURA } from '../src/nucleo/chapada.js';

const numeros = (d) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

test('três morros, cada um começando pelo contorno', () => {
  assert.deepEqual(CENAS.map((c) => c.nome), ['Morro do Pai Inácio', 'Morro do Camelo', 'Três Irmãos']);
  for (const c of CENAS) {
    assert.equal(c.tracos[0].tipo, 'contorno');
    assert.equal(c.tracos[0].atraso, 0);
    for (const tipo of ['base', 'camada', 'mata']) assert.ok(c.tracos.some((t) => t.tipo === tipo), `${c.nome} sem ${tipo}`);
  }
  assert.ok(CENAS[0].tracos.some((t) => t.tipo === 'cruz'), 'o Pai Inácio tem a cruz no topo');
});

test('os traços cabem na arte e o desenho termina com folga dentro dos 14 segundos', () => {
  for (const c of CENAS) {
    for (const t of c.tracos) {
      assert.match(t.d, /^M[-\d. MLQl]+$/);
      const v = numeros(t.d);
      assert.ok(v.every((n) => n > -60 && n < Math.max(LARGURA, ALTURA) + 60), `${c.nome}: ponto fora da arte`);
    }
    const fim = Math.max(...c.tracos.map((t) => t.atraso + t.duracao));
    assert.ok(fim <= 7500, `${c.nome} demora ${fim} ms para desenhar`);
  }
});

test('o desenho parado traz o primeiro morro e o nome dele', () => {
  const html = desenhoDaChapada();
  assert.match(html, /^<svg class="chapada" viewBox="0 0 1000 760"/);
  assert.ok(html.includes('class="t-contorno"'));
  assert.ok(html.includes('<span class="chapada-nome" aria-hidden="true">Morro do Pai Inácio</span>'));
});
