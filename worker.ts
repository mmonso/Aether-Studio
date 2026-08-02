/**
 * Worker headless — produz artigos sem navegador aberto.
 *
 * Sobe os MESMOS endpoints do Studio numa porta própria e roda a MESMA
 * orquestração (`src/lib/pipeline.ts`) que a interface roda. Não há um segundo
 * pipeline "de produção" que possa divergir do que você testa na tela.
 *
 * Ciclo de vida: acorda, consome a fila, dorme. Feito para rodar no GitHub
 * Actions, onde o processo nasce e morre a cada execução — por isso ele fecha
 * o servidor no fim em vez de ficar escutando.
 *
 * Uso:
 *   npm run worker              — processa a fila e sai
 *   WORKER_MAX_JOBS=1 npm run worker
 */

import type { Server } from 'node:http';
import { app, getSupabaseAdmin } from './server';
import {
  runPipeline,
  PipelineStepError,
  type CallApi,
  type StepPayloads,
} from './src/lib/pipeline';
import { VISUAL_STYLES } from './src/data/presetApproaches';

const JOBS_TABLE = 'article_jobs';

/** Quantos artigos por execução. Baixo de propósito: ver PACING abaixo. */
const MAX_JOBS = Number(process.env.WORKER_MAX_JOBS) || 3;

/** Desistir de um job depois de N tentativas, para não queimar cota em loop. */
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS) || 3;

/**
 * PACING — a pausa entre artigos.
 *
 * No free tier do Gemini o que limita não é token, é requisição por minuto e
 * por dia. E o worker tem a noite inteira: não há motivo para disparar tudo de
 * uma vez e bater no teto. Rate limit deixa de ser erro e vira ritmo.
 */
const PACE_BETWEEN_JOBS_MS = Number(process.env.WORKER_PACE_MS) || 20_000;

/** Teto de chamadas de IA por execução. Freio bruto, mas existe desde o dia 1. */
const MAX_AI_CALLS = Number(process.env.WORKER_MAX_AI_CALLS) || 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Estado do job ↔ etapa do pipeline. */
const STEP_STATE: Record<string, string> = {
  factcheck: 'researching',
  draft: 'drafting',
  review: 'reviewing',
  image: 'imaging',
};

interface JobRow {
  id: string;
  blog_id: string;
  topic: string | null;
  input: any;
  state: string;
  step_payloads: any;
  attempts: number;
  ai_calls: number;
}

let aiCallsThisRun = 0;

function startWorkerServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    // Porta 0 = o sistema escolhe uma livre. Evita colidir com um Studio
    // aberto na 3000, e torna o worker seguro de rodar em paralelo.
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Não foi possível determinar a porta do worker.'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
    server.on('error', reject);
  });
}

/** Transporte do worker: mesmos endpoints, host local, modo automático. */
function makeCallApi(baseUrl: string): CallApi {
  return async (path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Diz aos endpoints que ninguém está esperando: sob rate limit,
        // esperar e insistir no modelo bom em vez de rebaixar calado.
        'x-aether-mode': 'auto',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (json?.aiUsage?.calls) aiCallsThisRun += json.aiUsage.calls;
    return json;
  };
}

