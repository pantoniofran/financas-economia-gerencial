import { idDoYoutube, tipoPorUrl } from '../src/nucleo/youtube.js';
import { TIPOS } from '../src/nucleo/conteudo.js';

export const ICONE_APRESENTACAO = '38.001 50 123.999 100';
const DISTANCIA_MAXIMA = 30; // px entre o centro do ícone e o centro da linha da aula
const SALTO_DE_LINHA = 60;   // px: acima disso, a linha não é continuação da aula anterior

const centroY = (r) => r[1] + r[3] / 2;

export const ICONE_DOCUMENTO = '42.5 29.5 115 141';

// Conferido em amostras: o ícone de apresentação leva a slides (PowerPoint, página deitada)
// e o de documento leva a notas de aula (Word, A4), quando o arquivo é PDF.
export function tipoDoLink(link) {
  if (idDoYoutube(link.href)) return 'video';
  const base = link.href.split(/[?#]/)[0].toLowerCase();
  if (base.endsWith('.zip')) return 'codigo';
  const tipo = tipoPorUrl(link.href);
  if (tipo !== 'slides') return tipo;
  if (link.icone === ICONE_APRESENTACAO) return 'slides';
  return link.icone === ICONE_DOCUMENTO ? 'notas' : 'material';
}

export function nomeDoLink(link, tipo) {
  const base = link.href.split(/[?#]/)[0].toLowerCase();
  if (base.endsWith('.ipynb')) return 'Notebook em Python';
  if (base.endsWith('.zip')) return 'Pacote de arquivos (zip)';
  return TIPOS[tipo].nome;
}

export function agrupar(bruto, idDisciplina) {
  const modulos = [];
  const alvos = []; // { y, aula, links: [] }
  let aula = null;

  for (const linha of [...bruto.linhas].sort((a, b) => a.r[1] - b.r[1])) {
    const y = centroY(linha.r);
    const eModulo = /^(\d+)\.\s+(.+)$/.exec(linha.t);
    // "Caso 1: H2 verde" também é uma linha de aula; nesse caso o prefixo fica no título.
    const eAula = /^Aula\s+\d+\s*:\s*(.+)$/i.exec(linha.t) ?? /^(Caso\s+\d+\s*:.+)$/i.exec(linha.t);
    if (eModulo) {
      modulos.push({ id: `${idDisciplina}-${modulos.length + 1}`, titulo: eModulo[2].trim(), aulas: [] });
      aula = null;
    } else if (eAula && modulos.length) {
      const modulo = modulos.at(-1);
      aula = { id: `${modulo.id}-${modulo.aulas.length + 1}`, titulo: eAula[1].trim(), materiais: [] };
      modulo.aulas.push(aula);
      alvos.push({ y, aula, links: [] });
    } else if (aula && y - alvos.at(-1).y < SALTO_DE_LINHA) {
      aula.titulo += ` ${linha.t}`;
      alvos.push({ y, aula, links: [] });
    } else {
      aula = null;
    }
  }

  const orfaos = [];
  for (const link of bruto.links) {
    const y = centroY(link.r);
    const perto = alvos.reduce((melhor, alvo) => (!melhor || Math.abs(alvo.y - y) < Math.abs(melhor.y - y) ? alvo : melhor), null);
    if (!perto || Math.abs(perto.y - y) > DISTANCIA_MAXIMA) orfaos.push(link.href);
    else perto.links.push(link);
  }

  const porAula = new Map();
  for (const alvo of alvos) porAula.set(alvo.aula, [...(porAula.get(alvo.aula) ?? []), ...alvo.links]);
  for (const [a, links] of porAula) {
    a.materiais = links.sort((p, q) => p.r[0] - q.r[0]).map((link, k) => {
      const tipo = tipoDoLink(link);
      return { id: `${a.id}-m${k + 1}`, tipo, nome: nomeDoLink(link, tipo), url: link.href };
    });
  }
  return { modulos, orfaos };
}
