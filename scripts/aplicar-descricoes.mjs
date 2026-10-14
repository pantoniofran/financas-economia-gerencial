// Leva as descrições de migracao/descricoes/*.json para src/conteudo.json e gera a lista de revisão.
// Texto que o professor já escreveu no site não é substituído.
// Uso: node scripts/aplicar-descricoes.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';

const conteudo = JSON.parse(await readFile('src/conteudo.json', 'utf8'));
const textos = {};
for (const arq of await readdir('migracao/descricoes')) {
  if (arq.endsWith('.json')) textos[arq.replace('.json', '')] = JSON.parse(await readFile(`migracao/descricoes/${arq}`, 'utf8'));
}

const vazio = (v) => !String(v ?? '').trim();
let aplicadas = 0;
const revisao = [
  '# Descrições e dicas para revisar',
  '',
  'Escritas a partir das notas de aula e dos slides do professor. Ele pode corrigir qualquer texto no modo de edição do site (aula: "Nesta aula" e "Dica de estudo"; módulo: o texto logo abaixo do título).',
  '',
];
for (const d of conteudo.disciplinas) {
  const t = textos[d.id];
  if (!t) continue;
  revisao.push(`## ${d.nome}`, '');
  d.modulos.forEach((m, im) => {
    if (vazio(m.descricao) && t.modulos[im + 1]) { m.descricao = t.modulos[im + 1]; aplicadas += 1; }
    revisao.push(`### Módulo ${im + 1}: ${m.titulo}`, '', `> ${m.descricao ?? '(sem descrição)'}`, '');
    m.aulas.forEach((a, ia) => {
      const novo = t.aulas[a.id];
      if (novo) {
        for (const campo of ['descricao', 'dica']) {
          if (vazio(a[campo]) && novo[campo]) { a[campo] = novo[campo]; aplicadas += 1; }
        }
      }
      revisao.push(`- **Aula ${ia + 1}: ${a.titulo}**`);
      revisao.push(vazio(a.descricao) ? '  - _sem descrição (aula sem material para basear o texto)_' : `  - Nesta aula: ${a.descricao}`);
      if (!vazio(a.dica)) revisao.push(`  - Dica: ${a.dica}`);
    });
    revisao.push('');
  });
}

await writeFile('src/conteudo.json', `${JSON.stringify(conteudo, null, 2)}\n`);
await writeFile('migracao/descricoes.md', `${revisao.join('\n')}\n`);
console.log(`${aplicadas} textos aplicados; lista em migracao/descricoes.md`);
