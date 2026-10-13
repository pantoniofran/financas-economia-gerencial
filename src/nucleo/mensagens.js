export const SEM_ESCRITA = new Set([
  'not_writer', 'not_granted', 'not_declared', 'capability_disabled', 'capability_removed', 'consent_required',
]);

export const NAO_REPETIR = new Set([
  ...SEM_ESCRITA, 'conflict', 'too_large', 'invalid_content', 'read_only_path', 'rate_limited', 'transform_error',
]);

export function mensagemDePublicacao(code) {
  if (code === 'conflict') return 'O site foi publicado por outra aba ou outra pessoa. Suas alterações foram guardadas e reaparecem quando a página recarregar.';
  if (SEM_ESCRITA.has(code)) return 'Esta visualização é somente leitura. Entre com a conta que tem permissão de edição.';
  if (code === 'rate_limited') return 'Muitas publicações seguidas. Aguarde um minuto e publique de novo.';
  if (code === 'too_large') return 'O site passou do tamanho máximo. Remova textos muito longos e publique de novo.';
  if (code === 'invalid_content' || code === 'transform_error') return 'O site não pôde ser montado para publicação. Suas alterações continuam salvas neste navegador.';
  return 'Não foi possível publicar. Suas alterações continuam salvas neste navegador.';
}

export function mensagemDeEnvio(code) {
  if (code === 'too_large') return 'O arquivo passa de 20 MB. Cole um link para ele (do Drive, por exemplo).';
  if (code === 'unsupported_type') return 'Esse tipo de arquivo não é aceito aqui. Envie um PDF ou cole um link.';
  if (code === 'quota_or_state') return 'O espaço de arquivos do site está cheio. Cole um link no lugar.';
  if (code === 'rate_limited') return 'Muitos envios seguidos. Aguarde um minuto e tente de novo.';
  if (SEM_ESCRITA.has(code) || code === 'not_uploader') return 'Esta conta não pode enviar arquivos. Cole um link no lugar.';
  return 'Não foi possível enviar o arquivo. Tente de novo ou cole um link.';
}
