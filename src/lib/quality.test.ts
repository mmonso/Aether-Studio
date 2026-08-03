import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditText,
  measure,
  splitSentences,
  splitProhibitedTerms,
  prepareText,
} from './quality';

// --- separação de frases ---------------------------------------------------

test('não quebra frase em número decimal', () => {
  const s = splitSentences('A latência caiu para 3.5 ms. O ganho foi real.');
  assert.equal(s.length, 2);
});

test('não quebra frase em abreviação', () => {
  const s = splitSentences('Use cache, filas, etc. Depois meça o resultado.');
  assert.equal(s.length, 2);
});

test('bloco de código não entra na contagem de palavras', () => {
  const md = 'Uma frase curta.\n\n```js\nconst x = 1;\nconsole.log(x);\n```\n\nOutra frase.';
  const p = prepareText(md);
  assert.equal(p.codeBlocks, 1);
  assert.ok(!p.prose.includes('console.log'));
});

test('link vira o próprio texto e é contado', () => {
  const p = prepareText('Segundo o [relatório da Cloudflare](https://exemplo.com), caiu.');
  assert.equal(p.links, 1);
  assert.ok(p.prose.includes('relatório da Cloudflare'));
  assert.ok(!p.prose.includes('https://'));
});

// --- termos proibidos ------------------------------------------------------

test('separa termo literal de regra de julgamento', () => {
  const { literals, rules } = splitProhibitedTerms([
    'Uso apelativo do pronome "você"',
    'game changer',
    'Hype sensacionalista sem demonstração prática em nenhum trecho do artigo',
  ]);

  assert.deepEqual(literals, ['você', 'game changer']);
  // A regra com aspas continua indo para o crítico: o literal não a esgota.
  assert.equal(rules.length, 2);
  assert.ok(rules.some((r) => r.includes('Hype sensacionalista')));
});

test('regra sem aspas e sem forma de termo não vira busca literal', () => {
  const { literals } = splitProhibitedTerms([
    'Evite qualquer afirmação sobre resultados clínicos sem estudo publicado',
  ]);
  assert.deepEqual(literals, []);
});

test('termo proibido de uma palavra respeita fronteira', () => {
  const manifesto = { prohibitedTerms: ['"hype"'] };

  const comHype = auditText(longText('O hype em torno disso não se sustenta.'), manifesto);
  assert.ok(comHype.findings.some((f) => f.code === 'termo-proibido'));

  // "hyperscaler" contém "hype" e não pode disparar o veto.
  const semHype = auditText(longText('O hyperscaler cobra por hora reservada.'), manifesto);
  assert.ok(!semHype.findings.some((f) => f.code === 'termo-proibido'));
});

test('termo proibido é encontrado sem depender de acento ou caixa', () => {
  const audit = auditText(longText('Isso é um CLICHÊ conhecido.'), {
    prohibitedTerms: ['"clichê"'],
  });
  assert.ok(audit.findings.some((f) => f.code === 'termo-proibido'));
});

// --- marcadores de texto de máquina ---------------------------------------

test('conector burocrático só conta quando abre a frase', () => {
  const abrindo = measure('Contudo, o custo subiu. Entretanto, o ganho existe.');
  assert.ok(abrindo.connectorsPer1000 > 0);

  const noMeio = measure('O custo subiu, contudo o ganho existe e compensa.');
  assert.equal(noMeio.connectorsPer1000, 0);
});

test('excesso de conector é veto, não aviso', () => {
  const texto = longText(
    Array.from(
      { length: 12 },
      (_, i) => `Contudo, a medição número ${i} contradiz a expectativa inicial do time.`
    ).join(' ')
  );
  const audit = auditText(texto);
  const f = audit.findings.find((x) => x.code === 'conector-burocratico');
  assert.ok(f, 'deveria acusar conector burocrático');
  assert.equal(f!.severity, 'veto');
  assert.equal(audit.passed, false);
  assert.ok(f!.evidence.length > 0, 'o veto tem que vir com os trechos');
});

test('frases de tamanho uniforme acusam ritmo plano', () => {
  const uniforme = Array.from(
    { length: 20 },
    (_, i) => `A medição ${i} indicou perda constante de throughput no cluster.`
  ).join(' ');
  const audit = auditText(uniforme, null, { minWords: 10 });
  assert.ok(audit.findings.some((f) => f.code === 'ritmo-plano'));
});

