import { ArticlePost, UserManifesto, AgentPrompts, Blog } from '../types';
import { PRESET_BLOGS } from '../data/presetBlogs';
import { INITIAL_SAMPLE_POSTS } from '../data/initialSamplePosts';

const BLOGS_KEY = 'techstudio_blogs_v3';
const ACTIVE_BLOG_KEY = 'techstudio_active_id_v3';
const POSTS_KEY = 'techstudio_posts_v3';
const MANIFESTO_KEY = 'techstudio_user_manifesto_v3';
const PROMPTS_KEY = 'techstudio_agent_prompts_v3';

export const DEFAULT_USER_MANIFESTO: UserManifesto = PRESET_BLOGS[0].manifesto;

export const DEFAULT_AGENT_PROMPTS: AgentPrompts = {
  writerSystemPrompt:
    'Você é o Redator Virtual Especialista em Tecnologia e Engenharia de Software. Sua missão é escrever ensaios técnicos profundos, didáticos e com visão crítica sobre inovação.',
  reviewerSystemPrompt:
    'Você é o Revisor Editorial e de Arquitetura Tech. Sua missão é garantir rigor técnico, clareza conceitual, eliminação de clichês de IA e excelente alinhamento de engenharia.',
  imageDesignerSystemPrompt:
    'Você é o Designer Visual Editorial Tech. Sua missão é criar metáforas visuais conceituais e elegantes para artigos de tecnologia e IA.',
};

// -----------------------------------------------------------------
// BLOGS MULTI-WORKSPACE STORAGE
// -----------------------------------------------------------------

export function getStoredBlogs(): Blog[] {
  try {
    const data = localStorage.getItem(BLOGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b: any) => ({
          ...b,
          manifesto: b.manifesto || PRESET_BLOGS[0].manifesto,
        }));
      }
    }
  } catch (e) {
    console.error('Error reading blogs from storage:', e);
  }

  // Fallback: Initialize with preset blogs
  const now = new Date().toISOString();
  const initialBlogs: Blog[] = PRESET_BLOGS.map((pb) => ({
    id: pb.id,
    name: pb.name,
    niche: pb.niche,
    description: pb.description,
    authorName: pb.authorName,
    professionalTitle: pb.professionalTitle,
    badgeColor: pb.badgeColor,
    iconName: pb.iconName,
    createdAt: now,
    updatedAt: now,
    manifesto: pb.manifesto,
  }));

  saveBlogsToStorage(initialBlogs);
  return initialBlogs;
}

export function saveBlogsToStorage(blogs: Blog[]): Blog[] {
  try {
    localStorage.setItem(BLOGS_KEY, JSON.stringify(blogs));
  } catch (e) {
    console.error('Error saving blogs to storage:', e);
  }
  return blogs;
}

export function getStoredActiveBlogId(): string {
  try {
    const activeId = localStorage.getItem(ACTIVE_BLOG_KEY);
    const blogs = getStoredBlogs();
    if (activeId && blogs.some((b) => b.id === activeId)) {
      return activeId;
    }
    if (blogs.length > 0) {
      return blogs[0].id;
    }
  } catch (e) {
    console.error('Error reading active blog id:', e);
  }
  return PRESET_BLOGS[0].id;
}

export function saveActiveBlogId(id: string): string {
  try {
    localStorage.setItem(ACTIVE_BLOG_KEY, id);
  } catch (e) {
    console.error('Error saving active blog id:', e);
  }
  return id;
}

export const saveActiveBlogIdToStorage = saveActiveBlogId;

