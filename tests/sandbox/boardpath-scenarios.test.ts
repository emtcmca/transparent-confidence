/**
 * BoardPath Integration Fitness Sandbox
 *
 * These tests simulate realistic HOA RAG scenarios using the kinds of inputs
 * BoardPath's pipeline would produce. They are NOT unit tests — they are
 * exploratory scenario tests that answer:
 *
 *   1. Does the scoring behave sensibly for HOA document queries?
 *   2. What integration mapping is required?
 *   3. Where does the default config need tuning?
 *
 * Each describe block is a scenario. Each test within it probes one
 * behavioral question. Run these with: npx vitest run tests/sandbox
 *
 * ── Pipeline mapping (BoardPath → transparent-confidence inputs) ─────────────
 *
 *   BoardPath output                  → ScoringInputs field
 *   ─────────────────────────────────────────────────────────────
 *   LLM answer confidence string      → supportLevel ('low'|'medium'|'high')
 *   pgvector cosine similarity scores → candidates[].retrievalScores.semantic
 *   pgvector cosine similarity scores → candidates[].combinedScore
 *   chunk.document_type               → candidates[].documentType
 *   chunk.document_id                 → candidates[].documentId
 *   chunk.last_updated                → candidates[].lastUpdated
 *   chunk.is_amendment                → candidates[].isAmendment
 *   extraction pipeline quality score → candidates[].extractionQuality
 *   LLM faithfulness eval (optional)  → faithfulnessScore
 *   LLM answer relevance eval (opt.)  → answerRelevanceScore
 *   conflicting chunk detection       → hasConflict, conflictingCandidateCount
 *   corpus.getTypeCount()             → corpusTypeCount
 *   corpus.hasMissingRelevantType()   → missingRelevantType
 *
 * ── What BoardPath does NOT currently produce ─────────────────────────────────
 *
 *   - retrievalScores.keyword (vector-only pipeline → use minConfirmedMethods: 1)
 *   - faithfulnessScore (would need a second LLM eval call)
 *   - answerRelevanceScore (would need a second LLM eval call)
 *   - hasConflict (would need chunk conflict detection logic)
 *   - extractionQuality (OCR pipeline confidence score — available but not surfaced)
 *   - authorityRank (would need to map document_type → rank at query time)
 *
 * ── Integration work required ─────────────────────────────────────────────────
 *
 *   Priority 1 — low effort, high value:
 *     a. Map cosine scores → combinedScore + retrievalScores.semantic
 *     b. Map document metadata → documentId, documentType, lastUpdated, isAmendment
 *     c. Set minConfirmedMethods: 1 (vector-only pipeline)
 *     d. Set up HOA authority tier config (see HOA_AUTHORITY_CONFIG below)
 *     e. Set up corpus expectedTypes (see HOA_CORPUS_CONFIG below)
 *     f. Feed corpusTypeCount from corpus query at scoring time
 *
 *   Priority 2 — medium effort, high value:
 *     g. Surface extractionQuality from OCR pipeline into chunk metadata
 *     h. Add hasConflict detection (flag chunks from same doc section with divergent content)
 *
 *   Priority 3 — medium effort, moderate value:
 *     i. Add faithfulnessScore via second LLM eval (adds latency — consider async)
 *     j. Add answerRelevanceScore via second LLM eval
 *
 *   Not needed:
 *     - keyword retrieval scores (vector-only is fine with minConfirmedMethods: 1)
 *     - custom action policy (defaults are appropriate for HOA governance queries)
 */

import { describe, expect, test } from 'vitest';
import { computeConfidence } from '../../src/scorer';
import type { Candidate, ScoringConfig, ScoringInputs } from '../../src/types';

// ── Shared HOA config ─────────────────────────────────────────────────────────
//
// This is the config BoardPath would bind once at app startup via createScorer().
// Document type hierarchy matches standard HOA governance structure.

const HOA_AUTHORITY_CONFIG: ScoringConfig['authority'] = {
  tiers: [
    // Lower rank = higher authority
    {
      name: 'CC&Rs',
      rank: 10,
      keywords: ['CC&Rs', 'CC&R', 'Declaration', 'Master Deed', 'Declaration of Covenants'],
    },
    {
      name: 'Amendment',
      rank: 12,
      keywords: ['Amendment', 'Restated Declaration', 'Amended and Restated'],
    },
    { name: 'Bylaws', rank: 15, keywords: ['Bylaws', 'By-Laws', 'Corporate Bylaws'] },
    {
      name: 'ARC Guidelines',
      rank: 18,
      keywords: ['ARC', 'Architectural', 'Design Guidelines', 'Modification'],
    },
    {
      name: 'Rules & Regs',
      rank: 20,
      keywords: ['Rules', 'Regulations', 'Rules and Regulations', 'Policy'],
    },
    {
      name: 'Meeting Minutes',
      rank: 30,
      keywords: ['Minutes', 'Meeting Minutes', 'Board Meeting'],
    },
  ],
};

