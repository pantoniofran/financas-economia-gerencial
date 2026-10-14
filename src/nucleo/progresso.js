// Progresso do aluno: aulas marcadas como vistas e a última aula aberta.
// Fica só no navegador dele; aqui moram apenas as regras, sem acesso ao armazenamento.

export function lerProgresso(texto) {
  try {
    const p = JSON.parse(texto);
    return {
      vistas: p && typeof p.vistas === 'object' && !Array.isArray(p.vistas) ? p.vistas : {},
      ultima: typeof p?.ultima === 'string' ? p.ultima : null,
    };
  } catch {
    return { vistas: {}, ultima: null };
  }
}

export function alternarVista(progresso, idAula, hoje) {
  const vistas = { ...progresso.vistas };
  if (vistas[idAula]) delete vistas[idAula];
  else vistas[idAula] = hoje;
  return { ...progresso, vistas };
}

export const registrarUltima = (progresso, idAula) => ({ ...progresso, ultima: idAula });

export function contarVistas(disciplina, vistas) {
  let total = 0;
  let vistasNaDisciplina = 0;
  for (const m of disciplina.modulos) for (const a of m.aulas) {
    if (!a.titulo.trim()) continue;
    total += 1;
    if (vistas[a.id]) vistasNaDisciplina += 1;
  }
  return { vistas: vistasNaDisciplina, total };
}
