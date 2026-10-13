// Converte os originais de midia/bruto nos arquivos finais de midia/.
// As ilustrações vêm com fundo de papel creme; aqui o fundo vira branco puro, para que o CSS
// possa fundi-las com a página (multiply no tema claro, invertidas com screen no escuro).
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

const BRUTO = 'midia/bruto';
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

// Cor média de quatro cantos, em um ou mais instantes; devolve o canto mais escuro por canal.
function fundoMaisEscuro(arquivo, instantes = [0]) {
  const minimo = [255, 255, 255];
  for (const t of instantes) {
    for (const canto of ['24:24', 'iw-184:24', '24:ih-184', 'iw-184:ih-184']) {
      const px = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', arquivo, '-frames:v', '1',
        '-vf', `crop=160:160:${canto},scale=1:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
      for (let c = 0; c < 3; c++) minimo[c] = Math.min(minimo[c], px[c]);
    }
  }
  return minimo;
}

// Tudo o que for mais claro que o fundo (com folga) vira branco.
const branquear = ([r, g, b], folga) => `colorlevels=rimax=${(r * folga / 255).toFixed(3)}:gimax=${(g * folga / 255).toFixed(3)}:bimax=${(b * folga / 255).toFixed(3)}`;

for (const id of ['eg', 'fc1', 'fc2', 'sem', 'pfc', 'aep', 'fv']) {
  // As capas (segunda versão) são ilustrações cheias, com o assunto da disciplina: só redimensionar.
  const origem = `${BRUTO}/v2/capa-${id}.png`;
  if (!existsSync(origem)) { console.log(`capa-${id}: sem original, pulada`); continue; }
  const destino = `midia/capa-${id}.webp`;
  ff('-i', origem, '-vf', 'scale=1200:675', '-c:v', 'libwebp', '-quality', '72', destino);
  console.log(`${destino}: ${Math.round(statSync(destino).size / 1024)} KB`);
}

const video = `${BRUTO}/hero.mp4`;
if (existsSync(video)) {
  const fundo = fundoMaisEscuro(video, [0, 1, 2, 3, 3.9]);
  // Ida e volta, para o loop não ter corte; recorte 8:3 pelo centro.
  ff('-i', video, '-an', '-filter_complex',
    `[0:v]${branquear(fundo, 0.93)},crop=1280:480,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'midia/hero.mp4');
  // A imagem de espera é o primeiro quadro do vídeo final, para não haver salto quando ele entra.
  ff('-i', 'midia/hero.mp4', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', 'midia/poster.webp');
  console.log(`midia/hero.mp4: ${Math.round(statSync('midia/hero.mp4').size / 1024)} KB (fundo medido: ${fundo.join(',')})`);
  console.log(`midia/poster.webp: ${Math.round(statSync('midia/poster.webp').size / 1024)} KB`);
}
