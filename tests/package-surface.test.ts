import { expect, test } from 'vitest';
import type { AuthorityConfig, ConfidenceScorecard, CorpusConfig } from '../src/index';
import {
  ALGORITHM_VERSION,
  analyzeCalibration,
  computeConfidence,
  fromCustomJudge,
  mergeEvaluationSignals,
  SCORECARD_SCHEMA_VERSION,
} from '../src/index';

test('v0.3 package root exports public helpers and version constants', () => {
  expect(ALGORITHM_VERSION).toBe('0.3.0');
  expect(SCORECARD_SCHEMA_VERSION).toBe('0.3');
  expect(typeof computeConfidence).toBe('function');
  expect(typeof analyzeCalibration).toBe('function');
  expect(typeof mergeEvaluationSignals).toBe('function');
  expect(typeof fromCustomJudge).toBe('function');
});

test('v0.3 package root exports standalone config types and required breakdown type', () => {
  const authority: AuthorityConfig = {
    tiers: [{ name: 'Primary', rank: 10, keywords: ['primary'] }],
  };
  const corpus: CorpusConfig = { expectedTypeCount: 3 };

  const scorecard: ConfidenceScorecard = computeConfidence(
    {
      supportLevel: 'high',
      hasConflict: false,
      corpusTypeCount: 3,
      candidates: [
        {
          retrievalScores: { semantic: 0.88, keyword: 0.76 },
          combinedScore: 0.88,
          documentId: 'doc-1',
          documentType: 'Primary',
        },
      ],
    },
    { authority, corpus },
  );

  const groundingBreakdownRaw: number = scorecard.dimensions.grounding.breakdown.raw;

  expect(groundingBreakdownRaw).toBe(scorecard.dimensions.grounding.raw);
});
