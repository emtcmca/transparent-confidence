import type {
  ConfidenceWarning,
  DimensionBreakdown,
  DimensionScore,
  ScoringConfig,
  ScoringInputs,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 15;

/**
 * Extension B — Corpus Completeness (max 15 raw pts)
 *
 * v0.2: Named type arrays are preferred over raw counts when both
 * config.corpus.expectedTypes and inputs.presentTypes are supplied.
 * The scorer derives counts from arrays, resolves missingTypes, and
 * includes the gap list in breakdown.diagnostics.
 *
 * Count-only mode (corpusTypeCount + expectedTypeCount) is still
 * fully supported for callers who do not track named types.
 */
export function scoreCorpus(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const corpusConfig = config.corpus ?? {};
  const warnings: ConfidenceWarning[] = [];
  const parts: string[] = [];

  // ── Resolve effective counts ─────────────────────────────────

  let effectiveCorpusTypeCount: number | undefined;
  let effectiveExpectedTypeCount: number;
  let resolvedMissingTypes: string[] | undefined;

  const hasNamedTypes =
    corpusConfig.expectedTypes !== undefined && inputs.presentTypes !== undefined;

  if (hasNamedTypes) {
    const expected = corpusConfig.expectedTypes ?? [];
    const present = inputs.presentTypes ?? [];
    const missing = expected.filter((t) => !present.includes(t));
    effectiveCorpusTypeCount = present.length;
    effectiveExpectedTypeCount = expected.length;
    resolvedMissingTypes = missing;
  } else {
    effectiveCorpusTypeCount = inputs.corpusTypeCount;
    effectiveExpectedTypeCount =
      corpusConfig.expectedTypeCount ?? corpusConfig.expectedTypes?.length ?? 5;
    resolvedMissingTypes = inputs.missingTypes;
  }

  if (effectiveCorpusTypeCount === undefined) {
    warnings.push(
      createWarning(
        'missing-corpus-count',
        'corpusTypeCount not provided. Supply corpusTypeCount or presentTypes + config.corpus.expectedTypes to enable corpus scoring.',
        'corpusTypeCount',
      ),
    );
    const breakdown: DimensionBreakdown = {
      components: { base: 0 },
      adjustments: {},
      diagnostics: { effectiveExpectedTypeCount },
      uncappedRaw: 0,
      raw: 0,
    };
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation:
        'corpusTypeCount not provided. Supply the number of loaded document types to enable corpus scoring.',
      breakdown,
      warnings,
    };
  }

  // ── Base score by ratio ──────────────────────────────────────

  const ratio =
    Math.min(effectiveCorpusTypeCount, effectiveExpectedTypeCount) / effectiveExpectedTypeCount;

  let base: number;

  if (ratio >= 1.0) {
    base = 15;
    parts.push(`All ${effectiveExpectedTypeCount} expected document types present.`);
  } else if (ratio >= 0.8) {
    base = 12;
    parts.push(
      `${effectiveCorpusTypeCount} of ${effectiveExpectedTypeCount} expected document types present.`,
    );
  } else if (ratio >= 0.6) {
    base = 9;
    parts.push(
      `${effectiveCorpusTypeCount} of ${effectiveExpectedTypeCount} expected document types present.`,
    );
  } else if (ratio >= 0.4) {
    base = 5;
    parts.push(
      `${effectiveCorpusTypeCount} of ${effectiveExpectedTypeCount} expected document types present.`,
    );
  } else if (ratio >= 0.2) {
    base = 2;
    parts.push(
      `Only ${effectiveCorpusTypeCount} of ${effectiveExpectedTypeCount} expected document types present.`,
    );
  } else {
    base = 0;
    parts.push(
      `Corpus is empty or nearly empty (${effectiveCorpusTypeCount} of ${effectiveExpectedTypeCount} types).`,
    );
  }

  // ── Missing-type details ─────────────────────────────────────

  if (resolvedMissingTypes && resolvedMissingTypes.length > 0) {
    parts.push(`Missing types: ${resolvedMissingTypes.join(', ')}.`);
  }

  // ── Relevant-type penalty ────────────────────────────────────

  let score = base;

  if (inputs.missingRelevantType === true) {
    score = Math.max(0, score - 3);
    parts.push(
      'A document type directly relevant to this question appears to be missing — answer may be incomplete (−3).',
    );
  }

  const uncappedRaw = score;
  const raw = Math.max(0, Math.min(MAX, uncappedRaw));

  const breakdown: DimensionBreakdown = {
    components: { base },
    adjustments: inputs.missingRelevantType === true ? { missingRelevantTypePenalty: -3 } : {},
    diagnostics: {
      corpusTypeCount: effectiveCorpusTypeCount,
      expectedTypeCount: effectiveExpectedTypeCount,
      ratio: Math.round(ratio * 100) / 100,
      namedTypes: hasNamedTypes,
      ...(resolvedMissingTypes && resolvedMissingTypes.length > 0
        ? { missingTypes: resolvedMissingTypes.join(', ') }
        : {}),
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
