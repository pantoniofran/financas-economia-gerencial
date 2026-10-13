import { renderizar, interpretarRota, barraEdicao } from '../nucleo/telas.js';
import { TIPOS, hojeISO, validarConteudo } from '../nucleo/conteudo.js';
import { aplicar, novoItem } from '../nucleo/edicao.js';
import { ler } from '../nucleo/caminhos.js';
import { novoId } from '../nucleo/listas.js';
import { idDoYoutube, urlValida } from '../nucleo/youtube.js';
import { documentoCompleto, RESET_PADRAO } from '../nucleo/documento.js';
import { hash, decidirRascunho } from '../nucleo/rascunho.js';
import { SEM_ESCRITA, NAO_REPETIR, mensagemDePublicacao, mensagemDeEnvio } from '../nucleo/mensagens.js';
import { criarArmazenamento, armazenamentoDeEnsaio } from './armazenamento.js';

const CHAVE_RASCUNHO = 'rascunho-v1';
const CHAVE_ENSAIO = 'publicado-ensaio';
const LIMITE_ARQUIVO = 20 * 1024 * 1024;

// O armazenamento do navegador pode falhar (janela privada, bloqueio): o site segue sem rascunho.
const cofre = {
  ler(chave) { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue */ } },
  limpar(chave) { try { localStorage.removeItem(chave); } catch { /* segue */ } },
};

const lerBloco = (id) => JSON.parse(document.getElementById(id).textContent);
const config = lerBloco('config');
// Código-fonte canônico da página, usado para regenerar o documento ao publicar.
const fonte = {
  css: document.getElementById('estilo').textContent,
  js: document.getElementById('programa').textContent,
};
const ENSAIO = config.ambiente === 'local' && new URLSearchParams(location.search).has('ensaio');
const publicado = (ENSAIO && cofre.ler(CHAVE_ENSAIO)) || lerBloco('conteudo');
const hashPublicado = hash(JSON.stringify(publicado));
const app = document.getElementById('app');
const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)');
const SO_TEXTO = (() => {
  try { document.createElement('div').contentEditable = 'plaintext-only'; return true; } catch { return false; }
})();

const estado = {
  rascunho: null, alteracoes: 0, editando: false, podeEditar: false,
  publicando: false, confirmando: null, formulario: null, mensagem: '',
};
const tocados = new Set();
let armazenamento = null;

const atual = () => estado.rascunho ?? publicado;
const contexto = () => ({ ...estado, hoje: hojeISO(), ambiente: config.ambiente, midia: config.midia ?? {} });
const fragmento = (html) => document.createRange().createContextualFragment(html);

// ---------- desenho ----------

function desenhar({ foco } = {}) {
  app.innerHTML = renderizar(atual(), interpretarRota(location.hash), contexto());
  if (!SO_TEXTO) for (const el of app.querySelectorAll('.ed')) el.contentEditable = 'true';
  iniciarVideo();
  if (foco) app.querySelector(foco)?.focus();
}

function navegar() {
  Object.assign(estado, { confirmando: null, formulario: null, mensagem: '' });
  // Troca imediata, sem animação: uma transição entre telas chegou a travar no meio em aba sem foco.
  desenhar();
  scrollTo(0, 0);
  document.getElementById('conteudo-principal')?.focus({ preventScroll: true });
}

function iniciarVideo() {
  const video = app.querySelector('video[data-src]');
  if (!video || movimentoReduzido.matches) return;
  const carregar = () => {
    // A classe vai no contêiner: o vídeo aparece e a imagem de espera some, senão as duas linhas se sobrepõem.
    video.addEventListener('playing', () => video.parentElement.classList.add('tocando'), { once: true });
    video.src = video.dataset.src;
    video.play().catch(() => { /* reprodução automática recusada: fica a imagem */ });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(carregar, { timeout: 2000 });
  else setTimeout(carregar, 600);
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
  mudar({ op: 'adicionar', lista: f.lista, item: { id: novoId('ma'), tipo: f.tipo, nome, url } });
}

// ---------- ações avulsas ----------

function tocar(botao) {
  const quadro = document.createElement('iframe');
  quadro.className = 'player';
  quadro.src = `https://www.youtube-nocookie.com/embed/${botao.dataset.yt}?autoplay=1&rel=0`;
  quadro.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  quadro.allowFullscreen = true;
  quadro.title = botao.getAttribute('aria-label');
  botao.replaceWith(quadro);
}

async function copiar(botao) {
  try {
    await navigator.clipboard.writeText(botao.dataset.texto);
    botao.textContent = 'Copiado';
  } catch {
    const faixa = document.createRange();
    faixa.selectNodeContents(document.getElementById('email'));
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
    default: return undefined;
  }
}

function aoDigitar(e) {
  const el = e.target;
  if (el.matches('.ed[data-campo]')) {
    const bruto = el.textContent.replace(/\u00a0/g, ' ');
    const valor = el.classList.contains('ed-bloco') ? bruto : bruto.replace(/\s*\n\s*/g, ' ');
    mudar({ op: 'gravar', caminho: el.dataset.campo, valor }, { semDesenho: true });
  } else if (estado.formulario && el.form?.id === 'form-material' && (el.name === 'url' || el.name === 'nome')) {
    estado.formulario[el.name] = el.value;
  }
}

function aoMudar(e) {
  const el = e.target;
  if (el.matches('input[data-campo], select[data-campo]')) {
    return mudar({ op: 'gravar', caminho: el.dataset.campo, valor: el.value });
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
