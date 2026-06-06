import type { DimensionScore, ScoringInputs } from '../types.js';

const MAX = 10;

/**
 * Dimension 3 — Evidence Consistency (max 10 raw pts)
 *
 * Two sub-signals:
 *   A. Score variance (0–8): how tightly clustered are the candidate scores?
 *      Tight clustering = consistent retrieval = higher confidence.
 *   B. Conflict status (0–+2 or −2): are the candidates in agreement?
 *      No conflict = +2 bonus; significant conflict = −2 penalty.
 *
 * Max 10 is achievable: variance < 0.10 (8 pts) + no conflict (+2 pts) = 10.
 */
export function scoreConsistency(inputs: ScoringInputs): DimensionScore {
  const { candidates } = inputs;
  const parts: string[] = [];

  if (candidates.length === 0) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'No candidates retrieved — evidence consistency cannot be evaluated.',
    };
  }

  // ── Sub-signal A: Score variance (0–8) ──────────────────────
  let variancePts: number;

  if (candidates.length === 1) {
    variancePts = 4;
    parts.push('Single candidate retrieved — variance unmeasurable, neutral score assigned.');
  } else {
    const scores = candidates.map((c) => c.combinedScore);
    const sd = stdDev(scores);

    if (sd < 0.1) {
      variancePts = 8;
      parts.push(`Score std dev ${sd.toFixed(3)} — very tight retrieval consistency.`);
    } else if (sd < 0.2) {
      variancePts = 6;
      parts.push(`Score std dev ${sd.toFixed(3)} — good retrieval consistency.`);
    } else if (sd < 0.3) {
      variancePts = 4;
      parts.push(`Score std dev ${sd.toFixed(3)} — moderate retrieval consistency.`);
    } else {
      variancePts = 2;
      parts.push(`Score std dev ${sd.toFixed(3)} — scattered retrieval scores.`);
    }
  }

  // ── Sub-signal B: Conflict status (−2 to +2) ────────────────
  // Prefer conflictingCandidateCount when provided; fall back to boolean hasConflict.
  let conflictAdj: number;

  if (inputs.conflictingCandidateCount !== undefined) {
    if (inputs.conflictingCandidateCount === 0) {
      conflictAdj = 2;
      parts.push('No conflicting candidates — full agreement (+2).');
    } else if (inputs.conflictingCandidateCount === 1) {
      conflictAdj = 0;
      parts.push('1 conflicting candidate detected.');
    } else {
      conflictAdj = -2;
      parts.push(`${inputs.conflictingCandidateCount} conflicting candidates detected (−2).`);
    }
  } else if (inputs.hasConflict === true) {
    conflictAdj = -2;
    parts.push('Conflicting information detected across candidates (−2).');
  } else {
    conflictAdj = 2;
    parts.push('No conflict detected (+2).');
  }

  const raw = Math.max(0, Math.min(MAX, variancePts + conflictAdj));

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
  };
}

/** Population standard deviation of an array of numbers. */
function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}
