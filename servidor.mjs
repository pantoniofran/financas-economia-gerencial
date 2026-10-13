// Servidor estático só para a versão local. O player do YouTube não funciona em file://.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const RAIZ = join(import.meta.dirname, 'dist', 'local');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  const pedido = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const arquivo = normalize(join(RAIZ, pedido === '/' ? 'index.html' : pedido));
  if (arquivo !== RAIZ && !arquivo.startsWith(RAIZ + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const dados = await readFile(arquivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(dados);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(4173, '127.0.0.1', () => console.log('http://localhost:4173'));
