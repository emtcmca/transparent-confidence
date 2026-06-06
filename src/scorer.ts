import { scoreAuthority } from './dimensions/authority.js';
import { scoreConsistency } from './dimensions/consistency.js';
import { scoreCorpus } from './dimensions/corpus.js';
import { scoreFreshness } from './dimensions/freshness.js';
import { scoreGrounding } from './dimensions/grounding.js';
import { scoreRetrieval } from './dimensions/retrieval.js';
import { deriveLabel, deriveTier1, deriveTier2 } from './labels.js';
import { normalize } from './normalize.js';
import type { ConfidenceScorecard, ScoringConfig, ScoringInputs } from './types.js';

const CORE_MAX = 65; // grounding(30) + retrieval(25) + consistency(10)
const AUTHORITY_MAX = 20;
const CORPUS_MAX = 15;
const FRESHNESS_MAX = 15;

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
  const hasAuthority = config.authority !== undefined;
  const hasCorpus = config.corpus !== undefined;
  const hasFreshness = config.freshness !== undefined;

  const grounding = scoreGrounding(inputs);
  const retrieval = scoreRetrieval(inputs);
  const consistency = scoreConsistency(inputs);
  const authority = hasAuthority ? scoreAuthority(inputs, config) : undefined;
  const corpus = hasCorpus ? scoreCorpus(inputs, config) : undefined;
  const freshness = hasFreshness ? scoreFreshness(inputs, config) : undefined;

  const activeExtensions: string[] = [];
  if (hasAuthority) activeExtensions.push('authority');
  if (hasCorpus) activeExtensions.push('corpus');
  if (hasFreshness) activeExtensions.push('freshness');

  const maxPossible =
    CORE_MAX +
    (hasAuthority ? AUTHORITY_MAX : 0) +
    (hasCorpus ? CORPUS_MAX : 0) +
    (hasFreshness ? FRESHNESS_MAX : 0);

  const rawTotal =
    grounding.raw +
    retrieval.raw +
    consistency.raw +
    (authority?.raw ?? 0) +
    (corpus?.raw ?? 0) +
    (freshness?.raw ?? 0);

  const total = normalize(rawTotal, maxPossible);
  const { label, color: labelColor } = deriveLabel(total);

  // Tier 1: grounding + retrieval + consistency + authority
  const tier1Raw = grounding.raw + retrieval.raw + consistency.raw + (authority?.raw ?? 0);
  const tier1Max = CORE_MAX + (hasAuthority ? AUTHORITY_MAX : 0);
  const tier1 = deriveTier1(tier1Raw, tier1Max, inputs.documentsSilent === true);

  // Tier 2: corpus + freshness — null when neither extension is active
  const tier2Max = (hasCorpus ? CORPUS_MAX : 0) + (hasFreshness ? FRESHNESS_MAX : 0);
  const tier2Raw = (corpus?.raw ?? 0) + (freshness?.raw ?? 0);
  const tier2 = deriveTier2(tier2Raw, tier2Max);

  return {
    total,
    label,
    labelColor,
    tier1,
    tier2,
    dimensions: {
      grounding,
      retrieval,
      consistency,
      ...(authority !== undefined && { authority }),
      ...(corpus !== undefined && { corpus }),
      ...(freshness !== undefined && { freshness }),
    },
    meta: {
      rawTotal,
      maxPossible,
      activeExtensions,
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
  return {
    compute: (inputs: ScoringInputs) => computeConfidence(inputs, config),
  };
}
