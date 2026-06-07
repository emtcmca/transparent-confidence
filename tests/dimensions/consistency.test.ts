import { describe, expect, test } from 'vitest';
import { scoreConsistency } from '../../src/dimensions/consistency';
import type { Candidate, ScoringInputs } from '../../src/types';

function candidate(combinedScore: number): Candidate {
  return { retrievalScores: { semantic: combinedScore }, combinedScore };
}

/** Std dev < 0.10 — 5 candidates with scores 0.80, 0.81, 0.82, 0.83, 0.84. */
function tightCandidates(n: number): Candidate[] {
  return Array.from({ length: n }, (_, i) => candidate(0.8 + i * 0.01));
}

/** Std dev 0.10–0.19 */
function mediumCandidates(): Candidate[] {
  return [0.6, 0.7, 0.8, 0.9].map(candidate);
}

/** Std dev 0.20–0.29 */
function moderateCandidates(): Candidate[] {
  return [0.2, 0.4, 0.8, 0.9].map(candidate);
}

/** Std dev >= 0.30 */
function scatteredCandidates(): Candidate[] {
  return [0.95, 0.3, 0.85, 0.25, 0.9].map(candidate);
}

const base: ScoringInputs = { supportLevel: 'high', candidates: [] };

// ─────────────────────────────────────────────────────────────
// No candidates
// ─────────────────────────────────────────────────────────────

