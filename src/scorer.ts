import { scoreAuthority } from './dimensions/authority.js';
import { scoreConsistency } from './dimensions/consistency.js';
import { scoreCorpus } from './dimensions/corpus.js';
import { scoreFreshness } from './dimensions/freshness.js';
import { scoreGrounding } from './dimensions/grounding.js';
import { scoreRelevance } from './dimensions/relevance.js';
import { scoreRetrieval } from './dimensions/retrieval.js';
import { deriveLabel, deriveTier1, deriveTier2 } from './labels.js';
import { normalize } from './normalize.js';
import type { ConfidenceScorecard, DimensionName, ScoringConfig, ScoringInputs } from './types.js';
import { collectInputWarnings, enforceInputValidation, validateConfig } from './validation.js';
import { missingSignalsForWarnings, uniqueWarnings } from './warnings.js';

const CORE_MAX = 65; // grounding(30) + retrieval(25) + consistency(10)
const RELEVANCE_MAX = 15;
const AUTHORITY_MAX = 20;
const CORPUS_MAX = 15;
const FRESHNESS_MAX = 15;

export const ALGORITHM_VERSION = '0.2.0';
export const SCORECARD_SCHEMA_VERSION = '0.2';

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

  const grounding = scoreGrounding(inputs);
  const retrieval = scoreRetrieval(inputs, config);
  const consistency = scoreConsistency(inputs);
  const relevance = hasRelevance ? scoreRelevance(inputs.answerRelevanceScore, config) : undefined;
  const authority = hasAuthority ? scoreAuthority(inputs, config) : undefined;
  const corpus = hasCorpus ? scoreCorpus(inputs, config) : undefined;
  const freshness = hasFreshness ? scoreFreshness(inputs, config) : undefined;

  const activeExtensions: string[] = [];
  if (hasRelevance) activeExtensions.push('relevance');
  if (hasAuthority) activeExtensions.push('authority');
  if (hasCorpus) activeExtensions.push('corpus');
  if (hasFreshness) activeExtensions.push('freshness');

  const activeDimensions: DimensionName[] = ['grounding', 'retrieval', 'consistency'];
  if (hasRelevance) activeDimensions.push('relevance');
  if (hasAuthority) activeDimensions.push('authority');
  if (hasCorpus) activeDimensions.push('corpus');
  if (hasFreshness) activeDimensions.push('freshness');

  const maxPossible =
    CORE_MAX +
    (hasRelevance ? RELEVANCE_MAX : 0) +
    (hasAuthority ? AUTHORITY_MAX : 0) +
    (hasCorpus ? CORPUS_MAX : 0) +
    (hasFreshness ? FRESHNESS_MAX : 0);

  const rawTotal =
    grounding.raw +
    retrieval.raw +
    consistency.raw +
    (relevance?.raw ?? 0) +
    (authority?.raw ?? 0) +
    (corpus?.raw ?? 0) +
    (freshness?.raw ?? 0);

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
  ]);

  // Tier 1: grounding + retrieval + consistency + relevance (when active) + authority (when active)
  const tier1Raw =
    grounding.raw + retrieval.raw + consistency.raw + (relevance?.raw ?? 0) + (authority?.raw ?? 0);
  const tier1Max =
    CORE_MAX + (hasRelevance ? RELEVANCE_MAX : 0) + (hasAuthority ? AUTHORITY_MAX : 0);
  const tier1 = deriveTier1(tier1Raw, tier1Max, inputs.documentsSilent === true);

  // Tier 2: corpus + freshness — null when neither extension is active
  const tier2Max = (hasCorpus ? CORPUS_MAX : 0) + (hasFreshness ? FRESHNESS_MAX : 0);
  const tier2Raw = (corpus?.raw ?? 0) + (freshness?.raw ?? 0);
  const tier2 = deriveTier2(tier2Raw, tier2Max);

  return {
    total,
    label,
    labelColor,
    recommendedAction: deriveRecommendedAction(total, inputs.documentsSilent === true),
    actionReason:
      inputs.documentsSilent === true
        ? 'documentsSilent is true.'
        : `Composite score ${total} maps to ${label}.`,
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
      weights: {
        grounding: 30,
        retrieval: 25,
        consistency: 10,
        ...(hasRelevance && { relevance: RELEVANCE_MAX }),
        ...(hasAuthority && { authority: AUTHORITY_MAX }),
        ...(hasCorpus && { corpus: CORPUS_MAX }),
        ...(hasFreshness && { freshness: FRESHNESS_MAX }),
      },
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

function deriveRecommendedAction(
  total: number,
  documentsSilent: boolean,
): 'answer' | 'review' | 'abstain' {
  if (documentsSilent) return 'abstain';
  if (total >= 65) return 'answer';
  if (total >= 40) return 'review';
  return 'abstain';
}