const HOA_CORPUS_CONFIG: ScoringConfig['corpus'] = {
  // A fully-loaded HOA corpus has these document types
  expectedTypes: ['CC&Rs', 'Bylaws', 'Rules & Regs', 'ARC Guidelines', 'Amendment', 'Budget'],
};

const HOA_FRESHNESS_CONFIG: ScoringConfig['freshness'] = {
  maxAgeForFullScore: 365, // governing docs update rarely — 1-year window is appropriate
  penaltyPerMonth: 0.5, // gentle penalty; 3-year-old CC&Rs still valid
  hardCutoffAge: 3650, // 10-year hard cutoff
  now: new Date('2026-06-01T00:00:00.000Z'),
};

const HOA_CONFIG: ScoringConfig = {
  retrieval: { minConfirmedMethods: 1 }, // vector-only pipeline
  authority: HOA_AUTHORITY_CONFIG,
  corpus: HOA_CORPUS_CONFIG,
  freshness: HOA_FRESHNESS_CONFIG,
  actionPolicy: {
    answerAt: 60, // lower threshold: HOA governance answers often partial
    reviewAt: 35,
    abstainBelow: 35,
    requireTier1AtLeast: 35,
    reviewOnWarnings: ['missing-conflict-signal', 'missing-answer-relevance'],
    abstainOnWarnings: ['documents-silent'],
  },
};

// ── Candidate builder ─────────────────────────────────────────────────────────

function hoaCandidate(
  semantic: number,
  documentId: string,
  documentType: string,
  opts: Partial<
    Omit<Candidate, 'retrievalScores' | 'combinedScore' | 'documentId' | 'documentType'>
  > = {},
): Candidate {
  return {
    retrievalScores: { semantic },
    combinedScore: semantic,
    documentId,
    documentType,
    ...opts,
  };
}

const NOW = new Date('2026-06-01T00:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

// ── Scenario 1: Simple pet policy query ──────────────────────────────────────
//
// "What is the pet policy?" — strong semantic hits from CC&Rs + Rules & Regs.
// Typical easy query: high support, fresh docs, no conflict.
// This is the golden path most BoardPath queries should hit.

describe('Scenario 1 — simple pet policy query (golden path)', () => {
  const inputs: ScoringInputs = {
    supportLevel: 'high',
    hasConflict: false,
    citationCount: 3,
    candidates: [
      hoaCandidate(0.87, 'ccrs-2020', 'CC&Rs', {
        authorityRank: 10,
        lastUpdated: daysAgo(400),
      }),
      hoaCandidate(0.82, 'rules-2023', 'Rules & Regs', {
        authorityRank: 20,
        lastUpdated: daysAgo(180),
      }),
      hoaCandidate(0.79, 'rules-2023', 'Rules & Regs', {
        authorityRank: 20,
        lastUpdated: daysAgo(180),
      }),
    ],
    corpusTypeCount: 5,
  };

  test('scores ≥ 65 (answer threshold)', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.total).toBeGreaterThanOrEqual(65);
  });

  test('recommendedAction = answer', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.recommendedAction).toBe('answer');
  });

  test('authority dimension active (rank-bearing candidates)', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.dimensions.authority).toBeDefined();
    expect(sc.dimensions.authority?.raw).toBeGreaterThan(0);
  });

  test('corpus dimension active with 5/6 types loaded', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.dimensions.corpus).toBeDefined();
    // Missing 1 of 6 types — should not be full score
    expect(sc.dimensions.corpus?.raw).toBeLessThan(sc.dimensions.corpus?.max);
  });

  test('no warnings for clean input', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.meta.warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });
});

// ── Scenario 2: ARC fence modification — amendment conflict ──────────────────
//
// "Can I install a 6-foot privacy fence?" — amendment supersedes original CC&Rs.
// Tests that amendment detection and conflict flagging work correctly.
// BoardPath must detect conflicts and set hasConflict: true for accurate scoring.

