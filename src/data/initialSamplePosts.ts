import { ArticlePost } from '../types';

export const INITIAL_SAMPLE_POSTS: ArticlePost[] = [
  {
    id: 'post_tech_sample_01',
    blogId: 'blog_tech_studio',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topic: 'Arquitetura de Agentes Autônomos e LLMs em Produção',
    authorName: 'Redação Tech',
    tone: 'Analítico e Prático',
    depthLevel: 'aprofundado',
    targetAudience: 'Engenheiros de Software e Arquitetos de Soluções',
    tags: ['Inteligência Artificial', 'Arquitetura', 'Agentes LLM', 'Engenharia de Software'],
    status: 'completed',
    isPublished: true,
    publishedAt: new Date().toISOString(),
    input: {
      topic: 'Arquitetura de Agentes Autônomos e LLMs em Produção',
      depthLevel: 'aprofundado',
      articleLength: 'longo',
      visualStyle: 'tech_minimalist_vector',
    },
    draft: {
      title: 'Arquitetura de Agentes Autônomos: Do Playground aos Sistemas Distribuídos em Produção',
      subtitle: 'Como desenhar orquestrações determinísticas, gerenciar memória de longo prazo e evitar alucinações em sistemas de IA de missão crítica.',
      rawText: `# Arquitetura de Agentes Autônomos: Do Playground aos Sistemas Distribuídos em Produção

A transição de chamadas diretas a modelos de linguagem (LLMs) para **sistemas autônomos multi-agentes** representa um salto de paradigma na engenharia de software contemporânea. Não se trata apenas de enviar prompts mais elaborados, mas de desenhar arquiteturas capazes de planejar, executar ferramentas de forma determinística, avaliar os próprios resultados e recuperar-se de falhas em tempo de execução.

---

## 1. O Desafio da Determinabilidade em Loop Agêntico

Enquanto sistemas tradicionais operam com controle de fluxo imperativo bem definido, um agente autônomo opera em um **loop de observação, raciocínio e ação**. Em ambientes de produção, permitir que o modelo tome decisões sem restrições leva a problemas clássicos:

- **Loops Infinitos de Execução:** Tentativas consecutivas de corrigir erros com as mesmas chamadas de API inválidas.
- **Explosão de Contexto e Custo:** Acúmulo desnecessário de histórico de tokens a cada iteração do agente.
- **Efeitos Colaterais Não-Atômicos:** Execução parcial de chamadas a bancos de dados ou APIs externas sem rollback configurado.

Para mitigar esses riscos, arquiteturas modernas como *LangGraph* e máquinas de estados finitos (FSM) impõem restrições explícitas sobre os grafos de transição dos agentes, garantindo pontos de controle (*human-in-the-loop*) e limites de profundidade.

---

## 2. Padrões Essenciais de Memória e RAG Avançado

Um dos pilares da engenharia de agentes é o gerenciamento de memória. Dividimos a arquitetura de memória em três camadas fundamentais:

1. **Memória Episódica (Scratchpad):** Armazena os passos imediatos e raciocínios intermediários do agente durante a execução de uma tarefa específica.
2. **Memória de Curto Prazo (Janela Contextual):** Gerenciada via técnicas de compressão e sumarização adaptativa de histórico de conversação.
3. **Memória Semântica de Longo Prazo:** Implementada com banco de dados vetoriais (Vector DBs) e busca híbrida (BM25 + Dense Embeddings) para recuperação precisa de contexto via RAG (Retrieval-Augmented Generation).

---

## 3. Conclusão e Próximos Passos na Engenharia de IA

Construir agentes autônomos confiáveis exige tratar o LLM como um componente de raciocínio não-determinístico envolto em barreiras rígidas de software tradicional. O futuro da engenharia de software reside na convergência entre resiliência de sistemas distribuídos e flexibilidade dos modelos generativos.`,
      outline: [
        'Introdução e Mudança de Paradigma',
        '1. O Desafio da Determinabilidade em Loop Agêntico',
        '2. Padrões Essenciais de Memória e RAG Avançado',
        '3. Conclusão e Próximos Passos na Engenharia de IA',
      ],
      generatedAt: new Date().toISOString(),
    },
    review: {
      revisedTitle: 'Arquitetura de Agentes Autônomos: Do Playground aos Sistemas Distribuídos em Produção',
      revisedSubtitle: 'Como desenhar orquestrações determinísticas, gerenciar memória de longo prazo e evitar alucinações em sistemas de IA de missão crítica.',
      revisedText: `# Arquitetura de Agentes Autônomos: Do Playground aos Sistemas Distribuídos em Produção

A transição de chamadas diretas a modelos de linguagem (LLMs) para **sistemas autônomos multi-agentes** representa um salto de paradigma na engenharia de software contemporânea. Não se trata apenas de enviar prompts mais elaborados, mas de desenhar arquiteturas capazes de planejar, executar ferramentas de forma determinística, avaliar os próprios resultados e recuperar-se de falhas em tempo de execução.

---

## 1. O Desafio da Determinabilidade em Loop Agêntico

Enquanto sistemas tradicionais operam com controle de fluxo imperativo bem definido, um agente autônomo opera em um **loop de observação, raciocínio e ação**. Em ambientes de produção, permitir que o modelo tome decisões sem restrições leva a problemas clássicos:

- **Loops Infinitos de Execução:** Tentativas consecutivas de corrigir erros com as mesmas chamadas de API inválidas.
- **Explosão de Contexto e Custo:** Acúmulo desnecessário de histórico de tokens a cada iteração do agente.
- **Efeitos Colaterais Não-Atômicos:** Execução parcial de chamadas a bancos de dados ou APIs externas sem rollback configurado.

Para mitigar esses riscos, arquiteturas modernas impõem restrições explícitas sobre os grafos de transição dos agentes, garantindo pontos de controle (*human-in-the-loop*) e limites de profundidade.

---

## 2. Padrões Essenciais de Memória e RAG Avançado

Um dos pilares da engenharia de agentes é o gerenciamento de memória. Dividimos a arquitetura de memória em três camadas fundamentais:

1. **Memória Episódica (Scratchpad):** Armazena os passos imediatos e raciocínios intermediários do agente durante a execução de uma tarefa específica.
2. **Memória de Curto Prazo (Janela Contextual):** Gerenciada via técnicas de compressão e sumarização adaptativa de histórico de conversação.
3. **Memória Semântica de Longo Prazo:** Implementada com banco de dados vetoriais (Vector DBs) e busca híbrida (BM25 + Dense Embeddings) para recuperação precisa de contexto via RAG (Retrieval-Augmented Generation).

---

## 3. Conclusão e Próximos Passos na Engenharia de IA

Construir agentes autônomos confiáveis exige tratar o LLM como um componente de raciocínio não-determinístico envolto em barreiras rígidas de software tradicional. O futuro da engenharia de software reside na convergência entre resiliência de sistemas distribuídos e flexibilidade dos modelos generativos.`,
      clinicalNotes: 'Artigo revisado com excelência técnica, clareza didática e termos alinhados às melhores práticas de arquitetura de software e sistemas distribuídos.',
      humanizationNotes: 'Eliminados chavões de IA e conectores mecânicos. Tom de voz autoritativo, fluido e focado no ecossistema dev.',
      conceptualNotes: 'Fundamentação conceitual consistente sobre grafos de estados, recuperação híbrida e tolerância a falhas em sistemas de agentes.',
      ethicsCheckPassed: true,
      ethicsDetails: 'Isenção editorial e precisão técnica verificadas.',
      metaDescription: 'Análise técnica sobre arquitetura de agentes autônomos, controle de estado, memória RAG e engenharia de software em IA.',
      socialCaption: 'Do playground à produção: como projetar agentes autônomos e sistemas de IA com resiliência e controle determinístico.',
      hashtags: ['#SoftwareEngineering', '#ArtificialIntelligence', '#LLM', '#SystemArchitecture', '#DevCommunity'],
      suggestedTags: ['Engenharia de Software', 'IA', 'Agentes LLM', 'Arquitetura'],
      keyTakeaways: [
        'Sistemas agênticos exigem máquinas de estado restritas para conter o não-determinismo.',
        'A gestão de memória em três camadas (episódica, de contexto e vetorial) é crítica para o desempenho.',
        'RAG híbrido (BM25 + Vetores) reduz alucinações e garante alta precisão em consultas complexas.',
      ],
      readingTimeMinutes: 6,
    },
    image: {
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
      promptUsed: 'Modern minimal vector illustration for a tech software engineering blog, sleek geometric network nodes, clean code aesthetic, dark slate background with cyan and teal accents',
      conceptExplanation: 'Composição minimalista retratando nós de rede e dados interconectados sob fundo escuro tecnológico.',
      altText: 'Ilustração vetorial minimalista de arquitetura de software e IA',
      styleUsed: 'Ilustração Tech Minimalista',
    },
  },
];
