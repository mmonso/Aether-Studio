import type { UserManifesto } from '../types';

/**
 * Verificação determinística de qualidade — sem IA.
 *
 * Esta é a primeira barreira da triagem, e existe por dois motivos:
 *
 * 1. NÃO CUSTA CHAMADA. Roda antes do crítico e do auditor factual. Um texto
 *    que já falha aqui não merece o gasto das etapas caras.
 *
 * 2. NÃO OPINA. O checklist do projeto pede que "todo veto seja número ou
 *    booleano lido por código, não prosa". Um modelo julgando outro modelo
 *    concorda com facilidade demais; contagem de conector não negocia.
 *
 * O que ela NÃO faz: julgar se o argumento é bom. Isso é do crítico (F3.3) e
 * do auditor factual. Aqui só se mede o que dá para contar.
 */

// ---------------------------------------------------------------------------
// Marcadores
// ---------------------------------------------------------------------------

/**
 * Conectores de abertura de frase que denunciam texto de máquina.
 *
 * Critério de entrada nesta lista: ser um conector que o modelo usa para
 * *simular* encadeamento lógico onde não há nenhum. Por isso `ou seja` e `por
 * exemplo` ficam de fora — são prosa humana normal. `Vale ressaltar` e `Além
 * disso` entram porque o próprio manifesto do blog 1 já os nomeia como vício.
 */
const BUREAUCRATIC_CONNECTORS = [
  'contudo',
  'entretanto',
  'todavia',
  'ademais',
  'outrossim',
  'por conseguinte',
  'consequentemente',
  'dessa forma',
  'desse modo',
  'dessa maneira',
  'nesse sentido',
  'neste sentido',
  'além disso',
  'em suma',
  'em síntese',
  'por fim',
  'vale ressaltar',
  'vale destacar',
  'vale notar',
  'vale mencionar',
  'é importante notar',
  'é importante ressaltar',
  'é importante destacar',
  'é fundamental notar',
  'cabe ressaltar',
  'cabe destacar',
  'nesse contexto',
  'neste contexto',
  'diante disso',
  'diante desse cenário',
  'sendo assim',
  'assim sendo',
  'em última análise',
  'em contrapartida',
];

/**
 * Frases feitas. Custam nada para o modelo e não dizem nada ao leitor.
 *
 * `paradigma` sozinho não está aqui de propósito: é palavra técnica legítima
 * ("paradigma sem estado"). O vício é `mudança de paradigma`.
 */
const CLICHES = [
  'divisor de águas',
  'game changer',
  'mudança de paradigma',
  'revolucionar',
  'revolucionário',
  'revolucionária',
  'no cenário atual',
  'no mundo atual',
  'cada vez mais',
  'ponta de lança',
  'estado da arte',
  'com elegância',
  'de forma robusta',
  'de forma elegante',
  'sem precedentes',
  'a chave para',
  'o santo graal',
  'desbloquear o potencial',
  'potencial ilimitado',
  'na era da',
  'na era digital',
  'mergulhar fundo',
  'em um mundo onde',
  'num mundo onde',
  'mais do que nunca',
  'abordagem holística',
  'solução completa',
  'tecnologia de ponta',
  'peça-chave',
  'não é mais uma questão de se',
];

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export interface TextMetrics {
  words: number;
  sentences: number;
  paragraphs: number;
  /** Quantidade de `##` — quanto o texto foi fatiado em seções. */
  sections: number;
  meanSentenceWords: number;
  /**
   * Coeficiente de variação do tamanho das frases (desvio ÷ média).
   *
   * A métrica mais reveladora do conjunto. Prosa humana oscila: uma frase de
   * trinta palavras, depois uma de quatro. O modelo tende a produzir frases
   * de comprimento parecido, uma atrás da outra — o ritmo fica plano mesmo
   * quando o vocabulário está bom.
   */
  sentenceLengthCv: number;
  connectorsPer1000: number;
  clichesPer1000: number;
  /** Percentual de frases que contêm algum número. Concretude medível. */
  sentencesWithNumbersPct: number;
  links: number;
  codeBlocks: number;
  emDashesPer1000: number;
  /** Enumerações "A, B e C" — o modelo adora, em série. */
  tricolonsPer1000: number;
  /** Construções "não apenas X, mas também Y". */
  notOnlyButAlso: number;
  longestParagraphWords: number;
}

export interface QualityFinding {
  /** Identificador estável, para agrupar e medir depois (F5). */
  code: string;
  severity: 'veto' | 'aviso';
  message: string;
  /** Os trechos exatos, para o redator não ter que caçar. */
  evidence: string[];
}

