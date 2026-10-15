import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderizar, interpretarRota } from '../src/nucleo/telas.js';
import { indiceDeBusca, buscar } from '../src/nucleo/busca.js';
import { conteudoExemplo } from './fixtura.js';

const leitura = {
  editando: false, podeEditar: false, alteracoes: 0, publicando: false, confirmando: null,
  formulario: null, mensagem: '', hoje: '2026-10-14', ambiente: 'local', midia: {},
  progresso: { vistas: {}, ultima: null }, siteUrl: 'https://site.exemplo/', zips: {},
};
const ver = (hash, ctx = leitura, c = conteudoExemplo()) => renderizar(c, interpretarRota(hash), ctx);

function comTextos() {
  const c = conteudoExemplo();
  const a = c.disciplinas[0].modulos[0].aulas[0];
  a.descricao = 'A relação entre preço e quantidade. Com um exemplo do sorvete.';
  a.dica = 'Some as demandas individuais.';
  c.disciplinas[0].modulos[0].descricao = 'As bases de microeconomia.';
  return c;
}

test('modo de estudo: vídeo e leitor de PDF lado a lado, com descrição e dica', () => {
  const html = ver('#a-eg-1-1', leitura, comTextos());
  assert.match(html, /class="estudo"/);
  assert.match(html, /class="leitor" data-pdf="https:\/\/exemplo.com\/a.pdf"/);
  assert.match(html, /data-op="tocar"/);
  assert.match(html, /Nesta aula/);
  assert.match(html, /class="dica"/);
  assert.match(html, /data-op="vista" data-aula="eg-1-1" aria-pressed="false"/);
});

test('no Claude a aula fica com links, sem leitor embutido', () => {
  const html = ver('#a-eg-1-1', { ...leitura, ambiente: 'artifact' }, comTextos());
  assert.doesNotMatch(html, /class="leitor"/);
  assert.match(html, /Dica de estudo/);
});

test('lista de aulas mostra só a primeira frase e o módulo mostra o que o aluno vai ver', () => {
  const html = ver('#d-eg', leitura, comTextos());
  assert.match(html, /<span class="aula-resumo">A relação entre preço e quantidade\.<\/span>/);
  assert.match(html, /modulo-descricao[^>]*><p>As bases de microeconomia\.<\/p>/);
});

test('progresso: aula vista marcada e contagem na disciplina', () => {
  const ctx = { ...leitura, progresso: { vistas: { 'eg-1-1': '2026-10-14' }, ultima: 'eg-1-1' } };
  assert.match(ver('#d-eg', ctx), /class="aula aula-leitura aula-vista"><a class="aula-cartao" href="#a-eg-1-1">/);
  assert.match(ver('#d-eg', ctx), /Você viu 1 de 3 aulas/);
  assert.match(ver('#inicio', ctx), /Continuar de onde parei/);
});

