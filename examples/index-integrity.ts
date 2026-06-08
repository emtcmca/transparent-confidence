/**
 * Example: Index Integrity
 *
 * Expected label: Strong
 * Expected total: 90-100
 * Expected recommendedAction: answer
 *
 * Index integrity is an opt-in Tier 2 extension for operational readiness
 * signals that are not captured by corpus completeness or freshness.
 */

import { computeConfidence } from '../src/index.js';

const scorecard = computeConfidence(
  {
    supportLevel: 'high',
    hasConflict: false,
    candidates: [
      {
        retrievalScores: { semantic: 0.9, keyword: 0.78 },
        combinedScore: 0.9,
        documentId: 'doc-1',
      },
      {
        retrievalScores: { semantic: 0.86, keyword: 0.72 },
        combinedScore: 0.86,
        documentId: 'doc-2',
      },
      {
        retrievalScores: { semantic: 0.82, keyword: 0.7 },
        combinedScore: 0.82,
        documentId: 'doc-3',
      },
    ],
    indexIntegrity: {
      expectedEmbeddingModelVersion: 'text-embedding-3-large@2026-01',
      actualEmbeddingModelVersion: 'text-embedding-3-large@2026-01',
      sourceVersionMatchRatio: 0.998,
      staleIndexedDocumentRatio: 0.004,
      failedIngestionCount: 0,
      aclFilterConfirmed: true,
      deletedSourceLeakageCount: 0,
    },
  },
  { indexIntegrity: {} },
);

console.log('=== Index Integrity ===');
console.log(`Total: ${scorecard.total}`);
console.log(`RecommendedAction: ${scorecard.recommendedAction}`);
console.log(`Tier2: ${scorecard.tier2?.score} - ${scorecard.tier2?.label}`);
console.log(`IndexIntegrityRaw: ${scorecard.dimensions.indexIntegrity?.raw}`);
console.log(
  `WarningCodes: ${
    scorecard.meta.warnings.length === 0
      ? 'none'
      : scorecard.meta.warnings.map((warning) => warning.code).join(', ')
  }`,
);
