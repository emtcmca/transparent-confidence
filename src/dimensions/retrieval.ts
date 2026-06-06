import type { Candidate, DimensionScore, ScoringInputs } from '../types.js';

const MAX = 25;

/**
 * Dimension 2 — Retrieval Confidence (max 25 raw pts)
 *
 * Three sub-signals summed, capped at 25:
 *   A. Method agreement (0–15): how many candidates confirmed by 2+ retrieval methods
 *   B. Score magnitude  (0–8):  average effective combinedScore of top-3 candidates
 *   C. Source diversity + breadth (0–5): unique documents + total candidate count
 */
export function scoreRetrieval(inputs: ScoringInputs): DimensionScore {
  const { candidates } = inputs;
  const parts: string[] = [];

  if (candidates.length === 0) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'No candidates were retrieved.',
    };
  }

  // ── Sub-signal A: Method agreement (0–15) ───────────────────
  const confirmed = candidates.filter(
    (c) => Object.values(c.retrievalScores).filter((s) => s > 0).length >= 2,
  );

  let agreementPts: number;
  if (confirmed.length >= 3) {
    agreementPts = 15;
    parts.push(`${confirmed.length} candidates confirmed by 2+ retrieval methods.`);
  } else if (confirmed.length === 2) {
    agreementPts = 12;
    parts.push('2 candidates confirmed by 2+ retrieval methods.');
  } else if (confirmed.length === 1) {
    agreementPts = 8;
    parts.push('1 candidate confirmed by 2+ retrieval methods.');
  } else {
    agreementPts = 3;
    parts.push(
      'No candidates confirmed by multiple retrieval methods — single-path retrieval only.',
    );
  }

  // ── Sub-signal B: Score magnitude (0–8) ─────────────────────
  const sorted = [...candidates].sort((a, b) => b.combinedScore - a.combinedScore);
  const top3 = sorted.slice(0, 3);

  const effectiveScores = top3.map((c: Candidate) =>
    c.extractionQuality !== undefined ? c.combinedScore * c.extractionQuality : c.combinedScore,
  );

  const avgScore =
    effectiveScores.reduce((sum: number, s: number) => sum + s, 0) / effectiveScores.length;

  let magnitudePts: number;
  if (avgScore >= 0.8) {
    magnitudePts = 8;
  } else if (avgScore >= 0.65) {
    magnitudePts = 6;
  } else if (avgScore >= 0.5) {
    magnitudePts = 4;
  } else if (avgScore >= 0.35) {
    magnitudePts = 2;
  } else {
    magnitudePts = 0;
  }

  parts.push(`Top-3 effective score avg: ${avgScore.toFixed(2)}.`);

  if (top3.some((c) => c.extractionQuality !== undefined)) {
    parts.push('Extraction quality applied as score multiplier.');
  }

  // ── Sub-signal C: Source diversity + section breadth (0–5) ──
  const withIds = candidates.filter((c) => c.documentId !== undefined);
  const uniqueDocIds = new Set(withIds.map((c) => c.documentId));

  let diversityPts = 0;
  if (withIds.length > 0) {
    if (uniqueDocIds.size >= 3) {
      diversityPts = 3;
      parts.push(`${uniqueDocIds.size} distinct source documents.`);
    } else if (uniqueDocIds.size === 2) {
      diversityPts = 1;
      parts.push('2 distinct source documents.');
    } else {
      parts.push('All candidates from a single source document.');
    }
  }

  let breadthPts = 0;
  if (candidates.length >= 5) {
    breadthPts = 2;
  } else if (candidates.length >= 3) {
    breadthPts = 1;
  }

  parts.push(`${candidates.length} total candidates.`);

  const raw = Math.min(MAX, agreementPts + magnitudePts + diversityPts + breadthPts);

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
  };
}
