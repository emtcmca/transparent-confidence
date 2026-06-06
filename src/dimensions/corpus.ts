import type { DimensionScore, ScoringConfig, ScoringInputs } from '../types.js';

const MAX = 15;

/**
 * Extension B — Corpus Completeness (max 15 raw pts)
 *
 * Scores how complete the knowledge base is relative to its expected
 * composition. Useful for closed-world document sets where the expected
 * document types are known in advance (legal, compliance, HR policy, etc.).
 *
 * Base score is proportional: min(corpusDocCount, expectedDocCount) / expectedDocCount.
 * Penalty of −3 when the doc type most relevant to the question is absent.
 */
export function scoreCorpus(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const expectedDocCount = config.corpus?.expectedDocCount ?? 5;
  const { corpusDocCount, missingRelevantType } = inputs;
  const parts: string[] = [];

  if (corpusDocCount === undefined) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation:
        'corpusDocCount not provided. Supply the number of loaded document types to enable corpus scoring.',
    };
  }

  const ratio = Math.min(corpusDocCount, expectedDocCount) / expectedDocCount;

  let base: number;

  if (ratio >= 1.0) {
    base = 15;
    parts.push(`All ${expectedDocCount} expected document types present.`);
  } else if (ratio >= 0.8) {
    base = 12;
    parts.push(`${corpusDocCount} of ${expectedDocCount} expected document types present.`);
  } else if (ratio >= 0.6) {
    base = 9;
    parts.push(`${corpusDocCount} of ${expectedDocCount} expected document types present.`);
  } else if (ratio >= 0.4) {
    base = 5;
    parts.push(`${corpusDocCount} of ${expectedDocCount} expected document types present.`);
  } else if (ratio >= 0.2) {
    base = 2;
    parts.push(`Only ${corpusDocCount} of ${expectedDocCount} expected document types present.`);
  } else {
    base = 0;
    parts.push(`Corpus is empty or nearly empty (${corpusDocCount} of ${expectedDocCount} types).`);
  }

  let score = base;

  if (missingRelevantType === true) {
    score = Math.max(0, score - 3);
    parts.push(
      'A document type directly relevant to this question appears to be missing — answer may be incomplete (−3).',
    );
  }

  const raw = Math.max(0, Math.min(MAX, score));

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
  };
}
