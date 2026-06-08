/**
 * Example: Production Gating
 *
 * Expected label: Strong
 * Expected total: 100
 * Expected recommendedAction: review
 *
 * The production preset requires answer relevance, conflict status, and either
 * faithfulnessScore or claimSupport. Missing critical signals force review.
 */

import { computeConfidence } from '../src/index.js';

const scorecard = computeConfidence(
  {
    supportLevel: 'high',
    answerRelevanceScore: 0.92,
    hasConflict: false,
    candidates: [
      {
        retrievalScores: { semantic: 0.89, keyword: 0.76 },
        combinedScore: 0.89,
        documentId: 'policy-1',
      },
      {
        retrievalScores: { semantic: 0.85, keyword: 0.7 },
        combinedScore: 0.85,
        documentId: 'policy-2',
      },
      {
        retrievalScores: { semantic: 0.82, keyword: 0.66 },
        combinedScore: 0.82,
        documentId: 'policy-3',
      },
    ],
  },
  { preset: 'production-v0.3' },
);

console.log('=== Production Gating ===');
console.log(`Total: ${scorecard.total}`);
console.log(`RecommendedAction: ${scorecard.recommendedAction}`);
console.log(`ActionReason: ${scorecard.actionReason}`);
console.log(
  `WarningCodes: ${
    scorecard.meta.warnings.length === 0
      ? 'none'
      : scorecard.meta.warnings.map((warning) => warning.code).join(', ')
  }`,
);
