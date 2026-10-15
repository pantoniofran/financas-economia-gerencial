"""Troca o endereço do site em todo o projeto: conteúdo, configuração, scripts e os links dentro dos PDFs.

Uso: python scripts/mudar-endereco.py https://antigo.github.io/repo/ https://novo.github.io/repo/ [--ensaio pasta]
Com --ensaio, os PDFs alterados vão para a pasta indicada e nenhum arquivo do projeto muda.
Precisa de PyMuPDF.
"""
import argparse
from pathlib import Path

import fitz

RAIZ = Path(__file__).resolve().parent.parent
TEXTOS = ['build.mjs', 'scripts/migrar-arquivos.mjs', 'scripts/preparar-previas.py', 'src/conteudo.json', 'src/previas.json', 'migracao/arquivos.json']
# Fontes usadas nos trechos que eu escrevi nos PDFs (Calibri na nota de aula e nos slides do laboratório, Century nos slides do H2).
FONTES = {'calibri': 'C:/Windows/Fonts/calibri.ttf', 'century': 'C:/Windows/Fonts/CENTURY.TTF'}


def fonte_do_trecho(nome):
    nome = nome.lower()
    return 'century' if 'century' in nome else 'calibri'


def trocar_no_pdf(arquivo, antigo_host, novo_host, saida):
    doc = fitz.open(arquivo)
    trocas = 0
    for p in doc:
        # 1. links clicáveis: guardados antes, porque apagar o texto antigo apaga também o link que está por cima
        links = [l for l in p.get_links() if antigo_host in (l.get('uri') or '')]
        guardados = [(fitz.Rect(l['from']), l['uri'].replace(antigo_host, novo_host)) for l in links]
        for l in links:
            p.delete_link(l)
        # 2. o endereço escrito na página: só a palavra que muda (o usuário do GitHub) é reescrita,
        #    na mesma fonte, cor e linha de base, com o corpo ajustado para ocupar a mesma largura.
        antigo_usuario, novo_usuario = antigo_host.split('.')[0], novo_host.split('.')[0]
        alvos = []
        for b in p.get_text('dict')['blocks']:
            for linha in b.get('lines', []):
                for s in linha['spans']:
                    if antigo_usuario not in s['text']:
                        continue
                    for r in p.search_for(antigo_usuario, clip=fitz.Rect(s['bbox']) + (-1, -1, 1, 1)):
                        alvos.append((r, s))
        for r, _ in alvos:
            p.add_redact_annot(r + (0, 0, -0.4, 0), fill=(1, 1, 1))
        p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        for r, s in alvos:
            chave = fonte_do_trecho(s['font'])
            # nome novo: a fonte que já está no PDF foi reduzida às letras usadas antes e não tem todas
            nome = f'{chave}-endereco'
            p.insert_font(fontname=nome, fontfile=FONTES[chave])
            f = fitz.Font(fontfile=FONTES[chave])
            tam = s['size'] * min(1.0, r.width / f.text_length(novo_usuario, s['size']))
            c = s['color']
            cor = ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)
            base = s['origin'][1]
            p.insert_text((r.x0, base), novo_usuario, fontname=nome, fontsize=tam, color=cor)
            # o endereço é sempre um link sublinhado; o sublinhado da palavra apagada some junto com ela
            fim = r.x0 + f.text_length(novo_usuario, tam)
            p.draw_line((r.x0, base + s['size'] * 0.12), (fim, base + s['size'] * 0.12), color=cor, width=s['size'] / 18)
            trocas += 1
        for area, uri in guardados:
            p.insert_link({'kind': fitz.LINK_URI, 'from': area, 'uri': uri})
            trocas += 1
    doc.subset_fonts()
    doc.save(saida, garbage=3, deflate=True)
    return trocas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('antigo')
    ap.add_argument('novo')
    ap.add_argument('--ensaio')
    a = ap.parse_args()
    antigo_host = a.antigo.split('//')[1].split('/')[0]
    novo_host = a.novo.split('//')[1].split('/')[0]
    if not a.ensaio:
        for nome in TEXTOS:
            arq = RAIZ / nome
            if not arq.exists():
                continue
            texto = arq.read_text(encoding='utf-8')
            n = texto.count(a.antigo)
            if n:
                arq.write_text(texto.replace(a.antigo, a.novo), encoding='utf-8')
                print(f'{nome}: {n} endereços')
    for pdf in sorted((RAIZ / 'arquivos').rglob('*.pdf')):
        d = fitz.open(pdf)
        tem = any(antigo_host in pg.get_text() or any(antigo_host in (l.get('uri') or '') for l in pg.get_links()) for pg in d)
        d.close()
        if not tem:
            continue
        saida = Path(a.ensaio) / pdf.name if a.ensaio else pdf.with_suffix('.tmp.pdf')
        n = trocar_no_pdf(pdf, antigo_host, novo_host, saida)
        if not a.ensaio:
            saida.replace(pdf)
        print(f'{pdf.relative_to(RAIZ)}: {n} trocas')


if __name__ == '__main__':
    main()
