import { describe, expect, test, vi } from 'vitest';
import { computeConfidence } from '../src/scorer';

describe('warnings metadata', () => {
  test('rolls freshness missing-date warnings into scorecard metadata', () => {
    const scorecard = computeConfidence(
      {
        supportLevel: 'high',
        candidates: [{ retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 }],
      },
      { freshness: {} },
    );

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'missing-freshness-dates',
        severity: 'warn',
      }),
    );
    expect(scorecard.meta.missingSignals).toContain('freshnessDates');
  });

  test('rolls corpus missing-count warnings into scorecard metadata', () => {
    const scorecard = computeConfidence(
      {
        supportLevel: 'high',
        candidates: [{ retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 }],
      },
      { corpus: { expectedTypeCount: 5 } },
    );

    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'missing-corpus-count',
        severity: 'warn',
      }),
    );
    expect(scorecard.meta.missingSignals).toContain('corpusTypes');
  });

  test('does not write warnings to console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    computeConfidence({ supportLevel: 'low', candidates: [] });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
