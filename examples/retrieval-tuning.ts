/**
 * Example: Retrieval Tuning
 *
 * Expected label: Strong
 * Expected total: 95-100
 * Expected recommendedAction: answer
 *
 * Duplicate and rank penalties are opt-in. Diagnostic mode records duplicate
 * and rank signals without changing retrieval raw score.
 */

import { computeConfidence } from '../src/index.js';

const inputs = {
  supportLevel: 'high' as const,
  hasConflict: false,
  candidates: [
    {
      retrievalScores: { semantic: 0.91, keyword: 0.81 },
      combinedScore: 0.91,
      documentId: 'doc-1',
      contentHash: 'same',
      rank: 1,
    },
    {
      retrievalScores: { semantic: 0.89, keyword: 0.79 },
      combinedScore: 0.89,
      documentId: 'doc-1',
      contentHash: 'same',
      rank: 2,
    },
    {
      retrievalScores: { semantic: 0.77, keyword: 0.64 },
      combinedScore: 0.77,
      documentId: 'doc-2',
      contentHash: 'different',
      rank: 14,
    },
  ],
};

const diagnostic = computeConfidence(inputs, {
  retrieval: {
    duplicateContent: { mode: 'diagnostic' },
    rankPenalty: { mode: 'diagnostic' },
  },
});

const penalized = computeConfidence(inputs, {
  retrieval: {
    duplicateContent: { mode: 'penalize' },
    rankPenalty: { mode: 'penalize' },
  },
});

console.log('=== Retrieval Tuning ===');
console.log(`Total: ${penalized.total}`);
console.log(`RecommendedAction: ${penalized.recommendedAction}`);
console.log(`DiagnosticRetrievalRaw: ${diagnostic.dimensions.retrieval.raw}`);
console.log(`PenalizedRetrievalRaw: ${penalized.dimensions.retrieval.raw}`);
console.log(
  `WarningCodes: ${
    penalized.meta.warnings.length === 0
      ? 'none'
      : penalized.meta.warnings.map((warning) => warning.code).join(', ')
  }`,
);
