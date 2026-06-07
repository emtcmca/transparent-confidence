import { describe, expect, test } from 'vitest';
import { computeConfidence, createScorer } from '../src/scorer';
import type { ScoringInputs } from '../src/types';

const baseInputs: ScoringInputs = {
  supportLevel: 'high',
  candidates: [
    {
      retrievalScores: { semantic: 0.82 },
      combinedScore: 0.82,
      documentId: 'doc-1',
    },
  ],
};

describe('validation — config errors', () => {
  test('throws when retrieval score bands are not monotonic', () => {
    expect(() =>
      computeConfidence(baseInputs, {
        retrieval: {
          scoreBands: { full: 0.5, high: 0.7 },
        },
      }),
    ).toThrow(/retrieval\.scoreBands/);
  });

  test('throws from createScorer when config is invalid', () => {
    expect(() =>
      createScorer({
        retrieval: {
          topK: 0,
        },
      }),
    ).toThrow(/retrieval\.topK/);
  });

  test('throws when a configured dimension weight is not positive', () => {
    expect(() =>
      computeConfidence(baseInputs, {
        weights: { retrieval: 0 },
      }),
    ).toThrow(/weights\.retrieval/);
  });
});

describe('validation — input issues', () => {
  test('records missing candidates as a warning in default warn mode', () => {
    const scorecard = computeConfidence({ supportLevel: 'low', candidates: [] });

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'missing-candidates',
        severity: 'warn',
      }),
    );
    expect(scorecard.meta.missingSignals).toContain('candidates');
  });

  test('throws for missing candidates in strict validation mode', () => {
    expect(() =>
      computeConfidence(
        { supportLevel: 'low', candidates: [] },
        {
          validation: 'strict',
        },
      ),
    ).toThrow(/candidates/);
  });

  test('records out-of-range candidate scores as warnings', () => {
    const scorecard = computeConfidence({
      supportLevel: 'high',
      candidates: [{ retrievalScores: { semantic: 1.4 }, combinedScore: 1.4 }],
    });

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'input-out-of-range',
        path: 'candidates[0].combinedScore',
      }),
    );
  });

  test('records inconsistent claimSupport counts as input-out-of-range warning', () => {
    const scorecard = computeConfidence({
      ...baseInputs,
      claimSupport: { totalClaims: 3, supportedClaims: 3, contradictedClaims: 1 },
    });

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'input-out-of-range',
        path: 'claimSupport',
      }),
    );
  });

  test('throws for inconsistent claimSupport counts in strict validation mode', () => {
    expect(() =>
      computeConfidence(
        {
          ...baseInputs,
          claimSupport: { totalClaims: 3, supportedClaims: 3, contradictedClaims: 1 },
        },
        { validation: 'strict' },
      ),
    ).toThrow(/claimSupport/);
  });
});
