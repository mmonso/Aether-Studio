import express from 'express';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { stripDuplicateTitleHeading } from './src/lib/markdown';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in environment variables.');
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// ===================================================================
// MODELOS, RETENTATIVA E INSTRUMENTAÇÃO
// ===================================================================

/**
 * Modelo por papel, não por linha de código.
 *
 * Antes o nome do modelo estava cravado em 12 lugares, o que fazia de
 * "experimentar um modelo melhor na redação" uma caçada a string. Agora é
 * variável de ambiente.
 *
 * Tudo aponta para Flash porque é a família com free tier — subir a redação
 * e a auditoria passa a ser uma decisão, não um refactor.
 */
const FLASH = 'gemini-3.6-flash';
const FLASH_LITE = 'gemini-3.1-flash-lite';

type ModelRole = 'writer' | 'auditor' | 'utility';

const MODELS: Record<ModelRole, { primary: string; fallback: string }> = {
  // Pauta, rascunho, refinamento: o texto que sai com o nome do autor.
  writer: {
    primary: process.env.MODEL_WRITER || FLASH,
    fallback: process.env.MODEL_WRITER_FALLBACK || FLASH_LITE,
  },
  // Pesquisa, fact-check, comitê editorial: quem verifica e julga.
  auditor: {
    primary: process.env.MODEL_AUDITOR || FLASH,
    fallback: process.env.MODEL_AUDITOR_FALLBACK || FLASH_LITE,
  },
  // Prompt de imagem, formatos derivados: acessório, não vale gastar.
  utility: {
    primary: process.env.MODEL_UTILITY || FLASH,
    fallback: process.env.MODEL_UTILITY_FALLBACK || FLASH_LITE,
  },
};

/**
 * O que fazer quando o modelo bom está indisponível.
 *
 * `downgrade` — troca por um modelo menor e entrega. Certo quando existe um
 *   humano esperando na frente do navegador: texto pior é melhor que barra de
 *   progresso eterna.
 *
 * `wait` — espera mais e tenta de novo com o mesmo modelo. Certo no pipeline
 *   automático, onde ninguém está esperando às três da manhã. Não há motivo
 *   para aceitar texto inferior por pressa que não existe — e o risco real é
 *   publicar uma semana inteira em modelo rebaixado sem nunca saber.
 *
 * Padrão `downgrade` porque hoje só existe o modo interativo. O worker da F2
 * sobe com AI_FALLBACK_MODE=wait, ou manda o cabeçalho x-aether-mode: auto.
 */
type FallbackMode = 'downgrade' | 'wait';
const DEFAULT_FALLBACK_MODE: FallbackMode =
  process.env.AI_FALLBACK_MODE === 'wait' ? 'wait' : 'downgrade';

/** Instrumentação por requisição. Achado #7 da revisão: retry e fallback podem
 *  multiplicar o custo em silêncio, e os avisos morrem no terminal. */
interface AiUsage {
  calls: number;
  retries: number;
  /** Etapas que rodaram em modelo rebaixado. Vazio é o estado saudável. */
  degraded: { model: string; insteadOf: string }[];
  mode: FallbackMode;
  /**
   * Uma etapa esgotou TODAS as tentativas com 429.
   *
   * Distingue congestionamento por minuto — em que esperar resolve — de cota
   * do dia acabada, em que nenhuma espera resolve e cada tentativa ainda conta
   * como requisição.
   *
   * Vive aqui, e não no chamador, porque alguns handlers engolem o erro de
   * propósito (a busca do gerador de pautas degrada para "sem grounding" e
   * segue em frente). Sem este sinal, o worker insistiria contra uma cota
   * morta a execução inteira.
   */
  quotaExhausted: boolean;
  /**
   * A busca com grounding ficou indisponível, mas a geração comum não.
   *
   * O Google Search tem cota PRÓPRIA e bem menor que a de `generateContent`
   * no free tier: dá para escrever artigos o dia inteiro com a busca já
   * esgotada. Verificado em 03/08/2026 — geração HTTP 200, grounding HTTP 429,
   * mesma chave, mesmo minuto.
   *
   * Sem esta distinção, a falta de grounding derrubava a execução inteira do
   * worker, embora redação, revisão e imagem não dependam de busca nenhuma.
   */
  groundingUnavailable: boolean;
}

const aiUsageStore = new AsyncLocalStorage<AiUsage>();

function currentUsage(): AiUsage | undefined {
  return aiUsageStore.getStore();
}

function isRetryable(error: any): 'rate-limit' | 'transient' | null {
  const errMsg = String(error?.message || error || '');
  if (
    errMsg.includes('429') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('rate-limits') ||
    errMsg.includes('Quota exceeded') ||
    error?.status === 429 ||
    error?.code === 429
  ) {
    return 'rate-limit';
  }
  if (errMsg.includes('503') || errMsg.includes('overloaded')) return 'transient';
  return null;
}

