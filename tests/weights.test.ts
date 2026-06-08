import { describe, expect, test } from 'vitest';
import { ALGORITHM_VERSION, computeConfidence, SCORECARD_SCHEMA_VERSION } from '../src/scorer';
import type { ScoringInputs } from '../src/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function twoMethodCandidate(combinedScore: number, docId: string) {
  return {
    retrievalScores: { semantic: combinedScore + 0.05, keyword: combinedScore - 0.05 },
    combinedScore,
    documentId: docId,
  };
}

const goodInputs: ScoringInputs = {
  supportLevel: 'high',
  hasConflict: false,
  candidates: [
    twoMethodCandidate(0.85, 'doc1'),
    twoMethodCandidate(0.8, 'doc2'),
    twoMethodCandidate(0.75, 'doc3'),
  ],
};

// ─────────────────────────────────────────────────────────────
// Algorithm / schema version
// ─────────────────────────────────────────────────────────────

describe('meta version fields', () => {
  test('meta.algorithmVersion = 0.3.0', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.algorithmVersion).toBe('0.3.0');
  });

  test('meta.schemaVersion = 0.3', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.schemaVersion).toBe('0.3');
  });

  test('ALGORITHM_VERSION export = 0.3.0', () => {
    expect(ALGORITHM_VERSION).toBe('0.3.0');
  });

  test('SCORECARD_SCHEMA_VERSION export = 0.3', () => {
    expect(SCORECARD_SCHEMA_VERSION).toBe('0.3');
  });
});

// ─────────────────────────────────────────────────────────────
// Default weights
// ─────────────────────────────────────────────────────────────

describe('default weights in meta', () => {
  test('core dimension weights are 30 / 25 / 10', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.weights.grounding).toBe(30);
    expect(sc.meta.weights.retrieval).toBe(25);
    expect(sc.meta.weights.consistency).toBe(10);
  });

  test('inactive extensions absent from meta.weights', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.weights.relevance).toBeUndefined();
    expect(sc.meta.weights.authority).toBeUndefined();
    expect(sc.meta.weights.corpus).toBeUndefined();
    expect(sc.meta.weights.freshness).toBeUndefined();
    expect(sc.meta.weights.indexIntegrity).toBeUndefined();
  });

  test('active extension weights appear in meta.weights', () => {
    const sc = computeConfidence(goodInputs, {
      authority: {},
      corpus: { expectedTypeCount: 5 },
      freshness: {},
      indexIntegrity: {},
    });
    expect(sc.meta.weights.authority).toBe(20);
    expect(sc.meta.weights.corpus).toBe(15);
    expect(sc.meta.weights.freshness).toBe(15);
    expect(sc.meta.weights.indexIntegrity).toBe(15);
  });

  test('relevance weight 15 appears when relevance active', () => {
    const sc = computeConfidence({ ...goodInputs, answerRelevanceScore: 0.9 }, {});
    expect(sc.meta.weights.relevance).toBe(15);
  });

  test('maxPossible = sum of active weights (default core)', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.maxPossible).toBe(30 + 25 + 10);
  });
});

// ─────────────────────────────────────────────────────────────
// Custom weights
// ─────────────────────────────────────────────────────────────

describe('custom weights', () => {
  test('custom grounding weight 60: maxPossible = 60+25+10 = 95', () => {
    const sc = computeConfidence(goodInputs, { weights: { grounding: 60 } });
    expect(sc.meta.maxPossible).toBe(95);
  });

  test('custom weight appears in meta.weights', () => {
    const sc = computeConfidence(goodInputs, { weights: { grounding: 60 } });
    expect(sc.meta.weights.grounding).toBe(60);
  });

  test('custom weight changes rawTotal but not dimension.raw', () => {
    const base = computeConfidence(goodInputs, {});
    const custom = computeConfidence(goodInputs, { weights: { grounding: 60 } });
    // Dimension raw is unchanged
    expect(custom.dimensions.grounding.raw).toBe(base.dimensions.grounding.raw);
    // But rawTotal changes because the grounding contribution is scaled
    expect(custom.meta.rawTotal).not.toBe(base.meta.rawTotal);
  });

  test('custom weight changes total proportionally', () => {
    const base = computeConfidence(goodInputs, {});
    const custom = computeConfidence(goodInputs, { weights: { grounding: 60 } });
    // When grounding raw = grounding max (perfect grounding), total should be 100
    // regardless of weight. The relationship: higher grounding weight amplifies
    // grounding's share of total.
    // Both totals must be in [0, 100].
    expect(custom.total).toBeGreaterThanOrEqual(0);
    expect(custom.total).toBeLessThanOrEqual(100);
    // Grounding is the dominant dimension — boosting its weight should keep or raise total
    // (since grounding scores well for supportLevel: 'high')
    expect(custom.total).toBeGreaterThanOrEqual(base.total);
  });

  test('default weights proof: with all-default weights, total matches pre-computed value', () => {
    // When activeWeight === dimension.max, scaleDim reduces to dimension.raw.
    // rawTotal = sum(dim.raw), maxPossible = sum(dim.max). This is the v0.1 formula.
    const base = computeConfidence(goodInputs, {});
    const explicit = computeConfidence(goodInputs, {
      weights: { grounding: 30, retrieval: 25, consistency: 10 },
    });
    expect(explicit.total).toBe(base.total);
    expect(explicit.meta.rawTotal).toBe(base.meta.rawTotal);
  });
});

