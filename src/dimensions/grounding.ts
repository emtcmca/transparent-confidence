import type { ClaimSupport, DimensionScore, ScoringInputs } from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 30;

const COMPLEXITY_CEILINGS: Record<NonNullable<ScoringInputs['queryComplexity']>, number> = {
  direct: 30,
  inferential: 24,
  'multi-hop': 18,
  comparative: 16,
};

type ResolvedClaimSupport = {
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims: number;
  contradictedClaims: number;
  score: number;
};

/**
 * Dimension 1 - Answer Grounding (max 30 raw pts)
 *
 * Measures how directly and faithfully the source text supports the answer.
 * Phase 4 adds claim support, citation quality, dimension warnings, and a
 * structured breakdown while preserving the existing support-level base scores.
 */
export function scoreGrounding(inputs: ScoringInputs): DimensionScore {
  const warnings: DimensionScore['warnings'] = [];

  if (inputs.documentsSilent === true) {
    const raw = 0;
    warnings.push(
      createWarning(
        'documents-silent',
        'Source documents do not address this question.',
        'documentsSilent',
      ),
    );
    return {
      raw,
      max: MAX,
      normalized: 0,
      explanation: 'Source documents do not address this question.',
      breakdown: {
        components: { supportBase: 0 },
        adjustments: {},
        diagnostics: { documentsSilent: true },
        uncappedRaw: 0,
        raw,
      },
      warnings,
    };
  }

  const parts: string[] = [];
  const components: Record<string, number> = {};
  const adjustments: Record<string, number> = {};
  const diagnostics: Record<string, number | string | boolean> = {};

  let score = supportBase(inputs, parts);
  components.supportBase = score;

  if (inputs.requiresExpertReview === true) {
    adjustments.expertReviewPenalty = -3;
    score += adjustments.expertReviewPenalty;
    parts.push('Expert review recommended before acting on this answer (-3).');
  }

  if (inputs.externalConstraintNote) {
    adjustments.externalConstraintPenalty = -2;
    score += adjustments.externalConstraintPenalty;
    diagnostics.externalConstraintPresent = true;
    parts.push(
      `External constraint may affect this answer: ${inputs.externalConstraintNote} (-2).`,
    );
  }

  if (inputs.hasConflict === true) {
    adjustments.conflictPenalty = -5;
    score += adjustments.conflictPenalty;
    parts.push('Conflicting information detected across retrieved sections (-5).');
  }

  if (inputs.queryComplexity && inputs.queryComplexity !== 'direct') {
    const ceiling = COMPLEXITY_CEILINGS[inputs.queryComplexity];
    diagnostics.queryComplexity = inputs.queryComplexity;
    diagnostics.complexityCeiling = ceiling;
    if (score > ceiling) {
      adjustments.complexityCeiling = ceiling - score;
      score = ceiling;
      parts.push(`Score capped at ${ceiling} for ${inputs.queryComplexity} question type.`);
    }
  }

  const claimSupport = resolveClaimSupport(inputs.claimSupport);
  const claimSupportScore = claimSupport?.score;
  if (claimSupport !== undefined) {
    diagnostics.totalClaims = claimSupport.totalClaims;
    diagnostics.supportedClaims = claimSupport.supportedClaims;
    diagnostics.unsupportedClaims = claimSupport.unsupportedClaims;
    diagnostics.contradictedClaims = claimSupport.contradictedClaims;
    diagnostics.claimSupportScore = round(claimSupport.score, 4);
  }

  if (inputs.faithfulnessScore !== undefined) {
    diagnostics.faithfulnessScore = inputs.faithfulnessScore;
  }

  const effectiveSupportScore =
    inputs.faithfulnessScore !== undefined && claimSupportScore !== undefined
      ? Math.min(inputs.faithfulnessScore, claimSupportScore)
      : (inputs.faithfulnessScore ?? claimSupportScore);

  if (effectiveSupportScore === undefined) {
    warnings.push(
      createWarning(
        'missing-faithfulness',
        'No faithfulnessScore or claimSupport signal was provided.',
        'faithfulnessScore',
      ),
    );
  } else {
    diagnostics.effectiveSupportScore = round(effectiveSupportScore, 4);
    const supportPenalty = supportSignalPenalty(effectiveSupportScore);
    if (supportPenalty !== 0) {
      adjustments.supportSignalPenalty = supportPenalty;
      score += supportPenalty;
      parts.push(
        `Effective support score ${effectiveSupportScore.toFixed(2)} applies grounding penalty (${supportPenalty}).`,
      );
    }
  }

  if ((claimSupport?.contradictedClaims ?? 0) >= 1) {
    adjustments.contradictionPenalty = -5;
    score += adjustments.contradictionPenalty;
    parts.push(`${claimSupport?.contradictedClaims} contradicted claim(s) detected (-5).`);
  }

  const invalidCitationCount = inputs.invalidCitationCount ?? 0;
  diagnostics.invalidCitationCount = invalidCitationCount;
  let citationBonusAllowed = true;

  if (invalidCitationCount === 1) {
    adjustments.invalidCitationPenalty = -2;
    score += adjustments.invalidCitationPenalty;
    citationBonusAllowed = false;
    warnings.push(
      createWarning(
        'invalid-citations',
        'One invalid citation was reported.',
        'invalidCitationCount',
      ),
    );
    parts.push('One invalid citation reported (-2); citation bonus suppressed.');
  } else if (invalidCitationCount >= 2) {
    adjustments.invalidCitationPenalty = -5;
    score += adjustments.invalidCitationPenalty;
    citationBonusAllowed = false;
    warnings.push(
      createWarning(
        'invalid-citations',
        'Multiple invalid citations were reported.',
        'invalidCitationCount',
      ),
    );
    parts.push('Multiple invalid citations reported (-5); citation bonus suppressed.');
  }

  if (inputs.citationCoverageScore !== undefined) {
    diagnostics.citationCoverageScore = inputs.citationCoverageScore;
    if (inputs.citationCoverageScore < 0.5) {
      adjustments.citationCoveragePenalty = -3;
      score += adjustments.citationCoveragePenalty;
      warnings.push(
        createWarning(
          'low-citation-coverage',
          'Citation coverage is below 0.50.',
          'citationCoverageScore',
        ),
      );
      parts.push('Citation coverage below 0.50 (-3).');
    } else if (inputs.citationCoverageScore < 0.8) {
      adjustments.citationCoveragePenalty = -1;
      score += adjustments.citationCoveragePenalty;
      parts.push('Citation coverage below 0.80 (-1).');
    }
  }

  if (inputs.citationCount !== undefined) {
    diagnostics.citationCount = inputs.citationCount;
  }

  if (citationBonusAllowed && inputs.citationCount !== undefined && inputs.citationCount > 0) {
    const bonus = inputs.citationCount >= 3 ? 2 : inputs.citationCount === 2 ? 1 : 0;
    if (bonus > 0) {
      adjustments.citationBonus = bonus;
      score += bonus;
      parts.push(`${inputs.citationCount} sections explicitly cited in answer (+${bonus}).`);
    }
  }

  const uncappedRaw = score;
  const raw = Math.max(0, Math.min(MAX, score));

  if (raw !== uncappedRaw) {
    adjustments.clamp = raw - uncappedRaw;
  }

  return {
    raw,
    max: MAX,
    normalized: normalize(raw, MAX),
    explanation: parts.join(' '),
    breakdown: {
      components,
      adjustments,
      diagnostics,
      uncappedRaw,
      raw,
    },
    ...(warnings.length > 0 && { warnings }),
  };
}

