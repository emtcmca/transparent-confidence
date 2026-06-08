import type {
  Candidate,
  DimensionScore,
  RetrievalScoreBands,
  ScoringConfig,
  ScoringInputs,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 25;

type ResolvedRetrievalConfig = {
  scoreBands: RetrievalScoreBands;
  defaultMethodThreshold: number;
  methodThresholds: Record<string, number>;
  minConfirmedMethods: number;
  topK: number;
  minTopScoreGapForClearWinner: number;
  duplicateContent: {
    mode: 'diagnostic' | 'penalize';
    penaltyPerDuplicate: number;
    maxPenalty: number;
  };
  rankPenalty: {
    mode: 'diagnostic' | 'penalize';
    afterRank: number;
    penaltyPerRank: number;
    maxPenalty: number;
  };
};

const DEFAULT_RETRIEVAL_CONFIG: ResolvedRetrievalConfig = {
  scoreBands: {
    full: 0.8,
    high: 0.65,
    medium: 0.5,
    low: 0.35,
  },
  defaultMethodThreshold: 0,
  methodThresholds: {},
  minConfirmedMethods: 2,
  topK: 3,
  minTopScoreGapForClearWinner: 0.05,
  duplicateContent: {
    mode: 'diagnostic',
    penaltyPerDuplicate: 1,
    maxPenalty: 4,
  },
  rankPenalty: {
    mode: 'diagnostic',
    afterRank: 10,
    penaltyPerRank: 0.25,
    maxPenalty: 3,
  },
};

/**
 * Dimension 2 - Retrieval Confidence (max 25 raw pts)
 *
 * Three sub-signals summed, capped at 25:
 *   A. Method agreement (0-15): how many candidates confirmed by retrieval methods
 *   B. Score magnitude  (0-8): average effective combinedScore of top-K candidates
 *   C. Source diversity + breadth (0-5): unique documents + total candidate count
 */
export function scoreRetrieval(inputs: ScoringInputs, config: ScoringConfig = {}): DimensionScore {
  const { candidates } = inputs;
  const cfg = resolveRetrievalConfig(config);
  const warnings: DimensionScore['warnings'] = [];

  if (candidates.length === 0) {
    const raw = 0;
    warnings.push(
      createWarning('missing-candidates', 'No retrieved candidates were provided.', 'candidates'),
    );
    return {
      raw,
      max: MAX,
      normalized: 0,
      explanation: 'No candidates were retrieved.',
      breakdown: {
        components: { agreement: 0, magnitude: 0, diversity: 0, breadth: 0 },
        adjustments: {},
        diagnostics: {
          candidateCount: 0,
          topK: cfg.topK,
          duplicateContentHashCount: 0,
          rankedCandidateCount: 0,
          missingRankCount: 0,
          singleMethodCandidateCount: 0,
        },
        uncappedRaw: 0,
        raw,
      },
      warnings,
    };
  }

  const parts: string[] = [];

  const confirmed = candidates.filter(
    (candidate) => confirmedMethodCount(candidate, cfg) >= cfg.minConfirmedMethods,
  );

  const agreementPts = agreementPoints(confirmed.length);
  if (confirmed.length >= 3) {
    parts.push(
      `${confirmed.length} candidates confirmed by ${cfg.minConfirmedMethods}+ retrieval methods.`,
    );
  } else if (confirmed.length === 2) {
    parts.push(`2 candidates confirmed by ${cfg.minConfirmedMethods}+ retrieval methods.`);
  } else if (confirmed.length === 1) {
    parts.push(`1 candidate confirmed by ${cfg.minConfirmedMethods}+ retrieval methods.`);
  } else {
    parts.push('No candidates confirmed by the configured retrieval method threshold.');
  }

  const singleMethodCandidateCount = candidates.filter(
    (candidate) => Object.keys(candidate.retrievalScores).length < 2,
  ).length;
  if (singleMethodCandidateCount === candidates.length && cfg.minConfirmedMethods > 1) {
    warnings.push(
      createWarning(
        'single-retrieval-method',
        'All candidates were returned by a single retrieval method while minConfirmedMethods is greater than 1.',
        'candidates[].retrievalScores',
      ),
    );
  }

  const sorted = [...candidates].sort((a, b) => b.combinedScore - a.combinedScore);
  const topKCandidates = sorted.slice(0, cfg.topK);
  const effectiveScores = topKCandidates.map((candidate: Candidate) =>
    candidate.extractionQuality !== undefined
      ? candidate.combinedScore * candidate.extractionQuality
      : candidate.combinedScore,
  );
  const avgScore =
    effectiveScores.reduce((sum: number, score: number) => sum + score, 0) / effectiveScores.length;
  const magnitudePts = magnitudePoints(avgScore, cfg.scoreBands);

  parts.push(`Top-${topKCandidates.length} effective score avg: ${avgScore.toFixed(2)}.`);

  if (topKCandidates.some((candidate) => candidate.extractionQuality !== undefined)) {
    parts.push('Extraction quality applied as score multiplier.');
  }

  const withIds = candidates.filter((candidate) => candidate.documentId !== undefined);
  const uniqueDocIds = new Set(withIds.map((candidate) => candidate.documentId));
  const diversityPts = diversityPoints(uniqueDocIds.size, withIds.length);

  if (withIds.length > 0) {
    if (uniqueDocIds.size >= 3) {
      parts.push(`${uniqueDocIds.size} distinct source documents.`);
    } else if (uniqueDocIds.size === 2) {
      parts.push('2 distinct source documents.');
    } else {
      parts.push('All candidates from a single source document.');
    }
  }

  const breadthPts = breadthPoints(candidates.length);
  parts.push(`${candidates.length} total candidates.`);

  const duplicateContentHashCount = countDuplicateContentHashes(candidates);
  if (duplicateContentHashCount > 0) {
    warnings.push(
      createWarning(
        'duplicate-content',
        `${duplicateContentHashCount} duplicate content hash(es) detected among candidates.`,
        'candidates[].contentHash',
        cfg.duplicateContent.mode === 'penalize' ? 'warn' : 'info',
      ),
    );
  }

  const rankedCandidateCount = candidates.filter((candidate) =>
    isPositiveInteger(candidate.rank),
  ).length;
  const missingRankCount = candidates.length - rankedCandidateCount;
  if (cfg.rankPenalty.mode === 'penalize' && missingRankCount > 0) {
    warnings.push(
      createWarning(
        'rank-signal-missing',
        `${missingRankCount} candidate rank value(s) missing while rank penalty is active.`,
        'candidates[].rank',
        'info',
      ),
    );
  }

  const scores = sorted.map((candidate) => candidate.combinedScore);
  const topScoreGap = scores.length >= 2 ? (scores[0] ?? 0) - (scores[1] ?? 0) : 0;
  if (scores.length >= 2 && topScoreGap < cfg.minTopScoreGapForClearWinner) {
    warnings.push(
      createWarning(
        'ambiguous-top-results',
        'Top retrieval results are close together; no clear winner was identified.',
        'candidates[].combinedScore',
      ),
    );
  }

  const duplicatePenalty = duplicateContentPenalty(duplicateContentHashCount, cfg);
  const rankPenalty = candidateRankPenalty(candidates, cfg);
  const uncappedRaw =
    agreementPts + magnitudePts + diversityPts + breadthPts + duplicatePenalty + rankPenalty;
  const raw = Math.max(0, Math.min(MAX, uncappedRaw));
  const adjustments: Record<string, number> = {};
  if (duplicatePenalty !== 0) adjustments.duplicateContentPenalty = duplicatePenalty;
  if (rankPenalty !== 0) adjustments.rankPenalty = rankPenalty;
  if (raw < uncappedRaw) {
    adjustments.cap = raw - uncappedRaw;
  }

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
    breakdown: {
      components: {
        agreement: agreementPts,
        magnitude: magnitudePts,
        diversity: diversityPts,
        breadth: breadthPts,
      },
      adjustments,
      diagnostics: {
        avgEffectiveScore: round(avgScore, 4),
        candidateCount: candidates.length,
        confirmedCandidateCount: confirmed.length,
        duplicateContentHashCount,
        missingRankCount,
        rankedCandidateCount,
        scoreStdDev: round(stdDev(scores), 4),
        singleMethodCandidateCount,
        topK: cfg.topK,
        topScoreGap: round(topScoreGap, 4),
        uniqueDocumentCount: uniqueDocIds.size,
      },
      uncappedRaw,
      raw,
    },
    ...(warnings.length > 0 && { warnings }),
  };
}