describe('Scenario 2 — ARC fence query with amendment conflict', () => {
  const inputsWithConflict: ScoringInputs = {
    supportLevel: 'medium',
    hasConflict: true,
    conflictingCandidateCount: 2,
    citationCount: 2,
    candidates: [
      hoaCandidate(0.85, 'ccrs-2020', 'CC&Rs', {
        authorityRank: 10,
        isAmendment: false,
        lastUpdated: daysAgo(800),
      }),
      hoaCandidate(0.83, 'amendment-2024', 'Amendment', {
        authorityRank: 12,
        isAmendment: true, // amendment supersedes CC&Rs
        lastUpdated: daysAgo(60),
      }),
    ],
    corpusTypeCount: 6,
  };

  const inputsWithoutConflict: ScoringInputs = {
    ...inputsWithConflict,
    hasConflict: false,
    conflictingCandidateCount: 0,
  };

  test('conflict present → consistency score reduced vs no-conflict', () => {
    const withConflict = computeConfidence(inputsWithConflict, HOA_CONFIG);
    const withoutConflict = computeConfidence(inputsWithoutConflict, HOA_CONFIG);
    expect(withConflict.dimensions.consistency.raw).toBeLessThan(
      withoutConflict.dimensions.consistency.raw,
    );
  });

  test('conflict present → total score reduced vs no-conflict', () => {
    const withConflict = computeConfidence(inputsWithConflict, HOA_CONFIG);
    const withoutConflict = computeConfidence(inputsWithoutConflict, HOA_CONFIG);
    expect(withConflict.total).toBeLessThan(withoutConflict.total);
  });

  test('amendment candidate triggers authority amendment bonus', () => {
    const sc = computeConfidence(inputsWithConflict, HOA_CONFIG);
    expect(sc.dimensions.authority).toBeDefined();
    const breakdown = sc.dimensions.authority?.breakdown;
    expect(breakdown).toBeDefined();
    // Amendment bonus lands in components.bonuses
    expect((breakdown?.components as Record<string, number>).bonuses).toBeGreaterThan(0);
  });

  test('without hasConflict set → missing-conflict-signal warning fires', () => {
    const noSignalInputs: ScoringInputs = {
      ...inputsWithConflict,
      hasConflict: undefined,
      conflictingCandidateCount: undefined,
    };
    const sc = computeConfidence(noSignalInputs, HOA_CONFIG);
    const codes = sc.meta.warnings.map((w) => w.code);
    expect(codes).toContain('missing-conflict-signal');
  });

  test('missing-conflict-signal → recommendedAction = review (not answer)', () => {
    const noSignalInputs: ScoringInputs = {
      ...inputsWithConflict,
      hasConflict: undefined,
      conflictingCandidateCount: undefined,
    };
    const sc = computeConfidence(noSignalInputs, HOA_CONFIG);
    expect(sc.recommendedAction).toBe('review');
  });
});

// ── Scenario 3: Documents-silent — pgvector returns no relevant chunks ────────
//
// BoardPath's pgvector query returns nothing above the similarity threshold —
// the corpus genuinely doesn't contain an answer to this query.
// Empty candidates is the correct signal; the scorer fires documents-silent →
// abstainOnWarnings triggers → abstain.
//
// Also tests the borderline case: very weak candidates present but below useful
// similarity — still low score but may not abstain.

describe('Scenario 3 — documents silent (no relevant content)', () => {
  // True empty-result case: pgvector returns nothing
  const emptyInputs: ScoringInputs = {
    supportLevel: 'low',
    citationCount: 0,
    candidates: [],
    corpusTypeCount: 6,
  };

  // Weak-candidate case: pgvector returns results but similarity is low
  const weakInputs: ScoringInputs = {
    supportLevel: 'low',
    hasConflict: false,
    citationCount: 0,
    candidates: [
      hoaCandidate(0.35, 'ccrs-2020', 'CC&Rs', { lastUpdated: daysAgo(400) }),
      hoaCandidate(0.31, 'bylaws-2020', 'Bylaws', { lastUpdated: daysAgo(400) }),
    ],
    corpusTypeCount: 4,
  };

  test('empty candidates → missing-candidates warning fires', () => {
    const sc = computeConfidence(emptyInputs, HOA_CONFIG);
    const codes = sc.meta.warnings.map((w) => w.code);
    expect(codes).toContain('missing-candidates');
  });

  test('empty candidates → recommendedAction = abstain (documents-silent rule)', () => {
    const sc = computeConfidence(emptyInputs, HOA_CONFIG);
    expect(sc.recommendedAction).toBe('abstain');
  });

  test('empty candidates → total < 20', () => {
    const sc = computeConfidence(emptyInputs, HOA_CONFIG);
    expect(sc.total).toBeLessThan(20);
  });

  test('weak candidates → grounding score minimal (low supportLevel)', () => {
    const sc = computeConfidence(weakInputs, HOA_CONFIG);
    expect(sc.dimensions.grounding.raw).toBeLessThanOrEqual(10);
  });

  test('weak candidates → total < 65 (does not reach answer threshold)', () => {
    const sc = computeConfidence(weakInputs, HOA_CONFIG);
    expect(sc.total).toBeLessThan(65);
  });
});

