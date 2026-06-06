import type { ConfidenceScorecard, Tier1Result, Tier2Result } from './types.js';

type CompositeLabel = ConfidenceScorecard['label'];
type LabelColor = ConfidenceScorecard['labelColor'];

/** Maps a 0–100 score to the composite label + color pair. */
export function deriveLabel(score: number): { label: CompositeLabel; color: LabelColor } {
  if (score >= 85) return { label: 'Strong', color: 'green' };
  if (score >= 65) return { label: 'Moderate', color: 'amber' };
  if (score >= 40) return { label: 'Limited', color: 'orange' };
  return { label: 'Insufficient', color: 'red' };
}

/**
 * Derives Tier 1 (Answer Confidence) result.
 * Returns null when max ≤ 0 (should not occur in practice).
 * Returns a 'Not Addressed' gray result when documents are silent.
 */
export function deriveTier1(raw: number, max: number, notAddressed = false): Tier1Result | null {
  if (notAddressed) {
    return { score: 0, label: 'Not Addressed', color: 'gray' };
  }
  if (max <= 0) return null;
  const score = Math.round((raw / max) * 100);
  const { label, color } = deriveLabel(score);
  return { score, label, color };
}

/**
 * Derives Tier 2 (System Readiness) result.
 * Returns null when max ≤ 0 — meaning no system extensions are active.
 * Uses distinct labels (Complete / Good / Partial / Thin) from the composite label set.
 */
export function deriveTier2(raw: number, max: number): Tier2Result | null {
  if (max <= 0) return null;
  const score = Math.round((raw / max) * 100);
  if (score >= 85) return { score, label: 'Complete', color: 'green' };
  if (score >= 65) return { score, label: 'Good', color: 'amber' };
  if (score >= 40) return { score, label: 'Partial', color: 'orange' };
  return { score, label: 'Thin', color: 'red' };
}
