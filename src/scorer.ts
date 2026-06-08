import { scoreAuthority } from './dimensions/authority.js';
import { scoreConsistency } from './dimensions/consistency.js';
import { scoreCorpus } from './dimensions/corpus.js';
import { scoreFreshness } from './dimensions/freshness.js';
import { scoreGrounding } from './dimensions/grounding.js';
import { scoreIndexIntegrity } from './dimensions/index-integrity.js';
import { scoreRelevance } from './dimensions/relevance.js';
import { scoreRetrieval } from './dimensions/retrieval.js';
import { deriveLabel, deriveTier1, deriveTier2 } from './labels.js';
import { normalize } from './normalize.js';
import type {
  ActionPolicy,
  ConfidenceScorecard,
  ConfidenceWarning,
  ConfidenceWarningCode,
  DimensionName,
  RecommendedAction,
  ScoringConfig,
  ScoringInputs,
  SignalName,
  SignalPolicy,
} from './types.js';
import { collectInputWarnings, enforceInputValidation, validateConfig } from './validation.js';
import { createWarning, missingSignalsForWarnings, uniqueWarnings } from './warnings.js';

export const ALGORITHM_VERSION = '0.3.0';
export const SCORECARD_SCHEMA_VERSION = '0.3';

// Default dimension max values — preserved from v0.1 so default behavior is unchanged.
const DEFAULT_WEIGHTS: Record<DimensionName, number> = {
  grounding: 30,
  retrieval: 25,
  consistency: 10,
  relevance: 15,
  authority: 20,
  corpus: 15,
  freshness: 15,
  indexIntegrity: 15,
};

const DEFAULT_ACTION_POLICY = {
  answerAt: 65,
  reviewAt: 40,
  abstainBelow: 40,
  requireTier1AtLeast: 40,
  reviewOnWarnings: [
    'missing-answer-relevance',
    'missing-conflict-signal',
  ] as ConfidenceWarningCode[],
  abstainOnWarnings: ['documents-silent'] as ConfidenceWarningCode[],
};

type ResolvedActionPolicy = {
  answerAt: number;
  reviewAt: number;
  abstainBelow: number;
  requireTier1AtLeast: number;
  reviewOnWarnings: ConfidenceWarningCode[];
  abstainOnWarnings: ConfidenceWarningCode[];
};

type ResolvedSignalPolicy = {
  require: SignalName[];
  reviewWhenMissing: SignalName[];
  abstainWhenMissing: SignalName[];
  minCitationCoverageScore?: number;
  maxInvalidCitationCount?: number;
  requireSupportEvaluator: boolean;
};

type SignalPolicyResult = {
  warnings: ConfidenceWarning[];
  reviewMissingSignals: SignalName[];
  abstainMissingSignals: SignalName[];
};

/**
 * Computes a structured confidence scorecard for a RAG answer.
 *
 * Always scores the three core dimensions (grounding, retrieval, consistency).
 * Optional extensions are activated by passing the corresponding config key.
 * The total is always normalized to 0–100 regardless of which extensions are active.
 */
