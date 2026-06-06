/**
 * Example: Knowledge Base — Freshness extension only, flat KB scenario
 *
 * Scenario: A product support chatbot answers a question about API rate limits.
 * The KB is periodically refreshed but some articles are aging. The system
 * scores freshness to surface stale-document risk to the UI.
 *
 * Expected label:  Moderate
 * Expected range:  65–80
 */

import { computeConfidence } from '../src/index.js';

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const scorecard = computeConfidence(
  {
    // LLM-assessed signals
    confidenceLevel: 'medium',
    citationCount: 2,

    // Three KB articles — one recent, two aging
    candidates: [
      {
        retrievalScores: { semantic: 0.83, bm25: 0.69 },
        combinedScore: 0.83,
        documentId: 'kb-rate-limits-v3',
        lastUpdated: daysAgo(15), // recent — within default 90-day window
      },
      {
        retrievalScores: { semantic: 0.78, bm25: 0.61 },
        combinedScore: 0.78,
        documentId: 'kb-rate-limits-v2',
        lastUpdated: daysAgo(110), // beyond default 90-day window by ~20 days
      },
      {
        retrievalScores: { semantic: 0.71, bm25: 0.55 },
        combinedScore: 0.71,
        documentId: 'kb-api-overview',
        lastUpdated: daysAgo(95), // just beyond window
      },
    ],
  },
  {
    // Freshness extension — tighter window for fast-moving API docs
    freshness: {
      maxAgeForFullScore: 60, // full score if median age ≤ 60 days
      penaltyPerMonth: 2, // steeper penalty for API docs
      hardCutoffAge: 365, // 1-year hard cutoff
    },
  },
);

console.log('=== Knowledge Base Scorecard (Product Support) ===');
console.log(`Total:      ${scorecard.total} / 100`);
console.log(`Label:      ${scorecard.label} (${scorecard.labelColor})`);
console.log(
  `Tier 1:     ${scorecard.tier1?.score} — ${scorecard.tier1?.label}  (Answer Confidence)`,
);
console.log(
  `Tier 2:     ${scorecard.tier2?.score} — ${scorecard.tier2?.label}  (System Readiness)`,
);
console.log('');
console.log('Dimensions:');
console.log(
  `  Grounding:   ${scorecard.dimensions.grounding.raw} / ${scorecard.dimensions.grounding.max}`,
);
console.log(
  `  Retrieval:   ${scorecard.dimensions.retrieval.raw} / ${scorecard.dimensions.retrieval.max}`,
);
console.log(
  `  Consistency: ${scorecard.dimensions.consistency.raw} / ${scorecard.dimensions.consistency.max}`,
);
console.log(
  `  Freshness:   ${scorecard.dimensions.freshness?.raw} / ${scorecard.dimensions.freshness?.max}  — ${scorecard.dimensions.freshness?.explanation}`,
);
console.log('');
console.log('Active extensions:', scorecard.meta.activeExtensions);
