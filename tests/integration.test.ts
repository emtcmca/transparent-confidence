import { describe, expect, test } from 'vitest';
import { computeConfidence, createScorer } from '../src/scorer';
import type { Candidate, ScoringInputs } from '../src/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function multiMethod(combinedScore: number, documentId: string, rank?: number): Candidate {
  return {
    retrievalScores: { semantic: combinedScore + 0.05, keyword: combinedScore - 0.05 },
    combinedScore,
    documentId,
    ...(rank !== undefined && { authorityRank: rank }),
  };
}

// ── API Contract Tests ────────────────────────────────────────────────────────

describe('computeConfidence — API contracts', () => {
  const base: ScoringInputs = {
    supportLevel: 'high',
    candidates: [multiMethod(0.8, 'doc1'), multiMethod(0.75, 'doc2')],
  };

  test('returns all required scorecard fields', () => {
    const sc = computeConfidence(base);
    expect(sc).toHaveProperty('total');
    expect(sc).toHaveProperty('label');
    expect(sc).toHaveProperty('labelColor');
    expect(sc).toHaveProperty('recommendedAction');
    expect(sc).toHaveProperty('actionReason');
    expect(sc).toHaveProperty('tier1');
    expect(sc).toHaveProperty('tier2');
    expect(sc).toHaveProperty('dimensions');
    expect(sc).toHaveProperty('meta');
    expect(sc.dimensions).toHaveProperty('grounding');
    expect(sc.dimensions).toHaveProperty('retrieval');
    expect(sc.dimensions).toHaveProperty('consistency');
    expect(sc.meta).toHaveProperty('rawTotal');
    expect(sc.meta).toHaveProperty('maxPossible');
    expect(sc.meta).toHaveProperty('activeExtensions');
  });

  test('recommendedAction is one of answer / review / abstain', () => {
    const sc = computeConfidence(base);
    expect(['answer', 'review', 'abstain']).toContain(sc.recommendedAction);
  });

  test('actionReason is a non-empty string', () => {
    const sc = computeConfidence(base);
    expect(typeof sc.actionReason).toBe('string');
    expect(sc.actionReason.length).toBeGreaterThan(0);
  });

  test('total is an integer in range 0–100', () => {
    const sc = computeConfidence(base);
    expect(Number.isInteger(sc.total)).toBe(true);
    expect(sc.total).toBeGreaterThanOrEqual(0);
    expect(sc.total).toBeLessThanOrEqual(100);
  });

  test('meta.rawTotal ≤ meta.maxPossible', () => {
    const sc = computeConfidence(base);
    expect(sc.meta.rawTotal).toBeLessThanOrEqual(sc.meta.maxPossible);
  });

  test('dimensions.authority is undefined when Authority extension not active', () => {
    const sc = computeConfidence(base);
    expect(sc.dimensions.authority).toBeUndefined();
  });

  test('dimensions.corpus is undefined when Corpus extension not active', () => {
    const sc = computeConfidence(base);
    expect(sc.dimensions.corpus).toBeUndefined();
  });

  test('dimensions.freshness is undefined when Freshness extension not active', () => {
    const sc = computeConfidence(base);
    expect(sc.dimensions.freshness).toBeUndefined();
  });

  test('tier2 is null when no system extensions active', () => {
    const sc = computeConfidence(base);
    expect(sc.tier2).toBeNull();
  });

  test('meta.activeExtensions is empty when no extensions active', () => {
    const sc = computeConfidence(base);
    expect(sc.meta.activeExtensions).toHaveLength(0);
  });

  test('passing empty config {} produces same result as no config', () => {
    const a = computeConfidence(base);
    const b = computeConfidence(base, {});
    expect(a.total).toBe(b.total);
    expect(a.label).toBe(b.label);
    expect(a.meta.maxPossible).toBe(b.meta.maxPossible);
  });

  test('candidates: [] does not throw — returns low score with explanation', () => {
    expect(() => computeConfidence({ supportLevel: 'low', candidates: [] })).not.toThrow();
    const sc = computeConfidence({ supportLevel: 'low', candidates: [] });
    expect(sc.total).toBeGreaterThanOrEqual(0);
    expect(sc.dimensions.retrieval.explanation).toBeTruthy();
  });
});

