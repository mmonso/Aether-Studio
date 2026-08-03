import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runPipeline,
  PipelineRejection,
  PipelineStepError,
  type CallApi,
  type PipelineContext,
  type StepPayloads,
} from './pipeline';

/**
 * Testes da triagem.
 *
 * O transporte é injetado no pipeline justamente para isto: dá para exercitar
 * a orquestração inteira sem servidor, sem chave e sem gastar chamada. O que
 * está sob teste aqui é a DECISÃO — quando reprova, quantas vezes manda
 * corrigir, quantos problemas repassa — e não o texto que o modelo devolve.
 */

const context: PipelineContext = {
  input: { topic: 'Teste' } as any,
  blogName: 'Blog',
  blogNiche: 'Nicho',
  manifesto: { prohibitedTerms: [] } as any,
  visualStyle: { id: 'a', name: 'A', promptModifier: '' },
};

/** Texto bom o bastante para a verificação determinística não reprovar. */
const cleanText = (() => {
  const filler =
    'A fila foi medida por uma semana e o pico apareceu no gráfico antes do relatório. ' +
    'Ninguém mexeu na configuração até entender o motivo. ' +
    'O tempo de resposta caiu de 800 ms para 120 ms. ' +
    'Foi o único ajuste. ' +
    'Ver o [registro completo](https://exemplo.com) ajuda. ';
  let out = '';
  while (out.split(/\s+/).length < 800) out += filler;
  return out;
})();

const baseReview = {
  revisedTitle: 'Título',
  revisedSubtitle: 'Subtítulo',
  revisedText: cleanText,
  clinicalNotes: '',
  ethicsCheckPassed: true,
  ethicsDetails: '',
  metaDescription: '',
  socialCaption: '',
  hashtags: [],
  keyTakeaways: [],
  readingTimeMinutes: 5,
} as any;

const done: StepPayloads = {
  factcheck: null,
  draft: { title: 'Título', subtitle: 'Sub', rawText: cleanText, outline: [], generatedAt: '' },
  review: baseReview,
};

function critique(over: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      score: 9,
      wouldPublish: true,
      verdict: 'ok',
      strongestPoint: 'a tese',
      problems: [],
      ...over,
    },
  };
}

/** Registra o que foi chamado, para o teste poder afirmar sobre a sequência. */
function recorder(handlers: Record<string, (body: any, nth: number) => any>) {
  const calls: Array<{ path: string; body: any }> = [];
  const counts: Record<string, number> = {};

  const callApi: CallApi = async (path, body) => {
    calls.push({ path, body });
    counts[path] = (counts[path] || 0) + 1;
    const handler = handlers[path];
    if (!handler) return { success: true, data: {} };
    return handler(body, counts[path]);
  };

  return { callApi, calls, countOf: (p: string) => counts[p] || 0 };
}

test('artigo aprovado segue para a capa e não volta ao redator', async () => {
  const { callApi, countOf } = recorder({
    '/api/critique-draft': () => critique(),
    '/api/generate-image': () => ({ success: true, data: { imageUrl: 'x' } }),
  });

  const payloads = await runPipeline({ context, callApi, payloads: { ...done } });

  assert.equal(payloads.audit?.passed, true);
  assert.equal(payloads.audit?.repairs, 0);
  assert.equal(countOf('/api/apply-critique'), 0);
  assert.equal(countOf('/api/generate-image'), 1);
});

test('nota abaixo do mínimo manda corrigir e mede de novo', async () => {
  const { callApi, countOf } = recorder({
    // Primeiro julgamento reprova; depois do reparo, aprova.
    '/api/critique-draft': (_b, nth) =>
      nth === 1
        ? critique({
            score: 4,
            wouldPublish: false,
            problems: [
              { rank: 1, severity: 'grave', area: 'argumento', what: 'a', where: 'w', why: 'y', fix: 'f' },
            ],
          })
        : critique(),
    '/api/apply-critique': () => ({
      success: true,
      data: { revisedTitle: 'Título', revisedSubtitle: 'Sub', revisedText: cleanText, changeLog: [] },
    }),
    '/api/generate-image': () => ({ success: true, data: { imageUrl: 'x' } }),
  });

  const payloads = await runPipeline({ context, callApi, payloads: { ...done } });

  assert.equal(countOf('/api/critique-draft'), 2, 'tem que medir de novo depois de corrigir');
  assert.equal(payloads.audit?.repairs, 1);
  assert.equal(payloads.audit?.passed, true);
});