// Retentativa com backoff exponencial em 429 e erros transitórios.
async function callGeminiWithRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 1500
): Promise<T> {
  const usage = currentUsage();
  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (usage) usage.calls += 1;
      return await operation();
    } catch (error: any) {
      lastError = error;
      const kind = isRetryable(error);

      if (kind && attempt < retries) {
        if (usage) usage.retries += 1;
        const label = kind === 'rate-limit' ? '429 Rate Limit' : '503 Server error';
        console.warn(
          `[Gemini API] ${label}. Retrying attempt ${attempt}/${retries} after ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        // Quem decide se isto é "cota morta" é o `runModelStep`, que sabe se a
        // etapa era essencial ou opcional. Marcar aqui derrubava a produção
        // inteira quando só o grounding tinha acabado.
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Executa uma etapa de IA no modelo do papel, aplicando a política de fallback.
 *
 * Substitui o padrão que estava repetido em sete endpoints:
 *   try { chamada(FLASH) } catch { chamada(FLASH_LITE) }
 * — que rebaixava calado e não contava nada.
 */
async function runModelStep<T>(
  role: ModelRole,
  call: (modelName: string) => Promise<T>,
  options: {
    label: string;
    retries?: number;
    delayMs?: number;
    /**
     * Etapa que o sistema sabe viver sem — hoje, as duas que usam
     * `googleSearch`. Cota estourada aqui NÃO significa cota estourada em
     * geral: o grounding tem cota própria e muito menor. Marcar como opcional
     * evita que a falta de busca derrube a produção inteira, e encurta a
     * insistência, que seria desperdício.
     */
    optional?: boolean;
  } = { label: role }
): Promise<T> {
  const { primary, fallback } = MODELS[role];
  const usage = currentUsage();
  const mode = usage?.mode ?? DEFAULT_FALLBACK_MODE;
  const { label, retries, delayMs, optional } = options;

  const markQuota = () => {
    if (!usage) return;
    if (optional) usage.groundingUnavailable = true;
    else usage.quotaExhausted = true;
  };

  try {
    // Etapa opcional não insiste: uma tentativa curta e segue sem ela.
    return await callGeminiWithRetry(
      () => call(primary),
      optional ? 1 : retries,
      delayMs
    );
  } catch (firstError: any) {
    if (optional) {
      if (isRetryable(firstError) === 'rate-limit') markQuota();
      console.warn(`[${label}] indisponível e opcional — seguindo sem esta etapa.`);
      throw firstError;
    }

    try {
      if (mode === 'wait') {
        // Sem pressa: insiste no modelo bom com uma janela bem maior em vez de
        // rebaixar. Se falhar de novo, o job sobe o erro e retoma depois — que é
        // o comportamento certo para uma fila noturna.
        console.warn(
          `[${label}] ${primary} indisponível. Modo 'wait': nova tentativa em janela longa, sem rebaixar.`
        );
        return await callGeminiWithRetry(() => call(primary), 3, 30_000);
      }

      console.warn(`[${label}] ${primary} indisponível. Rebaixando para ${fallback}.`);
      if (usage) usage.degraded.push({ model: fallback, insteadOf: primary });
      return await callGeminiWithRetry(() => call(fallback), retries, delayMs);
    } catch (lastError: any) {
      // Etapa ESSENCIAL que esgotou tudo com 429: aí sim é cota morta, e a
      // execução do worker inteira deve parar.
      if (isRetryable(lastError) === 'rate-limit') markQuota();
      throw lastError;
    }
  }
}

/**
 * Abre um contador de IA por requisição e o anexa à resposta.
 *
 * Fica em middleware, e não dentro de cada handler, para que os sete endpoints
 * passem a reportar consumo sem nenhum deles ser alterado. `aiUsage` só aparece
 * quando houve chamada de IA — health check e diagnóstico seguem limpos.
 *
 * O cabeçalho `x-aether-mode: auto` permite ao worker pedir a política 'wait'
 * por requisição, sem depender de variável de ambiente do processo.
 */
app.use((req, res, next) => {
  const usage: AiUsage = {
    calls: 0,
    retries: 0,
    degraded: [],
    quotaExhausted: false,
    groundingUnavailable: false,
    mode: req.get('x-aether-mode') === 'auto' ? 'wait' : DEFAULT_FALLBACK_MODE,
  };

  const sendJson = res.json.bind(res);
  res.json = (body: any) => {
    if (usage.calls > 0 && body && typeof body === 'object' && !Array.isArray(body)) {
      body.aiUsage = usage;
      if (usage.degraded.length > 0) {
        console.warn(
          `[${req.path}] Etapa concluída em modelo rebaixado:`,
          usage.degraded.map((d) => `${d.model} no lugar de ${d.insteadOf}`).join('; ')
        );
      }
    }
    return sendJson(body);
  };

  aiUsageStore.run(usage, next);
});

// API Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasKey: !!process.env.GEMINI_API_KEY });
});

// 0. GERADOR DE TÓPICOS E IDEIAS DE ARTIGOS
//
// As pautas nascem do que está em pauta AGORA, e não da memória do modelo,
// que tem data de corte e por isso sugeria como novidade assunto de um ano
// atrás. Primeiro uma varredura com o Google Search, depois a curadoria
// editorial em cima do que a busca trouxe.
//
// São duas chamadas porque a API do Gemini não aceita `tools` junto com
// `responseSchema` — a mesma restrição já enfrentada no fact-check.
//
// Se a busca falhar, o gerador continua funcionando de memória: brainstorm
// sem pesquisa ainda tem valor. Mas a resposta diz `groundingUsed: false`, e
// a tela avisa — pauta velha vendida como tendência faria você escrever com
// uma premissa falsa.
app.post('/api/generate-topics', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { keyword, category, blogName, blogNiche, userManifesto } = req.body;

    const bName = blogName || 'Studio Editorial';
    const bNiche = blogNiche || 'Conteúdo Especializado & Artigos';
    const authorName = userManifesto?.authorName || 'Autor(a) do Blog';
    const worldview = userManifesto?.worldviewDescription || 'Visão autoral e aprofundada do tema';
    const authorTone = userManifesto?.toneOfVoice || 'Analítico, informativo e reflexivo';
    const targetAudience = userManifesto?.targetAudienceDescription || 'Leitores interessados no tema';
    const favKeywords = userManifesto?.favoriteKeywords?.join(', ') || 'Rigor, clareza, autenticidade';
    const probTerms = userManifesto?.prohibitedTerms?.join(', ') || 'Clichês e promessas superficiais';

    const systemPrompt = `Você é um Estrategista de Conteúdo Editorial Especializado no nicho: "${bNiche}" para o blog "${bName}".
Seu objetivo é gerar 6 ideias de tópicos/pautas de artigos inovadoras, profundas e extremamente atrativas alinhadas à linha editorial do autor.

=== BLOG & NICHO ===
Blog: ${bName}
Nicho de Atuação: ${bNiche}

=== VISÃO DE MUNDO E PERFIL DO AUTOR (${authorName}) ===
"${worldview}"

=== TOM DE VOZ ===
${authorTone}

=== PÚBLICO-ALVO ===
${targetAudience}

=== VOCABULÁRIO RECOMENDADO ===
${favKeywords}

=== TERMOS A EVITAR ===
${probTerms}

DIRETRIZES DE CRIAÇÃO:
1. Os tópicos DEVEM ressoar com as dores e interesses reais do público-alvo no nicho "${bNiche}" e se conectar diretamente com a visão do autor.
2. Evite títulos clichês ou superficiais ("Como resolver tudo em 5 passos").
3. Prefira abordagens profundas, elegantes, autênticas e transformadoras.
4. Para cada tópico, forneça um título marcante, o ângulo de abordagem autoral e a explicação de por que esse tema combina com a filosofia do autor.`;

    // --- Etapa 1: o que está em alta agora (Google Search, sem schema) -------
    let trendsDigest = '';
    let trendSources: GroundingSource[] = [];

    const trendPrompt = `Levante o que está em pauta AGORA no nicho "${bNiche}".
${keyword ? `Recorte obrigatório: "${keyword}".` : ''}
${category ? `Eixo de interesse: "${category}".` : ''}

Busque no Google e traga:
1. Lançamentos, anúncios, publicações e mudanças das últimas semanas.
2. Debates e controvérsias em curso — onde há gente discordando.
3. Números, versões, nomes e datas exatos, como aparecem na fonte.
4. O que ainda é rumor ou especulação, marcado como tal.

Priorize o recente sobre o consagrado. Não complete lacunas com conhecimento próprio: se não encontrar, diga que não encontrou.`;

    try {
      const searchResponse = await runModelStep(
        'auditor',
        (modelName) =>
          ai.models.generateContent({
            model: modelName,
            contents: trendPrompt,
            config: {
              systemInstruction: `Você é o repórter de pauta do blog "${bName}", especializado em ${bNiche}. Sua função é apurar o que mudou no assunto recentemente, com fontes.`,
              tools: [{ googleSearch: {} }],
            },
          }),
        { label: 'Tópicos/busca', optional: true }
      );

      trendsDigest = searchResponse.text || '';
      trendSources = extractGroundingSources(searchResponse);
    } catch (searchError: any) {
      console.warn('[Tópicos] A busca de tendências falhou:', searchError.message);
    }

    const groundingUsed = trendSources.length > 0 && trendsDigest.trim().length > 0;

    if (!groundingUsed) {
      console.warn('[Tópicos] Sem grounding: as pautas sairão da memória do modelo.');
    }

    // --- Etapa 2: curadoria editorial em cima do apurado (sem tools) --------
    const trendContext = groundingUsed
      ? `\n=== O QUE ESTÁ EM PAUTA AGORA (apurado na web) ===
${trendsDigest}

=== FONTES CONSULTADAS ===
${trendSources.map((s) => `- ${s.sourceName}: ${s.title}`).join('\n')}

REGRA: cada uma das 6 pautas deve nascer de algo concreto deste material. Em "newsHook", registre o fato, número ou anúncio recente que ancora a pauta, citando a fonte. Não invente acontecimento que não esteja aqui.`
      : `\nATENÇÃO: a busca na web não retornou resultado. Gere as pautas a partir do seu próprio conhecimento e deixe "newsHook" vazio. NÃO afirme que algo é recente, novidade ou tendência — você não tem como saber.`;

    const userPrompt = `Gere 6 tópicos de artigos alinhados ao nicho ${bNiche}.
${keyword ? `Foco na palavra-chave ou assunto especificado: "${keyword}".` : ''}
${category ? `Categoria ou eixo de interesse: "${category}".` : ''}
${trendContext}`;

    const generateCall = (modelName: string) =>
      ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'Título atrativo e marcante do artigo' },
                    angle: { type: Type.STRING, description: 'Ângulo de abordagem do artigo' },
                    whyItFits: { type: Type.STRING, description: 'Por que encaixa na visão de mundo e nicho do blog' },
                    category: { type: Type.STRING, description: 'Categoria do tema' },
                    newsHook: {
                      type: Type.STRING,
                      description:
                        'O fato, número ou anúncio recente que ancora esta pauta, com a fonte. String vazia quando não houve apuração na web.',
                    },
                  },
                  required: ['title', 'angle', 'whyItFits', 'category'],
                },
              },
            },
            required: ['topics'],
          },
        },
      });

    const response = await runModelStep('writer', generateCall, { label: 'Tópicos/curadoria' });

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText);

    res.json({
      success: true,
      topics: parsed.topics || [],
      groundingUsed,
      sources: trendSources,
      searchedAt: groundingUsed ? new Date().toISOString() : null,
    });
  } catch (error: any) {
    console.error('Erro ao gerar tópicos:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao gerar tópicos' });
  }
});

// 0.5. PESQUISADOR & FACT-CHECKER
//
// Integridade acima de conveniência: este endpoint só devolve um dossiê quando
// houve pesquisa real na web. Se a busca não acontecer, ele FALHA — e o
// pipeline segue sem fact-check, sem selo e sem nota. Um dossiê inventado é
// pior que dossiê nenhum, porque vira instrução de veracidade para o redator
// e vira selo de credibilidade para o leitor.
//
// A busca e a estruturação são duas chamadas separadas de propósito: a API do
// Gemini não aceita `tools` junto com `responseSchema`, e a tentativa anterior
// de combinar os dois fazia toda apuração cair silenciosamente para um modelo
// sem acesso à web, respondendo de memória.

interface GroundingSource {
  title: string;
  sourceName: string;
  url?: string;
  reliability: string;
  snippet?: string;
}

// Extrai as fontes que o Google Search realmente consultou.
function extractGroundingSources(response: any): GroundingSource[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  return chunks
    .map((chunk: any) => {
      const web = chunk?.web;
      if (!web?.uri) return null;
      let sourceName = web.domain || '';
      if (!sourceName) {
        try {
          sourceName = new URL(web.uri).hostname.replace(/^www\./, '');
        } catch {
          sourceName = 'Fonte web';
        }
      }
      return {
        title: web.title || sourceName,
        sourceName,
        url: web.uri,
        reliability: 'verificada',
      };
    })
    .filter(Boolean) as GroundingSource[];
}

app.post('/api/research-factcheck', async (req, res) => {
  const { topic, newsReferenceUrl, blogName, blogNiche } = req.body;

  if (!topic) {
    return res.status(400).json({ success: false, error: 'Tema não informado.' });
  }

  const bName = blogName || 'Blog Editorial';
  const bNiche = blogNiche || 'Tecnologia e Inovação';

  const researchSystemPrompt = `Você é o PESQUISADOR E CHECADOR DE FATOS do blog "${bName}" (nicho: ${bNiche}).
Use a busca do Google para levantar fatos recentes, verificáveis e atribuíveis sobre o tema.

REGRAS:
1. Só afirme o que encontrar nas fontes consultadas. Não complete lacunas com conhecimento próprio.
2. Registre números, datas, versões e nomes próprios exatamente como aparecem na fonte.
3. Separe o que está confirmado do que é rumor, especulação de mercado ou anúncio não verificado.
4. Se as fontes divergirem, diga que divergem e mostre as duas versões.
5. Se não encontrar material confiável sobre algum ponto, diga isso explicitamente.`;

  const researchPrompt = `Pesquise e cheque os fatos sobre: "${topic}".${
    newsReferenceUrl ? `\nReferência fornecida pelo autor: ${newsReferenceUrl}` : ''
  }`;

  try {
    const ai = getGeminiClient();

    // --- Etapa 1: pesquisa com Google Search (sem schema) --------------------
    let researchText = '';
    let groundingSources: GroundingSource[] = [];

    try {
      const searchResponse = await runModelStep(
        'auditor',
        (modelName) =>
          ai.models.generateContent({
            model: modelName,
            contents: researchPrompt,
            config: {
              systemInstruction: researchSystemPrompt,
              tools: [{ googleSearch: {} }],
            },
          }),
        { label: 'Fact-check/busca', optional: true }
      );

      researchText = searchResponse.text || '';
      groundingSources = extractGroundingSources(searchResponse);
    } catch (searchError: any) {
      console.error('[Fact-check] A busca falhou:', searchError.message);
      return res.status(502).json({
        success: false,
        groundingUsed: false,
        error:
          'A pesquisa na web falhou, então não há como checar os fatos. O artigo pode ser escrito sem fact-check, mas não receberá selo de verificação.',
      });
    }

    // Sem fontes consultadas não houve apuração — o modelo respondeu de memória.
    if (groundingSources.length === 0) {
      console.warn('[Fact-check] Resposta sem grounding: nenhuma fonte foi consultada.');
      return res.status(422).json({
        success: false,
        groundingUsed: false,
        error:
          'O modelo respondeu sem consultar nenhuma fonte na web. Sem apuração real, o dossiê seria apenas memória do modelo — nenhum selo de verificação será emitido.',
      });
    }

    // --- Etapa 2: estruturar o que foi apurado (sem tools) -------------------
    const structureSchema = {
      type: Type.OBJECT,
      properties: {
        researchSummary: {
          type: Type.STRING,
          description: 'Resumo analítico dos fatos apurados, fiel ao material pesquisado',
        },
        credibilityScore: {
          type: Type.NUMBER,
          description:
            'De 0 a 100: quão sólida é a apuração, considerando quantidade e qualidade das fontes e convergência entre elas. Seja rigoroso — 100 exige múltiplas fontes primárias concordantes.',
        },
        verifiedFacts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Fatos sustentados pelas fontes pesquisadas, com números e datas',
        },
        unverifiedClaimsOrRumors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Rumores, especulações e afirmações sem confirmação que o texto deve evitar',
        },
        verdict: {
          type: Type.STRING,
          description:
            'Um de: "Verificado e Confiável", "Requer Cautela", "Informação Parcial ou em Atualização"',
        },
      },
      required: [
        'researchSummary',
        'credibilityScore',
        'verifiedFacts',
        'unverifiedClaimsOrRumors',
        'verdict',
      ],
    };

    const structurePrompt = `Organize a apuração abaixo no formato solicitado. Não acrescente nenhum fato que não esteja no material.

TEMA: ${topic}

MATERIAL APURADO NA WEB:
${researchText}

FONTES CONSULTADAS:
${groundingSources.map((s) => `- ${s.sourceName}: ${s.title}`).join('\n')}`;

    const structureCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: structurePrompt,
        config: { responseMimeType: 'application/json', responseSchema: structureSchema },
      });

    const structured = await runModelStep('auditor', structureCall, {
      label: 'Fact-check/estruturação',
      retries: 2,
      delayMs: 500,
    });

    const parsed = JSON.parse(structured.text || '{}');

    if (!parsed.researchSummary || !Array.isArray(parsed.verifiedFacts)) {
      return res.status(502).json({
        success: false,
        groundingUsed: true,
        error: 'A apuração retornou em formato inesperado e foi descartada.',
      });
    }

    res.json({
      success: true,
      data: {
        researchSummary: parsed.researchSummary,
        // Sem default: a nota vem da apuração ou não existe.
        credibilityScore:
          typeof parsed.credibilityScore === 'number'
            ? Math.max(0, Math.min(100, parsed.credibilityScore))
            : null,
        verifiedFacts: parsed.verifiedFacts,
        unverifiedClaimsOrRumors: parsed.unverifiedClaimsOrRumors || [],
        sources: groundingSources,
        groundingUsed: true,
        checkedAt: new Date().toISOString(),
        verdict: parsed.verdict || 'Informação Parcial ou em Atualização',
      },
    });
  } catch (error: any) {
    console.error('[Fact-check] Erro:', error);
    // Sem dossiê de consolação. Falhou é falhou.
    res.status(500).json({
      success: false,
      groundingUsed: false,
      error: error.message || 'Falha na checagem de fatos.',
    });
  }
});

// 1. REDATOR: Gera Rascunho do Artigo baseado na Visão de Mundo do Autor
app.post('/api/generate-draft', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      topic,
      targetAudience,
      tone,
      depthLevel,
      articleLength,
      customWriterPrompt,
      blogName,
      blogNiche,
      userManifesto,
      factCheck,
    } = req.body;

    const bName = blogName || 'Blog Especializado';
    const bNiche = blogNiche || 'Conteúdo Editorial';
    const lengthGuide =
      articleLength === 'longo'
        ? 'Artigo aprofundado com cerca de 1200 a 1600 palavras, vários subtítulos e explicações minuciosas.'
        : articleLength === 'curto'
        ? 'Artigo direto e conciso com cerca de 500 a 700 palavras, leitura rápida.'
        : 'Artigo médio e bem equilibrado com cerca de 800 a 1100 palavras.';

    const authorName = userManifesto?.authorName || 'Autor(a)';
    const worldview = userManifesto?.worldviewDescription || 'Visão autoral e humanizada sobre o assunto.';
    const authorTone = tone || userManifesto?.toneOfVoice || 'Informativo, Ensaístico e Autoral';
    const favKeywords = Array.isArray(userManifesto?.favoriteKeywords)
      ? userManifesto.favoriteKeywords.join(', ')
      : 'clareza, rigor, autenticidade, profundidade';
    const probTerms = Array.isArray(userManifesto?.prohibitedTerms)
      ? userManifesto.prohibitedTerms.join(', ')
      : 'clichês, fórmulas mágicas, 5 passos rápidos';
    const writerInst = userManifesto?.writerInstructions || 'Escrever com densidade e estilo autoral.';

    const factCheckContext = factCheck
      ? `\n=== DOSSIÊ DE PESQUISA AO VIVO & FACT-CHECKING ANTI-FAKE NEWS ===
Resumo dos Fatos Apurados: ${factCheck.researchSummary}
Confiabilidade dos Dados: ${factCheck.credibilityScore}% (${factCheck.verdict})
FATOS COMPROVADOS E CHECADOS:
${Array.isArray(factCheck.verifiedFacts) ? factCheck.verifiedFacts.map((f: string) => `- ${f}`).join('\n') : ''}

BOATOS OU DADOS NÃO CONFIRMADOS A EVITAR RIGOROSAMENTE:
${Array.isArray(factCheck.unverifiedClaimsOrRumors) ? factCheck.unverifiedClaimsOrRumors.map((r: string) => `- ${r}`).join('\n') : 'Nenhum boato relevante identificado.'}

FONTES VERIFICADAS DE REFERÊNCIA:
${Array.isArray(factCheck.sources) ? factCheck.sources.map((s: any) => `- ${s.sourceName}: "${s.title}"`).join('\n') : ''}
ATENÇÃO: Você DEVE basear o artigo rigorosamente nestes fatos verificados acima, citando contextualização e dados reais sem alterar a verdade dos fatos.
`
      : '';

    const systemPrompt = `Você é o REDATOR VIRTUAL OFICIAL do blog "${bName}" (Nicho: ${bNiche}), escrito por ${authorName}.
Sua missão é escrever o rascunho de um artigo/ensaio autoral, profundo e provocativo, fugindo categoricamente de clichês de inteligência artificial e textos genéricos da internet.
${factCheckContext}
=== BLOG & NICHO DE ATUAÇÃO ===
Nome do Blog: ${bName}
Nicho: ${bNiche}

=== VISÃO DE MUNDO E LINHA EDITORIAL DO AUTOR ===
${worldview}

=== TOM DE VOZ E ESTILO ===
${authorTone}

=== PÚBLICO-ALVO ===
${targetAudience || userManifesto?.targetAudienceDescription || 'Leitores do blog em busca de conteúdo de alto valor'}

=== VOCABULÁRIO RECOMENDADO DO AUTOR ===
${favKeywords}

=== TERMOS E CONSTRUÇÕES ESTRITAMENTE PROIBIDOS ===
ABSOLUTAMENTE PROIBIDO USAR OU FAZER: ${probTerms}

=== DIRETRIZES DE ESCRITA ANTI-GENÉRICA DO AUTOR ===
${writerInst}

=== PARÂMETROS DO ARTIGO ===
Nível de Profundidade: ${depthLevel}
Extensão do Texto: ${lengthGuide}

=== REGRAS DE OURO CONTRA TEXTO GENÉRICO ===
1. Respeite o tom do autor. NUNCA use o pronome "você" de forma apelativa ou estilo coach motivacional a menos que explicitamente permitido nas instruções.
2. NUNCA comece com introduções clichês ("No mundo acelerado de hoje...", "É muito comum ver..."). Comece imediatamente por um fato, tensão, história, cena cotidiana ou conceito impactante do nicho ${bNiche}.
3. NUNCA crie listas genéricas de "5 passos" ou "dicas rápidas". Mantenha o texto em prosa fluida, contínua e rica.
4. Mantenha os conceitos assimilados organicamente sem jargões pretensiosos vazios.
5. NUNCA termine com resumos burocráticos ("Em suma...", "Em conclusão..."). Mantenha o encerramento marcante e reflexivo.
6. Mantenha o texto em prosa fluida, densa e envolvente do início ao fim.
7. NUNCA repita o título do artigo como cabeçalho no corpo do texto. O campo "title" já carrega o título; o "rawText" deve começar direto pelo primeiro parágrafo, sem nenhum H1 (#) inicial.

${customWriterPrompt ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${customWriterPrompt}` : ''}`;

    const userPrompt = `Por favor, elabore o artigo completo para o blog "${bName}" baseado no tema: "${topic}".`;

    const draftSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título provocativo e conceitual do artigo' },
        subtitle: { type: Type.STRING, description: 'Subtítulo reflexivo' },
        outline: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Eixos conceituais abordados no artigo',
        },
        rawText: { type: Type.STRING, description: 'Texto completo do artigo formatado em Markdown' },
      },
      required: ['title', 'subtitle', 'outline', 'rawText'],
    };

    const generateDraftCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: draftSchema,
        },
      });

    const response = await runModelStep('writer', generateDraftCall, { label: 'Redator' });

    const text = response.text || '{}';
    const parsedData = JSON.parse(text);

    res.json({
      success: true,
      data: {
        title: parsedData.title,
        subtitle: parsedData.subtitle,
        outline: parsedData.outline || [],
        rawText: parsedData.rawText,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating draft:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao gerar rascunho.' });
  }
});

