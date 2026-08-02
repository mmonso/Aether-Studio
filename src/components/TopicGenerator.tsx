import React, { useState } from 'react';
import { UserManifesto, Blog } from '../types';
import {
  Sparkles,
  Compass,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Search,
  BookOpen,
  Globe,
  AlertTriangle,
  ExternalLink,
  Newspaper,
} from 'lucide-react';

export interface GeneratedTopic {
  title: string;
  angle: string;
  whyItFits: string;
  category: string;
  /** Fato recente que ancora a pauta. Vazio quando não houve apuração. */
  newsHook?: string;
}

interface TrendSource {
  title: string;
  sourceName: string;
  url?: string;
}

interface TopicGeneratorProps {
  manifesto: UserManifesto;
  blog?: Blog;
  onSelectTopic: (topic: GeneratedTopic | string) => void;
}

const DEFAULT_CATEGORIES = [
  'Inteligência Artificial, LLMs & Agentes',
  'Engenharia de Software & Arquitetura',
  'Cloud, DevOps & Infraestrutura',
  'Cultura Dev, Carreira & Produtividade',
  'Inovação, Hardware & Tendências Tech',
];

/**
 * Exemplo de palavra-chave tirado do vocabulário do próprio blog.
 *
 * Estava cravado como "Ex: maternidade, perfeccionismo..." — resíduo de quando
 * o projeto era um blog de psicologia, aparecendo num blog de tecnologia. A
 * correção não é trocar por exemplos de tech: isso repetiria o mesmo erro no
 * próximo nicho. O exemplo sai do manifesto, então serve a qualquer blog.
 */
function buildKeywordPlaceholder(manifesto: UserManifesto): string {
  const words = (manifesto.favoriteKeywords || []).filter(Boolean).slice(0, 2);
  return words.length > 0 ? `Ex: ${words.join(', ')}...` : 'Ex: um tema do seu nicho...';
}

