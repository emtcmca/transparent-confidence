/**
 * Example: Knowledge Base — vector-only retrieval + Freshness extension
 *
 * Scenario: A product support chatbot uses single-method (semantic-only) retrieval
 * and scores freshness to surface stale-document risk. Without configuring
 * minConfirmedMethods: 1, all candidates would fail the default "2+ methods"
 * confirmation check and method agreement would score near-zero.
 *
 * Expected label:           Moderate
 * Expected total:           ~75–82
 * Expected recommendedAction: answer (hasConflict: false, tier1 ≥ 40, total ≥ 65)
 *
 * Key: minConfirmedMethods: 1 lets single-method pipelines score method agreement
 * properly. Without it, single-method retrieval scores 3 agreement pts (worst band)
 * regardless of how strong the semantic scores are.
 */

import { computeConfidence } from '../src/index.js';

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const scorecard = computeConfidence(
  {
    // LLM-assessed signals
    supportLevel: 'medium',
    hasConflict: false,
    citationCount: 2,

    // Three KB articles — semantic scores only (vector-only pipeline)
    candidates: [
      {
        retrievalScores: { semantic: 0.83 },
        combinedScore: 0.83,
        documentId: 'kb-rate-limits-v3',
        lastUpdated: daysAgo(15), // recent — within default 90-day window
      },
      {
        retrievalScores: { semantic: 0.78 },
        combinedScore: 0.78,
        documentId: 'kb-rate-limits-v2',
        lastUpdated: daysAgo(110), // beyond default 90-day window by ~20 days
      },
      {
        retrievalScores: { semantic: 0.71 },
        combinedScore: 0.71,
        documentId: 'kb-api-overview',
        lastUpdated: daysAgo(95), // just beyond window
      },
    ],
  },
  {
    // Single-method retrieval config — 1 method confirmation is sufficient
    retrieval: {
      minConfirmedMethods: 1,
    },

    // Freshness extension — tighter window for fast-moving API docs
    freshness: {
      maxAgeForFullScore: 60, // full score if median age ≤ 60 days
      penaltyPerMonth: 2, // steeper penalty for API docs
      hardCutoffAge: 365, // 1-year hard cutoff
      now, // inject reference date for determinism
    },
  },
);

console.log('=== Knowledge Base Scorecard (Vector-Only + Freshness) ===');
console.log(`Total:             ${scorecard.total} / 100`);
console.log(`Label:             ${scorecard.label} (${scorecard.labelColor})`);
console.log(`Recommended:       ${scorecard.recommendedAction} — ${scorecard.actionReason}`);
console.log(
  `Tier 1:            ${scorecard.tier1?.score} — ${scorecard.tier1?.label}  (Answer Confidence)`,
);
console.log(
  `Tier 2:            ${scorecard.tier2?.score} — ${scorecard.tier2?.label}  (System Readiness)`,
);
console.log('');
console.log('Dimensions:');
console.log(
  `  Grounding:   ${scorecard.dimensions.grounding.raw} / ${scorecard.dimensions.grounding.max}`,
);
console.log(
  `  Retrieval:   ${scorecard.dimensions.retrieval.raw} / ${scorecard.dimensions.retrieval.max}  — ${scorecard.dimensions.retrieval.explanation}`,
);
console.log(
  `  Consistency: ${scorecard.dimensions.consistency.raw} / ${scorecard.dimensions.consistency.max}`,
);
console.log(
  `  Freshness:   ${scorecard.dimensions.freshness?.raw} / ${scorecard.dimensions.freshness?.max}  — ${scorecard.dimensions.freshness?.explanation}`,
);
console.log('');
console.log('Meta:');
console.log(
  `  warnings:       ${scorecard.meta.warnings.length === 0 ? 'none' : scorecard.meta.warnings.map((w) => w.code).join(', ')}`,
);
console.log(
  `  missingSignals: ${scorecard.meta.missingSignals.length === 0 ? 'none' : scorecard.meta.missingSignals.join(', ')}`,
);
console.log('');
console.log('Retrieval breakdown:');
const rb = scorecard.dimensions.retrieval.breakdown;
if (rb) {
  console.log(`  agreement:  ${rb.components.agreement}`);
  console.log(`  magnitude:  ${rb.components.magnitude}`);
  console.log(`  diversity:  ${rb.components.diversity}`);
  console.log(`  breadth:    ${rb.components.breadth}`);
}