// 2. COMITÊ EDITORIAL: Revisa e Pole o Artigo o Artigo + Parecer Ético/Qualidade segundo a Visão de Mundo
app.post('/api/review-draft', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      topic,
      draftTitle,
      draftSubtitle,
      draftText,
      customReviewerPrompt,
      blogName,
      blogNiche,
      userManifesto,
      factCheck,
    } = req.body;

    const bName = blogName || 'Blog Especializado';
    const bNiche = blogNiche || 'Conteúdo Editorial';
    const authorName = userManifesto?.authorName || 'Autor(a)';
    const worldview = userManifesto?.worldviewDescription || 'Visão autoral e aprofundada';
    const ethicsRules = userManifesto?.ethicsRules || 'Garantir veracidade, ética e responsabilidade no conteúdo.';
    const reviewerInst = userManifesto?.reviewerInstructions || 'Garantir rigor de qualidade e tom autoral.';
    const humanizerInst = userManifesto?.humanizerInstructions || 'Eliminar marcas de IA, conectores burocráticos e variar o ritmo.';
    const conceptualInst = userManifesto?.conceptualCuratorInstructions || 'Assegurar rigor conceitual e integridade dos argumentos do autor.';

    const factCheckAudit = factCheck
      ? `\n=== AUDITOR DE FACT-CHECKING & FONTES VERIFICADAS ("GUARDIÃO DA VERACIDADE") ===
- Dossiê de Fact-Checking: Confiabilidade de ${factCheck.credibilityScore}% (${factCheck.verdict})
- Fatos Confirmados: ${Array.isArray(factCheck.verifiedFacts) ? factCheck.verifiedFacts.join('; ') : ''}
- Boatos a Impedir: ${Array.isArray(factCheck.unverifiedClaimsOrRumors) ? factCheck.unverifiedClaimsOrRumors.join('; ') : ''}
- Exigência: Auditar se o texto não inventou fatos adicionais, não propagou boatos e citou as informações apuradas com exatidão factual.`
      : '';

    const systemPrompt = `Você opera como um COMITÊ EDITORIAL E DE REDAÇÃO SÊNIOR para o blog "${bName}" (Nicho: ${bNiche}), do(a) autor(a) ${authorName}.
Este comitê é composto pelos ESPECIALISTAS AVALIADORES e pelo REDATOR PRINCIPAL, que unifica tudo:

=== 1. EDITOR DE HUMANIZAÇÃO & CADÊNCIA TEXTUAL ("DES-AIZADOR") ===
- Função: Identificar e destruir qualquer vestígio de linguagem robótica, frases de transição de IA ("Além disso", "Portanto", "No entanto", "Vale ressaltar"), simetria mecânica de parágrafos e entusiasmo artificial.
- Diretrizes do Autor: ${humanizerInst}
- Saída: Escreva um parecer detalhado no campo "humanizationNotes" indicando os vícios de IA identificados e como o ritmo foi humanizado.

=== 2. CURADOR CONCEITUAL & ESPECIALISTA DO NICHO ("GUARDIÃO DO CONTEÚDO") ===
- Função: Avaliar a profundidade teórica, técnica e autoral no nicho "${bNiche}". Garantir que as ideias do manifesto do autor não sejam superficiais nem clichês vazios.
- Diretrizes do Autor: ${conceptualInst}
- Saída: Escreva um parecer detalhado no campo "conceptualNotes" indicando pontos aprofundados e o alinhamento com a linha editorial.

=== 3. REVISOR EDITORIAL & ÉTICO ("GUARDIÃO DE QUALIDADE & ÉTICA") ===
- Função: Verificar limites éticos do nicho "${bNiche}", precisão de declarações, tom de voz e ausência de afirmações levianas ou apelativas.
- Regras Éticas: ${ethicsRules}
- Diretrizes: ${reviewerInst}
- Saída: Escreva seu parecer técnico no campo "clinicalNotes" e o resultado de conformidade em "ethicsDetails".
${factCheckAudit}

=== 4. REDATOR PRINCIPAL — REESCRITA E SÍNTESE UNIFICADA (MANDATO ABSOLUTO DE COESÃO) ===
CRÍTICO: O texto final ("revisedText") NUNCA PODE SER UMA COLCHA DE RETALHOS com trechos desconexos.
O Redator Principal recebe os pareceres dos especialistas acima e REESCREVE O ARTIGO DO ZERO de forma totalmente integrada, fluida e coesa.
- Todas as correções de humanização, rigor conceitual e conformidade editorial/fact-check devem ser dissolvidas organicamente em uma única voz autoral.
- O texto final deve ser formatado em Markdown impecável, sem listas numeradas de 5 passos e sem clichês.
- O "revisedText" NUNCA deve abrir repetindo o título como H1 (#). O título vai no campo "revisedTitle"; o corpo começa pelo primeiro parágrafo.
- No campo "writerSynthesisNotes", o Redator explica resumidamente como unificou as orientações dos especialistas em uma narrativa fluida.

${customReviewerPrompt ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO PARA A REVISÃO:\n${customReviewerPrompt}` : ''}`;

    const userPrompt = `Realize a análise multidisciplinar pelos 3 especialistas e execute a REESCRITA UNIFICADA E COESA pelo Redator Principal para o seguinte rascunho:

