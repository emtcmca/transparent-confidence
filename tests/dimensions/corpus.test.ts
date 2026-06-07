import { describe, expect, test } from 'vitest';
import { scoreCorpus } from '../../src/dimensions/corpus';
import type { ScoringConfig, ScoringInputs } from '../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const base: ScoringInputs = { supportLevel: 'high', candidates: [] };
const config5: ScoringConfig = { corpus: { expectedTypeCount: 5 } };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scoreCorpus — missing input', () => {
  test('corpusTypeCount not provided → raw 0 with explanation', () => {
    const result = scoreCorpus(base, config5);
    expect(result.raw).toBe(0);
    expect(result.explanation).toContain('corpusTypeCount not provided');
  });
});

describe('scoreCorpus — base scores (expectedTypeCount = 5)', () => {
  test('5 of 5 → raw 15', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 5 }, config5);
    expect(result.raw).toBe(15);
  });

  test('4 of 5 (80%) → raw 12', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 4 }, config5);
    expect(result.raw).toBe(12);
  });

  test('3 of 5 (60%) → raw 9', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 3 }, config5);
    expect(result.raw).toBe(9);
  });

  test('2 of 5 (40%) → raw 5', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 2 }, config5);
    expect(result.raw).toBe(5);
  });

  test('1 of 5 (20%) → raw 2', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 1 }, config5);
    expect(result.raw).toBe(2);
  });

  test('0 of 5 → raw 0', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 0 }, config5);
    expect(result.raw).toBe(0);
  });

  test('corpusTypeCount > expectedTypeCount treated as 100%', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 10 }, config5);
    expect(result.raw).toBe(15);
  });
});

describe('scoreCorpus — missingRelevantType penalty', () => {
  test('3 of 5 + missingRelevantType → raw max(0, 9−3) = 6', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 3, missingRelevantType: true }, config5);
    expect(result.raw).toBe(6);
  });

  test('1 of 5 + missingRelevantType → raw max(0, 2−3) = 0', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 1, missingRelevantType: true }, config5);
    expect(result.raw).toBe(0);
  });

  test('5 of 5 + missingRelevantType → raw max(0, 15−3) = 12', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 5, missingRelevantType: true }, config5);
    expect(result.raw).toBe(12);
  });

  test('penalty floors at 0', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 0, missingRelevantType: true }, config5);
    expect(result.raw).toBe(0);
  });
});

describe('scoreCorpus — custom expectedTypeCount', () => {
  test('proportional scoring works for expectedTypeCount = 10', () => {
    const config: ScoringConfig = { corpus: { expectedTypeCount: 10 } };
    // 8 of 10 = 80% → base 12
    const result = scoreCorpus({ ...base, corpusTypeCount: 8 }, config);
    expect(result.raw).toBe(12);
  });

  test('proportional scoring works for expectedTypeCount = 3', () => {
    const config: ScoringConfig = { corpus: { expectedTypeCount: 3 } };
    // 2 of 3 = 66% → base 9
    const result = scoreCorpus({ ...base, corpusTypeCount: 2 }, config);
    expect(result.raw).toBe(9);
  });
});

describe('scoreCorpus — DimensionScore shape', () => {
  test('returns all required fields', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 5 }, config5);
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 15);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
  });

  test('normalized = round(raw / 15 * 100)', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 3 }, config5);
    expect(result.normalized).toBe(Math.round((result.raw / 15) * 100));
  });
});
