import React, { useState } from 'react';
import {
  PenTool,
  Heart,
  BookOpen,
  Users,
  Brain,
  Globe,
  Sun,
  Moon,
  Layers,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Settings,
  PlusCircle,
  Activity,
  ChevronRight,
  Database,
  Zap,
  Download,
  Inbox,
} from 'lucide-react';
import { Blog } from '../types';

/**
 * As abas do Studio, num lugar só.
 *
 * Estava escrito por extenso em quatro lugares — a prop, o setter, o
 * handler e o App —, então acrescentar uma aba exigia lembrar dos quatro.
 */
export type StudioTab = 'create' | 'manifesto' | 'inbox' | 'history' | 'team';

// URL do blog público, por blog.
//
// Era `VITE_PUBLIC_BLOG_URL`: uma variável só, cravada no bundle. Com dois
// blogs no ar, o botão "Ver Blog" apontava sempre para o mesmo site — bloqueio
// B5. Agora sai de `blogs.site_url`.
//
// A variável de ambiente sobrevive como fallback para o blog que ainda não tem
// domínio cadastrado, e o último recurso é a porta do `astro dev` local.
function resolveBlogUrl(blog?: Blog): string {
  return (
    blog?.siteUrl ||
    (import.meta as any).env?.VITE_PUBLIC_BLOG_URL ||
    'http://localhost:4321'
  );
}