TEMA: ${topic}
TÍTULO ATUAL: ${draftTitle}
SUBTÍTULO ATUAL: ${draftSubtitle}

TEXTO RASCUNHO PARA REVISÃO E REESCRITA:
${draftText}`;

    const reviewSchema = {
      type: Type.OBJECT,
      properties: {
        revisedTitle: { type: Type.STRING, description: 'Título final polido e provocativo' },
        revisedSubtitle: { type: Type.STRING, description: 'Subtítulo final refinado' },
        revisedText: { type: Type.STRING, description: 'Texto completamente reescrito e unificado pelo Redator Principal em Markdown, sem clichês, marcas de IA ou "você"' },
        humanizationNotes: { type: Type.STRING, description: 'Parecer do Editor de Humanização: marcas de IA expurgadas, conectores cortados e ritmo oxigenado' },
        conceptualNotes: { type: Type.STRING, description: 'Parecer do Curador Conceitual: precisão dos termos técnicos, profundidade da análise e alinhamento com a linha editorial do blog' },
        clinicalNotes: { type: Type.STRING, description: 'Parecer do Revisor Editorial: adequação ética, isenção ao avaliar ferramentas e ausência de afirmações sem embasamento' },
        writerSynthesisNotes: { type: Type.STRING, description: 'Explicativo do Redator Principal sobre como fundiu as orientações dos especialistas em uma prosa única e coesa' },
        ethicsCheckPassed: { type: Type.BOOLEAN },
        ethicsDetails: { type: Type.STRING, description: 'Comentários sobre a adequação ética e recusa de diagnósticos rasos' },
        metaDescription: { type: Type.STRING, description: 'Meta descrição para SEO até 155 caracteres' },
        socialCaption: { type: Type.STRING, description: 'Legenda pronta para redes sociais alinhada ao tom crítico do autor' },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedTags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2 a 4 tags temáticas extraídas do próprio conteúdo do artigo, no vocabulário do nicho do blog. Use termos que um leitor buscaria.',
        },
        keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
        readingTimeMinutes: { type: Type.NUMBER },
      },
      required: [
        'revisedTitle',
        'revisedSubtitle',
        'revisedText',
        'humanizationNotes',
        'conceptualNotes',
        'clinicalNotes',
        'writerSynthesisNotes',
        'ethicsCheckPassed',
        'ethicsDetails',
        'metaDescription',
        'socialCaption',
        'hashtags',
        'keyTakeaways',
        'readingTimeMinutes',
      ],
    };

    const generateReviewCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: reviewSchema,
        },
      });

    const response = await runModelStep('auditor', generateReviewCall, {
      label: 'Comitê editorial',
    });

    const parsed = JSON.parse(response.text || '{}');

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Error reviewing draft:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao revisar rascunho.' });
  }
});

// 2b. CRÍTICO — a etapa que reprova, e que não reescreve nada
//
// Por que é um endpoint separado do comitê editorial acima: o comitê revisa e
// REESCREVE no mesmo passo, e quem reescreve nunca reprova o próprio trabalho.
// O crítico não tem acesso à caneta. Ele só pontua e ordena problemas. Isso
// também é o que permite o veto ser um número — `score` e `wouldPublish` — em
// vez de um parecer em prosa que ninguém consegue ler por código.
app.post('/api/critique-draft', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      topic,
      title,
      subtitle,
      text,
      blogName,
      blogNiche,
      userManifesto,
      factCheck,
      // O que a verificação determinística já achou: o crítico não deve gastar
      // atenção recontando conector, e as regras que o código não sabe checar
      // chegam aqui como responsabilidade dele.
      deterministicFindings,
      unverifiableRules,
    } = req.body;

    const bName = blogName || 'Blog Especializado';
    const bNiche = blogNiche || 'Conteúdo Editorial';
    const authorName = userManifesto?.authorName || 'Autor(a)';
    const audience = userManifesto?.targetAudienceDescription || 'Leitor especializado no nicho';
    const worldview = userManifesto?.worldviewDescription || '';
    const ethicsRules = userManifesto?.ethicsRules || '';

    const alreadyFound = Array.isArray(deterministicFindings) && deterministicFindings.length
      ? `\nO QUE A VERIFICAÇÃO AUTOMÁTICA JÁ MEDIU (não repita, não recontagem):\n` +
        deterministicFindings
          .map((f: any) => `- [${f.severity}] ${f.message}`)
          .join('\n')
      : '';

    const rulesToJudge = Array.isArray(unverifiableRules) && unverifiableRules.length
      ? `\nREGRAS DO MANIFESTO QUE SÓ VOCÊ PODE JULGAR (o código não consegue):\n` +
        unverifiableRules.map((r: string) => `- ${r}`).join('\n')
      : '';

    const factContext = factCheck
      ? `\nAPURAÇÃO DISPONÍVEL: confiabilidade ${factCheck.credibilityScore}% (${factCheck.verdict}).` +
        `\nFatos confirmados: ${Array.isArray(factCheck.verifiedFacts) ? factCheck.verifiedFacts.join('; ') : '—'}` +
        `\nAfirmações NÃO confirmadas: ${Array.isArray(factCheck.unverifiedClaimsOrRumors) ? factCheck.unverifiedClaimsOrRumors.join('; ') : '—'}`
      : '\nNão houve apuração com fontes para este artigo. Trate afirmações factuais sem origem declarada como problema.';

    const systemPrompt = `Você é o crítico mais duro que este artigo vai encontrar — o especialista de "${bNiche}" que leria isto e diria em público o que está errado.

