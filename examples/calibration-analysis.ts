/**
 * Example: Calibration Analysis
 *
 * Expected label: Strong
 * Expected total: 100
 * Expected recommendedAction: answer
 *
 * Calibration is offline: use historical scorecards and labeled outcomes to
 * tune thresholds for your own RAG system.
 */

import { analyzeCalibration, type CalibrationSample, computeConfidence } from '../src/index.js';

const liveScorecard = computeConfidence({
  supportLevel: 'high',
  hasConflict: false,
  candidates: [
    { retrievalScores: { semantic: 0.9, keyword: 0.8 }, combinedScore: 0.9, documentId: 'doc-1' },
    {
      retrievalScores: { semantic: 0.87, keyword: 0.74 },
      combinedScore: 0.87,
      documentId: 'doc-2',
    },
    { retrievalScores: { semantic: 0.84, keyword: 0.7 }, combinedScore: 0.84, documentId: 'doc-3' },
  ],
});

const samples: CalibrationSample[] = [
  { id: '1', total: 92, recommendedAction: 'answer', outcome: 'correct' },
  { id: '2', total: 88, recommendedAction: 'answer', outcome: 'correct' },
  { id: '3', total: 76, recommendedAction: 'review', outcome: 'incorrect' },
  { id: '4', total: 68, recommendedAction: 'review', outcome: 'correct' },
  { id: '5', total: 52, recommendedAction: 'review', outcome: 'incorrect' },
  { id: '6', total: 31, recommendedAction: 'abstain', outcome: 'incorrect' },
];

const report = analyzeCalibration(samples, {
  minSamplesPerBand: 2,
  targetPrecisionForAnswer: 0.85,
});

console.log('=== Calibration Analysis ===');
console.log(`Total: ${liveScorecard.total}`);
console.log(`RecommendedAction: ${liveScorecard.recommendedAction}`);
console.log(`PositiveRate: ${report.positiveRate.toFixed(2)}`);
console.log(`RecommendedPolicy: ${JSON.stringify(report.recommendedPolicy)}`);
console.log(
  `WarningCodes: ${
    report.warnings.length === 0
      ? 'none'
      : report.warnings.map((warning) => warning.code).join(', ')
  }`,
);
