import type {
  PostGenerationInput,
  UserManifesto,
  FactCheckReport,
  DraftResult,
  ReviewResult,
  ImageResult,
  AuditReport,
  CritiqueResult,
  CritiqueProblem,
} from '../types';
import { stripDuplicateTitleHeading } from './markdown';
import { auditText, detectInventedNumbers } from './quality';

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

export const PIPELINE_STEPS = ['factcheck', 'draft', 'review', 'audit', 'image'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/** Resultado de cada etapa. É isto que vai para `article_jobs.step_payloads`. */
export interface StepPayloads {
  factcheck?: FactCheckReport | null;
  draft?: DraftResult;
  review?: ReviewResult;
  audit?: AuditReport;
  image?: ImageResult;
}

/** Quanto a triagem pode gastar e o que ela exige para deixar passar. */
export interface AuditPolicy {
  /** Desligar a triagem inteira. Existe para o Studio manual, não para o worker. */
  enabled: boolean;
  /** Nota mínima do crítico. Abaixo disso, volta para o redator. */
  minScore: number;
  /** Quantas vezes o texto pode voltar com a crítica em mãos. Cada uma custa. */
  maxRepairs: number;
  /** Quantos problemas o redator acata por rodada — a defesa da voz autoral. */
  problemsPerRepair: number;
  /** Reprovado no fim das tentativas: falha o job ou entrega marcado? */
  rejectOnFailure: boolean;
  /**
   * Artigo sem apuração — ou com apuração fraca — é reprovado de saída.
   *
   * Desligado por padrão, e isso é uma decisão consciente, não um esquecimento:
   * a busca do Google tem cota própria e muito menor que a de geração, então
   * ligar isto hoje reprovaria praticamente tudo. O mecanismo fica pronto para
   * o dia em que a cota de busca deixar de ser o gargalo.
   */
  requireSources: boolean;
}

export const DEFAULT_AUDIT_POLICY: AuditPolicy = {
  enabled: true,
  minScore: 7,
  maxRepairs: 1,
  problemsPerRepair: 3,
  rejectOnFailure: true,
  requireSources: false,
};

export interface PipelineContext {
  input: PostGenerationInput;
  blogName: string;
  blogNiche: string;
  manifesto: UserManifesto;
  /** Estilo visual da capa, resolvido pelo chamador. */
  visualStyle: { id: string; name: string; promptModifier: string };
  audit?: Partial<AuditPolicy>;
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

/**
 * O artigo ficou pronto e foi reprovado pela triagem.
 *
 * Sai por uma porta diferente do erro de propósito: reprovado não é falha de
 * execução. Não deve consumir tentativa, não deve ser retomado do mesmo ponto
 * e não deve virar alerta de infraestrutura. É trabalho concluído com
 * resultado negativo — e o parecer, que custou chamada, vai junto.
 */
export class PipelineRejection extends Error {
  constructor(
    readonly payloads: StepPayloads,
    readonly report: AuditReport
  ) {
    super(report.reason || 'Reprovado na triagem editorial.');
    this.name = 'PipelineRejection';
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

/**
 * A triagem: mede, critica, manda corrigir, mede de novo.
 *
 * Roda depois da revisão e antes da capa — de propósito. Gerar imagem para um
 * artigo que vai ser reprovado é dinheiro fora, e a capa é a etapa mais cara
 * do pipeline.
 *
 * O que sai daqui pode ter o texto DIFERENTE do que entrou: quando o crítico
 * reprova e ainda há orçamento de reparo, o redator corrige e a revisão é
 * substituída. Por isso a função devolve o `review` junto com o parecer.
 */
async function runAudit(
  ctx: PipelineContext,
  call: CallApi,
  reviewIn: ReviewResult,
  factCheck: FactCheckReport | null,
  policy: AuditPolicy
): Promise<{ report: AuditReport; review: ReviewResult }> {
  let review = reviewIn;
  let repairs = 0;
  let critique: CritiqueResult | undefined;

  // O texto como saiu da revisão, antes de qualquer correção, e tudo que foi
  // apurado com fonte. Juntos, definem que números o artigo tem direito de
  // afirmar — ver `detectInventedNumbers`.
  const baseline = reviewIn.revisedText;
  const evidence = factCheck ? JSON.stringify(factCheck) : '';

  for (;;) {
    const deterministic = auditText(review.revisedText, ctx.manifesto);

    if (policy.requireSources) {
      const semApuracao = !factCheck || !factCheck.groundingUsed;
      if (semApuracao || factCheck?.weak) {
        deterministic.findings.push({
          code: 'sem-apuracao',
          severity: 'veto',
          message: semApuracao
            ? 'O artigo foi escrito sem nenhuma apuração com fontes.'
            : `Apuração insuficiente: ${factCheck?.weakReason}.`,
          evidence: [],
        });
        deterministic.passed = false;
      }
    }

    if (repairs > 0) {
      const invented = detectInventedNumbers(review.revisedText, baseline, evidence);
      if (invented.length > 0) {
        deterministic.findings.push({
          code: 'numero-inventado',
          severity: 'veto',
          message:
            `A correção introduziu ${invented.length} afirmação(ões) numérica(s) que não ` +
            'existiam no texto original nem na apuração. Dado sem origem é dado inventado.',
          evidence: invented.slice(0, 8),
        });
        deterministic.passed = false;
        deterministic.score = Math.max(0, deterministic.score - 3);
      }
    }

    const res = await call('/api/critique-draft', {
      topic: ctx.input.topic,
      title: review.revisedTitle,
      subtitle: review.revisedSubtitle,
      text: review.revisedText,
      blogName: ctx.blogName,
      blogNiche: ctx.blogNiche,
      userManifesto: ctx.manifesto,
      factCheck,
      deterministicFindings: deterministic.findings,
      unverifiableRules: deterministic.unverifiableRules,
    });

    // Crítico fora do ar não é artigo aprovado. Deixar passar aqui seria
    // repetir o erro que já apareceu três vezes neste projeto: campo ausente
    // virando silêncio em vez de erro. Falhar preserva a revisão no payload e
    // a próxima tentativa retoma daqui, sem repagar o rascunho.
    if (!res?.success || !res.data) {
      throw new Error(res?.error || 'O crítico não respondeu — a triagem não pode ser presumida.');
    }

    critique = res.data as CritiqueResult;

    const passed =
      deterministic.passed && critique.wouldPublish && critique.score >= policy.minScore;

    if (passed || repairs >= policy.maxRepairs) {
      return {
        report: buildReport(deterministic, critique, repairs, passed, policy),
        review,
      };
    }

    const toFix = rankProblems(deterministic, critique).slice(0, policy.problemsPerRepair);
    if (toFix.length === 0) {
      return {
        report: buildReport(deterministic, critique, repairs, passed, policy),
        review,
      };
    }

    const repaired = await call('/api/apply-critique', {
      title: review.revisedTitle,
      subtitle: review.revisedSubtitle,
      text: review.revisedText,
      problems: toFix,
      strongestPoint: critique.strongestPoint,
      blogName: ctx.blogName,
      blogNiche: ctx.blogNiche,
      userManifesto: ctx.manifesto,
    });

    // Reparo é a etapa que pode falhar sem destruir nada: o texto anterior
    // continua válido. Segue para o veredito com o que já existe.
    if (!repaired?.success || !repaired.data?.revisedText) {
      return {
        report: buildReport(deterministic, critique, repairs, false, policy),
        review,
      };
    }

    repairs += 1;
    review = {
      ...review,
      revisedTitle: repaired.data.revisedTitle || review.revisedTitle,
      revisedSubtitle: repaired.data.revisedSubtitle || review.revisedSubtitle,
      revisedText: stripDuplicateTitleHeading(
        repaired.data.revisedText,
        repaired.data.revisedTitle || review.revisedTitle
      ),
    };
  }
}

/**
 * Junta o que o código mediu com o que o crítico julgou, numa lista só.
 *
 * O veto determinístico entra ANTES do problema mais grave do crítico: se o
 * manifesto proíbe um termo, isso não é questão de opinião editorial.
 */
function rankProblems(
  deterministic: ReturnType<typeof auditText>,
  critique: CritiqueResult
): CritiqueProblem[] {
  const fromCode: CritiqueProblem[] = deterministic.findings
    .filter((f) => f.severity === 'veto')
    .map((f, i) => ({
      rank: i + 1,
      severity: 'grave' as const,
      area: 'regra',
      what: f.message,
      where: f.evidence[0] || '',
      why: 'Regra objetiva do blog, medida por código — não é julgamento editorial.',
      fix: `Elimine a ocorrência. ${f.evidence.length ? `Trechos: ${f.evidence.slice(0, 3).join(' | ')}` : ''}`,
    }));

  const fromCritic = (critique.problems || []).map((p, i) => ({
    ...p,
    rank: fromCode.length + i + 1,
  }));

  return [...fromCode, ...fromCritic];
}

function buildReport(
  deterministic: ReturnType<typeof auditText>,
  critique: CritiqueResult | undefined,
  repairs: number,
  passed: boolean,
  policy: AuditPolicy
): AuditReport {
  const reasons: string[] = [];
  if (!deterministic.passed) {
    reasons.push(
      deterministic.findings
        .filter((f) => f.severity === 'veto')
        .map((f) => f.code)
        .join(', ')
    );
  }
  if (critique && !critique.wouldPublish) reasons.push('o crítico não assinaria');
  if (critique && critique.score < policy.minScore) {
    reasons.push(`nota ${critique.score} abaixo de ${policy.minScore}`);
  }

  return {
    passed,
    score: critique ? Math.round(((deterministic.score + critique.score) / 2) * 10) / 10 : deterministic.score,
    deterministic: {
      passed: deterministic.passed,
      score: deterministic.score,
      findings: deterministic.findings,
      metrics: deterministic.metrics as unknown as Record<string, number>,
    },
    critique,
    repairs,
    reason: passed ? undefined : reasons.filter(Boolean).join(' · '),
  };
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

  /**
   * A etapa em curso.
   *
   * Antes o `catch` deduzia isto procurando o primeiro payload vazio. Parecia
   * economia e era erro: com o fact-check desligado, `payloads.factcheck` é
   * `null` — presente e falso ao mesmo tempo —, então QUALQUER falha do
   * pipeline era registrada como falha na pesquisa. O job ia para o banco com
   * a etapa errada em `error`, e o log dizia a etapa errada.
   */
  let current: PipelineStep = 'factcheck';

  const begin = (step: PipelineStep) => {
    current = step;
    onStepStart?.(step);
  };

  const advance = async (step: PipelineStep) => {
    await onStepComplete?.(step, { ...payloads });
  };

  try {
    if (!('factcheck' in payloads)) {
      begin('factcheck');
      payloads.factcheck = await runFactCheck(context, callApi);
      await advance('factcheck');
    }

    if (!payloads.draft) {
      begin('draft');
      payloads.draft = await runDraft(context, callApi, payloads.factcheck ?? null);
      await advance('draft');
    }

    if (!payloads.review) {
      begin('review');
      payloads.review = await runReview(
        context,
        callApi,
        payloads.draft!,
        payloads.factcheck ?? null
      );
      await advance('review');
    }

    const policy = { ...DEFAULT_AUDIT_POLICY, ...(context.audit || {}) };

    if (policy.enabled && !payloads.audit) {
      begin('audit');
      const { report, review } = await runAudit(
        context,
        callApi,
        payloads.review!,
        payloads.factcheck ?? null,
        policy
      );
      // O reparo pode ter trocado o texto: a revisão gravada é a que vale.
      payloads.review = review;
      payloads.audit = report;
      await advance('audit');

      if (!report.passed && policy.rejectOnFailure) {
        throw new PipelineRejection(payloads, report);
      }
    }

    if (!payloads.image) {
      begin('image');
      payloads.image = await runImage(context, callApi, payloads.draft!, payloads.review!);
      await advance('image');
    }

    return payloads;
  } catch (err: any) {
    // Reprovado atravessa: não é falha de etapa e não vira `PipelineStepError`.
    if (err instanceof PipelineRejection) throw err;

    throw new PipelineStepError(current, payloads, err?.message || 'Falha ao processar o artigo.');
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
