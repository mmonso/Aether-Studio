import 'dotenv/config';
import { auditText } from '../src/lib/quality';

/**
 * Roda a verificação determinística contra os artigos que já existem no banco.
 *
 * `npm run audit:posts`
 *
 * Serve para calibrar: um limiar só vale alguma coisa depois de apontado para
 * texto real. É também a semente do harness de medição da F5 — quando existir
 * o conjunto de referência julgado por humano, é aqui que a concordância entre
 * a nota automática e o julgamento vai ser calculada.
 */

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const blogId = process.argv[2] || 'blog_tech_studio';

const posts = await (
  await fetch(
    `${url}/rest/v1/posts?select=title,content,status&blog_id=eq.${blogId}&order=created_at.desc`,
    { headers }
  )
).json();

const secrets = await (
  await fetch(`${url}/rest/v1/blog_secrets?select=manifesto&blog_id=eq.${blogId}`, { headers })
).json();

const manifesto = secrets?.[0]?.manifesto || null;

if (!Array.isArray(posts) || posts.length === 0) {
  console.log(`Nenhum artigo em ${blogId}.`);
  process.exit(0);
}

console.log(`${posts.length} artigos em ${blogId}\n`);

for (const post of posts) {
  const audit = auditText(post.content || '', manifesto);
  const m = audit.metrics;

  console.log(`─── [${post.status}] ${post.title.slice(0, 68)}`);
  console.log(
    `    nota ${audit.score}  passou: ${audit.passed}  ` +
      `${m.words} palavras · ${m.sentences} frases · ${m.sections} seções`
  );
  console.log(
    `    ritmo(cv) ${m.sentenceLengthCv}  conectores/1k ${m.connectorsPer1000}  ` +
      `clichês/1k ${m.clichesPer1000}  tricolon/1k ${m.tricolonsPer1000}`
  );
  console.log(
    `    frases c/ número ${m.sentencesWithNumbersPct}%  links ${m.links}  ` +
      `código ${m.codeBlocks}  travessão/1k ${m.emDashesPer1000}  não-apenas-mas ${m.notOnlyButAlso}`
  );

  for (const f of audit.findings) {
    console.log(`    [${f.severity}] ${f.code} — ${f.message}`);
    for (const e of f.evidence.slice(0, 3)) console.log(`        · ${e}`);
  }
  console.log('');
}
