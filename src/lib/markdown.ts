// Normaliza o corpo do artigo antes de armazenar.
//
// O redator costuma abrir o texto repetindo o título como `# Título`, mas o
// título já é exibido pelo cabeçalho do preview e pelo blog. Sem isso, o
// leitor vê o mesmo título duas vezes seguidas.

function normalizeHeadline(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Considera equivalentes títulos idênticos ou em que um contém o outro
// (cobre variações de pontuação e subtítulos anexados pelo modelo).
function isSameHeadline(a: string, b: string): boolean {
  const na = normalizeHeadline(a);
  const nb = normalizeHeadline(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return longer.includes(shorter) && shorter.length / longer.length > 0.6;
}

/**
 * Remove o H1 inicial do corpo quando ele apenas repete o título do artigo.
 * Um H1 que diga outra coisa é preservado — pode ser intenção editorial.
 */
export function stripDuplicateTitleHeading(text: string, title?: string): string {
  if (!text) return text;

  const lines = text.split('\n');

  let firstContent = 0;
  while (firstContent < lines.length && lines[firstContent].trim() === '') firstContent++;

  const candidate = lines[firstContent]?.trim();
  if (!candidate || !candidate.startsWith('# ')) return text;

  const heading = candidate.replace(/^#\s+/, '').replace(/[*_`]/g, '').trim();

  // Com título conhecido, só remove se for de fato o mesmo título.
  if (title && !isSameHeadline(heading, title)) return text;

  const remaining = lines.slice(firstContent + 1);
  while (remaining.length && remaining[0].trim() === '') remaining.shift();

  return remaining.join('\n');
}
