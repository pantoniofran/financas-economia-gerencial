import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { corpoDaPagina, documentoCompleto } from './src/nucleo/documento.js';
import { validarConteudo } from './src/nucleo/conteudo.js';

const TITULO = 'Finanças e Economia Gerencial';
const FONTES = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap';

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
