// Cópia exata do estilo que a ferramenta Artifact põe na cabeça da página (conferido na versão publicada).
export const RESET_PADRAO =
  ':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}' +
  'html{scroll-padding-top:env(safe-area-inset-top,0px)}' +
  'body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}' +
  'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}';

const escHtml = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function jsonSeguro(valor) {
  return JSON.stringify(valor)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function corpoDaPagina({ titulo, fontes, css, js, conteudo, config }) {
  return (
    `<title>${escHtml(titulo)}</title>` +
    (fontes ? `<link rel="stylesheet" href="${escHtml(fontes)}">` : '') +
    `<style id="estilo">${css}</style>` +
    `<div id="app"></div>` +
    `<script type="application/json" id="conteudo">${jsonSeguro(conteudo)}<\/script>` +
    `<script type="application/json" id="config">${jsonSeguro(config)}<\/script>` +
    `<script id="programa">${js}<\/script>`
  );
}

export function documentoCompleto(partes, reset = RESET_PADRAO) {
  return (
    '<!doctype html><html><head><meta charset=utf8>' +
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    // As quebras de linha em volta do corpo são as mesmas que a ferramenta Artifact grava.
    `<style>${reset}</style></head><body>\n${corpoDaPagina(partes)}\n</body></html>`
  );
}
