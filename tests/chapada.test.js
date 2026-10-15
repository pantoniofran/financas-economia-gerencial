import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CENAS, demanda, oferta, precos, interpolar, ALTURA } from '../src/nucleo/chapada.js';

test('as três cenas e as curvas têm os mesmos pontos, para uma forma virar a outra', () => {
  assert.deepEqual(CENAS.map((c) => c.nome), ['Morro do Pai Inácio', 'Morro do Camelo', 'Três Irmãos']);
  for (const c of CENAS) {
    for (const linha of [c.morro, c.serra, c.vale]) {
      assert.equal(linha.length, demanda.length);
      assert.ok(linha.every((y) => Number.isFinite(y) && y > 0 && y < ALTURA));
    }
  }
  assert.equal(oferta.length, precos.length);
});

test('o Pai Inácio é o mais alto e tem o topo quase plano', () => {
  const pico = (ys) => Math.min(...ys);
  const [pai, camelo, irmaos] = CENAS.map((c) => pico(c.morro));
  assert.ok(pai < camelo && pai < irmaos);
  const topo = CENAS[0].morro.filter((y) => y < pico(CENAS[0].morro) + 15);
  assert.ok(topo.length > 60, 'o topo plano ocupa boa parte da largura');
});

test('interpolar vai das curvas ao morro', () => {
  const [a, b] = [[0, 10], [10, 30]];
  assert.deepEqual(interpolar(a, b, 0), a);
  assert.deepEqual(interpolar(a, b, 1), b);
  assert.deepEqual(interpolar(a, b, 0.5), [5, 20]);
});
