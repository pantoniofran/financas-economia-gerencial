# Finanças e Economia Gerencial

Site das disciplinas do Prof. Dr. Antonio Francisco (Escola de Administração da UFBA): aulas com vídeo e material lado a lado, laboratório, textos, pesquisa e contato.

**Site dos alunos:** https://pantoniofran.github.io/financas-economia-gerencial/

## Como o repositório está organizado

- `main` (este ramo): o código do site.
- `gh-pages`: o site pronto, publicado pelo GitHub Pages. Não editar à mão: é gerado a partir do `main`.

| Pasta ou arquivo | O que tem |
| --- | --- |
| `src/conteudo.json` | Todo o conteúdo: disciplinas, módulos, aulas, materiais, laboratório, textos, pesquisa e a página Sobre |
| `arquivos/` | Os PDFs, planilhas e códigos das aulas e do laboratório |
| `midia/` | Capas das disciplinas, foto do Sobre e imagem de compartilhamento |
| `src/nucleo/` | As telas do site (sem dependência de navegador, testadas em `tests/`) |
| `src/app/` | O que roda no navegador: navegação, busca, progresso, leitor de PDF, desenho dos morros |
| `src/estilo.css` | O visual |
| `scripts/` | Ferramentas: publicar, gerar as prévias do laboratório, desenhar os morros, trocar o endereço do site |
| `migracao/` | Registro da migração do site antigo (Wix) e as descrições das aulas, para revisão |

## Para atualizar o site

Precisa de Node.js 20 ou mais novo.

```bash
npm install
npm test
bash scripts/publicar-github.sh https://github.com/pantoniofran/financas-economia-gerencial.git
```

O último comando roda os testes, gera o site e publica no ramo `gh-pages`. O site atualiza em um ou dois minutos.

Para ver o site no próprio computador antes de publicar: `npm run build` e depois `node servidor.mjs site 4174`, e abrir http://localhost:4174.

## Ferramentas extras (Python)

- `python scripts/preparar-previas.py`: refaz as prévias das planilhas e scripts do Laboratório quando um desses arquivos muda (precisa de PyMuPDF, openpyxl e xlrd).
- `python scripts/desenhar-morros.py`: refaz o desenho dos morros da Chapada a partir das fotos de referência, que não ficam no repositório (precisa de numpy, scipy e Pillow).
- `python scripts/mudar-endereco.py <endereço antigo> <endereço novo>`: troca o endereço do site em todo o projeto, inclusive nos links dentro dos PDFs. Útil se o site ganhar um domínio próprio.
