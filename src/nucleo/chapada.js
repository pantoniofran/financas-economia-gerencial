// Arte da abertura: os morros da Chapada Diamantina, a paixão do professor, desenhados traço a traço.
// O desenho de cada morro sai de uma foto de referência (scripts/desenhar-morros.py gera chapada-dados.js).
import { CENAS } from './chapada-dados.js';

export { CENAS };
export const LARGURA = 1000;
export const ALTURA = 760;

// Os traços de uma cena. O programa da página lê o atraso e a duração de cada um para desenhá-lo.
export const tracosDaCena = (cena) => cena.tracos
  .map((t) => `<path class="t-${t.tipo}" d="${t.d}" data-atraso="${t.atraso}" data-duracao="${t.duracao}"/>`)
  .join('');

// Já vem desenhado: é o que fica parado para quem pediu menos movimento e enquanto o programa não carrega.
export function desenhoDaChapada(cena = CENAS[0]) {
  return `<svg class="chapada" viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><g class="chapada-cena">${tracosDaCena(cena)}</g></svg><span class="chapada-nome" aria-hidden="true">${cena.nome}</span>`;
}
