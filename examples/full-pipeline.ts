/**
 * Example: Full Pipeline — all 7 dimensions + action policy + breakdown
 *
 * Scenario: A legal research assistant answers a complex multi-document question
 * about amendment precedence in HOA governing documents. All 7 dimensions are
 * active: grounding, retrieval, consistency, relevance, authority, corpus, freshness.
 * All enhanced signals are provided. Custom action policy lowers the answer
 * threshold to match the domain's review tolerance.
 *
 * Expected label:           Strong
 * Expected total:           ~88–94
 * Expected recommendedAction: answer (custom policy, all signals clean)
 */

import { createScorer } from '../src/index.js';

// Reference date — inject for determinism (prevents freshness score drift day-to-day)
const NOW = new Date('2026-01-01T00:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

// createScorer binds the config once — useful when scoring many answers
// against the same corpus and authority setup.
const scorer = createScorer({
  authority: {
    tiers: [
      { name: 'Declaration', rank: 10, keywords: ['CC&Rs', 'Declaration', 'Master Deed'] },
      { name: 'Bylaws', rank: 15, keywords: ['Bylaws', 'By-Laws'] },
      { name: 'Amendment', rank: 12, keywords: ['Amendment', 'Restated'] },
      { name: 'Rules', rank: 20, keywords: ['Rules', 'Regulations', 'Policy'] },
    ],
  },
  corpus: { expectedTypeCount: 6 },
  freshness: {
    maxAgeForFullScore: 90,
    penaltyPerMonth: 1.5,
    hardCutoffAge: 730,
    now: NOW, // deterministic scoring
  },
  // Custom action policy — lower answerAt threshold for this domain
  actionPolicy: {
    answerAt: 70,
    reviewAt: 40,
    abstainBelow: 40,
    requireTier1AtLeast: 40,
    reviewOnWarnings: ['missing-answer-relevance'], // removed missing-conflict-signal
    abstainOnWarnings: ['documents-silent'],
  },
});

const scorecard = scorer.compute({
  // LLM-assessed signals — all favorable
  supportLevel: 'high',
  queryComplexity: 'multi-hop', // complex: must trace amendment chain
  faithfulnessScore: 0.94, // LLM answer closely tracks source text
  answerRelevanceScore: 0.95, // answer directly addresses the user's question
  citationCount: 4,
  ambiguityNotes: null,
  requiresExpertReview: false,
  hasConflict: false,
  conflictingCandidateCount: 0,

  // Five strong candidates from three documents, all multi-method
  candidates: [
    {
      retrievalScores: { semantic: 0.93, keyword: 0.85, rerank: 0.91 },
      combinedScore: 0.93,
      documentId: 'declaration-2018',
      documentType: 'CC&Rs',
      authorityRank: 10,
      isAmendment: false,
      extractionQuality: 0.98,
      lastUpdated: daysAgo(45),
    },
    {
      retrievalScores: { semantic: 0.9, keyword: 0.82, rerank: 0.88 },
      combinedScore: 0.9,
      documentId: 'declaration-2018',
      documentType: 'CC&Rs',
      authorityRank: 10,
      isAmendment: false,
      extractionQuality: 0.97,
      lastUpdated: daysAgo(45),
    },
    {
      retrievalScores: { semantic: 0.88, keyword: 0.79, rerank: 0.86 },
      combinedScore: 0.88,
      documentId: 'amendment-2022',
      documentType: 'Amendment',
      authorityRank: 12,
      isAmendment: true, // amendment bonus
      extractionQuality: 0.96,
      lastUpdated: daysAgo(20),
    },
    {
      retrievalScores: { semantic: 0.84, keyword: 0.75, rerank: 0.82 },
      combinedScore: 0.84,
      documentId: 'bylaws-2018',
      documentType: 'Bylaws',
      authorityRank: 15,
      isAmendment: false,
      extractionQuality: 0.95,
      lastUpdated: daysAgo(50),
    },
    {
      retrievalScores: { semantic: 0.81, keyword: 0.7, rerank: 0.79 },
      combinedScore: 0.81,
      documentId: 'rules-2023',
      documentType: 'Rules',
      authorityRank: 20,
      isAmendment: false,
      extractionQuality: 0.94,
      lastUpdated: daysAgo(30),
    },
  ],

  // Corpus state — all 6 expected document types loaded
  corpusTypeCount: 6,
  missingRelevantType: false,
});

// ── Primary output ──────────────────────────────────────────────────────────
console.log('=== Full Pipeline Scorecard (Legal Research Assistant) ===');
console.log(`Total:             ${scorecard.total} / 100`);
console.log(`Label:             ${scorecard.label} (${scorecard.labelColor})`);
console.log(`Recommended:       ${scorecard.recommendedAction}`);
console.log(`Action reason:     ${scorecard.actionReason}`);
console.log(
  `Tier 1:            ${scorecard.tier1?.score} — ${scorecard.tier1?.label}  (Answer Confidence)`,
);
console.log(
  `Tier 2:            ${scorecard.tier2?.score} — ${scorecard.tier2?.label}  (System Readiness)`,
);

// ── Dimension scores ────────────────────────────────────────────────────────
console.log('');
console.log('Dimensions:');
const d = scorecard.dimensions;
console.log(`  Grounding:   ${d.grounding.raw} / ${d.grounding.max}`);
console.log(`  Retrieval:   ${d.retrieval.raw} / ${d.retrieval.max}`);
console.log(`  Consistency: ${d.consistency.raw} / ${d.consistency.max}`);
console.log(`  Relevance:   ${d.relevance?.raw} / ${d.relevance?.max}`);
console.log(`  Authority:   ${d.authority?.raw} / ${d.authority?.max}`);
console.log(`  Corpus:      ${d.corpus?.raw} / ${d.corpus?.max}`);
console.log(`  Freshness:   ${d.freshness?.raw} / ${d.freshness?.max}`);

// ── Machine-readable breakdown (grounding) ──────────────────────────────────
console.log('');
console.log('Grounding breakdown:');
const gb = d.grounding.breakdown;
if (gb) {
  console.log('  components:', JSON.stringify(gb.components));
  console.log('  adjustments:', JSON.stringify(gb.adjustments));
  console.log(`  uncappedRaw: ${gb.uncappedRaw}  raw: ${gb.raw}`);
  // Invariant: breakdown.raw === DimensionScore.raw
  console.assert(gb.raw === d.grounding.raw, 'breakdown.raw must equal DimensionScore.raw');
}

// ── Meta ────────────────────────────────────────────────────────────────────
console.log('');
console.log('Meta:');
console.log(`  algorithmVersion:  ${scorecard.meta.algorithmVersion}`);
console.log(`  rawTotal:          ${scorecard.meta.rawTotal}`);
console.log(`  maxPossible:       ${scorecard.meta.maxPossible}`);
console.log(`  activeExtensions:  ${scorecard.meta.activeExtensions.join(', ')}`);
console.log(`  activeDimensions:  ${scorecard.meta.activeDimensions.join(', ')}`);
console.log(`  weights:           ${JSON.stringify(scorecard.meta.weights)}`);
console.log(
  `  warnings:          ${scorecard.meta.warnings.length === 0 ? 'none' : scorecard.meta.warnings.map((w) => w.code).join(', ')}`,
);
console.log(
  `  missingSignals:    ${scorecard.meta.missingSignals.length === 0 ? 'none' : scorecard.meta.missingSignals.join(', ')}`,
);

// ── Runtime gating pattern ──────────────────────────────────────────────────
console.log('');
console.log('Runtime gating:');
if (scorecard.recommendedAction === 'abstain') {
  console.log(`  ABSTAIN — ${scorecard.actionReason}`);
} else if (scorecard.recommendedAction === 'review') {
  console.log(
    `  REVIEW REQUIRED — confidence: ${scorecard.total}  reason: ${scorecard.actionReason}`,
  );
} else {
  console.log(`  ANSWER — confidence: ${scorecard.total}`);
}