function resolveRetrievalConfig(config: ScoringConfig): ResolvedRetrievalConfig {
  return {
    scoreBands: {
      ...DEFAULT_RETRIEVAL_CONFIG.scoreBands,
      ...config.retrieval?.scoreBands,
    },
    defaultMethodThreshold:
      config.retrieval?.defaultMethodThreshold ?? DEFAULT_RETRIEVAL_CONFIG.defaultMethodThreshold,
    methodThresholds: {
      ...DEFAULT_RETRIEVAL_CONFIG.methodThresholds,
      ...config.retrieval?.methodThresholds,
    },
    minConfirmedMethods:
      config.retrieval?.minConfirmedMethods ?? DEFAULT_RETRIEVAL_CONFIG.minConfirmedMethods,
    topK: config.retrieval?.topK ?? DEFAULT_RETRIEVAL_CONFIG.topK,
    minTopScoreGapForClearWinner:
      config.retrieval?.minTopScoreGapForClearWinner ??
      DEFAULT_RETRIEVAL_CONFIG.minTopScoreGapForClearWinner,
    duplicateContent: {
      mode:
        config.retrieval?.duplicateContent?.mode ?? DEFAULT_RETRIEVAL_CONFIG.duplicateContent.mode,
      penaltyPerDuplicate:
        config.retrieval?.duplicateContent?.penaltyPerDuplicate ??
        DEFAULT_RETRIEVAL_CONFIG.duplicateContent.penaltyPerDuplicate,
      maxPenalty:
        config.retrieval?.duplicateContent?.maxPenalty ??
        DEFAULT_RETRIEVAL_CONFIG.duplicateContent.maxPenalty,
    },
    rankPenalty: {
      mode: config.retrieval?.rankPenalty?.mode ?? DEFAULT_RETRIEVAL_CONFIG.rankPenalty.mode,
      afterRank:
        config.retrieval?.rankPenalty?.afterRank ?? DEFAULT_RETRIEVAL_CONFIG.rankPenalty.afterRank,
      penaltyPerRank:
        config.retrieval?.rankPenalty?.penaltyPerRank ??
        DEFAULT_RETRIEVAL_CONFIG.rankPenalty.penaltyPerRank,
      maxPenalty:
        config.retrieval?.rankPenalty?.maxPenalty ??
        DEFAULT_RETRIEVAL_CONFIG.rankPenalty.maxPenalty,
    },
  };
}

