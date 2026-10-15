import qrcode from 'qrcode-generator';
import { renderizar, interpretarRota, barraEdicao, resultadosDaBusca, previaDoLaboratorio } from '../nucleo/telas.js';
import { TIPOS, hojeISO, validarConteudo } from '../nucleo/conteudo.js';
import { aplicar, novoItem } from '../nucleo/edicao.js';
import { ler } from '../nucleo/caminhos.js';
import { novoId } from '../nucleo/listas.js';
import { idDoYoutube, urlValida } from '../nucleo/youtube.js';
import { documentoCompleto, RESET_PADRAO } from '../nucleo/documento.js';
import { hash, decidirRascunho } from '../nucleo/rascunho.js';
import { SEM_ESCRITA, NAO_REPETIR, mensagemDePublicacao, mensagemDeEnvio } from '../nucleo/mensagens.js';
import { lerProgresso, alternarVista, registrarUltima } from '../nucleo/progresso.js';
import { indiceDeBusca, buscar } from '../nucleo/busca.js';
import { criarArmazenamento, armazenamentoDeEnsaio } from './armazenamento.js';
import { abrirLeitor, fecharLeitor } from './leitor.js';
import { iniciarMorros } from './morros.js';

const CHAVE_RASCUNHO = 'rascunho-v1';
const CHAVE_ENSAIO = 'publicado-ensaio';
const CHAVE_PROGRESSO = 'progresso-v1';
const LIMITE_ARQUIVO = 20 * 1024 * 1024;

// O armazenamento do navegador pode falhar (janela privada, bloqueio): o site segue sem rascunho.
const cofre = {
  ler(chave) { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue */ } },
  limpar(chave) { try { localStorage.removeItem(chave); } catch { /* segue */ } },
  texto(chave) { try { return localStorage.getItem(chave); } catch { return null; } },
};

const lerBloco = (id) => JSON.parse(document.getElementById(id).textContent);
const config = lerBloco('config');
// Código-fonte canônico da página, usado para regenerar o documento ao publicar.
const fonte = {
  css: document.getElementById('estilo').textContent,
  js: document.getElementById('programa').textContent,
};
// O modo de ensaio (edição simulada, salva só no navegador) existe na versão local; a versão pública o desliga.
const ENSAIO = config.ambiente === 'local' && config.ensaio !== false && new URLSearchParams(location.search).has('ensaio');
const publicado = (ENSAIO && cofre.ler(CHAVE_ENSAIO)) || lerBloco('conteudo');
const hashPublicado = hash(JSON.stringify(publicado));
const app = document.getElementById('app');
const SO_TEXTO = (() => {
  try { document.createElement('div').contentEditable = 'plaintext-only'; return true; } catch { return false; }
})();

const estado = {
  rascunho: null, alteracoes: 0, editando: false, podeEditar: false,
  publicando: false, confirmando: null, formulario: null, mensagem: '',
};
const tocados = new Set();
// Aulas vistas e a última aberta: ficam só no navegador do aluno.
let progresso = lerProgresso(cofre.texto(CHAVE_PROGRESSO));
let busca = { conteudo: null, indice: [] };
let armazenamento = null;

const atual = () => estado.rascunho ?? publicado;
const contexto = () => ({
  ...estado, hoje: hojeISO(), ambiente: config.ambiente, midia: config.midia ?? {},
  progresso, siteUrl: config.siteUrl, zips: config.zips ?? {}, previas: config.previas ?? {},
});
const fragmento = (html) => document.createRange().createContextualFragment(html);

// ---------- desenho ----------

