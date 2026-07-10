// transparent-confidence playground
// Four scenarios showing how the confidence scorer (3 core + 5 optional
// dimensions) and its action policy respond to different retrieval situations.
// Docs: https://github.com/emtcmca/transparent-confidence

import { computeConfidence } from 'transparent-confidence';

// --- Output helpers -------------------------------------------------------

function header(title) {
  console.log('');
  console.log('='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function printScorecard(scorecard) {
  console.log(`Total:             ${scorecard.total}`);
  console.log(`Label:             ${scorecard.label}`);
  console.log(`Recommended action: ${scorecard.recommendedAction}`);
  console.log(`Action reason:      ${scorecard.actionReason}`);
  console.log('Dimensions:');
  for (const [name, dim] of Object.entries(scorecard.dimensions)) {
    console.log(`  - ${name.padEnd(12)} raw ${dim.raw} / max ${dim.max}`);
  }
  const codes = scorecard.meta.warnings.map((w) => w.code);
  console.log(`Warning codes:      ${codes.length > 0 ? codes.join(', ') : '(none)'}`);
}

// --- Scenario 1: Strong answer --------------------------------------------
// High source support, no conflict, three well-scored candidates from three
// distinct documents, three citations. Everything the scorer wants to see.
// Expected action: 'answer'.

header('Scenario 1 — Strong answer');
const strong = computeConfidence({
  supportLevel: 'high',
  hasConflict: false, // explicit — prevents the missing-conflict-signal warning
  citationCount: 3,
  candidates: [
    { retrievalScores: { semantic: 0.88, keyword: 0.72 }, combinedScore: 0.88, documentId: 'doc-001' },
    { retrievalScores: { semantic: 0.85, keyword: 0.68 }, combinedScore: 0.85, documentId: 'doc-002' },
    { retrievalScores: { semantic: 0.82, keyword: 0.65 }, combinedScore: 0.82, documentId: 'doc-003' },
  ],
});
printScorecard(strong);

// --- Scenario 2: Conflicting evidence --------------------------------------
// Sources disagree (hasConflict: true) and retrieval quality is mixed.
// Conflict drags down grounding/consistency, landing the total in the
// review band (>= 40 but < 65). Expected action: 'review'.

header('Scenario 2 — Conflicting evidence');
const conflicting = computeConfidence({
  supportLevel: 'medium',
  hasConflict: true, // the sources contradict each other
  citationCount: 2,
  candidates: [
    { retrievalScores: { semantic: 0.78, keyword: 0.35 }, combinedScore: 0.74, documentId: 'doc-101' },
    { retrievalScores: { semantic: 0.52, keyword: 0.61 }, combinedScore: 0.55, documentId: 'doc-102' },
    { retrievalScores: { semantic: 0.44, keyword: 0.2 }, combinedScore: 0.4, documentId: 'doc-103' },
  ],
});
printScorecard(conflicting);

// --- Scenario 3: Weak retrieval --------------------------------------------
// Low source support and a single weak candidate. The total falls low
// enough that the policy refuses to answer. Expected: 'review' or 'abstain'.

header('Scenario 3 — Weak retrieval');
const weak = computeConfidence({
  supportLevel: 'low',
  hasConflict: false,
  citationCount: 0,
  candidates: [
    { retrievalScores: { semantic: 0.31 }, combinedScore: 0.31, documentId: 'doc-201' },
  ],
});
printScorecard(weak);

// --- Scenario 4: Production preset, missing signals ------------------------
// Same inputs as Scenario 1, but scored under preset 'production-v0.3',
// which REQUIRES answerRelevanceScore, a conflict signal, and
// faithfulnessScore (or claimSupport). We omit the evaluator signals, so
// the scorecard gains required-signal-missing warnings and the action is
// forced to 'review' — even though the raw score is strong.

header('Scenario 4 — Production preset, missing signals');
const production = computeConfidence(
  {
    supportLevel: 'high',
    hasConflict: false,
    citationCount: 3,
    candidates: [
      { retrievalScores: { semantic: 0.88, keyword: 0.72 }, combinedScore: 0.88, documentId: 'doc-001' },
      { retrievalScores: { semantic: 0.85, keyword: 0.68 }, combinedScore: 0.85, documentId: 'doc-002' },
      { retrievalScores: { semantic: 0.82, keyword: 0.65 }, combinedScore: 0.82, documentId: 'doc-003' },
    ],
    // NOTE: answerRelevanceScore and faithfulnessScore intentionally omitted
  },
  { preset: 'production-v0.3' },
);
printScorecard(production);

console.log('');
console.log('Learn more: https://github.com/emtcmca/transparent-confidence');
