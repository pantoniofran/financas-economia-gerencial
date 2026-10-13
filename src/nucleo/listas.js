export function mover(lista, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const c = lista.slice();
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export const remover = (lista, i) => lista.filter((_, k) => k !== i);

export const inserir = (lista, item) => [...lista, item];

export function novoId(prefixo, rand = Math.random) {
  const n = Math.floor(rand() * 36 ** 5);
  return `${prefixo}-${n.toString(36).padStart(5, '0')}`;
}
