import type {
  ConfidenceWarning,
  DimensionBreakdown,
  DimensionScore,
  FreshnessConfig,
  ScoringConfig,
  ScoringInputs,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 15;

type ResolvedFreshnessConfig = Required<
  Pick<
    FreshnessConfig,
    'maxAgeForFullScore' | 'penaltyPerMonth' | 'hardCutoffAge' | 'now' | 'aggregation'
  >
>;

const DEFAULTS: Omit<ResolvedFreshnessConfig, 'now'> & { now?: Date } = {
  maxAgeForFullScore: 90,
  penaltyPerMonth: 1.5,
  hardCutoffAge: 730,
  aggregation: 'median',
};

/**
 * Extension C — Document Freshness (max 15 raw pts)
 *
 * v0.2: Deterministic `now` injection via config.freshness.now.
 * Falls back to current wall-clock date when not provided.
 *
 * Aggregation modes:
 *   median  (default) — representative freshness of the candidate set
 *   oldest  — worst-case freshness (most conservative)
 *   newest  — best-case freshness (most optimistic)
 */
export function scoreFreshness(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const cfg: ResolvedFreshnessConfig = {
    maxAgeForFullScore: config.freshness?.maxAgeForFullScore ?? DEFAULTS.maxAgeForFullScore,
    penaltyPerMonth: config.freshness?.penaltyPerMonth ?? DEFAULTS.penaltyPerMonth,
    hardCutoffAge: config.freshness?.hardCutoffAge ?? DEFAULTS.hardCutoffAge,
    aggregation: config.freshness?.aggregation ?? DEFAULTS.aggregation,
    now: config.freshness?.now ?? new Date(),
  };

  const datedCandidates = inputs.candidates.filter((c) => c.lastUpdated instanceof Date);

  if (datedCandidates.length === 0) {
    const warning: ConfidenceWarning = createWarning(
      'missing-freshness-dates',
      'No lastUpdated dates provided on candidates. Supply Candidate.lastUpdated to enable freshness scoring.',
      'candidates[].lastUpdated',
    );
    const breakdown: DimensionBreakdown = {
      components: { selectedAge: 0 },
      adjustments: {},
      diagnostics: { aggregation: cfg.aggregation, datedCandidateCount: 0 },
      uncappedRaw: 0,
      raw: 0,
    };
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation:
        'No lastUpdated dates provided on candidates. Supply Candidate.lastUpdated to enable freshness scoring.',
      breakdown,
      warnings: [warning],
    };
  }

  const nowMs = cfg.now.getTime();
  const agesInDays = datedCandidates
    .map((c) => (nowMs - (c.lastUpdated as Date).getTime()) / (1000 * 60 * 60 * 24))
    .sort((a, b) => a - b);

  const selectedAge =
    cfg.aggregation === 'oldest'
      ? Math.max(...agesInDays)
      : cfg.aggregation === 'newest'
        ? Math.min(...agesInDays)
        : median(agesInDays);

  const selectedAgeRounded = Math.round(selectedAge);
  const parts: string[] = [];
  const aggregationLabel =
    cfg.aggregation === 'oldest' ? 'Oldest' : cfg.aggregation === 'newest' ? 'Newest' : 'Median';

  parts.push(`${aggregationLabel} document age: ${selectedAgeRounded} days.`);

  if (selectedAge >= cfg.hardCutoffAge) {
    const breakdown: DimensionBreakdown = {
      components: { selectedAge: selectedAgeRounded },
      adjustments: { hardCutoff: -MAX },
      diagnostics: {
        aggregation: cfg.aggregation,
        datedCandidateCount: datedCandidates.length,
        selectedAgeDays: selectedAgeRounded,
        hardCutoffAge: cfg.hardCutoffAge,
      },
      uncappedRaw: 0,
      raw: 0,
    };
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: `${parts.join(' ')} Documents exceed the ${cfg.hardCutoffAge}-day cutoff — freshness score is 0.`,
      breakdown,
      warnings: [],
    };
  }

  if (selectedAge <= cfg.maxAgeForFullScore) {
    parts.push(`Within the ${cfg.maxAgeForFullScore}-day full-score window.`);
    const breakdown: DimensionBreakdown = {
      components: { selectedAge: selectedAgeRounded },
      adjustments: {},
      diagnostics: {
        aggregation: cfg.aggregation,
        datedCandidateCount: datedCandidates.length,
        selectedAgeDays: selectedAgeRounded,
        maxAgeForFullScore: cfg.maxAgeForFullScore,
      },
      uncappedRaw: MAX,
      raw: MAX,
    };
    return {
      raw: MAX,
      max: MAX,
      normalized: 100,
      explanation: parts.join(' '),
      breakdown,
      warnings: [],
    };
  }

  // Decay: subtract penaltyPerMonth for each 30-day period beyond the window
  const daysOverWindow = selectedAge - cfg.maxAgeForFullScore;
  const monthsOver = daysOverWindow / 30;
  const penalty = monthsOver * cfg.penaltyPerMonth;

  const rawExact = Math.max(0, MAX - penalty);
  const raw = Math.round(rawExact);

  parts.push(
    `${Math.round(daysOverWindow)} days beyond the ${cfg.maxAgeForFullScore}-day window — penalty: ${penalty.toFixed(1)} pts.`,
  );

  const breakdown: DimensionBreakdown = {
    components: { selectedAge: selectedAgeRounded },
    adjustments: { decayPenalty: -Math.round(penalty * 10) / 10 },
    diagnostics: {
      aggregation: cfg.aggregation,
      datedCandidateCount: datedCandidates.length,
      selectedAgeDays: selectedAgeRounded,
      daysOverWindow: Math.round(daysOverWindow),
      penaltyPerMonth: cfg.penaltyPerMonth,
    },
    uncappedRaw: rawExact,
    raw,
  };

  return {
    raw,
    max: MAX,
    normalized: Math.round((rawExact / MAX) * 100),
    explanation: parts.join(' '),
    breakdown,
    warnings: [],
  };
}

/** Median of a sorted ascending array of numbers. */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}
