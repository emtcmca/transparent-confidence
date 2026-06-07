import type {
  ConfidenceWarning,
  DimensionBreakdown,
  DimensionScore,
  ScoringInputs,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 10;

/**
 * Dimension 3 — Evidence Consistency (max 10 raw pts)
 *
 * Two sub-signals summed, capped at [0, 10]:
 *   A. Score stability (0–6): how tightly clustered are the candidate scores?
 *      Tight clustering = consistent retrieval signal.
 *   B. Conflict signal (0–4): explicit evidence conflict status.
 *      Explicit no-conflict is rewarded. Missing conflict signal is neutral-ish but flagged.
 *      Missing signal is NOT treated as confirmed agreement.
 *
 * Max 10: std dev < 0.10 (6) + explicit no-conflict (4) = 10.
 */
export function scoreConsistency(inputs: ScoringInputs): DimensionScore {
  const { candidates } = inputs;
  const warnings: ConfidenceWarning[] = [];
  const parts: string[] = [];

  if (candidates.length === 0) {
    const breakdown: DimensionBreakdown = {
      components: { scoreStability: 0, conflictStatus: 0 },
      adjustments: {},
      diagnostics: { candidateCount: 0 },
      uncappedRaw: 0,
      raw: 0,
    };
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'No candidates retrieved — evidence consistency cannot be evaluated.',
      breakdown,
      warnings: [],
    };
  }

  // ── Sub-signal A: Score stability (0–6) ─────────────────────
  let stabilityPts: number;
  let computedStdDev = 0;

  if (candidates.length === 1) {
    stabilityPts = 3;
    parts.push('Single candidate retrieved — stability unmeasurable, neutral score assigned.');
  } else {
    const scores = candidates.map((c) => c.combinedScore);
    computedStdDev = stdDev(scores);

    if (computedStdDev < 0.1) {
      stabilityPts = 6;
      parts.push(`Score std dev ${computedStdDev.toFixed(3)} — very tight retrieval stability.`);
    } else if (computedStdDev < 0.2) {
      stabilityPts = 5;
      parts.push(`Score std dev ${computedStdDev.toFixed(3)} — good retrieval stability.`);
    } else if (computedStdDev < 0.3) {
      stabilityPts = 3;
      parts.push(`Score std dev ${computedStdDev.toFixed(3)} — moderate retrieval stability.`);
    } else {
      stabilityPts = 1;
      parts.push(`Score std dev ${computedStdDev.toFixed(3)} — scattered retrieval scores.`);
    }
  }

  // ── Sub-signal B: Conflict signal (0–4) ─────────────────────
  // conflictingCandidateCount takes precedence over boolean hasConflict.
  // Missing conflict signal is not treated as agreement — it earns 2 pts + warning.
  let conflictPts: number;
  const hasCount = inputs.conflictingCandidateCount !== undefined;
  const hasBool = inputs.hasConflict !== undefined;

  if (hasCount) {
    if (inputs.conflictingCandidateCount === 0) {
      conflictPts = 4;
      parts.push('Explicit no-conflict signal provided (+4).');
    } else if (inputs.conflictingCandidateCount === 1) {
      conflictPts = 1;
      parts.push('1 conflicting candidate detected (+1).');
    } else {
      conflictPts = 0;
      parts.push(`${inputs.conflictingCandidateCount} conflicting candidates detected (+0).`);
    }
  } else if (hasBool) {
    if (inputs.hasConflict === false) {
      conflictPts = 4;
      parts.push('Explicit no-conflict signal provided (+4).');
    } else {
      conflictPts = 0;
      parts.push('Conflict detected across candidates (+0).');
    }
  } else {
    conflictPts = 2;
    parts.push('No conflict signal provided — treating as neutral (+2).');
    warnings.push(
      createWarning(
        'missing-conflict-signal',
        'No conflict signal was provided (hasConflict or conflictingCandidateCount). Score is conservative.',
        'hasConflict',
      ),
    );
  }

  const uncappedRaw = stabilityPts + conflictPts;
  const raw = Math.max(0, Math.min(MAX, uncappedRaw));

  const breakdown: DimensionBreakdown = {
    components: {
      scoreStability: stabilityPts,
      conflictStatus: conflictPts,
    },
    adjustments: raw < uncappedRaw ? { cap: raw - uncappedRaw } : {},
    diagnostics: {
      candidateCount: candidates.length,
      scoreStdDev: Number(computedStdDev.toFixed(4)),
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

/** Population standard deviation. */
function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}
