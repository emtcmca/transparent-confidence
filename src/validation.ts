import type {
  ClaimSupport,
  ConfidenceWarning,
  RetrievalScoreBands,
  ScoringConfig,
  ScoringInputs,
} from './types.js';
import { createWarning } from './warnings.js';

const DEFAULT_RETRIEVAL_BANDS: RetrievalScoreBands = {
  full: 0.8,
  high: 0.65,
  medium: 0.5,
  low: 0.35,
};

const DEFAULT_RELEVANCE_BANDS: RetrievalScoreBands = {
  full: 0.9,
  high: 0.75,
  medium: 0.6,
  low: 0.4,
};

export function validateConfig(config: ScoringConfig): void {
  validateRetrievalConfig(config);
  validateRelevanceConfig(config);
  validateFreshnessConfig(config);
  validateCorpusConfig(config);
  validateWeights(config);
}

export function collectInputWarnings(
  inputs: ScoringInputs,
  config: ScoringConfig,
): ConfidenceWarning[] {
  const warnings: ConfidenceWarning[] = [];

  if (inputs.documentsSilent === true) {
    warnings.push(
      createWarning(
        'documents-silent',
        'Source documents do not address this question.',
        'documentsSilent',
      ),
    );
  }

  if (inputs.candidates.length === 0) {
    warnings.push(
      createWarning('missing-candidates', 'No retrieved candidates were provided.', 'candidates'),
    );
  }

  inputs.candidates.forEach((candidate, index) => {
    if (!isScore(candidate.combinedScore)) {
      warnings.push(
        createWarning(
          'input-out-of-range',
          'Candidate combinedScore should be a finite number in the 0-1 range.',
          `candidates[${index}].combinedScore`,
        ),
      );
    }

    for (const [method, score] of Object.entries(candidate.retrievalScores)) {
      if (!isScore(score)) {
        warnings.push(
          createWarning(
            'input-out-of-range',
            'Retrieval method scores should be finite numbers in the 0-1 range.',
            `candidates[${index}].retrievalScores.${method}`,
          ),
        );
      }
    }
  });

  if (inputs.claimSupport !== undefined) {
    const warning = claimSupportWarning(inputs.claimSupport);
    if (warning !== undefined) warnings.push(warning);
  }

  if (inputs.faithfulnessScore !== undefined && !isScore(inputs.faithfulnessScore)) {
    warnings.push(
      createWarning(
        'input-out-of-range',
        'faithfulnessScore should be a finite number in the 0-1 range.',
        'faithfulnessScore',
      ),
    );
  }

  if (inputs.citationCoverageScore !== undefined && !isScore(inputs.citationCoverageScore)) {
    warnings.push(
      createWarning(
        'input-out-of-range',
        'citationCoverageScore should be a finite number in the 0-1 range.',
        'citationCoverageScore',
      ),
    );
  }

  if (config.freshness !== undefined) {
    const hasFreshnessDates = inputs.candidates.some(
      (candidate) => candidate.lastUpdated instanceof Date,
    );
    if (!hasFreshnessDates) {
      warnings.push(
        createWarning(
          'missing-freshness-dates',
          'Freshness scoring is active, but no candidate has lastUpdated.',
          'candidates[].lastUpdated',
        ),
      );
    }
  }

  if (
    config.corpus !== undefined &&
    inputs.corpusTypeCount === undefined &&
    inputs.presentTypes === undefined
  ) {
    warnings.push(
      createWarning(
        'missing-corpus-count',
        'Corpus scoring is active, but no corpus type count or presentTypes were provided.',
        'corpusTypeCount',
      ),
    );
  }

  if (config.relevance?.required === true && inputs.answerRelevanceScore === undefined) {
    warnings.push(
      createWarning(
        'missing-answer-relevance',
        'Answer relevance scoring is required, but answerRelevanceScore was not provided.',
        'answerRelevanceScore',
      ),
    );
  }

  return warnings;
}

export function enforceInputValidation(warnings: ConfidenceWarning[], config: ScoringConfig): void {
  if (config.validation !== 'strict' || warnings.length === 0) return;

  const first = warnings[0];
  if (first === undefined) return;
  throw new Error(`${first.path ?? first.code}: ${first.message}`);
}

