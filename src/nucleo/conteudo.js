export const TIPOS = {
  slides: { rotulo: 'Slides', nome: 'Slides da aula' },
  notas: { rotulo: 'Nota de aula', nome: 'Nota de aula' },
  video: { rotulo: 'Vídeo', nome: 'Vídeo da aula' },
  exercicios: { rotulo: 'Exercícios', nome: 'Lista de exercícios' },
  planilha: { rotulo: 'Planilha', nome: 'Planilha' },
  codigo: { rotulo: 'Código', nome: 'Código' },
  link: { rotulo: 'Link', nome: 'Link' },
  material: { rotulo: 'Material', nome: 'Material' },
};

export const NIVEIS = { graduacao: 'Graduação', pos: 'Pós-graduação' };

// Categorias de publicação, na ordem em que aparecem na página Pesquisa.
export const CATEGORIAS_PUBLICACAO = [
  ['artigo', 'Artigos em periódicos'],
  ['capitulo', 'Capítulos de livros'],
  ['anais', 'Trabalhos em anais de eventos'],
  ['jornal', 'Artigos em jornais'],
  ['palestra', 'Apresentações e palestras'],
  ['outro', 'Demais produções'],
];

export function hojeISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function avisosValidos(avisos = [], hoje) {
  return avisos.filter((a) => a.texto?.trim() && (!a.ate || a.ate >= hoje));
}

export function avisosRecentes(conteudo, hoje) {
  return conteudo.disciplinas.flatMap((disciplina) =>
    avisosValidos(disciplina.avisos, hoje).map((aviso) => ({ disciplina, aviso })));
}

const listarAulas = (disciplina) =>
  disciplina.modulos.flatMap((modulo, im) => modulo.aulas.map((aula, ia) => ({ modulo, aula, im, ia })));

export function acharAula(conteudo, idAula) {
  for (const [idx, disciplina] of conteudo.disciplinas.entries()) {
    const todas = listarAulas(disciplina);
    const i = todas.findIndex((x) => x.aula.id === idAula);
    if (i >= 0) {
      return { disciplina, idx, ...todas[i], anterior: todas[i - 1]?.aula ?? null, proxima: todas[i + 1]?.aula ?? null };
    }
  }
  return null;
}

export function videoPrincipal(aula) {
  return aula.materiais.find((m) => m.tipo === 'video') ?? null;
}

const ID = /^[a-z0-9-]+$/;

export function validarConteudo(c) {
  const erros = [];
  if (!c?.site?.titulo) erros.push('site.titulo ausente');
  for (const chave of ['disciplinas', 'laboratorio', 'textos']) {
    if (!Array.isArray(c?.[chave])) erros.push(`${chave} deve ser uma lista`);
  }
  if (!c?.pesquisa) erros.push('pesquisa ausente');
  if (!c?.sobre) erros.push('sobre ausente');
  if (erros.length) return erros;

  const vistos = new Set();
  const conferirId = (id, onde) => {
    if (typeof id !== 'string' || !ID.test(id)) erros.push(`${onde}: id inválido "${id}"`);
    else if (vistos.has(id)) erros.push(`${onde}: id repetido "${id}"`);
    else vistos.add(id);
  };
  const conferirMaterial = (m, onde) => {
    if (!TIPOS[m.tipo]) erros.push(`${onde}: tipo inválido "${m.tipo}"`);
    if (!m.url) erros.push(`${onde}: material sem endereço`);
    if (!m.nome?.trim()) erros.push(`${onde}: material sem nome`);
  };

  for (const d of c.disciplinas) {
    conferirId(d.id, 'disciplina');
    if (!NIVEIS[d.nivel]) erros.push(`disciplina ${d.id}: nível inválido "${d.nivel}"`);
    for (const m of d.modulos ?? []) {
      for (const a of m.aulas ?? []) {
        conferirId(a.id, `aula em ${d.id}`);
        for (const mat of a.materiais ?? []) conferirMaterial(mat, `aula ${a.id}`);
      }
    }
  }
  for (const g of c.laboratorio) for (const it of g.itens ?? []) conferirMaterial(it, `laboratório, ${g.grupo}`);
  for (const t of c.textos) conferirId(t.id, 'texto');
  return erros;
}
