import type {
  PostGenerationInput,
  UserManifesto,
  FactCheckReport,
  DraftResult,
  ReviewResult,
  ImageResult,
} from '../types';
import { stripDuplicateTitleHeading } from './markdown';

/**
 * O pipeline de produção de um artigo.
 *
 * Saiu do `App.tsx`, onde vivia como `handleStartPipeline` — quatro `fetch` em
 * sequência guardando o resultado parcial em `setCurrentPost`, com um único
 * `catch` no fim. Consequências, registradas nos documentos originais: sem fila,
 * sem retomada, e uma falha na etapa 3 jogava fora o rascunho da etapa 2, que
 * já tinha sido pago.
 *
 * Duas decisões de desenho aqui:
 *
 * 1. O TRANSPORTE É INJETADO (`callApi`). No navegador é `fetch('/api/...')`;
 *    no worker headless é `fetch('http://127.0.0.1:PORT/api/...')`. A mesma
 *    orquestração serve aos dois, e os endpoints do Express não mudam.
 *
 * 2. A RETOMADA NÃO É UM MODO ESPECIAL. Cada etapa cujo resultado já existe em
 *    `payloads` é pulada. Retomar um job é chamar a mesma função com o que já
 *    foi salvo — não há caminho separado que possa divergir do normal.
 */