export interface QualityThresholds {
  connectorsPer1000: number;
  clichesPer1000: number;
  minSentenceLengthCv: number;
  minWords: number;
  maxWords: number;
  /** Sem número nem link em nenhum lugar vira veto, e não aviso. */
  requireConcreteness: boolean;
  tricolonsPer1000: number;
  notOnlyButAlso: number;
}

/**
 * Padrões iniciais, calibrados contra os quatro artigos reais do blog 1 —
 * dois publicados e dois que o worker escreveu sozinho (`npm run audit:posts`).
 *
 * O que a medição mostrou, e que mudou estes números:
 *
 * - Conector: 0 a 2,56 por mil palavras nos quatro. Um teto de 10 nunca
 *   dispararia — seria veto morto. Baixado para 6, o dobro do pior caso real.
 * - Ritmo: 0,32 a 0,43. O corte em 0,35 pega inclusive um artigo publicado, e
 *   com razão: aquele texto tem mesmo frase toda do mesmo tamanho. Fica aviso.
 * - Fonte linkada: ZERO nos quatro artigos, sem exceção. Não é ruído de
 *   calibração, é uma lacuna do pipeline — nem o fact-check devolve link para
 *   dentro do texto. O aviso fica ligado de propósito, para parar de disparar
 *   quando a F3.1 consertar a origem.
 *
 * Não são verdade revelada: a F5 existe para ajustá-los contra o conjunto de
 * referência julgado por humano, quando ele existir.
 */
export const DEFAULT_THRESHOLDS: QualityThresholds = {
  connectorsPer1000: 6,
  clichesPer1000: 3,
  minSentenceLengthCv: 0.35,
  minWords: 700,
  maxWords: 3500,
  requireConcreteness: false,
  tricolonsPer1000: 8,
  notOnlyButAlso: 2,
};

export interface QualityAudit {
  /** O único campo que o worker precisa ler para decidir. */
  passed: boolean;
  /** 0 a 10. Serve para ranquear, não para vetar. */
  score: number;
  findings: QualityFinding[];
  metrics: TextMetrics;
  /**
   * Regras do manifesto que o código não consegue verificar — vão para o
   * crítico com IA. Ver `splitProhibitedTerms`.
   */
  unverifiableRules: string[];
}

// ---------------------------------------------------------------------------
// Preparo do texto
// ---------------------------------------------------------------------------

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const fold = (s: string) => stripAccents(s.toLowerCase());

interface PreparedText {
  /** Prosa, sem código, sem cabeçalho, com o texto dos links preservado. */
  prose: string;
  paragraphs: string[];
  sentences: string[];
  codeBlocks: number;
  links: number;
  sections: number;
}

/**
 * Separa o que é prosa do que é estrutura.
 *
 * Bloco de código e URL entram nas contas de palavra e de frase e distorcem
 * tudo: um trecho de YAML vira "frase" de quarenta palavras sem verbo.
 */
export function prepareText(markdown: string): PreparedText {
  let codeBlocks = 0;
  let links = 0;

  const withoutCode = markdown.replace(/```[\s\S]*?```/g, () => {
    codeBlocks += 1;
    return '\n\n';
  });

  const sections = (withoutCode.match(/^#{2,3}\s+/gm) || []).length;

  const withoutHeadings = withoutCode.replace(/^#{1,6}\s+.*$/gm, '');

  // Link vira o próprio texto: "[Postgres](url)" conta como a palavra Postgres.
  const withoutLinks = withoutHeadings.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text) => {
    links += 1;
    return text;
  });

  const prose = withoutLinks
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_>]/g, '')
    .replace(/^\s*[-–—]\s+/gm, '')
    .trim();

  const paragraphs = prose
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  return { prose, paragraphs, sentences: splitSentences(prose), codeBlocks, links, sections };
}

/**
 * Quebra em frases sem cair nas armadilhas do português.
 *
 * Não separa em `3.5`, `Dr.` nem `p.ex.` — cada um desses inflaria a contagem
 * de frases curtas e mascararia justamente a uniformidade que a métrica de
 * ritmo tenta capturar.
 *
 * `etc.` é caso à parte: diferente de `Dr.`, ele pode encerrar frase. A
 * distinção é o que vem depois — maiúscula significa frase nova.
 */
