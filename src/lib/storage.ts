import { ArticlePost, UserManifesto, Blog } from '../types';
import { PRESET_BLOGS } from '../data/presetBlogs';

/**
 * Camada de dados do Studio.
 *
 * Antes era o `localStorage` inteiro. Agora fala com o backend, que fala com o
 * Supabase — o front nunca alcança o banco direto, porque a `service_role`
 * ignora RLS e não pode ir para o navegador.
 *
 * O que SOBROU no localStorage é só preferência de interface: qual blog está
 * aberto e qual tema. Nada aqui é fonte de verdade; se o navegador for limpo,
 * o Studio reabre no primeiro blog e nada se perde.
 *
 * Tudo que toca a rede é assíncrono. Não há versão síncrona de propósito:
 * uma que "às vezes" devolve cache é como o histórico se perdia antes.
 */

const ACTIVE_BLOG_KEY = 'techstudio_active_id_v3';

export const DEFAULT_USER_MANIFESTO: UserManifesto = PRESET_BLOGS[0].manifesto;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `Falha em ${path} (HTTP ${res.status}).`);
  }

  return json as T;
}

// -----------------------------------------------------------------
// BLOGS
// -----------------------------------------------------------------

export async function fetchBlogs(): Promise<Blog[]> {
  const { blogs } = await api<{ blogs: Blog[] }>('/api/studio/blogs');
  return blogs;
}

/** Cria ou atualiza. O manifesto vai junto, para `blog_secrets`. */
export async function saveBlog(blog: Blog): Promise<void> {
  await api(`/api/studio/blogs/${encodeURIComponent(blog.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ blog }),
  });
}

export async function deleteBlog(blogId: string): Promise<void> {
  await api(`/api/studio/blogs/${encodeURIComponent(blogId)}`, { method: 'DELETE' });
}

/** Monta um blog novo a partir de um manifesto. Ainda não persiste. */
export function buildNewBlog(
  name: string,
  niche: string,
  description: string,
  manifesto: UserManifesto
): Blog {
  const now = new Date().toISOString();
  return {
    id: `blog_${Date.now()}`,
    name,
    niche,
    description,
    authorName: manifesto.authorName || '',
    professionalTitle: manifesto.professionalTitle || '',
    badgeColor: 'teal',
    iconName: 'Cpu',
    createdAt: now,
    updatedAt: now,
    manifesto,
  };
}

// -----------------------------------------------------------------
// BLOG ATIVO — preferência de interface, não dado
// -----------------------------------------------------------------

export function getActiveBlogId(): string {
  try {
    return localStorage.getItem(ACTIVE_BLOG_KEY) || '';
  } catch {
    return '';
  }
}

export function setActiveBlogId(id: string): string {
  try {
    localStorage.setItem(ACTIVE_BLOG_KEY, id);
  } catch {
    /* modo privado sem storage: a escolha vale só nesta sessão */
  }
  return id;
}

// -----------------------------------------------------------------
// MANIFESTO
// -----------------------------------------------------------------

/** O manifesto mora dentro do blog; salvar é salvar o blog. */
export async function saveManifesto(
  blog: Blog,
  manifesto: UserManifesto
): Promise<Blog> {
  const updated: Blog = {
    ...blog,
    manifesto,
    authorName: manifesto.authorName || blog.authorName,
    professionalTitle: manifesto.professionalTitle || blog.professionalTitle,
    updatedAt: new Date().toISOString(),
  };

  await saveBlog(updated);
  return updated;
}

// -----------------------------------------------------------------
// ARTIGOS — o histórico do Studio, em `article_jobs`
// -----------------------------------------------------------------

/**
 * Por que `article_jobs` e não `posts.raw_json`: o ArticlePost carrega
 * pareceres do comitê, dossiê de fact-check e prompts. O `raw_json` fica
 * público no instante em que o artigo é publicado (achado #3). `article_jobs`
 * tem RLS ligada e nenhuma policy — nunca é público, em estado nenhum.
 */
export async function fetchArticles(blogId?: string): Promise<ArticlePost[]> {
  const query = blogId ? `?blogId=${encodeURIComponent(blogId)}` : '';
  const { articles } = await api<{ articles: ArticlePost[] }>(
    `/api/studio/articles${query}`
  );
  return articles;
}

export async function saveArticle(article: ArticlePost): Promise<void> {
  await api(`/api/studio/articles/${encodeURIComponent(article.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ article }),
  });
}

export async function deleteArticle(id: string): Promise<void> {
  await api(`/api/studio/articles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
