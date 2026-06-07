import { describe, expect, test } from 'vitest';
import { scoreRelevance } from '../../src/dimensions/relevance';
import { computeConfidence } from '../../src/scorer';
import type { ScoringConfig, ScoringInputs } from '../../src/types';

const baseInputs: ScoringInputs = {
  supportLevel: 'high',
  candidates: [
    { retrievalScores: { semantic: 0.9, keyword: 0.8 }, combinedScore: 0.85 },
    { retrievalScores: { semantic: 0.85, keyword: 0.75 }, combinedScore: 0.8 },
  ],
};

// ─────────────────────────────────────────────────────────────
// Activation
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - activation via computeConfidence', () => {
  test('missing answerRelevanceScore + no required config → relevance inactive', () => {
    const scorecard = computeConfidence(baseInputs, {});
    expect(scorecard.dimensions.relevance).toBeUndefined();
    expect(scorecard.meta.activeDimensions).not.toContain('relevance');
  });

  test('answerRelevanceScore provided → relevance active', () => {
    const scorecard = computeConfidence({ ...baseInputs, answerRelevanceScore: 0.9 }, {});
    expect(scorecard.dimensions.relevance).toBeDefined();
    expect(scorecard.meta.activeDimensions).toContain('relevance');
  });

  test('config.relevance.required = true + missing score → relevance active with raw 0', () => {
    const scorecard = computeConfidence(baseInputs, { relevance: { required: true } });
    expect(scorecard.dimensions.relevance).toBeDefined();
    expect(scorecard.dimensions.relevance?.raw).toBe(0);
    expect(scorecard.meta.activeDimensions).toContain('relevance');
  });

  test('relevance active → included in maxPossible (+15)', () => {
    const without = computeConfidence(baseInputs, {});
    const with_ = computeConfidence({ ...baseInputs, answerRelevanceScore: 0.9 }, {});
    expect(with_.meta.maxPossible).toBe(without.meta.maxPossible + 15);
  });

  test('relevance inactive → not in activeExtensions', () => {
    const scorecard = computeConfidence(baseInputs, {});
    expect(scorecard.meta.activeExtensions).not.toContain('relevance');
  });

  test('relevance active → in activeExtensions', () => {
    const scorecard = computeConfidence({ ...baseInputs, answerRelevanceScore: 0.8 }, {});
    expect(scorecard.meta.activeExtensions).toContain('relevance');
  });
});

