import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idDoYoutube, tipoPorUrl, urlValida } from '../src/nucleo/youtube.js';

test('idDoYoutube lê os formatos usados no site', () => {
  assert.equal(idDoYoutube('https://youtu.be/YHzoeE7-0sc'), 'YHzoeE7-0sc');
  assert.equal(idDoYoutube('https://www.youtube.com/watch?v=X7ANRp74wfk'), 'X7ANRp74wfk');
  assert.equal(idDoYoutube('https://www.youtube.com/watch?feature=share&v=_-iSF1mci-o'), '_-iSF1mci-o');
  assert.equal(idDoYoutube('https://www.youtube.com/embed/r3zU1NqWwG0'), 'r3zU1NqWwG0');
});

test('idDoYoutube devolve null para o que não é vídeo', () => {
  assert.equal(idDoYoutube('https://exemplo.com/a.pdf'), null);
  assert.equal(idDoYoutube(''), null);
  assert.equal(idDoYoutube(undefined), null);
});

test('tipoPorUrl ignora o que vem depois de ? e reconhece arquivos do Wix', () => {
  assert.equal(tipoPorUrl('https://youtu.be/YHzoeE7-0sc'), 'video');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_05f7.xlsx?dn=Sorvete.xlsx'), 'planilha');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_64bd.xls?dn=E'), 'planilha');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_521d.txt?dn=P'), 'codigo');
  assert.equal(tipoPorUrl('https://github.com/pantoniofran/GitSeminarioFinancas.git'), 'codigo');
  assert.equal(tipoPorUrl('https://x.filesusr.com/ugd/911fb9_0926.pdf'), 'slides');
  assert.equal(tipoPorUrl('https://exemplo.com/pagina'), 'link');
});

test('urlValida aceita só http e https', () => {
  assert.equal(urlValida('https://exemplo.com/a.pdf'), true);
  assert.equal(urlValida('http://dgp.cnpq.br/dgp/espelhogrupo/185576'), true);
  assert.equal(urlValida('exemplo.com'), false);
  assert.equal(urlValida('javascript:alert(1)'), false);
  assert.equal(urlValida(''), false);
});