export function splitSentences(text: string): string[] {
  /** Nunca encerram frase: o que vem depois é o nome, a figura, o exemplo. */
  const NEVER_TERMINAL = ['sr', 'sra', 'dr', 'dra', 'prof', 'profa', 'ex', 'p.ex', 'vs', 'fig', 'ed'];
  /** Podem encerrar frase; decide-se pela maiúscula seguinte. */
  const MAYBE_TERMINAL = ['etc'];

  const out: string[] = [];
  let buffer = '';

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    buffer += ch;

    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;

    const next = text[i + 1];
    // "3.5", "1.000" — número, não fim de frase.
    if (ch === '.' && /\d/.test(text[i - 1] || '') && /\d/.test(next || '')) continue;
    // Precisa vir espaço ou fim do texto depois.
    if (next && !/[\s\n]/.test(next)) continue;

    const lastWord = fold(buffer.trim().split(/[\s(]/).pop() || '').replace(/\.$/, '');
    if (NEVER_TERMINAL.includes(lastWord)) continue;
    if (MAYBE_TERMINAL.includes(lastWord) && !startsNewSentence(text, i + 1)) continue;

    const trimmed = buffer.trim();
    if (trimmed) out.push(trimmed);
    buffer = '';
  }

  const rest = buffer.trim();
  if (rest) out.push(rest);

  return out.filter((s) => /[\wÀ-ú]/.test(s));
}

/** O próximo caractere visível é maiúscula? Então ali começa outra frase. */
function startsNewSentence(text: string, from: number): boolean {
  const rest = text.slice(from).replace(/^\s+/, '');
  if (!rest) return true;
  const first = rest[0];
  return first === first.toUpperCase() && first !== first.toLowerCase();
}