interface NavbarProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  /** Quantos artigos esperam decisão sua. Aparece como marcador na aba. */
  pendingCount?: number;
  savedCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeBlog: Blog;
  blogs: Blog[];
  onSelectBlog: (id: string) => void;
  onOpenBlogManager: () => void;
  onOpenSupabaseModal?: () => void;
  onExportBackup?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  savedCount,
  pendingCount,
  theme,
  onToggleTheme,
  activeBlog,
  blogs,
  onSelectBlog,
  onOpenBlogManager,
  onOpenSupabaseModal,
  onExportBackup,
}) => {
  const isDark = theme === 'dark';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    {
      id: 'create' as const,
      label: 'Produzir Artigo',
      subtitle: 'Gerador & Pipeline de IA',
      icon: PenTool,
    },
    {
      id: 'manifesto' as const,
      label: 'Linha Editorial',
      subtitle: 'Voz, Tom & Persona',
      icon: Heart,
    },
    {
      id: 'inbox' as const,
      label: 'Aprovação',
      subtitle:
        pendingCount === undefined || pendingCount === 0
          ? 'Fila vazia'
          : `${pendingCount} esperando você`,
      icon: Inbox,
      badge: pendingCount ? pendingCount : null,
    },
    {
      id: 'history' as const,
      label: 'Histórico de Artigos',
      subtitle: `${savedCount} texto(s) arquivado(s)`,
      icon: BookOpen,
      badge: savedCount > 0 ? savedCount : null,
    },
    {
      id: 'team' as const,
      label: 'Equipe Editorial',
      subtitle: '4 Agentes Especialistas',
      icon: Users,
    },
  ];

  const activeNavItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  const handleNavClick = (tab: StudioTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* ========================================== */}
      {/* DESKTOP FIX SIDEBAR - MINIMALIST DESIGN */}
      {/* ========================================== */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-64 xl:w-72 z-30 border-r transition-colors duration-200 ${
          isDark
            ? 'bg-[#0d111a] border-slate-800 text-slate-200'
            : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}
      >
        {/* Sidebar Header & Brand Logo */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => handleNavClick('create')}
          >
            <div className="w-8 h-8 rounded bg-teal-600 dark:bg-teal-500 flex items-center justify-center text-white transition-transform shrink-0 shadow-xs">
              <Brain className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col leading-tight">
              <div className="flex items-center space-x-2">
                <span className="font-sans font-extrabold text-base tracking-tight text-slate-900 dark:text-slate-100">
                  Aether Studio
                </span>
                <span className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  AI
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Blog Editorial & Dev
              </span>
            </div>
          </div>
        </div>

        {/* Active Publication Badge */}
        <div className="px-4 py-3">
          <div
            className={`p-3 rounded-lg border transition-all ${
              isDark
                ? 'bg-[#111726] border-slate-800/90 text-slate-200'
                : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center space-x-1">
                <Globe className="w-3 h-3" />
                <span>Blog Ativo</span>
              </span>
              <button
                onClick={() => handleNavClick('manifesto')}
                title="Editar Linha Editorial"
                className="p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-1">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {activeBlog?.name || 'Tech Pulse AI'}
              </p>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {activeBlog?.niche || 'IA, Engenharia & Sistemas'}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button: "Novo Artigo" */}
        <div className="px-4 py-1">
          <button
            onClick={() => handleNavClick('create')}
            className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            <span>+ Criar Artigo Tech</span>
          </button>
        </div>

        {/* Main Navigation Links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Navegação Studio
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between group cursor-pointer ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20'
                    : isDark
                    ? 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <Icon className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <div className="truncate">
                    <p className="text-xs truncate leading-snug">
                      {item.label}
                    </p>
                  </div>
                </div>

                {/* Badges or Status */}
                {item.badge !== undefined && item.badge !== null && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Supabase Integration Button */}
          {onOpenSupabaseModal && (
            <button
              onClick={onOpenSupabaseModal}
              className={`w-full py-2 px-3 rounded-lg border transition-all text-xs font-mono font-bold flex items-center justify-between cursor-pointer ${
                isDark
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span>Supabase Sync</span>
              </div>
              <span className="text-[9px] bg-emerald-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded uppercase">
                Conectado
              </span>
            </button>
          )}

          {/* Backup do histórico local.
              Rascunhos e manifestos existem em UM navegador só. Este botão é a
              única forma de tirá-los de lá antes da migração para o Supabase —
              e o seguro contra a própria migração. */}
          {onExportBackup && (
            <button
              onClick={onExportBackup}
              title="Baixar rascunhos, blogs e manifestos em JSON"
              className={`w-full py-2 px-3 rounded-lg border transition-all text-xs font-mono font-bold flex items-center justify-between cursor-pointer ${
                isDark
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span>Exportar histórico</span>
              </div>
            </button>
          )}

          {/* Status Box */}
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#111726] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-2">
              <Activity className="w-3 h-3 text-teal-500" />
              <span className="text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                Pipeline IA
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-500">
              ● Online
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className={`w-full py-1.5 px-3 rounded-lg border transition-all text-xs font-medium flex items-center justify-between cursor-pointer ${
              isDark
                ? 'bg-[#111726] hover:bg-slate-900 text-slate-300 border-slate-800'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
              <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
            </div>
          </button>
        </div>
      </aside>

      {/* ========================================== */}
      {/* MOBILE TOP HEADER BAR */}
      {/* ========================================== */}
      <header
        className={`lg:hidden sticky top-0 z-40 transition-colors duration-200 border-b backdrop-blur-md ${
          isDark
            ? 'bg-[#151413]/95 border-[#262422] text-[#e3ded6]'
            : 'bg-[#faf9f6]/95 border-[#e8e5de] text-[#242220]'
        }`}
      >
        <div className="px-4 h-14 flex items-center justify-between">
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => handleNavClick('create')}
          >
            <div className="w-7 h-7 rounded bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-serif font-semibold text-sm">
              Studio Editorial AI
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded border ${
                isDark
                  ? 'bg-[#1c1a18] text-stone-300 border-[#2a2724]'
                  : 'bg-[#f2efe9] text-stone-700 border-[#e5e0d6]'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div
            className={`relative w-3/4 max-w-xs h-full flex flex-col z-10 p-5 transition-all ${
              isDark ? 'bg-[#151413] text-[#e3ded6]' : 'bg-[#faf9f6] text-[#242220]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8e5de] dark:border-[#262422]">
              <span className="font-serif font-semibold text-base">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-1 py-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full text-left p-2.5 rounded font-medium text-xs flex items-center justify-between ${
                      isActive
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                        : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DESKTOP TOP BREADCRUMB BAR */}
      {/* ========================================== */}
      <div
        className={`hidden lg:block sticky top-0 z-20 pl-64 xl:pl-72 border-b backdrop-blur-md transition-colors duration-200 ${
          isDark
            ? 'bg-[#151413]/90 border-[#262422] text-[#e3ded6]'
            : 'bg-[#faf9f6]/90 border-[#e8e5de] text-[#242220]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-stone-500 font-serif italic">
            <span>Estúdio</span>
            <span>/</span>
            <span className="font-sans font-medium text-stone-900 dark:text-stone-100 not-italic">
              {activeNavItem.label}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onOpenSupabaseModal && (
              <button
                onClick={onOpenSupabaseModal}
                className="px-2.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono font-bold text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
                title="Configurações e Publicação via Supabase"
              >
                <Zap className="w-3 h-3 text-emerald-500 fill-current" />
                <span>Supabase</span>
              </button>
            )}
            <span className="px-2.5 py-0.5 rounded bg-[#f0ede6] dark:bg-[#22201d] border border-[#e5e0d6] dark:border-[#2a2724] text-stone-700 dark:text-stone-300 text-[11px] font-medium">
              {activeBlog.name}
            </span>
            <a
              href={resolveBlogUrl(activeBlog)}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-0.5 rounded bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 font-medium text-[11px] flex items-center space-x-1 cursor-pointer"
              title="Abrir o blog público em uma nova aba"
            >
              <Globe className="w-3 h-3" />
              <span>Ver Blog</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};
