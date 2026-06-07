import type {
  ConfidenceWarning,
  DimensionBreakdown,
  DimensionScore,
  ScoringConfig,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 15;

const DEFAULT_RELEVANCE_BANDS = {
  full: 0.9,
  high: 0.75,
  medium: 0.6,
  low: 0.4,
};

/**
 * Optional Dimension — Answer Relevance (max 15 raw pts)
 *
 * Measures whether the answer addresses the user's question.
 * Distinct from grounding: a grounded answer can still be irrelevant to the actual query.
 *
 * Active when:
 *   - inputs.answerRelevanceScore is provided, OR
 *   - config.relevance.required === true
 *
 * When required but missing, scores 0 and emits warning missing-answer-relevance.
 */
export function scoreRelevance(
  answerRelevanceScore: number | undefined,
  config: ScoringConfig,
): DimensionScore {
  const warnings: ConfidenceWarning[] = [];
  const bands = resolveRelevanceBands(config);

  if (answerRelevanceScore === undefined) {
    warnings.push(
      createWarning(
        'missing-answer-relevance',
        'Answer relevance scoring is required, but answerRelevanceScore was not provided.',
        'answerRelevanceScore',
      ),
    );

    const breakdown: DimensionBreakdown = {
      components: { relevanceScore: 0 },
      adjustments: { missingRequired: -MAX },
      diagnostics: { required: true, scoreProvided: false },
      uncappedRaw: 0,
      raw: 0,
    };

    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'Answer relevance score required but not provided.',
      breakdown,
      warnings,
    };
  }

  const raw = rawFromScore(answerRelevanceScore, bands);
  const breakdown: DimensionBreakdown = {
    components: { relevanceScore: raw },
    adjustments: {},
    diagnostics: {
      answerRelevanceScore: round(answerRelevanceScore, 4),
      bandFull: bands.full,
      bandHigh: bands.high,
      bandMedium: bands.medium,
      bandLow: bands.low,
    },
    uncappedRaw: raw,
    raw,
  };

  const explanation = buildExplanation(answerRelevanceScore, raw, bands);

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation,
    breakdown,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

function rawFromScore(score: number, bands: typeof DEFAULT_RELEVANCE_BANDS): number {
  if (score >= bands.full) return 15;
  if (score >= bands.high) return 12;
  if (score >= bands.medium) return 8;
  if (score >= bands.low) return 4;
  return 0;
}

function buildExplanation(
  score: number,
  raw: number,
  bands: typeof DEFAULT_RELEVANCE_BANDS,
): string {
  if (score >= bands.full)
    return `Answer relevance ${score.toFixed(2)} — full score (${raw}/${MAX}).`;
  if (score >= bands.high)
    return `Answer relevance ${score.toFixed(2)} — high relevance (${raw}/${MAX}).`;
  if (score >= bands.medium)
    return `Answer relevance ${score.toFixed(2)} — moderate relevance (${raw}/${MAX}).`;
  if (score >= bands.low)
    return `Answer relevance ${score.toFixed(2)} — low relevance (${raw}/${MAX}).`;
  return `Answer relevance ${score.toFixed(2)} — below minimum threshold (${raw}/${MAX}).`;
}

function resolveRelevanceBands(config: ScoringConfig): typeof DEFAULT_RELEVANCE_BANDS {
  return {
    ...DEFAULT_RELEVANCE_BANDS,
    ...config.relevance?.scoreBands,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
