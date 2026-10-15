import { TIPOS, NIVEIS } from './conteudo.js';

// Sem acento e em minúsculas: "calculo" acha "Cálculo".
export const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PESO_DO_TIPO = { disciplina: 4, aula: 3, texto: 2, modulo: 1, material: 0 };

// Material com nome padrão ("Slides da aula") recebe o nome da aula, senão a busca por
// "slides" devolveria sessenta resultados iguais.
const nomeDoMaterial = (mat, aula) => (mat.nome === TIPOS[mat.tipo]?.nome ? `${TIPOS[mat.tipo].rotulo}: ${aula.titulo}` : mat.nome);

export function indiceDeBusca(c) {
  const itens = [];
  for (const d of c.disciplinas) {
    itens.push({ tipo: 'disciplina', titulo: d.nome, contexto: NIVEIS[d.nivel], rota: `#d-${d.id}` });
    d.modulos.forEach((m, im) => {
      if (m.titulo.trim()) itens.push({ tipo: 'modulo', titulo: m.titulo, contexto: `${d.nome} · Módulo ${im + 1}`, rota: `#d-${d.id}`, extra: m.descricao });
      m.aulas.forEach((a, ia) => {
        if (!a.titulo.trim()) return;
        itens.push({ tipo: 'aula', titulo: a.titulo, contexto: `${d.nome} · Módulo ${im + 1} · Aula ${ia + 1}`, rota: `#a-${a.id}`, extra: `${m.titulo} ${a.descricao ?? ''}` });
        for (const mat of a.materiais) {
          itens.push({ tipo: 'material', titulo: nomeDoMaterial(mat, a), contexto: `${d.nome} · ${a.titulo}`, url: mat.url, extra: TIPOS[mat.tipo]?.rotulo });
        }
      });
    });
  }
  for (const g of c.laboratorio) for (const it of g.itens) {
    itens.push({ tipo: 'material', titulo: it.nome, contexto: `Laboratório · ${g.grupo}`, rota: `#l-${it.id}`, extra: `${TIPOS[it.tipo]?.rotulo ?? ''} ${it.descricao ?? ''}` });
  }
  for (const t of c.textos) {
    if (t.titulo.trim()) itens.push({ tipo: 'texto', titulo: t.titulo, contexto: 'Texto do professor', rota: `#t-${t.id}`, extra: `${t.resumo} ${t.corpo}` });
  }
  return itens.map((i, ordem) => ({ ...i, ordem, chave: normalizar(`${i.titulo} ${i.contexto} ${i.extra ?? ''}`), chaveTitulo: normalizar(i.titulo) }));
}

// Todos os termos (de 2 letras ou mais) precisam aparecer. Termo no título vale mais que no contexto,
// e disciplina e aula vêm antes de material.
export function buscar(indice, consulta, limite = 20) {
  const termos = normalizar(consulta).split(/\s+/).filter((t) => t.length >= 2);
  if (!termos.length) return [];
  return indice
    .filter((i) => termos.every((t) => i.chave.includes(t)))
    .map((i) => ({ i, nota: termos.reduce((n, t) => n + (i.chaveTitulo.includes(t) ? 3 : 1), 0) * 10 + PESO_DO_TIPO[i.tipo] }))
    .sort((a, b) => b.nota - a.nota || a.i.ordem - b.i.ordem)
    .slice(0, limite)
    .map(({ i }) => i);
}
