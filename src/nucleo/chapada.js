// Arte da abertura: as curvas de finanças viram, uma de cada vez, os morros da Chapada Diamantina,
// a paixão do professor: o Pai Inácio, o Camelo e os Três Irmãos.
// Cada linha é uma função y(x) amostrada nos mesmos pontos, para uma forma poder virar a outra.

export const LARGURA = 1000;
export const ALTURA = 520;
const PONTOS = 321;
const CHAO = 452;

const xs = Array.from({ length: PONTOS }, (_, i) => (i * LARGURA) / (PONTOS - 1));
const suave = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const sino = (x, centro, largura) => Math.exp(-(((x - centro) / largura) ** 2));
// Morro de topo chato: sobe em `rampa` a partir de `a`, desce em `rampa` até `b`.
const mesa = (x, a, b, rampa) => suave((x - a) / rampa) * (1 - suave((x - (b - rampa)) / rampa));
// Irregularidade da rocha e da mata: soma de ondas de frequências diferentes, sempre igual para a mesma semente.
const ruido = (x, semente) => Math.sin(x * 0.013 + semente) + 0.6 * Math.sin(x * 0.031 + semente * 2.3)
  + 0.35 * Math.sin(x * 0.077 + semente * 3.1) + 0.2 * Math.sin(x * 0.19 + semente * 5.7);
// Número "aleatório" fixo, para as camadas de rocha caírem sempre no mesmo lugar.
const sorteio = (n) => Math.abs(Math.sin(n * 127.1) * 43758.5453) % 1;

// Camadas do arenito no paredão: traços horizontais interrompidos, como se vê nos morros de perto.
function camadas(x0, x1, alturas, semente) {
  const tracos = [];
  alturas.forEach((h, i) => {
    let x = x0 + sorteio(semente + i) * 20;
    while (x < x1 - 20) {
      const comprimento = Math.min(25 + sorteio(semente + i * 7 + x) * 70, x1 - x);
      const y = CHAO - h + 2 * ruido(x, semente + i);
      tracos.push(`M${x.toFixed(0)} ${y.toFixed(1)}h${comprimento.toFixed(0)}`);
      x += comprimento + 12 + sorteio(semente + x) * 30;
    }
  });
  return tracos.join('');
}

// Fendas verticais no paredão: [x, altura do topo, altura da base].
const fendas = (lista) => lista.map(([x, topo, base]) => `M${x} ${CHAO - topo}V${CHAO - base}`).join('');

// Serra ao fundo e chão do vale: mudam um pouco de cena para cena.
const serraDoFundo = (semente, desloca) => xs.map((x) => CHAO - 105 - 22 * Math.sin(x / 115 + semente) - 14 * ruido(x, semente) - 35 * sino(x, desloca, 300));
const chaoDoVale = (semente) => xs.map((x) => CHAO + 24 + 3 * ruido(x, semente) + 2 * Math.sin(x / 9 + semente));

// ---------- Morro do Pai Inácio ----------
// Paredão de arenito de topo quase plano, com a cruz na beira, sobre uma encosta larga coberta de mata.
function paiInacio(x) {
  const encosta = 168 * mesa(x, 170, 880, 190) + 7 * ruido(x, 1) * mesa(x, 170, 880, 60);
  const topo = 288 - 0.03 * (x - 360) + 2.5 * ruido(x, 4);
  const paredao = topo * mesa(x, 352, 690, 9);
  const ombro = (208 + 2 * ruido(x, 6)) * mesa(x, 676, 742, 12);
  return Math.max(encosta, paredao, ombro, 6 + 3 * ruido(x, 2));
}
const CRUZ_X = 384;
const CRUZ_Y = CHAO - paiInacio(CRUZ_X);

// ---------- Morro do Camelo ----------
// Comprido, deitado: a cabeça baixa à esquerda, o pescoço, o corpo e a corcova mais alta à direita.
function camelo(x) {
  const base = 92 * mesa(x, 140, 900, 150) + 5 * ruido(x, 8) * mesa(x, 140, 900, 50);
  const cabeca = (124 + 3 * ruido(x, 9)) * mesa(x, 226, 350, 20) + 10 * sino(x, 262, 22);
  // O pescoço sobe em rampa da cabeça até o corpo.
  const corpo = (166 + 2.5 * ruido(x, 11)) * suave((x - 290) / 46) * (1 - suave((x - 772) / 14)) * (0.72 + 0.28 * suave((x - 330) / 70));
  const corcova = 62 * sino(x, 610, 85) * mesa(x, 360, 786, 40);
  return Math.max(base, cabeca, corpo + corcova, 6 + 3 * ruido(x, 12));
}

