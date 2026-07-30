import React from 'react';
import { Feather, ShieldCheck, Palette, CheckCircle2, Loader2, Sparkles, AlertCircle, Heart, SearchCheck, Globe } from 'lucide-react';
import { DraftResult, ReviewResult, ImageResult, FactCheckReport } from '../types';

interface PipelineTrackerProps {
  status: 'researching' | 'drafting' | 'reviewing' | 'generating_image' | 'completed' | 'error';
  errorMessage?: string;
  factCheckResult?: FactCheckReport;
  draftResult?: DraftResult;
  reviewResult?: ReviewResult;
  imageResult?: ImageResult;
  authorName?: string;
  topic: string;
  isNewsMode?: boolean;
}

export const PipelineTracker: React.FC<PipelineTrackerProps> = ({
  status,
  errorMessage,
  factCheckResult,
  draftResult,
  reviewResult,
  imageResult,
  authorName,
  topic,
  isNewsMode = false,
}) => {
  const steps = [
    ...(isNewsMode || factCheckResult || status === 'researching'
      ? [
          {
            id: 'researching',
            title: 'Etapa 0: Pesquisa ao Vivo & Fact-Checking Anti-Fake News',
            agent: 'Pesquisador & Fact-Checker Virtual • Google Grounding',
            icon: SearchCheck,
            description: `Buscando dados recentes, verificação de fontes e auditoria contra desinformação sobre "${topic}"...`,
            hasData: !!factCheckResult,
          },
        ]
      : []),
    {
      id: 'drafting',
      title: 'Etapa 1: Rascunho do Redator Principal',
      agent: isNewsMode ? 'Jornalista Virtual • Linha Editorial' : 'Redator Virtual • Visão de Mundo',
      icon: Feather,
      description: `Estruturando o rascunho inicial sobre "${topic}" alinhado ao seu tom de voz...`,
      hasData: !!draftResult,
    },
    {
      id: 'reviewing',
      title: 'Etapa 2: Comitê de Especialistas & Reescrita Unificada',
      agent: isNewsMode
        ? 'Auditor de Fact-Checking • Des-AIzador • Revisor Editorial • Redator'
        : 'Des-AIzador • Guardião do Conteúdo • Revisor Editorial • Redator Principal',
      icon: ShieldCheck,
      description: 'Análise de humanização de ritmo, rigor conceitual e postura ética, com reescrita integrada e coesa pelo Redator...',
      hasData: !!reviewResult,
    },
    {
      id: 'generating_image',
      title: 'Etapa 3: Ilustração Editorial',
      agent: 'Designer Editorial • Capa Conceitual',
      icon: Palette,
      description: 'Criando metáfora visual poética e gerando imagem de capa via Gemini Imagen...',
      hasData: !!imageResult,
    },
  ];

  const getStepStatus = (stepId: string) => {
    if (status === 'error') return 'error';
    if (status === 'completed') return 'done';

    if (stepId === 'researching') {
      if (status === 'researching') return 'active';
      return factCheckResult ? 'done' : 'pending';
    }

    if (stepId === 'drafting') {
      if (status === 'drafting') return 'active';
      return draftResult ? 'done' : 'pending';
    }

    if (stepId === 'reviewing') {
      if (status === 'reviewing') return 'active';
      if (status === 'generating_image') return 'done';
      return 'pending';
    }

    if (stepId === 'generating_image') {
      if (status === 'generating_image') return 'active';
      return 'pending';
    }

    return 'pending';
  };

  return (
    <div className="bg-stone-900 rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-xl border border-stone-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-800 pb-4 gap-2">
        <div>
          <div className="flex items-center space-x-2 text-teal-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Processando Artigo • Sua Equipe Virtual</span>
          </div>
          <h3 className="font-serif text-xl font-bold text-stone-100 mt-1">"{topic}"</h3>
        </div>
        <div className="text-xs text-stone-300 bg-stone-800 px-3 py-1.5 rounded-full border border-stone-700 flex items-center space-x-1.5">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span>Visão de: <strong className="text-teal-300">{authorName || 'Você'}</strong></span>
        </div>
      </div>

      {/* Error Display */}
      {status === 'error' && (
        <div className="bg-rose-950/80 border border-rose-800/80 text-rose-200 p-4 rounded-2xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="font-bold">Ocorreu um erro na produção do artigo:</p>
            <p className="text-rose-300 font-mono">{errorMessage || 'Falha de comunicação com o servidor.'}</p>
          </div>
        </div>
      )}

      {/* Step Progress List */}
      <div className="space-y-4">
        {steps.map((step) => {
          const stepState = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                stepState === 'active'
                  ? 'border-teal-500/80 bg-teal-950/40 text-stone-100 shadow-lg ring-1 ring-teal-500/30'
                  : stepState === 'done'
                  ? 'border-emerald-800/60 bg-emerald-950/20 text-stone-300'
                  : 'border-stone-800 bg-stone-900/50 text-stone-500 opacity-60'
              }`}
            >
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    stepState === 'active'
                      ? 'bg-teal-500 text-stone-950 font-bold animate-pulse'
                      : stepState === 'done'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-800 text-stone-500'
                  }`}
                >
                  {stepState === 'active' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : stepState === 'done' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-teal-400">{step.agent}</span>
                  </div>
                  <h4 className="font-bold text-sm sm:text-base text-stone-100">{step.title}</h4>
                  <p className="text-xs text-stone-400">{step.description}</p>
                </div>
              </div>

              {/* Status Indicator Pill */}
              <div className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full border">
                {stepState === 'active' && (
                  <span className="text-teal-300 border-teal-500/50 bg-teal-900/60 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                    <span>Em Andamento...</span>
                  </span>
                )}
                {stepState === 'done' && (
                  <span className="text-emerald-300 border-emerald-700/50 bg-emerald-950/60 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Concluído</span>
                  </span>
                )}
                {stepState === 'pending' && (
                  <span className="text-stone-500 border-stone-800 bg-stone-800/40">Aguardando</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
