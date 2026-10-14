import { ler, gravar } from './caminhos.js';
import { mover, remover, inserir, novoId } from './listas.js';

export function aplicar(conteudo, op) {
  switch (op.op) {
    case 'gravar':
      return gravar(conteudo, op.caminho, op.valor);
    case 'subir':
      return gravar(conteudo, op.lista, mover(ler(conteudo, op.lista), op.i, -1));
    case 'descer':
      return gravar(conteudo, op.lista, mover(ler(conteudo, op.lista), op.i, 1));
    case 'remover':
      return gravar(conteudo, op.lista, remover(ler(conteudo, op.lista), op.i));
    case 'adicionar':
      // Disciplina antiga pode não ter a lista ainda (cronograma, por exemplo).
      return gravar(conteudo, op.lista, inserir(ler(conteudo, op.lista) ?? [], op.item));
    default:
      throw new Error(`operação desconhecida: ${op.op}`);
  }
}

export function novoItem(tipo, hoje, rand) {
  const ano = hoje.slice(0, 4);
  switch (tipo) {
    case 'aviso': return { id: novoId('av', rand), texto: '', ate: '' };
    case 'modulo': return { id: novoId('mo', rand), titulo: '', aulas: [] };
    case 'aula': return { id: novoId('au', rand), titulo: '', materiais: [], adicionadoEm: hoje };
    case 'evento': return { id: novoId('ev', rand), data: '', tipo: 'aula', titulo: '' };
    case 'texto': return { id: novoId('tx', rand), titulo: '', data: hoje, resumo: '', corpo: '' };
    case 'projeto': return { id: novoId('pj', rand), titulo: '', descricao: '' };
    case 'publicacao': return { id: novoId('pb', rand), ano, tipo: 'artigo', referencia: '' };
    case 'formacao': return { id: novoId('fo', rand), periodo: '', titulo: '', instituicao: '', detalhe: '' };
    case 'orientacao': return { id: novoId('or', rand), ano, nivel: 'Mestrado', aluno: '', titulo: '' };
    default: throw new Error(`tipo desconhecido: ${tipo}`);
  }
}
