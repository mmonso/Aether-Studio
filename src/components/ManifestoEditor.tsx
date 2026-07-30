import React, { useState } from 'react';
import { UserManifesto } from '../types';
import { DEFAULT_USER_MANIFESTO } from '../lib/storage';
import {
  Heart,
  Save,
  CheckCircle2,
  Sparkles,
  User,
  Lightbulb,
  Tag,
  BookOpen,
  RotateCcw,
} from 'lucide-react';

interface ManifestoEditorProps {
  manifesto: UserManifesto;
  onSave: (updated: UserManifesto) => void;
}

export const ManifestoEditor: React.FC<ManifestoEditorProps> = ({ manifesto, onSave }) => {
  const [formData, setFormData] = useState<UserManifesto>(manifesto);
  const [newKeyword, setNewKeyword] = useState('');
  const [newProhibited, setNewProhibited] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const addCategory = () => {
    if (!newCategory.trim()) return;
    setFormData((prev) => ({
      ...prev,
      themeCategories: [...(prev.themeCategories || []), newCategory.trim()],
    }));
    setNewCategory('');
  };

  const removeCategory = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      themeCategories: (prev.themeCategories || []).filter((_, i) => i !== idx),
    }));
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    setFormData((prev) => ({
      ...prev,
      favoriteKeywords: [...prev.favoriteKeywords, newKeyword.trim()],
    }));
    setNewKeyword('');
  };

  const removeKeyword = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      favoriteKeywords: prev.favoriteKeywords.filter((_, i) => i !== idx),
    }));
  };

  const addProhibited = () => {
    if (!newProhibited.trim()) return;
    setFormData((prev) => ({
      ...prev,
      prohibitedTerms: [...prev.prohibitedTerms, newProhibited.trim()],
    }));
    setNewProhibited('');
  };

  const removeProhibited = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      prohibitedTerms: prev.prohibitedTerms.filter((_, i) => i !== idx),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 py-4">
      
      {/* Header Banner - Minimalist */}
      <div className="bg-[#f5f3ef] dark:bg-[#1a1816] text-stone-900 dark:text-stone-100 rounded-md p-6 sm:p-8 border border-[#e5e0d8] dark:border-[#2a2724] space-y-3">
        <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 text-xs font-medium uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sua Identidade & Estilo Único</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 leading-relaxed">
          Sua Visão de Mundo & Tom de Voz
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e5e0d8] dark:border-[#2a2724]">
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xl leading-relaxed">
            Sua equipe virtual (Redator, Revisor e Designer) consultará este manifesto em <strong>cada artigo gerado</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Deseja carregar a linha editorial padrão completa?')) {
                setFormData(DEFAULT_USER_MANIFESTO);
              }
            }}
            className="px-3 py-1.5 bg-[#e8e4dc] dark:bg-[#25221f] hover:bg-[#dfd9ce] text-stone-800 dark:text-stone-200 text-xs font-medium rounded border border-[#dfd9ce] dark:border-[#302d29] flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 opacity-70" />
            <span>Carregar Manifesto Padrão</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="bg-[#e8f0e8] dark:bg-[#1b2b1d] border border-[#d0e0d0] dark:border-[#2a402c] text-emerald-800 dark:text-emerald-300 text-xs font-medium p-3 rounded flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Sua visão de mundo foi salva com sucesso!</span>
          </div>
        )}
      </div>

      {/* SECTION 1: PERFIL DO AUTOR */}
      <div className="bg-[#faf9f6] dark:bg-[#181715] rounded-md p-6 sm:p-8 border border-[#e8e5de] dark:border-[#282522] space-y-6">
        <div className="flex items-center space-x-2 text-stone-900 dark:text-stone-100 font-serif font-semibold text-base sm:text-lg border-b border-[#e8e5de] dark:border-[#282522] pb-3">
          <User className="w-4 h-4 text-stone-600 dark:text-stone-400" />
          <h2>1. Quem é Você</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Seu Nome / Assinatura
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Dra. Juliana Silveira"
              value={formData.authorName}
              onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-stone-900 dark:text-stone-100 text-sm font-normal focus:outline-none focus:border-stone-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Título Profissional
            </label>
            <input
              type="text"
              placeholder="Ex: Engenheira de Software • Arquitetura de Sistemas"
              value={formData.professionalTitle}
              onChange={(e) => setFormData({ ...formData, professionalTitle: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-stone-900 dark:text-stone-100 text-sm font-normal focus:outline-none focus:border-stone-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            Descrição do Leitor Ideal (Público-Alvo)
          </label>
          <input
            type="text"
            placeholder="Ex: Pessoas com cobrança pessoal elevada, ansiedade cotidiana, buscando autocompaixão..."
            value={formData.targetAudienceDescription}
            onChange={(e) => setFormData({ ...formData, targetAudienceDescription: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-stone-900 dark:text-stone-100 text-sm font-normal focus:outline-none focus:border-stone-500"
          />
        </div>
      </div>

      {/* SECTION 2: A MINHA VISÃO DE MUNDO & FILOSOFIA */}
      <div className="bg-[#faf9f6] dark:bg-[#181715] rounded-md p-6 sm:p-8 border border-[#e8e5de] dark:border-[#282522] space-y-6">
        <div className="flex items-center space-x-2 text-stone-900 dark:text-stone-100 font-serif font-semibold text-base sm:text-lg border-b border-[#e8e5de] dark:border-[#282522] pb-3">
          <BookOpen className="w-4 h-4 text-stone-600 dark:text-stone-400" />
          <h2>2. Minha Visão de Mundo & Filosofia</h2>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            Descreva detalhadamente sua visão sobre o ser humano e o processo de transformação *
          </label>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Seja espontâneo(a)! Explique no que você acredita e como aborda as questões do seu nicho.
          </p>
          <textarea
            rows={6}
            required
            placeholder="Descreva aqui sua visão de mundo com detalhes..."
            value={formData.worldviewDescription}
            onChange={(e) => setFormData({ ...formData, worldviewDescription: e.target.value })}
            className="w-full p-3.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-stone-900 dark:text-stone-100 text-sm leading-relaxed font-sans focus:outline-none focus:border-stone-500 transition-all"
          />
        </div>

        {/* Tone of voice */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            Tom de Voz Principal
          </label>
          <input
            type="text"
            placeholder="Ex: Acolhedor, poético, humano, fundamentado mas prático..."
            value={formData.toneOfVoice}
            onChange={(e) => setFormData({ ...formData, toneOfVoice: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-stone-900 dark:text-stone-100 text-sm font-normal focus:outline-none focus:border-stone-500"
          />
        </div>
      </div>

      {/* SECTION 3: VOCABULÁRIO PERSONALIZADO & TERMOS PROIBIDOS */}
      <div className="bg-[#faf9f6] dark:bg-[#181715] rounded-md p-6 sm:p-8 border border-[#e8e5de] dark:border-[#282522] space-y-6">
        <div className="flex items-center space-x-2 text-stone-900 dark:text-stone-100 font-serif font-semibold text-base sm:text-lg border-b border-[#e8e5de] dark:border-[#282522] pb-3">
          <Tag className="w-4 h-4 text-stone-600 dark:text-stone-400" />
          <h2>3. Dicionário Pessoal & Termos a Evitar</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Favorite keywords */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center space-x-1">
              <Lightbulb className="w-3.5 h-3.5 text-stone-500" />
              <span>Vocabulário Preferido</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ex: Ressignificação"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                className="flex-1 px-3 py-2 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs text-stone-900 dark:text-stone-100"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="px-3 py-2 bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 text-xs font-medium rounded"
              >
                + Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.favoriteKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="bg-[#f0ede6] dark:bg-[#22201d] text-stone-800 dark:text-stone-200 text-xs px-2.5 py-1 rounded border border-[#e0dad0] dark:border-[#2a2724] flex items-center space-x-1"
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => removeKeyword(i)}
                    className="text-stone-400 hover:text-stone-700 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Prohibited terms */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center space-x-1">
              <span>Termos Proibidos / Clichês a Evitar</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ex: Mente de mestre, mindset..."
                value={newProhibited}
                onChange={(e) => setNewProhibited(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addProhibited();
                  }
                }}
                className="flex-1 px-3 py-2 bg-white dark:bg-[#121110] border border-[#e0dad0] dark:border-[#2a2724] rounded text-xs text-stone-900 dark:text-stone-100"
              />
              <button
                type="button"
                onClick={addProhibited}
                className="px-3 py-2 bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 text-xs font-medium rounded"
              >
                + Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.prohibitedTerms.map((term, i) => (
                <span
                  key={i}
                  className="bg-[#f0ede6] dark:bg-[#22201d] text-stone-800 dark:text-stone-200 text-xs px-2.5 py-1 rounded border border-[#e0dad0] dark:border-[#2a2724] flex items-center space-x-1"
                >
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={() => removeProhibited(i)}
                    className="text-stone-400 hover:text-stone-700 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* SAVE BUTTON */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="px-6 py-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-100 dark:text-stone-900 font-medium text-xs rounded transition-all flex items-center space-x-2 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Salvar Manifesto Editorial</span>
        </button>
      </div>

    </form>
  );
};