test('só os N primeiros problemas chegam ao redator — a defesa da voz autoral', async () => {
  const oito = Array.from({ length: 8 }, (_, i) => ({
    rank: i + 1,
    severity: 'medio',
    area: 'voz',
    what: `problema ${i + 1}`,
    where: 'w',
    why: 'y',
    fix: 'f',
  }));

  let recebidos = 0;
  const { callApi } = recorder({
    '/api/critique-draft': (_b, nth) =>
      nth === 1 ? critique({ score: 3, wouldPublish: false, problems: oito }) : critique(),
    '/api/apply-critique': (body) => {
      recebidos = body.problems.length;
      return {
        success: true,
        data: { revisedTitle: 'T', revisedSubtitle: 'S', revisedText: cleanText, changeLog: [] },
      };
    },
    '/api/generate-image': () => ({ success: true, data: { imageUrl: 'x' } }),
  });

  await runPipeline({
    context: { ...context, audit: { problemsPerRepair: 3 } },
    callApi,
    payloads: { ...done },
  });

  assert.equal(recebidos, 3);
});

test('esgotado o orçamento de reparo, reprova em vez de insistir', async () => {
  const { callApi, countOf } = recorder({
    '/api/critique-draft': () =>
      critique({
        score: 2,
        wouldPublish: false,
        problems: [{ rank: 1, severity: 'grave', area: 'argumento', what: 'a', where: 'w', why: 'y', fix: 'f' }],
      }),
    '/api/apply-critique': () => ({
      success: true,
      data: { revisedTitle: 'T', revisedSubtitle: 'S', revisedText: cleanText, changeLog: [] },
    }),
  });

  await assert.rejects(
    () =>
      runPipeline({
        context: { ...context, audit: { maxRepairs: 1, rejectOnFailure: true } },
        callApi,
        payloads: { ...done },
      }),
    (err: any) => {
      assert.ok(err instanceof PipelineRejection);
      assert.equal(err.report.passed, false);
      assert.equal(err.report.repairs, 1);
      assert.ok(err.payloads.audit, 'o parecer que custou chamada tem que vir junto');
      return true;
    }
  );

  assert.equal(countOf('/api/apply-critique'), 1, 'não pode corrigir além do orçamento');
  assert.equal(countOf('/api/generate-image'), 0, 'capa é cara: não se gera para artigo reprovado');
});

test('reprovado é rejeição, nunca erro de etapa', async () => {
  const { callApi } = recorder({
    '/api/critique-draft': () => critique({ score: 1, wouldPublish: false, problems: [] }),
  });

  await assert.rejects(
    () => runPipeline({ context, callApi, payloads: { ...done } }),
    (err: any) => {
      assert.ok(err instanceof PipelineRejection);
      assert.ok(!(err instanceof PipelineStepError));
      return true;
    }
  );
});

test('crítico fora do ar falha o job — não deixa passar por omissão', async () => {
  const { callApi } = recorder({
    '/api/critique-draft': () => ({ success: false, error: '503' }),
  });

  await assert.rejects(
    () => runPipeline({ context, callApi, payloads: { ...done } }),
    (err: any) => {
      assert.ok(err instanceof PipelineStepError, 'indisponibilidade é falha, não reprovação');
      assert.equal(err.step, 'audit');
      // A revisão paga continua no payload: a retomada não repaga o rascunho.
      assert.ok(err.payloads.review);
      return true;
    }
  );
});

test('veto determinístico reprova mesmo com o crítico dando nota alta', async () => {
  const { callApi } = recorder({
    '/api/critique-draft': () => critique({ score: 10, wouldPublish: true }),
  });

  await assert.rejects(
    () =>
      runPipeline({
        context: {
          ...context,
          manifesto: { prohibitedTerms: ['"gráfico"'] } as any,
          audit: { maxRepairs: 0 },
        },
        callApi,
        payloads: { ...done },
      }),
    (err: any) => {
      assert.ok(err instanceof PipelineRejection);
      assert.ok(err.report.reason?.includes('termo-proibido'));
      return true;
    }
  );
});

