import React, { useState } from 'react';
import { PostGenerationInput, UserManifesto, Blog } from '../types';
import { VISUAL_STYLES } from '../data/presetApproaches';
import { TopicGenerator } from './TopicGenerator';
import {
  Brain,
  Sparkles,
  Sliders,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wand2,
  Lightbulb,
  Palette,
  Heart,
  Compass,
  Layers,
  SearchCheck,
  Globe,
  ShieldAlert,
  Link as LinkIcon,
} from 'lucide-react';

interface CreatePostTabProps {
  blog: Blog;
  manifesto: UserManifesto;
  onSubmitInput: (input: PostGenerationInput) => void;
  onOpenManifestoEditor: () => void;
  isLoading: boolean;
}

export const CreatePostTab: React.FC<CreatePostTabProps> = ({
  blog,
  manifesto,
  onSubmitInput,
  onOpenManifestoEditor,
  isLoading,
}) => {
  // Main form state
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState<string>(
    manifesto.targetAudienceDescription || `Leitores interessados em ${blog.niche}`
  );
  const [depthLevel, setDepthLevel] = useState<'iniciante' | 'intermediario' | 'aprofundado'>('intermediario');
  const [articleLength, setArticleLength] = useState<'curto' | 'medio' | 'longo'>('medio');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('minimalist_vector');

  // Custom prompt overrides toggle
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);
  const [showTopicGenerator, setShowTopicGenerator] = useState(true);
  const [customWriterPrompt, setCustomWriterPrompt] = useState('');
  const [customReviewerPrompt, setCustomReviewerPrompt] = useState('');
  const [customImagePrompt, setCustomImagePrompt] = useState('');

  // Fact-check & News research mode
  const isNewsNiche =
    blog.id === 'blog_jornalismo_noticias' ||
    blog.niche.toLowerCase().includes('notícia') ||
    blog.niche.toLowerCase().includes('jornal') ||
    blog.niche.toLowerCase().includes('investiga');

  const [enableFactCheck, setEnableFactCheck] = useState<boolean>(isNewsNiche);
  const [newsReferenceUrl, setNewsReferenceUrl] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;

    const inputData: PostGenerationInput = {
      topic: topic.trim(),
      targetAudience,
      tone: manifesto.toneOfVoice,
      depthLevel,
      articleLength,
      enableFactCheck,
      newsReferenceUrl: newsReferenceUrl.trim() || undefined,
      visualStyle: selectedStyleId,
      customWriterPrompt: customWriterPrompt.trim() || undefined,
      customReviewerPrompt: customReviewerPrompt.trim() || undefined,
      customImagePrompt: customImagePrompt.trim() || undefined,
    };

    onSubmitInput(inputData);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 py-4">
      
      {/* ACTIVE BLOG & MANIFESTO HEADER CARD - MINIMALIST */}
      <div className="bg-slate-100 dark:bg-[#0c101a] text-slate-900 dark:text-slate-100 rounded-xl p-5 border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1">
              <Layers className="w-3 h-3 text-teal-500" />
              <span>Workspace: {blog.name} ({blog.niche})</span>
            </span>
          </div>
          <h2 className="text-sm font-sans font-bold tracking-tight leading-relaxed flex items-center space-x-2">
            <span>{manifesto.authorName || blog.authorName}</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-mono">({manifesto.professionalTitle || blog.professionalTitle})</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-2xl font-sans leading-relaxed">
            "{manifesto.worldviewDescription}"
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenManifestoEditor}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-100 font-mono font-semibold text-xs rounded-lg border border-slate-700/50 transition-all cursor-pointer shrink-0"
        >
          <div className="flex items-center space-x-1.5">
            <Heart className="w-3.5 h-3.5 text-teal-400" />
            <span>Linha Editorial</span>
          </div>
        </button>
      </div>

      {/* TOPIC GENERATOR WITH IA */}
      {showTopicGenerator ? (
        <TopicGenerator
          manifesto={manifesto}
          blog={blog}
          onSelectTopic={(selectedTopic) => {
            if (typeof selectedTopic === 'string') {
              setTopic(selectedTopic);
            } else {
              const fullFormatted = `TÍTULO: "${selectedTopic.title}"\nÂNGULO DE ABORDAGEM: ${selectedTopic.angle}\nJUSTIFICATIVA / ADERÊNCIA: ${selectedTopic.whyItFits}${selectedTopic.category ? `\nCATEGORIA: ${selectedTopic.category}` : ''}`;
              setTopic(fullFormatted);
            }
            const inputEl = document.getElementById('article-topic-input');
            if (inputEl) {
              inputEl.focus();
              inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
        />
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowTopicGenerator(true)}
            className="text-xs font-mono bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
          >
            <Compass className="w-3.5 h-3.5 text-teal-500" />
            <span>Gerador de Tópicos Tech</span>
          </button>
        </div>
      )}

      {/* SECTION 1: TOPIC INPUT */}
      <div className="bg-slate-50 dark:bg-[#0c101a] rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-sans font-bold text-sm tracking-tight">
            <Brain className="w-4 h-4 text-teal-500 shrink-0" />
            <h2>1. Qual ideia ou tema você quer desenvolver hoje?</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowTopicGenerator(!showTopicGenerator)}
            className="text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold flex items-center space-x-1 bg-slate-200/60 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-300/60 dark:border-slate-800 transition-all cursor-pointer self-end sm:self-auto"
          >
            <Compass className="w-3.5 h-3.5 text-teal-500" />
            <span>{showTopicGenerator ? 'Ocultar Gerador' : 'Gerar Ideias com IA'}</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="block text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Tema Principal ou Pergunta do Leitor *
            </label>
            {topic.includes('ÂNGULO DE ABORDAGEM:') && (
              <span className="bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-[11px] font-mono font-medium px-2 py-0.5 rounded flex items-center space-x-1 self-start sm:self-auto">
                <CheckCircle2 className="w-3 h-3 text-teal-500 shrink-0" />
                <span>Pauta Completa Carregada</span>
              </span>
            )}
          </div>
          <textarea
            id="article-topic-input"
            required
            rows={topic.includes('\n') ? 5 : 3}
            placeholder="Ex: Como desenhar orquestrações de agentes LLM resilientes com RAG híbrido e bancos vetoriais em produção..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-[#070a12] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-teal-500 transition-all font-sans leading-relaxed resize-y"
          />
        </div>

        {/* FACT CHECKING & LIVE RESEARCH CARD */}
        <div className="bg-slate-100/80 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500 shrink-0 mt-0.5">
                <SearchCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 font-sans leading-relaxed">
                    Pesquisa ao Vivo & Fact-Checking Tech
                  </h3>
                  <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 flex items-center space-x-1">
                    <Globe className="w-3 h-3 text-teal-500" />
                    <span>Grounding</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Realiza apuração técnica em tempo real na web antes de escrever, confirmando especificações, fatos e fontes.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-auto">
              <input
                type="checkbox"
                checked={enableFactCheck}
                onChange={(e) => setEnableFactCheck(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {enableFactCheck && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <LinkIcon className="w-3.5 h-3.5 text-teal-500" />
                <span>URL de Referência Tech (Opcional):</span>
              </label>
              <input
                type="url"
                placeholder="https://github.com/exemplo ou https://techcrunch.com/materia"
                value={newsReferenceUrl}
                onChange={(e) => setNewsReferenceUrl(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#070a12] border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 font-mono"
              />
              {isNewsNiche && (
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span>Ativado por padrão para cobertura técnica ao vivo.</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Topic Suggestions */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 flex items-center space-x-1">
            <Lightbulb className="w-3.5 h-3.5 text-stone-500" />
            <span>Sugestões Rápidas:</span>
          </span>

          <div className="flex flex-wrap gap-2">
            {[
              `Análise aprofundada sobre tendências e o futuro em ${blog.niche}`,
              `O impacto humano e social das transformações atuais em ${blog.niche}`,
              `Desmistificando conceitos fundamentais de ${blog.niche} para o cotidiano`,
              `Abordagem autoral: desafios éticos e melhores práticas em ${blog.niche}`,
              `Como cultivar excelência e autonomia com foco em ${blog.niche}`,
            ].map((suggested, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTopic(suggested)}
                className={`text-xs px-3 py-1.5 rounded border transition-all text-left ${
                  topic === suggested
                    ? 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 border-stone-800 dark:border-stone-200 font-medium'
                    : 'bg-[#f0ede6] dark:bg-[#22201d] hover:bg-[#e8e4dc] text-stone-700 dark:text-stone-300 border-[#e5e0d6] dark:border-[#2a2724]'
                }`}
              >
                {suggested}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: ARTICLE OPTIONS */}
      <div className="bg-[#faf9f6] dark:bg-[#181715] rounded-md p-6 sm:p-8 border border-[#e8e5de] dark:border-[#282522] space-y-6">
        <div className="flex items-center space-x-2 text-stone-900 dark:text-stone-100 font-sans font-bold text-sm border-b border-[#e8e5de] dark:border-[#282522] pb-3">
          <Sliders className="w-4 h-4 text-stone-600 dark:text-stone-400 shrink-0" />
          <h2>2. Estrutura e Formato do Artigo</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Target Audience */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Público-Alvo
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs sm:text-sm text-stone-900 dark:text-stone-100 font-normal focus:outline-none focus:border-stone-500"
            />
          </div>

          {/* Depth Level */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Nível de Profundidade
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'iniciante', label: 'Iniciante', desc: 'Didático & Leve' },
                { id: 'intermediario', label: 'Intermediário', desc: 'Equilibrado' },
                { id: 'aprofundado', label: 'Aprofundado', desc: 'Profundo' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setDepthLevel(lvl.id as any)}
                  className={`p-2.5 rounded border text-center transition-all ${
                    depthLevel === lvl.id
                      ? 'bg-stone-800 dark:bg-stone-200 text-stone-100 dark:text-stone-900 border-stone-800 dark:border-stone-200 font-medium'
                      : 'bg-white dark:bg-[#121110] border-[#e0dad0] dark:border-[#2a2724] text-stone-700 dark:text-stone-300 hover:bg-[#f2efe9]'
                  }`}
                >
                  <div className="text-xs font-medium">{lvl.label}</div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Article Length */}
          <div className="space-y-2 md:col-span-2">
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Tamanho do Artigo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'curto', label: 'Curto', desc: '~600 palavras' },
                { id: 'medio', label: 'Médio', desc: '~1000 palavras' },
                { id: 'longo', label: 'Longo', desc: '~1500 palavras' },
              ].map((len) => (
                <button
                  key={len.id}
                  type="button"
                  onClick={() => setArticleLength(len.id as any)}
                  className={`p-2.5 rounded border text-center transition-all ${
                    articleLength === len.id
                      ? 'bg-stone-800 dark:bg-stone-200 text-stone-100 dark:text-stone-900 border-stone-800 dark:border-stone-200 font-medium'
                      : 'bg-white dark:bg-[#121110] border-[#e0dad0] dark:border-[#2a2724] text-stone-700 dark:text-stone-300 hover:bg-[#f2efe9]'
                  }`}
                >
                  <div className="text-xs font-medium">{len.label}</div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">{len.desc}</div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 3: VISUAL STYLE FOR COVER IMAGE */}
      <div className="bg-[#faf9f6] dark:bg-[#181715] rounded-md p-6 sm:p-8 border border-[#e8e5de] dark:border-[#282522] space-y-4">
        <div className="flex items-center space-x-2 text-stone-900 dark:text-stone-100 font-sans font-bold text-sm">
          <Palette className="w-4 h-4 text-stone-600 dark:text-stone-400" />
          <h2>3. Estilo Visual da Capa Editorial</h2>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          O Agente Designer usará o resumo do artigo e o estilo selecionado para criar a imagem conceitual da capa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VISUAL_STYLES.map((style) => {
            const isSelected = style.id === selectedStyleId;
            return (
              <div
                key={style.id}
                onClick={() => setSelectedStyleId(style.id)}
                className={`p-3.5 rounded border cursor-pointer transition-all space-y-1.5 ${
                  isSelected
                    ? 'border-stone-800 dark:border-stone-200 bg-[#f2efe9] dark:bg-[#22201d] shadow-2xs font-medium'
                    : 'border-[#e0dad0] dark:border-[#2a2724] bg-white dark:bg-[#121110] hover:bg-[#f7f5f0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs text-stone-900 dark:text-stone-100">{style.name}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-stone-800 dark:text-stone-200 shrink-0" />}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">{style.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADVANCED OVERRIDE PROMPTS (ACCORDION) */}
      <div className="bg-[#f2efe9] dark:bg-[#181715] border border-[#e5e0d6] dark:border-[#282522] rounded-md p-5 space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
          className="w-full flex items-center justify-between text-left text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <Wand2 className="w-3.5 h-3.5 text-stone-500" />
            <span>Instruções Adicionais para a Equipe de IA (Opcional)</span>
          </div>
          {showAdvancedPrompts ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </button>

        {showAdvancedPrompts && (
          <div className="space-y-4 pt-2 border-t border-[#e5e0d6] dark:border-[#282522]">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Instrução Extra para o Redator
              </label>
              <textarea
                rows={2}
                placeholder="Ex: 'Mencionar a metáfora do barco na tempestade no segundo capítulo'..."
                value={customWriterPrompt}
                onChange={(e) => setCustomWriterPrompt(e.target.value)}
                className="w-full p-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs text-stone-800 dark:text-stone-200 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Instrução Extra para o Revisor Sênior
              </label>
              <textarea
                rows={2}
                placeholder="Ex: 'Exigência máxima: elimine qualquer frase que pareça autoajuda ou ChatGPT'..."
                value={customReviewerPrompt}
                onChange={(e) => setCustomReviewerPrompt(e.target.value)}
                className="w-full p-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs text-stone-800 dark:text-stone-200 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Instrução Extra para o Designer
              </label>
              <textarea
                rows={2}
                placeholder="Ex: 'Usar tons de verde musgo e luz natural da manhã'..."
                value={customImagePrompt}
                onChange={(e) => setCustomImagePrompt(e.target.value)}
                className="w-full p-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs text-stone-800 dark:text-stone-200 leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* SUBMIT BUTTON */}
      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={!topic.trim() || isLoading}
          className="w-full sm:w-auto px-8 py-3.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-100 dark:text-stone-900 font-medium text-sm rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2.5 cursor-pointer shadow-sm"
        >
          <Sparkles className="w-4 h-4 opacity-80" />
          <span>{isLoading ? 'Produzindo Artigo...' : 'Iniciar Produção Editorial'}</span>
        </button>
      </div>

    </form>
  );
};
