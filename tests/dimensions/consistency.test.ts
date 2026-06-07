import { describe, expect, test } from 'vitest';
import { scoreConsistency } from '../../src/dimensions/consistency';
import type { Candidate, ScoringInputs } from '../../src/types';

function candidate(combinedScore: number): Candidate {
  return { retrievalScores: { semantic: combinedScore }, combinedScore };
}

/** Builds N candidates with tight scores (max spread = 0.02). */
function tightCandidates(n: number): Candidate[] {
  return Array.from({ length: n }, (_, i) => candidate(0.8 + i * 0.01));
}

/** Builds candidates with scattered scores (std dev > 0.30). */
function scatteredCandidates(): Candidate[] {
  return [0.95, 0.3, 0.85, 0.25, 0.9].map(candidate);
}

const base: ScoringInputs = { supportLevel: 'high', candidates: [] };

describe('scoreConsistency - no candidates', () => {
  test('empty candidates returns raw 0', () => {
    const result = scoreConsistency(base);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });
});

describe('scoreConsistency - single candidate', () => {
  test('1 candidate returns raw 4 neutral + 2 no conflict = 6', () => {
    const result = scoreConsistency({ ...base, candidates: [candidate(0.8)] });
    expect(result.raw).toBe(6);
  });
});

describe('scoreConsistency - variance sub-signal', () => {
  test('std dev < 0.10 returns variance 8, no conflict total 10', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.raw).toBe(10);
  });

  test('std dev 0.10-0.19 returns variance 6', () => {
    const candidates = [0.6, 0.7, 0.8, 0.9].map(candidate);
    const result = scoreConsistency({ ...base, candidates });
    expect(result.raw).toBe(8);
  });

  test('std dev 0.20-0.29 returns variance 4', () => {
    const candidates = [0.2, 0.4, 0.8, 0.9].map(candidate);
    const result = scoreConsistency({ ...base, candidates });
    expect(result.raw).toBe(6);
  });

  test('std dev >= 0.30 returns variance 2', () => {
    const result = scoreConsistency({ ...base, candidates: scatteredCandidates() });
    expect(result.raw).toBe(4);
  });
});

describe('scoreConsistency - conflict sub-signal', () => {
  test('no conflict indicators adds 2 bonus', () => {
    const result = scoreConsistency({ ...base, candidates: tightCandidates(5) });
    expect(result.raw).toBe(10);
  });

  test('conflictingCandidateCount = 0 adds 2 explicit no-conflict bonus', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
    });
    expect(result.raw).toBe(10);
  });

  test('conflictingCandidateCount = 1 returns neutral adjustment', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 1,
    });
    expect(result.raw).toBe(8);
  });

  test('conflictingCandidateCount = 2 returns -2 penalty', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 2,
    });
    expect(result.raw).toBe(6);
  });

  test('conflictingCandidateCount = 5 returns -2 penalty', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 5,
    });
    expect(result.raw).toBe(6);
  });

  test('hasConflict = true boolean fallback returns -2 penalty', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      hasConflict: true,
    });
    expect(result.raw).toBe(6);
  });

  test('conflictingCandidateCount takes precedence over hasConflict boolean', () => {
    const result = scoreConsistency({
      ...base,
      candidates: tightCandidates(5),
      conflictingCandidateCount: 0,
      hasConflict: true,
    });
    expect(result.raw).toBe(10);
  });

  test('floor at 0 with scattered scores and major conflict', () => {
    const result = scoreConsistency({
      ...base,
      candidates: scatteredCandidates(),
      conflictingCandidateCount: 3,
    });
    expect(result.raw).toBe(0);
  });
});

describe('scoreConsistency - DimensionScore shape', () => {
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
