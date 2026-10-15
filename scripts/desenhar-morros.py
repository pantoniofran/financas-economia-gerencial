"""Desenho dos morros da abertura, tirado de fotos de referência da Chapada Diamantina.

As fotos ficam em midia/bruto/morros/ (fora do git e do site). Para cada morro:
1. a linha do céu sai da foto: o morro é o que não é céu e encosta na borda de baixo;
2. a base dos paredões e as quinas foram traçadas à mão sobre a foto (pontos abaixo, em pixels da foto);
3. as camadas do arenito são as bordas horizontais fortes dentro do paredão;
4. tudo vai para a escala da arte do site (1000 x 760), com traços de mata na encosta.

Gera src/nucleo/chapada-dados.js, com o desenho e o tempo de cada traço.
Uso: python scripts/desenhar-morros.py [previa.png]
Precisa de numpy, scipy e Pillow.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RAIZ = Path(__file__).resolve().parent.parent
FOTOS = RAIZ / 'midia' / 'bruto' / 'morros'
SAIDA = RAIZ / 'src' / 'nucleo' / 'chapada-dados.js'
LARG, ALT = 1000, 760


# ---------- céu ----------

def ceu_pai(r, g, b, mx, mn, brilho):
    # céu azul forte ou nuvem branca; a rocha na sombra é azulada, mas escura
    return ((b > 150) & (b > r + 40)) | ((mn > 185) & (mx - mn < 45))


def ceu_camelo(r, g, b, mx, mn, brilho):
    # céu de chuva: nuvens cinza-azuladas, até escuras
    return ((b >= r + 4) & (b >= g)) | ((mn > 170) & (mx - mn < 40))


def ceu_irmaos(r, g, b, mx, mn, brilho):
    # o morro do fundo é azulado de longe: o céu precisa ser claro
    return ((b > r + 12) & (brilho > 125)) | ((brilho > 140) & (mx - mn < 30))


def linha_do_ceu(a, regra, mediana):
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    mx, mn = a.max(-1).astype(int), a.min(-1).astype(int)
    ceu = regra(r, g, b, mx, mn, (r + g + b) / 3)
    # o morro é o que não é céu e encosta na borda de baixo: borda de nuvem solta no céu fica de fora
    morro = ndimage.binary_opening(~ceu, iterations=2)
    rotulos, _ = ndimage.label(morro)
    morro = np.isin(rotulos, list(set(rotulos[-1][rotulos[-1] > 0])))
    h, w = morro.shape
    ys = np.full(w, h - 1, float)
    for x in range(w):
        sim = np.where(morro[:, x])[0]
        if len(sim):
            ys[x] = sim[0]
    return ndimage.median_filter(ys, size=mediana)


# ---------- camadas do arenito ----------

def camadas(a, ceu, limite, faixa_x, sigma, limiar, min_largura, folga_topo, folga_base):
    L = ndimage.gaussian_filter(a.astype(float).mean(-1), sigma)
    mag = np.abs(ndimage.sobel(L, axis=0))
    pico = (mag >= ndimage.maximum_filter1d(mag, 7, axis=0)) & (mag > limiar)
    h, w = L.shape
    px, py = zip(*limite)
    base = np.interp(np.arange(w), px, py, left=np.nan, right=np.nan) - folga_base
    yy = np.arange(h)[:, None]
    dentro = (yy > (ceu + folga_topo)[None, :]) & (yy < base[None, :])
    faixa = np.zeros(w, bool)
    faixa[faixa_x[0]:faixa_x[1]] = True
    pico &= dentro & faixa[None, :]
    rotulos, _ = ndimage.label(ndimage.binary_dilation(pico, structure=np.ones((1, 7))), structure=np.ones((3, 3)))
    linhas = []
    for i, fatia in enumerate(ndimage.find_objects(rotulos), 1):
        if fatia is None:
            continue
        ys_, xs_ = np.where((rotulos[fatia] == i) & pico[fatia])
        if len(xs_) < 5:
            continue
        xs_, ys_ = xs_ + fatia[1].start, ys_ + fatia[0].start
        largura, altura = xs_.max() - xs_.min(), ys_.max() - ys_.min()
        if largura < min_largura or altura > largura * 0.35:
            continue
        passo = max(4, largura // 12)
        pts = []
        for x in range(xs_.min(), xs_.max() + 1, passo):
            sel = (xs_ >= x) & (xs_ < x + passo)
            if sel.any():
                pts.append((float(x + passo / 2), float(np.median(ys_[sel]))))
        if len(pts) >= 2:
            linhas.append(pts)
    return linhas


def sem_repetidas(linhas, distancia):
    def junto(a, b):
        ax, bx = [p[0] for p in a], [p[0] for p in b]
        if min(max(ax), max(bx)) - max(min(ax), min(bx)) <= 0:
            return False
        return abs(np.mean([p[1] for p in a]) - np.mean([p[1] for p in b])) < distancia
    escolhidas = []
    for l in sorted(linhas, key=lambda l: -(l[-1][0] - l[0][0])):
        if not any(junto(l, m) for m in escolhidas):
            escolhidas.append(l)
    return escolhidas


# ---------- desenho na escala do site ----------

def simplificar(pts, tol):
    """Douglas-Peucker: tira os pontos que quase não mudam a linha."""
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts.tolist()
    a, b = pts[0], pts[-1]
    ab = b - a
    dist = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / (math.hypot(*ab) or 1e-9)
    i = int(np.argmax(dist))
    if dist[i] > tol:
        return simplificar(pts[: i + 1], tol)[:-1] + simplificar(pts[i:], tol)
    return [a.tolist(), b.tolist()]


def suavizar(pts, janela=3):
    pts = np.asarray(pts, float)
    if len(pts) < janela:
        return pts.tolist()
    y = np.convolve(pts[:, 1], np.ones(janela) / janela, mode='same')
    y[0], y[-1] = pts[0, 1], pts[-1, 1]
    return np.column_stack([pts[:, 0], y]).tolist()


def comprimento(pts):
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def sorteio(n):
    """Número "aleatório" fixo: o desenho sai igual toda vez que o script roda."""
    return (math.sin(n * 127.1) * 43758.5453) % 1


def caminho(pts):
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)


def mata(piso, semente):
    """Moitas e capim na encosta, em manchas, mais densos longe do paredão."""
    tracos = []
    k = semente * 1000
    for linha_y in range(0, ALT, 22):
        for col in range(0, LARG, 26):
            k += 1
            x = col + sorteio(k) * 24
            y = linha_y + sorteio(k + 999) * 18
            topo = piso[int(min(max(x, 0), LARG))]
            if y < topo + 20 or y > ALT - 10:
                continue
            mancha = 0.5 + 0.5 * math.sin(x / 61 + semente) * math.sin(y / 43 + 0.7 * semente) + 0.25 * math.sin(x / 23 + y / 29)
            chance = (0.12 + 0.5 * min(1, (y - topo) / 240)) * max(0, mancha)
            if sorteio(k + 77) > chance:
                continue
            forma = sorteio(k + 13)
            w = 5 + sorteio(k + 5) * 7
            h = 2.5 + sorteio(k + 9) * 3
            if forma < 0.55:  # moita: um arco
                tracos.append(f'M{x - w / 2:.1f} {y:.1f}Q{x:.1f} {y - h * 1.6:.1f} {x + w / 2:.1f} {y:.1f}')
            elif forma < 0.8:  # moita dupla
                tracos.append(f'M{x - w:.1f} {y:.1f}Q{x - w / 2:.1f} {y - h * 1.4:.1f} {x:.1f} {y:.1f}Q{x + w / 2:.1f} {y - h * 1.9:.1f} {x + w:.1f} {y:.1f}')
            else:  # capim: três riscos
                tracos.append(''.join(f'M{x + dx:.1f} {y:.1f}l{dx * 0.6:.1f} {-h * (1.4 - abs(dx) / 6):.1f}' for dx in (-2.5, 0, 2.5)))
    return tracos


def cena(m):
    foto = Image.open(FOTOS / m['arquivo']).convert('RGB')
    if m.get('recorte'):
        foto = foto.crop(m['recorte'])
    a = np.asarray(foto)
    ceu = linha_do_ceu(a, m['ceu'], m['mediana'])
    for x0, x1, pontos in m.get('ajustes_ceu', []):
        ceu[x0:x1] = np.interp(np.arange(x0, x1), *zip(*pontos))
    margem = m.get('margem', 0)
    contorno_foto = [(x, ceu[x]) for x in range(margem, len(ceu) - margem)]
    brutas = []
    for parametros in m['camadas']:
        brutas += camadas(a, ceu, m['limite'], **parametros)
    brutas = [c for c in sem_repetidas(brutas, m['distancia']) if not any(x0 < np.mean([p[0] for p in c]) < x1 for x0, x1 in m.get('sem_camadas', []))]

    escala, (cx, cy), (ax, ay) = m['escala'], m['de'], m['para']
    t = lambda p: ((p[0] - cx) * escala + ax, (p[1] - cy) * escala + ay)

    def linha(pts, tol):
        q = [t(p) for p in pts]
        q = [p for p in q if -30 <= p[0] <= LARG + 30 and p[1] <= ALT + 30]
        return simplificar(q, tol) if len(q) > 1 else []

    contorno = linha(contorno_foto, 1.0)
    bases = [b for b in (linha(b, 0.6) for b in m['bases']) if b]
    quinas = [q for q in (linha(q, 0.6) for q in m['quinas']) if q]
    cam = sorted((suavizar(c) for c in brutas), key=lambda c: -comprimento(c))[: m['max_camadas']]
    cam = [c for c in (linha(c, 0.9) for c in cam) if len(c) > 1 and comprimento(c) > 14]

    # Piso da encosta: abaixo do contorno e da base dos paredões, onde entra a mata.
    eixo = np.arange(LARG + 1)
    piso = np.interp(eixo, [p[0] for p in contorno], [p[1] for p in contorno])
    for b in bases:
        bx, by = [p[0] for p in b], [p[1] for p in b]
        dentro = (eixo >= min(bx)) & (eixo <= max(bx))
        piso[dentro] = np.maximum(piso[dentro], np.interp(eixo[dentro], bx, by))
    moitas = mata(piso, m['semente'])

    # Ordem e tempo do desenho, em milissegundos: primeiro o contorno, da esquerda para a direita,
    # depois a base dos paredões, as quinas, as camadas da rocha e, por último, a mata.
    DUR_CONTORNO = 3200
    tracos = [{'tipo': 'contorno', 'd': caminho(contorno), 'atraso': 0, 'duracao': DUR_CONTORNO}]
    for i, b in enumerate(bases):
        tracos.append({'tipo': 'base', 'd': caminho(b), 'atraso': 2500 + 250 * i, 'duracao': 1000})
    for i, q in enumerate(quinas):
        tracos.append({'tipo': 'quina', 'd': caminho(q), 'atraso': 3100 + 200 * i, 'duracao': 600})
    # As camadas saem em dois grupos (esquerda e direita), de cima para baixo, como quem hachura a rocha.
    meio = np.median([np.mean([p[0] for p in c]) for c in cam]) if cam else LARG / 2
    for i, lado in enumerate((lambda c: np.mean([p[0] for p in c]) < meio, lambda c: np.mean([p[0] for p in c]) >= meio)):
        grupo = sorted((c for c in cam if lado(c)), key=lambda c: np.mean([p[1] for p in c]))
        if grupo:
            tracos.append({'tipo': 'camada', 'd': ''.join(caminho(c) for c in grupo), 'atraso': 3400 + 300 * i, 'duracao': 1700})
    for extra in m.get('extras', []):
        # a cruz aparece quando o contorno passa por ela
        pts = [t(p) for p in extra['pontos']]
        xs_c = [p[0] for p in contorno]
        ate = next((i for i, x in enumerate(xs_c) if x >= pts[0][0]), len(xs_c) - 1)
        fracao = comprimento(contorno[: ate + 1]) / comprimento(contorno)
        tracos.append({'tipo': extra['tipo'], 'd': caminho(pts), 'atraso': round(DUR_CONTORNO * fracao) + extra.get('depois', 0), 'duracao': 300})
    terco = math.ceil(len(moitas) / 3) or 1
    por_altura = sorted(moitas, key=lambda s: float(s.split('M')[1].split(' ')[1].split('Q')[0].split('l')[0]))
    for i in range(3):
        grupo = por_altura[i * terco:(i + 1) * terco]
        if grupo:
            tracos.append({'tipo': 'mata', 'd': ''.join(grupo), 'atraso': 4300 + 200 * i, 'duracao': 1700})
    return {'nome': m['nome'], 'tracos': tracos}


# ---------- os morros ----------

MORROS = [
    {
        # Visto da BR-242: o paredão grande com a cruz no topo e a torre ao lado.
        'nome': 'Morro do Pai Inácio', 'arquivo': 'pai-inacio.webp', 'ceu': ceu_pai, 'mediana': 9,
        # a agave à beira da estrada entra na linha do céu: ali a encosta segue reta
        'ajustes_ceu': [(0, 160, [(0, 1216), (160, 1152)])],
        'bases': [[(528, 948), (560, 940), (610, 915), (650, 898), (700, 876), (760, 856), (850, 846), (950, 832), (1050, 818), (1150, 803), (1200, 798), (1250, 828), (1330, 858), (1400, 882), (1500, 898), (1580, 913), (1640, 930), (1688, 950)]],
        'quinas': [[(1250, 618), (1240, 650), (1226, 700), (1212, 750), (1203, 798)]],
        'limite': [(528, 948), (560, 940), (610, 915), (650, 898), (700, 876), (760, 856), (850, 846), (950, 832), (1050, 818), (1150, 803), (1200, 798), (1250, 828), (1330, 858), (1400, 882), (1500, 898), (1580, 913), (1640, 930), (1688, 950)],
        'camadas': [
            # a face da esquerda está na sombra: contraste menor
            {'faixa_x': (575, 860), 'sigma': 2.0, 'limiar': 6.5, 'min_largura': 60, 'folga_topo': 20, 'folga_base': 8},
            {'faixa_x': (860, 1660), 'sigma': 2.2, 'limiar': 14, 'min_largura': 70, 'folga_topo': 18, 'folga_base': 8},
        ],
        'distancia': 9, 'max_camadas': 30,
        'extras': [
            {'tipo': 'cruz', 'pontos': [(893, 443), (893, 473)]},
            {'tipo': 'cruz', 'pontos': [(884, 452), (902, 452)], 'depois': 150},
        ],
        'escala': 0.75, 'de': (1105, 478), 'para': (500, 215), 'semente': 1,
    },
    {
        # O bloco largo e a torre mais alta, separados pela selada: as corcovas do camelo.
        'nome': 'Morro do Camelo', 'arquivo': 'camelo.png', 'ceu': ceu_camelo, 'mediana': 3, 'margem': 2,
        # canto direito do bloco grande: a face na sombra foi lida como céu
        'ajustes_ceu': [(177, 200, [(177, 136), (184, 137), (189, 140), (193, 150), (196, 163), (199, 167)])],
        'bases': [[(30, 200), (50, 207), (70, 212), (95, 212), (120, 216), (140, 232), (160, 246), (185, 249), (205, 246), (215, 236)],
                  [(262, 232), (280, 222), (300, 214), (318, 214), (324, 222)]],
        'quinas': [[(140, 134), (141, 160), (143, 190), (142, 215), (141, 232)],
                   [(300, 124), (301, 160), (302, 200), (302, 214)]],
        'limite': [(30, 200), (50, 207), (70, 212), (95, 212), (120, 216), (140, 232), (160, 246), (185, 249), (205, 246), (215, 236), (225, 150), (250, 150), (262, 232), (280, 222), (300, 214), (318, 214), (324, 222)],
        'camadas': [{'faixa_x': (32, 214), 'sigma': 1.0, 'limiar': 9, 'min_largura': 14, 'folga_topo': 6, 'folga_base': 3},
                    {'faixa_x': (285, 326), 'sigma': 1.0, 'limiar': 9, 'min_largura': 14, 'folga_topo': 6, 'folga_base': 3}],
        'distancia': 4, 'max_camadas': 22,
        'escala': 2.55, 'de': (176, 122), 'para': (500, 250), 'semente': 2,
    },
    {
        # Os três irmãos em fila, do mais perto (à esquerda) ao mais longe.
        'nome': 'Três Irmãos', 'arquivo': 'tres-irmaos.webp', 'recorte': (19, 49, 591, 559), 'ceu': ceu_irmaos, 'mediana': 3,
        # pontos em pixels do recorte (a foto sem a moldura branca)
        'bases': [[(1, 352), (61, 351), (131, 349), (181, 351), (227, 352)],
                  [(237, 355), (261, 361), (291, 365), (316, 364), (332, 363)],
                  [(343, 377), (381, 383), (421, 387), (451, 391), (460, 397)]],
        'quinas': [[(207, 233), (211, 271), (217, 311), (223, 349)],
                   [(281, 300), (282, 331), (284, 361)],
                   [(438, 344), (441, 366), (444, 388)]],
        'limite': [(1, 352), (61, 351), (131, 349), (181, 351), (227, 352), (231, 291), (237, 355), (261, 361), (291, 365), (316, 364), (332, 363), (337, 331), (343, 377), (381, 383), (421, 387), (451, 391), (460, 397)],
        'camadas': [{'faixa_x': (1, 228), 'sigma': 1.0, 'limiar': 10, 'min_largura': 16, 'folga_topo': 6, 'folga_base': 3},
                    {'faixa_x': (244, 330), 'sigma': 1.0, 'limiar': 10, 'min_largura': 16, 'folga_topo': 6, 'folga_base': 3},
                    {'faixa_x': (346, 460), 'sigma': 1.0, 'limiar': 10, 'min_largura': 16, 'folga_topo': 6, 'folga_base': 3}],
        'distancia': 4, 'max_camadas': 30,
        'escala': 1.75, 'de': (0, 221), 'para': (0, 285), 'semente': 3,
    },
]


def previa(cenas, arquivo):
    """Imagem das três cenas desenhadas, para conferir sem abrir o site."""
    import re
    cores = {'contorno': (244, 247, 241), 'base': (200, 222, 210), 'quina': (190, 214, 200), 'camada': (150, 185, 168), 'cruz': (244, 247, 241), 'mata': (120, 160, 140)}
    larg = {'contorno': 3, 'base': 2, 'quina': 2, 'camada': 1, 'cruz': 2, 'mata': 1}
    folhas = []
    for c in cenas:
        im = Image.new('RGB', (LARG, ALT), (20, 63, 48))
        g = ImageDraw.Draw(im)
        for tr in c['tracos']:
            for sub in re.findall(r'M[^M]+', tr['d']):
                nums = [float(v) for v in re.findall(r'-?\d+\.?\d*', sub)]
                if 'Q' in sub or 'l' in sub:
                    # moitas e capim: aproximados por segmentos entre os pontos
                    pts, x, y = [], nums[0], nums[1]
                    pts.append((x, y))
                    if 'l' in sub:
                        pts.append((x + nums[2], y + nums[3]))
                    else:
                        for i in range(2, len(nums) - 1, 4):
                            pts += [(nums[i], nums[i + 1]), (nums[i + 2], nums[i + 3])]
                else:
                    pts = list(zip(nums[::2], nums[1::2]))
                g.line(pts, fill=cores[tr['tipo']], width=larg[tr['tipo']], joint='curve')
        folhas.append(im.resize((LARG // 2, ALT // 2)))
    tela = Image.new('RGB', (LARG // 2, ALT // 2 * len(folhas)))
    for i, f in enumerate(folhas):
        tela.paste(f, (0, ALT // 2 * i))
    tela.save(arquivo)


if __name__ == '__main__':
    cenas = [cena(m) for m in MORROS]
    texto = json.dumps(cenas, ensure_ascii=False, separators=(',', ':'))
    SAIDA.write_text(
        '// Gerado por scripts/desenhar-morros.py a partir de fotos de referência. Não editar à mão.\n'
        '// Cada cena é um morro; cada traço tem o desenho (d), quando começa (atraso) e quanto dura (duracao), em ms.\n'
        f'export const CENAS = {texto};\n', encoding='utf-8')
    for c in cenas:
        print(c['nome'], len(c['tracos']), 'traços')
    print(SAIDA, f'{SAIDA.stat().st_size / 1024:.0f} KB')
    if len(sys.argv) > 1:
        previa(cenas, sys.argv[1])
