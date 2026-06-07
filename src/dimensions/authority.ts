import type {
  AuthorityTier,
  ConfidenceWarning,
  DimensionBreakdown,
  DimensionScore,
  ScoringConfig,
  ScoringInputs,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 20;

const DEFAULT_TIERS: AuthorityTier[] = [
  { name: 'Primary', rank: 10 },
  { name: 'Secondary', rank: 20 },
  { name: 'Supporting', rank: 30 },
];

const DEFAULT_TOP_K = 5;

/**
 * Extension A — Source Authority (max 20 raw pts)
 *
 * v0.2: Weighted aggregation is the default. Each candidate's authority points
 * are weighted by its combinedScore share among the top-K candidates.
 * This prevents a single high-authority source from masking a pool of
 * unclassified or low-authority sources.
 *
 * `aggregation: 'best'` reproduces the v0.1 min-rank behavior for callers
 * who prefer it.
 *
 * Bonuses (same in both modes):
 *   +1 if any included candidate is an amendment.
 *   +1 if more than one rank bucket is represented.
 */
export function scoreAuthority(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const { candidates } = inputs;
  const tiers = config.authority?.tiers ?? DEFAULT_TIERS;
  const aggregation = config.authority?.aggregation ?? 'weighted';
  const topK = config.authority?.topK ?? DEFAULT_TOP_K;
  const warnings: ConfidenceWarning[] = [];
  const parts: string[] = [];

  if (candidates.length === 0) {
    const breakdown: DimensionBreakdown = {
      components: { weightedAuthority: 0 },
      adjustments: {},
      diagnostics: { candidateCount: 0, unclassifiedCount: 0, topK },
      uncappedRaw: 0,
      raw: 0,
    };
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'No candidates retrieved — authority cannot be evaluated.',
      breakdown,
      warnings: [],
    };
  }

  // Sort by combinedScore descending, take topK
  const sorted = [...candidates].sort((a, b) => b.combinedScore - a.combinedScore);
  const included = sorted.slice(0, topK);

  // Resolve effective rank for each included candidate
  const resolvedRanks = included.map((c) => resolveRank(c.authorityRank, c.documentType, tiers));
  const unclassifiedCount = resolvedRanks.filter((r) => r === 99).length;

  if (unclassifiedCount > 0) {
    warnings.push(
      createWarning(
        'authority-unclassified',
        `${unclassifiedCount} of ${included.length} included candidate(s) could not be classified into any authority tier.`,
        'candidates[].authorityRank',
      ),
    );
  }

  let base: number;

  if (aggregation === 'best') {
    // v0.1 compatibility: base score driven by highest-authority (lowest rank) candidate
    const minRank = Math.min(...resolvedRanks);
    base = rankToPoints(minRank);
    parts.push(`Best-source authority: rank ${minRank} → ${base} pts (aggregation: best).`);
  } else {
    // v0.2 default: weighted aggregation
    const sumScores = included.reduce((s, c) => s + c.combinedScore, 0);
    const weights =
      sumScores > 0
        ? included.map((c) => c.combinedScore / sumScores)
        : included.map(() => 1 / included.length);

    const candidatePoints = resolvedRanks.map(rankToPoints);
    const weightedAuthority = weights.reduce((s, w, i) => s + w * (candidatePoints[i] ?? 2), 0);
    base = Math.round(weightedAuthority);
    parts.push(
      `Weighted authority across ${included.length} candidate(s): ${weightedAuthority.toFixed(2)} → ${base} pts.`,
    );
  }

  // Bonuses
  let bonus = 0;

  if (included.some((c) => c.isAmendment === true)) {
    bonus += 1;
    parts.push(
      'Amendment sections included — amended version controls over original language (+1).',
    );
  }

  const uniqueBuckets = new Set(resolvedRanks.map(rankBucket));
  if (uniqueBuckets.size > 1) {
    bonus += 1;
    parts.push('Multiple authority tiers consulted (+1).');
  }

  if (unclassifiedCount === included.length) {
    parts.push('All included candidates are unclassified — authority signal is unavailable.');
  }

  const uncappedRaw = base + bonus;
  const raw = Math.min(MAX, uncappedRaw);

  const breakdown: DimensionBreakdown = {
    components: { weightedAuthority: base, bonuses: bonus },
    adjustments: raw < uncappedRaw ? { cap: raw - uncappedRaw } : {},
    diagnostics: {
      aggregation,
      topK,
      includedCount: included.length,
      unclassifiedCount,
      uniqueTierCount: uniqueBuckets.size,
    },
    uncappedRaw,
    raw,
  };

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
    breakdown,
    warnings: warnings.length > 0 ? warnings : [],
  };
}

/** Candidate authority points by effective rank. */
function rankToPoints(rank: number): number {
  if (rank <= 10) return 18;
  if (rank <= 20) return 13;
  if (rank <= 30) return 7;
  return 2;
}

/** Resolves the effective rank for a candidate. */
function resolveRank(
  authorityRank: number | undefined,
  documentType: string | undefined,
  tiers: AuthorityTier[],
): number {
  if (authorityRank !== undefined) return authorityRank;
  if (!documentType) return 99;

  const lower = documentType.toLowerCase();
  for (const tier of tiers) {
    if (tier.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) {
      return tier.rank;
    }
  }
  return 99;
}

/** Maps a raw rank number to a coarse bucket for unique-tier counting. */
function rankBucket(rank: number): string {
  if (rank <= 10) return 'tier1';
  if (rank <= 20) return 'tier2';
  if (rank <= 30) return 'tier3';
  return 'unclassified';
}