describe('scoreConsistency - no candidates', () => {
  test('empty candidates returns raw 0', () => {
    const result = scoreConsistency(base);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });

  test('empty candidates has scoreStability 0 and conflictStatus 0 in breakdown', () => {
    const result = scoreConsistency(base);
    expect(result.breakdown?.components.scoreStability).toBe(0);
    expect(result.breakdown?.components.conflictStatus).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Single candidate
// ─────────────────────────────────────────────────────────────

describe('scoreConsistency - single candidate', () => {
  test('1 candidate + no conflict signal = stability 3 + conflict 2 = 5', () => {
    const result = scoreConsistency({ ...base, candidates: [candidate(0.8)] });
    expect(result.raw).toBe(5);
  });

  test('1 candidate + explicit conflictingCandidateCount: 0 = stability 3 + conflict 4 = 7', () => {
    const result = scoreConsistency({
      ...base,
      candidates: [candidate(0.8)],
      conflictingCandidateCount: 0,
    });
    expect(result.raw).toBe(7);
  });

  test('1 candidate + hasConflict: false = stability 3 + conflict 4 = 7', () => {
    const result = scoreConsistency({
      ...base,
      candidates: [candidate(0.8)],
      hasConflict: false,
    });
    expect(result.raw).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────
// Score stability sub-signal (Sub-signal A)
// ─────────────────────────────────────────────────────────────

describe('scoreConsistency - stability sub-signal', () => {
  test('std dev < 0.10 returns stability 6', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
    });
    // 6 stability + 4 explicit no-conflict = 10
    expect(result.breakdown?.components.scoreStability).toBe(6);
    expect(result.raw).toBe(10);
  });

  test('std dev 0.10–0.19 returns stability 5', () => {
    const result = scoreConsistency({
      ...base,
      candidates: mediumCandidates(),
      conflictingCandidateCount: 0,
    });
    expect(result.breakdown?.components.scoreStability).toBe(5);
    expect(result.raw).toBe(9);
  });

  test('std dev 0.20–0.29 returns stability 3', () => {
    const result = scoreConsistency({
      ...base,
      candidates: moderateCandidates(),
      conflictingCandidateCount: 0,
    });
    expect(result.breakdown?.components.scoreStability).toBe(3);
    expect(result.raw).toBe(7);
  });

  test('std dev >= 0.30 returns stability 1', () => {
    const result = scoreConsistency({
      ...base,
      candidates: scatteredCandidates(),
      conflictingCandidateCount: 0,
    });
    expect(result.breakdown?.components.scoreStability).toBe(1);
    expect(result.raw).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
// Conflict sub-signal (Sub-signal B)
// ─────────────────────────────────────────────────────────────

describe('scoreConsistency - conflict sub-signal', () => {
  test('tight scores + explicit conflictingCandidateCount: 0 = max 10', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
    });
    expect(result.raw).toBe(10);
    expect(result.breakdown?.components.conflictStatus).toBe(4);
  });

  test('tight scores + hasConflict: false (no count) = max 10', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      hasConflict: false,
    });
    expect(result.raw).toBe(10);
    expect(result.breakdown?.components.conflictStatus).toBe(4);
  });

  test('tight scores + missing conflict signal = 8 + warning missing-conflict-signal', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.raw).toBe(8);
    expect(result.breakdown?.components.conflictStatus).toBe(2);
    const codes = result.warnings?.map((w) => w.code) ?? [];
    expect(codes).toContain('missing-conflict-signal');
  });

  test('tight scores + conflictingCandidateCount: 1 = 6 + 1 = 7', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 1,
    });
    expect(result.raw).toBe(7);
    expect(result.breakdown?.components.conflictStatus).toBe(1);
  });

  test('tight scores + conflictingCandidateCount: 2 = 6 + 0 = 6', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 2,
    });
    expect(result.raw).toBe(6);
    expect(result.breakdown?.components.conflictStatus).toBe(0);
  });

  test('tight scores + hasConflict: true (no count) = 6 + 0 = 6', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      hasConflict: true,
    });
    expect(result.raw).toBe(6);
    expect(result.breakdown?.components.conflictStatus).toBe(0);
  });

  test('conflictingCandidateCount: 0 overrides hasConflict: true = 10', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
      hasConflict: true,
    });
    expect(result.raw).toBe(10);
    expect(result.breakdown?.components.conflictStatus).toBe(4);
  });

  test('scattered scores + conflictingCandidateCount >= 2 = 1 + 0 = 1', () => {
    const result = scoreConsistency({
      ...base,
      candidates: scatteredCandidates(),
      conflictingCandidateCount: 3,
    });
    expect(result.raw).toBe(1);
  });

  test('floor at 0 — raw never negative', () => {
    const result = scoreConsistency({
      ...base,
      candidates: scatteredCandidates(),
      conflictingCandidateCount: 5,
    });
    expect(result.raw).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Breakdown and warnings shape
// ─────────────────────────────────────────────────────────────

describe('scoreConsistency - breakdown and warnings', () => {
  test('breakdown.components contains scoreStability and conflictStatus', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(3) });
    expect(result.breakdown?.components).toHaveProperty('scoreStability');
    expect(result.breakdown?.components).toHaveProperty('conflictStatus');
  });

  test('breakdown.diagnostics contains scoreStdDev', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(3) });
    expect(result.breakdown?.diagnostics).toHaveProperty('scoreStdDev');
  });

  test('breakdown.raw equals DimensionScore.raw', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.breakdown?.raw).toBe(result.raw);
  });

  test('breakdown.uncappedRaw present', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.breakdown).toHaveProperty('uncappedRaw');
  });

  test('no warning when explicit conflict signal provided', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
    });
    const missingConflict = result.warnings?.find((w) => w.code === 'missing-conflict-signal');
    expect(missingConflict).toBeUndefined();
  });

  test('missing-conflict-signal warning has path hasConflict', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(3) });
    const warning = result.warnings?.find((w) => w.code === 'missing-conflict-signal');
    expect(warning?.path).toBe('hasConflict');
  });
});

// ─────────────────────────────────────────────────────────────
// DimensionScore shape invariants
// ─────────────────────────────────────────────────────────────

describe('scoreConsistency - shape invariants', () => {
  test('max is always 10', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.max).toBe(10);
  });

  test('raw never exceeds 10', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.raw).toBeLessThanOrEqual(10);
  });

  test('normalized = round(raw / 10 * 100)', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.normalized).toBe(Math.round((result.raw / 10) * 100));
  });
});