describe('createScorer — API contracts', () => {
  test('compute() produces identical result to computeConfidence(inputs, config)', () => {
    const config = { corpus: { expectedTypeCount: 5 } };
    const inputs: ScoringInputs = {
      supportLevel: 'medium',
      corpusTypeCount: 4,
      candidates: [multiMethod(0.75, 'doc1'), multiMethod(0.7, 'doc2')],
    };
    const scorer = createScorer(config);
    const direct = computeConfidence(inputs, config);
    const viaScorer = scorer.compute(inputs);
    expect(viaScorer.total).toBe(direct.total);
    expect(viaScorer.label).toBe(direct.label);
    expect(viaScorer.meta.activeExtensions).toEqual(direct.meta.activeExtensions);
  });
});

// ── Scenario A — All Extensions Maxed ─────────────────────────────────────────
//
// 5 multi-method candidates, 3 unique docs (2 tiers: rank 10 + 20), one amendment,
// avg combinedScore ~0.86 (std dev ~0.014), full corpus, fresh docs.
// Consistency (v0.2): std dev ~0.014 < 0.10 → 6 stability; no conflict signal → 2 + warning.
//   consistency.raw = 8 (was 10 in v0.1).
// Authority (v0.2 weighted): combinedScores [0.88,0.87,0.86,0.85,0.84], ranks [10,10,20,10,20]
//   → weighted = 16 base + 1 amendment + 1 tier = 18 (was 20 in v0.1 best-wins).
//   rawTotal = 111, maxPossible = 115 → round(111/115*100) = round(96.52) = 97, Strong.

describe('Scenario A — perfect answer, all extensions', () => {
  const candidates: Candidate[] = [
    {
      retrievalScores: { semantic: 0.95, keyword: 0.9 },
      combinedScore: 0.88,
      documentId: 'doc1',
      authorityRank: 10,
      isAmendment: true,
      extractionQuality: 0.98,
      lastUpdated: daysAgo(10),
    },
    {
      retrievalScores: { semantic: 0.9, keyword: 0.85 },
      combinedScore: 0.87,
      documentId: 'doc2',
      authorityRank: 10,
      isAmendment: false,
      extractionQuality: 0.97,
      lastUpdated: daysAgo(15),
    },
    {
      retrievalScores: { semantic: 0.88, keyword: 0.82 },
      combinedScore: 0.86,
      documentId: 'doc3',
      authorityRank: 20,
      isAmendment: false,
      extractionQuality: 0.96,
      lastUpdated: daysAgo(20),
    },
    {
      retrievalScores: { semantic: 0.85, keyword: 0.8 },
      combinedScore: 0.85,
      documentId: 'doc1',
      authorityRank: 10,
      isAmendment: false,
      extractionQuality: 0.95,
      lastUpdated: daysAgo(25),
    },
    {
      retrievalScores: { semantic: 0.82, keyword: 0.78 },
      combinedScore: 0.84,
      documentId: 'doc2',
      authorityRank: 20,
      isAmendment: false,
      extractionQuality: 0.95,
      lastUpdated: daysAgo(30),
    },
  ];

  const inputs: ScoringInputs = {
    supportLevel: 'high',
    faithfulnessScore: 0.95,
    queryComplexity: 'direct',
    citationCount: 4,
    corpusTypeCount: 5,
    candidates,
  };

  const config = {
    authority: {},
    corpus: { expectedTypeCount: 5 },
    freshness: {},
  };

  test('total = 97', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.total).toBe(97);
  });

  test('label = Strong', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.label).toBe('Strong');
  });

  test('maxPossible = 115 (65 + 20 + 15 + 15)', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.meta.maxPossible).toBe(115);
  });

  test('all three extensions listed in activeExtensions', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.meta.activeExtensions).toContain('authority');
    expect(sc.meta.activeExtensions).toContain('corpus');
    expect(sc.meta.activeExtensions).toContain('freshness');
  });

  test('tier2 present with label Complete', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.tier2).not.toBeNull();
    expect(sc.tier2?.label).toBe('Complete');
  });

  test('recommendedAction = review (missing-conflict-signal in reviewOnWarnings, fires before answerAt)', () => {
    // No hasConflict or conflictingCandidateCount → missing-conflict-signal warning.
    // Rule 5 fires before rule 6 even though total=97 >= answerAt=65.
    const sc = computeConfidence(inputs, config);
    expect(sc.recommendedAction).toBe('review');
    expect(sc.actionReason).toContain('missing-conflict-signal');
  });
});

