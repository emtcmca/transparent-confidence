import { describe, expect, test } from 'vitest';
import { computeConfidence } from '../src/scorer';
import type { ScoringConfig, ScoringInputs } from '../src/types';

const highConfidenceInputs: ScoringInputs = {
  supportLevel: 'high',
  hasConflict: false,
  faithfulnessScore: 0.94,
  citationCoverageScore: 0.9,
  invalidCitationCount: 0,
  citationCount: 3,
  candidates: [
    {
      retrievalScores: { semantic: 0.9, keyword: 0.82 },
      combinedScore: 0.9,
      documentId: 'doc-1',
    },
    {
      retrievalScores: { semantic: 0.86, keyword: 0.78 },
      combinedScore: 0.86,
      documentId: 'doc-2',
    },
    {
      retrievalScores: { semantic: 0.84, keyword: 0.75 },
      combinedScore: 0.84,
      documentId: 'doc-3',
    },
  ],
};

function warningCodes(inputs: ScoringInputs, config: ScoringConfig) {
  return computeConfidence(inputs, config).meta.warnings.map((warning) => warning.code);
}

describe('signal policy presets', () => {
  test('legacy-v0.2 preset does not require answerRelevanceScore', () => {
    const scorecard = computeConfidence(highConfidenceInputs, { preset: 'legacy-v0.2' });

    expect(scorecard.recommendedAction).toBe('answer');
    expect(warningCodes(highConfidenceInputs, { preset: 'legacy-v0.2' })).not.toContain(
      'required-signal-missing',
    );
  });

  test('production-v0.3 preset reviews when answerRelevanceScore is missing', () => {
    const scorecard = computeConfidence(highConfidenceInputs, { preset: 'production-v0.3' });

    expect(scorecard.recommendedAction).toBe('review');
    expect(scorecard.meta.missingSignals).toContain('answerRelevanceScore');
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'required-signal-missing',
        path: 'answerRelevanceScore',
      }),
    );
  });

  test('production-v0.3 preset reviews when both faithfulnessScore and claimSupport are missing', () => {
    const { faithfulnessScore: _faithfulnessScore, ...withoutSupportEvaluator } = {
      ...highConfidenceInputs,
      answerRelevanceScore: 0.93,
    };

    const scorecard = computeConfidence(withoutSupportEvaluator, { preset: 'production-v0.3' });

    expect(scorecard.recommendedAction).toBe('review');
    expect(scorecard.meta.missingSignals).toContain('faithfulnessScore');
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'required-signal-missing',
        path: 'faithfulnessScore',
      }),
    );
  });

  test('production-v0.3 preset answers when relevance, support evaluator, and conflict signals are present', () => {
    const scorecard = computeConfidence(
      {
        ...highConfidenceInputs,
        answerRelevanceScore: 0.94,
      },
      { preset: 'production-v0.3' },
    );

    expect(scorecard.recommendedAction).toBe('answer');
    expect(scorecard.meta.warnings.map((warning) => warning.code)).not.toContain(
      'required-signal-missing',
    );
  });

  test('explicit signalPolicy extends production preset required evaluator signal', () => {
    const scorecard = computeConfidence(highConfidenceInputs, {
      preset: 'production-v0.3',
      signalPolicy: {
        reviewWhenMissing: ['citationCount'],
      },
    });

    expect(scorecard.recommendedAction).toBe('review');
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'required-signal-missing',
        path: 'answerRelevanceScore',
      }),
    );
  });
});

describe('custom signal policy', () => {
  test('signalPolicy.abstainWhenMissing forces abstain', () => {
    const scorecard = computeConfidence(highConfidenceInputs, {
      signalPolicy: {
        require: ['answerRelevanceScore'],
        abstainWhenMissing: ['answerRelevanceScore'],
      },
    });

    expect(scorecard.recommendedAction).toBe('abstain');
    expect(scorecard.actionReason).toContain('answerRelevanceScore');
  });

  test('signalPolicy.reviewWhenMissing forces review', () => {
    const scorecard = computeConfidence(highConfidenceInputs, {
      signalPolicy: {
        require: ['answerRelevanceScore'],
        reviewWhenMissing: ['answerRelevanceScore'],
      },
    });

    expect(scorecard.recommendedAction).toBe('review');
    expect(scorecard.actionReason).toContain('answerRelevanceScore');
  });

  test('signalPolicy.minCitationCoverageScore warns below floor', () => {
    const scorecard = computeConfidence(
      {
        ...highConfidenceInputs,
        answerRelevanceScore: 0.94,
        citationCoverageScore: 0.7,
      },
      {
        signalPolicy: {
          minCitationCoverageScore: 0.8,
        },
      },
    );

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'citation-quality-floor',
        path: 'citationCoverageScore',
      }),
    );
  });

  test('signalPolicy.maxInvalidCitationCount warns above floor', () => {
    const scorecard = computeConfidence(
      {
        ...highConfidenceInputs,
        answerRelevanceScore: 0.94,
        invalidCitationCount: 1,
      },
      {
        signalPolicy: {
          maxInvalidCitationCount: 0,
        },
      },
    );

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'citation-quality-floor',
        path: 'invalidCitationCount',
      }),
    );
  });

  test('signalPolicy reports missing content hash, candidate rank, and index integrity signals', () => {
    const scorecard = computeConfidence(highConfidenceInputs, {
      signalPolicy: {
        require: ['contentHashes', 'candidateRanks', 'indexIntegrity'],
        reviewWhenMissing: ['contentHashes', 'candidateRanks', 'indexIntegrity'],
      },
    });

    expect(scorecard.recommendedAction).toBe('review');
    expect(scorecard.meta.missingSignals).toEqual(
      expect.arrayContaining(['contentHashes', 'candidateRanks', 'indexIntegrity']),
    );
  });
});