function supportBase(inputs: ScoringInputs, parts: string[]): number {
  if (inputs.supportLevel === 'high' && !inputs.ambiguityNotes) {
    parts.push('Source text directly and unambiguously answers the question.');
    return 30;
  }

  if (inputs.supportLevel === 'high') {
    parts.push(
      `Source text addresses the question but contains ambiguity: ${inputs.ambiguityNotes}`,
    );
    return 21;
  }

  if (inputs.supportLevel === 'medium') {
    if (inputs.ambiguityNotes) {
      parts.push(
        `Answer is inferrable from source text but not explicit. Ambiguity: ${inputs.ambiguityNotes}`,
      );
    } else {
      parts.push('Answer is inferrable from source text but not explicitly stated.');
    }
    return 13;
  }

  parts.push(
    'Source documents are insufficient, conflicting, or ambiguous on this question. Answer reflects best available inference.',
  );
  return 5;
}

function resolveClaimSupport(
  claimSupport: ClaimSupport | undefined,
): ResolvedClaimSupport | undefined {
  if (claimSupport === undefined || !claimSupportCountsAreValid(claimSupport)) {
    return undefined;
  }

  const contradictedClaims = claimSupport.contradictedClaims ?? 0;
  const unsupportedClaims =
    claimSupport.unsupportedClaims ??
    claimSupport.totalClaims - claimSupport.supportedClaims - contradictedClaims;

  return {
    totalClaims: claimSupport.totalClaims,
    supportedClaims: claimSupport.supportedClaims,
    unsupportedClaims,
    contradictedClaims,
    score: claimSupport.supportedClaims / claimSupport.totalClaims,
  };
}

function claimSupportCountsAreValid(claimSupport: ClaimSupport): boolean {
  const contradictedClaims = claimSupport.contradictedClaims ?? 0;
  const unsupportedClaims = claimSupport.unsupportedClaims;
  const counts = [
    claimSupport.totalClaims,
    claimSupport.supportedClaims,
    contradictedClaims,
    ...(unsupportedClaims !== undefined ? [unsupportedClaims] : []),
  ];

  if (!counts.every((count) => Number.isInteger(count) && count >= 0)) return false;
  if (claimSupport.totalClaims <= 0) return false;
  if (claimSupport.supportedClaims + contradictedClaims > claimSupport.totalClaims) return false;
  if (
    unsupportedClaims !== undefined &&
    claimSupport.supportedClaims + unsupportedClaims + contradictedClaims > claimSupport.totalClaims
  ) {
    return false;
  }
  return true;
}

function supportSignalPenalty(score: number): number {
  if (score >= 0.9) return 0;
  if (score >= 0.7) return -3;
  if (score >= 0.5) return -7;
  return -12;
}

function normalize(raw: number, max: number): number {
  return Math.round((raw / max) * 100);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
