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
    confidenceLevel: 'high',
    candidates: [multiMethod(0.8, 'doc1'), multiMethod(0.75, 'doc2')],
  };

  test('returns all required scorecard fields', () => {
    const sc = computeConfidence(base);
    expect(sc).toHaveProperty('total');
    expect(sc).toHaveProperty('label');
    expect(sc).toHaveProperty('labelColor');
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
    expect(() => computeConfidence({ confidenceLevel: 'low', candidates: [] })).not.toThrow();
    const sc = computeConfidence({ confidenceLevel: 'low', candidates: [] });
    expect(sc.total).toBeGreaterThanOrEqual(0);
    expect(sc.dimensions.retrieval.explanation).toBeTruthy();
  });
});

describe('createScorer — API contracts', () => {
  test('compute() produces identical result to computeConfidence(inputs, config)', () => {
    const config = { corpus: { expectedDocCount: 5 } };
    const inputs: ScoringInputs = {
      confidenceLevel: 'medium',
      corpusDocCount: 4,
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
// Expected: rawTotal = 115, maxPossible = 115 → total = 100, Strong.

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
    confidenceLevel: 'high',
    faithfulnessScore: 0.95,
    queryComplexity: 'direct',
    citationCount: 4,
    corpusDocCount: 5,
    candidates,
  };

  const config = {
    authority: {},
    corpus: { expectedDocCount: 5 },
    freshness: {},
  };

  test('total = 100', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.total).toBe(100);
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
    confidenceLevel: 'low',
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
});

// ── Scenario C — Low conf, thin corpus (Insufficient) ────────────────────────
//
// 1 candidate (single retrieval method), low confidence, 1 of 5 doc types loaded.
// Grounding: low → 5.
// Retrieval: 0 confirmed → 3; avg 0.50 → 4; 1 doc + 1 candidate → 0.
//   retrieval.raw = 7.
// Consistency: 1 candidate → 4 neutral; no conflict → +2. consistency.raw = 6.
// Corpus: 1/5 = 20% → base 2. corpus.raw = 2.
// rawTotal = 20, maxPossible = 80 → total = 25, Insufficient.

describe('Scenario C — low confidence, thin corpus', () => {
  const inputs: ScoringInputs = {
    confidenceLevel: 'low',
    corpusDocCount: 1,
    candidates: [{ retrievalScores: { semantic: 0.5 }, combinedScore: 0.5, documentId: 'doc1' }],
  };
  const config = { corpus: { expectedDocCount: 5 } };

  test('total = 25', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.total).toBe(25);
  });

  test('label = Insufficient', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.label).toBe('Insufficient');
  });

  test('maxPossible = 80 (core 65 + corpus 15)', () => {
    const sc = computeConfidence(inputs, config);
    expect(sc.meta.maxPossible).toBe(80);
  });
});

// ── Scenario D — Medium confidence, clean retrieval (Moderate) ───────────────
//
// 3 candidates (2 methods each), medium confidence, no conflict.
// Grounding: medium → 13.
// Retrieval: 3 confirmed → 15; avg 0.75 → 6; 3 unique docs → 3; 3 candidates → 1.
//   retrieval.raw = 25 (capped, 15+6+3+1=25).
// Consistency: std dev 0.082 < 0.10 → 8; no conflict → +2. consistency.raw = 10.
// rawTotal = 48, maxPossible = 65 → total = round(73.8) = 74, Moderate.

describe('Scenario D — medium confidence, clean retrieval', () => {
  const candidates: Candidate[] = [
    { retrievalScores: { semantic: 0.85, keyword: 0.8 }, combinedScore: 0.8, documentId: 'doc1' },
    { retrievalScores: { semantic: 0.8, keyword: 0.75 }, combinedScore: 0.75, documentId: 'doc2' },
    { retrievalScores: { semantic: 0.75, keyword: 0.7 }, combinedScore: 0.7, documentId: 'doc3' },
  ];

  const inputs: ScoringInputs = { confidenceLevel: 'medium', candidates };

  test('total = 74', () => {
    const sc = computeConfidence(inputs);
    expect(sc.total).toBe(74);
  });

  test('label = Moderate', () => {
    const sc = computeConfidence(inputs);
    expect(sc.label).toBe('Moderate');
  });
});

// ── Scenario E — High conf, multi-hop, low faithfulness (Limited) ─────────────
//
// High confidence overridden by multi-hop ceiling (18) and faithfulness penalty (-12).
// Grounding: high → 30; multi-hop ceiling → 18; faithfulness 0.45 → -12 → 6.
// Retrieval: 3 confirmed → 15; avg 0.75 → 6; 3 unique docs → 3; 3 candidates → 1.
//   retrieval.raw = 25 (capped).
// Consistency: std dev 0.082 < 0.10 → 8; no conflict → +2. consistency.raw = 10.
// rawTotal = 41, maxPossible = 65 → total = round(63.1) = 63, Limited.

describe('Scenario E — high conf, multi-hop, low faithfulness', () => {
  const candidates: Candidate[] = [
    { retrievalScores: { semantic: 0.85, keyword: 0.8 }, combinedScore: 0.8, documentId: 'doc1' },
    { retrievalScores: { semantic: 0.8, keyword: 0.75 }, combinedScore: 0.75, documentId: 'doc2' },
    { retrievalScores: { semantic: 0.75, keyword: 0.7 }, combinedScore: 0.7, documentId: 'doc3' },
  ];

  const inputs: ScoringInputs = {
    confidenceLevel: 'high',
    queryComplexity: 'multi-hop',
    faithfulnessScore: 0.45,
    candidates,
  };

  test('total = 63', () => {
    const sc = computeConfidence(inputs);
    expect(sc.total).toBe(63);
  });

  test('label = Limited', () => {
    const sc = computeConfidence(inputs);
    expect(sc.label).toBe('Limited');
  });

  test('grounding.raw = 6 (ceiling + faithfulness penalty applied)', () => {
    const sc = computeConfidence(inputs);
    expect(sc.dimensions.grounding.raw).toBe(6);
  });
});

// ── Extension activation tests ────────────────────────────────────────────────

describe('extension activation', () => {
  const baseInputs: ScoringInputs = {
    confidenceLevel: 'high',
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
      { ...baseInputs, corpusDocCount: 3 },
      { corpus: { expectedDocCount: 5 } },
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
      { ...baseInputs, corpusDocCount: 3 },
      {
        authority: {},
        corpus: { expectedDocCount: 5 },
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
      { confidenceLevel: 'high', candidates: [multiMethod(0.9, 'doc1')] },
      { confidenceLevel: 'medium', candidates: [multiMethod(0.7, 'doc1')] },
      { confidenceLevel: 'low', candidates: [] },
    ];
    for (const inputs of cases) {
      const sc = computeConfidence(inputs);
      expect(Number.isInteger(sc.total)).toBe(true);
    }
  });

  test('rawTotal never exceeds maxPossible with all extensions active', () => {
    const sc = computeConfidence(
      {
        confidenceLevel: 'high',
        faithfulnessScore: 0.99,
        citationCount: 5,
        corpusDocCount: 10,
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
        corpus: { expectedDocCount: 5 },
        freshness: {},
      },
    );
    expect(sc.meta.rawTotal).toBeLessThanOrEqual(sc.meta.maxPossible);
    expect(sc.total).toBeLessThanOrEqual(100);
  });
});