function desenhar({ foco } = {}) {
  fecharLeitor();
  const rota = interpretarRota(location.hash);
  if (rota.nome === 'aula' && !estado.editando && progresso.ultima !== rota.id) guardarProgresso(registrarUltima(progresso, rota.id));
  app.innerHTML = renderizar(atual(), rota, contexto());
  // O título da aba acompanha a tela, para o histórico e para leitores de tela.
  const titulo = app.querySelector('h1')?.textContent.trim();
  document.title = titulo && location.hash && location.hash !== '#inicio' ? `${titulo} · ${config.titulo}` : config.titulo;
  if (!SO_TEXTO) for (const el of app.querySelectorAll('.ed')) el.contentEditable = 'true';
  iniciarMorros(app.querySelector('.abertura-arte'));
  desenharQRs();
  const leitor = app.querySelector('.leitor[data-pdf]');
  if (leitor) abrirLeitor(leitor, enderecoDoPdf(leitor.dataset.pdf));
  // O iPhone não deixa pôr um trecho da página em tela cheia: lá o botão nem aparece.
  if (document.fullscreenEnabled) for (const b of app.querySelectorAll('[data-op="tela-cheia"]')) b.hidden = false;
  if (foco) app.querySelector(foco)?.focus();
}

function navegar() {
  Object.assign(estado, { confirmando: null, formulario: null, mensagem: '' });
  // Troca imediata, sem animação: uma transição entre telas chegou a travar no meio em aba sem foco.
  desenhar();
  // Vindo de uma aula ("Para praticar"), o Laboratório abre já no material.
  const rota = interpretarRota(location.hash);
  const item = rota.nome === 'laboratorio' && rota.id ? document.getElementById(`item-${rota.id}`) : null;
  if (item) {
    item.scrollIntoView({ block: 'center' });
    item.focus({ preventScroll: true });
    return;
  }
  scrollTo(0, 0);
  document.getElementById('conteudo-principal')?.focus({ preventScroll: true });
}

function guardarProgresso(novo) {
  progresso = novo;
  cofre.gravar(CHAVE_PROGRESSO, progresso);
}

function desenharQRs() {
  for (const el of app.querySelectorAll('.qr[data-qr]')) {
    const q = qrcode(0, 'M');
    q.addData(el.dataset.qr);
    q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
  }
}

// No site dos alunos os PDFs estão na mesma casa: o leitor os busca pelo caminho, sem depender de outro endereço.
function enderecoDoPdf(url) {
  return config.arquivosLocais && config.siteUrl && url.startsWith(config.siteUrl) ? url.slice(config.siteUrl.length) : url;
}

// Resultado da busca: só a área de resultados muda, para o campo não perder o foco a cada letra.
function pesquisar(consulta) {
  const alvo = app.querySelector('#resultados');
  if (!alvo) return;
  if (busca.conteudo !== atual()) busca = { conteudo: atual(), indice: indiceDeBusca(atual()) };
  const termo = consulta.trim();
  alvo.innerHTML = termo.length >= 2 ? resultadosDaBusca(buscar(busca.indice, termo), termo) : '';
}

// Marcar a aula como vista sem redesenhar: o vídeo que está tocando continua.
function marcarVista(botao) {
  guardarProgresso(alternarVista(progresso, botao.dataset.aula, hojeISO()));
  const visto = Boolean(progresso.vistas[botao.dataset.aula]);
  botao.classList.toggle('feita', visto);
  botao.setAttribute('aria-pressed', String(visto));
  botao.textContent = visto ? '✓ Aula vista' : 'Marcar como vista';
}

function trocarMaterial(aba) {
  for (const outra of aba.closest('.abas').querySelectorAll('.aba')) outra.setAttribute('aria-selected', String(outra === aba));
  const area = aba.closest('.estudo-material');
  const leitor = area.querySelector('.leitor');
  leitor.dataset.pdf = aba.dataset.pdf;
  area.querySelector('[data-leitor-link]').href = aba.dataset.pdf;
  abrirLeitor(leitor, enderecoDoPdf(aba.dataset.pdf));
}