Você NÃO reescreve. Você NÃO sugere texto novo. Você aponta problemas, ordenados do mais grave para o menos grave, e dá uma nota.

CONTEXTO
- Blog: "${bName}", nicho "${bNiche}", assinado por ${authorName}.
- Quem lê: ${audience}
${worldview ? `- Linha editorial do autor: ${worldview}` : ''}
${ethicsRules ? `- Limites éticos: ${ethicsRules}` : ''}
${factContext}
${alreadyFound}
${rulesToJudge}

COMO CRITICAR
1. Procure o que um especialista rejeitaria: afirmação sem sustentação, analogia que não se sustenta, conclusão que não decorre do que veio antes, obviedade vendida como descoberta, precisão técnica falsa.
2. Cada problema precisa CITAR o trecho. Crítica sem endereço é inútil.
3. Ordene por gravidade real para ESTE leitor. O rank 1 é o que mais compromete o artigo.
4. Diga o que fazer ("fix"), não o texto pronto.
5. Aponte também o ponto MAIS FORTE do artigo. Quem for corrigir precisa saber o que não pode destruir.

A NOTA
- 0 a 10, onde 7 é o mínimo que o autor assinaria sem constrangimento.
- Seja severo. Um texto competente e sem erro, mas que não diz nada que o leitor já não soubesse, não passa de 6.
- "wouldPublish": você deixaria isto sair com o nome de ${authorName} nele?

Não elogie por educação. O autor pediu a crítica, não o afago.`;

    const userPrompt = `TEMA: ${topic}
TÍTULO: ${title}
SUBTÍTULO: ${subtitle}

ARTIGO:
${text}`;

    const critiqueSchema = {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER, description: 'Nota de 0 a 10. 7 é o mínimo publicável.' },
        wouldPublish: { type: Type.BOOLEAN },
        verdict: { type: Type.STRING, description: 'Uma frase sobre o artigo como um todo.' },
        strongestPoint: { type: Type.STRING, description: 'O que o artigo tem de melhor e não pode ser perdido numa correção.' },
        problems: {
          type: Type.ARRAY,
          description: 'Problemas ordenados por gravidade, do pior para o menos grave. No máximo 8.',
          items: {
            type: Type.OBJECT,
            properties: {
              rank: { type: Type.NUMBER, description: '1 é o mais grave. Sem empate.' },
              severity: { type: Type.STRING, description: 'grave, medio ou leve' },
              area: { type: Type.STRING, description: 'argumento, evidencia, voz, estrutura ou precisao' },
              what: { type: Type.STRING, description: 'O problema em uma frase.' },
              where: { type: Type.STRING, description: 'Trecho citado do artigo onde o problema está.' },
              why: { type: Type.STRING, description: 'Por que isso compromete o artigo para este leitor.' },
              fix: { type: Type.STRING, description: 'O que fazer. Instrução, não texto pronto.' },
            },
            required: ['rank', 'severity', 'area', 'what', 'where', 'why', 'fix'],
          },
        },
      },
      required: ['score', 'wouldPublish', 'verdict', 'strongestPoint', 'problems'],
    };

    const critiqueCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: critiqueSchema,
        },
      });

    const response = await runModelStep('auditor', critiqueCall, { label: 'Crítico' });
    const parsed = JSON.parse(response.text || '{}');

    // O ranqueamento é contrato, não sugestão: quem consome corta os N
    // primeiros. Se o modelo devolver ranks repetidos ou fora de ordem, a
    // ordenação aqui é o que garante que "os três primeiros" signifique algo.
    const problems = Array.isArray(parsed.problems)
      ? [...parsed.problems]
          .sort((a: any, b: any) => (Number(a?.rank) || 99) - (Number(b?.rank) || 99))
          .map((p: any, i: number) => ({ ...p, rank: i + 1 }))
      : [];

    res.json({
      success: true,
      data: {
        ...parsed,
        score: clampScore(parsed.score),
        wouldPublish: parsed.wouldPublish === true,
        problems,
      },
    });
  } catch (error: any) {
    console.error('Error critiquing draft:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao criticar o artigo.' });
  }
});

/** Nota fora da escala é erro do modelo, não licença poética. */
function clampScore(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

// 2c. REPARO — o redator recebe a crítica ranqueada e só ela
//
// O risco registrado no checklist é "excesso de críticos apaga a voz autoral".
// A defesa é dupla: só os primeiros problemas da lista chegam aqui, e o texto
// volta com instrução explícita de não reescrever o que não foi apontado.
app.post('/api/apply-critique', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      title,
      subtitle,
      text,
      problems,
      strongestPoint,
      blogName,
      blogNiche,
      userManifesto,
    } = req.body;

    const list = Array.isArray(problems) ? problems : [];
    if (list.length === 0) {
      res.status(400).json({ success: false, error: 'Nenhum problema para corrigir.' });
      return;
    }

    const authorName = userManifesto?.authorName || 'Autor(a)';
    const writerInst = userManifesto?.writerInstructions || '';
    const humanizerInst = userManifesto?.humanizerInstructions || '';

    const systemPrompt = `Você é ${authorName}, escrevendo para o blog "${blogName || 'Blog'}" (nicho: ${blogNiche || 'editorial'}).

Um crítico leu o seu artigo e apontou os problemas abaixo. Você vai corrigir ESTES problemas e mais nenhum.

REGRA QUE NÃO SE NEGOCIA
- Não reescreva parágrafo que não foi apontado. Se o crítico não reclamou, está bom.
- Não "melhore" o estilo por conta própria. Cada frase que você troca sem motivo apontado é a sua voz sendo substituída pela média.
- Preserve isto acima de tudo: ${strongestPoint || 'a tese central do artigo'}
- O texto não abre repetindo o título como H1.
${writerInst ? `\nCOMO VOCÊ ESCREVE:\n${writerInst}` : ''}
${humanizerInst ? `\nVÍCIOS QUE VOCÊ NÃO COMETE:\n${humanizerInst}` : ''}

Se um problema apontado exigir um fato que você não tem, não invente: reescreva o trecho para não depender dele, e registre isso em "unresolved".`;

    const problemList = list
      .map(
        (p: any, i: number) =>
          `${i + 1}. [${p.severity || 'medio'} · ${p.area || 'geral'}] ${p.what}\n` +
          `   Onde: "${p.where}"\n` +
          `   Por quê: ${p.why}\n` +
          `   O que fazer: ${p.fix}`
      )
      .join('\n\n');

    const userPrompt = `TÍTULO: ${title}
SUBTÍTULO: ${subtitle}

PROBLEMAS A CORRIGIR (só estes):
${problemList}

ARTIGO ATUAL:
${text}`;

    const repairSchema = {
      type: Type.OBJECT,
      properties: {
        revisedTitle: { type: Type.STRING },
        revisedSubtitle: { type: Type.STRING },
        revisedText: { type: Type.STRING, description: 'O artigo corrigido em Markdown, sem H1 de título.' },
        changeLog: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Uma linha por problema, dizendo o que foi feito.',
        },
        unresolved: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Problemas que não deu para resolver sem inventar fato. Vazio se não houver.',
        },
      },
      required: ['revisedTitle', 'revisedSubtitle', 'revisedText', 'changeLog'],
    };

    const repairCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: repairSchema,
        },
      });

    const response = await runModelStep('writer', repairCall, { label: 'Reparo pós-crítica' });
    const parsed = JSON.parse(response.text || '{}');

    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error applying critique:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao aplicar a crítica.' });
  }
});

// 3. GERADOR DE IMAGEM EDITORIAL
app.post('/api/generate-image', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { title, summary, visualStyle, promptModifier, customImagePrompt } = req.body;

    let finalImagePrompt = '';
    let conceptDesc = '';
    let altTextDesc = '';

    const imageCraftPrompt = `Gere um prompt em inglês conciso e límpido (máximo 25 palavras) para um gerador de imagem editorial de tecnologia:
TÍTULO: ${title}
RESUMO: ${summary}
ESTILO VISUAL: ${visualStyle} (${promptModifier})
${customImagePrompt ? `DIRETRIZ EXTRA: ${customImagePrompt}` : ''}