// ─────────────────────────────────────────────────────────────
// Active dimensions
// ─────────────────────────────────────────────────────────────

describe('meta.activeDimensions', () => {
  test('core three always active', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.activeDimensions).toContain('grounding');
    expect(sc.meta.activeDimensions).toContain('retrieval');
    expect(sc.meta.activeDimensions).toContain('consistency');
  });

  test('relevance absent when not configured or supplied', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.meta.activeDimensions).not.toContain('relevance');
  });

  test('relevance present when answerRelevanceScore supplied', () => {
    const sc = computeConfidence({ ...goodInputs, answerRelevanceScore: 0.85 }, {});
    expect(sc.meta.activeDimensions).toContain('relevance');
  });

  test('all 8 dimensions active when all extensions configured + relevance supplied', () => {
    const sc = computeConfidence(
      {
        ...goodInputs,
        answerRelevanceScore: 0.85,
        corpusTypeCount: 3,
        indexIntegrity: {
          expectedEmbeddingModelVersion: 'embed-v1',
          actualEmbeddingModelVersion: 'embed-v1',
          sourceVersionMatchRatio: 1,
          staleIndexedDocumentRatio: 0,
          failedIngestionCount: 0,
          aclFilterConfirmed: true,
          deletedSourceLeakageCount: 0,
        },
      },
      { authority: {}, corpus: { expectedTypeCount: 5 }, freshness: {}, indexIntegrity: {} },
    );
    expect(sc.meta.activeDimensions).toHaveLength(8);
    expect(sc.meta.activeDimensions).toContain('indexIntegrity');
  });
});

// ─────────────────────────────────────────────────────────────
// Tier 1 normalization
// ─────────────────────────────────────────────────────────────

describe('tier1.score normalization', () => {
  test('tier1.score is in range 0-100', () => {
    const sc = computeConfidence(goodInputs, {});
    expect(sc.tier1?.score).toBeGreaterThanOrEqual(0);
    expect(sc.tier1?.score).toBeLessThanOrEqual(100);
  });

  test('adding relevance may change tier1.score (different numerator and denominator)', () => {
    const without = computeConfidence(goodInputs, {});
    const withRelevance = computeConfidence({ ...goodInputs, answerRelevanceScore: 0.0 }, {});
    // Adding relevance with score 0 adds 0 to numerator but 15 to denominator → lower tier1
    expect(withRelevance.tier1?.score ?? 0).toBeLessThanOrEqual(without.tier1?.score ?? 100);
  });

  test('tier1.score unaffected by corpus/freshness (tier2 extensions)', () => {
    const without = computeConfidence(goodInputs, {});
    const withSystem = computeConfidence(
      { ...goodInputs, corpusTypeCount: 5 },
      { corpus: { expectedTypeCount: 5 }, freshness: {} },
    );
    // tier1 denominator doesn't include corpus or freshness
    expect(withSystem.tier1?.score).toBe(without.tier1?.score);
  });

  test('corpus + freshness do not change tier1.score (tier2 dimensions excluded from tier1)', () => {
    const without = computeConfidence(goodInputs, {});
    // Include actual corpus and freshness data so extensions score > 0
    const withSystem = computeConfidence(
      {
        ...goodInputs,
        corpusTypeCount: 5,
        candidates: goodInputs.candidates.map((c) => ({ ...c, lastUpdated: new Date() })),
      },
      { corpus: { expectedTypeCount: 5 }, freshness: {} },
    );
    // tier1 denominator is unchanged (corpus + freshness in tier2, not tier1)
    expect(withSystem.tier1?.score).toBe(without.tier1?.score);
    // total differs because maxPossible and rawTotal both change with extensions
    expect(withSystem.meta.maxPossible).toBeGreaterThan(without.meta.maxPossible);
  });
});

// ─────────────────────────────────────────────────────────────
// meta.rawTotal
// ─────────────────────────────────────────────────────────────

describe('meta.rawTotal', () => {
  test('rawTotal ≤ maxPossible always', () => {
    const sc = computeConfidence(goodInputs, {
      authority: {},
      corpus: { expectedTypeCount: 5 },
      freshness: {},
    });
    expect(sc.meta.rawTotal).toBeLessThanOrEqual(sc.meta.maxPossible);
  });

  test('rawTotal with custom weights ≤ maxPossible', () => {
    const sc = computeConfidence(goodInputs, {
      weights: { grounding: 100, retrieval: 50 },
    });
    expect(sc.meta.rawTotal).toBeLessThanOrEqual(sc.meta.maxPossible);
  });
});