// Prévia de um material do Laboratório numa janela por cima da página.
function abrirPrevia(id) {
  const it = atual().laboratorio.flatMap((g) => g.itens).find((x) => x.id === id);
  if (!it) return;
  const janela = document.createElement('dialog');
  janela.className = 'previa';
  janela.setAttribute('aria-labelledby', 'previa-titulo');
  janela.innerHTML = previaDoLaboratorio(it, contexto());
  // Dentro do #app, para os botões da janela (tocar o vídeo, fechar) usarem os mesmos eventos da página.
  app.append(janela);
  janela.addEventListener('close', () => {
    fecharLeitor();
    janela.remove();
  });
  // Clique no fundo escuro, fora da janela, fecha.
  janela.addEventListener('click', (e) => { if (e.target === janela) janela.close(); });
  janela.showModal();
  const leitor = janela.querySelector('.leitor[data-pdf]');
  if (leitor) abrirLeitor(leitor, enderecoDoPdf(leitor.dataset.pdf));
}

// ---------- edição ----------

function mudar(op, opcoes = {}) {
  estado.rascunho = aplicar(atual(), op);
  const chave = op.op === 'gravar' ? op.caminho : null;
  if (!chave || !tocados.has(chave)) estado.alteracoes += 1;
  if (chave) tocados.add(chave); else tocados.clear();
  cofre.gravar(CHAVE_RASCUNHO, { base: hashPublicado, conteudo: estado.rascunho, alteracoes: estado.alteracoes });
  if (opcoes.semDesenho) app.querySelector('.barra')?.replaceWith(fragmento(barraEdicao(contexto())));
  else desenhar(opcoes);
}

function descartar() {
  Object.assign(estado, { rascunho: null, alteracoes: 0, editando: false, confirmando: null, formulario: null, mensagem: '' });
  tocados.clear();
  cofre.limpar(CHAVE_RASCUNHO);
  desenhar();
}

async function comUmaRepeticao(fn) {
  try {
    return await fn();
  } catch (erro) {
    if (NAO_REPETIR.has(erro?.code)) throw erro;
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500));
    return fn();
  }
}

async function publicar() {
  const erros = validarConteudo(estado.rascunho);
  if (erros.length) {
    estado.mensagem = `Não dá para publicar ainda: ${erros[0]}.`;
    return desenhar();
  }
  Object.assign(estado, { publicando: true, mensagem: '', confirmando: null });
  desenhar();
  const reset = document.head.querySelector('style')?.textContent || RESET_PADRAO;
  const html = documentoCompleto(
    { titulo: config.titulo, fontes: config.fontes, css: fonte.css, js: fonte.js, conteudo: estado.rascunho, config },
    reset,
  );
  try {
    await comUmaRepeticao(() => armazenamento.publicar(html));
    // Depois de publicar, a página recarrega sozinha na versão nova. Este aviso só aparece se isso não acontecer.
    setTimeout(() => {
      Object.assign(estado, { publicando: false, mensagem: 'Publicado. Recarregue a página para ver a versão nova.' });
      desenhar();
    }, 8000);
  } catch (erro) {
    if (SEM_ESCRITA.has(erro?.code)) Object.assign(estado, { podeEditar: false, editando: false });
    Object.assign(estado, { publicando: false, mensagem: mensagemDePublicacao(erro?.code) });
    desenhar();
  }
}

function publicarEnsaio(html) {
  if (!html.startsWith('<!doctype html>')) throw { code: 'invalid_content' };
  cofre.gravar(CHAVE_ENSAIO, estado.rascunho);
  location.reload();
}

// ---------- formulário de material ----------

function abrirFormulario(lista) {
  estado.formulario = {
    lista, tipo: 'slides', url: '', nome: TIPOS.slides.nome, arquivo: '', erro: '',
    enviando: false, podeEnviar: armazenamento.podeEnviar,
  };
  desenhar({ foco: '#mat-url' });
}

function trocarTipo(f, tipo, foco) {
  const nomeAntigo = TIPOS[f.tipo].nome;
  f.tipo = tipo;
  if (!f.nome.trim() || f.nome === nomeAntigo) f.nome = TIPOS[tipo].nome;
  desenhar({ foco });
}