// ── Scenario 4: Stale corpus — outdated governing documents ──────────────────
//
// Association hasn't uploaded updated docs in years.
// Tests freshness penalty under real HOA document age patterns.

describe('Scenario 4 — stale governing documents', () => {
  const freshInputs: ScoringInputs = {
    supportLevel: 'high',
    hasConflict: false,
    citationCount: 2,
    candidates: [
      hoaCandidate(0.84, 'ccrs-2020', 'CC&Rs', {
        authorityRank: 10,
        lastUpdated: daysAgo(200), // within 1-year window
      }),
      hoaCandidate(0.8, 'rules-2023', 'Rules & Regs', {
        authorityRank: 20,
        lastUpdated: daysAgo(100),
      }),
    ],
    corpusTypeCount: 5,
  };

  const staleInputs: ScoringInputs = {
    ...freshInputs,
    candidates: [
      hoaCandidate(0.84, 'ccrs-2012', 'CC&Rs', {
        authorityRank: 10,
        lastUpdated: daysAgo(2500), // ~6.8 years old
      }),
      hoaCandidate(0.8, 'rules-2015', 'Rules & Regs', {
        authorityRank: 20,
        lastUpdated: daysAgo(3000), // ~8.2 years old
      }),
    ],
  };

  test('fresh docs score higher than stale docs (same retrieval quality)', () => {
    const fresh = computeConfidence(freshInputs, HOA_CONFIG);
    const stale = computeConfidence(staleInputs, HOA_CONFIG);
    expect(fresh.dimensions.freshness?.raw).toBeGreaterThan(stale.dimensions.freshness?.raw);
    expect(fresh.total).toBeGreaterThan(stale.total);
  });

  test('stale docs do not cause abstain on their own (age ≠ incorrectness)', () => {
    const sc = computeConfidence(staleInputs, HOA_CONFIG);
    // freshness alone should not drive action to abstain
    // — stale docs are still the governing docs until replaced
    expect(sc.recommendedAction).not.toBe('abstain');
  });

  test('stale docs lower total score but answer still possible', () => {
    const sc = computeConfidence(staleInputs, HOA_CONFIG);
    expect(sc.total).toBeGreaterThan(0);
    // Depends on how stale — verify freshness dimension is active and penalized
    expect(sc.dimensions.freshness?.raw).toBeLessThan(sc.dimensions.freshness?.max);
  });
});

// ── Scenario 5: Incomplete corpus — missing document types ───────────────────
//
// An association hasn't uploaded all document types yet (common during onboarding).
// Tests corpus completeness scoring with partial upload states.

describe('Scenario 5 — incomplete corpus during onboarding', () => {
  const baseInputs: ScoringInputs = {
    supportLevel: 'high',
    hasConflict: false,
    citationCount: 2,
    candidates: [
      hoaCandidate(0.86, 'ccrs-2020', 'CC&Rs', {
        authorityRank: 10,
        lastUpdated: daysAgo(300),
      }),
    ],
  };

  test('0 of 6 types → corpus.raw = 0', () => {
    const sc = computeConfidence({ ...baseInputs, corpusTypeCount: 0 }, HOA_CONFIG);
    expect(sc.dimensions.corpus?.raw).toBe(0);
  });

  test('3 of 6 types → corpus scores roughly half', () => {
    const sc = computeConfidence({ ...baseInputs, corpusTypeCount: 3 }, HOA_CONFIG);
    const ratio = sc.dimensions.corpus?.raw / sc.dimensions.corpus?.max;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.8);
  });

  test('6 of 6 types → corpus.raw = corpus.max', () => {
    const sc = computeConfidence({ ...baseInputs, corpusTypeCount: 6 }, HOA_CONFIG);
    expect(sc.dimensions.corpus?.raw).toBe(sc.dimensions.corpus?.max);
  });

  test('missing a relevant type → missingRelevantType flag reduces score', () => {
    const without = computeConfidence({ ...baseInputs, corpusTypeCount: 5 }, HOA_CONFIG);
    const withFlag = computeConfidence(
      { ...baseInputs, corpusTypeCount: 5, missingRelevantType: true },
      HOA_CONFIG,
    );
    expect(withFlag.dimensions.corpus?.raw).toBeLessThan(without.dimensions.corpus?.raw);
  });
});