// ── Scenario B — documentsSilent ─────────────────────────────────────────────
//
// Documents do not address the question.
// Grounding = 0 (documentsSilent short-circuits all logic).
// Retrieval = 0 (early return for empty candidates).
// Consistency = 0 (early return for empty candidates).
// rawTotal = 0, maxPossible = 65 → total = 0, Insufficient.

describe('Scenario B — documentsSilent', () => {
  const inputs: ScoringInputs = {
    supportLevel: 'low',
    documentsSilent: true,
    candidates: [],
  };

  test('total = 0', () => {
    const sc = computeConfidence(inputs);
    expect(sc.total).toBe(0);
  });

  test('label = Insufficient', () => {
    const sc = computeConfidence(inputs);
    expect(sc.label).toBe('Insufficient');
  });

  test('tier1 is Not Addressed / gray', () => {
    const sc = computeConfidence(inputs);
    expect(sc.tier1?.label).toBe('Not Addressed');
    expect(sc.tier1?.color).toBe('gray');
  });

  test('dimensions.grounding.raw = 0', () => {
    const sc = computeConfidence(inputs);
    expect(sc.dimensions.grounding.raw).toBe(0);
  });

  test('recommendedAction = abstain (documentsSilent rule 1)', () => {
    const sc = computeConfidence(inputs);
    expect(sc.recommendedAction).toBe('abstain');
    expect(sc.actionReason).toContain('documentsSilent');
  });
});

// ── Scenario C — Low conf, thin corpus (Insufficient) ────────────────────────
//
// 1 candidate (single retrieval method), low confidence, 1 of 5 doc types loaded.
// Grounding: low → 5.
// Retrieval: 0 confirmed → 3; avg 0.50 → 4; 1 doc + 1 candidate → 0.
//   retrieval.raw = 7.
// Consistency (v0.2): 1 candidate → 3 stability; no conflict signal → 2 + warning.
//   consistency.raw = 5.
// Corpus: 1/5 = 20% → base 2. corpus.raw = 2.
// rawTotal = 19, maxPossible = 80 → total = round(23.75) = 24, Insufficient.

describe('Scenario C — low confidence, thin corpus', () => {
  const inputs: ScoringInputs = {
    supportLevel: 'low',
    corpusTypeCount: 1,
    candidates: [{ retrievalScores: { semantic: 0.5 }, combinedScore: 0.5, documentId: 'doc1' }],
  };
  const config = { corpus: { expectedTypeCount: 5 } };

  test('total = 24', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.total).toBe(24);
  });

  test('label = Insufficient', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.label).toBe('Insufficient');
  });

  test('maxPossible = 80 (core 65 + corpus 15)', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.meta.maxPossible).toBe(80);
  });

  test('recommendedAction = abstain (total 24 < abstainBelow 40, rule 3)', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.recommendedAction).toBe('abstain');
    expect(sc.actionReason).toContain('abstainBelow');
  });
});

// ── Scenario D — Medium confidence, clean retrieval (Moderate) ───────────────
//
// 3 candidates (2 methods each), medium confidence, no conflict.
// Grounding: medium → 13.
// Retrieval: 3 confirmed → 15; avg 0.75 → 6; 3 unique docs → 3; 3 candidates → 1.
//   retrieval.raw = 25 (capped, 15+6+3+1=25).
// Consistency (v0.2): std dev 0.082 < 0.10 → 6 stability; no conflict signal → 2 + warning.
//   consistency.raw = 8.
// rawTotal = 46, maxPossible = 65 → total = round(70.77) = 71, Moderate.

