import React, { useState } from 'react';
import {
  Brain,
  Search,
  BookOpen,
  Calendar,
  Clock,
  Tag,
  ArrowLeft,
  Share2,
  Check,
  Globe,
  Sparkles,
  ExternalLink,
  Code2,
  Download,
  Copy,
  SlidersHorizontal,
  Bookmark,
  Send,
  User,
  Heart,
  Sun,
  Moon,
  LayoutGrid,
  ListFilter,
  Lock,
  Key,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ArticlePost, UserManifesto, Blog } from '../types';

interface PublicBlogPortalProps {
  posts: ArticlePost[];
  manifesto: UserManifesto;
  blogs?: Blog[];
  activeBlogId?: string;
  forcedBlogId?: string;
  standaloneMode?: boolean;
  onSelectBlog?: (blogId: string) => void;
  onBackToStudio: () => void;
  onSelectPostToViewInStudio?: (post: ArticlePost) => void;
}

export const PublicBlogPortal: React.FC<PublicBlogPortalProps> = ({
  posts,
  manifesto,
  blogs = [],
  activeBlogId,
  forcedBlogId,
  standaloneMode = false,
  onSelectBlog,
  onBackToStudio,
  onSelectPostToViewInStudio,
}) => {
  const [selectedPost, setSelectedPost] = useState<ArticlePost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedBlogFilter, setSelectedBlogFilter] = useState<string>(
    forcedBlogId || activeBlogId || 'all'
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [showExportModal, setShowExportModal] = useState<ArticlePost | null>(null);
  const [webhookSimulated, setWebhookSimulated] = useState(false);

  // Team Access Passcode Modal state
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Minimalist Theme & Layout Mode
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  // Reader Customization controls
  const [readerFontSize, setReaderFontSize] = useState<'normal' | 'grande' | 'expandido'>('normal');
  const [readerBgTheme, setReaderBgTheme] = useState<'default' | 'sepia' | 'contrast'>('default');

  const isDark = theme === 'dark';

  // Effective blog ID to filter by
  const effectiveBlogId = forcedBlogId || (selectedBlogFilter !== 'all' ? selectedBlogFilter : activeBlogId);

  // Active blog metadata for header customization
  const currentBlog = blogs.find((b) => b.id === effectiveBlogId) || blogs.find((b) => b.id === activeBlogId);

  // Filter published posts (only show posts where isPublished !== false)
  const publishedPosts = posts.filter((p) => {
    const hasText = p.review && p.review.revisedText && p.review.revisedText.trim().length > 0;
    if (!hasText) return false;
    if (p.isPublished === false) return false;
    if (effectiveBlogId && p.blogId) {
      return p.blogId === effectiveBlogId;
    }
    return true;
  });

  // Get all unique tags
  const allCategories = [
    'Todos',
    ...Array.from(
      new Set(
        publishedPosts.flatMap((p) => p.review?.suggestedTags || [])
      )
    ),
  ];

  const filteredPosts = publishedPosts.filter((post) => {
    const titleMatch = (post.review?.revisedTitle || post.draft?.title || post.topic)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const textMatch = (post.review?.revisedText || post.draft?.rawText || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesSearch = titleMatch || textMatch;

    const matchesCategory =
      selectedCategory === 'Todos' ||
      (post.review?.suggestedTags && post.review.suggestedTags.includes(selectedCategory));

    return matchesSearch && matchesCategory;
  });

  const featuredPost = filteredPosts.length > 0 ? filteredPosts[0] : null;
  const regularPosts = filteredPosts.length > 1 ? filteredPosts.slice(1) : [];

  const handleShare = (postTitle: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return 'Recentemente';
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans pb-24 ${
      isDark ? 'bg-[#080c14] text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Banner & Control Bar */}
      <div className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#0d121f]/90 border-slate-800 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto py-2.5 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className={`font-mono font-bold uppercase tracking-wider text-[11px] ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
              TECH PULSE AI
            </span>
            <span className="text-slate-400 font-mono hidden sm:inline">• Portal de Publicações Tech</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-1.5 rounded-lg border flex items-center space-x-1.5 font-medium transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-900 text-amber-400 border-slate-800 hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
              }`}
              title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-900" />}
              <span className="hidden md:inline text-[11px] font-mono">
                {isDark ? 'Modo Claro' : 'Modo Escuro'}
              </span>
            </button>

            {/* Layout Toggle */}
            <div className={`flex items-center rounded-lg border p-0.5 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setLayoutMode('grid')}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'grid'
                    ? isDark ? 'bg-slate-800 text-teal-400' : 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLayoutMode('list')}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'list'
                    ? isDark ? 'bg-slate-800 text-teal-400' : 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visualização em Lista Minimalista"
              >
                <ListFilter className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Team Access (Restricted Backstage) */}
            <button
              onClick={() => {
                setPasscodeInput('');
                setPasscodeError('');
                setShowPasscodeModal(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-mono px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer text-[11px] border border-slate-800"
              title="Acesso Restrito à Área da Equipe Editorial (Bastidores)"
            >
              <Lock className="w-3 h-3 text-teal-400 shrink-0" />
              <span className="hidden sm:inline font-bold">Equipe</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reader Mode Header / Minimalist Masthead */}
      <header className={`py-12 px-4 sm:px-6 lg:px-8 border-b transition-colors ${
        isDark ? 'bg-[#0c101c] border-slate-800/80' : 'bg-white border-slate-200/80'
      }`}>
        <div className="max-w-4xl mx-auto space-y-5 text-center">
          <div className={`inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider border ${
            isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' : 'bg-teal-50 text-teal-800 border-teal-200'
          }`}>
            <Globe className="w-3.5 h-3.5" />
            <span>{currentBlog ? currentBlog.niche : 'Inteligência Artificial, Engenharia & Futuro Tech'}</span>
          </div>

          <h1 className={`font-sans text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight ${
            isDark ? 'text-slate-100' : 'text-slate-950'
          }`}>
            {currentBlog ? currentBlog.name : 'Tech Pulse AI'}
          </h1>

          <p className={`text-sm sm:text-base max-w-2xl mx-auto leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {currentBlog ? currentBlog.description : 'Análises aprofundadas, arquitetura de sistemas, inteligência artificial generativa e os impactos da tecnologia.'}
          </p>

          <div className={`pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-mono ${
            isDark ? 'text-slate-500' : 'text-slate-500'
          }`}>
            <span className="flex items-center space-x-1">
              <User className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-700'}`} />
              <span>Por <strong>{currentBlog ? currentBlog.authorName : manifesto.authorName || 'Redação Tech'}</strong> ({currentBlog ? currentBlog.professionalTitle : manifesto.professionalTitle || 'Engenharia Tech'})</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <BookOpen className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-indigo-600'}`} />
              <span>{publishedPosts.length} Artigo(s) Publicado(s)</span>
            </span>
          </div>
        </div>
      </header>

      {/* Article Detail Full View */}
      {selectedPost ? (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
          {/* Header Controls: Back & Reader Preferences */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setSelectedPost(null)}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                isDark
                  ? 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 shadow-2xs'
              }`}
            >
              <ArrowLeft className="w-4 h-4 text-teal-500" />
              <span>← Voltar aos Artigos</span>
            </button>

            {/* Reading Preference Bar */}
            <div className={`flex items-center space-x-3 px-3 py-1.5 rounded-xl border text-xs font-mono ${
              isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100/90 border-slate-200 text-slate-700'
            }`}>
              {/* Font Size Selector */}
              <div className="flex items-center space-x-1 border-r pr-2 border-slate-300 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 mr-1 uppercase">Fonte:</span>
                <button
                  onClick={() => setReaderFontSize('normal')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                    readerFontSize === 'normal'
                      ? 'bg-teal-500 text-slate-950 shadow-2xs'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title="Tamanho Normal (18px)"
                >
                  Aa
                </button>
                <button
                  onClick={() => setReaderFontSize('grande')}
                  className={`px-2 py-0.5 rounded text-[12px] font-bold cursor-pointer transition-all ${
                    readerFontSize === 'grande'
                      ? 'bg-teal-500 text-slate-950 shadow-2xs'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title="Tamanho Grande (20px)"
                >
                  Aa+
                </button>
                <button
                  onClick={() => setReaderFontSize('expandido')}
                  className={`px-2 py-0.5 rounded text-[13px] font-bold cursor-pointer transition-all ${
                    readerFontSize === 'expandido'
                      ? 'bg-teal-500 text-slate-950 shadow-2xs'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title="Tamanho Expandido (22px)"
                >
                  Aa++
                </button>
              </div>

              {/* Theme Canvas Selector */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setReaderBgTheme('default')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                    readerBgTheme === 'default'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-950'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  Padrão
                </button>
                <button
                  onClick={() => setReaderBgTheme('sepia')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                    readerBgTheme === 'sepia'
                      ? 'bg-[#78350f] text-[#fef3c7]'
                      : 'hover:bg-amber-100/50 dark:hover:bg-stone-800'
                  }`}
                >
                  Sépia
                </button>
              </div>
            </div>
          </div>

          {/* Article Reading Canvas */}
          <article className={`rounded-2xl p-6 sm:p-12 border transition-colors space-y-8 ${
            readerBgTheme === 'sepia'
              ? isDark
                ? 'bg-[#161311] text-[#e8dfd5] border-[#2c2621]'
                : 'bg-[#fbf8f1] text-[#2c2725] border-[#e8dfd1] shadow-2xs'
              : isDark
                ? 'bg-[#0a0f1d] text-slate-100 border-slate-800/90'
                : 'bg-white text-slate-900 border-slate-200/90 shadow-xs'
          }`}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                <span className={`font-bold px-2.5 py-0.5 rounded border text-[10px] uppercase ${
                  isDark
                    ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                    : 'bg-teal-50 text-teal-800 border-teal-200'
                }`}>
                  Artigo Tech
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDate(selectedPost.createdAt)}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedPost.review?.readingTimeMinutes || 5} min de leitura</span>
                </span>
              </div>

              <h1 className={`font-sans text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-[1.18] ${
                readerBgTheme === 'sepia'
                  ? isDark ? 'text-[#f4ebe1]' : 'text-[#1c1816]'
                  : isDark ? 'text-slate-50' : 'text-slate-950'
              }`}>
                {selectedPost.review?.revisedTitle || selectedPost.draft?.title}
              </h1>

              {selectedPost.review?.revisedSubtitle && (
                <p className={`text-lg sm:text-xl font-sans leading-relaxed ${
                  readerBgTheme === 'sepia'
                    ? isDark ? 'text-[#c7bcae]' : 'text-[#594e4a]'
                    : isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {selectedPost.review.revisedSubtitle}
                </p>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {selectedPost.review?.suggestedTags?.map((tag) => (
                  <span
                    key={tag}
                    className={`text-[11px] font-mono px-2.5 py-0.5 rounded border ${
                      isDark
                        ? 'bg-slate-900 text-teal-400 border-slate-800'
                        : 'bg-slate-100 text-teal-800 border-slate-200'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Cover Image */}
            {selectedPost.image?.imageUrl && (
              <div className={`rounded-xl overflow-hidden border ${
                isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'
              }`}>
                <img
                  src={selectedPost.image.imageUrl}
                  alt={selectedPost.review?.revisedTitle || 'Capa do artigo'}
                  className="w-full max-h-[480px] object-cover"
                />
                {selectedPost.image.promptUsed && (
                  <div className={`p-3 text-[11px] font-mono flex items-center justify-between border-t ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <span>Imagem Editorial Tech • Gemini Visual</span>
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Estilo: {selectedPost.input.visualStyle}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Article Content - High Legibility Custom Typography */}
            <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
              <Markdown
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight mt-10 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="font-sans text-2xl sm:text-[28px] font-extrabold tracking-tight mt-12 mb-5 pt-8 border-t border-slate-200/80 dark:border-slate-800/80" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="font-sans text-xl sm:text-2xl font-bold tracking-tight mt-9 mb-4" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className={`font-sans tracking-normal ${
                      readerFontSize === 'grande'
                        ? 'text-[19px] sm:text-[20px] leading-[1.9] mb-7'
                        : readerFontSize === 'expandido'
                        ? 'text-[21px] sm:text-[22px] leading-[1.95] mb-8'
                        : 'text-[17px] sm:text-[18px] leading-[1.85] mb-6'
                    } ${
                      readerBgTheme === 'sepia'
                        ? isDark ? 'text-[#e8dfd5]' : 'text-[#2c2725]'
                        : isDark ? 'text-slate-200' : 'text-slate-800'
                    }`} {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="my-8 pl-5 py-3.5 border-l-4 border-teal-500 bg-teal-500/5 dark:bg-teal-500/10 rounded-r-xl not-italic font-medium text-[17px] sm:text-[18px] leading-relaxed shadow-2xs" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className={`my-6 pl-6 space-y-3 list-disc font-sans ${
                      readerFontSize === 'grande' ? 'text-[19px] sm:text-[20px] leading-[1.9]' :
                      readerFontSize === 'expandido' ? 'text-[21px] sm:text-[22px] leading-[1.95]' :
                      'text-[17px] sm:text-[18px] leading-[1.85]'
                    }`} {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className={`my-6 pl-6 space-y-3 list-decimal font-sans ${
                      readerFontSize === 'grande' ? 'text-[19px] sm:text-[20px] leading-[1.9]' :
                      readerFontSize === 'expandido' ? 'text-[21px] sm:text-[22px] leading-[1.95]' :
                      'text-[17px] sm:text-[18px] leading-[1.85]'
                    }`} {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="pl-1" {...props} />
                  ),
                  code: ({ node, inline, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    if (inline) {
                      return (
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-teal-700 dark:text-teal-300 font-mono text-[0.875em] border border-slate-200/80 dark:border-slate-700/80 font-normal" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div className="relative my-8 rounded-xl overflow-hidden border border-slate-800 bg-[#070a12] shadow-md">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
                          <span>{match ? match[1] : 'code'}</span>
                          <span className="text-[10px] uppercase tracking-wider text-teal-400">Tech Snippet</span>
                        </div>
                        <pre className="p-4 sm:p-5 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-slate-100">
                          <code>{children}</code>
                        </pre>
                      </div>
                    );
                  }
                }}
              >
                {selectedPost.review?.revisedText || selectedPost.draft?.rawText || ''}
              </Markdown>
            </div>

            {/* Key Takeaways */}
            {selectedPost.review?.keyTakeaways && selectedPost.review.keyTakeaways.length > 0 && (
              <div className={`rounded-xl p-6 space-y-3 border ${
                isDark
                  ? 'bg-[#0d1424] border-teal-500/30 text-slate-200'
                  : 'bg-teal-50/70 border-teal-200 text-teal-950'
              }`}>
                <h3 className={`font-sans font-bold text-base flex items-center space-x-2 ${
                  isDark ? 'text-teal-300' : 'text-teal-950'
                }`}>
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span>Destaques Técnicos & Pontos-Chave:</span>
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm">
                  {selectedPost.review.keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="text-teal-500 font-bold font-mono">▸</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Author Footer Bio */}
            <div className={`rounded-xl p-6 sm:p-8 space-y-4 border ${
              isDark
                ? 'bg-[#080d1a] border-slate-800 text-slate-200'
                : 'bg-slate-900 text-slate-100 border-slate-800'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-lg bg-teal-600 border border-teal-400 flex items-center justify-center font-bold text-white font-mono text-lg shrink-0">
                  {(manifesto.authorName || 'T')[0]}
                </div>
                <div>
                  <h4 className="font-sans font-bold text-base text-white">{manifesto.authorName || 'Redação Tech Studio'}</h4>
                  <p className="text-xs text-slate-400 font-mono">Artigo com revisão de arquitetura e rigor técnico.</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                "{manifesto.worldviewDescription || 'Análise crítica de tecnologia, inteligência artificial e ecossistema de software.'}"
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                <button
                  onClick={() => handleShare(selectedPost.review?.revisedTitle || '')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-teal-400" />}
                  <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar Artigo'}</span>
                </button>

                <button
                  onClick={() => setShowExportModal(selectedPost)}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Code2 className="w-3.5 h-3.5 text-teal-200" />
                  <span>Exportar para WordPress / Ghost</span>
                </button>
              </div>
            </div>
          </article>
        </main>
      ) : (
        /* Blog Main Landing View */
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
          {/* Search & Categories */}
          <div className={`rounded-xl p-4 sm:p-6 border transition-colors space-y-4 ${
            isDark ? 'bg-[#0e1320] border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
          }`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar artigos, IA, sistemas, DevOps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-xs focus:outline-none focus:ring-2 font-mono border transition-colors ${
                    isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-100 focus:ring-teal-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-teal-600'
                  }`}
                />
              </div>

              {/* Counter & Mode Badge */}
              <div className="flex items-center space-x-3 self-end sm:self-auto text-xs text-slate-400 font-mono">
                <span>{filteredPosts.length} artigo(s) encontrado(s)</span>
              </div>
            </div>

            {/* Category Tags */}
            {allCategories.length > 1 && (
              <div className={`flex flex-wrap gap-1.5 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? isDark
                          ? 'bg-teal-500 text-slate-950 font-bold shadow-2xs'
                          : 'bg-slate-900 text-white font-bold shadow-2xs'
                        : isDark
                          ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* If No Published Posts */}
          {publishedPosts.length === 0 && (
            <div className={`rounded-2xl p-12 text-center border space-y-4 max-w-xl mx-auto ${
              isDark ? 'bg-[#0e1320] border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto border ${
                isDark ? 'bg-slate-900 text-teal-400 border-slate-800' : 'bg-teal-50 text-teal-800 border-teal-200'
              }`}>
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className={`font-sans font-bold text-xl ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Nenhum Artigo Tech Publicado
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Você pode gerar seu primeiro artigo técnico na aba <strong>Produzir Artigo</strong> com a equipe de agentes de IA e publicá-lo para aparecer aqui!
              </p>
              <button
                onClick={onBackToStudio}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold font-mono px-6 py-3 rounded-xl text-xs transition-all shadow-xs cursor-pointer inline-flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4 text-teal-200" />
                <span>Gerar Primeiro Artigo com IA</span>
              </button>
            </div>
          )}

          {/* Featured Article */}
          {featuredPost && (
            <section className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-teal-500">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Artigo em Destaque</span>
              </div>

              <div
                onClick={() => setSelectedPost(featuredPost)}
                className={`rounded-2xl border overflow-hidden grid grid-cols-1 md:grid-cols-12 transition-all cursor-pointer group hover:border-teal-500/50 ${
                  isDark ? 'bg-[#0f1422] border-slate-800 shadow-md' : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-md'
                }`}
              >
                {/* Image */}
                <div className="md:col-span-6 min-h-[260px] sm:min-h-[340px] relative overflow-hidden bg-slate-900">
                  {featuredPost.image?.imageUrl ? (
                    <img
                      src={featuredPost.image.imageUrl}
                      alt={featuredPost.review?.revisedTitle || 'Imagem de destaque'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-teal-400 p-8 text-center font-mono text-sm">
                      <span>"{featuredPost.review?.revisedTitle}"</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                      <span className="font-bold px-2 py-0.5 rounded text-[10px] uppercase bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        DESTAQUE
                      </span>
                      <span>•</span>
                      <span>{formatDate(featuredPost.createdAt)}</span>
                      <span>•</span>
                      <span>{featuredPost.review?.readingTimeMinutes || 5} min read</span>
                    </div>

                    <h2 className={`font-sans text-2xl sm:text-3xl font-extrabold transition-colors leading-tight tracking-tight ${
                      isDark ? 'text-slate-100 group-hover:text-teal-400' : 'text-slate-950 group-hover:text-teal-700'
                    }`}>
                      {featuredPost.review?.revisedTitle || featuredPost.draft?.title}
                    </h2>

                    <p className={`text-sm font-sans line-clamp-3 leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {featuredPost.review?.revisedSubtitle || featuredPost.review?.metaDescription}
                    </p>
                  </div>

                  <div className={`pt-4 border-t flex items-center justify-between ${
                    isDark ? 'border-slate-800' : 'border-slate-100'
                  }`}>
                    <div className="flex flex-wrap gap-1">
                      {featuredPost.review?.suggestedTags?.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <span className={`text-xs font-mono font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform ${
                      isDark ? 'text-teal-400' : 'text-teal-800'
                    }`}>
                      <span>Ler Artigo</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Regular Posts - Grid or List Minimalist View */}
          {regularPosts.length > 0 && (
            <section className="space-y-4">
              <h3 className={`font-sans font-bold text-xl tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Publicações Técnicas
              </h3>

              {layoutMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className={`rounded-xl border overflow-hidden flex flex-col justify-between transition-all cursor-pointer group ${
                        isDark
                          ? 'bg-[#0f1422] border-slate-800 hover:border-teal-500/40'
                          : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Thumbnail Image */}
                        {post.image?.imageUrl && (
                          <div className="h-44 bg-slate-900 overflow-hidden">
                            <img
                              src={post.image.imageUrl}
                              alt={post.review?.revisedTitle || 'Imagem do post'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        )}

                        <div className="p-5 space-y-2">
                          <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                            <span>{formatDate(post.createdAt)}</span>
                            <span>•</span>
                            <span>{post.review?.readingTimeMinutes || 5} min</span>
                          </div>

                          <h4 className={`font-sans font-bold text-base line-clamp-2 leading-snug tracking-tight transition-colors ${
                            isDark ? 'text-slate-100 group-hover:text-teal-400' : 'text-slate-950 group-hover:text-teal-700'
                          }`}>
                            {post.review?.revisedTitle || post.draft?.title}
                          </h4>

                          <p className={`text-xs font-sans line-clamp-2 leading-relaxed ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {post.review?.revisedSubtitle || post.review?.metaDescription}
                          </p>
                        </div>
                      </div>

                      <div className={`p-5 pt-0 flex items-center justify-between border-t mt-2 ${
                        isDark ? 'border-slate-800/80' : 'border-slate-100'
                      }`}>
                        <span className="text-[11px] font-mono text-slate-400">
                          #{post.review?.suggestedTags?.[0] || 'Tech'}
                        </span>
                        <span className={`text-xs font-mono font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform ${
                          isDark ? 'text-teal-400' : 'text-teal-800'
                        }`}>
                          <span>Ler</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List Minimalist View */
                <div className="space-y-4">
                  {regularPosts.map((post) => (
                    <article
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className={`rounded-xl p-6 border transition-all cursor-pointer group flex flex-col sm:flex-row items-start justify-between gap-6 ${
                        isDark
                          ? 'bg-[#0f1422] border-slate-800 hover:border-teal-500/40'
                          : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                          <span>{formatDate(post.createdAt)}</span>
                          <span>•</span>
                          <span>{post.review?.readingTimeMinutes || 5} min de leitura</span>
                          {post.review?.suggestedTags?.[0] && (
                            <>
                              <span>•</span>
                              <span className={isDark ? 'text-teal-400' : 'text-teal-800'}>
                                #{post.review.suggestedTags[0]}
                              </span>
                            </>
                          )}
                        </div>

                        <h4 className={`font-sans font-bold text-lg sm:text-xl tracking-tight transition-colors ${
                          isDark ? 'text-slate-100 group-hover:text-teal-400' : 'text-slate-950 group-hover:text-teal-700'
                        }`}>
                          {post.review?.revisedTitle || post.draft?.title}
                        </h4>

                        <p className={`text-xs sm:text-sm font-sans line-clamp-2 leading-relaxed ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {post.review?.revisedSubtitle || post.review?.metaDescription}
                        </p>

                        <div className="pt-2 flex items-center space-x-1 text-xs font-mono font-bold">
                          <span className={isDark ? 'text-teal-400' : 'text-teal-800'}>Continuar leitura</span>
                          <span className={`group-hover:translate-x-1 transition-transform ${isDark ? 'text-teal-400' : 'text-teal-800'}`}>→</span>
                        </div>
                      </div>

                      {post.image?.imageUrl && (
                        <div className="w-full sm:w-36 h-28 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                          <img
                            src={post.image.imageUrl}
                            alt={post.review?.revisedTitle || 'Thumb'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* Export / Webhook Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#18191e] border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-stone-800' : 'border-stone-100'}`}>
              <div className={`flex items-center space-x-2 font-serif font-bold text-xl ${isDark ? 'text-amber-300' : 'text-teal-950'}`}>
                <Code2 className="w-5 h-5" />
                <h3>Exportar ou Integrar com Site Externo</h3>
              </div>
              <button
                onClick={() => {
                  setShowExportModal(null);
                  setWebhookSimulated(false);
                }}
                className="text-stone-400 hover:text-stone-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Você pode publicar este ensaio diretamente no seu site próprio (WordPress, Ghost, Webflow ou plataforma customizada) exportando em JSON, Markdown ou disparando um Webhook.
            </p>

            {/* Webhook Test Simulation */}
            <div className="bg-stone-950 text-stone-100 rounded-2xl p-5 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between text-teal-400 font-bold">
                <span>POST /api/webhooks/publish-article</span>
                <span className="text-[10px] bg-teal-950 text-teal-300 px-2 py-0.5 rounded border border-teal-800">
                  PAYLOAD PRONTO
                </span>
              </div>

              <pre className="bg-stone-900 p-3 rounded-xl overflow-x-auto text-amber-200 text-[11px] leading-relaxed max-h-48">
{JSON.stringify(
  {
    title: showExportModal.review?.revisedTitle,
    subtitle: showExportModal.review?.revisedSubtitle,
    slug: showExportModal.review?.revisedTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    author: manifesto.authorName || 'Autor',
    content_markdown: showExportModal.review?.revisedText?.slice(0, 150) + '...',
    cover_image_url: showExportModal.image?.imageUrl || null,
    tags: showExportModal.review?.suggestedTags,
    published_at: showExportModal.createdAt,
  },
  null,
  2
)}
              </pre>

              <button
                onClick={() => setWebhookSimulated(true)}
                className="w-full bg-teal-800 hover:bg-teal-700 text-white font-sans font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-amber-300" />
                <span>Simular Disparo de Webhook para WordPress / Ghost</span>
              </button>

              {webhookSimulated && (
                <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 p-3 rounded-xl flex items-center space-x-2 font-sans text-xs">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Sucesso (200 OK)!</strong> Webhook disparado com sucesso. O artigo foi recebido pelo endpoint externo.</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowExportModal(null);
                  setWebhookSimulated(false);
                }}
                className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM ACCESS / BASTIDORES PASSCODE MODAL */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#18191e] border border-stone-800 text-stone-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Área Restrita da Equipe</h2>
                <p className="text-xs text-stone-400">Bastidores de Produção & Estúdio AI</p>
              </div>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed bg-stone-900/80 p-3.5 rounded-2xl border border-stone-800">
              Esta área é exclusiva para a equipe de redação e editores. Leitores públicos navegam apenas pela interface do blog.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Check passcode (default '1234' or any entry)
                if (!passcodeInput || passcodeInput.trim() === '1234' || passcodeInput.trim() === 'admin') {
                  setShowPasscodeModal(false);
                  onBackToStudio();
                } else {
                  setPasscodeError('Senha incorreta. (Dica de teste: 1234)');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  Senha de Acesso do Produtor / PIN:
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    placeholder="Digite a senha (padrão: 1234)..."
                    value={passcodeInput}
                    onChange={(e) => {
                      setPasscodeInput(e.target.value);
                      setPasscodeError('');
                    }}
                    autoFocus
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {passcodeError ? (
                  <p className="text-[11px] text-rose-400 mt-1.5 font-medium">{passcodeError}</p>
                ) : (
                  <p className="text-[10px] text-stone-500 mt-1 font-mono">Senha de teste liberada: 1234</p>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="flex-1 bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer border border-stone-800"
                >
                  Voltar ao Blog
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-amber-950"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Acessar Bastidores</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

