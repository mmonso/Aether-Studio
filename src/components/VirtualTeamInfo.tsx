import React from 'react';
import { Feather, ShieldCheck, Palette, Sparkles, CheckCircle2, ArrowRight, Wand2, BookOpen, Repeat } from 'lucide-react';

interface VirtualTeamInfoProps {
  onStartCreate: () => void;
  onCustomizePrompts: () => void;
}

export const VirtualTeamInfo: React.FC<VirtualTeamInfoProps> = ({
  onStartCreate,
  onCustomizePrompts,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-stone-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 bg-teal-800/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-teal-200 border border-teal-700/50">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Sua Equipe Editorial Exclusiva (5 Agentes)</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-100 leading-tight">
            Sua equipe virtual completa: Redação, Humanização, Teoria Tech, Validação & Arte Visual.
          </h1>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Cada artigo é gerado por especialistas com funções dedicadas. As análises voltam para o <strong>Redator Principal</strong>, que unifica todas as orientações em um único texto coeso e autoral — sem ser uma colcha de retalhos.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={onStartCreate}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-stone-950 font-semibold text-sm rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer"
            >
              <span>Criar Artigo Agora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onCustomizePrompts}
              className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-sm rounded-xl border border-stone-700 transition-all cursor-pointer"
            >
               Minha Visão de Mundo
            </button>
          </div>
        </div>
      </div>

      {/* Team Members Grid - 5 Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Agent 1: Redator Principal */}
        <div className="bg-white dark:bg-[#18191e] rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-500 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-stone-900 border border-teal-200 dark:border-stone-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Feather className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Agente 01 • Redação & Síntese</span>
              <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">Redator Principal (O "Arquiteto da Prosa")</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm leading-relaxed">
              Cria a estrutura inicial do artigo e, ao final, absorve os pareceres de todos os especialistas para reescrever o texto do zero, garantindo voz fluida e coesa.
            </p>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 pt-2">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Incorpora seu tom de voz autoral</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Garante coesão sem "colcha de retalhos"</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Abertura provocativa e encerramento aberto</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Agent 2: Editor de Humanização */}
        <div className="bg-white dark:bg-[#18191e] rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-cyan-300 dark:hover:border-cyan-500 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-stone-900 border border-cyan-200 dark:border-stone-800 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Agente 02 • Ritmo Textual</span>
              <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">Editor de Humanização (O "Des-AIzador")</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm leading-relaxed">
              Audita o rascunho em busca de vícios e conectores mecânicos de IA ("Além disso", "Portanto"), destruindo padrões previsíveis para devolver a respiração e cadence humana.
            </p>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 pt-2">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Expurga conectores de transição de IA</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Cria assimetria e pausas orais naturais</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Elimina tom corporativo e otimismo sintético</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Agent 3: Curador Conceitual & Filosófico */}
        <div className="bg-white dark:bg-[#18191e] rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-amber-300 dark:hover:border-amber-500 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-stone-900 border border-amber-200 dark:border-stone-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Agente 03 • Teoria & Filosofia</span>
              <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">Curador Conceitual (O "Guardião da Teoria")</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm leading-relaxed">
              Assegura que os fundamentos da sua linha editorial (análise crítica, premissas conceituais, contexto histórico e cultural) sejam abordados com rigor e densidade intelectual.
            </p>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 pt-2">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Impede simplificações e jargões rasos</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Valida a coerência da tese com o manifesto</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Conecta a ideia ao contexto contemporâneo</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Agent 4: Revisor Editorial & Ético */}
        <div className="bg-white dark:bg-[#18191e] rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-stone-900 border border-indigo-200 dark:border-stone-800 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Agente 04 • Ética & Distribuição</span>
              <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">Revisor Editorial & Ético</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm leading-relaxed">
              Audita a postura ética (proibição do 'você' prescritivo, rigor com dados e fontes) e gera os metadados de distribuição do artigo.
            </p>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 pt-2">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Audita normas de isenção e tom autoral</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Gera SEO, hashtags e sugestões de tags</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Cria legendas de impacto para redes sociais</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Agent 5: Designer Editorial */}
        <div className="bg-white dark:bg-[#18191e] rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-500 transition-all md:col-span-2 lg:col-span-1">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-stone-900 border border-emerald-200 dark:border-stone-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Agente 05 • Arte & Capa</span>
              <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">Designer Editorial Visual</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm leading-relaxed">
              Traduz o núcleo poético e filosófico do ensaio em uma metáfora visual elegante, gerando a arte de capa ideal via Gemini Imagen.
            </p>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 pt-2">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Ilustração poética sem clichês gráficos</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Estilos: minimalista, aquarela, colagem</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Geração direta com prompt otimizado</span>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* Loop de Coesão Editorial Explanation */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 sm:p-8 space-y-4 border border-stone-800 shadow-lg">
        <div className="flex items-center space-x-3 text-teal-400 font-bold text-sm sm:text-base">
          <Repeat className="w-5 h-5 text-teal-400 shrink-0" />
          <span>Garantia de Coesão: Como o Fluxo Impede a "Colcha de Retalhos"</span>
        </div>

        <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
          Muitos leitores percebem quando um texto é editado por IA porque ele fica parecendo uma colcha de retalhos com parágrafos desalinhados. No Aether Studio, adotamos a regra da <strong>Reescrita Integrada pelo Redator Principal</strong>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60 space-y-1">
            <span className="text-teal-400 font-bold block">1. Rascunho Inicial</span>
            <p className="text-stone-400">O Redator cria o primeiro esboço estrutural baseado no tema.</p>
          </div>

          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60 space-y-1">
            <span className="text-cyan-400 font-bold block">2. Análise dos 3 Especialistas</span>
            <p className="text-stone-400">Humanizador, Curador Conceitual e Revisor Editorial emitem pareceres.</p>
          </div>

          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60 space-y-1">
            <span className="text-amber-400 font-bold block">3. Reescrita do Redator</span>
            <p className="text-stone-400">O Redator lê os 3 pareceres e <strong>reescreve todo o ensaio do zero</strong> de forma unificada.</p>
          </div>

          <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60 space-y-1">
            <span className="text-emerald-400 font-bold block">4. Artigo Final Coeso</span>
            <p className="text-stone-400">Resultado: Um texto fluido, denso, autoral e com voz humana consistente.</p>
          </div>
        </div>
      </div>

      {/* Customization Highlight Box */}
      <div className="bg-teal-50 dark:bg-stone-900/90 border border-teal-200 dark:border-stone-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <h4 className="font-bold text-teal-950 dark:text-teal-200 text-sm sm:text-base">Escreva e edite sua visão de mundo detalhada</h4>
          <p className="text-teal-800 dark:text-stone-300 text-xs sm:text-sm">
            Na aba <strong>Minha Visão de Mundo</strong>, você ajusta as diretrizes do Redator, do Editor de Humanização e do Curador Conceitual.
          </p>
        </div>
        <button
          onClick={onCustomizePrompts}
          className="px-4 py-2 bg-teal-800 hover:bg-teal-900 dark:bg-amber-400 dark:hover:bg-amber-500 text-white dark:text-stone-950 font-medium text-xs sm:text-sm rounded-xl shrink-0 transition-all shadow-xs cursor-pointer"
        >
          Minha Visão de Mundo
        </button>
      </div>

    </div>
  );
};