describe('Scenario D — medium confidence, clean retrieval', () => {
  const candidates: Candidate[] = [
    { retrievalScores: { semantic: 0.85, keyword: 0.8 }, combinedScore: 0.8, documentId: 'doc1' },
    { retrievalScores: { semantic: 0.8, keyword: 0.75 }, combinedScore: 0.75, documentId: 'doc2' },
    { retrievalScores: { semantic: 0.75, keyword: 0.7 }, combinedScore: 0.7, documentId: 'doc3' },
  ];

  const inputs: ScoringInputs = { supportLevel: 'medium', candidates };

  test('total = 71', () => {
    const sc = computeConfidence(inputs);
    expect(sc.total).toBe(71);
  });

  test('label = Moderate', () => {
    const sc = computeConfidence(inputs);
    expect(sc.label).toBe('Moderate');
  });

  test('recommendedAction = review (missing-conflict-signal in reviewOnWarnings, rule 5)', () => {
    // total=71 >= answerAt=65, but rule 5 fires first due to missing-conflict-signal.
    const sc = computeConfidence(inputs);
    expect(sc.recommendedAction).toBe('review');
    expect(sc.actionReason).toContain('missing-conflict-signal');
  });
});

// ── Scenario E — High conf, multi-hop, low faithfulness (Limited) ─────────────
//
// High confidence overridden by multi-hop ceiling (18) and faithfulness penalty (-12).
// Grounding: high → 30; multi-hop ceiling → 18; faithfulness 0.45 → -12 → 6.
// Retrieval: 3 confirmed → 15; avg 0.75 → 6; 3 unique docs → 3; 3 candidates → 1.
//   retrieval.raw = 25 (capped).
// Consistency (v0.2): std dev 0.082 < 0.10 → 6 stability; no conflict signal → 2 + warning.
//   consistency.raw = 8.
// rawTotal = 39, maxPossible = 65 → total = round(60.0) = 60, Limited.

describe('Scenario E — high conf, multi-hop, low faithfulness', () => {
  const candidates: Candidate[] = [
    { retrievalScores: { semantic: 0.85, keyword: 0.8 }, combinedScore: 0.8, documentId: 'doc1' },
    { retrievalScores: { semantic: 0.8, keyword: 0.75 }, combinedScore: 0.75, documentId: 'doc2' },
    { retrievalScores: { semantic: 0.75, keyword: 0.7 }, combinedScore: 0.7, documentId: 'doc3' },
  ];

  const inputs: ScoringInputs = {
    supportLevel: 'high',
    queryComplexity: 'multi-hop',
    faithfulnessScore: 0.45,
    candidates,
  };

  test('total = 60', () => {
    const sc = computeConfidence(inputs);
    expect(sc.total).toBe(60);
  });

  test('label = Limited', () => {
    const sc = computeConfidence(inputs);
    expect(sc.label).toBe('Limited');
  });

  test('grounding.raw = 6 (ceiling + faithfulness penalty applied)', () => {
    const sc = computeConfidence(inputs);
    expect(sc.dimensions.grounding.raw).toBe(6);
  });

  test('recommendedAction = review (missing-conflict-signal in reviewOnWarnings, rule 5)', () => {
    // total=60 ≥ reviewAt=40 but < answerAt=65; rule 5 fires before rule 6/7.
    const sc = computeConfidence(inputs);
    expect(sc.recommendedAction).toBe('review');
    expect(sc.actionReason).toContain('missing-conflict-signal');
  });
});

// ── Extension activation tests ────────────────────────────────────────────────

