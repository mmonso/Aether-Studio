import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Globe,
  Sparkles,
  BookOpen,
  Cpu,
  Brain,
  Utensils,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Blog } from '../types';
import { PRESET_BLOGS } from '../data/presetBlogs';

interface BlogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blogs: Blog[];
  activeBlogId: string;
  onSelectBlog: (id: string) => void;
  onCreateBlog: (
    name: string,
    niche: string,
    description: string,
    authorName: string,
    professionalTitle: string,
    badgeColor: 'teal' | 'indigo' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan',
    presetTemplateId?: string
  ) => void;
  onUpdateBlog: (blog: Blog) => void;
  onDeleteBlog: (id: string) => void;
}

export const BlogManagerModal: React.FC<BlogManagerModalProps> = ({
  isOpen,
  onClose,
  blogs,
  activeBlogId,
  onSelectBlog,
  onCreateBlog,
  onUpdateBlog,
  onDeleteBlog,
}) => {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedBlogId, setCopiedBlogId] = useState<string | null>(null);

  // New Blog Form state
  const [newBlogName, setNewBlogName] = useState('');
  const [newBlogNiche, setNewBlogNiche] = useState('');
  const [newBlogDesc, setNewBlogDesc] = useState('');
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newProTitle, setNewProTitle] = useState('');
  const [newBadgeColor, setNewBadgeColor] = useState<
    'teal' | 'indigo' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan'
  >('teal');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('blog_studio_editorial');

  if (!isOpen) return null;

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRESET_BLOGS.find((p) => p.id === presetId);
    if (preset) {
      setNewBlogName(preset.name);
      setNewBlogNiche(preset.niche);
      setNewBlogDesc(preset.description);
      setNewAuthorName(preset.authorName);
      setNewProTitle(preset.professionalTitle);
      setNewBadgeColor(preset.badgeColor);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlogName.trim() || !newBlogNiche.trim()) return;

    onCreateBlog(
      newBlogName.trim(),
      newBlogNiche.trim(),
      newBlogDesc.trim(),
      newAuthorName.trim() || 'Autor(a)',
      newProTitle.trim() || 'Especialista',
      newBadgeColor,
      selectedPresetId
    );

    // Reset and close or return to list
    resetCreateForm();
    setView('list');
  };

  const resetCreateForm = () => {
    setNewBlogName('');
    setNewBlogNiche('');
    setNewBlogDesc('');
    setNewAuthorName('');
    setNewProTitle('');
    setSelectedPresetId('blog_tech_pulse');
    setNewBadgeColor('teal');
  };

  const handleStartEdit = (blog: Blog) => {
    setEditingBlog({ ...blog });
    setView('edit');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlog) return;
    onUpdateBlog(editingBlog);
    setEditingBlog(null);
    setView('list');
  };

  const getBadgeColorClasses = (color?: string) => {
    switch (color) {
      case 'indigo':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'amber':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'rose':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'violet':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border-violet-200 dark:border-violet-800';
      case 'cyan':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      default:
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-teal-200 dark:border-teal-800';
    }
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Cpu':
        return <Cpu className="w-5 h-5" />;
      case 'Brain':
        return <Brain className="w-5 h-5" />;
      case 'Utensils':
        return <Utensils className="w-5 h-5" />;
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#18191e] border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-stone-800 border border-teal-200 dark:border-stone-700 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
                {view === 'list' && 'Gerenciador de Blogs & Workspaces'}
                {view === 'create' && 'Criar Novo Blog com Equipe Virtual'}
                {view === 'edit' && `Editar Blog: ${editingBlog?.name}`}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {view === 'list' && 'Alterne entre seus blogs ou crie um novo para qualquer nicho'}
                {view === 'create' && 'Escolha um modelo de nicho ou configure do zero'}
                {view === 'edit' && 'Ajuste os dados básicos e perfil do autor'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* VIEW: LIST OF BLOGS */}
          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Seus Blogs Ativos ({blogs.length})
                </span>
                <button
                  onClick={() => {
                    handleApplyPreset('blog_tech_pulse');
                    setView('create');
                  }}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Blog</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {blogs.map((blog) => {
                  const isActive = blog.id === activeBlogId;
                  const isDeleting = deletingId === blog.id;

                  return (
                    <div
                      key={blog.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isActive
                          ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/20 shadow-xs'
                          : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div
                        onClick={() => {
                          onSelectBlog(blog.id);
                          onClose();
                        }}
                        className="flex items-start space-x-3.5 cursor-pointer flex-1"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${getBadgeColorClasses(
                            blog.badgeColor
                          )}`}
                        >
                          {renderIcon(blog.iconName)}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <h4 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-base">
                              {blog.name}
                            </h4>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeColorClasses(
                                blog.badgeColor
                              )}`}
                            >
                              {blog.niche}
                            </span>
                            {isActive && (
                              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white">
                                <Check className="w-3 h-3 mr-1" /> Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                            {blog.description}
                          </p>
                          <p className="text-[11px] text-stone-400 dark:text-stone-500 pt-0.5">
                            Autor: <strong className="text-stone-700 dark:text-stone-300">{blog.authorName}</strong> ({blog.professionalTitle})
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => {
                            const publicUrl = `${window.location.origin}${window.location.pathname}?blog=${blog.id}`;
                            navigator.clipboard.writeText(publicUrl);
                            setCopiedBlogId(blog.id);
                            setTimeout(() => setCopiedBlogId(null), 2500);
                          }}
                          className={`px-2.5 py-1.5 font-medium text-xs rounded-xl flex items-center space-x-1 transition-all cursor-pointer border ${
                            copiedBlogId === blog.id
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                          }`}
                          title="Copiar link individual exclusivo para leitores deste blog"
                        >
                          <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>{copiedBlogId === blog.id ? '✓ Copiado!' : 'Link Leitores'}</span>
                        </button>

                        {!isActive && (
                          <button
                            onClick={() => {
                              onSelectBlog(blog.id);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white font-medium text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                          >
                            Selecionar
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(blog)}
                          title="Editar dados"
                          className="p-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {blogs.length > 1 && (
                          <>
                            {isDeleting ? (
                              <div className="flex items-center space-x-1 bg-red-50 dark:bg-red-950/40 p-1 rounded-xl border border-red-200 dark:border-red-900">
                                <span className="text-[10px] text-red-600 dark:text-red-400 px-1 font-semibold">Excluir?</span>
                                <button
                                  onClick={() => {
                                    onDeleteBlog(blog.id);
                                    setDeletingId(null);
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded-lg cursor-pointer"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-1 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] rounded-lg cursor-pointer"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(blog.id)}
                                title="Excluir blog"
                                className="p-2 text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: CREATE NEW BLOG */}
          {view === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-6">
              
              {/* Preset selection cards */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>Escolha um modelo de nicho com linha editorial pré-configurada:</span>
                  <span className="text-[11px] text-teal-600 dark:text-teal-400 font-normal">
                    Ou personalize do seu jeito
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRESET_BLOGS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500'
                            : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 border ${getBadgeColorClasses(preset.badgeColor)}`}>
                          {renderIcon(preset.iconName)}
                        </div>
                        <div className="space-y-0.5">
                          <h5 className="font-serif font-bold text-xs text-stone-900 dark:text-stone-100">
                            {preset.name}
                          </h5>
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 block">
                            {preset.niche}
                          </span>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-1">
                            {preset.authorName} • {preset.professionalTitle}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Nome do Blog *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBlogName}
                    onChange={(e) => setNewBlogName(e.target.value)}
                    placeholder="Ex: Tech Pulse, Psicologia Viva, Gastronomia Afetiva..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Nicho de Atuação / Assunto *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBlogNiche}
                    onChange={(e) => setNewBlogNiche(e.target.value)}
                    placeholder="Ex: Tecnologia & IA, Culinária, Finanças..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Cor Destaque
                  </label>
                  <select
                    value={newBadgeColor}
                    onChange={(e) => setNewBadgeColor(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100 cursor-pointer"
                  >
                    <option value="teal">Verde Teal (Menta / Saúde / Psicologia)</option>
                    <option value="indigo">Índigo (Tecnologia / Futuro)</option>
                    <option value="amber">Âmbar (Gastronomia / Calor)</option>
                    <option value="rose">Rose (Finanças / Estilo de Vida)</option>
                    <option value="emerald">Esmeralda (Sustentabilidade)</option>
                    <option value="violet">Violeta (Arte & Cinema)</option>
                    <option value="cyan">Ciano (Inovação Digital)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Nome do Autor Principal
                  </label>
                  <input
                    type="text"
                    value={newAuthorName}
                    onChange={(e) => setNewAuthorName(e.target.value)}
                    placeholder="Ex: Lucas Mendes, Dra. Helena Santos..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Título / Profissão do Autor
                  </label>
                  <input
                    type="text"
                    value={newProTitle}
                    onChange={(e) => setNewProTitle(e.target.value)}
                    placeholder="Ex: Engenheiro de IA, Psicóloga Clínica, Chef..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Descrição Curta do Blog
                  </label>
                  <textarea
                    rows={2}
                    value={newBlogDesc}
                    onChange={(e) => setNewBlogDesc(e.target.value)}
                    placeholder="Resumo sobre o propósito do blog e o tipo de artigos publicados..."
                    className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center space-x-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Criar e Ativar Blog</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW: EDIT EXISTING BLOG */}
          {view === 'edit' && editingBlog && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Nome do Blog
                  </label>
                  <input
                    type="text"
                    required
                    value={editingBlog.name}
                    onChange={(e) => setEditingBlog({ ...editingBlog, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Nicho de Atuação
                  </label>
                  <input
                    type="text"
                    required
                    value={editingBlog.niche}
                    onChange={(e) => setEditingBlog({ ...editingBlog, niche: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Cor Destaque
                  </label>
                  <select
                    value={editingBlog.badgeColor || 'teal'}
                    onChange={(e) =>
                      setEditingBlog({ ...editingBlog, badgeColor: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100 cursor-pointer"
                  >
                    <option value="teal">Verde Teal</option>
                    <option value="indigo">Índigo</option>
                    <option value="amber">Âmbar</option>
                    <option value="rose">Rose</option>
                    <option value="emerald">Esmeralda</option>
                    <option value="violet">Violeta</option>
                    <option value="cyan">Ciano</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Nome do Autor
                  </label>
                  <input
                    type="text"
                    value={editingBlog.authorName}
                    onChange={(e) =>
                      setEditingBlog({
                        ...editingBlog,
                        authorName: e.target.value,
                        manifesto: { ...editingBlog.manifesto, authorName: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Título Profissional
                  </label>
                  <input
                    type="text"
                    value={editingBlog.professionalTitle}
                    onChange={(e) =>
                      setEditingBlog({
                        ...editingBlog,
                        professionalTitle: e.target.value,
                        manifesto: { ...editingBlog.manifesto, professionalTitle: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Descrição Curta
                  </label>
                  <textarea
                    rows={2}
                    value={editingBlog.description}
                    onChange={(e) => setEditingBlog({ ...editingBlog, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
