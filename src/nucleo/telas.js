import { TIPOS, NIVEIS, CATEGORIAS_PUBLICACAO, avisosValidos, avisosRecentes, acharAula, videoPrincipal } from './conteudo.js';
import { idDoYoutube } from './youtube.js';
import { ehNovo, novidades, proximosEventos, linkAgenda, dataCurta, TIPOS_EVENTO } from './agenda.js';
import { contarVistas } from './progresso.js';
import { desenhoDaChapada } from './chapada.js';

// ---------- utilidades ----------

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function interpretarRota(hash) {
  const h = String(hash ?? '').replace(/^#/, '') || 'inicio';
  const m = /^([adtl])-(.+)$/.exec(h);
  return m ? { nome: { a: 'aula', d: 'disciplina', t: 'texto', l: 'laboratorio' }[m[1]], id: m[2] } : { nome: h };
}

const tem = (v) => Boolean(String(v ?? '').trim());

// Endereço escrito no meio do texto vira link. Roda sobre o texto já escapado, então não abre brecha para HTML.
// O endereço para em aspas e sinais já escapados (&#39; &quot; &lt; &gt;) e não leva a pontuação do fim da frase.
const comLinks = (escapado) => escapado.replace(/https?:\/\/(?:(?!&(?:#39|quot|lt|gt);)[^\s<>"'])+/g, (achado) => {
  const url = achado.replace(/[.,;:!?)]+$/, '');
  return `<a href="${url}" target="_blank" rel="noopener">${url}</a>${achado.slice(url.length)}`;
});

const paragrafos = (t) => String(t ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${comLinks(esc(p)).replace(/\n/g, '<br>')}</p>`).join('');

// Nome com barra ("Sustentáveis/Verdes") pode quebrar depois da barra, e não no meio da palavra.
const nomeQuebravel = (t) => esc(t).replace(/\//g, '/<wbr>');

// Na lista de aulas, só a primeira frase da descrição: o resto fica na página da aula.
const primeiraFrase = (t) => {
  const texto = String(t ?? '').trim().split(/\n/)[0];
  const fim = texto.search(/[.!?](\s|$)/);
  return fim > 0 ? texto.slice(0, fim + 1) : texto;
};

// Texto de uma linha: em leitura devolve o texto; em edição, um trecho editável ligado ao caminho.
function campo(caminho, valor, ctx, vazio) {
  if (!ctx.editando) return esc(valor);
  return `<span class="ed" contenteditable="plaintext-only" role="textbox" aria-label="${esc(vazio)}" data-campo="${caminho}" data-vazio="${esc(vazio)}">${esc(valor)}</span>`;
}

// Texto de vários parágrafos.
function bloco(caminho, valor, ctx, vazio) {
  if (!ctx.editando) return paragrafos(valor);
  return `<div class="ed ed-bloco" contenteditable="plaintext-only" role="textbox" aria-multiline="true" aria-label="${esc(vazio)}" data-campo="${caminho}" data-vazio="${esc(vazio)}">${esc(valor)}</div>`;
}

function ferramentas(lista, i, n, ctx, oQue, ordem = true) {
  if (!ctx.editando) return '';
  const alvo = `data-lista="${lista}" data-i="${i}"`;
  if (ctx.confirmando === `${lista}.${i}`) {
    return `<span class="tools conf">Remover? <button type="button" data-op="remover-sim" ${alvo}>Sim</button><button type="button" data-op="remover-nao">Não</button></span>`;
  }
  const setas = ordem
    ? `<button type="button" data-op="subir" ${alvo} aria-label="Subir ${esc(oQue)}"${i === 0 ? ' disabled' : ''}>↑</button>` +
      `<button type="button" data-op="descer" ${alvo} aria-label="Descer ${esc(oQue)}"${i === n - 1 ? ' disabled' : ''}>↓</button>`
    : '';
  return `<span class="tools">${setas}<button type="button" data-op="remover" ${alvo} aria-label="Remover ${esc(oQue)}">×</button></span>`;
}

const adicionar = (ctx, tipo, lista, rotulo) => (ctx.editando
  ? `<button type="button" class="add" data-op="adicionar" data-novo="${tipo}" data-lista="${lista}">+ ${rotulo}</button>`
  : '');

const novoMaterial = (ctx, lista, rotulo, classe = 'add') => (ctx.editando
  ? `<button type="button" class="${classe}" data-op="novo-material" data-lista="${lista}">+ ${rotulo}</button>`
  : '');

const rotuloDoTipo = (mat) => TIPOS[mat.tipo]?.rotulo ?? 'Material';

// No chip aparece o tipo; se o professor deu um nome próprio ao material, aparece o nome.
const rotuloDoChip = (mat) => (mat.nome === TIPOS[mat.tipo]?.nome ? rotuloDoTipo(mat) : mat.nome);

// ---------- moldura ----------

const MENU = [['inicio', 'Disciplinas'], ['laboratorio', 'Laboratório'], ['textos', 'Textos'], ['pesquisa', 'Pesquisa'], ['sobre', 'Sobre']];
// Em qual item do menu o aluno está, inclusive dentro de uma disciplina, aula ou texto.
const SECAO = { disciplina: 'inicio', aula: 'inicio', texto: 'textos' };

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const contarAulas = (d) => d.modulos.reduce((n, m) => n + m.aulas.filter((a) => tem(a.titulo)).length, 0);

// De onde vem o arquivo, para o aluno saber o que vai abrir.
function formato(mat) {
  if (idDoYoutube(mat.url)) return 'YouTube';
  const base = String(mat.url).split(/[?#]/)[0].toLowerCase();
  if (base.endsWith('.pdf')) return 'PDF';
  if (/\.xlsx?$/.test(base)) return 'Excel';
  if (base.endsWith('.ipynb')) return 'Jupyter';
  if (base.endsWith('.zip')) return 'ZIP';
  if (base.endsWith('.txt')) return 'Texto';
  if (base.includes('github.com')) return 'GitHub';
  return 'Link';
}

// Um desenho por tipo de material, para o aluno reconhecer de relance. Sempre acompanhado do nome.
const ICONES = {
  slides: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
  notas: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  video: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none"/>',
  exercicios: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  planilha: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  codigo: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};

// Selo do que o professor adicionou nos últimos 14 dias. Só para quem lê.
const seloNovo = (data, ctx) => (!ctx.editando && ehNovo(data, ctx.hoje) ? '<span class="selo-novo">Novo</span>' : '');
const vistasDe = (ctx) => ctx.progresso?.vistas ?? {};
const barraDeProgresso = (feitas, total) => `<span class="barra-progresso" aria-hidden="true"><span style="width:${Math.round((feitas / total) * 100)}%"></span></span>`;
const icone = (tipo) => `<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${ICONES[tipo] ?? ICONES.link}</svg>`;

// Caixa de material: o que é e de onde vem, com a área inteira clicável.
// O tipo só aparece quando o nome não o diz: "Slides da aula" já basta, "Sorvete" precisa de "Planilha".
function caixaDoMaterial(mat, ctx) {
  const info = mat.nome === TIPOS[mat.tipo]?.nome ? formato(mat) : `${esc(rotuloDoTipo(mat))} · ${formato(mat)}`;
  return `<li><a class="caixa caixa-material" href="${esc(mat.url)}"${atributosDoLink(mat.url)}>${icone(mat.tipo)}<span class="caixa-info">${info}${seloNovo(mat.adicionadoEm, ctx)}</span><span class="caixa-titulo">${esc(mat.nome)}</span><span class="caixa-acao">${acaoDoLink(mat.url)}</span></a></li>`;
}

// Arquivo de usar no computador (planilha, notebook, script) é baixado; o navegador mostraria um notebook como texto cru.
const ehDownload = (url) => /\.(ipynb|xlsx?|zip|txt|r|py)$/i.test(String(url).split(/[?#]/)[0]);
const atributosDoLink = (url) => `${ehDownload(url) ? ' download' : ''} target="_blank" rel="noopener"`;
const acaoDoLink = (url) => (ehDownload(url) ? 'Baixar ↓' : 'Abrir ↗<span class="sr"> em nova aba</span>');

// Resultado da busca: desenhado à parte, para a página não perder o foco do campo a cada letra.
const ROTULO_DA_BUSCA = { disciplina: 'Disciplina', modulo: 'Módulo', aula: 'Aula', material: 'Material', texto: 'Texto' };
export function resultadosDaBusca(lista, consulta) {
  if (!String(consulta ?? '').trim()) return '';
  if (!lista.length) {
    return `<section class="resultados"><h2 class="secao">Busca</h2><p class="suave">Nada encontrado para "${esc(consulta)}". Tente outra palavra, como o nome da aula ou da disciplina.</p></section>`;
  }
  const item = (r) => `<li><a class="caixa" href="${esc(r.rota ?? r.url)}"${r.url ? ' target="_blank" rel="noopener"' : ''}><span class="caixa-info">${ROTULO_DA_BUSCA[r.tipo]} · ${esc(r.contexto)}</span><span class="caixa-titulo">${esc(r.titulo)}</span></a></li>`;
  return `<section class="resultados"><h2 class="secao">Busca <small>${plural(lista.length, 'resultado', 'resultados')}</small></h2><ul class="caixas compactas">${lista.map(item).join('')}</ul></section>`;
}

function cabecalho(c, rota) {
  const atual = SECAO[rota.nome] ?? rota.nome;
  const itens = MENU.map(([r, nome]) => `<a href="#${r}"${atual === r ? ' aria-current="page"' : ''}>${nome}</a>`).join('');
  return `<header class="topo"><a class="marca" href="#inicio">${esc(c.site.titulo)}</a><nav aria-label="Seções">${itens}</nav></header>`;
}

const rodape = (c, ctx) => `<footer class="rodape"><span>${esc(c.site.professor)} · ${esc(c.site.instituicao)}</span><span class="rodape-links">${ctx.siteUrl ? '<a href="#qr">QR codes para a sala</a>' : ''}<a href="#sobre">Contato</a></span></footer>`;

export function barraEdicao(ctx) {
  if (!ctx.podeEditar) return '';
  if (!ctx.editando) return '<button type="button" class="btn-editar" data-op="editar">Editar</button>';
  const n = ctx.alteracoes;
  const estado = n === 0 ? 'Editando' : `Editando · ${n} ${n === 1 ? 'alteração' : 'alterações'}`;
  if (ctx.confirmando === 'descartar') {
    return `<div class="barra" role="region" aria-label="Edição"><span>Descartar todas as alterações?</span><span class="grupo"><button type="button" data-op="descartar-sim">Sim, descartar</button><button type="button" class="pri" data-op="remover-nao">Não</button></span></div>`;
  }
  const parado = n === 0 || ctx.publicando;
  return `<div class="barra" role="region" aria-label="Edição"><span>${estado}</span><span class="grupo"><button type="button" data-op="descartar">${n === 0 ? 'Sair' : 'Descartar'}</button><button type="button" class="pri" data-op="publicar"${parado ? ' disabled' : ''}>${ctx.publicando ? 'Publicando…' : 'Publicar'}</button></span></div>`;
}

const tela404 = () => '<div class="col"><h1>Página não encontrada</h1><p>O endereço pode ter mudado. <a href="#inicio">Ver as disciplinas</a></p></div>';

// ---------- início ----------

// Faixa de abertura: quem é, o que tem no site e, ao fundo, as curvas em movimento.
function abertura(c, ctx) {
  // Ao fundo, os morros da Chapada Diamantina, desenhados na tela traço a traço.
  const arte = `<div class="abertura-arte">${desenhoDaChapada()}</div>`;
  const aulas = c.disciplinas.reduce((n, d) => n + contarAulas(d), 0);
  const materiais = c.disciplinas.reduce((n, d) => n + d.modulos.reduce((k, mo) => k + mo.aulas.reduce((j, a) => j + a.materiais.length, 0), 0), 0);
  const resumo = [plural(c.disciplinas.length, 'disciplina', 'disciplinas'), plural(aulas, 'aula', 'aulas'), plural(materiais, 'material', 'materiais')].join(' · ');
  return `<div class="abertura">${arte}<div class="abertura-texto">
<p class="eye">${esc(c.site.professor)} · ${esc(c.site.instituicao)}</p>
<h1>${campo('site.chamada', c.site.chamada, ctx, 'Frase de abertura')}</h1>
<p class="abertura-resumo">${resumo}</p>
${ctx.editando ? '' : `<form class="busca" role="search" action="#" novalidate><label class="sr" for="busca">Buscar no site</label><input id="busca" name="busca" type="search" placeholder="Buscar aula, material ou texto" autocomplete="off" enterkeyhint="search"></form>`}
</div></div>`;
}

function telaInicio(c, ctx) {
  const recentes = avisosRecentes(c, ctx.hoje);
  const caixaDaDisciplina = (d) => {
    const capa = ctx.midia[`capa-${d.id}`];
    const nAvisos = avisosValidos(d.avisos, ctx.hoje).length;
    const info = d.modulos.length ? `${plural(d.modulos.length, 'módulo', 'módulos')} · ${plural(contarAulas(d), 'aula', 'aulas')}` : '';
    const { vistas, total } = contarVistas(d, vistasDe(ctx));
    const progresso = vistas ? `<span class="caixa-progresso">${barraDeProgresso(vistas, total)}<span>${vistas} de ${total} vistas</span></span>` : '';
    return `<li><a class="caixa${capa ? ' com-arte' : ''}" href="#d-${d.id}">${capa ? `<img src="${esc(capa)}" alt="" loading="lazy" width="1280" height="720">` : ''}<span class="caixa-corpo"><span class="caixa-titulo">${nomeQuebravel(d.nome)}</span>${info ? `<span class="caixa-info">${info}</span>` : ''}${progresso}${nAvisos ? `<span class="caixa-destaque">${plural(nAvisos, 'aviso', 'avisos')}</span>` : ''}<span class="caixa-acao">Ver aulas ›</span></span></a></li>`;
  };
  // Última aula aberta neste aparelho.
  const ultima = !ctx.editando && ctx.progresso?.ultima ? acharAula(c, ctx.progresso.ultima) : null;
  const continuar = ultima
    ? `<section><a class="caixa caixa-continuar" href="#a-${ultima.aula.id}"><span class="caixa-info">Continuar de onde parei · ${esc(ultima.disciplina.nome)}</span><span class="caixa-titulo">${esc(ultima.aula.titulo)}</span><span class="caixa-acao">Abrir a aula ›</span></a></section>`
    : '';
  // O que o professor adicionou nos últimos 14 dias.
  const novas = ctx.editando ? [] : novidades(c, ctx.hoje).slice(0, 6);
  const novidade = (n) => {
    const destino = n.tipo === 'texto' ? `#t-${n.texto.id}` : `#a-${n.aula.id}`;
    const rotulo = { aula: 'Aula nova', material: 'Material novo', texto: 'Texto novo' }[n.tipo];
    const onde = n.tipo === 'texto' ? 'Textos' : `${esc(n.disciplina.nome)} · ${esc(n.aula.titulo)}`;
    return `<li><a class="caixa" href="${destino}"><span class="caixa-info"><span class="selo-novo">${rotulo}</span> ${dataBR(n.data)}</span><span class="caixa-titulo">${esc(n.titulo)}</span><span class="caixa-info">${n.tipo === 'aula' ? esc(n.disciplina.nome) : onde}</span></a></li>`;
  };
  const secaoNovidades = novas.length ? `<section><h2 class="secao">Novidades</h2><ul class="caixas compactas">${novas.map(novidade).join('')}</ul></section>` : '';
  const nivel = (chave) => {
    const lista = c.disciplinas.filter((d) => d.nivel === chave);
    if (!lista.length) return '';
    return `<section><h2 class="secao">${NIVEIS[chave]} <small>${plural(lista.length, 'disciplina', 'disciplinas')}</small></h2><ul class="caixas">${lista.map(caixaDaDisciplina).join('')}</ul></section>`;
  };
  const nLab = c.laboratorio.reduce((n, g) => n + g.itens.length, 0);
  const nTextos = c.textos.filter((t) => tem(t.titulo)).length;
  const atalhos = [
    ['laboratorio', 'Laboratório', `${plural(nLab, 'material', 'materiais')}: planilhas, código e vídeos`],
    ['textos', 'Textos', plural(nTextos, 'texto do professor', 'textos do professor')],
    ['pesquisa', 'Pesquisa', `${plural(c.pesquisa.projetos.length, 'projeto', 'projetos')} · ${plural(c.pesquisa.publicacoes.length, 'publicação', 'publicações')}`],
    ['sobre', 'Sobre o professor', 'Formação, orientações e contato'],
  ];
  return `${abertura(c, ctx)}<div class="col larga">
<div id="resultados" aria-live="polite"></div>
${continuar}
${recentes.length ? `<section><h2 class="secao">Avisos</h2><ul class="caixas">${recentes.map(({ disciplina, aviso }) => `<li><a class="caixa caixa-aviso" href="#d-${disciplina.id}"><span class="caixa-info">${esc(disciplina.nome)}</span><span class="caixa-titulo">${esc(aviso.texto)}</span></a></li>`).join('')}</ul></section>` : ''}
${secaoNovidades}
${nivel('graduacao')}${nivel('pos')}
<section><h2 class="secao">Mais no site</h2><ul class="caixas compactas">${atalhos.map(([r, nome, info]) => `<li><a class="caixa" href="#${r}"><span class="caixa-titulo">${nome}</span><span class="caixa-info">${info}</span></a></li>`).join('')}</ul></section>
</div>`;
}

// ---------- disciplina ----------

function avisos(d, base, ctx) {
  const visiveis = d.avisos.map((a, k) => ({ a, k }))
    .filter(({ a }) => ctx.editando || avisosValidos([a], ctx.hoje).length);
  if (!visiveis.length && !ctx.editando) return '';
  // O texto vem antes da data: ao criar um aviso, o foco cai no primeiro campo, que deve ser o texto.
  const um = ({ a, k }) => `<div class="aviso"><div><b>Aviso</b><p>${campo(`${base}.avisos.${k}.texto`, a.texto, ctx, 'Texto do aviso')}</p>${ctx.editando ? `<label class="ate">Mostrar até <input type="date" id="ate-${a.id}" data-campo="${base}.avisos.${k}.ate" value="${esc(a.ate)}"></label>` : ''}</div>${ferramentas(`${base}.avisos`, k, d.avisos.length, ctx, 'aviso')}</div>`;
  return `<section class="avisos" aria-label="Avisos">${visiveis.map(um).join('')}${adicionar(ctx, 'aviso', `${base}.avisos`, 'Novo aviso')}</section>`;
}

const FICHA = [['ementa', 'Ementa'], ['objetivos', 'Objetivos'], ['avaliacao', 'Avaliação'], ['bibliografia', 'Bibliografia']];

function ficha(d, base, ctx) {
  const itens = FICHA.filter(([k]) => ctx.editando || tem(d.ficha[k]));
  if (!itens.length) return '';
  return `<section class="ficha" aria-label="Ficha da disciplina">${itens.map(([k, rotulo]) => `<details${ctx.editando ? ' open' : ''}><summary>${rotulo}</summary><div class="ficha-corpo">${bloco(`${base}.ficha.${k}`, d.ficha[k], ctx, `${rotulo}: escreva aqui`)}</div></details>`).join('')}</section>`;
}

function chip(mat, lista, k, ctx) {
  if (!ctx.editando) {
    return `<a class="chip" href="${esc(mat.url)}" target="_blank" rel="noopener" title="${esc(mat.nome)}">${icone(mat.tipo)}${esc(rotuloDoChip(mat))}${seloNovo(mat.adicionadoEm, ctx)}<span class="sr"> (${esc(mat.nome)}, abre em nova aba)</span></a>`;
  }
  const alvo = `data-lista="${lista}" data-i="${k}"`;
  if (ctx.confirmando === `${lista}.${k}`) {
    return `<span class="chip">Remover? <button type="button" data-op="remover-sim" ${alvo}>Sim</button><button type="button" data-op="remover-nao">Não</button></span>`;
  }
  return `<span class="chip">${esc(rotuloDoChip(mat))}<button type="button" data-op="remover" ${alvo} aria-label="Remover ${esc(mat.nome)}">×</button></span>`;
}

function linhaDaAula(a, ia, m, bm, ctx) {
  const ba = `${bm}.aulas.${ia}`;
  const titulo = ctx.editando
    ? `${campo(`${ba}.titulo`, a.titulo, ctx, 'Título da aula')}<a class="abrir" href="#a-${a.id}">abrir</a>`
    : `<a href="#a-${a.id}">${esc(a.titulo)}</a>`;
  const vista = !ctx.editando && vistasDe(ctx)[a.id] ? '<span class="vista">✓ vista</span>' : '';
  return `<li class="aula${vista ? ' aula-vista' : ''}"><div><small>Aula ${ia + 1}${vista}${seloNovo(a.adicionadoEm, ctx)}</small><div class="aula-titulo">${titulo}</div>${ctx.editando ? '' : (tem(a.descricao) ? `<p class="aula-resumo">${esc(primeiraFrase(a.descricao))}</p>` : '')}<div class="mats">${a.materiais.map((mat, k) => chip(mat, `${ba}.materiais`, k, ctx)).join('')}${novoMaterial(ctx, `${ba}.materiais`, 'material', 'chip novo')}</div></div>${ferramentas(`${bm}.aulas`, ia, m.aulas.length, ctx, 'aula')}</li>`;
}

function modulo(m, im, d, base, ctx) {
  const bm = `${base}.modulos.${im}`;
  const aulas = m.aulas.map((a, ia) => ({ a, ia })).filter(({ a }) => ctx.editando || tem(a.titulo));
  return `<section class="modulo" id="m-${m.id}" tabindex="-1"><div class="linha-titulo"><h2><span class="num" aria-hidden="true">${im + 1}</span><span class="sr">Módulo ${im + 1}: </span>${campo(`${bm}.titulo`, m.titulo, ctx, 'Título do módulo')}</h2>${ferramentas(`${base}.modulos`, im, d.modulos.length, ctx, 'módulo')}</div>${ctx.editando ? `<div class="prosa modulo-descricao">${bloco(`${bm}.descricao`, m.descricao, ctx, 'O que o aluno vai ver neste módulo')}</div>` : (tem(m.descricao) ? `<div class="prosa modulo-descricao">${paragrafos(m.descricao)}</div>` : '')}<ol class="aulas">${aulas.map(({ a, ia }) => linhaDaAula(a, ia, m, bm, ctx)).join('')}</ol>${adicionar(ctx, 'aula', `${bm}.aulas`, 'Nova aula')}${baixarModulo(m, ctx)}</section>`;
}

// Zip com os arquivos do módulo, gerado na publicação do site dos alunos.
function baixarModulo(m, ctx) {
  const zip = ctx.zips?.[m.id];
  if (ctx.editando || !zip) return '';
  return `<a class="baixar" href="${esc(zip.url)}">${icone('baixar')}Baixar os materiais do módulo <small>ZIP · ${zip.tamanho}</small></a>`;
}

// Botão de dúvida. Se o professor deu um endereço da web (grupo, formulário), abre em nova aba.
// Senão a mensagem vai para o e-mail dele, com a disciplina (e a aula) no assunto, para ele saber de onde vem a pergunta.
// Um link mailto sozinho não basta: quem usa Gmail ou Outlook no navegador não tem programa de e-mail, e o clique
// não faz nada. Por isso o aluno escolhe onde escrever, e ainda pode copiar endereço e assunto.
const ehEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export function botaoDeDuvida(c, d, ctx, { aula = null, rotulo, classe }) {
  const v = String(d.duvidas ?? '').trim();
  if (/^https?:\/\//.test(v)) return `<a class="${classe}" href="${esc(v)}" target="_blank" rel="noopener">${rotulo}</a>`;
  const email = ehEmail(v) ? v : String(c.sobre?.email ?? '').trim();
  if (!ehEmail(email)) return `<a class="${classe}" href="#sobre">${rotulo}</a>`;
  const assunto = `[${d.nome}] Dúvida${aula ? ` - Módulo ${aula.im + 1}, Aula ${aula.ia + 1}: ${aula.titulo}` : ''}`;
  const corpo = `Professor,\n\nTenho uma dúvida sobre ${aula ? `a aula "${aula.titulo}"` : 'a disciplina'} de ${d.nome}:\n\n\n\nNome:\nMatrícula:\n`;
  const q = encodeURIComponent;
  const opcoes = [
    ['Gmail', `https://mail.google.com/mail/?view=cm&fs=1&to=${q(email)}&su=${q(assunto)}&body=${q(corpo)}`],
    ['Outlook', `https://outlook.office.com/mail/deeplink/compose?to=${q(email)}&subject=${q(assunto)}&body=${q(corpo)}`],
    ['Programa de e-mail', `mailto:${email}?subject=${q(assunto)}&body=${q(corpo)}`],
  ];
  // Tudo abre em outra aba: no Claude a página roda numa moldura que não pode trocar de endereço.
  return `<details class="duvida"><summary class="${classe}">${rotulo}</summary><div class="duvida-painel">
<p>Sua mensagem vai para <b>${esc(email)}</b> com o assunto <b>${esc(assunto)}</b>. Onde você quer escrever?</p>
<div class="duvida-opcoes">${opcoes.map(([nome, href]) => `<a class="btn-abrir" href="${esc(href)}" target="_blank" rel="noopener">${nome}</a>`).join('')}<button type="button" class="btn-abrir" data-op="copiar" data-texto="${esc(`${email}\n${assunto}`)}">Copiar e-mail e assunto</button></div>
</div></details>`;
}

function cronograma(d, base, ctx) {
  const eventos = d.cronograma ?? [];
  if (ctx.editando) {
    const tipos = (e) => Object.entries(TIPOS_EVENTO).map(([t, r]) => `<option value="${t}"${t === e.tipo ? ' selected' : ''}>${r}</option>`).join('');
    const linha = (e, k) => `<li class="evento editavel"><div><input type="date" id="ev-data-${e.id}" data-campo="${base}.cronograma.${k}.data" value="${esc(e.data)}" aria-label="Data"> <select id="ev-tipo-${e.id}" data-campo="${base}.cronograma.${k}.tipo" aria-label="Tipo">${tipos(e)}</select> ${campo(`${base}.cronograma.${k}.titulo`, e.titulo, ctx, 'O que acontece nesse dia')}</div>${ferramentas(`${base}.cronograma`, k, eventos.length, ctx, 'data')}</li>`;
    return `<section class="cronograma" aria-label="Cronograma"><h2 class="eye">Cronograma</h2><ul class="eventos">${eventos.map(linha).join('')}</ul>${adicionar(ctx, 'evento', `${base}.cronograma`, 'Nova data')}</section>`;
  }
  const proximos = proximosEventos(eventos, ctx.hoje);
  if (!proximos.length) return '';
  const linha = (e) => `<li class="evento"><span class="evento-data">${dataCurta(e.data)}</span><span class="evento-tipo tipo-${esc(e.tipo)}">${TIPOS_EVENTO[e.tipo] ?? 'Evento'}</span><span class="evento-titulo">${esc(e.titulo)}</span><a class="evento-agenda" href="${esc(linkAgenda(e, d.nome))}" target="_blank" rel="noopener">+ Agenda<span class="sr"> (Google Agenda)</span></a></li>`;
  return `<section class="cronograma" aria-label="Próximas datas"><h2 class="eye">Próximas datas</h2><ul class="eventos">${proximos.map(linha).join('')}</ul></section>`;
}

function acoesDaDisciplina(c, d, base, ctx) {
  if (ctx.editando) {
    return `<label class="campo-linha" for="duvidas-${d.id}">Dúvidas dos alunos: em branco, chegam no e-mail da página Sobre. Para usar outro canal, escreva o link do grupo ou formulário, ou outro e-mail. <input type="text" id="duvidas-${d.id}" data-campo="${base}.duvidas" value="${esc(d.duvidas ?? '')}" placeholder="https://… ou e-mail"></label>`;
  }
  const { vistas, total } = contarVistas(d, vistasDe(ctx));
  const progresso = total
    ? `<p class="progresso-linha">${barraDeProgresso(vistas, total)}<span>${vistas ? `Você viu ${vistas} de ${plural(total, 'aula', 'aulas')}` : `${plural(total, 'aula', 'aulas')}. Marque as que já viu.`}</span></p>`
    : '';
  return `<div class="disciplina-acoes">${progresso}${botaoDeDuvida(c, d, ctx, { rotulo: 'Tirar dúvida', classe: 'btn-duvida' })}</div>`;
}

function telaDisciplina(c, id, ctx) {
  const i = c.disciplinas.findIndex((d) => d.id === id);
  if (i < 0) return tela404();
  const d = c.disciplinas[i];
  const base = `disciplinas.${i}`;
  const capa = ctx.midia[`capa-${d.id}`];
  // Índice de módulos em caixas: o aluno vê a disciplina inteira e pula direto para o módulo.
  const indice = ctx.editando || d.modulos.length < 3 ? '' : `<nav aria-label="Módulos desta disciplina"><ul class="caixas compactas indice">${d.modulos.map((m, im) => `<li><button type="button" class="caixa" data-ir="m-${m.id}"><span class="caixa-info">Módulo ${im + 1} · ${plural(m.aulas.filter((a) => tem(a.titulo)).length, 'aula', 'aulas')}</span><span class="caixa-titulo">${esc(m.titulo)}</span></button></li>`).join('')}</ul></nav>`;
  return `<div class="col">
${capa ? `<div class="capa"><img src="${esc(capa)}" alt="" width="1280" height="720"></div>` : ''}<p class="eye"><a href="#inicio">‹ Disciplinas</a> · ${NIVEIS[d.nivel]}</p>
<h1>${ctx.editando ? campo(`${base}.nome`, d.nome, ctx, 'Nome da disciplina') : nomeQuebravel(d.nome)}</h1>
${acoesDaDisciplina(c, d, base, ctx)}
${avisos(d, base, ctx)}${cronograma(d, base, ctx)}${ficha(d, base, ctx)}${indice}
${d.modulos.map((m, im) => modulo(m, im, d, base, ctx)).join('')}
${d.modulos.length || ctx.editando ? '' : '<p class="suave">As aulas desta disciplina ainda não foram publicadas.</p>'}
${adicionar(ctx, 'modulo', `${base}.modulos`, 'Novo módulo')}
</div>`;
}

// ---------- aula ----------

// Linha de material no modo de edição (em leitura, os materiais são caixas).
function linhaDoMaterial(mat, lista, k, n, ctx) {
  return `<li class="editavel"><span>${campo(`${lista}.${k}.nome`, mat.nome, ctx, 'Nome do material')} <small>${esc(rotuloDoTipo(mat))}</small></span>${ferramentas(lista, k, n, ctx, 'material')}</li>`;
}

function player(video, aula, disciplina, ctx) {
  const id = idDoYoutube(video.url);
  if (ctx.ambiente === 'local' && id) {
    return `<button type="button" class="player" data-op="tocar" data-yt="${id}" aria-label="Assistir: ${esc(aula.titulo)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="play"></span></button>`;
  }
  const capa = ctx.midia[`capa-${disciplina.id}`];
  return `<a class="player" href="${esc(video.url)}" target="_blank" rel="noopener">${capa ? `<img src="${esc(capa)}" alt="" loading="lazy">` : ''}<span class="play"></span><span class="legenda">Assistir no YouTube ↗</span></a>`;
}

function telaAula(c, id, ctx) {
  const achada = acharAula(c, id);
  if (!achada) return tela404();
  const { disciplina: d, idx, im, ia, aula: a, anterior, proxima } = achada;
  const lista = `disciplinas.${idx}.modulos.${im}.aulas.${ia}.materiais`;
  const video = videoPrincipal(a);
  const linhas = a.materiais.map((mat, k) => ({ mat, k })).filter(({ mat }) => ctx.editando || mat !== video);
  const vazio = `<p class="suave">${video ? 'Esta aula tem apenas o vídeo.' : 'Esta aula ainda não tem materiais.'}</p>`;
  const ba = `disciplinas.${idx}.modulos.${im}.aulas.${ia}`;
  const vizinha = (aula, rotulo) => (aula ? `<a class="caixa" href="#a-${aula.id}"><span class="caixa-info">${rotulo}</span><span class="caixa-titulo">${esc(aula.titulo)}</span></a>` : '<span></span>');
  const vizinhas = `<nav class="vizinhas" aria-label="Outras aulas">${vizinha(anterior, '‹ Aula anterior')}${vizinha(proxima, 'Próxima aula ›')}</nav>`;
  const cabecalhoDaAula = `<p class="eye"><a href="#d-${d.id}">‹ ${esc(d.nome)}</a> · Módulo ${im + 1} · Aula ${ia + 1}${seloNovo(a.adicionadoEm, ctx)}</p>
<h1>${campo(`${ba}.titulo`, a.titulo, ctx, 'Título da aula')}</h1>`;
  const visto = Boolean(vistasDe(ctx)[a.id]);
  // A dúvida sai daqui com a aula no assunto do e-mail.
  const botaoVista = ctx.editando ? '' : `<div class="aula-acoes"><button type="button" class="btn-vista${visto ? ' feita' : ''}" data-op="vista" data-aula="${a.id}" aria-pressed="${visto}">${visto ? '✓ Aula vista' : 'Marcar como vista'}</button>${botaoDeDuvida(c, d, ctx, { aula: { ...a, im, ia }, rotulo: 'Tirar dúvida sobre esta aula', classe: 'btn-duvida leve' })}</div>`;

  if (ctx.editando) {
    return `<div class="col">${cabecalhoDaAula}
<section class="sobre-aula"><h2 class="eye">Nesta aula</h2><div class="prosa">${bloco(`${ba}.descricao`, a.descricao, ctx, 'O que o aluno vai ver nesta aula')}</div><h2 class="eye">Dica de estudo</h2><div class="prosa">${bloco(`${ba}.dica`, a.dica, ctx, 'Uma dica para estudar esta aula')}</div></section>
${video ? player(video, a, d, ctx) : ''}
<section><h2 class="eye">Materiais desta aula</h2><ul class="lista mat-lista">${linhas.map(({ mat, k }) => linhaDoMaterial(mat, lista, k, a.materiais.length, ctx)).join('')}</ul>${novoMaterial(ctx, lista, 'Novo material')}</section>
${vizinhas}</div>`;
  }

  const descricao = tem(a.descricao) ? `<div class="descricao-aula"><h2 class="eye">Nesta aula</h2><div class="prosa">${paragrafos(a.descricao)}</div></div>` : '';
  const dica = tem(a.dica) ? `<aside class="dica"><b>Dica de estudo</b>${paragrafos(a.dica)}</aside>` : '';

  // Modo de estudo (site dos alunos): vídeo e PDF lado a lado, sem sair da página.
  // No Claude não dá para embutir vídeo nem PDF, então a aula fica com links.
  const pdfs = a.materiais.filter((mat) => mat !== video && formato(mat) === 'PDF');
  if (ctx.ambiente === 'local' && (video || pdfs.length)) {
    const outros = linhas.filter(({ mat }) => !pdfs.includes(mat)).map(({ mat }) => caixaDoMaterial(mat, ctx)).join('');
    const abas = pdfs.length > 1
      ? `<div class="abas" role="tablist" aria-label="Material para acompanhar">${pdfs.map((mat, k) => `<button type="button" role="tab" class="aba" data-op="ler" data-pdf="${esc(mat.url)}" aria-selected="${k === 0}">${icone(mat.tipo)}${esc(rotuloDoChip(mat))}</button>`).join('')}</div>`
      : '';
    const leitor = pdfs.length
      ? `<div class="estudo-material">${abas}<div class="leitor" data-pdf="${esc(pdfs[0].url)}" aria-label="Leitor do material"><p class="leitor-aviso">Carregando o material…</p></div><p class="leitor-rodape"><button type="button" class="btn-abrir" data-op="tela-cheia" hidden>Ver em tela cheia</button><a href="${esc(pdfs[0].url)}" target="_blank" rel="noopener" data-leitor-link>Abrir o PDF em nova aba ↗</a></p></div>`
      : '';
    return `<div class="col col-estudo">${cabecalhoDaAula}
${descricao}
<div class="estudo${pdfs.length ? '' : ' so-video'}">${video ? `<div class="estudo-video">${player(video, a, d, ctx)}${botaoVista}</div>` : ''}${leitor}</div>
${video ? '' : botaoVista}
${dica}
${outros ? `<section><h2 class="eye">Outros materiais</h2><ul class="caixas compactas">${outros}</ul></section>` : ''}
${paraPraticar(c, a, ctx)}
${vizinhas}</div>`;
  }

  const materiais = linhas.length ? `<ul class="caixas compactas">${linhas.map(({ mat }) => caixaDoMaterial(mat, ctx)).join('')}</ul>` : vazio;
  return `<div class="col">${cabecalhoDaAula}
${descricao}
${video ? player(video, a, d, ctx) : ''}
${botaoVista}
${dica}
<section><h2 class="eye">Materiais desta aula</h2>${materiais}</section>
${paraPraticar(c, a, ctx)}
${vizinhas}</div>`;
}

// ---------- laboratório, textos ----------

// Cada material do Laboratório diz o que é, em quais aulas entra e deixa espiar o conteúdo antes de baixar.
const aulasDoItem = (c, it) => (it.aulas ?? []).map((id) => acharAula(c, id)).filter(Boolean);

function infoDoItem(it, previa) {
  const partes = [rotuloDoTipo(it), formato(it)];
  if (previa?.paginas) partes.push(`${previa.paginas} páginas`);
  if (previa?.tamanho) partes.push(previa.tamanho);
  return partes.join(' · ');
}

// Vídeo e PDF se veem no próprio site dos alunos; planilha, script e repositório, pelo trecho gerado no build.
function temPrevia(it, previa, ctx) {
  if (idDoYoutube(it.url) || formato(it) === 'PDF') return ctx.ambiente === 'local';
  return Boolean(previa?.tipo);
}

// Vídeo mostra a miniatura do YouTube; no Claude imagens de fora não carregam, e fica só o ícone ao lado do tipo.
function capaDoItem(it, ctx) {
  const yt = idDoYoutube(it.url);
  return yt && ctx.ambiente === 'local'
    ? `<span class="lab-capa"><img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180"><span class="play"></span></span>`
    : '';
}

const chipDaAula = (x) => `<a class="lab-aula" href="#a-${x.aula.id}"><span>${esc(x.aula.titulo)}</span><small>${esc(x.disciplina.nome)} · Módulo ${x.im + 1}</small></a>`;

function cartaoDoLaboratorio(c, it, ctx, destaque) {
  const previa = ctx.previas?.[it.url];
  const aulas = aulasDoItem(c, it);
  const ver = temPrevia(it, previa, ctx)
    ? `<button type="button" class="btn-previa" data-op="previa" data-item="${esc(it.id)}">${idDoYoutube(it.url) ? 'Assistir aqui' : 'Ver prévia'}</button>`
    : '';
  return `<li class="lab-item${destaque ? ' destaque' : ''}" id="item-${esc(it.id)}" tabindex="-1">${capaDoItem(it, ctx)}<div class="lab-corpo">
<span class="caixa-info lab-tipo">${icone(it.tipo)}${esc(infoDoItem(it, previa))}${seloNovo(it.adicionadoEm, ctx)}</span>
<h3>${esc(it.nome)}</h3>
${tem(it.descricao) ? `<p class="lab-descricao">${esc(it.descricao)}</p>` : ''}
${aulas.length ? `<div class="lab-aulas"><span class="eye">Usado nas aulas</span><div>${aulas.map(chipDaAula).join('')}</div></div>` : ''}
<div class="lab-acoes">${ver}<a class="btn-abrir" href="${esc(it.url)}"${atributosDoLink(it.url)}>${acaoDoLink(it.url)}</a></div>
</div></li>`;
}

// Em edição: nome, descrição e as aulas relacionadas (escolhidas numa lista, sem digitar código de aula).
function linhaDoLaboratorio(c, it, lista, k, n, ctx) {
  const ba = `${lista}.${k}`;
  const relacionadas = it.aulas ?? [];
  const chips = relacionadas.map((id, j) => {
    const x = acharAula(c, id);
    const nome = x ? x.aula.titulo : id;
    // A disciplina vai junto: há aulas de mesmo nome em disciplinas diferentes.
    return `<span class="chip">${esc(nome)}${x ? ` <small>${esc(x.disciplina.nome)}</small>` : ''}<button type="button" data-op="remover-sim" data-lista="${ba}.aulas" data-i="${j}" aria-label="Tirar a relação com ${esc(nome)}">×</button></span>`;
  }).join('');
  const opcoes = c.disciplinas.map((d) => `<optgroup label="${esc(d.nome)}">${d.modulos.flatMap((m, im) => m.aulas
    .filter((a) => tem(a.titulo) && !relacionadas.includes(a.id))
    .map((a) => `<option value="${a.id}">Módulo ${im + 1} · ${esc(a.titulo)}</option>`)).join('')}</optgroup>`).join('');
  return `<li class="editavel lab-edicao"><div class="lab-edicao-corpo"><span>${campo(`${ba}.nome`, it.nome, ctx, 'Nome do material')} <small>${esc(rotuloDoTipo(it))}</small></span>
<div class="prosa">${bloco(`${ba}.descricao`, it.descricao, ctx, 'O que tem neste material e como usar')}</div>
<div class="lab-relacoes"><small>Aulas relacionadas</small>${chips}<select data-relacionar="${ba}.aulas" aria-label="Relacionar com uma aula"><option value="">+ Relacionar com uma aula…</option>${opcoes}</select></div>
</div>${ferramentas(lista, k, n, ctx, 'material')}</li>`;
}

function telaLaboratorio(c, ctx, destaque) {
  const intro = `<h1>Laboratório</h1><p class="lead">${campo('site.laboratorio', c.site.laboratorio, ctx, 'Apresentação do laboratório')}</p>`;
  if (ctx.editando) {
    const grupo = (g, ig) => `<section><h2 class="eye">${campo(`laboratorio.${ig}.grupo`, g.grupo, ctx, 'Nome do grupo')}</h2><div class="prosa">${bloco(`laboratorio.${ig}.descricao`, g.descricao, ctx, 'Para que serve este grupo')}</div><ul class="lista mat-lista">${g.itens.map((it, k) => linhaDoLaboratorio(c, it, `laboratorio.${ig}.itens`, k, g.itens.length, ctx)).join('')}</ul>${novoMaterial(ctx, `laboratorio.${ig}.itens`, 'Novo item')}</section>`;
    return `<div class="col larga">${intro}${c.laboratorio.map(grupo).join('')}</div>`;
  }
  const grupos = c.laboratorio.map((g, ig) => ({ g, ig })).filter(({ g }) => g.itens.length);
  // Atalhos para os grupos, no mesmo formato do índice de módulos.
  const atalhos = `<nav aria-label="Grupos do laboratório"><ul class="caixas compactas indice">${grupos.map(({ g, ig }) => `<li><button type="button" class="caixa" data-ir="grupo-${ig}"><span class="caixa-info">${plural(g.itens.length, 'material', 'materiais')}</span><span class="caixa-titulo">${esc(g.grupo)}</span></button></li>`).join('')}</ul></nav>`;
  const grupo = ({ g, ig }) => `<section class="lab-grupo" id="grupo-${ig}" tabindex="-1"><h2 class="secao">${esc(g.grupo)} <small>${plural(g.itens.length, 'material', 'materiais')}</small></h2>${tem(g.descricao) ? `<p class="lab-grupo-descricao">${esc(g.descricao)}</p>` : ''}<ul class="lab-itens">${g.itens.map((it) => cartaoDoLaboratorio(c, it, ctx, it.id === destaque)).join('')}</ul></section>`;
  return `<div class="col larga">${intro}${atalhos}${grupos.map(grupo).join('')}</div>`;
}

// Conteúdo da janela de prévia, aberta pelo programa da página.
export function previaDoLaboratorio(it, ctx) {
  const previa = ctx.previas?.[it.url];
  let corpo = '';
  if (idDoYoutube(it.url)) {
    corpo = player(it, { titulo: it.nome }, { id: '' }, ctx);
  } else if (formato(it) === 'PDF') {
    corpo = `<div class="leitor" data-pdf="${esc(it.url)}"><p class="leitor-aviso">Carregando o material…</p></div>`;
  } else if (previa?.tipo === 'tabela') {
    const celula = (v) => `<td${/^-?[\d.]+(,\d+)?$/.test(v) ? ' class="valor"' : ''}>${esc(v)}</td>`;
    corpo = `<p class="previa-nota">Trecho da aba <b>${esc(previa.aba)}</b>. A planilha tem ${plural(previa.abas.length, 'aba', 'abas')}: ${previa.abas.map(esc).join(', ')}.</p>
<div class="previa-tabela"><table>${previa.linhas.map((l) => `<tr>${l.map(celula).join('')}</tr>`).join('')}</table></div>`;
  } else if (previa?.tipo === 'codigo') {
    corpo = `<p class="previa-nota">As primeiras ${previa.linhas.length} linhas.</p><pre class="previa-codigo"><code>${esc(previa.linhas.join('\n'))}</code></pre>`;
  } else if (previa?.tipo === 'pastas') {
    corpo = `<p class="previa-nota">Pastas do repositório, uma por tema:</p><ul class="previa-pastas">${previa.itens.map((p) => `<li>${icone('codigo')}${esc(p)}</li>`).join('')}</ul>`;
  }
  return `<div class="previa-topo"><div><span class="caixa-info">${esc(infoDoItem(it, previa))}</span><h2 id="previa-titulo">${esc(it.nome)}</h2></div><button type="button" class="previa-fechar" data-op="fechar-previa" aria-label="Fechar a prévia">×</button></div>
<div class="previa-corpo">${corpo}</div>
<div class="previa-rodape"><a class="btn-abrir" href="${esc(it.url)}"${atributosDoLink(it.url)}>${acaoDoLink(it.url)}</a></div>`;
}

// Na aula: o que o Laboratório tem para praticar o assunto.
function paraPraticar(c, a, ctx) {
  const itens = c.laboratorio.flatMap((g) => g.itens.filter((it) => (it.aulas ?? []).includes(a.id)));
  if (!itens.length || ctx.editando) return '';
  return `<section><h2 class="eye">Para praticar no Laboratório</h2><ul class="caixas compactas">${itens.map((it) => `<li><a class="caixa caixa-material" href="#l-${it.id}">${icone(it.tipo)}<span class="caixa-info">${esc(rotuloDoTipo(it))} · ${formato(it)}</span><span class="caixa-titulo">${esc(it.nome)}</span><span class="caixa-acao">Ver no Laboratório ›</span></a></li>`).join('')}</ul></section>`;
}

function telaTextos(c, ctx) {
  const linhas = c.textos.map((t, k) => ({ t, k })).filter(({ t }) => ctx.editando || tem(t.titulo));
  if (!ctx.editando) {
    return `<div class="col"><h1>Textos</h1><ul class="caixas uma">${linhas.map(({ t }) => `<li><a class="caixa" href="#t-${t.id}"><span class="caixa-info">${dataBR(t.data)}</span><span class="caixa-titulo">${esc(t.titulo)}</span>${tem(t.resumo) ? `<span class="caixa-texto">${esc(t.resumo)}</span>` : ''}<span class="caixa-acao">Ler ›</span></a></li>`).join('')}</ul></div>`;
  }
  return `<div class="col"><h1>Textos</h1><ul class="lista">${linhas.map(({ t, k }) => `<li class="editavel"><a href="#t-${t.id}"><span>${esc(t.titulo || 'Sem título')}</span><small>${dataBR(t.data)}</small></a>${ferramentas('textos', k, c.textos.length, ctx, 'texto')}</li>`).join('')}</ul>${adicionar(ctx, 'texto', 'textos', 'Novo texto')}</div>`;
}

function telaTexto(c, id, ctx) {
  const k = c.textos.findIndex((t) => t.id === id);
  if (k < 0) return tela404();
  const t = c.textos[k];
  const data = ctx.editando
    ? `<input type="date" id="data-${t.id}" data-campo="textos.${k}.data" value="${esc(t.data)}" aria-label="Data do texto">`
    : dataBR(t.data);
  return `<article class="col"><p class="eye"><a href="#textos">Textos</a> · ${data}</p><h1>${campo(`textos.${k}.titulo`, t.titulo, ctx, 'Título')}</h1>${tem(t.resumo) || ctx.editando ? `<p class="lead">${campo(`textos.${k}.resumo`, t.resumo, ctx, 'Resumo em uma frase')}</p>` : ''}<div class="prosa">${bloco(`textos.${k}.corpo`, t.corpo, ctx, 'Escreva o texto aqui')}</div></article>`;
}

// ---------- pesquisa ----------

function telaPesquisa(c, ctx) {
  const p = c.pesquisa;
  const tipoValido = (x) => (CATEGORIAS_PUBLICACAO.some(([t]) => t === x.tipo) ? x.tipo : 'outro');
  const seletor = (x, k) => `<select id="tipo-${x.id}" data-campo="pesquisa.publicacoes.${k}.tipo" aria-label="Categoria">${CATEGORIAS_PUBLICACAO.map(([t, rotulo]) => `<option value="${t}"${t === tipoValido(x) ? ' selected' : ''}>${rotulo}</option>`).join('')}</select> `;
  const projeto = (x, k) => `<li><div><h3>${campo(`pesquisa.projetos.${k}.titulo`, x.titulo, ctx, 'Título do projeto')}</h3>${tem(x.descricao) || ctx.editando ? `<p class="suave">${campo(`pesquisa.projetos.${k}.descricao`, x.descricao, ctx, 'Descrição (opcional)')}</p>` : ''}</div>${ferramentas('pesquisa.projetos', k, p.projetos.length, ctx, 'projeto')}</li>`;
  const publicacao = ({ x, k }) => `<li><div>${ctx.editando ? `${seletor(x, k)}<input class="ano-in" id="ano-${x.id}" data-campo="pesquisa.publicacoes.${k}.ano" value="${esc(x.ano)}" inputmode="numeric" size="4" aria-label="Ano"> ` : ''}${campo(`pesquisa.publicacoes.${k}.referencia`, x.referencia, ctx, 'Referência completa')}</div>${ferramentas('pesquisa.publicacoes', k, p.publicacoes.length, ctx, 'publicação', false)}</li>`;
  // Dentro de cada categoria, da mais recente para a mais antiga; sem ano (ainda não publicada) vem primeiro.
  const grupos = CATEGORIAS_PUBLICACAO.map(([tipo, rotulo]) => ({
    rotulo,
    itens: p.publicacoes.map((x, k) => ({ x, k }))
      .filter(({ x }) => tipoValido(x) === tipo && (ctx.editando || tem(x.referencia)))
      .sort((a, b) => String(b.x.ano || '9999').localeCompare(String(a.x.ano || '9999'))),
  })).filter((g) => g.itens.length);
  return `<div class="col"><h1>Pesquisa</h1><div class="prosa">${bloco('pesquisa.linhas', p.linhas, ctx, 'Linhas de pesquisa')}</div>
${p.grupo?.url ? `<p><a href="${esc(p.grupo.url)}" target="_blank" rel="noopener">${esc(p.grupo.nome)} ↗</a></p>` : ''}
<section><h2 class="eye">Projetos</h2><ul class="projetos">${p.projetos.map(projeto).join('')}</ul>${adicionar(ctx, 'projeto', 'pesquisa.projetos', 'Novo projeto')}</section>
<section><h2 class="eye">Publicações</h2>${adicionar(ctx, 'publicacao', 'pesquisa.publicacoes', 'Nova publicação')}${grupos.map((g) => `<h3 class="ano">${g.rotulo}</h3><ul class="pubs">${g.itens.map(publicacao).join('')}</ul>`).join('')}</section></div>`;
}

// ---------- sobre ----------

const NIVEIS_ORIENTACAO = ['Doutorado', 'Mestrado', 'Especialização'];

function orientacoes(s, ctx) {
  const item = ({ o, k }) => `<li><div><h3>${campo(`sobre.orientacoes.${k}.titulo`, o.titulo, ctx, 'Título do trabalho')}</h3><p class="suave">${campo(`sobre.orientacoes.${k}.aluno`, o.aluno, ctx, 'Nome do orientando')}, ${campo(`sobre.orientacoes.${k}.ano`, o.ano, ctx, 'Ano')}${ctx.editando ? ` <select id="nivel-${o.id}" data-campo="sobre.orientacoes.${k}.nivel" aria-label="Nível">${NIVEIS_ORIENTACAO.map((n) => `<option${n === o.nivel ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}</p></div>${ferramentas('sobre.orientacoes', k, s.orientacoes.length, ctx, 'orientação', false)}</li>`;
  const grupos = NIVEIS_ORIENTACAO.map((n) => ({ n, itens: s.orientacoes.map((o, k) => ({ o, k })).filter(({ o }) => o.nivel === n) })).filter((g) => g.itens.length);
  if (!grupos.length && !ctx.editando) return '';
  return `<section><h2 class="eye">Orientações concluídas</h2>${grupos.map((g) => `<h3 class="ano">${g.n}</h3><ul class="orientacoes">${g.itens.map(item).join('')}</ul>`).join('')}${adicionar(ctx, 'orientacao', 'sobre.orientacoes', 'Nova orientação')}</section>`;
}

function telaSobre(c, ctx) {
  const s = c.sobre;
  const foto = ctx.midia.foto
    ? `<img class="foto" src="${esc(ctx.midia.foto)}" alt="Retrato de ${esc(s.nome)}" width="112" height="112">`
    : '<div class="foto mono" aria-hidden="true">AF</div>';
  const formacao = (f, k) => `<li><span class="periodo">${campo(`sobre.formacao.${k}.periodo`, f.periodo, ctx, 'Período')}</span><div><h3>${campo(`sobre.formacao.${k}.titulo`, f.titulo, ctx, 'Título')}</h3><p class="suave">${campo(`sobre.formacao.${k}.instituicao`, f.instituicao, ctx, 'Instituição')}</p>${tem(f.detalhe) || ctx.editando ? `<p>${campo(`sobre.formacao.${k}.detalhe`, f.detalhe, ctx, 'Detalhe (opcional)')}</p>` : ''}</div>${ferramentas('sobre.formacao', k, s.formacao.length, ctx, 'formação')}</li>`;
  return `<div class="col">
<div class="perfil">${foto}<div><h1>${esc(s.nome)}</h1><p class="suave">${campo('sobre.cargo', s.cargo, ctx, 'Cargo e instituição')}</p></div></div>
<div class="prosa">${bloco('sobre.resumo', s.resumo, ctx, 'Resumo do currículo')}</div>
<p><a href="${esc(s.lattes)}" target="_blank" rel="noopener">Currículo Lattes ↗</a></p>
<section><h2 class="eye">Formação</h2><ol class="tempo">${s.formacao.map(formacao).join('')}</ol>${adicionar(ctx, 'formacao', 'sobre.formacao', 'Nova formação')}</section>
${tem(s.areas) || ctx.editando ? `<section><h2 class="eye">Áreas de atuação</h2><div class="areas">${bloco('sobre.areas', s.areas, ctx, 'Uma área por linha')}</div></section>` : ''}
${orientacoes(s, ctx)}
<section><h2 class="eye">Contato</h2><p class="contato"><span id="email">${campo('sobre.email', s.email, ctx, 'E-mail')}</span>${ctx.editando ? '' : `<button type="button" data-op="copiar" data-texto="${esc(s.email)}">Copiar</button>`}</p></section>
${tem(c.site.proposito) || ctx.editando ? `<section><h2 class="eye">Sobre este sítio</h2><div class="prosa">${bloco('site.proposito', c.site.proposito, ctx, 'Propósito do sítio')}</div></section>` : ''}
${tem(s.english) || ctx.editando ? `<section lang="en"><h2 class="eye">In English</h2><div class="prosa">${bloco('sobre.english', s.english, ctx, 'Short vitae in English')}</div></section>` : ''}
</div>`;
}

// ---------- formulário de material ----------

const TIPOS_DO_FORMULARIO = ['slides', 'notas', 'video', 'exercicios', 'planilha', 'codigo', 'link'];

function formularioMaterial(f) {
  if (!f) return '';
  const travado = f.enviando ? ' disabled' : '';
  const tipos = TIPOS_DO_FORMULARIO.map((t) => `<label><input type="radio" name="tipo" id="tipo-${t}" value="${t}"${f.tipo === t ? ' checked' : ''}><span>${TIPOS[t].rotulo}</span></label>`).join('');
  const envio = f.podeEnviar
    ? `<label class="drop" for="mat-arquivo">${f.enviando ? 'Enviando…' : 'ou envie um PDF de até 20 MB'}<input class="sr" id="mat-arquivo" name="arquivo" type="file" accept="application/pdf,image/*,text/plain,text/csv"${travado}></label><p class="suave nota">Para planilhas, cole um link (do Drive, por exemplo).</p>`
    : '';
  return `<div class="folha-fundo"><form class="folha" id="form-material" novalidate aria-label="Novo material">
<h2>Novo material</h2>
<fieldset><legend>Tipo</legend><div class="seg">${tipos}</div></fieldset>
<label for="mat-url">Endereço</label><input id="mat-url" name="url" type="url" inputmode="url" placeholder="https://" value="${esc(f.url)}"${travado}>
${f.arquivo ? `<p class="ok">Arquivo enviado: ${esc(f.arquivo)}</p>` : ''}${envio}
<label for="mat-nome">Nome que o aluno vê</label><input id="mat-nome" name="nome" type="text" value="${esc(f.nome)}">
${f.erro ? `<p class="erro" role="alert">${esc(f.erro)}</p>` : ''}
<div class="acoes"><button type="button" data-op="cancelar-material">Cancelar</button><button type="submit" class="pri"${travado}>Adicionar</button></div>
</form></div>`;
}

// ---------- QR codes para a sala ----------

// O desenho de cada QR é feito pelo programa da página (principal.js), a partir do data-qr.
function telaQR(c, ctx) {
  const base = ctx.siteUrl;
  if (!base) return tela404();
  const cartao = (titulo, url) => `<li class="qr-cartao"><div class="qr" data-qr="${esc(url)}" role="img" aria-label="QR code: ${esc(titulo)}"></div><span class="caixa-titulo">${esc(titulo)}</span><span class="qr-url">${esc(url.replace(/^https:\/\//, ''))}</span></li>`;
  return `<div class="col larga">
<p class="eye"><a href="#inicio">‹ Disciplinas</a></p>
<h1>QR codes para a sala</h1>
<p class="lead">Para projetar no primeiro slide ou imprimir no plano de ensino. Cada código abre a disciplina no site dos alunos.</p>
<ul class="qrs">${cartao('Site completo', base)}${c.disciplinas.map((d) => cartao(d.nome, `${base}#d-${d.id}`)).join('')}</ul>
</div>`;
}

// ---------- entrada ----------

export function renderizar(c, rota, ctx) {
  const telas = {
    inicio: () => telaInicio(c, ctx),
    disciplina: () => telaDisciplina(c, rota.id, ctx),
    aula: () => telaAula(c, rota.id, ctx),
    laboratorio: () => telaLaboratorio(c, ctx, rota.id),
    textos: () => telaTextos(c, ctx),
    texto: () => telaTexto(c, rota.id, ctx),
    pesquisa: () => telaPesquisa(c, ctx),
    sobre: () => telaSobre(c, ctx),
    qr: () => telaQR(c, ctx),
  };
  const corpo = (Object.hasOwn(telas, rota.nome) ? telas[rota.nome] : tela404)();
  const mensagem = ctx.mensagem ? `<p class="msg" role="status">${esc(ctx.mensagem)}</p>` : '';
  return `${barraEdicao(ctx)}${cabecalho(c, rota)}<main id="conteudo-principal" tabindex="-1">${corpo}</main>${rodape(c, ctx)}${mensagem}${formularioMaterial(ctx.formulario)}`;
}
