/**
 * Example: Basic RAG — core dimensions only, zero config
 *
 * Scenario: A knowledge base chatbot answers a straightforward factual question.
 * The LLM reports high confidence, three strong candidates retrieved via two
 * methods each, consistent scores, no conflicts.
 *
 * Expected label:  Strong
 * Expected range:  85–100
 */

import { computeConfidence } from '../src/index.js';

const scorecard = computeConfidence({
  // LLM-assessed signals
  supportLevel: 'high',
  citationCount: 3,

  // Retrieved candidates — three solid hits from two retrieval methods each
  candidates: [
    {
      retrievalScores: { semantic: 0.88, keyword: 0.72 },
      combinedScore: 0.88,
      documentId: 'doc-001',
    },
    {
      retrievalScores: { semantic: 0.85, keyword: 0.68 },
      combinedScore: 0.85,
      documentId: 'doc-002',
    },
    {
      retrievalScores: { semantic: 0.82, keyword: 0.65 },
      combinedScore: 0.82,
      documentId: 'doc-003',
    },
  ],
});

console.log('=== Basic RAG Scorecard ===');
console.log(`Total:      ${scorecard.total} / 100`);
console.log(`Label:      ${scorecard.label} (${scorecard.labelColor})`);
console.log(`Tier 1:     ${scorecard.tier1?.score} — ${scorecard.tier1?.label}`);
console.log(
  `Tier 2:     ${scorecard.tier2 === null ? 'n/a (no extensions)' : scorecard.tier2.label}`,
);
console.log('');
console.log('Dimensions:');
console.log(
  `  Grounding:   ${scorecard.dimensions.grounding.raw} / ${scorecard.dimensions.grounding.max}  — ${scorecard.dimensions.grounding.explanation}`,
);
console.log(
  `  Retrieval:   ${scorecard.dimensions.retrieval.raw} / ${scorecard.dimensions.retrieval.max}  — ${scorecard.dimensions.retrieval.explanation}`,
);
console.log(
  `  Consistency: ${scorecard.dimensions.consistency.raw} / ${scorecard.dimensions.consistency.max}  — ${scorecard.dimensions.consistency.explanation}`,
);
console.log('');
console.log('Meta:', scorecard.meta);
