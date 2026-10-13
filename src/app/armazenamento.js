// Única peça que conhece o Claude. Na fase do domínio próprio, troca-se só este arquivo.
const SEM_ACESSO = {
  podeEnviar: false,
  async podeEditar() { return false; },
  async publicar() { throw { code: 'not_granted' }; },
  async enviarArquivo() { throw { code: 'not_granted' }; },
};

export async function criarArmazenamento(ambiente) {
  if (ambiente !== 'artifact' || !window.claude?.use) return SEM_ACESSO;
  const pedir = (nome) => window.claude.use(nome).catch(() => null);
  const [artifact, assets, user] = await Promise.all([pedir('artifact'), pedir('assets'), pedir('user')]);
  if (!artifact) return SEM_ACESSO;
  return {
    podeEnviar: Boolean(assets),
    async podeEditar() {
      try { return user ? await user.canEdit() : true; } catch { return false; }
    },
    publicar: (html) => artifact.publish(html),
    async enviarArquivo(blob) {
      if (!assets) throw { code: 'not_granted' };
      return (await assets.upload(blob)).url;
    },
  };
}

export function armazenamentoDeEnsaio(aoPublicar) {
  return {
    podeEnviar: false,
    async podeEditar() { return true; },
    async publicar(html) { aoPublicar(html); },
    async enviarArquivo() { throw { code: 'not_granted' }; },
  };
}