function validateRetrievalConfig(config: ScoringConfig): void {
  const retrieval = config.retrieval;
  if (retrieval === undefined) return;

  const bands = { ...DEFAULT_RETRIEVAL_BANDS, ...retrieval.scoreBands };
  assertBands('retrieval.scoreBands', bands);

  if (retrieval.topK !== undefined && (!Number.isInteger(retrieval.topK) || retrieval.topK < 1)) {
    throw new Error('retrieval.topK must be an integer >= 1.');
  }

  if (
    retrieval.minConfirmedMethods !== undefined &&
    (!Number.isInteger(retrieval.minConfirmedMethods) || retrieval.minConfirmedMethods < 1)
  ) {
    throw new Error('retrieval.minConfirmedMethods must be an integer >= 1.');
  }

  if (
    retrieval.defaultMethodThreshold !== undefined &&
    !Number.isFinite(retrieval.defaultMethodThreshold)
  ) {
    throw new Error('retrieval.defaultMethodThreshold must be finite.');
  }

  for (const [method, threshold] of Object.entries(retrieval.methodThresholds ?? {})) {
    if (!Number.isFinite(threshold)) {
      throw new Error(`retrieval.methodThresholds.${method} must be finite.`);
    }
  }
}

function validateRelevanceConfig(config: ScoringConfig): void {
  const relevance = config.relevance;
  if (relevance === undefined) return;

  const bands = { ...DEFAULT_RELEVANCE_BANDS, ...relevance.scoreBands };
  assertBands('relevance.scoreBands', bands);
}

function validateFreshnessConfig(config: ScoringConfig): void {
  const freshness = config.freshness;
  if (freshness === undefined) return;

  const maxAgeForFullScore = freshness.maxAgeForFullScore ?? 90;
  const penaltyPerMonth = freshness.penaltyPerMonth ?? 1.5;
  const hardCutoffAge = freshness.hardCutoffAge ?? 730;

  if (hardCutoffAge <= maxAgeForFullScore) {
    throw new Error('freshness.hardCutoffAge must be greater than freshness.maxAgeForFullScore.');
  }

  if (penaltyPerMonth < 0) {
    throw new Error('freshness.penaltyPerMonth must be >= 0.');
  }
}

function validateCorpusConfig(config: ScoringConfig): void {
  const corpus = config.corpus;
  if (corpus === undefined) return;

  if (corpus.expectedTypeCount === undefined && corpus.expectedTypes === undefined) {
    throw new Error('corpus requires expectedTypeCount or expectedTypes.');
  }

  if (
    corpus.expectedTypeCount !== undefined &&
    corpus.expectedTypes !== undefined &&
    corpus.expectedTypeCount !== corpus.expectedTypes.length
  ) {
    throw new Error('corpus.expectedTypeCount must match corpus.expectedTypes.length.');
  }

  if (
    corpus.expectedTypeCount !== undefined &&
    (!Number.isInteger(corpus.expectedTypeCount) || corpus.expectedTypeCount < 1)
  ) {
    throw new Error('corpus.expectedTypeCount must be an integer >= 1.');
  }
}

function validateWeights(config: ScoringConfig): void {
  for (const [dimension, weight] of Object.entries(config.weights ?? {})) {
    if (weight === undefined) continue;
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`weights.${dimension} must be a positive finite number.`);
    }
  }
}

function assertBands(name: string, bands: RetrievalScoreBands): void {
  for (const [key, value] of Object.entries(bands)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name}.${key} must be finite.`);
    }
  }

  if (!(bands.full >= bands.high && bands.high >= bands.medium && bands.medium >= bands.low)) {
    throw new Error(`${name} must satisfy full >= high >= medium >= low.`);
  }
}

function isScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function claimSupportWarning(claimSupport: ClaimSupport): ConfidenceWarning | undefined {
  const contradictedClaims = claimSupport.contradictedClaims ?? 0;
  const unsupportedClaims = claimSupport.unsupportedClaims;
  const counts = [
    claimSupport.totalClaims,
    claimSupport.supportedClaims,
    contradictedClaims,
    ...(unsupportedClaims !== undefined ? [unsupportedClaims] : []),
  ];

  if (!counts.every((count) => Number.isInteger(count) && count >= 0)) {
    return createWarning(
      'input-out-of-range',
      'Claim support counts should be finite non-negative integers.',
      'claimSupport',
    );
  }

  if (claimSupport.totalClaims <= 0) {
    return createWarning(
      'input-out-of-range',
      'claimSupport.totalClaims must be greater than 0.',
      'claimSupport',
    );
  }

  if (claimSupport.supportedClaims + contradictedClaims > claimSupport.totalClaims) {
    return createWarning(
      'input-out-of-range',
      'claimSupport supportedClaims + contradictedClaims cannot exceed totalClaims.',
      'claimSupport',
    );
  }

  if (
    unsupportedClaims !== undefined &&
    claimSupport.supportedClaims + unsupportedClaims + contradictedClaims > claimSupport.totalClaims
  ) {
    return createWarning(
      'input-out-of-range',
      'claimSupport supportedClaims + unsupportedClaims + contradictedClaims cannot exceed totalClaims.',
      'claimSupport',
    );
  }

  return undefined;
}