describe('extension activation', () => {
  const baseInputs: ScoringInputs = {
    supportLevel: 'high',
    candidates: [multiMethod(0.8, 'doc1')],
  };

  test('authority extension: maxPossible = 85, dimensions.authority present', () => {
    const sc = computeConfidence(baseInputs, { authority: {} });
    expect(sc.meta.maxPossible).toBe(85);
    expect(sc.dimensions.authority).toBeDefined();
    expect(sc.meta.activeExtensions).toContain('authority');
  });

  test('corpus extension: maxPossible = 80, dimensions.corpus present, tier2 present', () => {
    const sc = computeConfidence(
      { ...baseInputs, corpusTypeCount: 3 },
      { corpus: { expectedTypeCount: 5 } },
    );
    expect(sc.meta.maxPossible).toBe(80);
    expect(sc.dimensions.corpus).toBeDefined();
    expect(sc.tier2).not.toBeNull();
  });

  test('freshness extension: maxPossible = 80, dimensions.freshness present', () => {
    const c: Candidate = {
      retrievalScores: { semantic: 0.8 },
      combinedScore: 0.8,
      lastUpdated: daysAgo(30),
    };
    const sc = computeConfidence({ ...baseInputs, candidates: [c] }, { freshness: {} });
    expect(sc.meta.maxPossible).toBe(80);
    expect(sc.dimensions.freshness).toBeDefined();
  });

  test('all three extensions: maxPossible = 115, activeExtensions length = 3', () => {
    const sc = computeConfidence(
      { ...baseInputs, corpusTypeCount: 3 },
      {
        authority: {},
        corpus: { expectedTypeCount: 5 },
        freshness: {},
      },
    );
    expect(sc.meta.maxPossible).toBe(115);
    expect(sc.meta.activeExtensions).toHaveLength(3);
  });
});

// ── Normalization invariants ──────────────────────────────────────────────────

describe('normalization invariants', () => {
  test('total is always an integer across multiple inputs', () => {
    const cases: ScoringInputs[] = [
      { supportLevel: 'high', candidates: [multiMethod(0.9, 'doc1')] },
      { supportLevel: 'medium', candidates: [multiMethod(0.7, 'doc1')] },
      { supportLevel: 'low', candidates: [] },
    ];
    for (const inputs of cases) {
      const sc = computeConfidence(inputs);
      expect(Number.isInteger(sc.total)).toBe(true);
    }
  });

  test('rawTotal never exceeds maxPossible with all extensions active', () => {
    const sc = computeConfidence(
      {
        supportLevel: 'high',
        faithfulnessScore: 0.99,
        citationCount: 5,
        corpusTypeCount: 10,
        candidates: [
          {
            ...multiMethod(0.95, 'doc1', 5),
            isAmendment: true,
            extractionQuality: 1.0,
            lastUpdated: daysAgo(1),
          },
          { ...multiMethod(0.9, 'doc2', 5), extractionQuality: 1.0, lastUpdated: daysAgo(2) },
          { ...multiMethod(0.88, 'doc3', 5), extractionQuality: 1.0, lastUpdated: daysAgo(3) },
          { ...multiMethod(0.85, 'doc1', 10), extractionQuality: 1.0, lastUpdated: daysAgo(4) },
          { ...multiMethod(0.82, 'doc2', 10), extractionQuality: 1.0, lastUpdated: daysAgo(5) },
        ],
      },
      {
        authority: {},
        corpus: { expectedTypeCount: 5 },
        freshness: {},
      },
    );
    expect(sc.meta.rawTotal).toBeLessThanOrEqual(sc.meta.maxPossible);
    expect(sc.total).toBeLessThanOrEqual(100);
  });
});

// ── breakdown.raw === DimensionScore.raw invariant ────────────────────────────
//
// Phase 10 gate requirement: for every active dimension, breakdown.raw must
// equal DimensionScore.raw. This holds regardless of caps, bonuses, or rounding.