test('zip do módulo aparece quando existe', () => {
  const ctx = { ...leitura, zips: { 'eg-1': { url: 'https://site.exemplo/arquivos/zip/eg-modulo-1.zip', tamanho: '1,2 MB' } } };
  assert.match(ver('#d-eg', ctx), /eg-modulo-1\.zip">.*Baixar os materiais do módulo <small>ZIP · 1,2 MB/);
});

test('QR codes: um para o site e um por disciplina', () => {
  const html = ver('#qr');
  assert.equal((html.match(/data-qr=/g) || []).length, 3);
  assert.match(html, /data-qr="https:\/\/site.exemplo\/#d-eg"/);
});

test('a busca encontra a aula pela descrição', () => {
  assert.equal(buscar(indiceDeBusca(comTextos()), 'sorvete')[0].rota, '#a-eg-1-1');
});

function comLaboratorio() {
  const c = conteudoExemplo();
  const it = c.laboratorio[0].itens[0];
  it.descricao = 'Preços de ações e o exercício de regressão.';
  it.aulas = ['eg-1-1', 'nao-existe'];
  c.laboratorio[0].descricao = 'Modelos em Excel.';
  return c;
}

test('laboratório: cartão explica o material, liga às aulas e oferece prévia', () => {
  const ctx = { ...leitura, previas: { 'https://exemplo.com/capm.xls': { tipo: 'tabela', abas: ['Plan1'], aba: 'Plan1', linhas: [['Mês', 'EmpA']], tamanho: '150 KB' } } };
  const html = ver('#laboratorio', ctx, comLaboratorio());
  assert.match(html, /Modelos em Excel\./);
  assert.match(html, /Preços de ações e o exercício de regressão\./);
  assert.match(html, /Usado nas aulas[\s\S]*href="#a-eg-1-1"/);
  assert.match(html, /Planilha · Excel · 150 KB/);
  assert.match(html, /data-op="previa" data-item="lab-1"/);
  assert.match(html, /href="https:\/\/exemplo.com\/capm.xls" download/);
});

test('laboratório: vindo da aula, o material aparece destacado, e a aula mostra o que praticar', () => {
  const c = comLaboratorio();
  assert.match(ver('#l-lab-1', leitura, c), /class="lab-item destaque" id="item-lab-1"/);
  assert.match(ver('#a-eg-1-1', leitura, c), /Para praticar no Laboratório[\s\S]*href="#l-lab-1"/);
});

test('prévia de planilha mostra o trecho e as abas', async () => {
  const { previaDoLaboratorio } = await import('../src/nucleo/telas.js');
  const it = comLaboratorio().laboratorio[0].itens[0];
  const html = previaDoLaboratorio(it, { ...leitura, previas: { [it.url]: { tipo: 'tabela', abas: ['Preços', 'Plan1'], aba: 'Plan1', linhas: [['Mês', '1,5']] } } });
  assert.match(html, /Trecho da aba <b>Plan1<\/b>\. A planilha tem 2 abas: Preços, Plan1\./);
  assert.match(html, /<td class="valor">1,5<\/td>/);
});

test('tirar dúvida: escolha entre Gmail, Outlook, programa de e-mail ou copiar, com disciplina e aula no assunto', () => {
  const c = conteudoExemplo();
  c.sobre.email = 'prof@exemplo.com';
  const aula = ver('#a-eg-1-1', leitura, c);
  const hrefs = [...aula.matchAll(/class="btn-abrir" href="([^"]+)" target="_blank"/g)].map((m) => decodeURIComponent(m[1].replaceAll('&amp;', '&')));
  const assunto = '[Economia Gerencial] Dúvida - Módulo 1, Aula 1: Curva de Demanda';
  assert.ok(hrefs.some((h) => h.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=prof@exemplo.com&su=' + assunto)));
  assert.ok(hrefs.some((h) => h.startsWith('https://outlook.office.com/mail/deeplink/compose?to=prof@exemplo.com&subject=' + assunto)));
  assert.ok(hrefs.some((h) => h.startsWith('mailto:prof@exemplo.com?subject=' + assunto)));
  assert.ok(aula.includes('<summary class="btn-duvida leve">Tirar dúvida sobre esta aula</summary>'));
  assert.ok(aula.includes(`data-op="copiar" data-texto="prof@exemplo.com\n${assunto}"`));
  assert.ok(ver('#d-eg', leitura, c).includes('assunto <b>[Economia Gerencial] Dúvida</b>'));
  c.disciplinas[0].duvidas = 'https://forms.exemplo/x';
  assert.ok(ver('#d-eg', leitura, c).includes('<a class="btn-duvida leve" href="https://forms.exemplo/x" target="_blank"'));
});

test('disciplina: cada aula é um cartão que leva à tela de estudo, e o topo tem o botão para começar ou continuar', () => {
  const c = conteudoExemplo();
  const nova = ver('#d-eg', leitura, c);
  assert.match(nova, /<a class="btn-estudar" href="#a-eg-1-1">[\s\S]*?Começar pela primeira aula[\s\S]*?Módulo 1 · Aula 1: Curva de Demanda/);
  assert.match(nova, /<a class="aula-cartao" href="#a-eg-1-1">[\s\S]*?Curva de Demanda[\s\S]*?Slides[\s\S]*?Assistir ›/);
  const vista = ver('#d-eg', { ...leitura, progresso: { vistas: { 'eg-1-1': '2026-10-14' }, ultima: 'eg-1-1' } }, c);
  assert.match(vista, /<a class="btn-estudar" href="#a-eg-1-2">[\s\S]*?Próxima aula/);
  const parou = ver('#d-eg', { ...leitura, progresso: { vistas: {}, ultima: 'eg-2-1' } }, c);
  assert.match(parou, /<a class="btn-estudar" href="#a-eg-2-1">[\s\S]*?Continuar de onde parei/);
});
