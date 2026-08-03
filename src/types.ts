export interface UserManifesto {
  authorName: string;
  professionalTitle: string;
  worldviewDescription: string; // "Sua visão de mundo, como pensa, detalhada"
  toneOfVoice: string; // "Tom de voz característico"
  favoriteKeywords: string[]; // "Vocabulário que você costuma usar"
  prohibitedTerms: string[]; // "Termos ou clichês que você evita"
  targetAudienceDescription: string; // "Descrição do leitor ideal"
  writerInstructions: string; // "Diretrizes específicas para o Redator"
  reviewerInstructions: string; // "Diretrizes para a Revisão"
  ethicsRules: string; // "Suas regras éticas"
  themeCategories?: string[]; // "Eixos temáticos e categorias personalizadas do autor"
  humanizerInstructions?: string; // "Diretrizes específicas do Editor de Humanização & Cadência (Des-AIzador)"
  conceptualCuratorInstructions?: string; // "Diretrizes do Curador Conceitual & Filosófico (Guardião da Teoria)"
}


export interface PostGenerationInput {
  topic: string;
  targetAudience?: string;
  tone?: string;
  depthLevel: 'iniciante' | 'intermediario' | 'aprofundado';
  articleLength: 'curto' | 'medio' | 'longo';
  includePracticalExercise?: boolean;
  includeFAQ?: boolean;
  enableFactCheck?: boolean;
  newsReferenceUrl?: string;
  visualStyle: string;
  customWriterPrompt?: string;
  customReviewerPrompt?: string;
  customImagePrompt?: string;
}

export interface FactCheckSource {
  title: string;
  url?: string;
  sourceName: string;
  reliability: 'alta' | 'media' | 'verificada';
  snippet?: string;
}

export interface FactCheckReport {
  researchSummary: string;
  /** 0 a 100. `null` quando a apuração não produziu nota — nunca use um default. */
  credibilityScore: number | null;
  verifiedFacts: string[];
  unverifiedClaimsOrRumors?: string[];
  sources: FactCheckSource[];
  /** true apenas quando houve pesquisa real na web com fontes consultadas.
   *  Sem isso não há selo de verificação. */
  groundingUsed: boolean;
  checkedAt: string;
  verdict: string;
  /**
   * Houve apuração, mas ela não sustenta um artigo: poucas fontes ou
   * confiabilidade baixa.
   *
   * O dossiê continua vindo em vez de virar erro — ele já foi pago e diz algo
   * útil. Quem decide o que fazer com uma apuração fraca é a política de
   * triagem (`AuditPolicy.requireSources`), não a etapa de pesquisa.
   */
  weak?: boolean;
  weakReason?: string;
}

export interface DraftResult {
  title: string;
  subtitle: string;
  rawText: string;
  outline: string[];
  generatedAt: string;
}

export interface ReviewResult {
  revisedTitle: string;
  revisedSubtitle: string;
  revisedText: string;
  clinicalNotes: string;
  humanizationNotes?: string;
  conceptualNotes?: string;
  writerSynthesisNotes?: string;
  ethicsCheckPassed: boolean;
  ethicsDetails: string;
  metaDescription: string;
  socialCaption: string;
  hashtags: string[];
  suggestedTags?: string[];
  keyTakeaways: string[];
  readingTimeMinutes: number;
}

/**
 * Um problema apontado pelo crítico, já ranqueado.
 *
 * A ordem importa mais que o conteúdo: o checklist limita quantos problemas o
 * redator acata, justamente para que a crítica não apague a voz do autor a
 * força de correção. Sem ranqueamento não existe "os três primeiros".
 */
