import type { PostGenerationInput } from '../types';

/**
 * Planejamento de pauta: decide SOBRE O QUE escrever antes de escrever.
 *
 * Este passo não existia. A máquina de estados dos documentos começava em
 * `queued` com o tópico já preenchido, e nada no plano preenchia — quem
 * escolhia era um humano no TopicGenerator. Sem ele, o worker acorda de
 * madrugada e não sabe sobre o que escrever.
 *
 * A ordem aqui é deliberada: **deduplicar antes de gerar**. Comparar a pauta
 * com o histórico depois de produzir o artigo seria descobrir o desperdício
 * quando ele já foi pago.
 */

/** Similaridade entre dois títulos, de 0 a 1. */
export function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3); // fora artigos, preposições e ruído curto

  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared++;

  // Jaccard: interseção sobre união. Penaliza título curto que casa por acaso.
  return shared / (wordsA.size + wordsB.size - shared);
}

export interface TopicCandidate {
  title: string;
  angle?: string;
  newsHook?: string;
  category?: string;
}

export interface DedupResult {
  fresh: TopicCandidate[];
  rejected: { candidate: TopicCandidate; similarTo: string; score: number }[];
}

/**
 * Separa pautas inéditas das que repetem o que o blog já publicou.
 *
 * O limiar é intencionalmente baixo (0,45): no contexto de um blog de nicho,
 * dois títulos com metade das palavras significativas em comum quase sempre
 * são o mesmo artigo com outra roupa. Falso positivo aqui custa uma pauta
 * descartada; falso negativo custa um artigo inteiro e a impressão, no leitor,
 * de que o blog se repete.
 *
 * Isto é o mínimo viável. A versão boa compara embeddings do tópico — mas
 * embedding sem esta rede de segurança não é melhor, é só mais caro.
 */
export function dedupeTopics(
  candidates: TopicCandidate[],
  publishedTitles: string[],
  threshold = 0.45
): DedupResult {
  const fresh: TopicCandidate[] = [];
  const rejected: DedupResult['rejected'] = [];
  // Pautas já aceitas nesta rodada também contam: seis sugestões da mesma
  // chamada costumam trazer variações da mesma ideia.
  const seen = [...publishedTitles];

  for (const candidate of candidates) {
    let worst = { title: '', score: 0 };

    for (const title of seen) {
      const score = titleSimilarity(candidate.title, title);
      if (score > worst.score) worst = { title, score };
    }

    if (worst.score >= threshold) {
      rejected.push({ candidate, similarTo: worst.title, score: worst.score });
    } else {
      fresh.push(candidate);
      seen.push(candidate.title);
    }
  }

  return { fresh, rejected };
}

/**
 * Quantos artigos ainda cabem nesta semana.
 *
 * A cadência vive em `blog_secrets` e muda sem deploy. Vale lembrar por que
 * ela é baixa por padrão: publicação automatizada em volume é exatamente o
 * padrão que as políticas de conteúdo em massa dos buscadores miram. Poucos e
 * bons, não muitos e medianos.
 */
export function remainingThisWeek(
  cadencePerWeek: number,
  producedThisWeek: number
): number {
  return Math.max(0, cadencePerWeek - producedThisWeek);
}

/** Parâmetros de geração de um artigo enfileirado automaticamente. */
export function buildJobInput(topic: TopicCandidate): PostGenerationInput {
  return {
    topic: topic.title,
    depthLevel: 'intermediario',
    articleLength: 'medio',
    // Fact-check ligado por padrão no caminho automático: sem humano lendo,
    // a apuração é a única coisa entre o texto e uma afirmação inventada.
    enableFactCheck: true,
    visualStyle: 'tech_minimalist_vector',
  };
}
