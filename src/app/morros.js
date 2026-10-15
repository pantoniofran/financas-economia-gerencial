// Movimento da abertura: a cada 14 segundos as curvas de finanças formam um morro da Chapada,
// ficam um tempo, voltam a ser curvas e formam o próximo.
import { CENAS, demanda, oferta, precos, caminho, caminhoFechado, interpolar } from '../nucleo/chapada.js';

const CURVAS = 1500; // curvas paradas
const IDA = 3000; // curvas viram morro
const MORRO = 7000; // morro parado, com o nome
const VOLTA = 2500; // morro volta a ser curva (no total, 14 segundos por morro)

// Começa e termina devagar, para a mudança parecer natural.
const devagar = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

let parar = null;

export function iniciarMorros(svg) {
  parar?.();
  parar = null;
  // Quem pediu menos movimento vê só o primeiro morro, como vem do servidor.
  if (!svg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const [serra, morro, detalhes, vale] = ['serra', 'morros', 'detalhes', 'vale'].map((n) => svg.querySelector(`.chapada-${n}`));
  const nome = svg.querySelector('.chapada-nome');
  let cancelado = false;
  let espera = 0;
  let quadro = 0;
  let n = 0;

  // t = 0: curvas; t = 1: morro. A área do morro, as camadas de rocha e o nome aparecem junto (variável --morro no CSS).
  const desenhar = (cena, t) => {
    serra.setAttribute('d', caminho(interpolar(oferta, cena.serra, t)));
    morro.setAttribute('d', caminhoFechado(interpolar(demanda, cena.morro, t)));
    vale.setAttribute('d', caminho(interpolar(precos, cena.vale, t)));
    svg.style.setProperty('--morro', t.toFixed(3));
  };
  const mover = (cena, de, para, duracao, depois) => {
    const inicio = performance.now();
    const passo = (agora) => {
      if (cancelado) return;
      const k = Math.min(1, (agora - inicio) / duracao);
      desenhar(cena, de + (para - de) * devagar(k));
      if (k < 1) quadro = requestAnimationFrame(passo);
      else depois();
    };
    quadro = requestAnimationFrame(passo);
  };
  const esperar = (ms, depois) => { espera = setTimeout(depois, ms); };
  const proximo = () => {
    const cena = CENAS[n % CENAS.length];
    n += 1;
    detalhes.setAttribute('d', cena.detalhes);
    nome.textContent = cena.nome;
    nome.setAttribute('x', cena.rotulo);
    esperar(CURVAS, () => mover(cena, 0, 1, IDA, () => esperar(MORRO, () => mover(cena, 1, 0, VOLTA, proximo))));
  };

  desenhar(CENAS[0], 0);
  proximo();
  parar = () => {
    cancelado = true;
    clearTimeout(espera);
    cancelAnimationFrame(quadro);
  };
}
