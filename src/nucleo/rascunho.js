export function hash(texto) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function decidirRascunho(salvo, hashPublicado) {
  if (!salvo?.conteudo) return 'nenhum';
  if (hash(JSON.stringify(salvo.conteudo)) === hashPublicado) return 'publicado';
  return salvo.base === hashPublicado ? 'restaurar' : 'restaurar-desatualizado';
}