DIRETRIZES DE CRIAÇÃO:
- Deve ser uma imagem conceitual e sofisticada, com estética editorial de tecnologia.
- Sem texto ou palavras na imagem.
- Retorne em JSON.`;

    const imageCraftSchema = {
      type: Type.OBJECT,
      properties: {
        imagePromptInEnglish: { type: Type.STRING, description: 'Concise English prompt under 25 words' },
        conceptExplanation: { type: Type.STRING, description: 'Explicação poética da metáfora visual em português' },
        altText: { type: Type.STRING, description: 'Descrição acessível da imagem' },
      },
      required: ['imagePromptInEnglish', 'conceptExplanation', 'altText'],
    };

    const generateCraftCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: imageCraftPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: imageCraftSchema,
        },
      });

    const promptCraftResponse = await runModelStep('utility', generateCraftCall, {
      label: 'Designer/prompt de capa',
    });

    const craftData = JSON.parse(promptCraftResponse.text || '{}');
    finalImagePrompt = craftData.imagePromptInEnglish || `Minimalist editorial illustration for ${title}, soft warm lighting, fine art`;
    conceptDesc = craftData.conceptExplanation || 'Ilustração editorial conceitual de tecnologia.';
    altTextDesc = craftData.altText || `Ilustração de capa sobre ${title}`;

    // Clean prompt for URL construction
    const cleanPrompt = finalImagePrompt
      .replace(/[^\w\s,.-]/gi, '')
      .slice(0, 150);

    const uniqueSeed = Math.floor(Math.random() * 900000) + 100000;
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=675&nologo=true&seed=${uniqueSeed}`;

    res.json({
      success: true,
      data: {
        imageUrl,
        promptUsed: finalImagePrompt,
        conceptExplanation: conceptDesc,
        altText: altTextDesc,
        styleUsed: visualStyle,
      },
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao gerar imagem.' });
  }
});

// 4. REFINAMENTO PONTUAL DE SELEÇÃO DE TEXTO
app.post('/api/refine-selection', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { selectedText, instruction, fullText, userManifesto } = req.body;

    if (!selectedText || !instruction) {
      return res.status(400).json({ success: false, error: 'Texto selecionado e instrução são obrigatórios.' });
    }

    const authorName = userManifesto?.authorName || 'Autor(a)';
    const worldview = userManifesto?.worldviewDescription || 'Visão analítica e autoral sobre tecnologia';
    const authorTone = userManifesto?.toneOfVoice || 'Analítico, preciso, denso e didático';

    const systemPrompt = `Você é o Revisor e Editor de Texto Técnico do autor ${authorName}.
Sua tarefa é REESCREVER estritamente o trecho de texto selecionado pelo usuário, aplicando com rigor a instrução de correção fornecida.

=== VISÃO DE MUNDO E TOM DE VOZ ===
${worldview}
Tom: ${authorTone}

=== REGRAS DE OURO ===
1. Mantenha o formato em Markdown se for o caso.
2. NUNCA use a palavra "você" nem se dirija diretamente ao leitor de forma prescritiva.
3. Não use clichês de autoajuda nem listas numeradas de conselhos.
4. O trecho reescrito deve se integrar de forma fluida ao restante do ensaio.
5. Retorne APENAS o trecho reescrito atualizado em JSON no campo "rewrittenText", acompanhado de uma breve explicação em "explanation".`;

    const userPrompt = `TRECHO SELECCIONADO PELO AUTOR PARA CORREÇÃO:
"${selectedText}"

INSTRUÇÃO DE MUDANÇA / CORREÇÃO:
"${instruction}"

${fullText ? `CONTEXTO AO ENTORNO (APENAS REFERÊNCIA):\n${fullText.slice(0, 1000)}...` : ''}`;

    const refineSchema = {
      type: Type.OBJECT,
      properties: {
        rewrittenText: { type: Type.STRING, description: 'Novo trecho reescrito com as correções aplicadas' },
        explanation: { type: Type.STRING, description: 'Resumo da alteração realizada' },
      },
      required: ['rewrittenText', 'explanation'],
    };

    const generateRefineCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: refineSchema,
        },
      });

    const response = await runModelStep('writer', generateRefineCall, {
      label: 'Refinamento de trecho',
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Erro ao reescrever seleção:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao reescrever seleção.' });
  }
});

// 5. GERADOR MULTIFORMATO: Converte artigo em Roteiro de Carrossel (5-8 slides) e Roteiro de Vídeo/Reels
app.post('/api/generate-derived-formats', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { title, text, userManifesto } = req.body;

    if (!title || !text) {
      return res.status(400).json({ success: false, error: 'Título e texto são obrigatórios.' });
    }

    const authorName = userManifesto?.authorName || 'Autor(a)';
    const worldview = userManifesto?.worldviewDescription || 'Análise crítica de tecnologia e engenharia de software';
    const authorTone = userManifesto?.toneOfVoice || 'Analítico, profundo e provocativo';

    const systemPrompt = `Você é um Especialista em Adaptação de Conteúdo Editorial Técnico para Mídias Sociais.
Seu objetivo é transformar o artigo técnico do autor (${authorName}) em dois formatos dinâmicos sem perder a elegância, a densidade e o tom ensaístico:
1. ROTEIRO DE CARROSSEL DE 5 A 8 SLIDES: Cada slide com um título forte, um parágrafo reflexivo curto (sem clichês) e uma indicação de elemento visual/atmosfera.
2. ROTEIRO DE VÍDEO CURTO / REELS (60s): Com gancho inicial impactante, 3 momentos de fala contínua e uma chamada reflexiva para comentários.

=== VISÃO E TOM DO AUTOR ===
${worldview}
Tom: ${authorTone}
NUNCA use a palavra "você" de forma apelativa ou conselhos em 5 passos. Mantenha a elegância.`;

    const userPrompt = `ARTIGO DE ORIGEM:
TÍTULO: ${title}

CONTEÚDO:
${text}`;

    const derivedSchema = {
      type: Type.OBJECT,
      properties: {
        carousel: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.NUMBER },
                  slideTitle: { type: Type.STRING, description: 'Título/Gatilho do slide' },
                  bodyText: { type: Type.STRING, description: 'Texto provocativo curto do slide' },
                  visualCue: { type: Type.STRING, description: 'Sugestão de cor/atmosfera do slide' },
                },
                required: ['slideNumber', 'slideTitle', 'bodyText'],
              },
            },
            caption: { type: Type.STRING, description: 'Legenda para o carrossel no Instagram/LinkedIn' },
          },
          required: ['slides', 'caption'],
        },
        reelsScript: {
          type: Type.OBJECT,
          properties: {
            hook: { type: Type.STRING, description: 'Frase inicial nos primeiros 3 segundos para capturar atenção' },
            coreNarrative: { type: Type.STRING, description: 'Texto completo de fala em prosa fluida (~60 segundos)' },
            visualInstructions: { type: Type.STRING, description: 'Sugestão de enquadramento, iluminação e postura' },
            callToReflection: { type: Type.STRING, description: 'Provocação final para o leitor responder nos comentários' },
          },
          required: ['hook', 'coreNarrative', 'callToReflection'],
        },
      },
      required: ['carousel', 'reelsScript'],
    };

    const generateDerivedCall = (mName: string) =>
      ai.models.generateContent({
        model: mName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: derivedSchema,
        },
      });

    const response = await runModelStep('utility', generateDerivedCall, {
      label: 'Formatos derivados',
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Erro ao gerar formatos derivados:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao converter em carrossel/reels.' });
  }
});

// ===================================================================
// SUPABASE — ponte com o blog público
//
// A escrita usa a service_role key, que ignora RLS e só existe aqui,
// no servidor local do Studio. O blog público carrega apenas a anon
// key, que lê artigos publicados e não escreve nada.
// ===================================================================

const POSTS_TABLE = 'posts';
const COVERS_BUCKET = process.env.SUPABASE_COVERS_BUCKET || 'article-covers';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do Studio ' +
        '(a service_role key fica em Project Settings > API).'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Dispara o rebuild do blog na Vercel.
 *
 * O blog virou um site estático: o HTML de cada artigo é gerado no build,
 * lendo o Supabase. Gravar a linha no banco, portanto, não coloca mais nada
 * no ar sozinho — é este gancho que fecha o ciclo.
 *
 * Sem `VERCEL_DEPLOY_HOOK_URL` configurada, publicar continua funcionando; o
 * artigo só entra no ar no próximo deploy. A resposta diz qual dos dois casos
 * aconteceu, para o Studio não prometer o que não fez.
 */
async function triggerBlogRebuild(
  blogId: string
): Promise<{ triggered: boolean; detail: string }> {
  // O hook vem de `blog_secrets`, por blog. Era uma variável de ambiente única
  // (VERCEL_DEPLOY_HOOK_URL) — com dois blogs no ar, publicar num reconstruía o
  // outro, e só o outro. Era o bloqueio B4.
  //
  // A variável de ambiente sobrevive como fallback para quem ainda não migrou
  // o hook para o banco, mas some quando houver mais de um blog: aí ela é
  // ambígua por definição.
  let hookUrl: string | undefined;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(SECRETS_TABLE)
      .select('deploy_hook_url')
      .eq('blog_id', blogId)
      .maybeSingle();

    if (error) throw error;
    hookUrl = data?.deploy_hook_url || undefined;
  } catch (err: any) {
    console.warn('[Deploy hook] Não foi possível ler o hook do blog:', err.message);
  }

  if (!hookUrl) hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

  if (!hookUrl) {
    return {
      triggered: false,
      detail:
        `Nenhum deploy hook configurado para o blog "${blogId}". Cadastre-o em blog_secrets.deploy_hook_url — ` +
        'o artigo entra no ar no próximo deploy.',
    };
  }

  try {
    const response = await fetch(hookUrl, { method: 'POST' });
    if (!response.ok) throw new Error(`a Vercel respondeu HTTP ${response.status}`);
    return { triggered: true, detail: 'Rebuild do blog disparado na Vercel (leva cerca de um minuto).' };
  } catch (err: any) {
    console.warn('[Deploy hook] Falhou:', err.message);
    return {
      triggered: false,
      detail: `O artigo foi salvo, mas o rebuild não foi disparado (${err.message}). Rode um deploy manual na Vercel.`,
    };
  }
}

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

