/**
 * Example: Legal Docs — Authority + Corpus extensions, HOA governance scenario
 *
 * Scenario: An HOA board member asks about pet restriction rules. The system
 * retrieves from CC&Rs (primary authority) and Rules & Regulations (secondary).
 * Corpus is 4 of 5 expected document types loaded — one type missing.
 *
 * Expected label:  Moderate
 * Expected range:  74–82
 */

import { computeConfidence } from '../src/index.js';

const scorecard = computeConfidence(
  {
    // LLM-assessed signals — medium confidence: rule text present but has exceptions
    confidenceLevel: 'medium',
    citationCount: 2,
    queryComplexity: 'inferential', // requires reading across multiple sections

    // Retrieved candidates from two governing documents
    candidates: [
      {
        retrievalScores: { semantic: 0.91, keyword: 0.78 },
        combinedScore: 0.91,
        documentId: 'ccrs-2019',
        documentType: 'CC&Rs',
        authorityRank: 10, // primary — highest authority tier
        isAmendment: false,
        extractionQuality: 0.97,
      },
      {
        retrievalScores: { semantic: 0.84, keyword: 0.71 },
        combinedScore: 0.84,
        documentId: 'ccrs-2019',
        documentType: 'CC&Rs',
        authorityRank: 10,
        isAmendment: false,
        extractionQuality: 0.95,
      },
      {
        retrievalScores: { semantic: 0.76, keyword: 0.62 },
        combinedScore: 0.76,
        documentId: 'rules-regs-2023',
        documentType: 'Rules & Regulations',
        authorityRank: 20, // secondary tier
        isAmendment: false,
        extractionQuality: 0.92,
      },
    ],

    // Corpus state — 4 of 5 expected doc types uploaded
    corpusDocCount: 4,
    missingRelevantType: false,
  },
  {
    // Authority extension — default tiers (Primary ≤10, Secondary ≤20, Supporting ≤30)
    authority: {},

    // Corpus extension — 5 document types expected for a complete HOA corpus
    corpus: { expectedDocCount: 5 },
  },
);

console.log('=== Legal Docs Scorecard (HOA Governance) ===');
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
  `  Authority:   ${scorecard.dimensions.authority?.raw} / ${scorecard.dimensions.authority?.max}  — ${scorecard.dimensions.authority?.explanation}`,
);
console.log(
  `  Corpus:      ${scorecard.dimensions.corpus?.raw} / ${scorecard.dimensions.corpus?.max}  — ${scorecard.dimensions.corpus?.explanation}`,
);
console.log('');
console.log('Active extensions:', scorecard.meta.activeExtensions);
console.log('Meta:', scorecard.meta);
