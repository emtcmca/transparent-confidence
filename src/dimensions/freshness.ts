import type { DimensionScore, FreshnessConfig, ScoringConfig, ScoringInputs } from '../types.js';

const MAX = 15;

const DEFAULTS: Required<FreshnessConfig> = {
  maxAgeForFullScore: 90,
  penaltyPerMonth: 1.5,
  hardCutoffAge: 730,
};

/**
 * Extension C — Document Freshness (max 15 raw pts)
 *
 * Scores how current the source documents are. Uses the median lastUpdated
 * across all candidates with a date, applying a configurable decay curve.
 *
 * Candidates without lastUpdated are excluded from the median calculation.
 * If no candidates have lastUpdated, returns 0 with a note.
 */
export function scoreFreshness(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const cfg: Required<FreshnessConfig> = {
    maxAgeForFullScore: config.freshness?.maxAgeForFullScore ?? DEFAULTS.maxAgeForFullScore,
    penaltyPerMonth: config.freshness?.penaltyPerMonth ?? DEFAULTS.penaltyPerMonth,
    hardCutoffAge: config.freshness?.hardCutoffAge ?? DEFAULTS.hardCutoffAge,
  };

  const datedCandidates = inputs.candidates.filter((c) => c.lastUpdated instanceof Date);

  if (datedCandidates.length === 0) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation:
        'No lastUpdated dates provided on candidates. Supply Candidate.lastUpdated to enable freshness scoring.',
    };
  }

  const now = Date.now();
  const agesInDays = datedCandidates
    .map((c) => (now - (c.lastUpdated as Date).getTime()) / (1000 * 60 * 60 * 24))
    .sort((a, b) => a - b);

  const medianAge = median(agesInDays);
  const parts: string[] = [];

  parts.push(`Median document age: ${Math.round(medianAge)} days.`);

  if (medianAge >= cfg.hardCutoffAge) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: `${parts.join(' ')} Documents exceed the ${cfg.hardCutoffAge}-day cutoff — freshness score is 0.`,
    };
  }

  if (medianAge <= cfg.maxAgeForFullScore) {
    parts.push(`Within the ${cfg.maxAgeForFullScore}-day full-score window.`);
    return {
      raw: MAX,
      max: MAX,
      normalized: 100,
      explanation: parts.join(' '),
    };
  }

  // Decay: subtract penaltyPerMonth for each 30-day period beyond the window
  const daysOverWindow = medianAge - cfg.maxAgeForFullScore;
  const monthsOver = daysOverWindow / 30;
  const penalty = monthsOver * cfg.penaltyPerMonth;

  const raw = Math.max(0, Math.min(MAX, MAX - penalty));
  const rawRounded = Math.round(raw * 10) / 10;

  parts.push(
    `${Math.round(daysOverWindow)} days beyond the ${cfg.maxAgeForFullScore}-day window — penalty: ${penalty.toFixed(1)} pts.`,
  );

  return {
    raw: Math.round(rawRounded),
    max: MAX,
    normalized: Math.round((rawRounded / MAX) * 100),
    explanation: parts.join(' '),
  };
}

/** Median of a sorted array of numbers. */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}
