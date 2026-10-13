import { TIPOS, NIVEIS, CATEGORIAS_PUBLICACAO, avisosValidos, avisosRecentes, acharAula, videoPrincipal } from './conteudo.js';
import { idDoYoutube } from './youtube.js';

// ---------- utilidades ----------

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function interpretarRota(hash) {
  const h = String(hash ?? '').replace(/^#/, '') || 'inicio';
  const m = /^([adt])-(.+)$/.exec(h);
  return m ? { nome: { a: 'aula', d: 'disciplina', t: 'texto' }[m[1]], id: m[2] } : { nome: h };
}

const tem = (v) => Boolean(String(v ?? '').trim());

const paragrafos = (t) => String(t ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

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

const MENU = [['inicio', 'Início'], ['laboratorio', 'Laboratório'], ['textos', 'Textos'], ['pesquisa', 'Pesquisa'], ['sobre', 'Sobre']];

function cabecalho(c, rota) {
  const itens = MENU.map(([r, nome]) => `<a href="#${r}"${rota.nome === r ? ' aria-current="page"' : ''}>${nome}</a>`).join('');
  return `<header class="topo"><a class="marca" href="#inicio">${esc(c.site.titulo)}</a><nav aria-label="Seções">${itens}</nav></header>`;
}

const rodape = (c) => `<footer class="rodape"><span>${esc(c.site.professor)} · ${esc(c.site.instituicao)}</span><a href="#sobre">Contato</a></footer>`;

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

const tela404 = () => '<div class="col"><h1>Página não encontrada</h1><p><a href="#inicio">Voltar ao início</a></p></div>';

// ---------- início ----------

function abertura(ctx) {
  const m = ctx.midia;
  if (!m.poster) return '';
  const video = m.hero && !ctx.editando
    ? `<video muted loop playsinline preload="none" aria-hidden="true" data-src="${esc(m.hero)}"></video>`
    : '';
  return `<div class="abertura"><img src="${esc(m.poster)}" alt="" width="1600" height="600">${video}</div>`;
}

function telaInicio(c, ctx) {
  const recentes = avisosRecentes(c, ctx.hoje);
  const contagem = (d) => (d.modulos.length ? `${d.modulos.length} ${d.modulos.length === 1 ? 'módulo' : 'módulos'}` : '');
  const nivel = (chave) => {
    const lista = c.disciplinas.filter((d) => d.nivel === chave);
    if (!lista.length) return '';
    return `<section><h2 class="eye">${NIVEIS[chave]}</h2><ul class="lista">${lista.map((d) => `<li><a href="#d-${d.id}"><span>${esc(d.nome)}</span><small>${contagem(d)}</small></a></li>`).join('')}</ul></section>`;
  };
  const textos = c.textos.filter((t) => tem(t.titulo)).slice(0, 3);
  return `${abertura(ctx)}<div class="col">
<p class="eye">${esc(c.site.professor)} · ${esc(c.site.instituicao)}</p>
<h1>${campo('site.chamada', c.site.chamada, ctx, 'Frase de abertura')}</h1>
${recentes.length ? `<section><h2 class="eye">Avisos recentes</h2><ul class="lista">${recentes.map(({ disciplina, aviso }) => `<li><a href="#d-${disciplina.id}"><span>${esc(aviso.texto)}</span><small>${esc(disciplina.nome)}</small></a></li>`).join('')}</ul></section>` : ''}
${nivel('graduacao')}${nivel('pos')}
${textos.length ? `<section><h2 class="eye">Últimos textos</h2><ul class="lista">${textos.map((t) => `<li><a href="#t-${t.id}"><span>${esc(t.titulo)}</span><small>${dataBR(t.data)}</small></a></li>`).join('')}</ul></section>` : ''}
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
    return `<a class="chip" href="${esc(mat.url)}" target="_blank" rel="noopener" title="${esc(mat.nome)}">${esc(rotuloDoChip(mat))}<span class="sr"> (${esc(mat.nome)}, abre em nova aba)</span></a>`;
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
  return `<li class="aula"><div><small>Aula ${ia + 1}</small><div class="aula-titulo">${titulo}</div><div class="mats">${a.materiais.map((mat, k) => chip(mat, `${ba}.materiais`, k, ctx)).join('')}${novoMaterial(ctx, `${ba}.materiais`, 'material', 'chip novo')}</div></div>${ferramentas(`${bm}.aulas`, ia, m.aulas.length, ctx, 'aula')}</li>`;
}

function modulo(m, im, d, base, ctx) {
  const bm = `${base}.modulos.${im}`;
  const aulas = m.aulas.map((a, ia) => ({ a, ia })).filter(({ a }) => ctx.editando || tem(a.titulo));
  return `<section class="modulo"><div class="linha-titulo"><h2><span class="num">${im + 1}.</span> ${campo(`${bm}.titulo`, m.titulo, ctx, 'Título do módulo')}</h2>${ferramentas(`${base}.modulos`, im, d.modulos.length, ctx, 'módulo')}</div><ol class="aulas">${aulas.map(({ a, ia }) => linhaDaAula(a, ia, m, bm, ctx)).join('')}</ol>${adicionar(ctx, 'aula', `${bm}.aulas`, 'Nova aula')}</section>`;
}

function telaDisciplina(c, id, ctx) {
  const i = c.disciplinas.findIndex((d) => d.id === id);
  if (i < 0) return tela404();
  const d = c.disciplinas[i];
  const base = `disciplinas.${i}`;
  const capa = ctx.midia[`capa-${d.id}`];
  return `${capa ? `<div class="capa"><img src="${esc(capa)}" alt="" width="1600" height="400"></div>` : ''}<div class="col">
<p class="eye"><a href="#inicio">${NIVEIS[d.nivel]}</a></p>
<h1>${campo(`${base}.nome`, d.nome, ctx, 'Nome da disciplina')}</h1>
${avisos(d, base, ctx)}${ficha(d, base, ctx)}
${d.modulos.map((m, im) => modulo(m, im, d, base, ctx)).join('')}
${adicionar(ctx, 'modulo', `${base}.modulos`, 'Novo módulo')}
</div>`;
}

// ---------- aula ----------

function linhaDoMaterial(mat, lista, k, n, ctx) {
  if (!ctx.editando) {
    return `<li><a href="${esc(mat.url)}" target="_blank" rel="noopener"><span>${esc(mat.nome)}</span><small>${esc(rotuloDoTipo(mat))} ↗</small></a></li>`;
  }
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
  const materiais = linhas.length || ctx.editando
    ? `<ul class="lista mat-lista">${linhas.map(({ mat, k }) => linhaDoMaterial(mat, lista, k, a.materiais.length, ctx)).join('')}</ul>`
    : `<p class="suave">${video ? 'Esta aula tem apenas o vídeo.' : 'Esta aula ainda não tem materiais.'}</p>`;
  return `<div class="col">
<p class="eye"><a href="#d-${d.id}">${esc(d.nome)}</a> · Módulo ${im + 1} · Aula ${ia + 1}</p>
<h1>${campo(`disciplinas.${idx}.modulos.${im}.aulas.${ia}.titulo`, a.titulo, ctx, 'Título da aula')}</h1>
${video ? player(video, a, d, ctx) : ''}
<section><h2 class="eye">Materiais desta aula</h2>${materiais}${novoMaterial(ctx, lista, 'Novo material')}</section>
<nav class="vizinhas" aria-label="Outras aulas">${anterior ? `<a href="#a-${anterior.id}">‹ ${esc(anterior.titulo)}</a>` : '<span></span>'}${proxima ? `<a href="#a-${proxima.id}">${esc(proxima.titulo)} ›</a>` : ''}</nav>
</div>`;
}

// ---------- laboratório, textos ----------

function telaLaboratorio(c, ctx) {
  const grupo = (g, ig) => `<section><h2 class="eye">${campo(`laboratorio.${ig}.grupo`, g.grupo, ctx, 'Nome do grupo')}</h2><ul class="lista mat-lista">${g.itens.map((it, k) => linhaDoMaterial(it, `laboratorio.${ig}.itens`, k, g.itens.length, ctx)).join('')}</ul>${novoMaterial(ctx, `laboratorio.${ig}.itens`, 'Novo item')}</section>`;
  return `<div class="col"><h1>Laboratório</h1><p class="lead">${campo('site.laboratorio', c.site.laboratorio, ctx, 'Apresentação do laboratório')}</p>${c.laboratorio.map(grupo).join('')}</div>`;
}

function telaTextos(c, ctx) {
  const linhas = c.textos.map((t, k) => ({ t, k })).filter(({ t }) => ctx.editando || tem(t.titulo));
  return `<div class="col"><h1>Textos</h1><ul class="lista">${linhas.map(({ t, k }) => `<li${ctx.editando ? ' class="editavel"' : ''}><a href="#t-${t.id}"><span>${esc(t.titulo || 'Sem título')}</span><small>${dataBR(t.data)}</small></a>${ferramentas('textos', k, c.textos.length, ctx, 'texto')}</li>`).join('')}</ul>${adicionar(ctx, 'texto', 'textos', 'Novo texto')}</div>`;
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

const TIPOS_DO_FORMULARIO = ['slides', 'video', 'exercicios', 'planilha', 'codigo', 'link'];

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

// ---------- entrada ----------

export function renderizar(c, rota, ctx) {
  const telas = {
    inicio: () => telaInicio(c, ctx),
    disciplina: () => telaDisciplina(c, rota.id, ctx),
    aula: () => telaAula(c, rota.id, ctx),
    laboratorio: () => telaLaboratorio(c, ctx),
    textos: () => telaTextos(c, ctx),
    texto: () => telaTexto(c, rota.id, ctx),
    pesquisa: () => telaPesquisa(c, ctx),
    sobre: () => telaSobre(c, ctx),
  };
  const corpo = (Object.hasOwn(telas, rota.nome) ? telas[rota.nome] : tela404)();
  const mensagem = ctx.mensagem ? `<p class="msg" role="status">${esc(ctx.mensagem)}</p>` : '';
  return `${barraEdicao(ctx)}${cabecalho(c, rota)}<main id="conteudo-principal" tabindex="-1">${corpo}</main>${rodape(c)}${mensagem}${formularioMaterial(ctx.formulario)}`;
}