export function computeConfidence(
  inputs: ScoringInputs,
  config: ScoringConfig = {},
): ConfidenceScorecard {
  validateConfig(config);

  const validationWarnings = collectInputWarnings(inputs, config);
  enforceInputValidation(validationWarnings, config);

  const hasRelevance =
    inputs.answerRelevanceScore !== undefined || config.relevance?.required === true;
  const hasAuthority = config.authority !== undefined;
  const hasCorpus = config.corpus !== undefined;
  const hasFreshness = config.freshness !== undefined;
  const hasIndexIntegrity = config.indexIntegrity !== undefined;

  const grounding = scoreGrounding(inputs);
  const retrieval = scoreRetrieval(inputs, config);
  const consistency = scoreConsistency(inputs);
  const relevance = hasRelevance ? scoreRelevance(inputs.answerRelevanceScore, config) : undefined;
  const authority = hasAuthority ? scoreAuthority(inputs, config) : undefined;
  const corpus = hasCorpus ? scoreCorpus(inputs, config) : undefined;
  const freshness = hasFreshness ? scoreFreshness(inputs, config) : undefined;
  const indexIntegrity = hasIndexIntegrity ? scoreIndexIntegrity(inputs, config) : undefined;
  const signalPolicyResult = collectSignalPolicyWarnings(inputs, config);

  const activeExtensions: string[] = [];
  if (hasRelevance) activeExtensions.push('relevance');
  if (hasAuthority) activeExtensions.push('authority');
  if (hasCorpus) activeExtensions.push('corpus');
  if (hasFreshness) activeExtensions.push('freshness');
  if (hasIndexIntegrity) activeExtensions.push('indexIntegrity');

  const activeDimensions: DimensionName[] = ['grounding', 'retrieval', 'consistency'];
  if (hasRelevance) activeDimensions.push('relevance');
  if (hasAuthority) activeDimensions.push('authority');
  if (hasCorpus) activeDimensions.push('corpus');
  if (hasFreshness) activeDimensions.push('freshness');
  if (hasIndexIntegrity) activeDimensions.push('indexIntegrity');

  // ── Weight resolution ────────────────────────────────────────
  const cw = config.weights ?? {};
  const activeWeights = {
    grounding: cw.grounding ?? DEFAULT_WEIGHTS.grounding,
    retrieval: cw.retrieval ?? DEFAULT_WEIGHTS.retrieval,
    consistency: cw.consistency ?? DEFAULT_WEIGHTS.consistency,
    ...(hasRelevance && { relevance: cw.relevance ?? DEFAULT_WEIGHTS.relevance }),
    ...(hasAuthority && { authority: cw.authority ?? DEFAULT_WEIGHTS.authority }),
    ...(hasCorpus && { corpus: cw.corpus ?? DEFAULT_WEIGHTS.corpus }),
    ...(hasFreshness && { freshness: cw.freshness ?? DEFAULT_WEIGHTS.freshness }),
    ...(hasIndexIntegrity && {
      indexIntegrity: cw.indexIntegrity ?? DEFAULT_WEIGHTS.indexIntegrity,
    }),
  };

  // ── Weighted dimension contributions ────────────────────────
  // weightedRaw = (dim.raw / dim.max) * activeWeight
  // When activeWeight === dim.max (default), this reduces to dim.raw.
  const wGrounding = scaleDim(grounding.raw, grounding.max, activeWeights.grounding);
  const wRetrieval = scaleDim(retrieval.raw, retrieval.max, activeWeights.retrieval);
  const wConsistency = scaleDim(consistency.raw, consistency.max, activeWeights.consistency);
  const wRelevance = relevance
    ? scaleDim(relevance.raw, relevance.max, activeWeights.relevance ?? DEFAULT_WEIGHTS.relevance)
    : 0;
  const wAuthority = authority
    ? scaleDim(authority.raw, authority.max, activeWeights.authority ?? DEFAULT_WEIGHTS.authority)
    : 0;
  const wCorpus = corpus
    ? scaleDim(corpus.raw, corpus.max, activeWeights.corpus ?? DEFAULT_WEIGHTS.corpus)
    : 0;
  const wFreshness = freshness
    ? scaleDim(freshness.raw, freshness.max, activeWeights.freshness ?? DEFAULT_WEIGHTS.freshness)
    : 0;
  const wIndexIntegrity = indexIntegrity
    ? scaleDim(
        indexIntegrity.raw,
        indexIntegrity.max,
        activeWeights.indexIntegrity ?? DEFAULT_WEIGHTS.indexIntegrity,
      )
    : 0;

  const rawTotal =
    wGrounding +
    wRetrieval +
    wConsistency +
    wRelevance +
    wAuthority +
    wCorpus +
    wFreshness +
    wIndexIntegrity;
  const maxPossible =
    activeWeights.grounding +
    activeWeights.retrieval +
    activeWeights.consistency +
    (hasRelevance ? (activeWeights.relevance ?? DEFAULT_WEIGHTS.relevance) : 0) +
    (hasAuthority ? (activeWeights.authority ?? DEFAULT_WEIGHTS.authority) : 0) +
    (hasCorpus ? (activeWeights.corpus ?? DEFAULT_WEIGHTS.corpus) : 0) +
    (hasFreshness ? (activeWeights.freshness ?? DEFAULT_WEIGHTS.freshness) : 0) +
    (hasIndexIntegrity ? (activeWeights.indexIntegrity ?? DEFAULT_WEIGHTS.indexIntegrity) : 0);

  const total = normalize(rawTotal, maxPossible);
  const { label, color: labelColor } = deriveLabel(total);

  const warnings = uniqueWarnings([
    ...validationWarnings,
    ...(grounding.warnings ?? []),
    ...(retrieval.warnings ?? []),
    ...(consistency.warnings ?? []),
    ...(relevance?.warnings ?? []),
    ...(authority?.warnings ?? []),
    ...(corpus?.warnings ?? []),
    ...(freshness?.warnings ?? []),
    ...(indexIntegrity?.warnings ?? []),
    ...signalPolicyResult.warnings,
  ]);

  // ── Tier 1: grounding + retrieval + consistency + relevance + authority ───────
  const tier1RawW = wGrounding + wRetrieval + wConsistency + wRelevance + wAuthority;
  const tier1MaxW =
    activeWeights.grounding +
    activeWeights.retrieval +
    activeWeights.consistency +
    (hasRelevance ? (activeWeights.relevance ?? DEFAULT_WEIGHTS.relevance) : 0) +
    (hasAuthority ? (activeWeights.authority ?? DEFAULT_WEIGHTS.authority) : 0);
  const tier1 = deriveTier1(tier1RawW, tier1MaxW, inputs.documentsSilent === true);

  // ── Tier 2: corpus + freshness + index integrity; null when none are active ──
  const tier2MaxW =
    (hasCorpus ? (activeWeights.corpus ?? DEFAULT_WEIGHTS.corpus) : 0) +
    (hasFreshness ? (activeWeights.freshness ?? DEFAULT_WEIGHTS.freshness) : 0) +
    (hasIndexIntegrity ? (activeWeights.indexIntegrity ?? DEFAULT_WEIGHTS.indexIntegrity) : 0);
  const tier2 = deriveTier2(wCorpus + wFreshness + wIndexIntegrity, tier2MaxW);

  // ── Recommended action ────────────────────────────────────────────────────────
  const policy = resolveActionPolicy(config);
  const warningCodes = warnings.map((w) => w.code);
  const tier1Score = tier1?.score ?? 0;
  const { action: recommendedAction, reason: actionReason } = deriveRecommendedAction({
    total,
    documentsSilent: inputs.documentsSilent === true,
    tier1Score,
    warningCodes,
    reviewMissingSignals: signalPolicyResult.reviewMissingSignals,
    abstainMissingSignals: signalPolicyResult.abstainMissingSignals,
    policy,
  });

  return {
    total,
    label,
    labelColor,
    recommendedAction,
    actionReason,
    tier1,
    tier2,
    dimensions: {
      grounding,
      retrieval,
      consistency,
      ...(relevance !== undefined && { relevance }),
      ...(authority !== undefined && { authority }),
      ...(corpus !== undefined && { corpus }),
      ...(freshness !== undefined && { freshness }),
      ...(indexIntegrity !== undefined && { indexIntegrity }),
    },
    meta: {
      algorithmVersion: ALGORITHM_VERSION,
      schemaVersion: SCORECARD_SCHEMA_VERSION,
      rawTotal,
      maxPossible,
      activeExtensions,
      activeDimensions,
      missingSignals: missingSignalsForWarnings(warnings),
      warnings,
      weights: activeWeights,
    },
  };
}

