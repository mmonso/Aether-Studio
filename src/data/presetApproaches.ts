import { VisualStyleOption } from '../types';

export interface AgentPromptsData {
  writerSystemPrompt: string;
  reviewerSystemPrompt: string;
  imageDesignerSystemPrompt: string;
}

export const VISUAL_STYLES: VisualStyleOption[] = [
  {
    id: 'tech_minimalist_vector',
    name: 'Ilustração Tech Minimalista',
    description: 'Formas geométricas limpas, paleta moderna dark/slate, elementos abstratos de rede e código.',
    previewColor: 'from-teal-900 to-slate-900 border-teal-500 text-teal-200',
    promptModifier: 'Modern minimal vector illustration for a tech software engineering blog, sleek geometric network nodes, clean code aesthetic, dark slate background with cyan and teal accents, high editorial design, flat vector art.'
  },
  {
    id: 'cyber_blueprint',
    name: 'Blueprint & Arquitetura',
    description: 'Estilo esquemático técnico, linhas sutis de circuito e diagramas de sistemas com brilho neocian.',
    previewColor: 'from-cyan-950 to-blue-900 border-cyan-400 text-cyan-200',
    promptModifier: 'Technical system architecture blueprint style, glowing neon cyan lines on dark navy background, subtle circuit traces, data flow vectors, clean developer aesthetic, high-tech engineering diagram.'
  },
  {
    id: 'editorial_3d_render',
    name: 'Render 3D Editorial Tech',
    description: 'Formas 3D suavemente renderizadas, vidro fosco, iluminação volumétrica e estética de tecnologia premium.',
    previewColor: 'from-indigo-900 to-purple-950 border-indigo-400 text-indigo-200',
    promptModifier: 'Sleek 3D geometric render for an AI and software engineering article, glassmorphism textures, glowing floating spheres, dark sophisticated lighting, Octane render quality, premium tech publication aesthetic.'
  },
  {
    id: 'modern_tech_photography',
    name: 'Fotografia Workspace Dev',
    description: 'Ambiente realista de desenvolvedor, monitor com código no escuro, iluminação ambiente sutil.',
    previewColor: 'from-stone-900 to-amber-950 border-amber-500 text-amber-200',
    promptModifier: 'Cinematic photography of a modern software engineer workstation, glowing dark-mode IDE code editor on monitor screen, mechanical keyboard, subtle warm desk ambient lighting, shallow depth of field, professional tech photo.'
  },
  {
    id: 'abstract_data_mesh',
    name: 'Malha de Dados & IA Abstrata',
    description: 'Fluxos abstratos de dados, conexões neurais e gradientes dinâmicos de inteligência artificial.',
    previewColor: 'from-emerald-950 to-teal-900 border-emerald-400 text-emerald-200',
    promptModifier: 'Abstract artificial intelligence neural network mesh, glowing interconnected data nodes, fluid light trails, dark futuristic background, vibrant teal and emerald gradients, high tech digital art.'
  }
];

export const DEFAULT_AGENT_PROMPTS: AgentPromptsData = {
  writerSystemPrompt: `Você é o REDATOR VIRTUAL ESPECIALISTA EM TECNOLOGIA E ENGENHARIA DE SOFTWARE do blog.
Seu objetivo é criar um artigo envolvente, bem estruturado e focado em tecnologia, inteligência artificial e arquitetura, adaptado rigorosamente à visão de mundo e tom de voz informados.`,

  reviewerSystemPrompt: `Você é o REVISOR EDITORIAL E DE ARQUITETURA TECH.
Sua missão é analisar o artigo do Redator garantindo clareza técnica, precisão conceitual e alinhamento com a visão de mundo do autor.`,

  imageDesignerSystemPrompt: `Você é o DESIGNER VISUAL EDITORIAL especializado em blogs de Tecnologia e Inovação.
Sua tarefa é analisar o título e resumo do artigo e construir um prompt extremamente detalhado em inglês para geração de imagem conceitual.`
};
