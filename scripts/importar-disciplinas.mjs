// Roda uma vez: substitui "disciplinas" em src/conteudo.json. Ajustes manuais vêm depois.
import { readFile, writeFile } from 'node:fs/promises';
import { agrupar } from './agrupar.mjs';

const DISCIPLINAS = [
  ['eg', 'graduacao', 'Economia Gerencial'],
  ['fc1', 'graduacao', 'Finanças Corporativas 1'],
  ['fc2', 'graduacao', 'Finanças Corporativas 2'],
  ['sem', 'graduacao', 'Seminários em Finanças'],
  ['pfc', 'pos', 'Finanças Corporativas'],
  ['aep', 'pos', 'Avaliação Econômica de Projetos'],
  ['fv', 'pos', 'Finanças Sustentáveis/Verdes'],
];

const conteudo = JSON.parse(await readFile('src/conteudo.json', 'utf8'));
const tabela = ['| Disciplina | Módulos | Aulas | Links no Wix | Migrados | Sem aula | Rotulados "Material" |', '|---|---|---|---|---|---|---|'];
const pendencias = [];
conteudo.disciplinas = [];

for (const [id, nivel, nome] of DISCIPLINAS) {
  const bruto = JSON.parse(await readFile(`migracao/bruto/${id}.json`, 'utf8'));
  const { modulos, orfaos } = agrupar(bruto, id);
  const aulas = modulos.flatMap((m) => m.aulas);
  const materiais = aulas.flatMap((a) => a.materiais);
  const genericos = materiais.filter((m) => m.tipo === 'material').length;
  tabela.push(`| ${nome} | ${modulos.length} | ${aulas.length} | ${bruto.links.length} | ${materiais.length} | ${orfaos.length} | ${genericos} |`);
  for (const url of orfaos) pendencias.push(`- ${nome}: link sem aula correspondente: ${url}`);
  if (materiais.length + orfaos.length !== bruto.links.length) pendencias.push(`- ${nome}: a soma não fecha com o Wix`);
  conteudo.disciplinas.push({
    id, nivel, nome,
    ficha: { ementa: '', objetivos: '', avaliacao: '', bibliografia: '' },
    avisos: [],
    modulos,
  });
}

await writeFile('src/conteudo.json', `${JSON.stringify(conteudo, null, 2)}\n`);
await writeFile('migracao/disciplinas.md', ['# Migração das disciplinas', '', ...tabela, '', '## Pendências', '', ...(pendencias.length ? pendencias : ['Nenhuma.']), ''].join('\n'));
console.log(tabela.join('\n'));
console.log(pendencias.length ? `\n${pendencias.length} pendência(s): ver migracao/disciplinas.md` : '\nSem pendências.');
