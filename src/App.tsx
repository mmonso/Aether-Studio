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
  getStoredBlogs,
  getStoredActiveBlogId,
  saveActiveBlogIdToStorage,
  getStoredManifesto,
  saveManifestoToStorage,
  getStoredPosts,
  savePostToStorage,
  deletePostFromStorage,
  createBlogInStorage,
  updateBlogInStorage,
  deleteBlogFromStorage,
} from './lib/storage';
import { VISUAL_STYLES } from './data/presetApproaches';
import { stripDuplicateTitleHeading } from './lib/markdown';

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
  const [manifesto, setManifesto] = useState<UserManifesto>(getStoredManifesto());
  const [isBlogManagerOpen, setIsBlogManagerOpen] = useState<boolean>(false);

  // Supabase Sync state
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [articleForSupabase, setArticleForSupabase] = useState<ArticlePost | null>(null);

  const handleOpenSupabaseModal = (post?: ArticlePost) => {
    setArticleForSupabase(post || currentPost || null);
    setIsSupabaseModalOpen(true);
  };

  // Guarda o slug publicado no post local: é ele que mantém a URL estável
  // e faz a republicação atualizar a linha existente no Supabase.
  const applyPublishState = (articleId: string, changes: Partial<ArticlePost>) => {
    setPosts((prev) => {
      const target = prev.find((p) => p.id === articleId);
      if (!target) return prev;
      const updated = { ...target, ...changes, updatedAt: new Date().toISOString() };
      savePostToStorage(updated);
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
  useEffect(() => {
    const loadedBlogs = getStoredBlogs();
    const loadedActiveId = getStoredActiveBlogId();
    setBlogs(loadedBlogs);
    setActiveBlogId(loadedActiveId);
    setPosts(getStoredPosts());
    setManifesto(getStoredManifesto(loadedActiveId));
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

  // Switch Active Blog
  const handleSelectBlog = (id: string) => {
    saveActiveBlogIdToStorage(id);
    setActiveBlogId(id);
    const newManifesto = getStoredManifesto(id);
    setManifesto(newManifesto);
    setCurrentPost(null);
    const selectedBlog = blogs.find((b) => b.id === id);
    if (selectedBlog) {
      addToast('info', `Workspace alterado: ${selectedBlog.name}`, `Nicho: ${selectedBlog.niche}`);
    }
  };

  // Create New Blog
  const handleCreateBlog = (
    name: string,
    niche: string,
    description: string,
    authorName: string,
    professionalTitle: string,
    badgeColor: 'teal' | 'indigo' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan',
    presetTemplateId?: string
  ) => {
    const newBlog = createBlogInStorage(
      name,
      niche,
      description,
      authorName,
      professionalTitle,
      badgeColor,
      presetTemplateId
    );
    const updatedBlogs = getStoredBlogs();
    setBlogs(updatedBlogs);
    handleSelectBlog(newBlog.id);
    addToast('success', 'Novo blog criado com sucesso!', `Equipe virtual de "${name}" ativada.`);
  };

  // Update Blog
  const handleUpdateBlog = (updatedBlog: Blog) => {
    const updatedBlogs = updateBlogInStorage(updatedBlog);
    setBlogs(updatedBlogs);
    if (updatedBlog.id === activeBlogId) {
      setManifesto(updatedBlog.manifesto);
    }
    addToast('success', 'Dados do blog atualizados!');
  };

  // Delete Blog
  const handleDeleteBlog = (id: string) => {
    const { remainingBlogs, newActiveId } = deleteBlogFromStorage(id);
    setBlogs(remainingBlogs);
    handleSelectBlog(newActiveId);
    addToast('info', 'Blog excluído.');
  };

  // Save Manifesto for Active Blog
  const handleSaveManifesto = (updated: UserManifesto) => {
    setManifesto(updated);
    saveManifestoToStorage(updated, activeBlogId);
    // Update active blog in state list
    setBlogs((prev) =>
      prev.map((b) => (b.id === activeBlogId ? { ...b, manifesto: updated, authorName: updated.authorName, professionalTitle: updated.professionalTitle } : b))
    );
    addToast('success', 'Linha editorial salva!', `Visão de mundo do blog "${activeBlog.name}" foi atualizada.`);
  };

  // Handle Starting Production of a New Post (Full Step-by-Step Pipeline)
  const handleStartPipeline = async (input: PostGenerationInput) => {
    setIsGenerating(true);

    const newPostId = `post_${Date.now()}`;

    // Create initial post object
    let currentPostObj: ArticlePost = {
      id: newPostId,
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

    setCurrentPost(currentPostObj);

    try {
      let factCheckData: FactCheckReport | undefined = undefined;

      // -------------------------------------------------------------
      // STEP 0: PESQUISADOR & FACT-CHECKER (Pesquisa ao Vivo e Fact-Checking)
      // -------------------------------------------------------------
      if (input.enableFactCheck) {
        const factCheckRes = await fetch('/api/research-factcheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: input.topic,
            newsReferenceUrl: input.newsReferenceUrl,
            blogName: activeBlog.name,
            blogNiche: activeBlog.niche,
            userManifesto: manifesto,
          }),
        });

        const fcJson = await factCheckRes.json();
        if (fcJson.success && fcJson.data) {
          factCheckData = fcJson.data;
          currentPostObj = {
            ...currentPostObj,
            factCheck: factCheckData,
            status: 'drafting',
          };
          setCurrentPost(currentPostObj);
        } else {
          console.warn('Falha no fact-check, prosseguindo com rascunho direto:', fcJson.error);
          currentPostObj = {
            ...currentPostObj,
            status: 'drafting',
          };
          setCurrentPost(currentPostObj);
        }
      }

      // -------------------------------------------------------------
      // STEP 1: REDATOR VIRTUAL (Geração do Rascunho com o Manifesto do Blog)
      // -------------------------------------------------------------
      const draftRes = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: input.topic,
          targetAudience: input.targetAudience,
          depthLevel: input.depthLevel,
          articleLength: input.articleLength,
          customWriterPrompt: input.customWriterPrompt,
          blogName: activeBlog.name,
          blogNiche: activeBlog.niche,
          userManifesto: manifesto,
          factCheck: factCheckData,
        }),
      });

      const draftData = await draftRes.json();
      if (!draftData.success) {
        throw new Error(draftData.error || 'Erro na etapa de redação.');
      }

      const draftResult = {
        ...draftData.data,
        rawText: stripDuplicateTitleHeading(draftData.data.rawText, draftData.data.title),
      };

      // Update post state with Draft
      const postWithDraft: ArticlePost = {
        ...currentPostObj,
        draft: draftResult,
        status: 'reviewing',
      };
      setCurrentPost(postWithDraft);

      // -------------------------------------------------------------
      // STEP 2: REVISOR CLÍNICO & EDITORIAL (Revisão e Polimento)
      // -------------------------------------------------------------
      const reviewRes = await fetch('/api/review-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: input.topic,
          draftTitle: draftResult.title,
          draftSubtitle: draftResult.subtitle,
          draftText: draftResult.rawText,
          customReviewerPrompt: input.customReviewerPrompt,
          blogName: activeBlog.name,
          blogNiche: activeBlog.niche,
          userManifesto: manifesto,
          factCheck: factCheckData,
        }),
      });

      const reviewData = await reviewRes.json();
      if (!reviewData.success) {
        throw new Error(reviewData.error || 'Erro na etapa de revisão editorial.');
      }

      const reviewResult = {
        ...reviewData.data,
        revisedText: stripDuplicateTitleHeading(
          reviewData.data.revisedText,
          reviewData.data.revisedTitle
        ),
      };

      // Update post state with Review
      const postWithReview: ArticlePost = {
        ...postWithDraft,
        review: reviewResult,
        status: 'generating_image',
      };
      setCurrentPost(postWithReview);

      // -------------------------------------------------------------
      // STEP 3: DESIGNER VISUAL (Criação de Imagem Editorial)
      // -------------------------------------------------------------
      const selectedStyle = VISUAL_STYLES.find((s) => s.id === input.visualStyle) || VISUAL_STYLES[0];

      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reviewResult.revisedTitle || draftResult.title,
          summary: reviewResult.metaDescription || draftResult.subtitle,
          visualStyle: selectedStyle.name,
          promptModifier: selectedStyle.promptModifier,
          customImagePrompt: input.customImagePrompt,
        }),
      });

      const imgData = await imgRes.json();
      if (!imgData.success) {
        console.warn('Falha na geração da imagem via Imagen API, usando imagem temática suave.');
      }

      const imageResult = imgData.data || {
        imageUrl: `https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80`,
        promptUsed: `Ilustração editorial para ${activeBlog.niche}`,
        conceptExplanation: 'Imagem conceitual alinhada ao artigo.',
        altText: `Ilustração sobre ${input.topic}`,
        styleUsed: selectedStyle.id,
      };

      // Completed Post
      const completedPost: ArticlePost = {
        ...postWithReview,
        image: imageResult,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      };

      setCurrentPost(completedPost);
      const updatedPosts = savePostToStorage(completedPost);
      setPosts(updatedPosts);
    } catch (err: any) {
      console.error('Pipeline error:', err);
      setCurrentPost((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              errorMessage: err.message || 'Falha ao processar o artigo.',
            }
          : null
      );
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
        const updatedList = savePostToStorage(updatedPost);
        setPosts(updatedList);
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
    const updatedList = savePostToStorage(updated);
    setPosts(updatedList);
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

    const updatedList = savePostToStorage(clonedPost);
    setPosts(updatedList);
    setCurrentPost(clonedPost);
    setActiveTab('create');
    addToast('success', 'Artigo duplicado com sucesso!', 'Uma cópia pronta para novas edições foi carregada.');
  };

  // Handle delete post from history
  const handleDeletePost = (id: string) => {
    if (window.confirm('Excluir este artigo do histórico?')) {
      const updated = deletePostFromStorage(id);
      setPosts(updated);
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