async function enviarArquivo(arquivo) {
  const f = estado.formulario;
  if (arquivo.size > LIMITE_ARQUIVO) {
    f.erro = mensagemDeEnvio('too_large');
    return desenhar();
  }
  Object.assign(f, { enviando: true, erro: '' });
  desenhar();
  try {
    f.url = await armazenamento.enviarArquivo(arquivo);
    f.arquivo = arquivo.name;
  } catch (erro) {
    f.erro = mensagemDeEnvio(erro?.code);
  }
  f.enviando = false;
  if (estado.formulario === f) desenhar({ foco: '#mat-nome' });
}

function concluirFormulario() {
  const f = estado.formulario;
  const url = f.url.trim();
  const nome = f.nome.trim();
  if (!f.arquivo && !urlValida(url)) {
    f.erro = 'Informe o endereço completo, começando com https://';
    return desenhar({ foco: '#mat-url' });
  }
  if (!nome) {
    f.erro = 'Dê um nome ao material.';
    return desenhar({ foco: '#mat-nome' });
  }
  estado.formulario = null;
  mudar({ op: 'adicionar', lista: f.lista, item: { id: novoId('ma'), tipo: f.tipo, nome, url, adicionadoEm: hojeISO() } });
}

// ---------- ações avulsas ----------

function tocar(botao) {
  const quadro = document.createElement('iframe');
  quadro.className = 'player';
  quadro.src = `https://www.youtube-nocookie.com/embed/${botao.dataset.yt}?autoplay=1&rel=0`;
  quadro.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  quadro.title = botao.getAttribute('aria-label');
  botao.replaceWith(quadro);
  // No modo de estudo, o vídeo que está tocando acompanha a leitura no celular.
  quadro.closest('.estudo')?.classList.add('tocando');
}

async function copiar(botao) {
  try {
    await navigator.clipboard.writeText(botao.dataset.texto);
    botao.textContent = 'Copiado';
  } catch {
    // Sem acesso à área de transferência: seleciona o texto para o aluno copiar à mão.
    const alvo = document.getElementById('email');
    if (!alvo) {
      botao.replaceWith(Object.assign(document.createElement('span'), { className: 'copiar-manual', textContent: botao.dataset.texto }));
      return;
    }
    const faixa = document.createRange();
    faixa.selectNodeContents(alvo);
    const selecao = getSelection();
    selecao.removeAllRanges();
    selecao.addRange(faixa);
    botao.textContent = 'Selecionado';
  }
}

// ---------- eventos ----------

function aoClicar(e) {
  // Caixas do índice de módulos: rolam até o módulo, sem mudar o endereço.
  const salto = e.target.closest('[data-ir]');
  if (salto) {
    const alvo = document.getElementById(salto.dataset.ir);
    alvo?.scrollIntoView({ block: 'start' });
    alvo?.focus({ preventScroll: true });
    return;
  }
  const b = e.target.closest('[data-op]');
  if (!b) return;
  const { op, lista, novo } = b.dataset;
  const i = Number(b.dataset.i);
  switch (op) {
    case 'editar': Object.assign(estado, { editando: true, mensagem: '' }); return desenhar();
    case 'descartar':
      if (estado.alteracoes === 0) return descartar();
      estado.confirmando = 'descartar';
      return desenhar();
    case 'descartar-sim': return descartar();
    case 'publicar': return publicar();
    case 'subir': return mudar({ op: 'subir', lista, i });
    case 'descer': return mudar({ op: 'descer', lista, i });
    case 'remover': estado.confirmando = `${lista}.${i}`; return desenhar();
    case 'remover-nao': estado.confirmando = null; return desenhar();
    case 'remover-sim': estado.confirmando = null; return mudar({ op: 'remover', lista, i });
    case 'adicionar': {
      const posicao = ler(atual(), lista).length;
      return mudar({ op: 'adicionar', lista, item: novoItem(novo, hojeISO()) }, { foco: `[data-campo^="${lista}.${posicao}."]` });
    }
    case 'novo-material': return abrirFormulario(lista);
    case 'cancelar-material': estado.formulario = null; return desenhar();
    case 'copiar': return copiar(b);
    case 'tocar': return tocar(b);
    case 'vista': return marcarVista(b);
    case 'ler': return trocarMaterial(b);
    case 'previa': return abrirPrevia(b.dataset.item);
    case 'fechar-previa': return b.closest('dialog')?.close();
    case 'tela-cheia': return b.closest('.estudo-material')?.querySelector('.leitor')?.requestFullscreen();
    default: return undefined;
  }
}

