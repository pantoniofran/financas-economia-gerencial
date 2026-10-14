// Datas da disciplina (cronograma) e o que é novidade.

export const TIPOS_EVENTO = { aula: 'Aula', prova: 'Prova', entrega: 'Entrega' };
export const DIAS_DE_NOVIDADE = 14;

const dia = 86400000;

// "Novo" nos 14 dias seguintes à data em que o professor adicionou.
export function ehNovo(data, hoje, dias = DIAS_DE_NOVIDADE) {
  if (!data) return false;
  const passados = (Date.parse(hoje) - Date.parse(data)) / dia;
  return passados >= 0 && passados < dias;
}

export function novidades(c, hoje, dias = DIAS_DE_NOVIDADE) {
  const lista = [];
  for (const d of c.disciplinas) for (const m of d.modulos) for (const a of m.aulas) {
    if (!a.titulo.trim()) continue;
    if (ehNovo(a.adicionadoEm, hoje, dias)) {
      lista.push({ tipo: 'aula', data: a.adicionadoEm, titulo: a.titulo, disciplina: d, aula: a });
      continue; // aula nova inteira: os materiais dela não entram um por um
    }
    for (const mat of a.materiais) {
      if (ehNovo(mat.adicionadoEm, hoje, dias)) lista.push({ tipo: 'material', data: mat.adicionadoEm, titulo: mat.nome, disciplina: d, aula: a, material: mat });
    }
  }
  for (const t of c.textos) {
    if (t.titulo.trim() && ehNovo(t.data, hoje, dias)) lista.push({ tipo: 'texto', data: t.data, titulo: t.titulo, texto: t });
  }
  return lista.sort((x, y) => y.data.localeCompare(x.data));
}

export function proximosEventos(eventos = [], hoje) {
  return eventos
    .filter((e) => e.data && e.titulo?.trim() && e.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Link do Google Agenda com o evento já preenchido, como compromisso de dia inteiro.
export function linkAgenda(evento, nomeDaDisciplina) {
  const inicio = evento.data.replaceAll('-', '');
  const fim = new Date(Date.parse(evento.data) + dia).toISOString().slice(0, 10).replaceAll('-', '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${TIPOS_EVENTO[evento.tipo] ?? 'Evento'}: ${evento.titulo} (${nomeDaDisciplina})`,
    dates: `${inicio}/${fim}`,
    details: nomeDaDisciplina,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function dataCurta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return '';
  return `${SEMANA[new Date(Date.parse(iso)).getUTCDay()]}, ${m[3]}/${m[2]}`;
}