const countWords = (s: string) => (s.match(/[\wÀ-ú]+(?:[-'][\wÀ-ú]+)*/g) || []).length;

export function measure(markdown: string): TextMetrics {
  const { paragraphs, sentences, codeBlocks, links, sections, prose } = prepareText(markdown);

  const sentenceWordCounts = sentences.map(countWords).filter((n) => n > 0);
  const words = sentenceWordCounts.reduce((a, b) => a + b, 0);
  const per1000 = (n: number) => (words === 0 ? 0 : round2((n * 1000) / words));

  const mean = sentenceWordCounts.length
    ? words / sentenceWordCounts.length
    : 0;
  const variance = sentenceWordCounts.length
    ? sentenceWordCounts.reduce((acc, n) => acc + (n - mean) ** 2, 0) / sentenceWordCounts.length
    : 0;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  const folded = fold(prose);

  const connectorHits = sentences.filter((s) => matchConnector(s)).length;
  const clicheHits = CLICHES.reduce(
    (acc, c) => acc + countOccurrences(folded, fold(c)),
    0
  );

  const withNumbers = sentences.filter((s) => /\d/.test(s)).length;

  const tricolons = (
    prose.match(/(?:[\wÀ-ú]+(?:\s+[\wÀ-ú]+){0,2},\s+){2,}[\wÀ-ú]+(?:\s+[\wÀ-ú]+){0,2}\s+e\s+/gi) ||
    []
  ).length;

  const notOnly = (prose.match(/n[ãa]o\s+(?:apenas|s[óo]|somente)[^.!?]{0,90}?\bmas\b/gi) || [])
    .length;

  return {
    words,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    sections,
    meanSentenceWords: round2(mean),
    sentenceLengthCv: round2(cv),
    connectorsPer1000: per1000(connectorHits),
    clichesPer1000: per1000(clicheHits),
    sentencesWithNumbersPct: sentences.length
      ? round2((withNumbers * 100) / sentences.length)
      : 0,
    links,
    codeBlocks,
    emDashesPer1000: per1000((prose.match(/—/g) || []).length),
    tricolonsPer1000: per1000(tricolons),
    notOnlyButAlso: notOnly,
    longestParagraphWords: paragraphs.reduce((max, p) => Math.max(max, countWords(p)), 0),
  };
}

/** Conector só conta quando abre a frase — é ali que ele finge encadeamento. */
function matchConnector(sentence: string): string | null {
  const head = fold(sentence).replace(/^[^\wÀ-ú]+/, '');
  for (const c of BUREAUCRATIC_CONNECTORS) {
    const f = fold(c);
    if (head.startsWith(f) && /^[\s,]/.test(head.slice(f.length))) return c;
  }
  return null;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Números inventados
// ---------------------------------------------------------------------------

/**
 * Extrai as afirmações numéricas do texto, na forma normalizada.
 *
 * Só entram números que afirmam alguma coisa: com unidade, com percentual, ou
 * com dois dígitos ou mais. `1.` de lista numerada e "3 passos" ficam de fora —
 * senão o detector viraria ruído e ninguém olharia para ele.
 */
export function numericClaims(text: string): string[] {
  const withoutCode = text.replace(/```[\s\S]*?```/g, ' ');
  const matches =
    withoutCode.match(/\d[\d.,]*\s*(?:%|ms|s\b|GB|MB|TB|KB|GHz|MHz|x\b|k\b|tokens?\/s)?/gi) || [];

  const claims = matches
    .map((m) => m.replace(/\s+/g, '').replace(/[.,]$/, '').toLowerCase())
    .filter((m) => {
      const digits = (m.match(/\d/g) || []).length;
      const hasUnit = /[a-z%]/.test(m);
      return digits >= 2 || hasUnit;
    });

  return [...new Set(claims)];
}

/**
 * Números que apareceram na correção e não existiam em lugar nenhum antes.
 *
 * Isto não é zelo teórico. Ao rodar o ciclo completo contra um artigo real, o
 * crítico pediu "dados empíricos"; o redator obedeceu e INVENTOU um benchmark
 * completo — com números, unidades e um erro de cálculo junto. A instrução no
 * prompt dizia explicitamente para não inventar e registrar o que faltasse em
 * `unresolved`: voltou com zero itens em `unresolved` e o benchmark fabricado.
 *
 * Pedir evidência a quem não tem fonte produz evidência falsa. Instrução não
 * resolve isso; comparação de strings resolve.
 */
export function detectInventedNumbers(
  after: string,
  before: string,
  evidence = ''
): string[] {
  const known = new Set([...numericClaims(before), ...numericClaims(evidence)]);
  return numericClaims(after).filter((claim) => !known.has(claim));
}

// ---------------------------------------------------------------------------
// Termos proibidos do manifesto
// ---------------------------------------------------------------------------

/**
 * `prohibitedTerms` não contém termos. Contém regras.
 *
 * Descoberto lendo o manifesto real do blog 1, onde as entradas são frases
 * como `Uso apelativo do pronome "você"` e `Clichês genéricos de marketing
 * ("game changer")`. Procurar essas frases inteiras no artigo não acharia
 * nada nunca — e o veto passaria a vida inteira dando verde.
 *
 * Então: o que está entre aspas é literal e o código verifica. O resto é
 * regra de julgamento e vai para o crítico com IA, que é quem sabe julgar.
 * Nada é descartado em silêncio.
 */
export function splitProhibitedTerms(terms: string[] = []): {
  literals: string[];
  rules: string[];
} {
  const literals: string[] = [];
  const rules: string[] = [];

  for (const raw of terms) {
    const term = (raw || '').trim();
    if (!term) continue;

    const quoted = [...term.matchAll(/["“”']([^"“”']{2,})["“”']/g)].map((m) => m[1].trim());
    if (quoted.length) {
      literals.push(...quoted);
      rules.push(term);
      continue;
    }

    // Sem aspas: até três palavras ainda é um termo; mais que isso é uma regra.
    if (countWords(term) <= 3) literals.push(term);
    else rules.push(term);
  }

  return { literals: dedupe(literals), rules: dedupe(rules) };
}

const dedupe = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export function auditText(
  markdown: string,
  manifesto?: Partial<UserManifesto> | null,
  overrides?: Partial<QualityThresholds>
): QualityAudit {
  const t = { ...DEFAULT_THRESHOLDS, ...(overrides || {}) };
  const metrics = measure(markdown);
  const findings: QualityFinding[] = [];

  const { literals, rules } = splitProhibitedTerms(
    (manifesto?.prohibitedTerms as string[] | undefined) || []
  );

  const prose = prepareText(markdown).prose;
  const folded = fold(prose);

  const hitTerms = literals.filter((term) => {
    const f = fold(term);
    // Palavra isolada precisa de fronteira; expressão pode casar direto.
    if (!/\s/.test(f)) {
      return new RegExp(`(^|[^\\wÀ-ú])${escapeRegex(f)}([^\\wÀ-ú]|$)`).test(folded);
    }
    return folded.includes(f);
  });

  if (hitTerms.length) {
    findings.push({
      code: 'termo-proibido',
      severity: 'veto',
      message: `O manifesto proíbe ${hitTerms.length === 1 ? 'este termo' : 'estes termos'}.`,
      evidence: hitTerms.map((term) => quoteContext(prose, term)),
    });
  }

  if (metrics.words < t.minWords) {
    findings.push({
      code: 'curto-demais',
      severity: 'veto',
      message: `${metrics.words} palavras, abaixo do mínimo de ${t.minWords}.`,
      evidence: [],
    });
  }

  if (metrics.words > t.maxWords) {
    findings.push({
      code: 'longo-demais',
      severity: 'veto',
      message: `${metrics.words} palavras, acima do teto de ${t.maxWords}.`,
      evidence: [],
    });
  }

  if (metrics.connectorsPer1000 > t.connectorsPer1000) {
    findings.push({
      code: 'conector-burocratico',
      severity: 'veto',
      message:
        `${metrics.connectorsPer1000} conectores de abertura por mil palavras ` +
        `(teto: ${t.connectorsPer1000}). É a marca mais visível de texto de máquina.`,
      evidence: collectConnectorEvidence(markdown),
    });
  }

  if (metrics.clichesPer1000 > t.clichesPer1000) {
    findings.push({
      code: 'clichê',
      severity: 'aviso',
      message: `${metrics.clichesPer1000} frases feitas por mil palavras (teto: ${t.clichesPer1000}).`,
      evidence: collectClicheEvidence(prose),
    });
  }

  if (metrics.sentenceLengthCv < t.minSentenceLengthCv && metrics.sentences >= 10) {
    findings.push({
      code: 'ritmo-plano',
      severity: 'aviso',
      message:
        `Variação de tamanho das frases em ${metrics.sentenceLengthCv} ` +
        `(mínimo: ${t.minSentenceLengthCv}). Frases de comprimento parecido, uma atrás da outra.`,
      evidence: [],
    });
  }

  // Concretude é medida em dois eixos separados de propósito: um artigo pode
  // ser cheio de números e não citar ninguém, ou o contrário. São problemas
  // diferentes e vão para etapas diferentes da correção.
  const semNumero = metrics.sentencesWithNumbersPct === 0;
  const semLink = metrics.links === 0;

  if (semNumero) {
    findings.push({
      code: 'sem-numero',
      severity: 'aviso',
      message: 'Nenhum número no texto inteiro — nenhuma afirmação é dimensionada.',
      evidence: [],
    });
  }

  if (semLink) {
    findings.push({
      code: 'sem-fonte',
      severity: 'aviso',
      message: 'Nenhuma fonte linkada. Nada no texto pode ser conferido pelo leitor.',
      evidence: [],
    });
  }

  if (semNumero && semLink && t.requireConcreteness) {
    findings.push({
      code: 'sem-concretude',
      severity: 'veto',
      message: 'Sem número e sem fonte: o artigo não sustenta nenhuma afirmação.',
      evidence: [],
    });
  }

  if (metrics.notOnlyButAlso > t.notOnlyButAlso) {
    findings.push({
      code: 'nao-apenas-mas-tambem',
      severity: 'aviso',
      message: `${metrics.notOnlyButAlso} construções "não apenas… mas também".`,
      evidence: (prose.match(/n[ãa]o\s+(?:apenas|s[óo]|somente)[^.!?]{0,90}?\bmas\b[^.!?]{0,40}/gi) || []).slice(0, 3),
    });
  }

  if (metrics.tricolonsPer1000 > t.tricolonsPer1000) {
    findings.push({
      code: 'enumeracao-em-serie',
      severity: 'aviso',
      message: `${metrics.tricolonsPer1000} enumerações "A, B e C" por mil palavras.`,
      evidence: [],
    });
  }

  const vetos = findings.filter((f) => f.severity === 'veto').length;
  const avisos = findings.length - vetos;

  return {
    passed: vetos === 0,
    score: Math.max(0, round2(10 - vetos * 3 - avisos * 1.2)),
    findings,
    metrics,
    unverifiableRules: rules,
  };
}

function collectConnectorEvidence(markdown: string): string[] {
  const { sentences } = prepareText(markdown);
  const out: string[] = [];
  for (const s of sentences) {
    const hit = matchConnector(s);
    if (hit) out.push(truncate(s, 110));
    if (out.length >= 5) break;
  }
  return out;
}

function collectClicheEvidence(prose: string): string[] {
  const folded = fold(prose);
  const out: string[] = [];
  for (const c of CLICHES) {
    if (folded.includes(fold(c))) out.push(quoteContext(prose, c));
    if (out.length >= 5) break;
  }
  return out;
}

/** Devolve o trecho ao redor da ocorrência, para o problema chegar com endereço. */
function quoteContext(prose: string, term: string): string {
  const at = fold(prose).indexOf(fold(term));
  if (at === -1) return term;
  const from = Math.max(0, at - 45);
  const to = Math.min(prose.length, at + term.length + 45);
  return `${from > 0 ? '…' : ''}${prose.slice(from, to).replace(/\s+/g, ' ').trim()}${to < prose.length ? '…' : ''}`;
}

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
