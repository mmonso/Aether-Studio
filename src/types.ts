export interface UserManifesto {
  authorName: string;
  professionalTitle: string;
  worldviewDescription: string; // "Sua visão de mundo, como pensa, detalhada"
  toneOfVoice: string; // "Tom de voz característico"
  favoriteKeywords: string[]; // "Vocabulário que você costuma usar"
  prohibitedTerms: string[]; // "Termos ou clichês que você evita"
  targetAudienceDescription: string; // "Descrição do leitor/paciente ideal"
  writerInstructions: string; // "Diretrizes específicas para o Redator"
  reviewerInstructions: string; // "Diretrizes para a Revisão"
  ethicsRules: string; // "Suas regras éticas"
  themeCategories?: string[]; // "Eixos temáticos e categorias personalizadas do autor"
  humanizerInstructions?: string; // "Diretrizes específicas do Editor de Humanização & Cadência (Des-AIzador)"
  conceptualCuratorInstructions?: string; // "Diretrizes do Curador Conceitual & Filosófico (Guardião da Teoria)"
}

export interface AgentPrompts {
  writerSystemPrompt: string;
  reviewerSystemPrompt: string;
  imageDesignerSystemPrompt: string;
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
  credibilityScore: number; // 0 a 100
  verifiedFacts: string[];
  unverifiedClaimsOrRumors?: string[];
  sources: FactCheckSource[];
  checkedAt: string;
  verdict: 'Verificado e Confiável' | 'Requer Cautela' | 'Informação Parcial ou em Atualização';
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
  status: 'researching' | 'drafting' | 'reviewing' | 'generating_image' | 'completed' | 'error';
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
