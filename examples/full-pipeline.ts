/**
 * Example: Full Pipeline — all three extensions + all enhanced signals active
 *
 * Scenario: A legal research assistant answers a complex multi-document question
 * about amendment precedence in HOA governing documents. All six dimensions are
 * active. All enhanced signals (faithfulnessScore, queryComplexity, citationCount,
 * extractionQuality) are provided. Corpus is complete, sources are fresh and
 * authoritative.
 *
 * Expected label:  Strong
 * Expected range:  90–100
 */

import { createScorer } from '../src/index.js';

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
  corpus: { expectedDocCount: 6 },
  freshness: {
    maxAgeForFullScore: 90,
    penaltyPerMonth: 1.5,
    hardCutoffAge: 730,
  },
});

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const scorecard = scorer.compute({
  // LLM-assessed signals — all favorable
  confidenceLevel: 'high',
  queryComplexity: 'multi-hop', // complex: must trace amendment chain
  faithfulnessScore: 0.94, // LLM answer closely tracks source text
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
  corpusDocCount: 6,
  missingRelevantType: false,
});

console.log('=== Full Pipeline Scorecard (Legal Research Assistant) ===');
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
const d = scorecard.dimensions;
console.log(
  `  Grounding:   ${d.grounding.raw} / ${d.grounding.max}  (normalized: ${d.grounding.normalized})`,
);
console.log(
  `  Retrieval:   ${d.retrieval.raw} / ${d.retrieval.max}  (normalized: ${d.retrieval.normalized})`,
);
console.log(
  `  Consistency: ${d.consistency.raw} / ${d.consistency.max}  (normalized: ${d.consistency.normalized})`,
);
console.log(
  `  Authority:   ${d.authority?.raw} / ${d.authority?.max}  (normalized: ${d.authority?.normalized})`,
);
console.log(
  `  Corpus:      ${d.corpus?.raw} / ${d.corpus?.max}  (normalized: ${d.corpus?.normalized})`,
);
console.log(
  `  Freshness:   ${d.freshness?.raw} / ${d.freshness?.max}  (normalized: ${d.freshness?.normalized})`,
);
console.log('');
console.log('Meta:');
console.log(`  rawTotal:         ${scorecard.meta.rawTotal}`);
console.log(`  maxPossible:      ${scorecard.meta.maxPossible}`);
console.log(`  activeExtensions: ${scorecard.meta.activeExtensions.join(', ')}`);
console.log('');
console.log('Dimension explanations:');
console.log(`  Grounding:   ${d.grounding.explanation}`);
console.log(`  Retrieval:   ${d.retrieval.explanation}`);
console.log(`  Consistency: ${d.consistency.explanation}`);
console.log(`  Authority:   ${d.authority?.explanation}`);
console.log(`  Corpus:      ${d.corpus?.explanation}`);
console.log(`  Freshness:   ${d.freshness?.explanation}`);
