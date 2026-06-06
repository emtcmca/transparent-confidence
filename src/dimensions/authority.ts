import type { AuthorityTier, DimensionScore, ScoringConfig, ScoringInputs } from '../types.js';

const MAX = 20;

const DEFAULT_TIERS: AuthorityTier[] = [
  { name: 'Primary', rank: 10 },
  { name: 'Secondary', rank: 20 },
  { name: 'Supporting', rank: 30 },
];

/**
 * Extension A — Source Authority (max 20 raw pts)
 *
 * Scores how authoritative the source documents are based on a user-defined
 * or default tier hierarchy. Lower rank numbers = higher authority.
 *
 * Base score set by the lowest (highest-authority) rank among all candidates.
 * Two +1 bonuses available: amendment presence, multiple tier levels consulted.
 */
export function scoreAuthority(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const { candidates } = inputs;
  const tiers = config.authority?.tiers ?? DEFAULT_TIERS;
  const parts: string[] = [];

  if (candidates.length === 0) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'No candidates retrieved — authority cannot be evaluated.',
    };
  }

  // Resolve effective rank for each candidate.
  // Prefer explicit authorityRank; fall back to keyword matching on documentType.
  const effectiveRanks = candidates.map((c) => resolveRank(c.authorityRank, c.documentType, tiers));

  const minRank = Math.min(...effectiveRanks);

  let base: number;
  let tierName: string;

  if (minRank <= 10) {
    base = 18;
    tierName = tiers.find((t) => t.rank <= 10)?.name ?? 'Primary';
    parts.push(`Answer grounded in ${tierName} tier documents (rank ≤ 10) — highest authority.`);
  } else if (minRank <= 20) {
    base = 13;
    tierName = tiers.find((t) => t.rank > 10 && t.rank <= 20)?.name ?? 'Secondary';
    parts.push(`Answer grounded in ${tierName} tier documents (rank ≤ 20).`);
  } else if (minRank <= 30) {
    base = 7;
    tierName = tiers.find((t) => t.rank > 20 && t.rank <= 30)?.name ?? 'Supporting';
    parts.push(`Answer grounded in ${tierName} tier documents (rank ≤ 30) — lower authority.`);
  } else {
    base = 2;
    parts.push('Answer grounded in unclassified or minimal-authority documents.');
  }

  let bonus = 0;

  // +1 if any candidate is an amendment
  if (candidates.some((c) => c.isAmendment === true)) {
    bonus += 1;
    parts.push(
      'Amendment sections included — amended version controls over original language (+1).',
    );
  }

  // +1 if more than one unique rank tier is represented
  const uniqueRankTiers = new Set(effectiveRanks.map((r) => rankBucket(r)));
  if (uniqueRankTiers.size > 1) {
    bonus += 1;
    parts.push('Multiple authority tiers consulted (+1).');
  }

  const raw = Math.min(MAX, base + bonus);

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
  };
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
