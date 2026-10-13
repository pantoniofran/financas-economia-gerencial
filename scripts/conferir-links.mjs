import { readFile, writeFile } from 'node:fs/promises';
import { idDoYoutube } from '../src/nucleo/youtube.js';

const c = JSON.parse(await readFile('src/conteudo.json', 'utf8'));
const itens = [];
for (const d of c.disciplinas) for (const m of d.modulos) for (const a of m.aulas) for (const mat of a.materiais) {
  itens.push({ onde: `${d.nome} › ${m.titulo} › ${a.titulo} › ${mat.nome}`, url: mat.url });
}
for (const g of c.laboratorio) for (const it of g.itens) itens.push({ onde: `Laboratório › ${it.nome}`, url: it.url });

async function pedir(url, opcoes) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), ...opcoes });
  await r.body?.cancel();
  return r.status;
}

async function conferir(url) {
  try {
    // Vídeo: o oEmbed do YouTube responde 200 só se o vídeo existe e é público ou não listado.
    if (idDoYoutube(url)) return await pedir(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    const status = await pedir(url, { method: 'HEAD' });
    return status === 403 || status === 405 ? await pedir(url, { headers: { range: 'bytes=0-0' } }) : status;
  } catch (erro) {
    return `erro (${erro.name})`;
  }
}

const resultados = [];
let proximo = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (proximo < itens.length) {
    const item = itens[proximo++];
    resultados.push({ ...item, status: await conferir(item.url) });
  }
}));

const ruins = resultados.filter((r) => r.status !== 200 && r.status !== 206);
await writeFile('migracao/links.md', [
  '# Conferência de links', '',
  `${resultados.length} endereços testados, ${ruins.length} com problema.`, '',
  ...(ruins.length ? ['| Onde | Resposta | Endereço |', '|---|---|---|', ...ruins.map((r) => `| ${r.onde} | ${r.status} | ${r.url} |`)] : ['Todos responderam.']),
  '',
].join('\n'));
console.log(`${resultados.length} endereços, ${ruins.length} com problema. Ver migracao/links.md`);
