import { describe, expect, test } from 'vitest';
import { scoreConsistency } from '../../src/dimensions/consistency';
import type { Candidate, ScoringInputs } from '../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function candidate(combinedScore: number): Candidate {
  return { retrievalScores: { semantic: combinedScore }, combinedScore };
}

/** Builds N candidates with tight scores (max spread = 0.02). */
function tightCandidates(n: number): Candidate[] {
  return Array.from({ length: n }, (_, i) => candidate(0.80 + i * 0.01));
}

/** Builds candidates with scattered scores (std dev > 0.30). */
function scatteredCandidates(): Candidate[] {
  return [0.95, 0.30, 0.85, 0.25, 0.90].map(candidate);
}

const base: ScoringInputs = { confidenceLevel: 'high', candidates: [] };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scoreConsistency — no candidates', () => {
  test('empty candidates → raw 0', () => {
    const result = scoreConsistency(base);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });
});

describe('scoreConsistency — single candidate', () => {
  test('1 candidate → raw 4 (neutral) + 2 (no conflict) = 6', () => {
    const result = scoreConsistency({ ...base, candidates: [candidate(0.80)] });
    expect(result.raw).toBe(6);
  });
});

describe('scoreConsistency — variance sub-signal', () => {
  test('std dev < 0.10 → variance 8, no conflict → total 10', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.raw).toBe(10);
  });

  test('std dev 0.10–0.19 → variance 6', () => {
    // scores with std dev ~0.14
    const candidates = [0.60, 0.70, 0.80, 0.90].map(candidate);
    const result = scoreConsistency({ ...base, candidates });
    expect(result.raw).toBe(8); // variance 6 + no-conflict 2
  });

  test('std dev 0.20–0.29 → variance 4', () => {
    // [0.20, 0.40, 0.80, 0.90] → mean 0.575, std dev ~0.286
    const candidates = [0.20, 0.40, 0.80, 0.90].map(candidate);
    const result = scoreConsistency({ ...base, candidates });
    // variance 4 + no-conflict 2 = 6
    expect(result.raw).toBe(6);
  });

  test('std dev >= 0.30 → variance 2', () => {
    const result = scoreConsistency({ ...base, candidates: scatteredCandidates() });
    // variance 2 + no-conflict 2 = 4
    expect(result.raw).toBe(4);
  });
});

describe('scoreConsistency — conflict sub-signal', () => {
  test('no conflict indicators → +2 bonus', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.raw).toBe(10); // 8 + 2
  });

  test('conflictingCandidateCount = 0 → +2 (explicit no-conflict)', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
    });
    expect(result.raw).toBe(10);
  });

  test('conflictingCandidateCount = 1 → neutral (0 adj)', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 1,
    });
    expect(result.raw).toBe(8); // 8 + 0
  });

  test('conflictingCandidateCount = 2 → −2 penalty', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 2,
    });
    expect(result.raw).toBe(6); // 8 − 2
  });

  test('conflictingCandidateCount = 5 → −2 penalty (not worse than 2+)', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 5,
    });
    expect(result.raw).toBe(6); // 8 − 2
  });

  test('hasConflict = true (boolean fallback) → −2 penalty', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      hasConflict: true,
    });
    expect(result.raw).toBe(6); // 8 − 2
  });

  test('conflictingCandidateCount takes precedence over hasConflict boolean', () => {
    // count = 0 should override hasConflict = true
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
      hasConflict: true,
    });
    expect(result.raw).toBe(10); // count wins: no conflict → +2
  });

  test('floor at 0 — scattered scores + major conflict', () => {
    const result = scoreConsistency({
      ...base,
      candidates: scatteredCandidates(),
      conflictingCandidateCount: 3,
    });
    // variance 2 − 2 = 0
    expect(result.raw).toBe(0);
  });
});

describe('scoreConsistency — DimensionScore shape', () => {
  test('returns all required fields', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(3) });
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 10);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
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