export interface CritiqueProblem {
  /** 1 é o mais grave. O crítico é obrigado a ordenar. */
  rank: number;
  severity: 'grave' | 'medio' | 'leve';
  /** Que tipo de falha: 'argumento', 'evidencia', 'voz', 'estrutura', 'precisao'. */
  area: string;
  /** O problema em uma frase. */
  what: string;
  /** Trecho citado do artigo, para o reparo ter endereço. */
  where: string;
  /** Por que isso é problema para este leitor, deste blog. */
  why: string;
  /** O que fazer. Não é o texto novo — é a instrução. */
  fix: string;
}

export interface CritiqueResult {
  /** 0 a 10. Lido por código, não interpretado. */
  score: number;
  /** O crítico publicaria isto com o nome do autor? */
  wouldPublish: boolean;
  problems: CritiqueProblem[];
  /** O que o artigo tem de melhor — o reparo não pode destruir isto. */
  strongestPoint: string;
  /** Uma frase sobre o texto como um todo. */
  verdict: string;
}

/**
 * O resultado da triagem inteira: o que o código mediu e o que o crítico julgou.
 *
 * `passed` é o único campo que o worker precisa ler. Prosa não veta.
 */
export interface AuditReport {
  passed: boolean;
  /** Média das duas notas, para ranquear a fila de aprovação. */
  score: number;
  deterministic: {
    passed: boolean;
    score: number;
    findings: Array<{ code: string; severity: 'veto' | 'aviso'; message: string; evidence: string[] }>;
    metrics: Record<string, number>;
  };
  critique?: CritiqueResult;
  /** Quantas vezes o texto voltou para o redator com a crítica em mãos. */
  repairs: number;
  /** Por que reprovou, em uma linha, para a caixa de entrada. */
  reason?: string;
}

export interface ImageResult {
  imageUrl: string;
  promptUsed: string;
  conceptExplanation: string;
  altText: string;
  styleUsed: string;
}

export interface CarouselSlide {
  slideNumber: number;
  slideTitle: string;
  bodyText: string;
  visualCue?: string;
}

export interface CarouselFormat {
  slides: CarouselSlide[];
  caption: string;
}

export interface ReelsScriptFormat {
  hook: string;
  coreNarrative: string;
  visualInstructions?: string;
  callToReflection: string;
}

export interface DerivedFormats {
  carousel?: CarouselFormat;
  reelsScript?: ReelsScriptFormat;
}

export interface Blog {
  id: string;
  name: string;
  niche: string;
  description: string;
  authorName: string;
  professionalTitle: string;
  badgeColor?: 'teal' | 'indigo' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan';
  iconName?: string;
  /** Domínio público deste blog. Alimenta o botão "Ver Blog" — que antes
   *  apontava sempre para o mesmo site, vindo de uma variável de ambiente
   *  única (bloqueio B5). */
  siteUrl?: string;
  createdAt: string;
  updatedAt: string;
  manifesto: UserManifesto;
}

export interface ArticlePost {
  id: string;
  blogId?: string;
  createdAt: string;
  updatedAt: string;
  topic: string;
  authorName?: string;
  tone: string;
  depthLevel: string;
  targetAudience: string;
  tags?: string[];
  approachName?: string;
  input: PostGenerationInput;
  draft?: DraftResult;
  factCheck?: FactCheckReport;
  review?: ReviewResult;
  image?: ImageResult;
  derivedFormats?: DerivedFormats;
  audit?: AuditReport;
  status:
    | 'researching'
    | 'drafting'
    | 'reviewing'
    | 'auditing'
    | 'generating_image'
    | 'completed'
    | 'error'
    /** Chegou ao fim e a triagem reprovou. Não é erro: é resultado. */
    | 'rejected';
  isPublished?: boolean;
  publishedAt?: string;
  /** Slug com que o artigo foi para o blog. Existe = está publicado no Supabase.
   *  É o que mantém a URL estável e faz republicar atualizar em vez de duplicar. */
  publishedSlug?: string;
  errorMessage?: string;
}

export interface VisualStyleOption {
  id: string;
  name: string;
  description: string;
  previewColor: string;
  promptModifier: string;
}
