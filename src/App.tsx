import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CreatePostTab } from './components/CreatePostTab';
import { PipelineTracker } from './components/PipelineTracker';
import { ArticleResultView } from './components/ArticleResultView';
import { ManifestoEditor } from './components/ManifestoEditor';
import { ArticleHistoryTab } from './components/ArticleHistoryTab';
import { VirtualTeamInfo } from './components/VirtualTeamInfo';
import { BlogManagerModal } from './components/BlogManagerModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { ToastContainer, ToastMessage } from './components/Toast';

import {
  PostGenerationInput,
  ArticlePost,
  UserManifesto,
  Blog,
  FactCheckReport,
} from './types';
import {
  DEFAULT_USER_MANIFESTO,
  fetchBlogs,
  saveBlog,
  deleteBlog,
  buildNewBlog,
  getActiveBlogId,
  setActiveBlogId as persistActiveBlogId,
  saveManifesto,
  fetchArticles,
  saveArticle,
  deleteArticle,
} from './lib/storage';
import { downloadBackup } from './lib/backup';
import { VISUAL_STYLES } from './data/presetApproaches';
import { PRESET_BLOGS } from './data/presetBlogs';
import { stripDuplicateTitleHeading } from './lib/markdown';
import {
  runPipeline,
  browserCallApi,
  PipelineStepError,
  PipelineRejection,
  PIPELINE_STEPS,
  type PipelineStep,
  type StepPayloads,
} from './lib/pipeline';