/**
 * Creates a pre-configured scorer bound to the given config.
 * Useful when scoring many answers against the same corpus setup.
 */
export function createScorer(config: ScoringConfig): {
  compute: (inputs: ScoringInputs) => ConfidenceScorecard;
} {
  validateConfig(config);

  return {
    compute: (inputs: ScoringInputs) => computeConfidence(inputs, config),
  };
}

/** Scales a dimension's raw score to its active weight. */
function scaleDim(raw: number, nativeMax: number, activeWeight: number): number {
  if (nativeMax <= 0) return 0;
  return (raw / nativeMax) * activeWeight;
}

/** Merges caller-supplied ActionPolicy with defaults. */
function resolveActionPolicy(config: ScoringConfig): ResolvedActionPolicy {
  const p: ActionPolicy = config.actionPolicy ?? {};
  return {
    answerAt: p.answerAt ?? DEFAULT_ACTION_POLICY.answerAt,
    reviewAt: p.reviewAt ?? DEFAULT_ACTION_POLICY.reviewAt,
    abstainBelow: p.abstainBelow ?? DEFAULT_ACTION_POLICY.abstainBelow,
    requireTier1AtLeast: p.requireTier1AtLeast ?? DEFAULT_ACTION_POLICY.requireTier1AtLeast,
    reviewOnWarnings: p.reviewOnWarnings ?? DEFAULT_ACTION_POLICY.reviewOnWarnings,
    abstainOnWarnings: p.abstainOnWarnings ?? DEFAULT_ACTION_POLICY.abstainOnWarnings,
  };
}

