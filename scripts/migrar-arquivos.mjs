// Tira os materiais do Wix: baixa cada arquivo citado em src/conteudo.json para arquivos/,
// com nome legível por disciplina, confere tamanho e tipo, e troca os links do conteúdo pelo
// endereço no GitHub Pages. Pode rodar de novo: o que já foi baixado e conferido é pulado.
//
// Uso: node scripts/migrar-arquivos.mjs [endereço do site]
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SITE = (process.argv[2] ?? 'https://pedrolofiego.github.io/financas-economia-gerencial/').replace(/\/?$/, '/');
const conteudo = JSON.parse(readFileSync('src/conteudo.json', 'utf8'));
const doWix = (url) => /filesusr\.com/.test(url);

const ROTULO = { slides: 'slides', notas: 'nota-de-aula', exercicios: 'exercicios', planilha: 'planilha', codigo: 'codigo', material: 'material', link: 'arquivo' };
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const extensao = (url) => url.split(/[?#]/)[0].split('.').pop().toLowerCase();

// Cada endereço do Wix ganha um caminho só, definido pela primeira vez em que aparece.
const destinos = new Map();
const usados = new Set();
function reservar(url, base) {
  if (destinos.has(url)) return destinos.get(url);
  let caminho = `${base}.${extensao(url)}`;
  for (let n = 2; usados.has(caminho); n++) caminho = `${base}-${n}.${extensao(url)}`;
  usados.add(caminho);
  destinos.set(url, caminho);
  return caminho;
}

conteudo.disciplinas.forEach((d) => d.modulos.forEach((m, im) => m.aulas.forEach((a, ia) => a.materiais.forEach((mat) => {
  if (doWix(mat.url)) reservar(mat.url, `arquivos/${d.id}/modulo-${im + 1}-aula-${ia + 1}-${ROTULO[mat.tipo] ?? 'arquivo'}`);
}))));
conteudo.laboratorio.forEach((g) => g.itens.forEach((it) => {
  if (doWix(it.url)) reservar(it.url, `arquivos/laboratorio/${slug(it.nome)}`);
}));

// Assinatura dos primeiros bytes, para não publicar uma página de erro com nome de PDF.
const ASSINATURA = { pdf: '%PDF', xlsx: 'PK', zip: 'PK' };

const pendentes = [...destinos];
const problemas = [];
let baixados = 0;
let pulados = 0;
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < pendentes.length) {
    const [url, caminho] = pendentes[i++];
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`resposta ${r.status}`);
      const esperado = Number(r.headers.get('content-length') || 0);
      if (existsSync(caminho) && esperado && statSync(caminho).size === esperado) {
        await r.body?.cancel();
        pulados++;
        continue;
      }
      const dados = Buffer.from(await r.arrayBuffer());
      if (esperado && dados.length !== esperado) throw new Error(`tamanho ${dados.length}, esperado ${esperado}`);
      const assinatura = ASSINATURA[extensao(url)];
      if (assinatura && !dados.subarray(0, 4).toString('latin1').startsWith(assinatura)) throw new Error('conteúdo não é do tipo esperado');
      mkdirSync(dirname(caminho), { recursive: true });
      writeFileSync(caminho, dados);
      baixados++;
    } catch (erro) {
      problemas.push(`${caminho} <- ${url}: ${erro.message}`);
    }
  }
}));

if (problemas.length) {
  console.error(`${problemas.length} arquivo(s) com problema; o conteúdo NÃO foi alterado:\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}

// Só troca os links depois que todos os arquivos estão no disco e conferidos.
const novo = (url) => (destinos.has(url) ? SITE + destinos.get(url) : url);
conteudo.disciplinas.forEach((d) => d.modulos.forEach((m) => m.aulas.forEach((a) => a.materiais.forEach((mat) => { mat.url = novo(mat.url); }))));
conteudo.laboratorio.forEach((g) => g.itens.forEach((it) => { it.url = novo(it.url); }));
writeFileSync('src/conteudo.json', `${JSON.stringify(conteudo, null, 2)}\n`);
writeFileSync('migracao/arquivos.json', `${JSON.stringify(Object.fromEntries(destinos), null, 2)}\n`);

const restantes = JSON.stringify(conteudo).match(/filesusr\.com/g)?.length ?? 0;
console.log(`${destinos.size} arquivos: ${baixados} baixados, ${pulados} já estavam aqui. Links trocados no conteúdo; restam ${restantes} apontando para o Wix.`);
console.log('Mapa antigo -> novo em migracao/arquivos.json');