function aoDigitar(e) {
  const el = e.target;
  if (el.id === 'busca') return pesquisar(el.value);
  if (el.matches('.ed[data-campo]')) {
    const bruto = el.textContent.replace(/\u00a0/g, ' ');
    const valor = el.classList.contains('ed-bloco') ? bruto : bruto.replace(/\s*\n\s*/g, ' ');
    mudar({ op: 'gravar', caminho: el.dataset.campo, valor }, { semDesenho: true });
  } else if (estado.formulario && el.form?.id === 'form-material' && (el.name === 'url' || el.name === 'nome')) {
    estado.formulario[el.name] = el.value;
    // Quem está corrigindo o campo não precisa continuar vendo o erro antigo. Sem redesenhar, para não perder o cursor.
    if (estado.formulario.erro) {
      estado.formulario.erro = '';
      app.querySelector('#form-material .erro')?.remove();
    }
  }
}

function aoMudar(e) {
  const el = e.target;
  if (el.matches('input[data-campo], select[data-campo]')) {
    return mudar({ op: 'gravar', caminho: el.dataset.campo, valor: el.value });
  }
  if (el.matches('select[data-relacionar]') && el.value) {
    return mudar({ op: 'adicionar', lista: el.dataset.relacionar, item: el.value });
  }
  const f = estado.formulario;
  if (!f || el.form?.id !== 'form-material') return undefined;
  if (el.name === 'tipo') return trocarTipo(f, el.value, `#tipo-${el.value}`);
  if (el.name === 'url' && idDoYoutube(f.url) && f.tipo !== 'video') return trocarTipo(f, 'video', '#mat-nome');
  if (el.name === 'arquivo' && el.files[0]) return enviarArquivo(el.files[0]);
  return undefined;
}

function aoEnviar(e) {
  e.preventDefault();
  if (estado.formulario) concluirFormulario();
}

function aoTeclar(e) {
  if (e.key === 'Enter' && e.target.matches?.('.ed:not(.ed-bloco)')) {
    e.preventDefault();
    e.target.blur();
  } else if (e.key === 'Escape' && estado.formulario) {
    estado.formulario = null;
    desenhar();
  }
}

function aoColar(e) {
  if (SO_TEXTO || !e.target.closest?.('.ed')) return;
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
}

// ---------- partida ----------

async function iniciar() {
  // O esqueleto da página não declara o idioma; leitores de tela precisam dele para pronunciar certo.
  document.documentElement.lang = 'pt-BR';
  desenhar();
  armazenamento = ENSAIO ? armazenamentoDeEnsaio(publicarEnsaio) : await criarArmazenamento(config.ambiente);
  estado.podeEditar = await armazenamento.podeEditar();
  if (!estado.podeEditar) return;
  const salvo = cofre.ler(CHAVE_RASCUNHO);
  const decisao = decidirRascunho(salvo, hashPublicado);
  if (decisao === 'publicado') {
    cofre.limpar(CHAVE_RASCUNHO);
    estado.mensagem = 'Publicado.';
  } else if (decisao !== 'nenhum') {
    Object.assign(estado, { rascunho: salvo.conteudo, alteracoes: salvo.alteracoes || 1, editando: true });
    estado.mensagem = decisao === 'restaurar'
      ? 'Suas alterações não publicadas foram restauradas.'
      : 'Rascunho restaurado. O site mudou desde então: publicar substitui a versão atual.';
  }
  desenhar();
}

app.addEventListener('click', aoClicar);
app.addEventListener('input', aoDigitar);
app.addEventListener('change', aoMudar);
app.addEventListener('submit', aoEnviar);
app.addEventListener('keydown', aoTeclar);
app.addEventListener('paste', aoColar);
addEventListener('hashchange', navegar);
iniciar();