export const TopicGenerator: React.FC<TopicGeneratorProps> = ({ manifesto, blog, onSelectTopic }) => {
  const categoriesToUse = manifesto.themeCategories && manifesto.themeCategories.length > 0
    ? manifesto.themeCategories
    : DEFAULT_CATEGORIES;

  const [keyword, setKeyword] = useState('');
  const keywordPlaceholder = buildKeywordPlaceholder(manifesto);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [topics, setTopics] = useState<GeneratedTopic[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  // Procedência das pautas: vieram de apuração na web ou da memória do modelo?
  const [groundingUsed, setGroundingUsed] = useState(false);
  const [sources, setSources] = useState<TrendSource[]>([]);
  const [showSources, setShowSources] = useState(false);

  const handleGenerate = async (catOverride?: string) => {
    setIsGenerating(true);
    setErrorMsg(null);
    const activeCat = catOverride !== undefined ? catOverride : selectedCategory;

    try {
      const res = await fetch('/api/generate-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim() || undefined,
          category: activeCat || undefined,
          blogName: blog?.name,
          blogNiche: blog?.niche,
          userManifesto: manifesto,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.topics)) {
        setTopics(data.topics);
        setGroundingUsed(Boolean(data.groundingUsed));
        setSources(Array.isArray(data.sources) ? data.sources : []);
        setShowSources(false);
      } else {
        setErrorMsg(data.error || 'Não foi possível gerar novos tópicos. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro na chamada do gerador de tópicos:', err);
      setErrorMsg('Falha de conexão. Verifique sua rede e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChoose = (topicObj: GeneratedTopic) => {
    setSelectedTitle(topicObj.title);
    onSelectTopic(topicObj);
  };

  return (
    <div className="bg-[#faf9f6] dark:bg-[#181715] rounded-md p-6 sm:p-8 border border-[#e8e5de] dark:border-[#282522] space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#e8e5de] dark:border-[#282522] pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 text-xs font-medium uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gerador de Tópicos & Pautas</span>
          </div>
          <h3 className="text-sm font-sans font-bold text-stone-900 dark:text-stone-100">
            Inspiração Alinhada à Sua Visão
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xl leading-relaxed">
            Busca o que está em pauta agora no seu nicho e transforma em ângulos sob medida
            para a assinatura editorial de <strong>{manifesto.authorName || 'sua publicação'}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleGenerate()}
          disabled={isGenerating}
          className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-100 dark:text-stone-900 font-medium text-xs rounded flex items-center space-x-2 shrink-0 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Gerando Pautas...</span>
            </>
          ) : (
            <>
              <Compass className="w-3.5 h-3.5" />
              <span>{topics.length > 0 ? 'Gerar Outras Ideias' : 'Gerar Tópicos Inéditos'}</span>
            </>
          )}
        </button>
      </div>

      {/* Inputs & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#f2efe9] dark:bg-[#1f1d1b] p-4 rounded border border-[#e5e0d6] dark:border-[#2a2724]">
        
        {/* Keyword Filter */}
        <div className="md:col-span-1 space-y-1">
          <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            Palavra-Chave (Opcional)
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={keywordPlaceholder}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-500"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="md:col-span-2 space-y-1">
          <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            Filtrar por Categoria
          </label>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('');
                handleGenerate('');
              }}
              className={`text-xs px-2.5 py-1 rounded border transition-all ${
                selectedCategory === ''
                  ? 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 border-stone-800 dark:border-stone-200 font-medium'
                  : 'bg-white dark:bg-[#121110] hover:bg-[#eae6de] text-stone-700 dark:text-stone-300 border-[#e0dad0] dark:border-[#2a2724]'
              }`}
            >
              Todas
            </button>
            {categoriesToUse.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  handleGenerate(cat);
                }}
                className={`text-xs px-2.5 py-1 rounded border transition-all ${
                  selectedCategory === cat
                    ? 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 border-stone-800 dark:border-stone-200 font-medium'
                    : 'bg-white dark:bg-[#121110] hover:bg-[#eae6de] text-stone-700 dark:text-stone-300 border-[#e0dad0] dark:border-[#2a2724]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs p-3 rounded font-medium">
          {errorMsg}
        </div>
      )}

      {/* Loading Skeleton */}
      {isGenerating && (
        <div className="space-y-3 py-2">
          <div className="text-center text-xs font-medium text-stone-600 dark:text-stone-400 flex items-center justify-center space-x-2 animate-pulse">
            <Globe className="w-3.5 h-3.5 text-stone-500" />
            <span>Pesquisando o que está em pauta e cruzando com a sua linha editorial...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/60 dark:bg-stone-900/40 p-4 rounded border border-stone-200 dark:border-stone-800 space-y-2 animate-pulse">
                <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4"></div>
                <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-full"></div>
                <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Topics Cards */}
      {!isGenerating && topics.length > 0 && (
        <div className="space-y-3">

          {/* Procedência: de onde vieram estas pautas. Sem isso, uma sugestão
              tirada da memória do modelo se parece com uma tendência apurada. */}
          {groundingUsed ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>
                    Pautas ancoradas em {sources.length} {sources.length === 1 ? 'fonte' : 'fontes'} consultadas agora
                  </span>
                </span>
                {sources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSources(!showSources)}
                    className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer shrink-0"
                  >
                    {showSources ? 'ocultar fontes' : 'ver fontes'}
                  </button>
                )}
              </div>

              {showSources && (
                <ul className="space-y-1 pt-1 border-t border-emerald-200 dark:border-emerald-900/40">
                  {sources.map((s, i) => (
                    <li key={i} className="text-[11px] text-emerald-900 dark:text-emerald-200/80 leading-relaxed">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline inline-flex items-start gap-1"
                        >
                          <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                          <span><strong>{s.sourceName}</strong> — {s.title}</span>
                        </a>
                      ) : (
                        <span><strong>{s.sourceName}</strong> — {s.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded p-3">
              <span className="text-[11px] text-amber-900 dark:text-amber-300 flex items-start space-x-1.5 leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  A busca na web não retornou resultado. Estas pautas saíram da memória do
                  modelo, que tem data de corte — <strong>não são necessariamente tendência</strong>.
                  Confira antes de tratar qualquer uma como novidade.
                </span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider flex items-center space-x-1">
              <BookOpen className="w-3.5 h-3.5 text-stone-500" />
              <span>{topics.length} Pautas Sugeridas:</span>
            </span>
            <button
              type="button"
              onClick={() => handleGenerate()}
              className="text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Gerar Novas Ideias</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((t, idx) => {
              const isPicked = selectedTitle === t.title;
              return (
                <div
                  key={idx}
                  className={`rounded p-5 border transition-all flex flex-col justify-between space-y-3 ${
                    isPicked
                      ? 'border-stone-800 dark:border-stone-200 bg-[#f2efe9] dark:bg-[#201e1c]'
                      : 'bg-white dark:bg-[#121110] border-[#e0dad0] dark:border-[#2a2724] hover:border-stone-400'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-[#e8e4dc] dark:bg-[#25221f] text-stone-700 dark:text-stone-300 text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wider">
                        {t.category}
                      </span>
                    </div>

                    <h4 className="font-serif font-semibold text-stone-900 dark:text-stone-100 text-base leading-snug">
                      "{t.title}"
                    </h4>

                    {/* O gancho de atualidade vem primeiro: é ele que diz por
                        que esta pauta faz sentido hoje e não mês passado. */}
                    {t.newsHook && (
                      <p className="text-[11px] text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-2.5 rounded leading-relaxed flex items-start gap-1.5">
                        <Newspaper className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span><strong>Gancho:</strong> {t.newsHook}</span>
                      </p>
                    )}

                    <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                      <p>
                        <strong className="text-stone-800 dark:text-stone-200">Ângulo:</strong> {t.angle}
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400 bg-[#f5f3ef] dark:bg-[#1a1816] p-2.5 rounded border border-[#e5e0d8] dark:border-[#2a2724] leading-relaxed italic">
                        <strong>Por que combina:</strong> {t.whyItFits}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#e8e5de] dark:border-[#2a2724] flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleChoose(t)}
                      className={`px-3.5 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                        isPicked
                          ? 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900'
                          : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-900 hover:text-stone-100 dark:hover:bg-stone-200 dark:hover:text-stone-900 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      {isPicked ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selecionado</span>
                        </>
                      ) : (
                        <>
                          <span>Usar este Tema</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