// ─────────────────────────────────────────────────────────────
// Scoring bands
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - default bands', () => {
  test('score >= 0.90 returns raw 15', () => {
    const result = scoreRelevance(0.95, {});
    expect(result.raw).toBe(15);
  });

  test('score = 0.90 returns raw 15 (full threshold)', () => {
    const result = scoreRelevance(0.9, {});
    expect(result.raw).toBe(15);
  });

  test('score 0.75–0.89 returns raw 12', () => {
    const result = scoreRelevance(0.8, {});
    expect(result.raw).toBe(12);
  });

  test('score = 0.75 returns raw 12 (high threshold)', () => {
    const result = scoreRelevance(0.75, {});
    expect(result.raw).toBe(12);
  });

  test('score 0.60–0.74 returns raw 8', () => {
    const result = scoreRelevance(0.65, {});
    expect(result.raw).toBe(8);
  });

  test('score = 0.60 returns raw 8 (medium threshold)', () => {
    const result = scoreRelevance(0.6, {});
    expect(result.raw).toBe(8);
  });

  test('score 0.40–0.59 returns raw 4', () => {
    const result = scoreRelevance(0.5, {});
    expect(result.raw).toBe(4);
  });

  test('score = 0.40 returns raw 4 (low threshold)', () => {
    const result = scoreRelevance(0.4, {});
    expect(result.raw).toBe(4);
  });

  test('score < 0.40 returns raw 0', () => {
    const result = scoreRelevance(0.2, {});
    expect(result.raw).toBe(0);
  });

  test('score = 0.0 returns raw 0', () => {
    const result = scoreRelevance(0.0, {});
    expect(result.raw).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Custom score bands
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - custom score bands', () => {
  const strictConfig: ScoringConfig = {
    relevance: {
      scoreBands: { full: 0.95, high: 0.85, medium: 0.7, low: 0.5 },
    },
  };

  test('custom bands — 0.92 scores 12 (high) not 15 (full)', () => {
    const result = scoreRelevance(0.92, strictConfig);
    expect(result.raw).toBe(12);
  });

  test('custom bands — 0.96 scores 15 (full)', () => {
    const result = scoreRelevance(0.96, strictConfig);
    expect(result.raw).toBe(15);
  });

  test('custom bands — 0.75 scores 8 (medium)', () => {
    const result = scoreRelevance(0.75, strictConfig);
    expect(result.raw).toBe(8);
  });

  test('custom bands — 0.55 scores 4 (low band, >= 0.5)', () => {
    const result = scoreRelevance(0.55, strictConfig);
    expect(result.raw).toBe(4);
  });

  test('custom bands — 0.45 scores 0 (below low band of 0.5)', () => {
    const result = scoreRelevance(0.45, strictConfig);
    expect(result.raw).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Missing score behavior
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - missing score', () => {
  test('missing score returns raw 0', () => {
    const result = scoreRelevance(undefined, { relevance: { required: true } });
    expect(result.raw).toBe(0);
  });

  test('missing score emits warning missing-answer-relevance', () => {
    const result = scoreRelevance(undefined, { relevance: { required: true } });
    const codes = result.warnings?.map((w) => w.code) ?? [];
    expect(codes).toContain('missing-answer-relevance');
  });

  test('missing score warning has path answerRelevanceScore', () => {
    const result = scoreRelevance(undefined, { relevance: { required: true } });
    const warning = result.warnings?.find((w) => w.code === 'missing-answer-relevance');
    expect(warning?.path).toBe('answerRelevanceScore');
  });

  test('missing-answer-relevance warning surfaced in scorecard meta', () => {
    const scorecard = computeConfidence(baseInputs, { relevance: { required: true } });
    const codes = scorecard.meta.warnings.map((w) => w.code);
    expect(codes).toContain('missing-answer-relevance');
  });

  test('missing-answer-relevance recorded in missingSignals', () => {
    const scorecard = computeConfidence(baseInputs, { relevance: { required: true } });
    expect(scorecard.meta.missingSignals).toContain('answerRelevanceScore');
  });
});

// ─────────────────────────────────────────────────────────────
// Tier 1 inclusion
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - Tier 1 inclusion', () => {
  test('relevance active → included in tier1 (score increases with perfect relevance)', () => {
    const without = computeConfidence(baseInputs, {});
    const with_ = computeConfidence({ ...baseInputs, answerRelevanceScore: 0.95 }, {});
    // Both have same grounding/retrieval/consistency; with_ adds relevance to tier1
    expect(with_.tier1).not.toBeNull();
    expect(without.tier1).not.toBeNull();
    // tier1 score can only increase or equal (perfect relevance adds raw 15)
    expect(with_.tier1?.score).toBeGreaterThanOrEqual(without.tier1?.score);
  });

  test('relevance score 0 (missing required) lowers tier1 vs no relevance', () => {
    const without = computeConfidence(baseInputs, {});
    const with_ = computeConfidence(baseInputs, { relevance: { required: true } });
    // Adding required relevance with score 0 adds 0 raw to numerator but 15 to denominator
    expect(with_.tier1?.score).toBeLessThanOrEqual(without.tier1?.score);
  });
});

// ─────────────────────────────────────────────────────────────
// Breakdown shape
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - breakdown', () => {
  test('breakdown.raw equals DimensionScore.raw', () => {
    const result = scoreRelevance(0.85, {});
    expect(result.breakdown?.raw).toBe(result.raw);
  });

  test('breakdown.components contains relevanceScore', () => {
    const result = scoreRelevance(0.85, {});
    expect(result.breakdown?.components).toHaveProperty('relevanceScore');
  });

  test('breakdown.diagnostics contains answerRelevanceScore', () => {
    const result = scoreRelevance(0.85, {});
    expect(result.breakdown?.diagnostics?.answerRelevanceScore).toBe(0.85);
  });

  test('breakdown.uncappedRaw equals raw for all normal scores', () => {
    const result = scoreRelevance(0.7, {});
    expect(result.breakdown?.uncappedRaw).toBe(result.raw);
  });

  test('normalized = round(raw / 15 * 100)', () => {
    const result = scoreRelevance(0.8, {});
    expect(result.normalized).toBe(Math.round((result.raw / 15) * 100));
  });
});

// ─────────────────────────────────────────────────────────────
// Weights in meta
// ─────────────────────────────────────────────────────────────

describe('scoreRelevance - meta weights', () => {
  test('relevance weight 15 present in meta when active', () => {
    const scorecard = computeConfidence({ ...baseInputs, answerRelevanceScore: 0.8 }, {});
    expect(scorecard.meta.weights.relevance).toBe(15);
  });

  test('relevance weight absent when inactive', () => {
    const scorecard = computeConfidence(baseInputs, {});
    expect(scorecard.meta.weights.relevance).toBeUndefined();
  });
});