// Arquiva a capa no Storage do Supabase para o blog não depender de uma
// URL gerada sob demanda por um serviço externo.
async function persistCoverImage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  imageUrl: string,
  slug: string,
  blogId: string
): Promise<string> {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return imageUrl || '';

  // Já está no nosso bucket: nada a fazer.
  if (imageUrl.includes(`/storage/v1/object/public/${COVERS_BUCKET}/`)) return imageUrl;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`download falhou com HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(await response.arrayBuffer());

    // O caminho é prefixado pelo blog. O bucket é um só e o upload usa
    // `upsert: true` — sem o prefixo, dois blogs com o mesmo slug trocam de
    // capa em silêncio. É o irmão gêmeo do B3: corrigir só o upsert do banco
    // resolveria a linha e deixaria a imagem errada.
    const objectPath = `${blogId}/${slug}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(COVERS_BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
  } catch (err: any) {
    // Uma capa não vale derrubar a publicação: mantém a URL original.
    console.warn(`[Storage] Não foi possível arquivar a capa (${err.message}). Mantendo a URL original.`);
    return imageUrl;
  }
}

// ===================================================================
// DADOS DO STUDIO — blogs, manifestos e histórico saem do localStorage
//
// Estes endpoints usam a service_role e NÃO têm autenticação. Isso só é
// aceitável porque o servidor escuta em 127.0.0.1 (ver startServer): quem
// alcança já está na máquina. No dia em que o Studio for hospedado, aqui é o
// primeiro lugar que precisa de autenticação — é a pendência P3.
//
// O front nunca fala direto com o Supabase: a service_role ignora RLS e não
// pode ir para o navegador.
// ===================================================================

const BLOGS_TABLE = 'blogs';
const SECRETS_TABLE = 'blog_secrets';
const JOBS_TABLE = 'article_jobs';

/** Linha de `blogs` + manifesto de `blog_secrets` → o tipo Blog do front. */
function rowToBlog(row: any, manifesto: any) {
  return {
    id: row.id,
    name: row.name,
    niche: row.niche,
    description: row.description || '',
    authorName: row.author_name || '',
    professionalTitle: row.professional_title || '',
    badgeColor: row.badge_color || 'teal',
    iconName: row.icon_name || 'Cpu',
    siteUrl: row.site_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    manifesto: manifesto || {},
  };
}

/** O tipo Blog do front → as colunas públicas de `blogs`. */
function blogToRow(blog: any) {
  return {
    id: blog.id,
    name: blog.name,
    niche: blog.niche,
    description: blog.description || null,
    author_name: blog.authorName || null,
    professional_title: blog.professionalTitle || null,
    badge_color: blog.badgeColor || 'teal',
    icon_name: blog.iconName || 'Cpu',
    site_url: blog.siteUrl || null,
  };
}

// O status do pipeline no front e o estado do job no banco têm nomes
// diferentes por razões históricas. O mapa fica aqui, num lugar só.
const STATUS_TO_STATE: Record<string, string> = {
  researching: 'researching',
  drafting: 'drafting',
  reviewing: 'reviewing',
  auditing: 'auditing',
  generating_image: 'imaging',
  completed: 'ready',
  rejected: 'rejected',
  error: 'failed',
};
const STATE_TO_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_TO_STATE).map(([k, v]) => [v, k])
);

/**
 * Guarda o ArticlePost inteiro em `step_payloads.article` e espelha nas colunas
 * só o que precisa ser consultável.
 *
 * Sem mapeamento campo a campo de propósito: qualquer campo novo no
 * ArticlePost passa a ser persistido sem alterar schema, e nada se perde por
 * esquecimento. As colunas existem para filtrar; o jsonb existe para não mentir.
 */
function articleToJobRow(article: any) {
  return {
    id: article.id,
    blog_id: article.blogId,
    topic: article.topic || null,
    input: article.input || {},
    state: STATUS_TO_STATE[article.status] || 'queued',
    error: article.errorMessage || null,
    step_payloads: { article },
  };
}

/**
 * Reconstrói o ArticlePost a partir da linha do job.
 *
 * A coluna `step_payloads` tem DUAS formas legítimas, porque tem dois autores:
 *
 *   { article }  — o Studio grava o ArticlePost inteiro, com os campos de
 *                  interface (tags escolhidas à mão, slug publicado, etc.)
 *   { payloads } — o worker grava só o resultado de cada etapa do pipeline,
 *                  que é o formato que a retomada precisa.
 *
 * Ler só a primeira fazia os artigos produzidos pelo worker aparecerem VAZIOS
 * no histórico — sem título, sem texto. A fila de aprovação, que é o centro da
 * decisão D3, mostraria uma lista de nada.
 */
function jobRowToArticle(row: any) {
  const stored = row.step_payloads || {};
  const article = stored.article || {};
  const payloads = stored.payloads;

  const fromPayloads = payloads
    ? {
        topic: row.topic,
        input: row.input,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        draft: payloads.draft,
        review: payloads.review,
        audit: payloads.audit,
        image: payloads.image,
        factCheck: payloads.factcheck ?? undefined,
        tone: '',
        depthLevel: row.input?.depthLevel || '',
        targetAudience: row.input?.targetAudience || '',
      }
    : {};

  return {
    ...fromPayloads,
    ...article, // o que o Studio salvou tem prioridade: é edição humana
    id: row.id,
    blogId: row.blog_id,
    status: STATE_TO_STATUS[row.state] || article.status || 'completed',
  };
}

