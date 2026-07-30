import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  X,
  Globe,
  EyeOff,
  Zap,
} from 'lucide-react';
import { ArticlePost } from '../types';
import { BLOG_CATEGORIES, BlogCategory, suggestCategory } from '../data/blogCategories';

interface SupabaseStatus {
  url?: string;
  table?: string;
  totalPosts: number;
  publishedPosts: number;
}

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleToPublish?: ArticlePost | null;
  authorName?: string;
  onArticlePublished?: (articleId: string, slug: string) => void;
  onArticleUnpublished?: (articleId: string) => void;
  theme: 'light' | 'dark';
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  articleToPublish,
  authorName,
  onArticlePublished,
  onArticleUnpublished,
  theme,
}) => {
  const isDark = theme === 'dark';

  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [category, setCategory] = useState<BlogCategory>('AI & Neural');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkStatus = async () => {
    setChecking(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      } else {
        setStatusError(data.error || 'Não foi possível falar com o Supabase.');
      }
    } catch (err: any) {
      setStatusError(err.message || 'Erro de rede ao consultar o Supabase.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    checkStatus();
    if (articleToPublish) {
      setCategory(suggestCategory(articleToPublish));
    }
  }, [isOpen, articleToPublish?.id]);

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!articleToPublish) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch('/api/supabase/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: articleToPublish,
          category,
          authorName,
          status: 'published',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: data.message });
        onArticlePublished?.(articleToPublish.id, data.slug);
        checkStatus();
      } else {
        setResult({ success: false, message: data.error || 'Falha ao publicar.' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Erro ao publicar artigo.' });
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!articleToPublish?.publishedSlug) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch('/api/supabase/unpublish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: articleToPublish.publishedSlug }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: data.message });
        onArticleUnpublished?.(articleToPublish.id);
        checkStatus();
      } else {
        setResult({ success: false, message: data.error || 'Falha ao despublicar.' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Erro ao despublicar artigo.' });
    } finally {
      setPublishing(false);
    }
  };

  const isLive = !!articleToPublish?.publishedSlug;
  const articleTitle =
    articleToPublish?.review?.revisedTitle || articleToPublish?.draft?.title || articleToPublish?.topic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border shadow-xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0e131f] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-extrabold text-base">Publicar no Blog</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Envia o artigo para o Supabase — o blog público lê de lá
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Connection status */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
              statusError
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {statusError ? (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {statusError ? (
                  statusError
                ) : status ? (
                  <>
                    Conectado a <strong>{status.url?.replace('https://', '').split('.')[0]}</strong> · tabela{' '}
                    <strong>{status.table}</strong> · {status.publishedPosts} publicado(s) de {status.totalPosts}
                  </>
                ) : (
                  'Verificando conexão...'
                )}
              </div>
            </div>

            <button
              onClick={checkStatus}
              disabled={checking}
              className="shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50"
              title="Reverificar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {articleToPublish ? (
            <>
              {/* Selected article */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#121827] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider">
                    Artigo Selecionado
                  </span>
                  {isLive && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 uppercase font-bold">
                      No ar
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{articleTitle}</h4>
                {articleToPublish.review?.revisedSubtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {articleToPublish.review.revisedSubtitle}
                  </p>
                )}
                {isLive && (
                  <p className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] font-mono text-slate-400">
                    URL: <span className="text-emerald-500">/{articleToPublish.publishedSlug}</span>
                    <span className="ml-2">· republicar atualiza este mesmo endereço</span>
                  </p>
                )}
              </div>

              {/* Category picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Categoria no Blog
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BlogCategory)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono cursor-pointer transition-colors ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {BLOG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 font-mono">
                  Define em qual filtro o artigo aparece no blog. Sugerida a partir das tags da revisão.
                </p>
              </div>

              {/* Result banner */}
              {result && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                    result.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 leading-relaxed">{result.message}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePublish}
                  disabled={publishing || !!statusError}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {publishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      {isLive ? <Send className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current text-emerald-200" />}
                      <span>{isLive ? 'Atualizar Artigo no Ar' : 'Publicar no Blog'}</span>
                    </>
                  )}
                </button>

                {isLive && (
                  <button
                    onClick={handleUnpublish}
                    disabled={publishing}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    title="Tira do ar sem apagar o registro"
                  >
                    <EyeOff className="w-4 h-4" />
                    <span>Despublicar</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs space-y-2">
              <Globe className="w-8 h-8 mx-auto text-slate-400" />
              <p>
                Nenhum artigo selecionado. Abra um artigo concluído e use{' '}
                <strong>Publicar no Blog</strong> para enviá-lo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
