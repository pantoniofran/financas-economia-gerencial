// Movimento da abertura: cada morro é desenhado na tela, traço a traço, como quem desenha à mão:
// o contorno da esquerda para a direita, a base do paredão, as quinas, as camadas da rocha e a mata.
// Depois de um tempo os traços voltam pelo mesmo caminho e o próximo morro começa. Um morro a cada 14 segundos.
import { CENAS, tracosDaCena } from '../nucleo/chapada.js';

const INTERVALO = 14000;
const APAGAR = 1700;
const TRACO = 'cubic-bezier(.45, .05, .35, 1)';

let parar = null;

export function iniciarMorros(arte) {
  parar?.();
  parar = null;
  const svg = arte?.querySelector('svg.chapada');
  // Navegador que não sabe animar fica com o primeiro morro já desenhado, que vem pronto do servidor.
  // A opção do sistema de reduzir animações não para o desenho: ele é lento e não desloca nada na tela,
  // e muitos computadores vêm com essa opção ligada sem que a pessoa saiba, o que deixava o morro sempre parado.
  if (!svg || typeof svg.animate !== 'function') return;
  const grupo = svg.querySelector('.chapada-cena');
  const nome = arte.querySelector('.chapada-nome');
  const animacoes = new Set();
  const esperas = new Set();
  let n = 0;

  const animar = (el, quadros, opcoes) => {
    const a = el.animate(quadros, { fill: 'both', ...opcoes });
    animacoes.add(a);
    a.finished.then(() => animacoes.delete(a), () => {});
  };
  const depois = (ms, fazer) => {
    const id = setTimeout(() => { esperas.delete(id); fazer(); }, ms);
    esperas.add(id);
  };
  // O traço aparece do começo para o fim: o tracejado do tamanho do traço desliza até cobri-lo.
  const desenhar = (cena) => {
    grupo.innerHTML = tracosDaCena(cena);
    nome.textContent = cena.nome;
    let fim = 0;
    for (const p of grupo.children) {
      const total = p.getTotalLength();
      const atraso = Number(p.dataset.atraso);
      const duracao = Number(p.dataset.duracao);
      p.style.strokeDasharray = `${total} ${total}`;
      animar(p, [{ strokeDashoffset: total }, { strokeDashoffset: 0 }], { duration: duracao, delay: atraso, easing: TRACO });
      fim = Math.max(fim, atraso + duracao);
    }
    // O nome se escreve da esquerda para a direita, quando o desenho termina.
    animar(nome, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 800, delay: fim - 300, easing: 'ease-out' });
  };
  // Os traços voltam pelo mesmo caminho, do fim para o começo.
  const apagar = () => {
    for (const p of grupo.children) {
      const total = p.getTotalLength();
      animar(p, [{ strokeDashoffset: 0 }, { strokeDashoffset: total }], { duration: APAGAR, easing: 'ease-in' });
    }
    animar(nome, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], { duration: 600, easing: 'ease-in' });
  };
  const ciclo = () => {
    for (const a of animacoes) a.cancel();
    animacoes.clear();
    desenhar(CENAS[n % CENAS.length]);
    n += 1;
    depois(INTERVALO - APAGAR - 300, apagar);
    depois(INTERVALO, ciclo);
  };

  ciclo();
  parar = () => {
    for (const id of esperas) clearTimeout(id);
    for (const a of animacoes) a.cancel();
  };
}
