import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Send,
  X,
  Code2,
  Globe,
  Settings2,
  Zap
} from 'lucide-react';
import { ArticlePost } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  isEnabled: boolean;
}

const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://nxutdbhcedjcdfvsbrzt.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXRkYmhjZWRqY2RmdnNicnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjE3MTksImV4cCI6MjEwMDg5NzcxOX0.MrtdwZLjrB0meK9dAeiudcYmhQasWLFVCp7mbPMkYzc',
  tableName: 'posts',
  isEnabled: true,
};

export const getStoredSupabaseConfig = (): SupabaseConfig => {
  try {
    const saved = localStorage.getItem('tech_studio_supabase_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading Supabase config', e);
  }
  return DEFAULT_SUPABASE_CONFIG;
};

export const saveSupabaseConfig = (config: SupabaseConfig) => {
  try {
    localStorage.setItem('tech_studio_supabase_config', JSON.stringify(config));
  } catch (e) {
    console.error('Error saving Supabase config', e);
  }
};

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleToPublish?: ArticlePost | null;
  onArticlePublished?: (articleId: string) => void;
  theme: 'light' | 'dark';
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  articleToPublish,
  onArticlePublished,
  theme,
}) => {
  const isDark = theme === 'dark';

  const [config, setConfig] = useState<SupabaseConfig>(DEFAULT_SUPABASE_CONFIG);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'publish' | 'credentials' | 'sql'>('publish');

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredSupabaseConfig();
      setConfig(stored);
      setTestResult(null);
      setPublishResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveSupabaseConfig(config);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      saveSupabaseConfig(config);
      const res = await fetch('/api/supabase/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: config.url,
          supabaseKey: config.anonKey,
          tableName: config.tableName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Conexão bem-sucedida com o Supabase! Tabela '${config.tableName}' pronta para receber artigos.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Não foi possível conectar. Verifique se a tabela existe no Supabase.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erro de rede ao conectar ao Supabase.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePublishArticle = async () => {
    if (!articleToPublish) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      saveSupabaseConfig(config);
      const res = await fetch('/api/supabase/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: articleToPublish,
          supabaseUrl: config.url,
          supabaseKey: config.anonKey,
          tableName: config.tableName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPublishResult({
          success: true,
          message: `Artigo "${articleToPublish.review?.revisedTitle || articleToPublish.draft?.title}" publicado com sucesso no Supabase!`,
        });
        if (onArticlePublished) {
          onArticlePublished(articleToPublish.id);
        }
      } else {
        setPublishResult({
          success: false,
          message: data.error || 'Falha ao publicar no Supabase.',
        });
      }
    } catch (err: any) {
      setPublishResult({
        success: false,
        message: err.message || 'Erro ao publicar artigo.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const sqlSchemaCode = `-- Copie e cole no Editor SQL do seu projeto Supabase (${config.url}):

create table if not exists ${config.tableName || 'posts'} (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  slug text unique,
  content text not null,
  summary text,
  cover_image text,
  author text,
  tags text[],
  reading_time_minutes integer,
  published_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  raw_json jsonb
);

-- Ativar leitura pública RLS (Row Level Security)
alter table ${config.tableName || 'posts'} enable row level security;

create policy "Permitir leitura pública"
  on ${config.tableName || 'posts'} for select
  using (true);

create policy "Permitir inserção e atualização com chave anon"
  on ${config.tableName || 'posts'} for insert
  with check (true);

create policy "Permitir atualização com chave anon"
  on ${config.tableName || 'posts'} for update
  using (true);
`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border shadow-xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0e131f] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-extrabold text-base flex items-center space-x-2">
                <span>Publicação Via Supabase</span>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase">
                  Ativo
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Conexão direta com a tabela do seu outro blog no Supabase
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

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 text-xs font-mono">
          <button
            onClick={() => setActiveTab('publish')}
            className={`py-3 px-4 border-b-2 font-bold cursor-pointer transition-colors flex items-center space-x-2 ${
              activeTab === 'publish'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publicar Artigo</span>
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-4 border-b-2 font-bold cursor-pointer transition-colors flex items-center space-x-2 ${
              activeTab === 'credentials'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Credenciais & Tabela</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-4 border-b-2 font-bold cursor-pointer transition-colors flex items-center space-x-2 ${
              activeTab === 'sql'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SQL da Tabela</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'publish' && (
            <div className="space-y-4">
              {articleToPublish ? (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#121827] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider block mb-1">
                    Artigo Selecionado para Envio
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {articleToPublish.review?.revisedTitle || articleToPublish.draft?.title}
                  </h4>
                  {articleToPublish.review?.revisedSubtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {articleToPublish.review.revisedSubtitle}
                    </p>
                  )}
                  <div className="mt-3 flex items-center space-x-4 text-[11px] font-mono text-slate-400 border-t pt-2 border-slate-200/50 dark:border-slate-800/50">
                    <span>Autor: {articleToPublish.authorName || 'Redação'}</span>
                    <span>•</span>
                    <span>Tabela Destino: <strong className="text-emerald-400">{config.tableName}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs">
                  Nenhum artigo específico selecionado no momento. Você pode testar a conexão com o Supabase ou enviar um artigo abrindo a tela de resultados.
                </div>
              )}

              {/* Status Banner */}
              {publishResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                    publishResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {publishResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 leading-relaxed">{publishResult.message}</div>
                </div>
              )}

              {/* Publish CTA Button */}
              {articleToPublish && (
                <button
                  onClick={handlePublishArticle}
                  disabled={publishing}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {publishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando para Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current text-emerald-200" />
                      <span>Publicar Agora no Supabase ({config.url.replace('https://', '').split('.')[0]})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  URL do Projeto Supabase
                </label>
                <input
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://sua-id-projeto.supabase.co"
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-colors ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Chave Pública (Anon Key)
                </label>
                <textarea
                  rows={2}
                  value={config.anonKey}
                  onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1Ni..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-colors ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Nome da Tabela de Artigos
                </label>
                <input
                  type="text"
                  value={config.tableName}
                  onChange={(e) => setConfig({ ...config, tableName: e.target.value })}
                  placeholder="posts"
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-colors ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  Standard: <code className="text-emerald-500">posts</code> ou <code className="text-emerald-500">articles</code>
                </p>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{testResult.message}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold cursor-pointer"
                >
                  Salvar Configuração
                </button>

                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testando...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Testar Conexão Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se o seu outro site ainda não possui a tabela de posts no Supabase, crie-a no painel do Supabase (<strong className="text-emerald-500">SQL Editor</strong>) executando o código abaixo:
              </p>

              <div className="relative rounded-xl border border-slate-800 bg-[#070a12] p-4 text-xs font-mono text-slate-200">
                <button
                  onClick={copySqlToClipboard}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
                <pre className="overflow-x-auto text-[11px] leading-relaxed pr-20">
                  <code>{sqlSchemaCode}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
