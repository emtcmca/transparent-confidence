import { describe, expect, test } from 'vitest';
import {
  fromCustomJudge,
  fromDeepEvalLike,
  fromRagasLike,
  fromTruLensLike,
  mergeEvaluationSignals,
} from '../src/evaluators';
import { computeConfidence } from '../src/scorer';
import type { ScoringInputs } from '../src/types';

const baseInputs: ScoringInputs = {
  supportLevel: 'high',
  hasConflict: false,
  candidates: [
    {
      retrievalScores: { semantic: 0.86, keyword: 0.72 },
      combinedScore: 0.86,
      documentId: 'doc-1',
    },
  ],
};

describe('evaluator signal mappers', () => {
  test('fromRagasLike maps faithfulness and answer relevancy', () => {
    expect(fromRagasLike({ faithfulness: 0.91, answer_relevancy: 0.87 })).toEqual({
      faithfulnessScore: 0.91,
      answerRelevanceScore: 0.87,
    });
  });

  test('fromDeepEvalLike maps direct score fields', () => {
    expect(fromDeepEvalLike({ faithfulnessScore: 0.88, answerRelevancyScore: 0.82 })).toEqual({
      faithfulnessScore: 0.88,
      answerRelevanceScore: 0.82,
    });
  });

  test('fromDeepEvalLike maps metric score for faithfulness', () => {
    expect(fromDeepEvalLike({ metric: 'faithfulness', score: 0.77 })).toEqual({
      faithfulnessScore: 0.77,
    });
  });

  test('fromTruLensLike maps groundedness and answer relevance', () => {
    expect(fromTruLensLike({ groundedness: 0.84, answer_relevance: 0.81 })).toEqual({
      faithfulnessScore: 0.84,
      answerRelevanceScore: 0.81,
    });
  });

  test('fromCustomJudge maps claim counts and citation signals', () => {
    expect(
      fromCustomJudge({
        totalClaims: 5,
        supportedClaims: 4,
        contradictedClaims: 1,
        citationCoverageScore: 0.9,
        invalidCitationCount: 0,
        hasConflict: true,
      }),
    ).toEqual({
      claimSupport: {
        totalClaims: 5,
        supportedClaims: 4,
        contradictedClaims: 1,
      },
      citationCoverageScore: 0.9,
      invalidCitationCount: 0,
      hasConflict: true,
    });
  });

  test('unknown evaluator shape returns empty signals', () => {
    expect(fromCustomJudge({ irrelevant: 'value' })).toEqual({});
  });
});

describe('mergeEvaluationSignals', () => {
  test('does not mutate original inputs', () => {
    const before = JSON.stringify(baseInputs);

    mergeEvaluationSignals(baseInputs, { answerRelevanceScore: 0.93 });

    expect(JSON.stringify(baseInputs)).toBe(before);
  });

  test('overrides absent fields', () => {
    const result = mergeEvaluationSignals(baseInputs, {
      answerRelevanceScore: 0.93,
      faithfulnessScore: 0.91,
    });

    expect(result.inputs.answerRelevanceScore).toBe(0.93);
    expect(result.inputs.faithfulnessScore).toBe(0.91);
    expect(result.warnings).toEqual([]);
  });

  test('preserves explicit existing fields', () => {
    const result = mergeEvaluationSignals(
      {
        ...baseInputs,
        faithfulnessScore: 0.7,
      },
      {
        faithfulnessScore: 0.95,
      },
    );

    expect(result.inputs.faithfulnessScore).toBe(0.7);
  });

  test('out-of-range mapped values produce validation warning during computeConfidence', () => {
    const signals = fromCustomJudge({ faithfulnessScore: 1.2 });
    const result = mergeEvaluationSignals(baseInputs, signals);
    const scorecard = computeConfidence(result.inputs);

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'input-out-of-range',
        path: 'faithfulnessScore',
      }),
    );
  });
});
