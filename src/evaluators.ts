import type {
  ClaimSupport,
  EvaluationSignalMergeResult,
  ExternalEvaluationSignals,
  ScoringInputs,
} from './types.js';

export function mergeEvaluationSignals(
  inputs: ScoringInputs,
  signals: ExternalEvaluationSignals,
): EvaluationSignalMergeResult {
  const merged: ScoringInputs = {
    ...inputs,
    candidates: [...inputs.candidates],
  };

  if (merged.faithfulnessScore === undefined && signals.faithfulnessScore !== undefined) {
    merged.faithfulnessScore = signals.faithfulnessScore;
  }
  if (merged.answerRelevanceScore === undefined && signals.answerRelevanceScore !== undefined) {
    merged.answerRelevanceScore = signals.answerRelevanceScore;
  }
  if (merged.claimSupport === undefined && signals.claimSupport !== undefined) {
    merged.claimSupport = signals.claimSupport;
  }
  if (merged.citationCoverageScore === undefined && signals.citationCoverageScore !== undefined) {
    merged.citationCoverageScore = signals.citationCoverageScore;
  }
  if (merged.invalidCitationCount === undefined && signals.invalidCitationCount !== undefined) {
    merged.invalidCitationCount = signals.invalidCitationCount;
  }
  if (merged.citationCount === undefined && signals.citationCount !== undefined) {
    merged.citationCount = signals.citationCount;
  }
  if (merged.hasConflict === undefined && signals.hasConflict !== undefined) {
    merged.hasConflict = signals.hasConflict;
  }
  if (
    merged.conflictingCandidateCount === undefined &&
    signals.conflictingCandidateCount !== undefined
  ) {
    merged.conflictingCandidateCount = signals.conflictingCandidateCount;
  }

  return {
    inputs: merged,
    warnings: [],
  };
}

export function fromRagasLike(result: Record<string, unknown>): ExternalEvaluationSignals {
  const signals: ExternalEvaluationSignals = {};
  const faithfulnessScore = getNumber(result, 'faithfulness');
  const answerRelevanceScore =
    getNumber(result, 'answer_relevancy') ?? getNumber(result, 'answerRelevance');

  if (faithfulnessScore !== undefined) signals.faithfulnessScore = faithfulnessScore;
  if (answerRelevanceScore !== undefined) signals.answerRelevanceScore = answerRelevanceScore;
  return signals;
}

export function fromDeepEvalLike(result: Record<string, unknown>): ExternalEvaluationSignals {
  const signals: ExternalEvaluationSignals = {};
  const faithfulnessScore = getNumber(result, 'faithfulnessScore');
  const answerRelevanceScore = getNumber(result, 'answerRelevancyScore');
  const metric = getString(result, 'metric')?.toLowerCase();
  const score = getNumber(result, 'score');

  if (faithfulnessScore !== undefined) signals.faithfulnessScore = faithfulnessScore;
  if (answerRelevanceScore !== undefined) signals.answerRelevanceScore = answerRelevanceScore;
  if (signals.faithfulnessScore === undefined && metric === 'faithfulness' && score !== undefined) {
    signals.faithfulnessScore = score;
  }
  return signals;
}

export function fromTruLensLike(result: Record<string, unknown>): ExternalEvaluationSignals {
  const signals: ExternalEvaluationSignals = {};
  const faithfulnessScore = getNumber(result, 'groundedness');
  const answerRelevanceScore = getNumber(result, 'answer_relevance');

  if (faithfulnessScore !== undefined) signals.faithfulnessScore = faithfulnessScore;
  if (answerRelevanceScore !== undefined) signals.answerRelevanceScore = answerRelevanceScore;
  return signals;
}

export function fromCustomJudge(result: Record<string, unknown>): ExternalEvaluationSignals {
  const signals: ExternalEvaluationSignals = {};
  const faithfulnessScore = getNumber(result, 'faithfulnessScore');
  const answerRelevanceScore = getNumber(result, 'answerRelevanceScore');
  const citationCoverageScore = getNumber(result, 'citationCoverageScore');
  const invalidCitationCount = getNumber(result, 'invalidCitationCount');
  const citationCount = getNumber(result, 'citationCount');
  const hasConflict = getBoolean(result, 'hasConflict');
  const conflictingCandidateCount = getNumber(result, 'conflictingCandidateCount');
  const claimSupport = getClaimSupport(result);

  if (faithfulnessScore !== undefined) signals.faithfulnessScore = faithfulnessScore;
  if (answerRelevanceScore !== undefined) signals.answerRelevanceScore = answerRelevanceScore;
  if (claimSupport !== undefined) signals.claimSupport = claimSupport;
  if (citationCoverageScore !== undefined) signals.citationCoverageScore = citationCoverageScore;
  if (invalidCitationCount !== undefined) signals.invalidCitationCount = invalidCitationCount;
  if (citationCount !== undefined) signals.citationCount = citationCount;
  if (hasConflict !== undefined) signals.hasConflict = hasConflict;
  if (conflictingCandidateCount !== undefined) {
    signals.conflictingCandidateCount = conflictingCandidateCount;
  }

  return signals;
}

function getNumber(result: Record<string, unknown>, key: string): number | undefined {
  const value = result[key];
  return typeof value === 'number' ? value : undefined;
}

function getString(result: Record<string, unknown>, key: string): string | undefined {
  const value = result[key];
  return typeof value === 'string' ? value : undefined;
}

function getBoolean(result: Record<string, unknown>, key: string): boolean | undefined {
  const value = result[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getClaimSupport(result: Record<string, unknown>): ClaimSupport | undefined {
  const totalClaims = getNumber(result, 'totalClaims');
  const supportedClaims = getNumber(result, 'supportedClaims');
  if (totalClaims === undefined || supportedClaims === undefined) return undefined;

  const unsupportedClaims = getNumber(result, 'unsupportedClaims');
  const contradictedClaims = getNumber(result, 'contradictedClaims');

  return {
    totalClaims,
    supportedClaims,
    ...(unsupportedClaims !== undefined && { unsupportedClaims }),
    ...(contradictedClaims !== undefined && { contradictedClaims }),
  };
}