export function createNewBlog(
  name: string,
  niche: string,
  description: string,
  authorName: string,
  professionalTitle: string,
  badgeColor: 'teal' | 'indigo' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan',
  presetTemplateId?: string
): Blog {
  const blogs = getStoredBlogs();
  const now = new Date().toISOString();

  // Pick manifesto template if selected, or default
  const presetMatch = PRESET_BLOGS.find((p) => p.id === presetTemplateId);
  const baseManifesto = presetMatch ? { ...presetMatch.manifesto } : { ...DEFAULT_USER_MANIFESTO };

  baseManifesto.authorName = authorName;
  baseManifesto.professionalTitle = professionalTitle;

  const newBlog: Blog = {
    id: `blog_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name,
    niche,
    description,
    authorName,
    professionalTitle,
    badgeColor,
    createdAt: now,
    updatedAt: now,
    manifesto: baseManifesto,
  };

  const updated = [newBlog, ...blogs];
  saveBlogsToStorage(updated);
  saveActiveBlogId(newBlog.id);

  return newBlog;
}

export const createBlogInStorage = createNewBlog;

export function updateBlogInStorage(updatedBlog: Blog): Blog[] {
  const blogs = getStoredBlogs();
  const index = blogs.findIndex((b) => b.id === updatedBlog.id);
  let updatedList: Blog[];

  if (index >= 0) {
    updatedList = [...blogs];
    updatedList[index] = {
      ...updatedBlog,
      updatedAt: new Date().toISOString(),
    };
  } else {
    updatedList = [updatedBlog, ...blogs];
  }

  saveBlogsToStorage(updatedList);
  return updatedList;
}

export function deleteBlogFromStorage(blogId: string): { remainingBlogs: Blog[]; newActiveId: string } {
  const blogs = getStoredBlogs();
  const remaining = blogs.filter((b) => b.id !== blogId);

  // Clean up posts belonging to deleted blog or reassign
  saveBlogsToStorage(remaining);

  const activeId = getStoredActiveBlogId();
  let newActiveId = activeId;
  if (activeId === blogId) {
    newActiveId = remaining.length > 0 ? remaining[0].id : PRESET_BLOGS[0].id;
    saveActiveBlogId(newActiveId);
  }

  return { remainingBlogs: remaining, newActiveId };
}

// -----------------------------------------------------------------
// MANIFESTO BACKWARDS COMPATIBILITY
// -----------------------------------------------------------------

export function getStoredManifesto(blogId?: string): UserManifesto {
  const blogs = getStoredBlogs();
  const targetId = blogId || getStoredActiveBlogId();
  const targetBlog = blogs.find((b) => b.id === targetId);

  if (targetBlog) {
    return targetBlog.manifesto;
  }
  return DEFAULT_USER_MANIFESTO;
}

export function saveManifestoToStorage(manifesto: UserManifesto, blogId?: string): UserManifesto {
  const blogs = getStoredBlogs();
  const targetId = blogId || getStoredActiveBlogId();
  const targetBlog = blogs.find((b) => b.id === targetId);

  if (targetBlog) {
    targetBlog.manifesto = manifesto;
    targetBlog.authorName = manifesto.authorName || targetBlog.authorName;
    targetBlog.professionalTitle = manifesto.professionalTitle || targetBlog.professionalTitle;
    updateBlogInStorage(targetBlog);
  }

  return manifesto;
}

// -----------------------------------------------------------------
// POSTS STORAGE
// -----------------------------------------------------------------

export function getStoredPosts(): ArticlePost[] {
  try {
    const data = localStorage.getItem(POSTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading posts from storage:', e);
  }

  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Error saving initial empty posts:', e);
  }
  return [];
}

export function clearAllPostsFromStorage(): ArticlePost[] {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Error clearing posts from storage:', e);
  }
  return [];
}

export function savePostToStorage(post: ArticlePost): ArticlePost[] {
  const current = getStoredPosts();
  const index = current.findIndex((p) => p.id === post.id);
  let updated: ArticlePost[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = post;
  } else {
    updated = [post, ...current];
  }
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving post to storage:', e);
  }
  return updated;
}

export function deletePostFromStorage(id: string): ArticlePost[] {
  const current = getStoredPosts();
  const updated = current.filter((p) => p.id !== id);
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting post from storage:', e);
  }
  return updated;
}

export function getStoredAgentPrompts(): AgentPrompts {
  try {
    const data = localStorage.getItem(PROMPTS_KEY);
    return data ? JSON.parse(data) : DEFAULT_AGENT_PROMPTS;
  } catch (e) {
    return DEFAULT_AGENT_PROMPTS;
  }
}

export function saveAgentPrompts(prompts: AgentPrompts): void {
  try {
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
  } catch (e) {
    console.error('Error saving agent prompts:', e);
  }
}

