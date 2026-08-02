/**
 * Exportação e leitura do histórico local do Studio.
 *
 * Hoje o `localStorage` é a ÚNICA cópia dos rascunhos não publicados e dos
 * manifestos — limpar o navegador, trocar de máquina ou usar outro perfil apaga
 * tudo (achado #8 da revisão pré-produção). Com a migração para o Supabase, ele
 * passa a ser também o único ponto onde esses dados podem se perder na virada.
 *
 * Por isso este arquivo existe ANTES da migração, e não depois: exportar é o
 * seguro contra o próprio refactor.
 *
 * Princípio: o backup guarda os valores **crus**, exatamente como estão no
 * storage. Um backup que interpreta e re-serializa perde justamente o que ele
 * não entendeu — que é o que mais importa preservar.
 */

export const STUDIO_KEYS = [
  'techstudio_blogs_v3', // blogs E manifestos: o manifesto mora dentro do blog
  'techstudio_active_id_v3',
  'techstudio_posts_v3', // rascunhos — a parte insubstituível
  'techstudio_user_manifesto_v3', // legado; pode ter sobrado dado de versão antiga
  'techstudio_agent_prompts_v3',
  'psicocontent_theme', // resíduo do pivô anterior, ainda em uso em App.tsx
] as const;

export const BACKUP_FORMAT = 'aether-studio-backup';
export const BACKUP_VERSION = 1;

export interface StudioBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Contagens para conferência a olho, sem precisar abrir o JSON inteiro. */
  summary: { blogs: number; posts: number };
  /** Valores crus do localStorage, chave por chave. `null` = chave ausente. */
  data: Record<string, string | null>;
}

function countIn(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** Lê tudo que o Studio guarda no navegador. */
export function buildBackup(): StudioBackup {
  const data: Record<string, string | null> = {};

  for (const key of STUDIO_KEYS) {
    try {
      data[key] = localStorage.getItem(key);
    } catch {
      data[key] = null; // modo privado sem storage
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    summary: {
      blogs: countIn(data['techstudio_blogs_v3']),
      posts: countIn(data['techstudio_posts_v3']),
    },
    data,
  };
}

/** Dispara o download do backup. Devolve o resumo, para exibir num toast. */
export function downloadBackup(): StudioBackup['summary'] {
  const backup = buildBackup();
  const stamp = backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aether-studio-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return backup.summary;
}

/**
 * Valida um arquivo de backup antes de qualquer coisa ser importada.
 *
 * Recusa em vez de tentar adivinhar: importar um arquivo que não é backup, ou
 * de formato futuro, sobrescreveria dado bom com lixo.
 */
export function parseBackup(text: string): StudioBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }

  const candidate = parsed as Partial<StudioBackup>;

  if (candidate?.format !== BACKUP_FORMAT) {
    throw new Error('Este arquivo não é um backup do Aether Studio.');
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    throw new Error(
      `Backup na versão ${candidate.version}, mas este Studio só entende até a ${BACKUP_VERSION}.`
    );
  }
  if (!candidate.data || typeof candidate.data !== 'object') {
    throw new Error('O backup não tem a seção `data`.');
  }

  return candidate as StudioBackup;
}

/**
 * Restaura o backup para o localStorage.
 *
 * Existe para o caso de a migração dar errado e ser preciso voltar ao estado
 * anterior no próprio navegador. A importação para o Supabase é outro caminho.
 */
export function restoreBackup(backup: StudioBackup): void {
  for (const [key, value] of Object.entries(backup.data)) {
    if (value === null) continue;
    localStorage.setItem(key, value);
  }
}