export default function App() {
  const [activeTab, setActiveTab] = useState<'create' | 'manifesto' | 'history' | 'team'>('create');

  // Theme state ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('psicocontent_theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('psicocontent_theme', next);
      return next;
    });
  };

  const isDark = theme === 'dark';

  // Multi-Blog & Storage state
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [activeBlogId, setActiveBlogId] = useState<string>('');
  const [posts, setPosts] = useState<ArticlePost[]>([]);
  const [manifesto, setManifesto] = useState<UserManifesto>(DEFAULT_USER_MANIFESTO);
  /** Falso até os dados chegarem do Supabase. Evita salvar por cima do que
   *  ainda não foi carregado. */
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isBlogManagerOpen, setIsBlogManagerOpen] = useState<boolean>(false);

  // Supabase Sync state
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [articleForSupabase, setArticleForSupabase] = useState<ArticlePost | null>(null);

  const handleOpenSupabaseModal = (post?: ArticlePost) => {
    setArticleForSupabase(post || currentPost || null);
    setIsSupabaseModalOpen(true);
  };

  /**
   * Grava o artigo na lista local e persiste no Supabase.
   *
   * A tela atualiza na hora e a escrita corre atrás. É o oposto de esperar a
   * rede a cada tecla — e uma falha não some em silêncio: vira toast.
   *
   * Antes isto era `savePostToStorage`, síncrono, devolvendo a lista inteira
   * já atualizada. Com a persistência na rede, o estado local passa a ser a
   * fonte da tela e o banco, a fonte da verdade.
   */
  const persistArticle = (article: ArticlePost) => {
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === article.id);
      return exists ? prev.map((p) => (p.id === article.id ? article : p)) : [article, ...prev];
    });

    saveArticle(article).catch((err: any) => {
      addToast(
        'error',
        'O artigo não foi salvo',
        err?.message || 'A alteração está só nesta tela. Tente de novo.'
      );
    });
  };

  // Guarda o slug publicado no post local: é ele que mantém a URL estável
  // e faz a republicação atualizar a linha existente no Supabase.
  const applyPublishState = (articleId: string, changes: Partial<ArticlePost>) => {
    setPosts((prev) => {
      const target = prev.find((p) => p.id === articleId);
      if (!target) return prev;
      const updated = { ...target, ...changes, updatedAt: new Date().toISOString() };
      saveArticle(updated).catch((err: any) =>
        addToast('error', 'O artigo não foi salvo', err?.message || 'A alteração está só nesta tela.')
      );
      setCurrentPost((cur) => (cur?.id === articleId ? updated : cur));
      setArticleForSupabase((cur) => (cur?.id === articleId ? updated : cur));
      return prev.map((p) => (p.id === articleId ? updated : p));
    });
  };

  const handleArticlePublished = (articleId: string, slug: string) => {
    applyPublishState(articleId, {
      publishedSlug: slug,
      isPublished: true,
      publishedAt: new Date().toISOString(),
    });
    addToast('success', 'Artigo no ar!', 'Já está visível no blog público.');
  };

  const handleArticleUnpublished = (articleId: string) => {
    applyPublishState(articleId, { isPublished: false });
    addToast('info', 'Artigo removido do ar', 'O registro continua salvo como rascunho no Supabase.');
  };

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Active generation / viewing state
  const [currentPost, setCurrentPost] = useState<ArticlePost | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);

  // Load blogs, active workspace and article history on mount
  /**
   * Carga inicial, vinda do Supabase pelo backend.
   *
   * Antes era leitura síncrona do localStorage. A troca é o coração da fase 1:
   * o Studio deixa de depender de um navegador específico para saber quais
   * blogs existem e o que já foi escrito.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedBlogs = await fetchBlogs();
        if (cancelled) return;

        // O blog ativo é preferência local; se apontar para um blog que não
        // existe mais (apagado noutra máquina), cai no primeiro.
        const savedId = getActiveBlogId();
        const resolvedId =
          loadedBlogs.find((b) => b.id === savedId)?.id || loadedBlogs[0]?.id || '';

        const loadedArticles = resolvedId ? await fetchArticles(resolvedId) : [];
        if (cancelled) return;

        setBlogs(loadedBlogs);
        setActiveBlogId(resolvedId);
        setManifesto(
          loadedBlogs.find((b) => b.id === resolvedId)?.manifesto || DEFAULT_USER_MANIFESTO
        );
        setPosts(loadedArticles);
      } catch (err: any) {
        if (!cancelled) {
          addToast(
            'error',
            'Não foi possível carregar seus dados',
            err?.message || 'Verifique se o Supabase está acessível.'
          );
        }
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeBlog: Blog = blogs.find((b) => b.id === activeBlogId) || blogs[0] || {
    id: 'default',
    name: 'Meu Blog',
    niche: 'Geral',
    description: 'Blog de produção de conteúdo',
    authorName: 'Autor(a)',
    professionalTitle: 'Especialista',
    manifesto: manifesto,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * Baixa blogs, manifestos e rascunhos em JSON.
   *
   * Hoje o localStorage é a única cópia disso: limpar o navegador, trocar de
   * máquina ou usar outro perfil apaga tudo (achado #8). Enquanto a migração
   * para o Supabase não acontece, este botão é a única saída — e depois dela,
   * é o seguro contra a própria migração.
   */
  const handleExportBackup = () => {
    try {
      const summary = downloadBackup();
      addToast(
        'success',
        'Histórico exportado',
        `${summary.blogs} blog(s) e ${summary.posts} artigo(s) salvos no arquivo.`
      );
    } catch (err: any) {
      addToast('error', 'Falha ao exportar', err?.message || 'Não foi possível gerar o arquivo.');
    }
  };

  // Switch Active Blog. Troca de workspace: recarrega o histórico daquele blog.
  const handleSelectBlog = async (id: string, silent = false) => {
    persistActiveBlogId(id);
    setActiveBlogId(id);
    setCurrentPost(null);

    const selectedBlog = blogs.find((b) => b.id === id);
    setManifesto(selectedBlog?.manifesto || DEFAULT_USER_MANIFESTO);

    try {
      setPosts(await fetchArticles(id));
    } catch (err: any) {
      addToast('error', 'Falha ao carregar o histórico', err?.message || '');
    }

    if (selectedBlog && !silent) {
      addToast('info', `Workspace alterado: ${selectedBlog.name}`, `Nicho: ${selectedBlog.niche}`);
    }
  };

  // Create New Blog
  const handleCreateBlog = async (
    name: string,
    niche: string,
    description: string,
    authorName: string,
    professionalTitle: string,
    badgeColor: 'teal' | 'indigo' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan',
    presetTemplateId?: string
  ) => {
    try {
      const template =
        PRESET_BLOGS.find((p) => p.id === presetTemplateId)?.manifesto || DEFAULT_USER_MANIFESTO;

      const newBlog = buildNewBlog(name, niche, description, {
        ...template,
        authorName,
        professionalTitle,
      });
      newBlog.badgeColor = badgeColor;

      await saveBlog(newBlog);

      const refreshed = await fetchBlogs();
      setBlogs(refreshed);
      persistActiveBlogId(newBlog.id);
      setActiveBlogId(newBlog.id);
      setManifesto(newBlog.manifesto);
      setPosts([]);
      setCurrentPost(null);

      addToast('success', 'Novo blog criado com sucesso!', `Equipe virtual de "${name}" ativada.`);
    } catch (err: any) {
      addToast('error', 'Não foi possível criar o blog', err?.message || '');
    }
  };

  // Update Blog
  const handleUpdateBlog = async (updatedBlog: Blog) => {
    try {
      await saveBlog(updatedBlog);
      setBlogs((prev) => prev.map((b) => (b.id === updatedBlog.id ? updatedBlog : b)));
      if (updatedBlog.id === activeBlogId) {
        setManifesto(updatedBlog.manifesto);
      }
      addToast('success', 'Dados do blog atualizados!');
    } catch (err: any) {
      addToast('error', 'Não foi possível salvar o blog', err?.message || '');
    }
  };

  // Delete Blog
  const handleDeleteBlog = async (id: string) => {
    try {
      await deleteBlog(id);
      const remaining = blogs.filter((b) => b.id !== id);
      setBlogs(remaining);

      if (remaining.length > 0) {
        await handleSelectBlog(remaining[0].id, true);
      } else {
        setActiveBlogId('');
        setPosts([]);
      }
      addToast('info', 'Blog excluído.');
    } catch (err: any) {
      // O backend recusa apagar blog com artigo publicado — apagar em cascata
      // levaria junto conteúdo que está no ar.
      addToast('error', 'Não foi possível excluir', err?.message || '');
    }
  };

  // Save Manifesto for Active Blog
  const handleSaveManifesto = async (updated: UserManifesto) => {
    const blog = blogs.find((b) => b.id === activeBlogId);
    if (!blog) return;

    try {
      const savedBlog = await saveManifesto(blog, updated);
      setManifesto(updated);
      setBlogs((prev) => prev.map((b) => (b.id === activeBlogId ? savedBlog : b)));
      addToast(
        'success',
        'Linha editorial salva!',
        `Visão de mundo do blog "${savedBlog.name}" foi atualizada.`
      );
    } catch (err: any) {
      addToast('error', 'Não foi possível salvar a linha editorial', err?.message || '');
    }
  };

  /**
   * Produz um artigo do início ao fim.
   *
   * A orquestração mora em `lib/pipeline.ts` e é a MESMA que o worker headless
   * executa — aqui só se define o transporte (fetch relativo) e o que fazer a
   * cada etapa concluída. Antes eram ~190 linhas de `fetch` encadeado neste
   * arquivo, com um único `catch` no fim que jogava fora todo o trabalho pago.
   */
  const handleStartPipeline = async (input: PostGenerationInput) => {
    setIsGenerating(true);

    const STEP_STATUS: Record<PipelineStep, ArticlePost['status']> = {
      factcheck: 'researching',
      draft: 'drafting',
      review: 'reviewing',
      audit: 'auditing',
      image: 'generating_image',
    };

    let article: ArticlePost = {
      id: crypto.randomUUID(),
      blogId: activeBlog.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      topic: input.topic,
      tone: manifesto.toneOfVoice,
      depthLevel: input.depthLevel,
      targetAudience: input.targetAudience,
      input,
      status: input.enableFactCheck ? 'researching' : 'drafting',
    };
    setCurrentPost(article);

    /** Reflete os payloads no ArticlePost e persiste. */
    const applyPayloads = (payloads: StepPayloads, status: ArticlePost['status']) => {
      article = {
        ...article,
        factCheck: payloads.factcheck ?? undefined,
        draft: payloads.draft,
        review: payloads.review,
        audit: payloads.audit,
        image: payloads.image,
        status,
        updatedAt: new Date().toISOString(),
      };
      setCurrentPost(article);
      persistArticle(article);
    };

    try {
      const payloads = await runPipeline({
        context: {
          input,
          blogName: activeBlog.name,
          blogNiche: activeBlog.niche,
          manifesto,
          visualStyle: VISUAL_STYLES.find((s) => s.id === input.visualStyle) || VISUAL_STYLES[0],
          // No Studio a triagem informa, não barra: você está na frente da tela
          // e é a instância de aprovação. Quem precisa do veto automático é o
          // worker, que roda de madrugada sem ninguém para julgar.
          audit: { rejectOnFailure: false },
        },
        callApi: browserCallApi,
        onStepStart: (step) => setCurrentPost((cur) => (cur ? { ...cur, status: STEP_STATUS[step] } : cur)),
        // Gravar ANTES de avançar é o que torna a retomada possível: uma falha
        // na revisão não custa o rascunho de novo.
        onStepComplete: (step, payloads) => {
          const nextIndex = PIPELINE_STEPS.indexOf(step) + 1;
          const nextStep = PIPELINE_STEPS[nextIndex];
          applyPayloads(payloads, nextStep ? STEP_STATUS[nextStep] : 'completed');
        },
      });

      applyPayloads(payloads, 'completed');
    } catch (err: any) {
      // O que já foi produzido vem junto no erro e é salvo — é o que permite
      // retomar em vez de repagar.
      if (err instanceof PipelineRejection) {
        // Não deveria chegar aqui com `rejectOnFailure: false`, mas se a
        // política mudar, reprovado continua sendo resultado — nunca erro.
        applyPayloads(err.payloads, 'rejected');
        addToast('error', 'Reprovado na triagem', err.report.reason || '');
      } else if (err instanceof PipelineStepError) {
        applyPayloads(err.payloads, 'error');
        article = { ...article, errorMessage: err.message };
        setCurrentPost(article);
        persistArticle(article);
        addToast('error', `Falha na etapa "${err.step}"`, err.message);
      } else {
        setCurrentPost((cur) =>
          cur ? { ...cur, status: 'error', errorMessage: err?.message } : cur
        );
        addToast('error', 'Falha ao processar o artigo', err?.message || '');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate image
  const handleRegenerateImage = async (styleId: string) => {
    if (!currentPost || isRegeneratingImage) return;

    setIsRegeneratingImage(true);
    const selectedStyle = VISUAL_STYLES.find((s) => s.id === styleId) || VISUAL_STYLES[0];
    const title = currentPost.review?.revisedTitle || currentPost.draft?.title || currentPost.topic;
    const summary = currentPost.review?.metaDescription || currentPost.draft?.subtitle || title;

    try {
      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          visualStyle: selectedStyle.name,
          promptModifier: selectedStyle.promptModifier,
        }),
      });

      const imgData = await imgRes.json();
      if (imgData.success && imgData.data) {
        const updatedPost: ArticlePost = {
          ...currentPost,
          image: imgData.data,
          updatedAt: new Date().toISOString(),
        };
        setCurrentPost(updatedPost);
        persistArticle(updatedPost);
      }
    } catch (e) {
      console.error('Error regenerating image:', e);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  // Handle post updates from Result view (e.g. text edits)
  const handlePostUpdated = (updated: ArticlePost) => {
    setCurrentPost(updated);
    persistArticle(updated);
    addToast('success', 'Artigo salvo!', 'As alterações no texto e metadados foram salvas.');
  };

  // Handle clone post
  const handleClonePost = (postToClone: ArticlePost) => {
    const clonedTitle = postToClone.review?.revisedTitle
      ? `${postToClone.review.revisedTitle} (Cópia)`
      : `${postToClone.topic} (Cópia)`;

    const clonedPost: ArticlePost = {
      ...postToClone,
      id: `post_${Date.now()}`,
      blogId: activeBlog.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      topic: `${postToClone.topic} (Cópia)`,
      review: postToClone.review
        ? {
            ...postToClone.review,
            revisedTitle: clonedTitle,
          }
        : undefined,
      draft: postToClone.draft
        ? {
            ...postToClone.draft,
            title: `${postToClone.draft.title} (Cópia)`,
          }
        : undefined,
    };

    persistArticle(clonedPost);
    setCurrentPost(clonedPost);
    setActiveTab('create');
    addToast('success', 'Artigo duplicado com sucesso!', 'Uma cópia pronta para novas edições foi carregada.');
  };

  // Handle delete post from history
  const handleDeletePost = (id: string) => {
    if (window.confirm('Excluir este artigo do histórico?')) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      deleteArticle(id).catch((err: any) =>
        addToast('error', 'O artigo não foi removido do banco', err?.message || '')
      );
      if (currentPost?.id === id) {
        setCurrentPost(null);
      }
      addToast('info', 'Artigo excluído do histórico');
    }
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 selection:bg-teal-500/20 selection:text-teal-300 ${
      isDark ? 'bg-[#090d16] text-slate-100 dark' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Blog Manager Modal */}
      <BlogManagerModal
        isOpen={isBlogManagerOpen}
        onClose={() => setIsBlogManagerOpen(false)}
        blogs={blogs}
        activeBlogId={activeBlog.id}
        onSelectBlog={handleSelectBlog}
        onCreateBlog={handleCreateBlog}
        onUpdateBlog={handleUpdateBlog}
        onDeleteBlog={handleDeleteBlog}
      />

      {/* Supabase Sync Modal */}
      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        articleToPublish={articleForSupabase}
        authorName={manifesto.authorName}
        onArticlePublished={handleArticlePublished}
        onArticleUnpublished={handleArticleUnpublished}
        theme={theme}
      />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // Reset current active view if going back to create
          if (tab === 'create' && !isGenerating && currentPost?.status === 'completed') {
            setCurrentPost(null);
          }
        }}
        savedCount={posts.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeBlog={activeBlog}
        blogs={blogs}
        onSelectBlog={handleSelectBlog}
        onOpenBlogManager={() => setIsBlogManagerOpen(true)}
        onOpenSupabaseModal={() => handleOpenSupabaseModal()}
        onExportBackup={handleExportBackup}
      />

      {/* Main Container */}
      <main className="flex-1 lg:pl-64 xl:pl-72 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
        
        {/* VIEW 1: CREATE TAB */}
        {activeTab === 'create' && (
          <div>
            {/* If pipeline is currently running */}
            {isGenerating && currentPost && (
              <PipelineTracker
                status={currentPost.status}
                errorMessage={currentPost.errorMessage}
                factCheckResult={currentPost.factCheck}
                draftResult={currentPost.draft}
                reviewResult={currentPost.review}
                auditResult={currentPost.audit}
                imageResult={currentPost.image}
                authorName={manifesto.authorName}
                topic={currentPost.topic}
                isNewsMode={currentPost.input?.enableFactCheck || activeBlog.id === 'blog_jornalismo_noticias'}
              />
            )}

            {/* If pipeline completed or ready for preview */}
            {!isGenerating && currentPost && currentPost.status === 'completed' && (
              <ArticleResultView
                post={currentPost}
                manifesto={manifesto}
                onPostUpdated={handlePostUpdated}
                onRegenerateImage={handleRegenerateImage}
                onClonePost={handleClonePost}
                onOpenSupabaseSync={(post) => handleOpenSupabaseModal(post)}
                addToast={addToast}
                isRegeneratingImage={isRegeneratingImage}
              />
            )}

            {/* Default Form Input View */}
            {!isGenerating && (!currentPost || currentPost.status === 'error') && (
              <CreatePostTab
                blog={activeBlog}
                manifesto={manifesto}
                onSubmitInput={handleStartPipeline}
                onOpenManifestoEditor={() => setActiveTab('manifesto')}
                isLoading={isGenerating}
              />
            )}
          </div>
        )}

        {/* VIEW 2: MANIFESTO & WORLDVIEW TAB */}
        {activeTab === 'manifesto' && (
          <ManifestoEditor
            manifesto={manifesto}
            onSave={handleSaveManifesto}
          />
        )}

        {/* VIEW 3: ARTICLE HISTORY TAB */}
        {activeTab === 'history' && (
          <ArticleHistoryTab
            posts={posts}
            onSelectPost={(post) => {
              setCurrentPost(post);
              setActiveTab('create');
            }}
            onDeletePost={handleDeletePost}
            onClonePost={handleClonePost}
            onOpenSupabaseSync={(post) => handleOpenSupabaseModal(post)}
            onStartNewPost={() => {
              setCurrentPost(null);
              setActiveTab('create');
            }}
          />
        )}

        {/* VIEW 4: VIRTUAL TEAM INFO TAB */}
        {activeTab === 'team' && (
          <VirtualTeamInfo
            onStartCreate={() => {
              setCurrentPost(null);
              setActiveTab('create');
            }}
            onCustomizePrompts={() => setActiveTab('manifesto')}
          />
        )}

      </main>

      {/* Footer */}
      <footer className={`lg:pl-64 xl:pl-72 border-t py-5 text-center text-xs transition-colors duration-300 ${
        isDark ? 'border-slate-800/80 bg-[#0c101d] text-slate-400 font-mono' : 'border-slate-200 bg-white text-slate-600 font-sans'
      }`}>
        <p>Tech Studio AI • Plataforma Editorial de Tecnologia, IA & Engenharia de Software</p>
      </footer>

    </div>
  );
}
