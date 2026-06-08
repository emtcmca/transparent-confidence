import { describe, expect, test } from 'vitest';
import { analyzeCalibration } from '../src/calibration';
import type { CalibrationSample } from '../src/types';

const samples: CalibrationSample[] = [
  { id: '1', total: 92, recommendedAction: 'answer', outcome: 'correct' },
  { id: '2', total: 88, recommendedAction: 'answer', outcome: 'correct' },
  { id: '3', total: 76, recommendedAction: 'answer', outcome: 'incorrect' },
  { id: '4', total: 68, recommendedAction: 'review', outcome: 'correct' },
  { id: '5', total: 52, recommendedAction: 'review', outcome: 'incorrect' },
  { id: '6', total: 31, recommendedAction: 'abstain', outcome: 'incorrect' },
];

describe('analyzeCalibration - validation', () => {
  test('throws on empty samples', () => {
    expect(() => analyzeCalibration([])).toThrow(/at least one sample/);
  });

  test('throws on total below 0', () => {
    expect(() => analyzeCalibration([{ total: -1, outcome: 'correct' }])).toThrow(/total/);
  });

  test('throws on total above 100', () => {
    expect(() => analyzeCalibration([{ total: 101, outcome: 'correct' }])).toThrow(/total/);
  });
});

describe('analyzeCalibration - report', () => {
  test('computes default bands', () => {
    const report = analyzeCalibration(samples);

    expect(report.bands.map((band) => [band.min, band.max, band.count])).toEqual([
      [0, 40, 1],
      [40, 65, 1],
      [65, 85, 2],
      [85, 101, 2],
    ]);
  });

  test('computes positive rate per band', () => {
    const report = analyzeCalibration(samples);

    expect(report.bands[0]?.positiveRate).toBe(0);
    expect(report.bands[2]?.positiveRate).toBe(0.5);
    expect(report.bands[3]?.positiveRate).toBe(1);
  });

  test('computes action summary', () => {
    const report = analyzeCalibration(samples);

    expect(report.actionSummary.answer).toEqual({ count: 3, positiveRate: 2 / 3 });
    expect(report.actionSummary.review).toEqual({ count: 2, positiveRate: 0.5 });
    expect(report.actionSummary.abstain).toEqual({ count: 1, positiveRate: 0 });
  });

  test('uses custom positive outcomes', () => {
    const report = analyzeCalibration(samples, {
      positiveOutcomes: ['correct', 'accepted', 'escalated'],
    });

    expect(report.positiveCount).toBe(3);
    expect(report.positiveRate).toBe(0.5);
  });

  test('emits low-calibration-sample-size warning', () => {
    const report = analyzeCalibration(samples, { minSamplesPerBand: 2 });

    expect(report.warnings).toContainEqual(
      expect.objectContaining({ code: 'low-calibration-sample-size' }),
    );
  });

  test('recommends higher answerAt when moderate band has low precision', () => {
    const report = analyzeCalibration(samples, { targetPrecisionForAnswer: 0.9 });

    expect(report.recommendedPolicy.answerAt).toBe(85);
    expect(report.recommendedPolicy.reviewAt).toBe(40);
    expect(report.recommendedPolicy.abstainBelow).toBe(40);
  });

  test('uses targetRecallForAbstain to tune abstainBelow and reviewAt', () => {
    const report = analyzeCalibration(samples, { targetRecallForAbstain: 2 / 3 });

    expect(report.recommendedPolicy.abstainBelow).toBe(65);
    expect(report.recommendedPolicy.reviewAt).toBe(65);
  });

  test('does not mutate input samples', () => {
    const before = JSON.stringify(samples);

    analyzeCalibration(samples);

    expect(JSON.stringify(samples)).toBe(before);
  });
});