export const PIPELINE_STEPS = ['factcheck', 'draft', 'review', 'image'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/** Resultado de cada etapa. É isto que vai para `article_jobs.step_payloads`. */
export interface StepPayloads {
  factcheck?: FactCheckReport | null;
  draft?: DraftResult;
  review?: ReviewResult;
  image?: ImageResult;
}

export interface PipelineContext {
  input: PostGenerationInput;
  blogName: string;
  blogNiche: string;
  manifesto: UserManifesto;
  /** Estilo visual da capa, resolvido pelo chamador. */
  visualStyle: { id: string; name: string; promptModifier: string };
}

/** Como falar com os endpoints. `path` é relativo: '/api/generate-draft'. */
export type CallApi = (path: string, body: unknown) => Promise<any>;

export interface RunPipelineOptions {
  context: PipelineContext;
  callApi: CallApi;
  /** Resultados já obtidos. Etapas presentes aqui não rodam de novo. */
  payloads?: StepPayloads;
  /**
   * Chamado DEPOIS de cada etapa concluir e ANTES da próxima começar.
   *
   * É aqui que o chamador grava. A ordem importa: gravar antes de avançar é o
   * que garante que uma falha na revisão não custe o rascunho de novo.
   */
  onStepComplete?: (step: PipelineStep, payloads: StepPayloads) => Promise<void> | void;
  /** Sinaliza que a etapa começou — alimenta a barra de progresso. */
  onStepStart?: (step: PipelineStep) => void;
}

/** Erro de uma etapa, carregando o que já foi produzido até ali. */
export class PipelineStepError extends Error {
  constructor(
    readonly step: PipelineStep,
    readonly payloads: StepPayloads,
    message: string
  ) {
    super(message);
    this.name = 'PipelineStepError';
  }
}

async function runFactCheck(ctx: PipelineContext, call: CallApi) {
  if (!ctx.input.enableFactCheck) return null;

  const res = await call('/api/research-factcheck', {
    topic: ctx.input.topic,
    newsReferenceUrl: ctx.input.newsReferenceUrl,
    blogName: ctx.blogName,
    blogNiche: ctx.blogNiche,
    userManifesto: ctx.manifesto,
  });

  // Fact-check é opcional por natureza: falhar aqui não derruba o artigo, só
  // tira o selo de verificação. Quem decide o que fazer com isso é a triagem.
  if (!res?.success || !res.data) return null;
  return res.data as FactCheckReport;
}

async function runDraft(ctx: PipelineContext, call: CallApi, factCheck: FactCheckReport | null) {
  const res = await call('/api/generate-draft', {
    topic: ctx.input.topic,
    targetAudience: ctx.input.targetAudience,
    depthLevel: ctx.input.depthLevel,
    articleLength: ctx.input.articleLength,
    customWriterPrompt: ctx.input.customWriterPrompt,
    blogName: ctx.blogName,
    blogNiche: ctx.blogNiche,
    userManifesto: ctx.manifesto,
    factCheck,
  });

  if (!res?.success) throw new Error(res?.error || 'Erro na etapa de redação.');

  return {
    ...res.data,
    rawText: stripDuplicateTitleHeading(res.data.rawText, res.data.title),
  } as DraftResult;
}

async function runReview(
  ctx: PipelineContext,
  call: CallApi,
  draft: DraftResult,
  factCheck: FactCheckReport | null
) {
  const res = await call('/api/review-draft', {
    topic: ctx.input.topic,
    draftTitle: draft.title,
    draftSubtitle: draft.subtitle,
    draftText: draft.rawText,
    customReviewerPrompt: ctx.input.customReviewerPrompt,
    blogName: ctx.blogName,
    blogNiche: ctx.blogNiche,
    userManifesto: ctx.manifesto,
    factCheck,
  });

  if (!res?.success) throw new Error(res?.error || 'Erro na etapa de revisão editorial.');

  return {
    ...res.data,
    revisedText: stripDuplicateTitleHeading(res.data.revisedText, res.data.revisedTitle),
  } as ReviewResult;
}

async function runImage(
  ctx: PipelineContext,
  call: CallApi,
  draft: DraftResult,
  review: ReviewResult
): Promise<ImageResult> {
  const res = await call('/api/generate-image', {
    title: review.revisedTitle || draft.title,
    summary: review.metaDescription || draft.subtitle,
    visualStyle: ctx.visualStyle.name,
    promptModifier: ctx.visualStyle.promptModifier,
    customImagePrompt: ctx.input.customImagePrompt,
  });

  if (res?.success && res.data) return res.data as ImageResult;

  // Capa é acessório: um artigo sem imagem ainda é um artigo. Antes isto era um
  // `console.warn` e uma URL do Unsplash cravada; continua sendo fallback, mas
  // agora fica registrado no payload que a capa não foi gerada.
  return {
    imageUrl:
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    promptUsed: `Ilustração editorial para ${ctx.blogNiche}`,
    conceptExplanation: 'Imagem conceitual de reserva — a geração falhou.',
    altText: `Ilustração sobre ${ctx.input.topic}`,
    styleUsed: ctx.visualStyle.id,
  } as ImageResult;
}

/**
 * Roda o pipeline do início, ou de onde parou.
 *
 * Devolve os payloads completos. Em caso de falha, lança `PipelineStepError`
 * com tudo que já foi produzido — para o chamador gravar antes de desistir e
 * não repagar as etapas concluídas na próxima tentativa.
 */
export async function runPipeline(options: RunPipelineOptions): Promise<StepPayloads> {
  const { context, callApi, onStepComplete, onStepStart } = options;
  const payloads: StepPayloads = { ...(options.payloads || {}) };

  const advance = async (step: PipelineStep) => {
    await onStepComplete?.(step, { ...payloads });
  };

  try {
    if (!('factcheck' in payloads)) {
      onStepStart?.('factcheck');
      payloads.factcheck = await runFactCheck(context, callApi);
      await advance('factcheck');
    }

    if (!payloads.draft) {
      onStepStart?.('draft');
      payloads.draft = await runDraft(context, callApi, payloads.factcheck ?? null);
      await advance('draft');
    }

    if (!payloads.review) {
      onStepStart?.('review');
      payloads.review = await runReview(
        context,
        callApi,
        payloads.draft!,
        payloads.factcheck ?? null
      );
      await advance('review');
    }

    if (!payloads.image) {
      onStepStart?.('image');
      payloads.image = await runImage(context, callApi, payloads.draft!, payloads.review!);
      await advance('image');
    }

    return payloads;
  } catch (err: any) {
    throw new PipelineStepError(
      // A etapa que falhou é a primeira sem resultado.
      (PIPELINE_STEPS.find((s) => !(s in payloads) || !payloads[s]) || 'draft') as PipelineStep,
      payloads,
      err?.message || 'Falha ao processar o artigo.'
    );
  }
}

/** Transporte padrão do navegador. */
export const browserCallApi: CallApi = async (path, body) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};
