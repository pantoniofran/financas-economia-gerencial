import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { corpoDaPagina, documentoCompleto } from './src/nucleo/documento.js';
import { validarConteudo } from './src/nucleo/conteudo.js';

const TITULO = 'Finanças e Economia Gerencial';
const FONTES = 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400..600&family=Literata:opsz,wght@7..72,400..500&display=swap';

const lerJSON = async (arquivo, padrao) => {
  try { return JSON.parse(await readFile(arquivo, 'utf8')); } catch (erro) { if (padrao === undefined) throw erro; return padrao; }
};

const conteudo = await lerJSON('src/conteudo.json');
const erros = validarConteudo(conteudo);
if (erros.length) {
  console.error(`conteudo.json inválido:\n- ${erros.join('\n- ')}`);
  process.exit(1);
}

const css = await readFile('src/estilo.css', 'utf8');
const resultado = await build({
  entryPoints: ['src/app/principal.js'], bundle: true, format: 'iife', minify: true,
  target: 'es2022', charset: 'utf8', write: false,
});
// O programa vai dentro de uma tag <script>: nenhum fechamento de tag pode aparecer no texto dele.
const js = resultado.outputFiles[0].text.replace(/<\/(script|style)/gi, '<\\/$1');
if (/<\/style/i.test(css)) throw new Error('estilo.css contém "</style"');
// "<!--" seguido de "<script" dentro de um script muda o modo do leitor de HTML e quebra a página.
if (js.includes('<!--')) throw new Error('o programa contém "<!--"');

await mkdir('dist/local', { recursive: true });
// Só os arquivos finais; os originais em midia/bruto não vão para a saída.
await cp('midia', 'dist/local/midia', { recursive: true, filter: (origem) => !/[\\/]bruto$/.test(origem) })
  .catch(() => { /* ainda sem mídia */ });

const saidas = [
  ['artifact', 'dist/artifact.html', corpoDaPagina],
  ['local', 'dist/local/index.html', documentoCompleto],
];
for (const [ambiente, arquivo, montar] of saidas) {
  const config = { ambiente, titulo: TITULO, fontes: FONTES, midia: await lerJSON(`src/midia.${ambiente}.json`, {}) };
  const html = montar({ titulo: TITULO, fontes: FONTES, css, js, conteudo, config });
  await writeFile(arquivo, html);
  console.log(`${arquivo}: ${Math.round(Buffer.byteLength(html) / 1024)} KB`);
}

// Versão pública (GitHub Pages): só leitura, sem o modo de ensaio, com o player embutido.
// Ganha o que uma página aberta na internet precisa: idioma, descrição, ícone e a prévia
// que aparece quando o link é colado no WhatsApp.
const URL_DO_SITE = (process.env.SITE_URL ?? 'https://pedrolofiego.github.io/financas-economia-gerencial/').replace(/\/?$/, '/');
const DESCRICAO = 'Material de aula, pesquisa e textos do Prof. Dr. Antonio Francisco, da Escola de Administração da UFBA.';
const ICONE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23143f30'/%3E%3Cpath d='M6 22c6-12 12-12 20-4' fill='none' stroke='%23e9bf6b' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E";
const cabeca = [
  // O título também vai na cabeça: é onde buscadores e prévias de link o procuram.
  `<title>${TITULO}</title>`,
  `<meta name="description" content="${DESCRICAO}">`,
  // Enquanto o site está em teste com os alunos, fica fora dos buscadores. Apagar esta linha quando for oficial.
  '<meta name="robots" content="noindex">',
  `<link rel="icon" href="${ICONE}">`,
  '<meta property="og:type" content="website">',
  `<meta property="og:title" content="${TITULO}">`,
  `<meta property="og:description" content="${DESCRICAO}">`,
  `<meta property="og:url" content="${URL_DO_SITE}">`,
  `<meta property="og:image" content="${URL_DO_SITE}midia/compartilhar.jpg">`,
  '<meta property="og:locale" content="pt_BR">',
  '<meta name="twitter:card" content="summary_large_image">',
].join('');
await mkdir('dist/site', { recursive: true });
await cp('midia', 'dist/site/midia', { recursive: true, filter: (origem) => !/[\\/]bruto$/.test(origem) }).catch(() => {});
// Os materiais das aulas (antes no Wix) moram no site público; a versão do Claude aponta para cá.
await cp('arquivos', 'dist/site/arquivos', { recursive: true }).catch(() => {});
const configDoSite = { ambiente: 'local', ensaio: false, titulo: TITULO, fontes: FONTES, midia: await lerJSON('src/midia.local.json', {}) };
const site = documentoCompleto({ titulo: TITULO, fontes: FONTES, css, js, conteudo, config: configDoSite })
  .replace('<html>', '<html lang="pt-BR">')
  .replace('<meta charset=utf8>', `<meta charset=utf8>${cabeca}`);
await writeFile('dist/site/index.html', site);
await writeFile('dist/site/.nojekyll', ''); // o GitHub Pages serve os arquivos como estão
console.log(`dist/site/index.html: ${Math.round(Buffer.byteLength(site) / 1024)} KB (${URL_DO_SITE})`);
