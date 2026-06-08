import type {
  ActionPolicy,
  CalibrationBand,
  CalibrationConfig,
  CalibrationOutcome,
  CalibrationReport,
  CalibrationSample,
  RecommendedAction,
} from './types.js';
import { createWarning } from './warnings.js';

const DEFAULT_POSITIVE_OUTCOMES: CalibrationOutcome[] = ['correct', 'accepted'];
const DEFAULT_BANDS: Array<{ min: number; max: number }> = [
  { min: 0, max: 40 },
  { min: 40, max: 65 },
  { min: 65, max: 85 },
  { min: 85, max: 101 },
];

export function analyzeCalibration(
  samples: CalibrationSample[],
  config: CalibrationConfig = {},
): CalibrationReport {
  validateSamples(samples);

  const bands = resolveBands(config);
  const positiveOutcomes = new Set(config.positiveOutcomes ?? DEFAULT_POSITIVE_OUTCOMES);
  const samplePositiveCount = samples.filter((sample) =>
    positiveOutcomes.has(sample.outcome),
  ).length;
  const calibrationBands = bands.map((band) => summarizeBand(samples, band, positiveOutcomes));
  const warnings = calibrationWarnings(calibrationBands, config);

  return {
    sampleCount: samples.length,
    positiveCount: samplePositiveCount,
    positiveRate: samplePositiveCount / samples.length,
    bands: calibrationBands,
    actionSummary: summarizeActions(samples, positiveOutcomes),
    recommendedPolicy: recommendPolicy(samples, calibrationBands, positiveOutcomes, config),
    warnings,
  };
}

function validateSamples(samples: CalibrationSample[]): void {
  if (samples.length === 0) {
    throw new Error('analyzeCalibration requires at least one sample.');
  }

  samples.forEach((sample, index) => {
    if (!Number.isFinite(sample.total) || sample.total < 0 || sample.total > 100) {
      throw new Error(`samples[${index}].total must be a finite number from 0 to 100.`);
    }
  });
}

function resolveBands(config: CalibrationConfig): Array<{ min: number; max: number }> {
  const bands = [...(config.bands ?? DEFAULT_BANDS)].sort((a, b) => a.min - b.min);

  bands.forEach((band, index) => {
    if (
      !Number.isFinite(band.min) ||
      !Number.isFinite(band.max) ||
      band.min < 0 ||
      band.max > 101 ||
      band.min >= band.max
    ) {
      throw new Error(`bands[${index}] must satisfy 0 <= min < max <= 101.`);
    }

    const previous = bands[index - 1];
    if (previous !== undefined && band.min < previous.max) {
      throw new Error('Calibration bands cannot overlap.');
    }
  });

  return bands;
}

function summarizeBand(
  samples: CalibrationSample[],
  band: { min: number; max: number },
  positiveOutcomes: Set<CalibrationOutcome>,
): CalibrationBand {
  const inBand = samples.filter((sample) => sample.total >= band.min && sample.total < band.max);
  const positiveCount = inBand.filter((sample) => positiveOutcomes.has(sample.outcome)).length;
  const totalScore = inBand.reduce((sum, sample) => sum + sample.total, 0);

  return {
    min: band.min,
    max: band.max,
    count: inBand.length,
    positiveCount,
    positiveRate: inBand.length > 0 ? positiveCount / inBand.length : 0,
    averageScore: inBand.length > 0 ? totalScore / inBand.length : 0,
  };
}

function summarizeActions(
  samples: CalibrationSample[],
  positiveOutcomes: Set<CalibrationOutcome>,
): Record<RecommendedAction, { count: number; positiveRate: number }> {
  const counts: Record<RecommendedAction, { count: number; positiveCount: number }> = {
    answer: { count: 0, positiveCount: 0 },
    review: { count: 0, positiveCount: 0 },
    abstain: { count: 0, positiveCount: 0 },
  };

  for (const sample of samples) {
    if (sample.recommendedAction === undefined) continue;

    counts[sample.recommendedAction].count += 1;
    if (positiveOutcomes.has(sample.outcome)) {
      counts[sample.recommendedAction].positiveCount += 1;
    }
  }

  return {
    answer: toActionRate(counts.answer),
    review: toActionRate(counts.review),
    abstain: toActionRate(counts.abstain),
  };
}

function toActionRate(summary: { count: number; positiveCount: number }): {
  count: number;
  positiveRate: number;
} {
  return {
    count: summary.count,
    positiveRate: summary.count > 0 ? summary.positiveCount / summary.count : 0,
  };
}

function calibrationWarnings(bands: CalibrationBand[], config: CalibrationConfig) {
  const minSamplesPerBand = config.minSamplesPerBand ?? 0;
  if (minSamplesPerBand <= 0) return [];

  const thinBand = bands.find((band) => band.count < minSamplesPerBand);
  if (thinBand === undefined) return [];

  return [
    createWarning(
      'low-calibration-sample-size',
      `At least one calibration band has fewer than ${minSamplesPerBand} sample(s).`,
      'bands',
    ),
  ];
}

function recommendPolicy(
  samples: CalibrationSample[],
  bands: CalibrationBand[],
  positiveOutcomes: Set<CalibrationOutcome>,
  config: CalibrationConfig,
): ActionPolicy {
  const targetPrecision = config.targetPrecisionForAnswer ?? 0.85;
  const answerBand = [...bands]
    .reverse()
    .find((band) => band.count > 0 && band.positiveRate >= targetPrecision);
  const answerAt = answerBand?.min ?? 85;
  const abstainBelow = recommendAbstainBelow(samples, bands, positiveOutcomes, config, answerAt);

  return {
    answerAt,
    reviewAt: abstainBelow,
    abstainBelow,
  };
}

function recommendAbstainBelow(
  samples: CalibrationSample[],
  bands: CalibrationBand[],
  positiveOutcomes: Set<CalibrationOutcome>,
  config: CalibrationConfig,
  answerAt: number,
): number {
  const targetRecall = config.targetRecallForAbstain;
  if (targetRecall === undefined) return 40;

  const negativeSamples = samples.filter((sample) => !positiveOutcomes.has(sample.outcome));
  if (negativeSamples.length === 0) return 40;

  const thresholds = bands
    .map((band) => band.max)
    .filter((threshold) => threshold <= answerAt)
    .sort((a, b) => a - b);

  for (const threshold of thresholds) {
    const recalledNegatives = negativeSamples.filter((sample) => sample.total < threshold).length;
    if (recalledNegatives / negativeSamples.length >= targetRecall) {
      return threshold;
    }
  }

  return 40;
}