function resolveSignalPolicy(config: ScoringConfig): ResolvedSignalPolicy {
  const preset = config.preset ?? 'balanced-v0.3';
  const presetPolicy = signalPolicyForPreset(preset);
  const callerPolicy: SignalPolicy | undefined = config.signalPolicy;

  return {
    require: uniqueSignals([...presetPolicy.require, ...(callerPolicy?.require ?? [])]),
    reviewWhenMissing: uniqueSignals([
      ...presetPolicy.reviewWhenMissing,
      ...(callerPolicy?.reviewWhenMissing ?? []),
    ]),
    abstainWhenMissing: uniqueSignals([
      ...presetPolicy.abstainWhenMissing,
      ...(callerPolicy?.abstainWhenMissing ?? []),
    ]),
    ...(callerPolicy?.minCitationCoverageScore !== undefined && {
      minCitationCoverageScore: callerPolicy.minCitationCoverageScore,
    }),
    ...(callerPolicy?.maxInvalidCitationCount !== undefined && {
      maxInvalidCitationCount: callerPolicy.maxInvalidCitationCount,
    }),
    requireSupportEvaluator: presetPolicy.requireSupportEvaluator,
  };
}

function signalPolicyForPreset(preset: ScoringConfig['preset']): ResolvedSignalPolicy {
  if (preset === 'production-v0.3') {
    return {
      require: ['answerRelevanceScore', 'conflictSignal'],
      reviewWhenMissing: ['answerRelevanceScore', 'conflictSignal'],
      abstainWhenMissing: [],
      requireSupportEvaluator: true,
    };
  }

  return {
    require: [],
    reviewWhenMissing: [],
    abstainWhenMissing: [],
    requireSupportEvaluator: false,
  };
}

function collectSignalPolicyWarnings(
  inputs: ScoringInputs,
  config: ScoringConfig,
): SignalPolicyResult {
  const policy = resolveSignalPolicy(config);
  const warnings: ConfidenceWarning[] = [];
  const reviewMissingSignals: SignalName[] = [];
  const abstainMissingSignals: SignalName[] = [];

  for (const signal of policy.require) {
    if (!isSignalMissing(signal, inputs)) continue;

    warnings.push(
      createWarning(
        'required-signal-missing',
        `Required signal '${signal}' was not provided.`,
        signal,
      ),
    );

    if (policy.reviewWhenMissing.includes(signal)) reviewMissingSignals.push(signal);
    if (policy.abstainWhenMissing.includes(signal)) abstainMissingSignals.push(signal);
  }

  if (
    policy.requireSupportEvaluator &&
    inputs.faithfulnessScore === undefined &&
    inputs.claimSupport === undefined
  ) {
    warnings.push(
      createWarning(
        'required-signal-missing',
        'Production preset requires faithfulnessScore or claimSupport.',
        'faithfulnessScore',
      ),
    );
    reviewMissingSignals.push('faithfulnessScore');
  }

  if (
    policy.minCitationCoverageScore !== undefined &&
    inputs.citationCoverageScore !== undefined &&
    inputs.citationCoverageScore < policy.minCitationCoverageScore
  ) {
    warnings.push(
      createWarning(
        'citation-quality-floor',
        `citationCoverageScore is below the configured floor (${policy.minCitationCoverageScore}).`,
        'citationCoverageScore',
      ),
    );
  }

  if (
    policy.maxInvalidCitationCount !== undefined &&
    (inputs.invalidCitationCount ?? 0) > policy.maxInvalidCitationCount
  ) {
    warnings.push(
      createWarning(
        'citation-quality-floor',
        `invalidCitationCount exceeds the configured maximum (${policy.maxInvalidCitationCount}).`,
        'invalidCitationCount',
      ),
    );
  }

  return {
    warnings,
    reviewMissingSignals: uniqueSignals(reviewMissingSignals),
    abstainMissingSignals: uniqueSignals(abstainMissingSignals),
  };
}