describe('breakdown.raw === DimensionScore.raw invariant', () => {
  const NOW = new Date('2026-01-01T00:00:00.000Z');

  test('core three dimensions — all raw values match their breakdown.raw', () => {
    const sc = computeConfidence({
      supportLevel: 'high',
      hasConflict: false,
      faithfulnessScore: 0.85,
      queryComplexity: 'inferential',
      citationCount: 2,
      candidates: [multiMethod(0.88, 'doc1'), multiMethod(0.82, 'doc2'), multiMethod(0.76, 'doc3')],
    });
    expect(sc.dimensions.grounding.breakdown?.raw).toBe(sc.dimensions.grounding.raw);
    expect(sc.dimensions.retrieval.breakdown?.raw).toBe(sc.dimensions.retrieval.raw);
    expect(sc.dimensions.consistency.breakdown?.raw).toBe(sc.dimensions.consistency.raw);
  });

  test('relevance dimension — breakdown.raw matches DimensionScore.raw', () => {
    const sc = computeConfidence({
      supportLevel: 'high',
      answerRelevanceScore: 0.78,
      candidates: [],
    });
    expect(sc.dimensions.relevance?.breakdown?.raw).toBe(sc.dimensions.relevance?.raw);
  });

  test('authority dimension — breakdown.raw matches DimensionScore.raw', () => {
    const sc = computeConfidence(
      {
        supportLevel: 'high',
        candidates: [
          { ...multiMethod(0.9, 'doc1'), authorityRank: 10, isAmendment: true },
          { ...multiMethod(0.8, 'doc2'), authorityRank: 20 },
        ],
      },
      { authority: {} },
    );
    expect(sc.dimensions.authority?.breakdown?.raw).toBe(sc.dimensions.authority?.raw);
  });

  test('corpus dimension — breakdown.raw matches DimensionScore.raw', () => {
    const sc = computeConfidence(
      { supportLevel: 'high', corpusTypeCount: 3, candidates: [] },
      { corpus: { expectedTypeCount: 5 } },
    );
    expect(sc.dimensions.corpus?.breakdown?.raw).toBe(sc.dimensions.corpus?.raw);
  });

  test('freshness dimension — breakdown.raw matches DimensionScore.raw', () => {
    const sc = computeConfidence(
      {
        supportLevel: 'high',
        candidates: [
          { ...multiMethod(0.85, 'doc1'), lastUpdated: new Date(NOW.getTime() - 30 * 86400000) },
        ],
      },
      { freshness: { now: NOW } },
    );
    expect(sc.dimensions.freshness?.breakdown?.raw).toBe(sc.dimensions.freshness?.raw);
  });

  test('all 7 dimensions simultaneously — every breakdown.raw matches', () => {
    const sc = computeConfidence(
      {
        supportLevel: 'high',
        hasConflict: false,
        faithfulnessScore: 0.92,
        answerRelevanceScore: 0.88,
        corpusTypeCount: 5,
        candidates: [
          {
            ...multiMethod(0.9, 'doc1'),
            authorityRank: 10,
            isAmendment: true,
            lastUpdated: new Date(NOW.getTime() - 20 * 86400000),
          },
          {
            ...multiMethod(0.85, 'doc2'),
            authorityRank: 20,
            lastUpdated: new Date(NOW.getTime() - 40 * 86400000),
          },
          {
            ...multiMethod(0.8, 'doc3'),
            authorityRank: 20,
            lastUpdated: new Date(NOW.getTime() - 60 * 86400000),
          },
        ],
      },
      {
        authority: {},
        corpus: { expectedTypeCount: 5 },
        freshness: { now: NOW },
      },
    );
    const dims = sc.dimensions;
    expect(dims.grounding.breakdown?.raw).toBe(dims.grounding.raw);
    expect(dims.retrieval.breakdown?.raw).toBe(dims.retrieval.raw);
    expect(dims.consistency.breakdown?.raw).toBe(dims.consistency.raw);
    expect(dims.relevance?.breakdown?.raw).toBe(dims.relevance?.raw);
    expect(dims.authority?.breakdown?.raw).toBe(dims.authority?.raw);
    expect(dims.corpus?.breakdown?.raw).toBe(dims.corpus?.raw);
    expect(dims.freshness?.breakdown?.raw).toBe(dims.freshness?.raw);
  });
});
