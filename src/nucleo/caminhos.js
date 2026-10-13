export function ler(obj, caminho) {
  return caminho.split('.').reduce((o, k) => o?.[k], obj);
}

const copiar = (v) => (Array.isArray(v) ? v.slice() : { ...v });

export function gravar(obj, caminho, valor) {
  const chaves = caminho.split('.');
  const raiz = copiar(obj);
  let o = raiz;
  for (const k of chaves.slice(0, -1)) {
    o[k] = copiar(o[k]);
    o = o[k];
  }
  o[chaves.at(-1)] = valor;
  return raiz;
}