function confirmedMethodCount(candidate: Candidate, config: ResolvedRetrievalConfig): number {
  return Object.entries(candidate.retrievalScores).filter(([method, score]) => {
    const threshold = config.methodThresholds[method] ?? config.defaultMethodThreshold;
    return score > threshold;
  }).length;
}

function agreementPoints(confirmedCount: number): number {
  if (confirmedCount >= 3) return 15;
  if (confirmedCount === 2) return 12;
  if (confirmedCount === 1) return 8;
  return 3;
}

function magnitudePoints(avgScore: number, bands: RetrievalScoreBands): number {
  if (avgScore >= bands.full) return 8;
  if (avgScore >= bands.high) return 6;
  if (avgScore >= bands.medium) return 4;
  if (avgScore >= bands.low) return 2;
  return 0;
}

function diversityPoints(uniqueDocumentCount: number, identifiedDocumentCount: number): number {
  if (identifiedDocumentCount === 0) return 0;
  if (uniqueDocumentCount >= 3) return 3;
  if (uniqueDocumentCount === 2) return 1;
  return 0;
}

function breadthPoints(candidateCount: number): number {
  if (candidateCount >= 5) return 2;
  if (candidateCount >= 3) return 1;
  return 0;
}

function countDuplicateContentHashes(candidates: Candidate[]): number {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.contentHash === undefined) continue;
    counts.set(candidate.contentHash, (counts.get(candidate.contentHash) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicates += count - 1;
  }
  return duplicates;
}

function duplicateContentPenalty(
  duplicateContentHashCount: number,
  config: ResolvedRetrievalConfig,
): number {
  if (config.duplicateContent.mode !== 'penalize') return 0;
  const penalty = duplicateContentHashCount * config.duplicateContent.penaltyPerDuplicate;
  return -Math.min(penalty, config.duplicateContent.maxPenalty);
}

function candidateRankPenalty(candidates: Candidate[], config: ResolvedRetrievalConfig): number {
  if (config.rankPenalty.mode !== 'penalize') return 0;

  const penalty = candidates.reduce((sum, candidate) => {
    if (!isPositiveInteger(candidate.rank) || candidate.rank <= config.rankPenalty.afterRank) {
      return sum;
    }
    return (
      sum + (candidate.rank - config.rankPenalty.afterRank) * config.rankPenalty.penaltyPerRank
    );
  }, 0);

  return -Math.min(penalty, config.rankPenalty.maxPenalty);
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
