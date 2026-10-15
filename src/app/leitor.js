// Leitor de PDF do modo de estudo: o aluno acompanha os slides ao lado do vídeo, sem sair da página.
// Usa o PDF.js publicado junto com o site (vendor/pdfjs), carregado só quando uma aula tem PDF.

const PASTA = 'vendor/pdfjs/';
let biblioteca = null;
let aberto = null; // documento em exibição, liberado ao trocar de material ou de tela
let vez = 0; // descarta o resultado de um carregamento que ficou para trás
let imagens = []; // endereços das páginas já desenhadas, liberados junto com o documento

function carregarBiblioteca() {
  biblioteca ??= new Promise((pronto, falha) => {
    const s = document.createElement('script');
    s.src = `${PASTA}pdf.min.js`;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PASTA}pdf.worker.min.js`;
      pronto(window.pdfjsLib);
    };
    s.onerror = () => {
      biblioteca = null;
      falha(new Error('PDF.js indisponível'));
    };
    document.head.append(s);
  });
  return biblioteca;
}

export function fecharLeitor() {
  vez += 1;
  aberto?.destroy();
  aberto = null;
  for (const u of imagens) URL.revokeObjectURL(u);
  imagens = [];
}

const aviso = (texto) => {
  const p = document.createElement('p');
  p.className = 'leitor-aviso';
  p.textContent = texto;
  return p;
};

export async function abrirLeitor(leitor, url) {
  fecharLeitor();
  const minha = vez;
  leitor.replaceChildren(aviso('Carregando o material…'));
  leitor.setAttribute('aria-busy', 'true');
  try {
    const pdfjs = await carregarBiblioteca();
    // isEvalSupported desligado: fecha a brecha de fontes maliciosas conhecida nesta versão do PDF.js.
    const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
    if (minha !== vez) return void doc.destroy();
    aberto = doc;
    const primeira = (await doc.getPage(1)).getViewport({ scale: 1 });
    if (minha !== vez) return undefined;
    // Cada página ocupa seu espaço desde já (proporção da primeira) e só é desenhada quando chega perto da vista.
    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        observador.unobserve(e.target);
        desenharPagina(doc, e.target, minha);
      }
    }, { root: leitor, rootMargin: '600px 0px' });
    const folhas = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const folha = document.createElement('div');
      folha.className = 'pagina-pdf';
      folha.dataset.pagina = String(n);
      folha.style.aspectRatio = `${primeira.width} / ${primeira.height}`;
      folhas.push(folha);
    }
    leitor.replaceChildren(...folhas);
    leitor.scrollTop = 0;
    for (const f of folhas) observador.observe(f);
  } catch {
    if (minha !== vez) return undefined;
    leitor.replaceChildren(aviso('Não deu para mostrar o material aqui. Use o link abaixo para abrir o PDF.'));
  } finally {
    if (minha === vez) leitor.setAttribute('aria-busy', 'false');
  }
  return undefined;
}

// A página vira imagem: o navegador guarda imagens fora da tela com muito menos memória que um canvas,
// o que importa no celular com apostilas de muitas páginas.
async function desenharPagina(doc, folha, minha) {
  try {
    const n = Number(folha.dataset.pagina);
    const pagina = await doc.getPage(n);
    // Com folga de duas vezes os pixels da tela (e pelo menos 1.400): letra miúda de slide fica nítida,
    // também em tela cheia. O teto segura a memória do celular.
    const largura = Math.min(2400, Math.max(1400, folha.clientWidth * (devicePixelRatio || 1) * 2));
    const viewport = pagina.getViewport({ scale: largura / pagina.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (minha !== vez) return;
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.95));
    if (minha !== vez || !blob) return;
    const img = new Image();
    img.alt = `Página ${n} de ${doc.numPages}`;
    img.decoding = 'async';
    img.src = URL.createObjectURL(blob);
    imagens.push(img.src);
    folha.replaceChildren(img);
  } catch {
    // página que falhou fica em branco; o link para o PDF continua logo abaixo
  }
}