// 9. Blogs do Studio: identidade pública + manifesto, numa resposta só
app.get('/api/studio/blogs', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data: blogs, error } = await supabase
      .from(BLOGS_TABLE)
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const { data: secrets, error: secretsError } = await supabase
      .from(SECRETS_TABLE)
      .select('blog_id, manifesto');
    if (secretsError) throw secretsError;

    const manifestoByBlog = new Map((secrets || []).map((s: any) => [s.blog_id, s.manifesto]));

    res.json({
      success: true,
      blogs: (blogs || []).map((b: any) => rowToBlog(b, manifestoByBlog.get(b.id))),
    });
  } catch (error: any) {
    console.error('Erro ao listar blogs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Criar ou atualizar um blog (identidade + manifesto, atômico do ponto de
//     vista de quem chama)
app.put('/api/studio/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const blog = req.body?.blog;

    if (!blog?.name || !blog?.niche) {
      return res.status(400).json({
        success: false,
        error: 'Blog precisa de nome e nicho. O nicho alimenta os prompts de todos os agentes.',
      });
    }

    const supabase = getSupabaseAdmin();

    const { error: blogError } = await supabase
      .from(BLOGS_TABLE)
      .upsert({ ...blogToRow(blog), id }, { onConflict: 'id' });
    if (blogError) throw blogError;

    // O manifesto é o ativo autoral: vai para a tabela sem policy pública.
    const { error: secretError } = await supabase
      .from(SECRETS_TABLE)
      .upsert({ blog_id: id, manifesto: blog.manifesto || {} }, { onConflict: 'blog_id' });
    if (secretError) throw secretError;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao salvar blog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Apagar um blog
app.delete('/api/studio/blogs/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    // Blog com artigo publicado não some: a FK de posts.blog_id recusaria, e
    // apagar em cascata levaria junto conteúdo que está no ar.
    const { count, error: countError } = await supabase
      .from(POSTS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('blog_id', req.params.id);
    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return res.status(409).json({
        success: false,
        error: `Este blog tem ${count} artigo(s) no Supabase. Remova-os antes de apagar o blog.`,
      });
    }

    const { error } = await supabase.from(BLOGS_TABLE).delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao apagar blog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11.5. Importar o backup do navegador para o Supabase
//
// É o caminho que tira blogs, manifestos e rascunhos do localStorage. Também é
// como o manifesto chega ao banco: a semente do 003 criou `blog_secrets` com
// `manifesto = '{}'`, e um manifesto vazio faz todo prompt cair nos fallbacks
// do server.ts — o blog escreve genérico sem nenhum erro aparecer.
app.post('/api/studio/import', async (req, res) => {
  try {
    const backup = req.body?.backup;

    if (backup?.format !== 'aether-studio-backup') {
      return res.status(400).json({
        success: false,
        error: 'Arquivo não é um backup do Aether Studio.',
      });
    }

    const readKey = (key: string) => {
      const raw = backup.data?.[key];
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const blogs = readKey('techstudio_blogs_v3');
    const articles = readKey('techstudio_posts_v3');
    const supabase = getSupabaseAdmin();

    let blogCount = 0;
    let manifestoCount = 0;

    // Quais blogs já existem. Decide o que a importação pode tocar.
    const { data: existingRows, error: existingError } = await supabase
      .from(BLOGS_TABLE)
      .select('id');
    if (existingError) throw existingError;
    const existing = new Set((existingRows || []).map((r: any) => r.id));

    for (const blog of blogs) {
      if (!blog?.id || !blog?.name) continue;

      // A REGRA: o banco é dono da identidade pública; o backup é dono do
      // manifesto.
      //
      // Um backup carrega o RÓTULO do workspace no navegador; `blogs.name`
      // alimenta o <title>, o og:site_name e o JSON-LD já indexado. Deixar a
      // importação sobrescrever isso renomeia o site público a partir de um
      // arquivo antigo — foi exatamente o que aconteceu na primeira
      // importação, que desfez a reconciliação de nome feita no 004.
      //
      // Blog que ainda não existe é criado inteiro; blog que já existe só
      // recebe o manifesto.
      if (!existing.has(blog.id)) {
        const { error: blogError } = await supabase
          .from(BLOGS_TABLE)
          .insert(blogToRow(blog));
        if (blogError) throw blogError;
      }
      blogCount++;

      // Só sobrescreve o manifesto quando o backup traz um de verdade. Assim
      // reimportar um backup antigo não apaga edições feitas depois.
      const manifesto = blog.manifesto;
      if (manifesto && Object.keys(manifesto).length > 0) {
        const { error: secretError } = await supabase
          .from(SECRETS_TABLE)
          .upsert({ blog_id: blog.id, manifesto }, { onConflict: 'blog_id' });
        if (secretError) throw secretError;
        manifestoCount++;
      }
    }

    const isUuid = (value: unknown) =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    let articleCount = 0;
    for (const article of articles) {
      if (!article?.blogId) continue; // artigo órfão não tem para onde ir

      // Os ids do localStorage são `post_<timestamp>`, e `article_jobs.id` é
      // uuid. Deixa o banco gerar um novo em vez de recusar a linha — o id
      // antigo continua preservado dentro de `step_payloads.article`.
      const row: any = articleToJobRow(article);
      if (!isUuid(row.id)) delete row.id;

      const { error } = await supabase.from(JOBS_TABLE).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      articleCount++;
    }

    res.json({
      success: true,
      imported: { blogs: blogCount, manifestos: manifestoCount, articles: articleCount },
      skipped: {
        blogs: blogs.length - blogCount,
        articles: articles.length - articleCount,
      },
    });
  } catch (error: any) {
    console.error('Erro ao importar backup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. Histórico de artigos do Studio
app.get('/api/studio/articles', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from(JOBS_TABLE).select('*').order('created_at', { ascending: false });

    if (req.query.blogId) query = query.eq('blog_id', String(req.query.blogId));

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, articles: (data || []).map(jobRowToArticle) });
  } catch (error: any) {
    console.error('Erro ao listar artigos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/studio/articles/:id', async (req, res) => {
  try {
    const article = req.body?.article;
    if (!article?.blogId) {
      return res.status(400).json({ success: false, error: 'Artigo sem blogId.' });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(JOBS_TABLE)
      .upsert({ ...articleToJobRow(article), id: req.params.id }, { onConflict: 'id' });
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao salvar artigo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/studio/articles/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(JOBS_TABLE).delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao apagar artigo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Diagnóstico da conexão e do conteúdo publicado
app.get('/api/supabase/status', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from(POSTS_TABLE)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        return res.status(400).json({
          success: false,
          error: `A tabela '${POSTS_TABLE}' não existe. Rode o script supabase/001_schema.sql no SQL Editor do Supabase.`,
        });
      }
      return res.status(400).json({ success: false, error: error.message });
    }

    const { count: publishedCount } = await supabase
      .from(POSTS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    res.json({
      success: true,
      url: process.env.SUPABASE_URL,
      table: POSTS_TABLE,
      totalPosts: count ?? 0,
      publishedPosts: publishedCount ?? 0,
    });
  } catch (error: any) {
    console.error('Erro no diagnóstico Supabase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Publicar (ou republicar) um artigo no blog
app.post('/api/supabase/publish', async (req, res) => {
  try {
    const { article, category, authorName, status = 'published' } = req.body;

    if (!article) {
      return res.status(400).json({ success: false, error: 'Artigo não fornecido.' });
    }

    const title = article.review?.revisedTitle || article.draft?.title || article.topic;
    const content = stripDuplicateTitleHeading(
      article.review?.revisedText || article.draft?.rawText || '',
      title
    );

    if (!title || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'O artigo precisa de título e texto revisado antes de ir para o blog.',
      });
    }

    // Sem dono, não publica. O blog_id decide em qual site o artigo aparece,
    // qual linha o upsert atualiza e onde a capa é arquivada. Deixar passar
    // um artigo sem ele é o começo do bloqueio B3.
    const blogId = article.blogId;
    if (!blogId) {
      return res.status(400).json({
        success: false,
        error: 'O artigo não tem blog_id. Selecione o blog no Studio antes de publicar.',
      });
    }

    const supabase = getSupabaseAdmin();

    // Slug estável: uma vez publicado, o artigo mantém a mesma URL mesmo que
    // o título mude, e republicar atualiza a linha em vez de duplicar.
    const slug = article.publishedSlug || slugify(title) || `artigo-${article.id}`;

    const coverImage = await persistCoverImage(supabase, article.image?.imageUrl || '', slug, blogId);

    const record = {
      title,
      subtitle: article.review?.revisedSubtitle || article.draft?.subtitle || null,
      slug,
      content,
      summary: article.review?.metaDescription || article.review?.revisedSubtitle || null,
      key_takeaways: article.review?.keyTakeaways || [],
      cover_image: coverImage || null,
      author: authorName || article.authorName || 'Redação',
      tags: article.tags || article.review?.suggestedTags || [],
      category: category || null,
      language: 'pt',
      reading_time_minutes: article.review?.readingTimeMinutes || 5,
      status,
      blog_id: blogId,
      published_at: status === 'published' ? article.publishedAt || new Date().toISOString() : null,

      // Procedência, e só. O ArticlePost inteiro NÃO vai para cá: a policy de
      // RLS filtra por linha, não por coluna, então tudo que estiver nesta
      // tabela é legível por qualquer um com a anon key — que é pública por
      // estar no bundle do blog. Pareceres do comitê, prompts customizados,
      // dossiê de fact-check e o rascunho pré-revisão ficam só no Studio.
      raw_json: {
        studioPostId: article.id,
        generatedAt: article.createdAt,
        publishedFrom: 'aether-studio',
        schemaVersion: 1,
      },
    };

    // onConflict por (blog_id, slug), não por slug: republicar atualiza a linha
    // DAQUELE blog. Com 'slug' sozinho, publicar no blog A sobrescrevia a linha
    // homônima do blog B e apagava o artigo sem avisar ninguém — bloqueio B3.
    //
    // Exige o índice único criado em supabase/002_blog_scoped_slug.sql. Sem ele
    // o Postgres recusa este upsert.
    const { data, error } = await supabase
      .from(POSTS_TABLE)
      .upsert(record, { onConflict: 'blog_id,slug' })
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      return res.status(400).json({ success: false, error: error.message });
    }

    // Rascunho não muda o site: nada a reconstruir.
    const rebuild =
      status === 'published'
        ? await triggerBlogRebuild(blogId)
        : { triggered: false, detail: 'Rascunho não vai para o ar.' };

    res.json({
      success: true,
      message:
        status === 'published'
          ? `Artigo publicado. ${rebuild.detail}`
          : 'Artigo salvo como rascunho — ainda não aparece no blog.',
      slug,
      rebuildTriggered: rebuild.triggered,
      record: data,
    });
  } catch (error: any) {
    console.error('Erro ao publicar no Supabase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Despublicar: tira do ar sem apagar o registro
app.post('/api/supabase/unpublish', async (req, res) => {
  try {
    const { slug, blogId } = req.body;
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Slug do artigo não informado.' });
    }

    // O slug deixou de ser único no mundo (002_blog_scoped_slug.sql): dois blogs
    // podem ter 'inteligencia-artificial'. Sem o blog_id, este update pegaria a
    // linha errada — ou estouraria no .single() por encontrar mais de uma.
    if (!blogId) {
      return res.status(400).json({
        success: false,
        error: 'blogId não informado. O slug sozinho não identifica mais um artigo.',
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(POSTS_TABLE)
      .update({ status: 'draft', published_at: null })
      .eq('blog_id', blogId)
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Enquanto o rebuild não roda, a página estática do artigo continua
    // publicada. Despublicar de verdade exige reconstruir o site.
    const rebuild = await triggerBlogRebuild(blogId);

    res.json({
      success: true,
      message: `Artigo marcado como rascunho. ${rebuild.detail}`,
      rebuildTriggered: rebuild.triggered,
      record: data,
    });
  } catch (error: any) {
    console.error('Erro ao despublicar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// O app é exportado para o worker headless conseguir subir os mesmos endpoints
// num processo próprio, sem depender de um Studio aberto (ver worker.ts).
export { app };

// Vite middleware logic for dev vs prod
export async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 127.0.0.1 e não 0.0.0.0: o Studio guarda a service_role key e a chave do
  // Gemini, e não tem autenticação nenhuma. Escutando em todas as interfaces,
  // qualquer dispositivo da mesma rede poderia publicar no blog e consumir a
  // cota de IA. Aqui, só a própria máquina alcança.
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Aether Studio rodando em http://127.0.0.1:${PORT}`);
  });
}

// Sobe sozinho quando executado direto (`tsx server.ts`, `node dist/server.cjs`),
// mas não quando é importado — o worker headless precisa dos mesmos endpoints
// numa porta própria e controla o ciclo de vida por conta.
//
// A checagem olha o arquivo de entrada, e não uma variável de ambiente: um
// `process.env.X = '1'` no topo do worker rodaria TARDE DEMAIS, porque em ESM
// os imports são içados e executam antes de qualquer statement do módulo. A
// primeira versão desta guarda caiu exatamente nisso, e o worker tentou subir
// na 3000.
//
// Também não usa `import.meta.url`: o build de produção empacota este arquivo
// como CJS (esbuild --format=cjs), onde `import.meta` não existe.
const entryFile = path.basename(process.argv[1] || '');
const isDirectRun = entryFile.startsWith('server.');

if (isDirectRun) {
  startServer();
}