function isSignalMissing(signal: SignalName, inputs: ScoringInputs): boolean {
  if (signal === 'answerRelevanceScore') return inputs.answerRelevanceScore === undefined;
  if (signal === 'faithfulnessScore') return inputs.faithfulnessScore === undefined;
  if (signal === 'claimSupport') return inputs.claimSupport === undefined;
  if (signal === 'citationCoverageScore') return inputs.citationCoverageScore === undefined;
  if (signal === 'invalidCitationCount') return inputs.invalidCitationCount === undefined;
  if (signal === 'citationCount') return inputs.citationCount === undefined;
  if (signal === 'conflictSignal') {
    return inputs.hasConflict === undefined && inputs.conflictingCandidateCount === undefined;
  }
  if (signal === 'freshnessDates') {
    return !inputs.candidates.some((candidate) => candidate.lastUpdated instanceof Date);
  }
  if (signal === 'corpusTypes') {
    return inputs.corpusTypeCount === undefined && inputs.presentTypes === undefined;
  }
  if (signal === 'authorityRanks') {
    return !inputs.candidates.some(
      (candidate) => candidate.authorityRank !== undefined || candidate.documentType !== undefined,
    );
  }
  if (signal === 'contentHashes') {
    return !inputs.candidates.some((candidate) => candidate.contentHash !== undefined);
  }
  if (signal === 'candidateRanks') {
    return !inputs.candidates.some((candidate) => candidate.rank !== undefined);
  }
  return inputs.indexIntegrity === undefined;
}

function uniqueSignals(signals: SignalName[]): SignalName[] {
  return [...new Set(signals)];
}

/**
 * Derives the recommended action using the 8-rule cascade policy.
 * Returns both the action and the reason string identifying the first rule triggered.
 */
function deriveRecommendedAction(ctx: {
  total: number;
  documentsSilent: boolean;
  tier1Score: number;
  warningCodes: ConfidenceWarningCode[];
  reviewMissingSignals: SignalName[];
  abstainMissingSignals: SignalName[];
  policy: ResolvedActionPolicy;
}): { action: RecommendedAction; reason: string } {
  const {
    total,
    documentsSilent,
    tier1Score,
    warningCodes,
    reviewMissingSignals,
    abstainMissingSignals,
    policy,
  } = ctx;

  // Rule 1: documentsSilent overrides everything
  if (documentsSilent) {
    return {
      action: 'abstain',
      reason: 'Documents do not address this question (documentsSilent is true).',
    };
  }

  // Rule 1b: required signal policy can force abstain
  if (abstainMissingSignals.length > 0) {
    return {
      action: 'abstain',
      reason: `Required signal(s) missing matched abstainWhenMissing policy: ${abstainMissingSignals.join(', ')}.`,
    };
  }

  // Rule 2: warning codes that force abstain
  const abstainCode = warningCodes.find((c) => policy.abstainOnWarnings.includes(c));
  if (abstainCode) {
    return {
      action: 'abstain',
      reason: `Warning '${abstainCode}' matched abstainOnWarnings policy.`,
    };
  }

  // Rule 3: total below hard floor
  if (total < policy.abstainBelow) {
    return {
      action: 'abstain',
      reason: `Score ${total} is below abstainBelow threshold (${policy.abstainBelow}).`,
    };
  }

  // Rule 4: tier 1 quality floor
  if (tier1Score < policy.requireTier1AtLeast) {
    return {
      action: 'review',
      reason: `Tier 1 score ${tier1Score} is below requireTier1AtLeast threshold (${policy.requireTier1AtLeast}).`,
    };
  }

  // Rule 4b: required signal policy can force review
  if (reviewMissingSignals.length > 0) {
    return {
      action: 'review',
      reason: `Required signal(s) missing matched reviewWhenMissing policy: ${reviewMissingSignals.join(', ')}.`,
    };
  }

  // Rule 5: warning codes that force review
  const reviewCode = warningCodes.find((c) => policy.reviewOnWarnings.includes(c));
  if (reviewCode) {
    return {
      action: 'review',
      reason: `Warning '${reviewCode}' matched reviewOnWarnings policy.`,
    };
  }

  // Rule 6: high-confidence answer
  if (total >= policy.answerAt) {
    return {
      action: 'answer',
      reason: `Score ${total} meets answerAt threshold (${policy.answerAt}).`,
    };
  }

  // Rule 7: review band
  if (total >= policy.reviewAt) {
    return {
      action: 'review',
      reason: `Score ${total} meets reviewAt threshold (${policy.reviewAt}).`,
    };
  }

  // Rule 8: fallback abstain
  return {
    action: 'abstain',
    reason: `Score ${total} is below reviewAt threshold (${policy.reviewAt}) — abstaining.`,
  };
}
