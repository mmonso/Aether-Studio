import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleSimilarity, dedupeTopics, remainingThisWeek } from './scheduler';

/**
 * Primeiros testes do projeto.
 *
 * Runner nativo do Node — sem framework, sem dependência nova. Roda com
 * `npm test`.
 *
 * A dedup de pauta é o lugar certo para começar: é lógica pura, e é o que
 * separa "o blog escreve sozinho" de "o blog reescreve os mesmos temas em
 * poucos meses".
 */

test('títulos idênticos têm similaridade máxima', () => {
  const t = 'Arquitetura de agentes autônomos em produção';
  assert.equal(titleSimilarity(t, t), 1);
});

test('títulos sem relação têm similaridade baixa', () => {
  const score = titleSimilarity(
    'Arquitetura de agentes autônomos em produção',
    'Receita de pão de fermentação natural'
  );
  assert.ok(score < 0.2, `esperado < 0.2, veio ${score}`);
});

test('acento e pontuação não mudam o resultado', () => {
  assert.equal(
    titleSimilarity('Inteligência Artificial: limites', 'inteligencia artificial limites'),
    1
  );
});

test('palavras curtas não inflam a similaridade', () => {
  // "de", "com", "para" aparecem em quase todo título e casariam por acaso.
  const score = titleSimilarity('O uso de IA com foco em UX', 'A arte de viver com calma');
  assert.ok(score < 0.3, `esperado < 0.3, veio ${score}`);
});

test('pauta que repete artigo publicado é recusada', () => {
  const { fresh, rejected } = dedupeTopics(
    [
      { title: 'Por que filas com retomada por etapa reduzem custo' },
      { title: 'Bancos vetoriais para busca semântica' },
    ],
    ['Filas com retomada por etapa e a redução de custo em pipelines']
  );

  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].title, 'Bancos vetoriais para busca semântica');
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].score >= 0.45);
});

test('variações da mesma ideia na MESMA rodada são recusadas', () => {
  // Seis sugestões de uma chamada costumam trazer o mesmo tema reembalado.
  // Sem isto, o dedup só olharia o histórico e deixaria passar duplicata nova.
  const { fresh, rejected } = dedupeTopics(
    [
      { title: 'Como desenhar orquestração resiliente de agentes LLM' },
      { title: 'Orquestração resiliente de agentes LLM: como desenhar' },
    ],
    []
  );

  assert.equal(fresh.length, 1);
  assert.equal(rejected.length, 1);
});

test('sem histórico, nada é recusado', () => {
  const { fresh, rejected } = dedupeTopics(
    [{ title: 'Primeiro artigo do blog' }],
    []
  );
  assert.equal(fresh.length, 1);
  assert.equal(rejected.length, 0);
});

test('cadência esgotada não deixa espaço', () => {
  assert.equal(remainingThisWeek(2, 0), 2);
  assert.equal(remainingThisWeek(2, 2), 0);
  // Produzir além da cadência não vira crédito negativo.
  assert.equal(remainingThisWeek(2, 5), 0);
});