// ---------- Três Irmãos ----------
// Três morros parecidos, de topo arredondado e paredão no alto, nascendo da mesma base.
function tresIrmaos(x) {
  const base = 96 * mesa(x, 150, 880, 160) + 6 * ruido(x, 14) * mesa(x, 150, 880, 50);
  const irmao = (centro, altura, raio, semente) => {
    const t = Math.abs((x - centro) / raio);
    return (altura + 3 * ruido(x, semente)) * Math.max(0, 1 - t ** 3.2) ** 0.45;
  };
  return Math.max(base, irmao(318, 196, 92, 15), irmao(505, 222, 96, 16), irmao(690, 190, 90, 17), 6 + 3 * ruido(x, 18));
}

const perfil = (f) => xs.map((x) => CHAO - f(x));

// As cenas, na ordem em que aparecem.
export const CENAS = [
  {
    nome: 'Morro do Pai Inácio',
    morro: perfil(paiInacio),
    serra: serraDoFundo(1, 820),
    vale: chaoDoVale(1),
    detalhes: camadas(362, 682, [262, 238, 214, 190], 3)
      + fendas([[468, 276, 236], [588, 266, 222]])
      // A cruz no topo.
      + `M${CRUZ_X} ${(CRUZ_Y - 26).toFixed(1)}V${CRUZ_Y.toFixed(1)}M${CRUZ_X - 8} ${(CRUZ_Y - 19).toFixed(1)}h16`,
    rotulo: 520,
  },
  {
    nome: 'Morro do Camelo',
    morro: perfil(camelo),
    serra: serraDoFundo(3.4, 260),
    vale: chaoDoVale(3),
    detalhes: camadas(392, 760, [150, 128, 108], 21) + fendas([[700, 168, 132]]),
    rotulo: 520,
  },
  {
    nome: 'Três Irmãos',
    morro: perfil(tresIrmaos),
    serra: serraDoFundo(5.1, 540),
    vale: chaoDoVale(5),
    detalhes: camadas(268, 368, [176, 156], 41) + camadas(450, 560, [202, 180], 43) + camadas(642, 738, [170, 150], 47),
    rotulo: 505,
  },
];

// As curvas da abertura antiga: demanda (cai), oferta (sobe) e uma série de preços.
export const demanda = xs.map((x) => 110 + 320 * (x / LARGURA) ** 0.7);
export const oferta = xs.map((x) => 440 - 330 * (x / LARGURA) ** 1.35);
export const precos = xs.map((x) => 300 + 38 * Math.sin(x / 70) + 18 * Math.sin(x / 23) - 0.08 * x);

export const caminho = (ys) => `M${ys.map((y, i) => `${Math.round(xs[i])} ${y.toFixed(1)}`).join('L')}`;
// A linha do morro vira uma área fechada até o chão, pintada com a cor da faixa: assim esconde a serra de trás.
export const caminhoFechado = (ys) => `${caminho(ys)}L${LARGURA} ${ALTURA}L0 ${ALTURA}Z`;

export function interpolar(de, para, t) {
  return de.map((y, i) => y + (para[i] - y) * t);
}

// SVG com o primeiro morro: é o que fica parado para quem pediu menos movimento e enquanto o programa não carrega.
export function desenhoDaChapada(cena = CENAS[0]) {
  return `<svg class="chapada" viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
<path class="chapada-serra" d="${caminho(cena.serra)}"/>
<path class="chapada-morros" d="${caminhoFechado(cena.morro)}"/>
<path class="chapada-detalhes" d="${cena.detalhes}"/>
<path class="chapada-vale" d="${caminho(cena.vale)}"/>
<text class="chapada-nome" x="${cena.rotulo}" y="${CHAO + 56}" text-anchor="middle">${cena.nome}</text>
</svg>`;
}
