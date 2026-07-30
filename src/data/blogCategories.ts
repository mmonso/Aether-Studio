import { ArticlePost } from '../types';

// Categorias reconhecidas pelo Aether-Blog. Precisam bater exatamente
// com o type `Category` em Aether-Blog/src/types.ts — é o Studio que
// define a categoria na publicação, o blog não adivinha mais.
export const BLOG_CATEGORIES = [
  'AI & Neural',
  'Quantum & Hardware',
  'Future Systems',
  'Bio-Tech',
  'Cybernetics',
  'Spatial & Creative',
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

const CATEGORY_HINTS: { category: BlogCategory; terms: string[] }[] = [
  {
    category: 'Quantum & Hardware',
    terms: ['quantum', 'quântic', 'hardware', 'chip', 'processador', 'gpu', 'silício', 'semicondutor'],
  },
  {
    category: 'Bio-Tech',
    terms: ['bio', 'neuro', 'cérebro', 'genétic', 'dna', 'saúde', 'médic'],
  },
  {
    category: 'Cybernetics',
    terms: ['cyber', 'segurança', 'security', 'cripto', 'crypto', 'privacidade', 'ataque', 'vulnerabilidade'],
  },
  {
    category: 'Spatial & Creative',
    terms: ['design', 'spatial', 'criativ', 'creative', '3d', 'interface', 'ux', 'realidade aumentada'],
  },
  {
    category: 'Future Systems',
    terms: ['sistema', 'system', 'arquitetura', 'infraestrutura', 'cloud', 'devops', 'escalabilidade', 'distribuíd'],
  },
  {
    category: 'AI & Neural',
    terms: ['ia', 'ai', 'intelig', 'neural', 'llm', 'modelo', 'agente', 'machine learning', 'rede neural'],
  },
];

// Sugestão inicial para o seletor do modal — o autor sempre pode trocar.
export function suggestCategory(post: ArticlePost): BlogCategory {
  const haystack = [
    post.review?.revisedTitle,
    post.draft?.title,
    post.topic,
    ...(post.review?.suggestedTags || []),
    ...(post.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const { category, terms } of CATEGORY_HINTS) {
    if (terms.some((t) => haystack.includes(t))) return category;
  }

  return 'AI & Neural';
}
