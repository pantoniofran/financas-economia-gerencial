const fichaVazia = () => ({ ementa: '', objetivos: '', avaliacao: '', bibliografia: '' });

export function conteudoExemplo() {
  return {
    site: {
      titulo: 'Finanças e Economia Gerencial',
      professor: 'Prof. Dr. Antonio Francisco',
      instituicao: 'Escola de Administração da UFBA',
      chamada: 'Material de aula, pesquisa e textos em um só lugar.',
      laboratorio: 'Planilhas, scripts e vídeos de apoio às disciplinas.',
      proposito: 'Texto do propósito.',
    },
    disciplinas: [
      {
        id: 'eg', nivel: 'graduacao', nome: 'Economia Gerencial', ficha: fichaVazia(),
        avisos: [
          { id: 'av-1', texto: 'Prova na quinta', ate: '2026-11-12' },
          { id: 'av-2', texto: 'Aviso vencido', ate: '2026-01-01' },
        ],
        modulos: [
          {
            id: 'eg-1', titulo: 'Princípios de Microeconomia',
            aulas: [
              {
                id: 'eg-1-1', titulo: 'Curva de Demanda',
                materiais: [
                  { id: 'eg-1-1-m1', tipo: 'slides', nome: 'Slides da aula', url: 'https://exemplo.com/a.pdf' },
                  { id: 'eg-1-1-m2', tipo: 'video', nome: 'Vídeo da aula', url: 'https://youtu.be/YHzoeE7-0sc' },
                ],
              },
              { id: 'eg-1-2', titulo: 'Custos da Firma', materiais: [] },
            ],
          },
          { id: 'eg-2', titulo: 'Teoria dos Jogos', aulas: [{ id: 'eg-2-1', titulo: 'Definições', materiais: [] }] },
        ],
      },
      { id: 'aep', nivel: 'pos', nome: 'Avaliação Econômica de Projetos', ficha: fichaVazia(), avisos: [], modulos: [] },
    ],
    laboratorio: [
      { grupo: 'Planilhas', itens: [{ id: 'lab-1', tipo: 'planilha', nome: 'Planilha do modelo CAPM', url: 'https://exemplo.com/capm.xls' }] },
    ],
    textos: [
      { id: 'financas-verdes', titulo: 'Finanças Verdes', data: '2020-09-27', resumo: 'Como financiar projetos.', corpo: 'Primeiro parágrafo.\n\nSegundo parágrafo.' },
    ],
    pesquisa: {
      linhas: 'Análise de investimentos e gestão de riscos.',
      grupo: { nome: 'Grupo de Pesquisa em Finanças - UFBA', url: 'http://dgp.cnpq.br/dgp/espelhogrupo/185576' },
      projetos: [{ id: 'pj-1', titulo: 'Green Finance no Brasil', descricao: '' }],
      publicacoes: [
        { id: 'pb-1', ano: '2023', tipo: 'artigo', referencia: 'SANTOS, J. P. Análise envoltória de dados.' },
        { id: 'pb-2', ano: '2021', tipo: 'artigo', referencia: 'CALDAS, A. V. S. Comparative evaluation.' },
      ],
    },
    sobre: {
      nome: 'Antonio Francisco de Almeida da Silva Junior',
      cargo: 'Professor da Escola de Administração da UFBA',
      resumo: 'Resumo do currículo.',
      formacao: [{ id: 'fo-1', periodo: '2004 – 2006', titulo: 'Doutorado', instituicao: 'ITA', detalhe: '' }],
      areas: 'Finanças: risco\nFinanças: investimento',
      orientacoes: [{ id: 'or-1', ano: '2022', nivel: 'Doutorado', aluno: 'Viviane Helena Torinelli', titulo: 'Environmental and Climate Risk Management' }],
      lattes: 'http://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K4796527A6',
      email: 'p.antoniofran@gmail.com',
      english: 'Short vitae.',
    },
  };
}