test('prosa com frases de comprimentos variados não acusa ritmo plano', () => {
  const variado = [
    'Não funcionou.',
    'A hipótese era que a fila absorveria o pico, mas o consumidor caiu antes disso e o backlog cresceu por vinte minutos até alguém perceber.',
    'Refizemos o teste.',
    'Dessa vez com dois consumidores e um limite de lote menor, porque o problema não era vazão e sim o tempo de reconexão.',
    'Deu certo.',
    'O tempo de recuperação caiu de vinte minutos para quarenta segundos, o que muda completamente o desenho do alarme.',
  ].join(' ');
  const audit = auditText(variado, null, { minWords: 10 });
  assert.ok(!audit.findings.some((f) => f.code === 'ritmo-plano'));
});

test('falta de número e falta de fonte são avisos separados', () => {
  const audit = auditText(longText('A arquitetura melhora a resiliência do sistema.'));
  const semNumero = audit.findings.find((x) => x.code === 'sem-numero');
  const semFonte = audit.findings.find((x) => x.code === 'sem-fonte');
  assert.ok(semNumero && semNumero.severity === 'aviso');
  assert.ok(semFonte && semFonte.severity === 'aviso');
});

test('texto com número mas sem fonte acusa só a fonte', () => {
  const audit = auditText(
    longText('A latência caiu de 800 ms para 120 ms depois do ajuste no lote.')
  );
  assert.ok(!audit.findings.some((f) => f.code === 'sem-numero'));
  assert.ok(audit.findings.some((f) => f.code === 'sem-fonte'));
});

test('texto que cita fonte linkada não acusa falta de fonte', () => {
  const audit = auditText(
    longText('O [relatório da Cloudflare](https://exemplo.com) mostra 40% de queda.')
  );
  assert.ok(!audit.findings.some((f) => f.code === 'sem-fonte'));
});

test('concretude vira veto quando o blog exige', () => {
  const audit = auditText(longText('A arquitetura melhora a resiliência do sistema.'), null, {
    requireConcreteness: true,
  });
  assert.equal(audit.passed, false);
});

// --- veredito --------------------------------------------------------------

test('passed é falso apenas quando existe veto', () => {
  const soAvisos = auditText(longText('Cada vez mais times adotam isso com elegância.'));
  const temAviso = soAvisos.findings.some((f) => f.severity === 'aviso');
  const temVeto = soAvisos.findings.some((f) => f.severity === 'veto');
  assert.ok(temAviso);
  assert.equal(temVeto, false);
  assert.equal(soAvisos.passed, true);
});

test('texto curto demais é vetado antes de qualquer análise de estilo', () => {
  const audit = auditText('Um parágrafo só, e curto.');
  assert.equal(audit.passed, false);
  assert.ok(audit.findings.some((f) => f.code === 'curto-demais'));
});

test('nota cai conforme os problemas se acumulam', () => {
  const limpo = auditText(cleanText());
  const sujo = auditText(longText('Contudo, isso é um divisor de águas. '.repeat(20)));
  assert.ok(limpo.score > sujo.score);
});

test('as regras não verificáveis são devolvidas para o crítico', () => {
  const audit = auditText(cleanText(), {
    prohibitedTerms: ['Hype sensacionalista sem demonstração prática de uso real'],
  });
  assert.equal(audit.unverifiableRules.length, 1);
});

// --- apoio -----------------------------------------------------------------

/** Completa até passar do mínimo de palavras, sem introduzir marcadores. */
function longText(seed: string): string {
  const filler =
    'O time mediu a fila durante uma semana inteira e registrou cada pico separadamente. ' +
    'A conclusão apareceu no gráfico antes de aparecer no relatório. ' +
    'Ninguém mexeu na configuração até entender o motivo. ';
  let out = seed;
  while (out.split(/\s+/).length < 760) out += ` ${filler}`;
  return out;
}

function cleanText(): string {
  return longText(
    'O tempo de resposta saiu de 800 ms para 120 ms depois que o lote caiu pela metade. ' +
      'Foi o único ajuste do dia.'
  );
}
