/**
 * Example: Evaluator Signal Bridge
 *
 * Expected label: Strong
 * Expected total: 85-100
 * Expected recommendedAction: answer
 *
 * The bridge accepts plain evaluator result objects and fills absent scoring
 * inputs without importing external evaluator SDKs.
 */

import { computeConfidence, fromRagasLike, mergeEvaluationSignals } from '../src/index.js';

const baseInputs = {
  supportLevel: 'high' as const,
  hasConflict: false,
  citationCount: 3,
  candidates: [
    { retrievalScores: { semantic: 0.91, keyword: 0.8 }, combinedScore: 0.91, documentId: 'doc-1' },
    {
      retrievalScores: { semantic: 0.87, keyword: 0.74 },
      combinedScore: 0.87,
      documentId: 'doc-2',
    },
    { retrievalScores: { semantic: 0.84, keyword: 0.7 }, combinedScore: 0.84, documentId: 'doc-3' },
  ],
};

const ragasLikeResult = {
  faithfulness: 0.93,
  answer_relevancy: 0.9,
  context_precision: 0.82,
};

const signals = fromRagasLike(ragasLikeResult);
const { inputs: enrichedInputs, warnings: mergeWarnings } = mergeEvaluationSignals(
  baseInputs,
  signals,
);
const scorecard = computeConfidence(enrichedInputs, { preset: 'production-v0.3' });

console.log('=== Evaluator Bridge ===');
console.log(`Total: ${scorecard.total}`);
console.log(`RecommendedAction: ${scorecard.recommendedAction}`);
console.log(`MergeWarnings: ${mergeWarnings.length}`);
console.log(
  `WarningCodes: ${
    scorecard.meta.warnings.length === 0
      ? 'none'
      : scorecard.meta.warnings.map((warning) => warning.code).join(', ')
  }`,
);