// ── Scenario 6: Multi-document query — amendment chain ───────────────────────
//
// "What are the current parking restrictions?" — requires tracing:
// CC&Rs (2015) → Amendment 1 (2019) → Amendment 2 (2023)
// Tests that authority scoring correctly weights the amendment chain.

describe('Scenario 6 — multi-document amendment chain (parking restrictions)', () => {
  const inputs: ScoringInputs = {
    supportLevel: 'high',
    hasConflict: false,
    conflictingCandidateCount: 0,
    citationCount: 4,
    queryComplexity: 'multi-hop',
    candidates: [
      hoaCandidate(0.88, 'ccrs-2015', 'CC&Rs', {
        authorityRank: 10,
        isAmendment: false,
        lastUpdated: daysAgo(1200),
      }),
      hoaCandidate(0.91, 'amendment-2019', 'Amendment', {
        authorityRank: 12,
        isAmendment: true,
        lastUpdated: daysAgo(700),
      }),
      hoaCandidate(0.93, 'amendment-2023', 'Amendment', {
        authorityRank: 12,
        isAmendment: true,
        lastUpdated: daysAgo(100),
      }),
      hoaCandidate(0.85, 'rules-2023', 'Rules & Regs', {
        authorityRank: 20,
        isAmendment: false,
        lastUpdated: daysAgo(120),
      }),
    ],
    corpusTypeCount: 6,
  };

  test('scores ≥ 65 (multi-hop still answers when evidence is strong)', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.total).toBeGreaterThanOrEqual(65);
  });

  test('recommendedAction = answer', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.recommendedAction).toBe('answer');
  });

  test('multi-hop complexity does not falsely reduce score', () => {
    const directInputs: ScoringInputs = { ...inputs, queryComplexity: 'direct' };
    const multiHopInputs: ScoringInputs = { ...inputs, queryComplexity: 'multi-hop' };
    const direct = computeConfidence(directInputs, HOA_CONFIG);
    const multiHop = computeConfidence(multiHopInputs, HOA_CONFIG);
    // multi-hop reduces grounding slightly but shouldn't kill the score
    expect(multiHop.total).toBeGreaterThan(50);
    expect(direct.total).toBeGreaterThanOrEqual(multiHop.total);
  });

  test('two amendment candidates → authority amendment bonus applied', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.dimensions.authority).toBeDefined();
    expect(sc.dimensions.authority?.raw).toBeGreaterThan(0);
  });
});

// ── Scenario 7: Required-review threshold test ───────────────────────────────
//
// Borderline queries where the system should flag for human review rather than
// answer or abstain. Tests the review band behavior.

describe('Scenario 7 — borderline query requiring human review', () => {
  const inputs: ScoringInputs = {
    supportLevel: 'medium',
    // hasConflict intentionally omitted — triggers missing-conflict-signal
    citationCount: 1,
    candidates: [
      hoaCandidate(0.72, 'ccrs-2020', 'CC&Rs', {
        authorityRank: 10,
        lastUpdated: daysAgo(400),
      }),
    ],
    corpusTypeCount: 3, // incomplete corpus
  };

  test('missing-conflict-signal warning present', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    const codes = sc.meta.warnings.map((w) => w.code);
    expect(codes).toContain('missing-conflict-signal');
  });

  test('recommendedAction = review (warning escalates even at moderate total)', () => {
    const sc = computeConfidence(inputs, HOA_CONFIG);
    expect(sc.recommendedAction).toBe('review');
  });

  test('adding hasConflict: false removes warning and may allow answer', () => {
    const withSignal = computeConfidence({ ...inputs, hasConflict: false }, HOA_CONFIG);
    const codes = withSignal.meta.warnings.map((w) => w.code);
    expect(codes).not.toContain('missing-conflict-signal');
  });
});

// ── Scenario 8: Minimum viable integration (Priority 1 fields only) ──────────
//
// What BoardPath could produce TODAY with minimal mapping work:
// cosine score → semantic + combined, document metadata.
// No faithfulness, no conflict detection, no extractionQuality.
// Tests that the minimum viable integration still produces useful scores.