async function loadBlogContext(blogId: string) {
  const supabase = getSupabaseAdmin();

  const [{ data: blog, error: blogError }, { data: secret, error: secretError }] =
    await Promise.all([
      supabase.from('blogs').select('id,name,niche').eq('id', blogId).maybeSingle(),
      supabase.from('blog_secrets').select('manifesto').eq('blog_id', blogId).maybeSingle(),
    ]);

  if (blogError) throw blogError;
  if (secretError) throw secretError;
  if (!blog) throw new Error(`Blog "${blogId}" não existe.`);

  // O manifesto vem do banco, não do cliente. É a diferença entre o worker e a
  // interface: lá o navegador manda; aqui não há navegador.
  const manifesto = secret?.manifesto || {};
  if (!manifesto || Object.keys(manifesto).length === 0) {
    throw new Error(
      `O blog "${blogId}" está sem manifesto em blog_secrets. Sem ele os prompts ` +
        'caem nos fallbacks genéricos e o artigo sai sem voz autoral.'
    );
  }

  return { blog, manifesto };
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin().from(JOBS_TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

async function claimJobs(): Promise<JobRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from(JOBS_TABLE)
    .select('*')
    // Estados retomáveis: nunca começou, ou parou no meio. Um job em 'ready'
    // já produziu e está esperando aprovação — não se toca.
    .in('state', ['queued', 'researching', 'drafting', 'reviewing', 'imaging', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS);

  if (error) throw error;
  return (data || []) as JobRow[];
}

async function runJob(job: JobRow, baseUrl: string) {
  const label = job.topic || job.id;
  console.log(`\n[job ${job.id}] ${label}`);

  await updateJob(job.id, { attempts: job.attempts + 1, error: null });

  const { blog, manifesto } = await loadBlogContext(job.blog_id);
  const callApi = makeCallApi(baseUrl);

  // Payloads já pagos numa tentativa anterior. É isto que evita repagar.
  const previous: StepPayloads = job.step_payloads?.payloads || {};
  const resumedFrom = Object.keys(previous).filter((k) => previous[k as keyof StepPayloads]);
  if (resumedFrom.length > 0) {
    console.log(`  retomando; já concluídas: ${resumedFrom.join(', ')}`);
  }

  try {
    const payloads = await runPipeline({
      context: {
        input: job.input,
        blogName: blog.name,
        blogNiche: blog.niche,
        manifesto,
        visualStyle:
          VISUAL_STYLES.find((s) => s.id === job.input?.visualStyle) || VISUAL_STYLES[0],
      },
      callApi,
      payloads: previous,
      onStepStart: (step) => console.log(`  → ${step}`),
      // Grava ANTES de avançar. Uma falha na revisão não custa o rascunho.
      onStepComplete: async (step, payloads) => {
        await updateJob(job.id, {
          state: STEP_STATE[step] || job.state,
          last_completed_step: step,
          step_payloads: { payloads },
          ai_calls: job.ai_calls + aiCallsThisRun,
        });
      },
    });

    // Artigo pronto → posts com status 'draft'. Fica invisível ao público
    // (a RLS só expõe 'published') e espera aprovação. É a decisão D5: a fila
    // de aprovação cabe na tabela que já existe.
    const article = {
      id: job.id,
      blogId: job.blog_id,
      topic: job.topic,
      createdAt: new Date().toISOString(),
      input: job.input,
      draft: payloads.draft,
      review: payloads.review,
      image: payloads.image,
      factCheck: payloads.factcheck,
    };

    const publishRes = await callApi('/api/supabase/publish', {
      article,
      category: payloads.review?.suggestedTags?.[0] || null,
      authorName: manifesto.authorName || null,
      status: 'draft',
    });

    if (!publishRes?.success) {
      throw new Error(publishRes?.error || 'Falha ao gravar o rascunho.');
    }

    await updateJob(job.id, {
      state: 'ready',
      step_payloads: { payloads },
      ai_calls: job.ai_calls + aiCallsThisRun,
      error: null,
    });

    console.log(`  ✓ rascunho gravado: ${publishRes.slug}`);
  } catch (err: any) {
    const payloads = err instanceof PipelineStepError ? err.payloads : previous;
    const step = err instanceof PipelineStepError ? err.step : 'desconhecida';

    // Salva o que já foi produzido antes de marcar como falho — é o que torna
    // a próxima tentativa mais barata que a primeira.
    await updateJob(job.id, {
      state: 'failed',
      step_payloads: { payloads },
      ai_calls: job.ai_calls + aiCallsThisRun,
      error: `[${step}] ${err?.message || err}`,
    });

    console.error(`  ✗ falhou em "${step}": ${err?.message || err}`);
  }
}

async function main() {
  const started = Date.now();
  const { server, baseUrl } = await startWorkerServer();
  console.log(`worker: endpoints locais em ${baseUrl}`);

  try {
    const jobs = await claimJobs();

    if (jobs.length === 0) {
      console.log('worker: nada na fila.');
      return;
    }

    console.log(`worker: ${jobs.length} job(s) na fila.`);

    for (const [index, job] of jobs.entries()) {
      if (aiCallsThisRun >= MAX_AI_CALLS) {
        console.warn(
          `worker: teto de ${MAX_AI_CALLS} chamadas de IA atingido. ` +
            `${jobs.length - index} job(s) ficam para a próxima execução.`
        );
        break;
      }

      await runJob(job, baseUrl);

      const isLast = index === jobs.length - 1;
      if (!isLast) {
        console.log(`worker: pausa de ${PACE_BETWEEN_JOBS_MS / 1000}s antes do próximo.`);
        await sleep(PACE_BETWEEN_JOBS_MS);
      }
    }
  } finally {
    server.close();
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`\nworker: encerrado em ${seconds}s, ${aiCallsThisRun} chamada(s) de IA.`);
  }
}

main().catch((err) => {
  console.error('worker: erro fatal —', err?.message || err);
  process.exitCode = 1;
});