test('correção que inventa benchmark é vetada, mesmo com o crítico satisfeito', async () => {
  // O caso real: o crítico pediu "dados empíricos", o redator fabricou um
  // benchmark inteiro e devolveu `unresolved` vazio. Aqui o crítico até aprova
  // o texto corrigido — quem barra é a comparação de números.
  const { callApi } = recorder({
    '/api/critique-draft': (_b, nth) =>
      nth === 1
        ? critique({
            score: 4,
            wouldPublish: false,
            problems: [
              { rank: 1, severity: 'grave', area: 'evidencia', what: 'sem dados', where: 'w', why: 'y', fix: 'traga números' },
            ],
          })
        : critique({ score: 10, wouldPublish: true }),
    '/api/apply-critique': () => ({
      success: true,
      data: {
        revisedTitle: 'T',
        revisedSubtitle: 'S',
        revisedText: `${cleanText}\n\nO motor entrega 5-8 tokens/s e 45% a mais de vazão.`,
        changeLog: ['adicionei benchmarks'],
        unresolved: [],
      },
    }),
  });

  await assert.rejects(
    () =>
      runPipeline({
        context: { ...context, audit: { maxRepairs: 1 } },
        callApi,
        payloads: { ...done },
      }),
    (err: any) => {
      assert.ok(err instanceof PipelineRejection);
      assert.ok(err.report.reason?.includes('numero-inventado'));
      return true;
    }
  );
});

test('número que veio da apuração não é tratado como invenção', async () => {
  const { callApi } = recorder({
    '/api/critique-draft': (_b, nth) =>
      nth === 1
        ? critique({
            score: 4,
            wouldPublish: false,
            problems: [
              { rank: 1, severity: 'grave', area: 'evidencia', what: 'sem dados', where: 'w', why: 'y', fix: 'use a apuração' },
            ],
          })
        : critique({ score: 9, wouldPublish: true }),
    '/api/apply-critique': () => ({
      success: true,
      data: {
        revisedTitle: 'T',
        revisedSubtitle: 'S',
        revisedText: `${cleanText}\n\nA adoção cresceu 40% no período.`,
        changeLog: [],
      },
    }),
    '/api/generate-image': () => ({ success: true, data: { imageUrl: 'x' } }),
  });

  const payloads = await runPipeline({
    context,
    callApi,
    payloads: {
      ...done,
      factcheck: { verifiedFacts: ['Crescimento de 40% no período, segundo o relatório'] } as any,
    },
  });

  assert.equal(payloads.audit?.passed, true);
});

test('com apuração exigida, artigo sem fonte é reprovado antes de qualquer nota', async () => {
  const { callApi } = recorder({
    '/api/critique-draft': () => critique({ score: 10, wouldPublish: true }),
  });

  await assert.rejects(
    () =>
      runPipeline({
        context: { ...context, audit: { requireSources: true, maxRepairs: 0 } },
        callApi,
        payloads: { ...done },
      }),
    (err: any) => {
      assert.ok(err instanceof PipelineRejection);
      assert.ok(err.report.reason?.includes('sem-apuracao'));
      return true;
    }
  );
});

test('apuração declarada fraca também reprova quando as fontes são exigidas', async () => {
  const { callApi } = recorder({
    '/api/critique-draft': () => critique({ score: 10, wouldPublish: true }),
  });

  await assert.rejects(
    () =>
      runPipeline({
        context: { ...context, audit: { requireSources: true, maxRepairs: 0 } },
        callApi,
        payloads: {
          ...done,
          factcheck: {
            groundingUsed: true,
            weak: true,
            weakReason: 'só 1 fonte consultada',
          } as any,
        },
      }),
    (err: any) => {
      assert.ok(err instanceof PipelineRejection);
      assert.ok(err.report.reason?.includes('sem-apuracao'));
      return true;
    }
  );
});

test('a triagem desligada não gasta chamada nenhuma', async () => {
  const { callApi, countOf } = recorder({
    '/api/generate-image': () => ({ success: true, data: { imageUrl: 'x' } }),
  });

  const payloads = await runPipeline({
    context: { ...context, audit: { enabled: false } },
    callApi,
    payloads: { ...done },
  });

  assert.equal(countOf('/api/critique-draft'), 0);
  assert.equal(payloads.audit, undefined);
});

test('etapa com payload existente não roda de novo — retomada não é caminho especial', async () => {
  const { callApi, countOf } = recorder({
    '/api/generate-image': () => ({ success: true, data: { imageUrl: 'x' } }),
  });

  await runPipeline({
    context,
    callApi,
    payloads: {
      ...done,
      audit: { passed: true, score: 9, deterministic: { passed: true, score: 9, findings: [], metrics: {} }, repairs: 0 },
    },
  });

  assert.equal(countOf('/api/critique-draft'), 0, 'triagem já paga não se repete');
  assert.equal(countOf('/api/generate-image'), 1);
});
