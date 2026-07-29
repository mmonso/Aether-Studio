import React, { useState } from 'react';
import { ArticlePost } from '../types';
import { BookOpen, Search, Trash2, Calendar, Sparkles, Eye, Tag, Copy, Clock, ArrowUpDown, Database, Zap } from 'lucide-react';

interface ArticleHistoryTabProps {
  posts: ArticlePost[];
  onSelectPost: (post: ArticlePost) => void;
  onDeletePost: (id: string) => void;
  onClonePost?: (post: ArticlePost) => void;
  onOpenSupabaseSync?: (post: ArticlePost) => void;
  onStartNewPost: () => void;
}

export const ArticleHistoryTab: React.FC<ArticleHistoryTabProps> = ({
  posts,
  onSelectPost,
  onDeletePost,
  onClonePost,
  onOpenSupabaseSync,
  onStartNewPost,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('Todos');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'readingTime'>('recent');

  // Dynamic tags derived from existing posts
  const availableTags = Array.from(
    new Set(
      posts.flatMap((p) => p.tags || p.review?.suggestedTags || [])
    )
  );
  const tagFilters = ['Todos', ...availableTags];

  const filteredPosts = posts.filter((post) => {
    const postTags = post.tags || post.review?.suggestedTags || [];
    const matchesTag =
      selectedTag === 'Todos' ||
      postTags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()) ||
      post.topic.toLowerCase().includes(selectedTag.toLowerCase());

    const titleStr = post.review?.revisedTitle || post.draft?.title || post.topic;
    const textStr = post.review?.revisedText || post.draft?.rawText || '';

    const matchesSearch =
      post.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      titleStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      textStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      postTags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTag && matchesSearch;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortOrder === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortOrder === 'readingTime') {
      const timeA = a.review?.readingTimeMinutes || 4;
      const timeB = b.review?.readingTimeMinutes || 4;
      return timeB - timeA;
    }
    // Default 'recent'
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#18191e] rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center space-x-2 text-stone-900 dark:text-stone-100 font-bold text-lg sm:text-xl">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2>Histórico de Artigos ({posts.length})</h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Organize por temas (Ansiedade, Luto, Clínica, Relacionamentos), edite diretamente ou exporte em PDF.
          </p>
        </div>

        <button
          onClick={onStartNewPost}
          className="w-full sm:w-auto px-4 py-2.5 bg-teal-800 dark:bg-amber-400 hover:bg-teal-900 dark:hover:bg-amber-500 text-white dark:text-stone-950 font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer min-h-[40px]"
        >
          <Sparkles className="w-4 h-4 text-amber-300 dark:text-stone-950" />
          <span>Criar Novo Artigo</span>
        </button>
      </div>

      {/* Search & Tag Filter Bar */}
      {posts.length > 0 && (
        <div className="bg-white dark:bg-[#18191e] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-3 transition-colors">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por tema, palavra-chave ou título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Sort Order Dropdown */}
            <div className="flex items-center space-x-1.5 w-full sm:w-auto shrink-0 justify-end">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sortOrder}
                onChange={(e: any) => setSortOrder(e.target.value)}
                className="bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-2 text-xs text-stone-800 dark:text-stone-200 font-medium focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="recent">Mais Recentes Primeiro</option>
                <option value="oldest">Mais Antigos Primeiro</option>
                <option value="readingTime">Maior Tempo de Leitura</option>
              </select>
            </div>
          </div>

          {/* Tags Pills Filter */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-1" />
            {tagFilters.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-amber-600 dark:bg-amber-400 text-white dark:text-stone-950 font-semibold shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Posts List */}
      {sortedPosts.length === 0 ? (
        <div className="bg-stone-50 dark:bg-[#18191e] rounded-2xl p-8 sm:p-12 text-center border border-dashed border-stone-300 dark:border-stone-800 space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-500 dark:text-stone-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-stone-800 dark:text-stone-200 text-base">Nenhum artigo encontrado</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              {posts.length === 0
                ? 'Você ainda não gerou nenhum artigo nesta sessão. Crie seu primeiro artigo com a equipe virtual!'
                : 'Nenhum artigo corresponde aos filtros e busca selecionados.'}
            </p>
          </div>
          {posts.length === 0 && (
            <button
              onClick={onStartNewPost}
              className="px-5 py-2.5 bg-teal-800 dark:bg-amber-400 text-white dark:text-stone-950 font-semibold text-xs rounded-xl shadow-xs cursor-pointer min-h-[40px]"
            >
              Criar Primeiro Artigo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedPosts.map((post) => {
            const title = post.review?.revisedTitle || post.draft?.title || post.topic;
            const subtitle = post.review?.revisedSubtitle || post.draft?.subtitle || '';
            const dateStr = new Date(post.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const postTags = post.tags || post.review?.suggestedTags || [];
            const readTime = post.review?.readingTimeMinutes || 4;

            return (
              <div
                key={post.id}
                className="bg-white dark:bg-[#18191e] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden hover:border-teal-300 dark:hover:border-amber-400 transition-all flex flex-col justify-between group"
              >
                {/* Image Cover if exists */}
                {post.image?.imageUrl && (
                  <div className="h-40 overflow-hidden relative border-b border-stone-100 dark:border-stone-800">
                    <img
                      src={post.image.imageUrl}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2 bg-stone-900/80 backdrop-blur-md text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{readTime} min de leitura</span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        <span>{dateStr}</span>
                      </span>
                      <span>•</span>
                      <span className="text-teal-700 dark:text-amber-300 font-semibold">{post.tone}</span>
                    </div>

                    <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 group-hover:text-teal-800 dark:group-hover:text-amber-300 transition-colors line-clamp-2">
                      {title}
                    </h3>

                    {subtitle && (
                      <p className="text-xs text-stone-600 dark:text-stone-400 italic line-clamp-2 font-serif">{subtitle}</p>
                    )}

                    {/* Tag Badges */}
                    {postTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {postTags.map((tag, idx) => (
                          <span
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(tag);
                            }}
                            className="bg-stone-100 dark:bg-stone-900 hover:bg-amber-100 dark:hover:bg-amber-950 hover:text-amber-900 dark:hover:text-amber-300 text-stone-600 dark:text-stone-300 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all cursor-pointer border border-stone-200/50 dark:border-stone-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800 text-xs gap-1">
                    <button
                      onClick={() => onSelectPost(post)}
                      className="px-3 py-1.5 bg-teal-50 dark:bg-stone-900 hover:bg-teal-100 dark:hover:bg-stone-800 text-teal-800 dark:text-teal-300 font-semibold rounded-lg flex items-center space-x-1 transition-all cursor-pointer min-h-[36px] border border-teal-100 dark:border-stone-800"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver & Exportar</span>
                    </button>

                    {onOpenSupabaseSync && (
                      <button
                        onClick={() => onOpenSupabaseSync(post)}
                        className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg flex items-center space-x-1 transition-all cursor-pointer min-h-[36px] border border-emerald-200/60 dark:border-emerald-800"
                        title="Enviar para Supabase"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                        <span className="hidden sm:inline">Supabase</span>
                      </button>
                    )}

                    {onClonePost && (
                      <button
                        onClick={() => onClonePost(post)}
                        className="px-2.5 py-1.5 bg-stone-100 dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold rounded-lg flex items-center space-x-1 transition-all cursor-pointer min-h-[36px] border border-stone-200/50 dark:border-stone-800"
                        title="Duplicar este artigo para criar uma versão alternativa"
                      >
                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                        <span className="hidden sm:inline">Clonar</span>
                      </button>
                    )}

                    <button
                      onClick={() => onDeletePost(post.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