describe('Scenario 8 — minimum viable integration (cosine + metadata only)', () => {
  // Simulates exactly what BoardPath's pgvector query returns today,
  // mapped to the minimum required ScoringInputs fields.
  const minimalInputs: ScoringInputs = {
    // Maps from LLM response parsing
    supportLevel: 'high',

    // NOT provided yet (require additional work):
    // hasConflict — needs conflict detection logic
    // faithfulnessScore — needs second LLM eval
    // answerRelevanceScore — needs second LLM eval

    candidates: [
      // Each row from pgvector similarity search
      {
        retrievalScores: { semantic: 0.84 }, // cosine similarity from pgvector
        combinedScore: 0.84,
        documentId: 'chunk-uuid-001',
        documentType: 'CC&Rs', // from chunk metadata
        lastUpdated: daysAgo(400), // from document.updated_at
        authorityRank: 10, // mapped from document_type → rank at query time
      },
      {
        retrievalScores: { semantic: 0.79 },
        combinedScore: 0.79,
        documentId: 'chunk-uuid-002',
        documentType: 'Rules & Regs',
        lastUpdated: daysAgo(180),
        authorityRank: 20,
      },
    ],

    corpusTypeCount: 4, // from corpus.getTypeCount() query
  };

  test('minimum viable integration produces a scorecard without throwing', () => {
    expect(() => computeConfidence(minimalInputs, HOA_CONFIG)).not.toThrow();
  });

  test('scorecard has all required fields', () => {
    const sc = computeConfidence(minimalInputs, HOA_CONFIG);
    expect(sc.total).toBeGreaterThanOrEqual(0);
    expect(sc.total).toBeLessThanOrEqual(100);
    expect(sc.recommendedAction).toMatch(/^(answer|review|abstain)$/);
    expect(sc.actionReason).toBeTruthy();
    expect(sc.meta.algorithmVersion).toBe('0.2.0');
  });

  test('missing-conflict-signal warning fires (expected gap in MVP)', () => {
    const sc = computeConfidence(minimalInputs, HOA_CONFIG);
    const codes = sc.meta.warnings.map((w) => w.code);
    expect(codes).toContain('missing-conflict-signal');
  });

  test('recommendedAction = review (conflict signal gap keeps it conservative)', () => {
    const sc = computeConfidence(minimalInputs, HOA_CONFIG);
    // Expected: review due to missing-conflict-signal in reviewOnWarnings
    expect(sc.recommendedAction).toBe('review');
  });

  test('adding hasConflict: false unlocks answer on clean MVP input', () => {
    const sc = computeConfidence({ ...minimalInputs, hasConflict: false }, HOA_CONFIG);
    expect(sc.recommendedAction).toBe('answer');
  });
});

// ── Scenario 9: Score stability — same query, different retrieval quality ────
//
// Verifies that score moves predictably as retrieval quality improves.
// Validates the scoring is monotonic in the expected direction.

describe('Scenario 9 — score monotonicity as retrieval quality improves', () => {
  function makeInputs(semanticScore: number): ScoringInputs {
    return {
      supportLevel: 'high',
      hasConflict: false,
      candidates: [
        hoaCandidate(semanticScore, 'ccrs-2020', 'CC&Rs', {
          authorityRank: 10,
          lastUpdated: daysAgo(300),
        }),
        hoaCandidate(semanticScore - 0.05, 'rules-2023', 'Rules & Regs', {
          authorityRank: 20,
          lastUpdated: daysAgo(150),
        }),
      ],
      corpusTypeCount: 5,
    };
  }

  test('0.95 semantic scores higher than 0.75', () => {
    const high = computeConfidence(makeInputs(0.95), HOA_CONFIG);
    const low = computeConfidence(makeInputs(0.75), HOA_CONFIG);
    expect(high.total).toBeGreaterThan(low.total);
  });

  test('0.75 semantic scores higher than 0.55', () => {
    const medium = computeConfidence(makeInputs(0.75), HOA_CONFIG);
    const low = computeConfidence(makeInputs(0.55), HOA_CONFIG);
    expect(medium.total).toBeGreaterThan(low.total);
  });

  test('retrieval.raw increases monotonically with semantic score', () => {
    const scores = [0.55, 0.65, 0.75, 0.85, 0.95].map(
      (s) => computeConfidence(makeInputs(s), HOA_CONFIG).dimensions.retrieval.raw,
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});
