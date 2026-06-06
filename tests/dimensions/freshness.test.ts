import { describe, expect, test } from 'vitest';
import { scoreFreshness } from '../../src/dimensions/freshness';
import type { Candidate, ScoringConfig, ScoringInputs } from '../../src/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function candidateWithAge(days: number): Candidate {
  return {
    retrievalScores: { semantic: 0.8 },
    combinedScore: 0.8,
    lastUpdated: daysAgo(days),
  };
}

const base: ScoringInputs = { confidenceLevel: 'high', candidates: [] };
const defaultConfig: ScoringConfig = { freshness: {} };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scoreFreshness — no lastUpdated', () => {
  test('candidates without lastUpdated → raw 0', () => {
    const c: Candidate = { retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 };
    const result = scoreFreshness({ ...base, candidates: [c] }, defaultConfig);
    expect(result.raw).toBe(0);
    expect(result.explanation).toContain('lastUpdated');
  });

  test('empty candidates → raw 0', () => {
    const result = scoreFreshness(base, defaultConfig);
    expect(result.raw).toBe(0);
  });
});

describe('scoreFreshness — full score window (default: 90 days)', () => {
  test('docs updated today → raw 15', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(0)] },
      defaultConfig,
    );
    expect(result.raw).toBe(15);
  });

  test('docs updated 89 days ago → raw 15', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(89)] },
      defaultConfig,
    );
    expect(result.raw).toBe(15);
  });

  test('docs updated exactly 90 days ago → raw 15', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(90)] },
      defaultConfig,
    );
    expect(result.raw).toBe(15);
  });
});

describe('scoreFreshness — decay (default: 1.5 pts/month beyond 90 days)', () => {
  test('docs updated 120 days ago → ~1 month over → penalty ~1.5 → raw ~14', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(120)] },
      defaultConfig,
    );
    // 30 days over = 1 month × 1.5 = 1.5 penalty → 15 − 1.5 = 13.5 → 14 (rounded)
    expect(result.raw).toBe(14);
  });

  test('docs updated 180 days ago → 3 months over → penalty 4.5 → raw ~11', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(180)] },
      defaultConfig,
    );
    // 90 days over = 3 months × 1.5 = 4.5 → 15 − 4.5 = 10.5 → 11
    expect(result.raw).toBe(11);
  });
});

describe('scoreFreshness — hard cutoff (default: 730 days)', () => {
  test('docs updated 730 days ago → raw 0', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(730)] },
      defaultConfig,
    );
    expect(result.raw).toBe(0);
  });

  test('docs updated 1000 days ago → raw 0', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(1000)] },
      defaultConfig,
    );
    expect(result.raw).toBe(0);
  });
});

describe('scoreFreshness — uses median age', () => {
  test('median of [10, 200, 400] days = 200 days → decayed score', () => {
    const candidates = [10, 200, 400].map(candidateWithAge);
    const result = scoreFreshness({ ...base, candidates }, defaultConfig);
    // median = 200 days, 110 days over → 3.67 months × 1.5 = 5.5 penalty → 15−5.5 = 9.5 → 10
    expect(result.raw).toBe(10);
  });

  test('candidates without lastUpdated excluded from median', () => {
    const withDate = candidateWithAge(30);
    const withoutDate: Candidate = { retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 };
    const result = scoreFreshness(
      { ...base, candidates: [withDate, withoutDate] },
      defaultConfig,
    );
    // Only withDate contributes: 30 days → within 90-day window → raw 15
    expect(result.raw).toBe(15);
  });
});

describe('scoreFreshness — custom config', () => {
  test('custom maxAgeForFullScore = 30 days', () => {
    const config: ScoringConfig = { freshness: { maxAgeForFullScore: 30 } };
    // 60 days old = 30 days over = 1 month × 1.5 = 1.5 penalty → 14
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(60)] },
      config,
    );
    expect(result.raw).toBe(14);
  });

  test('custom hardCutoffAge = 180 days', () => {
    const config: ScoringConfig = { freshness: { hardCutoffAge: 180 } };
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(200)] },
      config,
    );
    expect(result.raw).toBe(0);
  });

  test('custom penaltyPerMonth = 3', () => {
    const config: ScoringConfig = { freshness: { penaltyPerMonth: 3 } };
    // 120 days = 1 month over × 3 = 3 penalty → 15−3 = 12
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(120)] },
      config,
    );
    expect(result.raw).toBe(12);
  });
});

describe('scoreFreshness — DimensionScore shape', () => {
  test('returns all required fields', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(30)] },
      defaultConfig,
    );
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 15);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
  });

  test('raw never exceeds 15', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(0)] },
      defaultConfig,
    );
    expect(result.raw).toBeLessThanOrEqual(15);
  });
});
