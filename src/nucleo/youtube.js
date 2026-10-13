const PADRAO = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;

export function idDoYoutube(url) {
  const m = PADRAO.exec(String(url ?? ''));
  return m ? m[1] : null;
}

export function tipoPorUrl(url) {
  if (idDoYoutube(url)) return 'video';
  const base = String(url ?? '').split(/[?#]/)[0].toLowerCase();
  if (/\.(xlsx?|csv|ods)$/.test(base)) return 'planilha';
  if (/\.(r|py|ipynb|txt)$/.test(base) || base.includes('github.com')) return 'codigo';
  if (base.endsWith('.pdf')) return 'slides';
  return 'link';
}

export function urlValida(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
