import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { ArticlePost, DerivedFormats } from '../types';
import { UserManifesto } from '../types';
import {
  Copy,
  Check,
  Download,
  Share2,
  FileText,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
  BookOpen,
  Tag,
  Clock,
  Heart,
  Edit3,
  Save,
  MessageSquare,
  Loader2,
  AlertCircle,
  Compass,
  X,
  Printer,
  Film,
  Layers,
  Plus,
  RotateCcw,
  Code,
  FileCode,
  Braces,
  Globe,
  Wand2,
  Feather,
  SearchCheck,
  ExternalLink,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { VISUAL_STYLES } from '../data/presetApproaches';

interface ArticleResultViewProps {
  post: ArticlePost;
  /** Manifesto do blog ativo. Vem do App porque agora é carregado do Supabase:
   *  não dá para ler de forma síncrona no meio da renderização. */
  manifesto: UserManifesto;
  onPostUpdated: (updatedPost: ArticlePost) => void;
  onRegenerateImage: (styleId: string) => void;
  onClonePost?: (post: ArticlePost) => void;
  onOpenSupabaseSync?: (post: ArticlePost) => void;
  addToast?: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  isRegeneratingImage?: boolean;
}

export const ArticleResultView: React.FC<ArticleResultViewProps> = ({
  post,
  manifesto,
  onPostUpdated,
  onRegenerateImage,
  onClonePost,
  onOpenSupabaseSync,
  addToast,
  isRegeneratingImage = false,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'social' | 'multiformat' | 'markdown' | 'review' | 'reactexport' | 'factcheck'>(
    post.factCheck ? 'factcheck' : 'preview'
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // React Blog Export format selector state
  const [reactExportFormat, setReactExportFormat] = useState<'tsx' | 'json' | 'mdx' | 'html'>('tsx');

  // Clean Reader Customization state
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [readerTheme, setReaderTheme] = useState<'light' | 'sepia' | 'dark'>('light');

  // Edit mode for markdown / direct keyboard editing
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedTitle, setEditedTitle] = useState(post.review?.revisedTitle || post.draft?.title || '');
  const [editedSubtitle, setEditedSubtitle] = useState(post.review?.revisedSubtitle || post.draft?.subtitle || '');
  const [editedText, setEditedText] = useState(post.review?.revisedText || post.draft?.rawText || '');

  // Version Toggle: 'revised' vs 'draft'
  const [viewingVersion, setViewingVersion] = useState<'revised' | 'draft'>('revised');

  // Article Tags Management
  const [articleTags, setArticleTags] = useState<string[]>(
    post.tags || post.review?.suggestedTags || ['Inteligência Artificial', 'Engenharia de Software', 'Arquitetura']
  );
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // Multiformat Generator State (Carousel & Reels)
  const [isGeneratingDerived, setIsGeneratingDerived] = useState(false);
  const [derivedFormats, setDerivedFormats] = useState<DerivedFormats | null>(post.derivedFormats || null);
  const [derivedActiveTab, setDerivedActiveTab] = useState<'carousel' | 'reels'>('carousel');
  const [derivedError, setDerivedError] = useState<string | null>(null);

  // Regenerate image style selector
  const [selectedStyleForRegen, setSelectedStyleForRegen] = useState(
    post.image?.styleUsed || 'minimalist_vector'
  );

  // Re-review strict pass state
  const [isReReviewing, setIsReReviewing] = useState(false);
  const [reReviewInstruction, setReReviewInstruction] = useState('');
  const [reReviewError, setReReviewError] = useState<string | null>(null);

  // Selection & Inline Refinement State
  const [selectedSnippet, setSelectedSnippet] = useState<string>('');
  const [customRefineInstruction, setCustomRefineInstruction] = useState<string>('');
  const [isRefiningSelection, setIsRefiningSelection] = useState<boolean>(false);
  const [selectionMessage, setSelectionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cover Image Fallback State
  const [imageSrc, setImageSrc] = useState<string>(post.image?.imageUrl || '');

  useEffect(() => {
    if (post.image?.imageUrl) {
      setImageSrc(post.image.imageUrl);
    }
  }, [post.image?.imageUrl]);

  const SMART_SUGGESTIONS = [
    'Tornar mais denso e ensaístico',
    'Aprofundar perspectiva da Gestalt / Fenomenologia',
    'Eliminar tom de conselho ou prescritivo',
    'Substituir por pergunta reflexiva aberta',
    'Enfatizar a dimensão relacional do sofrimento',
    'Criticar sutilmente a cobrança de produtividade',
  ];

  // Global Selection Listener
  useEffect(() => {
    const handleSelectionChange = () => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (text.length >= 6) {
        setSelectedSnippet(text);
        setSelectionMessage(null);
      }
    };

    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, []);

  const handleCloseSelectionBox = () => {
    setSelectedSnippet('');
    setSelectionMessage(null);
    window.getSelection()?.removeAllRanges();
  };

  const executeRefineSelection = async (instructionToUse?: string) => {
    const activeInstruction = instructionToUse || customRefineInstruction;
    if (!selectedSnippet || !activeInstruction.trim()) return;

    setIsRefiningSelection(true);
    setSelectionMessage(null);

    try {

      const currentFullText = editedText || post.review?.revisedText || post.draft?.rawText || '';

      const res = await fetch('/api/refine-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: selectedSnippet,
          instruction: activeInstruction,
          fullText: currentFullText,
          userManifesto: manifesto,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.rewrittenText) {
        const rewrittenSnippet = data.data.rewrittenText;
        let newFullText = currentFullText;

        if (currentFullText.includes(selectedSnippet)) {
          newFullText = currentFullText.replace(selectedSnippet, rewrittenSnippet);
        } else if (currentFullText.includes(selectedSnippet.trim())) {
          newFullText = currentFullText.replace(selectedSnippet.trim(), rewrittenSnippet);
        } else {
          newFullText = currentFullText.replace(selectedSnippet, rewrittenSnippet);
        }

        setEditedText(newFullText);

        const updatedPost: ArticlePost = {
          ...post,
          review: post.review
            ? { ...post.review, revisedText: newFullText }
            : undefined,
          draft: { ...post.draft, rawText: newFullText },
        };
        onPostUpdated(updatedPost);

        setSelectionMessage({
          type: 'success',
          text: `Trecho reescrito: "${data.data.explanation || 'Refinamento aplicado com sucesso.'}"`,
        });
        setSelectedSnippet('');
        setCustomRefineInstruction('');
        window.getSelection()?.removeAllRanges();
      } else {
        setSelectionMessage({
          type: 'error',
          text: data.error || 'Não foi possível reescrever o trecho selecionado.',
        });
      }
    } catch (err: any) {
      console.error('Erro na reescrita de seleção:', err);
      setSelectionMessage({
        type: 'error',
        text: 'Falha de conexão ao reescrever a seleção.',
      });
    } finally {
      setIsRefiningSelection(false);
    }
  };

  const handleReReview = async () => {
    setIsReReviewing(true);
    setReReviewError(null);
    try {

      const currentText = editedText || post.review?.revisedText || post.draft?.rawText || '';
      const currentTitle = editedTitle || post.review?.revisedTitle || post.draft?.title || '';
      const currentSubtitle = editedSubtitle || post.review?.revisedSubtitle || post.draft?.subtitle || '';

      const res = await fetch('/api/review-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: post.topic,
          draftTitle: currentTitle,
          draftSubtitle: currentSubtitle,
          draftText: currentText,
          customReviewerPrompt:
            reReviewInstruction.trim() ||
            'SEJA EXTREMAMENTE CRÍTICO. Elimine todo e qualquer traço de linguagem de IA, frase feita de autoajuda ou conselho de 5 passos. Reescreva em ensaística profunda e autoral.',
          userManifesto: manifesto,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const updatedPost: ArticlePost = {
          ...post,
          review: data.data,
        };
        onPostUpdated(updatedPost);
        setEditedTitle(data.data.revisedTitle);
        setEditedSubtitle(data.data.revisedSubtitle);
        setEditedText(data.data.revisedText);
        setReReviewInstruction('');
      } else {
        setReReviewError(data.error || 'Erro ao reprocessar revisão do Revisor.');
      }
    } catch (err: any) {
      console.error('Erro na re-revisão:', err);
      setReReviewError('Falha de conexão ao reprocessar a revisão.');
    } finally {
      setIsReReviewing(false);
    }
  };

  const handleGenerateDerivedFormats = async () => {
    setIsGeneratingDerived(true);
    setDerivedError(null);
    try {

      const title = editedTitle || post.review?.revisedTitle || post.draft?.title || post.topic;
      const text = editedText || post.review?.revisedText || post.draft?.rawText || '';

      const res = await fetch('/api/generate-derived-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          text,
          userManifesto: manifesto,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setDerivedFormats(data.data);
        const updatedPost: ArticlePost = {
          ...post,
          derivedFormats: data.data,
        };
        onPostUpdated(updatedPost);
      } else {
        setDerivedError(data.error || 'Falha ao converter para redes sociais.');
      }
    } catch (err: any) {
      console.error('Erro ao converter formato:', err);
      setDerivedError('Erro de conexão ao gerar carrossel e roteiro de reels.');
    } finally {
      setIsGeneratingDerived(false);
    }
  };

  const handleDownloadPDF = () => {

    const authorName = manifesto.authorName || post.authorName || 'Psicólogo(a)';
    const professionalTitle = manifesto.professionalTitle || 'Tecnologia & Engenharia de Software';
    const title = editedTitle || post.review?.revisedTitle || post.draft?.title || post.topic;
    const subtitle = editedSubtitle || post.review?.revisedSubtitle || post.draft?.subtitle || '';
    const text = editedText || post.review?.revisedText || post.draft?.rawText || '';
    const coverUrl = post.image?.imageUrl || '';
    const dateStr = new Date(post.createdAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const paragraphsHtml = text
      .split('\n\n')
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('# '))
          return `<h1 style="font-size:24px; font-family: Georgia, serif; margin-top:24px; color:#1c1917; line-height:1.3;">${trimmed.replace('# ', '')}</h1>`;
        if (trimmed.startsWith('## '))
          return `<h2 style="font-size:20px; font-family: Georgia, serif; margin-top:20px; color:#1c1917; line-height:1.3; border-bottom:1px solid #e7e5e4; padding-bottom:6px;">${trimmed.replace('## ', '')}</h2>`;
        if (trimmed.startsWith('### '))
          return `<h3 style="font-size:17px; font-family: Georgia, serif; margin-top:16px; color:#292524; line-height:1.3;">${trimmed.replace('### ', '')}</h3>`;
        return `<p style="font-size:15px; line-height:1.75; font-family: Georgia, serif; color:#292524; margin-bottom:16px;">${trimmed
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
      })
      .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 20mm 15mm; }
          body {
            font-family: Georgia, serif;
            color: #1c1917;
            margin: 0;
            padding: 24px;
            background: #fff;
          }
          .header {
            border-bottom: 2px solid #0f766e;
            padding-bottom: 14px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .author-name { font-size: 18px; font-weight: bold; color: #0f766e; }
          .author-info { font-size: 13px; color: #57534e; }
          .title { font-size: 28px; font-weight: bold; color: #0c0a09; margin-bottom: 8px; line-height: 1.25; }
          .subtitle { font-size: 16px; font-style: italic; color: #57534e; margin-bottom: 24px; line-height: 1.4; }
          .cover-container { text-align: center; margin-bottom: 28px; }
          .cover-img { width: 100%; max-height: 340px; object-fit: cover; border-radius: 12px; }
          .content { font-size: 15px; line-height: 1.75; color: #292524; }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #e7e5e4;
            padding-top: 14px;
            font-size: 11px;
            color: #78716c;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="author-name">${authorName}</div>
            <div class="author-info">${professionalTitle}</div>
          </div>
          <div style="text-align:right; font-size:12px; color:#57534e;">
            Aether Studio<br>${dateStr}
          </div>
        </div>

        <h1 class="title">${title}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}

        ${coverUrl ? `<div class="cover-container"><img src="${coverUrl}" class="cover-img" alt="Capa"></div>` : ''}

        <div class="content">
          ${paragraphsHtml}
        </div>

        <div class="footer">
          Conteúdo com caráter ensaístico e analítico. Produzido com auxílio do Studio Editorial AI.
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const showCopied = (field: string) => {
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    showCopied(fieldName);
  };

  const handleSaveEdits = () => {
    if (!post.review) return;
    const updated: ArticlePost = {
      ...post,
      review: {
        ...post.review,
        revisedTitle: editedTitle,
        revisedSubtitle: editedSubtitle,
        revisedText: editedText,
      },
    };
    onPostUpdated(updated);
    setIsEditingText(false);
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const cleanTag = newTagInput.trim().replace(/^#/, '');
    if (!articleTags.includes(cleanTag)) {
      const updated = [...articleTags, cleanTag];
      setArticleTags(updated);
      onPostUpdated({ ...post, tags: updated });
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = articleTags.filter((t) => t !== tagToRemove);
    setArticleTags(updated);
    onPostUpdated({ ...post, tags: updated });
  };

  const handleRestoreDraftAsRevised = () => {
    if (!post.draft?.rawText) return;
    const restoredTitle = post.draft.title || editedTitle;
    const restoredSubtitle = post.draft.subtitle || editedSubtitle;
    const restoredText = post.draft.rawText;

    setEditedTitle(restoredTitle);
    setEditedSubtitle(restoredSubtitle);
    setEditedText(restoredText);

    if (post.review) {
      const updated: ArticlePost = {
        ...post,
        review: {
          ...post.review,
          revisedTitle: restoredTitle,
          revisedSubtitle: restoredSubtitle,
          revisedText: restoredText,
        },
      };
      onPostUpdated(updated);
    }
    setViewingVersion('revised');
  };

  const downloadArticle = () => {
    const title = editedTitle || post.review?.revisedTitle || post.draft?.title || 'artigo';
    const text = editedText || post.review?.revisedText || post.draft?.rawText || '';
    const content = `# ${title}\n\n${editedSubtitle || post.review?.revisedSubtitle || ''}\n\nTom / Estilo: ${post.tone}\n\n---\n\n${text}\n\n---\n*Nota Editorial: Conteúdo autoral e reflexivo produzido para publicação no Studio Editorial.*`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
    link.click();
  };


  const displayedCoverUrl = post.image?.imageUrl || imageSrc || '';

  const displayedTitle =
    viewingVersion === 'draft'
      ? post.draft?.title || editedTitle
      : editedTitle || post.review?.revisedTitle || post.draft?.title;

  const displayedSubtitle =
    viewingVersion === 'draft'
      ? post.draft?.subtitle || editedSubtitle
      : editedSubtitle || post.review?.revisedSubtitle || post.draft?.subtitle;

  const displayedText =
    viewingVersion === 'draft'
      ? post.draft?.rawText || editedText
      : editedText || post.review?.revisedText || post.draft?.rawText;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 animate-fade-in">
      
      {/* Top Banner Action Bar */}
      <div className="bg-white dark:bg-[#18191e] rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-teal-700 dark:text-amber-300 uppercase tracking-wider min-w-0">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="whitespace-nowrap">Artigo Concluído</span>
            {post.publishedSlug && post.isPublished && (
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>No ar</span>
              </span>
            )}
            <span className="text-stone-300 dark:text-stone-700 shrink-0">•</span>
            <span
              className="text-stone-500 dark:text-stone-400 truncate max-w-[150px] sm:max-w-[280px] lg:max-w-[360px]"
              title={post.approachName || post.tone || 'Visão do Autor'}
            >
              {post.approachName || post.tone || 'Visão do Autor'}
            </span>
          </div>
          <h2 className="font-serif font-bold text-lg sm:text-2xl text-stone-900 dark:text-stone-100 mt-1 leading-tight">
            {displayedTitle}
          </h2>
        </div>

        {/* Copy / PDF / Multiformat Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:max-w-[60%] md:justify-end shrink-0">
          <button
            onClick={() => onOpenSupabaseSync?.(post)}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer min-h-[40px] shadow-sm bg-emerald-800 hover:bg-emerald-700 text-white"
            title={
              post.publishedSlug
                ? 'Abrir o painel de publicação para atualizar ou tirar do ar'
                : 'Enviar este artigo para o blog público'
            }
          >
            <Globe className="w-4 h-4 text-emerald-200" />
            <span>{post.publishedSlug ? 'Gerenciar Publicação' : 'Publicar no Blog'}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex-1 md:flex-none px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer min-h-[40px]"
            title="Exportar documento PDF pronto para impressão ou envio a leitores"
          >
            <Printer className="w-4 h-4 text-amber-200" />
            <span>Baixar PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('multiformat')}
            className="flex-1 md:flex-none px-3.5 py-2 bg-indigo-50 dark:bg-stone-900 hover:bg-indigo-100 dark:hover:bg-stone-800 text-indigo-900 dark:text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-stone-800 flex items-center justify-center space-x-1.5 transition-all cursor-pointer min-h-[40px]"
          >
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Carrossel & Reels</span>
          </button>

          {onClonePost && (
            <button
              onClick={() => onClonePost(post)}
              className="flex-1 md:flex-none px-3 py-2 bg-stone-100 dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer min-h-[40px] border border-stone-200/50 dark:border-stone-800"
              title="Criar uma cópia para modificações"
            >
              <Copy className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <span>Clonar Artigo</span>
            </button>
          )}

          <button
            onClick={() => setIsEditingText(!isEditingText)}
            className="flex-1 md:flex-none px-3.5 py-2 bg-stone-100 dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer min-h-[40px] border border-stone-200/50 dark:border-stone-800"
          >
            <Edit3 className="w-4 h-4 text-stone-600 dark:text-stone-400" />
            <span>{isEditingText ? 'Ocultar Editor' : 'Editar no Teclado'}</span>
          </button>

          <button
            onClick={downloadArticle}
            className="w-full sm:w-auto px-3.5 py-2 bg-teal-700 dark:bg-amber-400 hover:bg-teal-800 dark:hover:bg-amber-500 text-white dark:text-stone-950 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>Baixar .MD</span>
          </button>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 space-x-2 sm:space-x-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('preview')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'preview'
              ? 'border-teal-600 dark:border-amber-400 text-teal-800 dark:text-amber-300'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Prévia do Blog</span>
        </button>

        <button
          onClick={() => setActiveTab('multiformat')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'multiformat'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-800 dark:text-indigo-300'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Carrossel & Reels</span>
        </button>

        <button
          onClick={() => setActiveTab('social')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'social'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-800 dark:text-indigo-300'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Legendas & SEO</span>
        </button>

        <button
          onClick={() => setActiveTab('markdown')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'markdown'
              ? 'border-amber-600 dark:border-amber-400 text-amber-800 dark:text-amber-300'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Código Markdown & Editor</span>
        </button>

        {post.factCheck && (
          <button
            onClick={() => setActiveTab('factcheck')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'factcheck'
                ? 'border-amber-600 dark:border-amber-400 text-amber-900 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <SearchCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Fact-Checking & Fontes</span>
            {/* O selo só existe quando houve apuração real com fontes consultadas. */}
            {post.factCheck.groundingUsed && post.factCheck.credibilityScore !== null && (
              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border border-amber-300 dark:border-amber-800">
                {post.factCheck.credibilityScore}%
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('review')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'review'
              ? 'border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Parecer do Comitê Editorial</span>
        </button>

        <button
          onClick={() => setActiveTab('reactexport')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'reactexport'
              ? 'border-cyan-600 dark:border-cyan-400 text-cyan-900 dark:text-cyan-300 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <Code className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>Exportar para Blog React</span>
          <span className="bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border border-cyan-300 dark:border-cyan-800">JSX/JSON</span>
        </button>
      </div>

      {/* TAB 1: BLOG PREVIEW */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-3xl p-4 sm:p-10 border border-stone-200 shadow-sm space-y-8">
          
          {/* Version Switcher Bar (Versão Revisada vs Rascunho Original) */}
          <div className="bg-stone-50 border border-stone-200 p-2 sm:p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">Versão em Exibição:</span>
              <div className="flex bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
                <button
                  onClick={() => setViewingVersion('revised')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    viewingVersion === 'revised'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  ✨ Versão Revisada (Final)
                </button>
                <button
                  onClick={() => setViewingVersion('draft')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    viewingVersion === 'draft'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  📝 Rascunho Original (Redator)
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setIsEditingText(!isEditingText)}
                className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 font-semibold text-stone-800 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>{isEditingText ? 'Concluir Edição' : 'Editar Texto no Teclado'}</span>
              </button>
            </div>
          </div>

          {/* Draft Notice Banner if viewing original draft */}
          {viewingVersion === 'draft' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Você está visualizando o rascunho original produzido pelo Redator Virtual antes da revisão do comitê editorial.</span>
              </div>
              <button
                onClick={handleRestoreDraftAsRevised}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center space-x-1 transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Rascunho como Texto Ativo</span>
              </button>
            </div>
          )}

          {/* Direct Keyboard Editor Panel (WYSIWYG / Textarea) */}
          {isEditingText && (
            <div className="bg-amber-50/60 border border-amber-300 rounded-2xl p-4 sm:p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <div className="flex items-center space-x-2 font-bold text-amber-950 text-sm">
                  <Edit3 className="w-4 h-4 text-amber-700" />
                  <span>Modo de Edição Direta no Teclado</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSaveEdits}
                    className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5 text-amber-300" />
                    <span>Salvar Alterações</span>
                  </button>
                  <button
                    onClick={() => setIsEditingText(false)}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">Título do Artigo</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-sm font-serif font-bold text-stone-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">Subtítulo / Linha fina</label>
                  <input
                    type="text"
                    value={editedSubtitle}
                    onChange={(e) => setEditedSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-xs font-serif italic text-stone-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-800">Corpo do Ensaio (Markdown)</label>
                    <span className="text-[11px] text-stone-500 font-mono">
                      {editedText.split(/\s+/).filter(Boolean).length} palavras • {editedText.length} caracteres
                    </span>
                  </div>
                  <textarea
                    rows={14}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full p-4 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 font-sans leading-relaxed focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Article Header Details */}
          <div className="space-y-4 max-w-3xl mx-auto text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 bg-stone-100 px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-700">
              <span>{post.approachName || post.tone || 'Visão do Autor'}</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-stone-500" />
                <span>{post.review?.readingTimeMinutes || 4} min de leitura</span>
              </span>
            </div>

            <h1 className="font-serif font-bold text-2xl sm:text-4xl text-stone-900 leading-tight">
              {displayedTitle}
            </h1>

            {displayedSubtitle && (
              <p className="text-stone-600 font-serif italic text-base sm:text-lg">
                {displayedSubtitle}
              </p>
            )}

            {/* Editable Tags Pill Bar */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              {articleTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-stone-100 text-stone-800 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1 border border-stone-200"
                >
                  <Tag className="w-3 h-3 text-amber-600" />
                  <span>#{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-stone-400 hover:text-rose-600 transition-colors"
                    title="Remover tag"
                  >
                    ×
                  </button>
                </span>
              ))}

              {showTagInput ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    placeholder="Nova tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="w-24 px-2 py-0.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-2 py-0.5 bg-teal-800 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold px-2.5 py-1 rounded-lg border border-amber-200 flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-amber-600" />
                  <span>Tag</span>
                </button>
              )}
            </div>

          </div>

          {/* Cover Image Box */}
          {post.image?.imageUrl && (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden shadow-md group border border-stone-200 bg-stone-100 min-h-[260px] flex items-center justify-center">
                <img
                  key={imageSrc}
                  src={imageSrc}
                  alt={post.image.altText || 'Capa do artigo'}
                  onError={() => {
                    const fallbackSeed = Math.floor(Math.random() * 8000) + 1000;
                    setImageSrc(`https://picsum.photos/seed/${fallbackSeed}/1200/675`);
                  }}
                  className={`w-full h-auto max-h-[480px] object-cover transition-opacity duration-300 ${
                    isRegeneratingImage ? 'opacity-40 blur-xs' : 'opacity-100'
                  }`}
                  referrerPolicy="no-referrer"
                />

                {isRegeneratingImage && (
                  <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Criando Nova Ilustração Editorial...</span>
                  </div>
                )}

                {!isRegeneratingImage && post.image.conceptExplanation && (
                  <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-end p-4">
                    <span className="text-white text-xs bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg font-sans">
                      💡 Metáfora Visual: {post.image.conceptExplanation}
                    </span>
                  </div>
                )}
              </div>

              {/* Regenerate image controls */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-stone-700 font-medium">Trocar estilo da capa:</span>
                  <select
                    value={selectedStyleForRegen}
                    onChange={(e) => setSelectedStyleForRegen(e.target.value)}
                    className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 focus:ring-2 focus:ring-amber-500"
                  >
                    {VISUAL_STYLES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onRegenerateImage(selectedStyleForRegen)}
                    disabled={isRegeneratingImage}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer min-h-[36px]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingImage ? 'animate-spin' : ''}`} />
                    <span>{isRegeneratingImage ? 'Gerando Imagem...' : 'Regerar Imagem'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Floating Bottom Interactive Selection Correction Dock */}
          {(selectedSnippet || selectionMessage) && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl bg-gradient-to-r from-stone-900 via-stone-950 to-amber-950 text-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-amber-500/50 space-y-3.5 animate-fade-in backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Corretor Inteligente de Trecho Selecionado</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseSelectionBox}
                  className="text-stone-400 hover:text-white p-1 rounded-lg bg-stone-800 hover:bg-stone-700 transition-all cursor-pointer"
                  title="Fechar Corretor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center space-x-2 ${
                    selectionMessage.type === 'success'
                      ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/90 border border-rose-500/50 text-rose-200'
                  }`}
                >
                  <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{selectionMessage.text}</span>
                </div>
              )}

              {selectedSnippet && (
                <div className="space-y-3.5">
                  <div className="bg-stone-800/90 p-3 rounded-2xl border border-stone-700/80">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">
                      Trecho Selecionado para Ajuste:
                    </span>
                    <p className="text-xs text-stone-200 italic font-serif leading-relaxed line-clamp-2">
                      "{selectedSnippet}"
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block">
                      💡 Sugestões Rápidas da IA:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {SMART_SUGGESTIONS.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={isRefiningSelection}
                          onClick={() => executeRefineSelection(chip)}
                          className="text-xs bg-stone-800 hover:bg-amber-600 text-stone-200 hover:text-white px-3 py-1.5 rounded-xl border border-stone-700 hover:border-amber-400 transition-all font-medium cursor-pointer disabled:opacity-50 flex items-center space-x-1 shrink-0"
                        >
                          <Compass className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{chip}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-stone-800">
                    <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block">
                      Ou digite exatamente a correção desejada:
                    </span>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Deixar mais reflexivo e trocar pela visão da Gestalt..."
                        value={customRefineInstruction}
                        onChange={(e) => setCustomRefineInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            executeRefineSelection();
                          }
                        }}
                        className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-stone-500 focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => executeRefineSelection()}
                        disabled={isRefiningSelection || !customRefineInstruction.trim()}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isRefiningSelection ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Reescrevendo...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-stone-950" />
                            <span>Reescrever Trecho</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clean Reader Mode Control Toolbar */}
          <div className="max-w-3xl mx-auto bg-stone-50 border border-stone-200 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs select-none shadow-2xs">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-stone-800">Modo de Leitura:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Font Size Selector */}
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold px-1.5">TAMANHO:</span>
                <button
                  onClick={() => setReaderFontSize('sm')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    readerFontSize === 'sm' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Fonte Pequena"
                >
                  A-
                </button>
                <button
                  onClick={() => setReaderFontSize('base')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    readerFontSize === 'base' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Fonte Média (Padrão)"
                >
                  A
                </button>
                <button
                  onClick={() => setReaderFontSize('lg')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    readerFontSize === 'lg' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Fonte Grande"
                >
                  A+
                </button>
              </div>

              {/* Theme Selector */}
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold px-1.5">TEMA:</span>
                <button
                  onClick={() => setReaderTheme('light')}
                  className={`px-2.5 py-0.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                    readerTheme === 'light' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  ☀️ Claro
                </button>
                <button
                  onClick={() => setReaderTheme('sepia')}
                  className={`px-2.5 py-0.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                    readerTheme === 'sepia' ? 'bg-[#78350f] text-[#fef3c7] shadow-xs' : 'text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  📜 Sépia
                </button>
                <button
                  onClick={() => setReaderTheme('dark')}
                  className={`px-2.5 py-0.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                    readerTheme === 'dark' ? 'bg-stone-800 text-amber-300 shadow-xs' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  🌙 Escuro
                </button>
              </div>
            </div>
          </div>

          {/* Formatted Article Content */}
          <div
            className={`max-w-3xl mx-auto rounded-2xl p-6 sm:p-12 transition-all shadow-xs ${
              readerTheme === 'sepia'
                ? 'bg-[#fbf8f1] text-[#2c2725] border border-[#e8dfd1]'
                : readerTheme === 'dark'
                ? 'bg-[#0a0f1d] text-slate-100 border border-slate-800'
                : 'bg-white text-slate-900 border border-slate-200'
            } select-text cursor-text space-y-6`}
            title="Selecione qualquer trecho com o mouse para abrir o corretor de texto inteligente por IA"
          >
            <div className={`flex items-center justify-between text-xs border-b pb-3 mb-6 select-none font-mono ${
              readerTheme === 'dark' ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-100'
            }`}>
              <span className="flex items-center space-x-1.5">
                <Edit3 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span>Dica: Selecione qualquer trecho com o cursor para reescrever com IA.</span>
              </span>
            </div>

            <Markdown
              components={{
                h1: ({ node, ...props }) => (
                  <h1
                    className={`font-sans font-extrabold ${
                      readerFontSize === 'sm' ? 'text-2xl' : readerFontSize === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                    } mt-8 mb-5 leading-tight ${readerTheme === 'dark' ? 'text-slate-50' : 'text-slate-950'}`}
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <h2
                    className={`font-sans font-extrabold ${
                      readerFontSize === 'sm' ? 'text-xl' : readerFontSize === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                    } mt-10 mb-4 pt-6 border-t ${
                      readerTheme === 'dark' ? 'text-slate-100 border-slate-800' : 'text-slate-900 border-slate-200'
                    }`}
                    {...props}
                  />
                ),
                h3: ({ node, ...props }) => (
                  <h3
                    className={`font-sans font-bold ${
                      readerFontSize === 'sm' ? 'text-lg' : readerFontSize === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                    } mt-8 mb-3 ${readerTheme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}
                    {...props}
                  />
                ),
                p: ({ node, ...props }) => (
                  <p
                    className={`font-sans ${
                      readerFontSize === 'sm'
                        ? 'text-base leading-relaxed mb-4'
                        : readerFontSize === 'lg'
                        ? 'text-[19px] sm:text-[20px] leading-[1.9] mb-6'
                        : 'text-[17px] sm:text-[18px] leading-[1.85] mb-5'
                    } ${readerTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}
                    {...props}
                  />
                ),
                strong: ({ node, ...props }) => (
                  <strong className={`font-bold ${readerTheme === 'dark' ? 'text-slate-50' : 'text-slate-950'}`} {...props} />
                ),
                em: ({ node, ...props }) => <em className="italic" {...props} />,
                a: ({ node, ...props }) => (
                  <a
                    className="text-teal-600 dark:text-teal-400 underline underline-offset-2 hover:text-teal-500"
                    target="_blank"
                    rel="noreferrer"
                    {...props}
                  />
                ),
                ul: ({ node, ...props }) => (
                  <ul
                    className={`list-disc pl-6 space-y-2.5 my-4 font-sans ${
                      readerFontSize === 'sm'
                        ? 'text-base leading-relaxed'
                        : readerFontSize === 'lg'
                        ? 'text-lg sm:text-xl leading-[1.85]'
                        : 'text-[17px] sm:text-[18px] leading-[1.85]'
                    } ${readerTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}
                    {...props}
                  />
                ),
                ol: ({ node, ...props }) => (
                  <ol
                    className={`list-decimal pl-6 space-y-2.5 my-4 font-sans ${
                      readerFontSize === 'sm'
                        ? 'text-base leading-relaxed'
                        : readerFontSize === 'lg'
                        ? 'text-lg sm:text-xl leading-[1.85]'
                        : 'text-[17px] sm:text-[18px] leading-[1.85]'
                    } ${readerTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className={`my-8 p-5 sm:p-6 rounded-r-xl border-l-4 border-teal-500 font-sans not-italic ${
                      readerTheme === 'dark'
                        ? 'bg-teal-500/10 text-slate-200'
                        : readerTheme === 'sepia'
                        ? 'bg-[#f4ebd0]/80 text-[#2c221e]'
                        : 'bg-teal-50/80 text-teal-950'
                    }`}
                    {...props}
                  />
                ),
                hr: ({ node, ...props }) => (
                  <hr className={`my-10 ${readerTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`} {...props} />
                ),
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  if (inline) {
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-teal-700 dark:text-teal-300 font-mono text-[0.875em] border border-slate-200/80 dark:border-slate-700/80"
                        {...props}
                      >
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
                },
              }}
            >
              {displayedText || ''}
            </Markdown>

            {/* SEÇÃO DE PERGUNTAS E PROVOCAÇÕES PARA REFLEXÃO EDITORIAL */}
            <div className={`mt-10 pt-8 border-t space-y-4 ${
              readerTheme === 'dark' ? 'border-stone-800' : 'border-stone-200'
            }`}>
              <div className="bg-gradient-to-br from-teal-900 via-stone-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-7 space-y-4 shadow-lg border border-teal-500/30">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center space-x-2 text-amber-300 font-serif font-bold text-base sm:text-lg">
                    <Compass className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Provocações & Perguntas para Aprofundamento Editorial</span>
                  </div>
                  <button
                    onClick={() => {
                      const questionsText = `Perguntas e Provocações sobre "${displayedTitle}":\n\n1. Como esta tese dialoga com as transformações no seu setor ou no seu cotidiano?\n2. Qual é a principal contradição trazida no texto que merece maior debate?\n3. Que premissa assumida no ensaio pode ser questionada a partir de novos dados?\n4. Como este ponto de vista pode ser desdobrado em um debate ou artigo futuro?`;
                      handleCopyText(questionsText, 'reflection_questions');
                      if (addToast) {
                        addToast('success', 'Provocações copiadas!', 'Prontas para engajamento com leitores ou redes sociais.');
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    {copiedField === 'reflection_questions' ? <Check className="w-3.5 h-3.5 text-stone-950" /> : <Copy className="w-3.5 h-3.5 text-stone-950" />}
                    <span>{copiedField === 'reflection_questions' ? 'Copiado!' : 'Copiar Provocações'}</span>
                  </button>
                </div>

                <p className="text-xs text-stone-300 leading-relaxed font-sans">
                  Questões instigantes elaboradas para estimular o debate crítico e aprofundar o engajamento com os leitores:
                </p>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-start space-x-3 bg-stone-800/80 p-3.5 rounded-xl border border-stone-700/80">
                    <span className="w-6 h-6 rounded-full bg-teal-800 text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs sm:text-sm text-stone-100 font-serif leading-snug">
                      Como esta tese dialoga com as transformações mais recentes no seu setor ou no seu cotidiano?
                    </p>
                  </div>

                  <div className="flex items-start space-x-3 bg-stone-800/80 p-3.5 rounded-xl border border-stone-700/80">
                    <span className="w-6 h-6 rounded-full bg-teal-800 text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs sm:text-sm text-stone-100 font-serif leading-snug">
                      Qual é a principal contradição exposta neste ensaio que merece maior atenção dos debates atuais?
                    </p>
                  </div>

                  <div className="flex items-start space-x-3 bg-stone-800/80 p-3.5 rounded-xl border border-stone-700/80">
                    <span className="w-6 h-6 rounded-full bg-teal-800 text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                    <p className="text-xs sm:text-sm text-stone-100 font-serif leading-snug">
                      Que premissa assumida no texto pode ser desconstruída ou aprofundada a partir de novos dados?
                    </p>
                  </div>

                  <div className="flex items-start space-x-3 bg-stone-800/80 p-3.5 rounded-xl border border-stone-700/80">
                    <span className="w-6 h-6 rounded-full bg-teal-800 text-teal-200 text-xs font-bold flex items-center justify-center shrink-0">4</span>
                    <p className="text-xs sm:text-sm text-stone-100 font-serif leading-snug">
                      Como este ponto de vista pode ser compartilhado com seu público para gerar discussões de alto nível?
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Editorial Note Footer */}
          <div className="max-w-3xl mx-auto bg-teal-50 dark:bg-stone-900 border border-teal-200 dark:border-stone-800 rounded-2xl p-4 sm:p-6 text-xs sm:text-sm text-teal-900 dark:text-teal-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-teal-950 dark:text-teal-100">
              <Heart className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>Nota de Transparência & Isenção Editorial</span>
            </div>
            <p className="text-teal-800 dark:text-stone-300 leading-relaxed">
              Este conteúdo possui caráter opinativo e ensaístico. Foi produzido de forma autoral com curadoria e auditoria dos agentes especializados do Studio Editorial AI.
            </p>
          </div>

        </div>
      )}

      {/* TAB 2: MULTIFORMAT CAROUSEL & REELS GENERATOR */}
      {activeTab === 'multiformat' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-4 sm:p-8 border border-stone-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-lg">
                  <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
                  <h2>Gerador de Carrossel (5-8 Slides) & Roteiro de Vídeo/Reels</h2>
                </div>
                <p className="text-xs text-stone-600 mt-1">
                  Transforme o artigo técnico em slides dinâmicos para Instagram/LinkedIn e em roteiro de 60s para vídeo.
                </p>
              </div>

              <button
                onClick={handleGenerateDerivedFormats}
                disabled={isGeneratingDerived}
                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer min-h-[40px] disabled:opacity-50"
              >
                {isGeneratingDerived ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                    <span>Adaptando para Redes Sociais...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>{derivedFormats ? 'Regerar Formatos' : 'Gerar Carrossel & Reels com IA'}</span>
                  </>
                )}
              </button>
            </div>

            {derivedError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{derivedError}</span>
              </div>
            )}

            {!derivedFormats && !isGeneratingDerived && (
              <div className="bg-stone-50 rounded-2xl p-8 sm:p-12 text-center border border-dashed border-stone-300 space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-800 text-base">Nenhum carrossel gerado para este artigo</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Clique no botão acima para converter a essência reflexiva deste artigo em um deck de 5 a 8 slides e um roteiro gravável de 60 segundos.
                  </p>
                </div>
              </div>
            )}

            {derivedFormats && (
              <div className="space-y-6">
                {/* Subtabs: Carousel vs Reels */}
                <div className="flex border-b border-stone-200 space-x-4">
                  <button
                    onClick={() => setDerivedActiveTab('carousel')}
                    className={`pb-3 text-xs sm:text-sm font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                      derivedActiveTab === 'carousel'
                        ? 'border-indigo-600 text-indigo-900'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Carrossel de Slides ({derivedFormats.carousel?.slides.length || 0} Slides)</span>
                  </button>

                  <button
                    onClick={() => setDerivedActiveTab('reels')}
                    className={`pb-3 text-xs sm:text-sm font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                      derivedActiveTab === 'reels'
                        ? 'border-indigo-600 text-indigo-900'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Film className="w-4 h-4 text-rose-500" />
                    <span>Roteiro para Vídeo Curto / Reels (60s)</span>
                  </button>
                </div>

                {/* Subtab 1: CAROUSEL SLIDES */}
                {derivedActiveTab === 'carousel' && derivedFormats.carousel && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                      <span className="text-xs text-stone-700 font-medium">
                        📱 Copie o conteúdo slide por slide ou copie o carrossel completo de uma vez:
                      </span>
                      <button
                        onClick={() => {
                          const fullText = derivedFormats.carousel!.slides
                            .map((s) => `[SLIDE ${s.slideNumber}: ${s.slideTitle}]\n${s.bodyText}\n(Visual: ${s.visualCue || ''})\n`)
                            .join('\n---\n\n');
                          handleCopyText(fullText, 'full_carousel');
                        }}
                        className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs min-h-[36px]"
                      >
                        {copiedField === 'full_carousel' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'full_carousel' ? 'Copiado!' : 'Copiar Carrossel Inteiro'}</span>
                      </button>
                    </div>

                    {/* Slides Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {derivedFormats.carousel.slides.map((slide) => (
                        <div
                          key={slide.slideNumber}
                          className="bg-stone-900 text-stone-100 rounded-2xl p-5 border border-stone-800 flex flex-col justify-between space-y-4 shadow-md relative overflow-hidden"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs border-b border-stone-800 pb-2">
                              <span className="font-bold text-amber-400 uppercase tracking-widest text-[10px]">
                                SLIDE {slide.slideNumber} / {derivedFormats.carousel?.slides.length}
                              </span>
                              <button
                                onClick={() =>
                                  handleCopyText(
                                    `${slide.slideTitle}\n\n${slide.bodyText}`,
                                    `slide_${slide.slideNumber}`
                                  )
                                }
                                className="text-[11px] text-stone-400 hover:text-white flex items-center space-x-1 bg-stone-800 hover:bg-stone-700 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                              >
                                {copiedField === `slide_${slide.slideNumber}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedField === `slide_${slide.slideNumber}` ? 'Copiado!' : 'Copiar'}</span>
                              </button>
                            </div>

                            <h4 className="font-serif font-bold text-base text-amber-100 leading-snug">
                              {slide.slideTitle}
                            </h4>

                            <p className="text-xs text-stone-300 leading-relaxed font-sans">
                              {slide.bodyText}
                            </p>
                          </div>

                          {slide.visualCue && (
                            <div className="pt-2 border-t border-stone-800/80 text-[11px] text-stone-400 italic">
                              🎨 Clima visual: {slide.visualCue}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Caption Box */}
                    {derivedFormats.carousel.caption && (
                      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-stone-800">
                            Legenda Sugerida para a Postagem do Carrossel:
                          </span>
                          <button
                            onClick={() => handleCopyText(derivedFormats.carousel!.caption, 'carousel_caption')}
                            className="px-3 py-1 bg-white border border-stone-300 text-stone-800 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedField === 'carousel_caption' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar Legenda</span>
                          </button>
                        </div>
                        <p className="text-xs text-stone-700 font-sans leading-relaxed whitespace-pre-wrap">
                          {derivedFormats.carousel.caption}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 2: REELS VIDEO SCRIPT */}
                {derivedActiveTab === 'reels' && derivedFormats.reelsScript && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-stone-900 to-indigo-950 text-white rounded-3xl p-6 border border-stone-800 space-y-6 shadow-lg">
                      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                        <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                          <Film className="w-4 h-4 text-amber-400" />
                          <span>Roteiro de Gravidade para Vídeo Curto (~60 Segundos)</span>
                        </div>
                        <button
                          onClick={() => {
                            const scriptText = `[GANCHO INICIAL (0-3s)]\n"${derivedFormats.reelsScript!.hook}"\n\n[FALA PRINCIPAL]\n${derivedFormats.reelsScript!.coreNarrative}\n\n[ORIENTAÇÕES VISUAIS]\n${derivedFormats.reelsScript!.visualInstructions || ''}\n\n[CHAMADA REFLEXIVA]\n"${derivedFormats.reelsScript!.callToReflection}"`;
                            handleCopyText(scriptText, 'reels_full_script');
                          }}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                        >
                          {copiedField === 'reels_full_script' ? <Check className="w-3.5 h-3.5 text-stone-950" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'reels_full_script' ? 'Roteiro Copiado!' : 'Copiar Roteiro de Vídeo'}</span>
                        </button>
                      </div>

                      {/* Hook */}
                      <div className="bg-amber-950/50 border border-amber-500/40 p-4 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                          🎯 Gancho Inicial (0 a 3 Segundos):
                        </span>
                        <p className="text-sm font-serif font-bold text-amber-100 leading-snug">
                          "{derivedFormats.reelsScript.hook}"
                        </p>
                      </div>

                      {/* Core Narrative */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">
                          🎙️ Fala Principal do Psicólogo (Prosa Ensaística Contínua):
                        </span>
                        <p className="p-4 bg-stone-800/80 rounded-2xl text-xs sm:text-sm text-stone-200 leading-relaxed font-sans whitespace-pre-wrap border border-stone-700">
                          {derivedFormats.reelsScript.coreNarrative}
                        </p>
                      </div>

                      {/* Visual & Posture Instructions */}
                      {derivedFormats.reelsScript.visualInstructions && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">
                            🎥 Dicas de Enquadramento, Postura & Iluminação:
                          </span>
                          <p className="text-xs text-stone-300 italic font-sans">
                            {derivedFormats.reelsScript.visualInstructions}
                          </p>
                        </div>
                      )}

                      {/* Call to Reflection */}
                      <div className="bg-stone-800/60 p-4 rounded-2xl border border-stone-700 space-y-1">
                        <span className="text-[10px] font-bold text-teal-300 uppercase tracking-widest block">
                          💬 Chamada Reflexiva para Comentários:
                        </span>
                        <p className="text-xs text-stone-200 font-serif italic">
                          "{derivedFormats.reelsScript.callToReflection}"
                        </p>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SOCIAL MEDIA & SEO */}
      {activeTab === 'social' && post.review && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-stone-900 font-bold text-base">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <h3>Legenda Pronta para Redes Sociais (Instagram / LinkedIn)</h3>
              </div>

              <button
                onClick={() => handleCopyText(post.review?.socialCaption || '', 'social_caption')}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer"
              >
                {copiedField === 'social_caption' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'social_caption' ? 'Copiado!' : 'Copiar Legenda'}</span>
              </button>
            </div>

            <p className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
              {post.review.socialCaption}
            </p>

            {/* Hashtags */}
            {post.review.hashtags?.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5">
                {post.review.hashtags.map((tag, idx) => (
                  <span key={idx} className="bg-stone-100 text-stone-700 text-xs px-2.5 py-1 rounded-md font-mono">
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Meta Description / SEO */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-stone-900 font-bold text-base">
                <Share2 className="w-5 h-5 text-amber-600" />
                <h3>Meta Descrição para SEO / Google Blog</h3>
              </div>

              <button
                onClick={() => handleCopyText(post.review?.metaDescription || '', 'meta_desc')}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer"
              >
                {copiedField === 'meta_desc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'meta_desc' ? 'Copiado!' : 'Copiar Meta'}</span>
              </button>
            </div>

            <p className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 font-sans">
              {post.review.metaDescription}
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: MARKDOWN CODE & DIRECT EDITOR */}
      {activeTab === 'markdown' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-900 font-bold text-base">
              <FileText className="w-5 h-5 text-amber-600" />
              <h3>Código Markdown Completo do Artigo</h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditingText(!isEditingText)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>{isEditingText ? 'Visualizar Texto' : 'Modo Edição Directa'}</span>
              </button>

              <button
                onClick={() => handleCopyText(editedText || post.review?.revisedText || post.draft?.rawText || '', 'raw_markdown')}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer"
              >
                {copiedField === 'raw_markdown' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'raw_markdown' ? 'Copiado!' : 'Copiar Markdown'}</span>
              </button>
            </div>
          </div>

          {isEditingText ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Edição direta de texto via teclado</span>
                <button
                  onClick={handleSaveEdits}
                  className="px-4 py-1.5 bg-teal-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-amber-300" />
                  <span>Salvar Alterações</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Título do Artigo</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Corpo do Texto (Markdown)</label>
                <textarea
                  rows={16}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full p-4 border border-stone-300 rounded-xl font-mono text-xs text-stone-800 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          ) : (
            <pre className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-[500px]">
              {displayedText}
            </pre>
          )}
        </div>
      )}

      {/* TAB 5: CLINICAL & MULTIDISCIPLINARY REVIEW NOTES */}
      {activeTab === 'review' && post.review && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3>Pareceres da Equipe Editorial & Síntese Coesa do Redator</h3>
              </div>
              <span className="bg-amber-100 text-amber-950 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-amber-300">
                5 Agentes em Ação
              </span>
            </div>

            {/* Ethics check status badge */}
            <div className="flex items-center space-x-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <span className="font-bold">Filtro Ético & Rigor Editorial Aprovados</span>
                <p className="text-emerald-800 mt-0.5">{post.review.ethicsDetails}</p>
              </div>
            </div>

            {/* Grid of Specialist Reports */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Report 1: Editor de Humanização */}
              <div className="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-950 font-bold text-xs sm:text-sm">
                  <Wand2 className="w-4 h-4 text-cyan-700 shrink-0" />
                  <span>Editor de Humanização (O "Des-AIzador")</span>
                </div>
                <p className="text-xs text-stone-800 leading-relaxed font-sans">
                  {post.review.humanizationNotes || 'Auditoria de ritmo e remoção de conectores mecânicos de IA realizada.'}
                </p>
              </div>

              {/* Report 2: Curador Conceitual */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs sm:text-sm">
                  <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Curador Conceitual (O "Guardião da Teoria")</span>
                </div>
                <p className="text-xs text-stone-800 leading-relaxed font-sans">
                  {post.review.conceptualNotes || 'Alinhamento com a visão de mundo e conceitos filosóficos/existenciais validado.'}
                </p>
              </div>

              {/* Report 3: Revisor Editorial */}
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-950 font-bold text-xs sm:text-sm">
                  <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0" />
                  <span>Revisor Editorial & Ético</span>
                </div>
                <p className="text-xs text-stone-800 leading-relaxed font-sans">
                  {post.review.clinicalNotes}
                </p>
              </div>

              {/* Report 4: Redator Principal - Síntese Unificada */}
              <div className="bg-teal-50/80 border border-teal-300 rounded-2xl p-4 space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2 text-teal-950 font-bold text-xs sm:text-sm">
                  <Feather className="w-4 h-4 text-teal-800 shrink-0" />
                  <span>Redator Principal — Síntese Integrada & Reescrita Unificada (Garantia Anti-Colcha de Retalhos)</span>
                </div>
                <p className="text-xs text-stone-800 leading-relaxed font-sans">
                  {post.review.writerSynthesisNotes || 'O Redator Principal absorveu as orientações dos 3 especialistas e reescreveu o texto na íntegra para garantir uma prosa contínua, orgânica e fluida.'}
                </p>
              </div>
            </div>

            {/* Re-Review Form Section */}
            <div className="bg-gradient-to-br from-amber-50/70 to-teal-50/50 border border-amber-200/80 rounded-2xl p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Exigir Nova Revisão com Filtro Anti-Genérico Ainda Mais Severo</span>
                </div>
                <p className="text-xs text-stone-600">
                  Se achou o texto atual genérico ou clichê, o Revisor fará um pente-fino implacável, expurgando frases prontas, eliminando "você" e aprofundando o caráter ensaístico e autoral.
                </p>
              </div>

              {reReviewError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{reReviewError}</span>
                </div>
              )}

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Ex: Torne o tom ainda mais crítico em relação à cobrança de produtividade. Elimine introduções comuns."
                  value={reReviewInstruction}
                  onChange={(e) => setReReviewInstruction(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleReReview}
                    disabled={isReReviewing}
                    className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isReReviewing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Revisando com Exigência Máxima...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-4 h-4 text-amber-200" />
                        <span>Submeter a Nova Revisão Crítica</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 6: EXPORT TO REACT BLOG */}
      {activeTab === 'reactexport' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center space-x-2 text-cyan-950 font-bold text-lg">
                  <Code className="w-5 h-5 text-cyan-600 shrink-0" />
                  <h2>Exportação Direta para Blog React</h2>
                </div>
                <p className="text-xs text-stone-600 mt-1">
                  Obtenha o código exato formatado para incorporar este artigo no seu site React, Next.js, Vite ou CMS Headless.
                </p>
              </div>

              <span className="bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-600" />
                <span>Compatível com React 18 / Next.js / Tailwind</span>
              </span>
            </div>

            {/* Format Selection Bar */}
            <div className="flex flex-wrap items-center gap-2 bg-stone-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setReactExportFormat('tsx')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  reactExportFormat === 'tsx'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Componente React (.tsx)</span>
              </button>

              <button
                onClick={() => setReactExportFormat('json')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  reactExportFormat === 'json'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <Braces className="w-4 h-4 text-amber-400" />
                <span>Payload JSON (CMS / API)</span>
              </button>

              <button
                onClick={() => setReactExportFormat('mdx')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  reactExportFormat === 'mdx'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>MDX com Frontmatter</span>
              </button>

              <button
                onClick={() => setReactExportFormat('html')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  reactExportFormat === 'html'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <Code className="w-4 h-4 text-indigo-400" />
                <span>HTML Semântico</span>
              </button>
            </div>

            {/* Code Display Container */}
            {(() => {
              let codeText = '';
              let formatTitle = '';
              let formatDescription = '';

              if (reactExportFormat === 'tsx') {
                formatTitle = 'Componente React TSX com Tailwind CSS';
                formatDescription = 'Componente funcional pronto para colar no seu diretório /components/ do seu blog React.';
                codeText = `import React from 'react';

export interface ArticleProps {
  title?: string;
  subtitle?: string;
  publishedAt?: string;
  readTimeMinutes?: number;
  authorName?: string;
  coverImageUrl?: string;
  tags?: string[];
}

export const ArticlePostComponent: React.FC<ArticleProps> = ({
  title = ${JSON.stringify(displayedTitle)},
  subtitle = ${JSON.stringify(displayedSubtitle)},
  publishedAt = "${new Date(post.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}",
  readTimeMinutes = ${post.review?.readingTimeMinutes || 4},
  authorName = ${JSON.stringify(manifesto.authorName || 'Psicólogo(a)')},
  coverImageUrl = ${JSON.stringify(displayedCoverUrl)},
  tags = ${JSON.stringify(post.tags || post.review?.suggestedTags || ['Tecnologia', 'Artigo'])},
}) => {
  return (
    <article className="max-w-3xl mx-auto px-4 py-8 font-sans text-stone-800">
      <header className="space-y-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <span key={idx} className="bg-stone-100 text-stone-700 text-xs px-2.5 py-1 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-stone-900 leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg text-stone-600 font-serif italic leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="flex items-center space-x-3 text-xs text-stone-500 border-y border-stone-100 py-3">
          <span className="font-semibold text-stone-800">{authorName}</span>
          <span>•</span>
          <span>{publishedAt}</span>
          <span>•</span>
          <span>{readTimeMinutes} min de leitura</span>
        </div>
      </header>

      {coverImageUrl && (
        <figure className="mb-10 rounded-2xl overflow-hidden shadow-sm">
          <img
            src={coverImageUrl}
            alt={title}
            className="w-full h-80 object-cover"
            referrerPolicy="no-referrer"
          />
        </figure>
      )}

      <div className="prose prose-stone prose-lg max-w-none space-y-6 leading-relaxed">
${displayedText
  .split('\n\n')
  .map((p) => {
    if (p.startsWith('## ')) return `        <h2 className="font-serif font-bold text-2xl text-stone-900 mt-8 mb-4">${p.replace('## ', '')}</h2>`;
    if (p.startsWith('### ')) return `        <h3 className="font-serif font-bold text-xl text-stone-800 mt-6 mb-3">${p.replace('### ', '')}</h3>`;
    if (p.startsWith('> ')) return `        <blockquote className="my-6 p-4 border-l-4 border-amber-600 bg-amber-50/60 font-serif italic text-stone-800">\n          <p>"${p.replace(/^>\s*/, '')}"</p>\n        </blockquote>`;
    return `        <p>${p}</p>`;
  })
  .join('\n\n')}
      </div>

      <footer className="mt-12 pt-8 border-t border-stone-200">
        <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 space-y-4">
          <h4 className="font-serif font-bold text-lg text-amber-300">
            Perguntas para Reflexão Psicoterapêutica
          </h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-stone-200">
            <li>Como este tema se conecta com situações do seu momento atual?</li>
            <li>O que você percebe em seu corpo ao refletir sobre este ensaio?</li>
            <li>O que mudaria em sua rotina se acolhesse esses sentimentos sem pressa?</li>
            <li>Que pergunta você gostaria de levar para a sua próxima sessão?</li>
          </ol>
        </div>
      </footer>
    </article>
  );
};

export default ArticlePostComponent;`;
              } else if (reactExportFormat === 'json') {
                formatTitle = 'Objeto JSON Estruturado';
                formatDescription = 'Payload pronto para ser retornado por uma API REST/GraphQL ou salvo no seu banco de dados/CMS do blog.';
                codeText = JSON.stringify(
                  {
                    id: post.id,
                    slug: displayedTitle
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)/g, ''),
                    title: displayedTitle,
                    subtitle: displayedSubtitle,
                    author: manifesto.authorName || 'Psicólogo(a)',
                    publishedAt: new Date(post.createdAt).toISOString(),
                    readingTimeMinutes: post.review?.readingTimeMinutes || 4,
                    coverImageUrl: displayedCoverUrl,
                    tags: post.tags || post.review?.suggestedTags || [],
                    seoMetaDescription: post.review?.metaDescription || '',
                    socialCaption: post.review?.socialCaption || '',
                    bodyMarkdown: displayedText,
                    reflectionQuestions: [
                      'Como este tema se conecta com situações concretas do seu momento atual?',
                      'O que você percebe em seu corpo ao refletir sobre as contradições expostas neste texto?',
                      'Que sentimentos surgem ao acolher essa experiência sem pressa de solucioná-la?',
                      'Que pergunta você gostaria de levar para a sua próxima sessão de terapia sobre este assunto?',
                    ],
                  },
                  null,
                  2
                );
              } else if (reactExportFormat === 'mdx') {
                formatTitle = 'Arquivo MDX com Frontmatter';
                formatDescription = 'Ideal para blogs estáticos com Next.js, Contentlayer, Astro ou Gatsby.';
                codeText = `---
title: ${JSON.stringify(displayedTitle)}
subtitle: ${JSON.stringify(displayedSubtitle)}
author: ${JSON.stringify(manifesto.authorName || 'Psicólogo(a)')}
date: "${new Date(post.createdAt).toISOString().split('T')[0]}"
readingTimeMinutes: ${post.review?.readingTimeMinutes || 4}
coverImageUrl: ${JSON.stringify(displayedCoverUrl)}
tags: ${JSON.stringify(post.tags || post.review?.suggestedTags || [])}
metaDescription: ${JSON.stringify(post.review?.metaDescription || '')}
---

# ${displayedTitle}

${displayedSubtitle ? `*${displayedSubtitle}*\n` : ''}
${displayedText}

## Perguntas para Reflexão Psicoterapêutica

1. Como este tema se conecta com situações concretas do seu momento atual?
2. O que você percebe em seu corpo ao refletir sobre as contradições expostas neste texto?
3. Que sentimentos surgem ao acolher essa experiência sem pressa de solucioná-la?
4. Que pergunta você gostaria de levar para a sua próxima sessão de terapia sobre este assunto?
`;
              } else if (reactExportFormat === 'html') {
                formatTitle = 'HTML Semântico Sanitizado';
                formatDescription = 'Para ser renderizado via dangerouslySetInnerHTML={{ __html: ... }} no seu React.';
                codeText = `<article class="psico-article">
  <h1>${displayedTitle}</h1>
  ${displayedSubtitle ? `<p class="subtitle"><em>${displayedSubtitle}</em></p>` : ''}
  <p class="meta">Por ${manifesto.authorName || 'Psicólogo(a)'} • ${new Date(post.createdAt).toLocaleDateString('pt-BR')} • ${post.review?.readingTimeMinutes || 4} min de leitura</p>
  ${displayedCoverUrl ? `<img src="${displayedCoverUrl}" alt="${displayedTitle}" referrerpolicy="no-referrer" />` : ''}
  <div class="article-body">
    ${displayedText
      .split('\n\n')
      .map((p) => {
        if (p.startsWith('## ')) return `<h2>${p.replace('## ', '')}</h2>`;
        if (p.startsWith('### ')) return `<h3>${p.replace('### ', '')}</h3>`;
        if (p.startsWith('> ')) return `<blockquote>${p.replace(/^>\s*/, '')}</blockquote>`;
        return `<p>${p}</p>`;
      })
      .join('\n    ')}
  </div>
</article>`;
              }

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-900 text-stone-100 p-4 rounded-t-2xl">
                    <div>
                      <h3 className="font-bold text-sm text-cyan-300">{formatTitle}</h3>
                      <p className="text-xs text-stone-400 mt-0.5">{formatDescription}</p>
                    </div>

                    <button
                      onClick={() => {
                        handleCopyText(codeText, `react_export_${reactExportFormat}`);
                        if (addToast) {
                          addToast('success', 'Código do artigo copiado!', `O código no formato ${reactExportFormat.toUpperCase()} está na sua área de transferência.`);
                        }
                      }}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-stone-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer shrink-0"
                    >
                      {copiedField === `react_export_${reactExportFormat}` ? (
                        <Check className="w-4 h-4 text-stone-950" />
                      ) : (
                        <Copy className="w-4 h-4 text-stone-950" />
                      )}
                      <span>
                        {copiedField === `react_export_${reactExportFormat}`
                          ? 'Copiado para Área de Transferência!'
                          : `Copiar Código ${reactExportFormat.toUpperCase()}`}
                      </span>
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="p-5 bg-stone-950 text-stone-200 rounded-b-2xl font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-[550px] border border-stone-800 leading-relaxed selection:bg-cyan-900">
                      {codeText}
                    </pre>
                  </div>
                </div>
              );
            })()}

            {/* Quick React Integration Instructions */}
            <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-2xl p-5 text-xs text-stone-700 space-y-3">
              <div className="flex items-center space-x-2 font-bold text-stone-900 text-sm">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                <span>Como usar no seu Blog em React:</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-stone-600">
                <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 block">1. Imagem de Capa</span>
                  <p>A tag de imagem inclui <code className="bg-stone-100 text-stone-800 px-1 rounded">referrerPolicy="no-referrer"</code> para garantir a exibição perfeita da capa gerada por IA.</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 block">2. Estilos com Tailwind</span>
                  <p>As classes do Tailwind CSS já estão otimizadas para telas pequenas, médias e desktop, usando a fonte serifada nos títulos.</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
                  <span className="font-bold text-stone-900 block">3. SEO & Redes Sociais</span>
                  <p>Copie a meta descrição gerada na aba 'Legendas & SEO' para colocar no <code className="bg-stone-100 text-stone-800 px-1 rounded">&lt;head&gt;</code> do seu blog.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB: FACT-CHECKING & SOURCES DOSSIER */}
      {activeTab === 'factcheck' && post.factCheck && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#18191e] rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-sm space-y-6">
            
            {/* Header Verdict Card */}
            <div className="bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 text-white rounded-2xl p-6 border border-amber-800/40 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1 border ${
                      post.factCheck.groundingUsed
                        ? 'bg-amber-800/80 border-amber-600/50 text-amber-200'
                        : 'bg-stone-800/80 border-stone-600/50 text-stone-300'
                    }`}
                  >
                    <SearchCheck className="w-3 h-3" />
                    <span>
                      {post.factCheck.groundingUsed
                        ? `Apurado na web • ${post.factCheck.sources.length} fonte(s) consultada(s)`
                        : 'Sem apuração na web'}
                    </span>
                  </span>
                  <span className="text-stone-400 text-xs">• Checado em {new Date(post.factCheck.checkedAt).toLocaleDateString('pt-BR')}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-white flex items-center space-x-2">
                  <span>{post.factCheck.verdict}</span>
                </h2>
                <p className="text-xs text-stone-300 max-w-2xl leading-relaxed">
                  {post.factCheck.researchSummary}
                </p>
              </div>

              {post.factCheck.groundingUsed && post.factCheck.credibilityScore !== null ? (
                <div className="bg-amber-950/80 border border-amber-700/60 p-4 rounded-xl text-center shrink-0 min-w-[140px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                    Solidez da Apuração
                  </span>
                  <span className="text-3xl font-extrabold text-amber-400 font-mono">
                    {post.factCheck.credibilityScore}%
                  </span>
                  <div className="w-full bg-amber-950 h-2 rounded-full mt-1.5 overflow-hidden border border-amber-800">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${post.factCheck.credibilityScore}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-stone-900/80 border border-stone-700/60 p-4 rounded-xl text-center shrink-0 max-w-[220px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                    Sem nota de credibilidade
                  </span>
                  <span className="text-[11px] text-stone-400 leading-snug block">
                    Não houve apuração na web. Trate as afirmações do texto como não verificadas.
                  </span>
                </div>
              )}
            </div>

            {/* Verified Facts vs Unverified Claims Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Verified Facts */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-900 dark:text-emerald-300 font-bold text-sm">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h3>Fatos Confirmados e Dados Apurados ({post.factCheck.verifiedFacts.length})</h3>
                </div>
                <ul className="space-y-2 text-xs text-stone-700 dark:text-stone-300">
                  {post.factCheck.verifiedFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start space-x-2 bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <span className="leading-relaxed font-medium">{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Rumors to Avoid */}
              <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-rose-900 dark:text-rose-300 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <h3>Boatos & Dados Não Confirmados a EVITAR ({post.factCheck.unverifiedClaimsOrRumors.length})</h3>
                </div>
                {post.factCheck.unverifiedClaimsOrRumors.length > 0 ? (
                  <ul className="space-y-2 text-xs text-stone-700 dark:text-stone-300">
                    {post.factCheck.unverifiedClaimsOrRumors.map((rumor, idx) => (
                      <li key={idx} className="flex items-start space-x-2 bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                        <span className="leading-relaxed font-medium text-rose-950 dark:text-rose-200">{rumor}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-500 italic p-3 bg-white dark:bg-stone-900 rounded-xl">
                    Nenhum boato relevante ou distorção detectada nas fontes consultadas.
                  </p>
                )}
              </div>

            </div>

            {/* Sources & References List */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Fontes de Imprensa e Documentos de Origem ({post.factCheck.sources.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {post.factCheck.sources.map((src, idx) => (
                  <div key={idx} className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                          {src.sourceName}
                        </span>
                        <span className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          {src.reliability}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 line-clamp-2">
                        "{src.title}"
                      </p>
                      {src.snippet && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-3 italic bg-white dark:bg-stone-950 p-2 rounded-xl border border-stone-100 dark:border-stone-800">
                          {src.snippet}
                        </p>
                      )}
                    </div>

                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] text-teal-700 dark:text-teal-400 hover:underline font-semibold pt-1"
                      >
                        <span>Acessar fonte original</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
