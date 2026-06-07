import { describe, expect, test } from 'vitest';
import { scoreFreshness } from '../../src/dimensions/freshness';
import type { Candidate, ScoringConfig, ScoringInputs } from '../../src/types';

// ── Fixed "now" for deterministic tests ───────────────────────────────────────

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

function daysBeforeNow(n: number): Date {
  return new Date(FIXED_NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function candidateWithAge(days: number): Candidate {
  return {
    retrievalScores: { semantic: 0.8 },
    combinedScore: 0.8,
    lastUpdated: daysBeforeNow(days),
  };
}

const base: ScoringInputs = { supportLevel: 'high', candidates: [] };
const defaultConfig: ScoringConfig = { freshness: { now: FIXED_NOW } };

// ── No lastUpdated ────────────────────────────────────────────────────────────

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

  test('no lastUpdated → emits missing-freshness-dates warning', () => {
    const c: Candidate = { retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 };
    const result = scoreFreshness({ ...base, candidates: [c] }, defaultConfig);
    const codes = result.warnings?.map((w) => w.code) ?? [];
    expect(codes).toContain('missing-freshness-dates');
  });
});

// ── Full score window (default: 90 days) ─────────────────────────────────────

describe('scoreFreshness — full score window (default: 90 days)', () => {
  test('docs updated today → raw 15', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(0)] }, defaultConfig);
    expect(result.raw).toBe(15);
  });

  test('docs updated 89 days ago → raw 15', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(89)] }, defaultConfig);
    expect(result.raw).toBe(15);
  });

  test('docs updated exactly 90 days ago → raw 15', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(90)] }, defaultConfig);
    expect(result.raw).toBe(15);
  });
});

// ── Decay (default: 1.5 pts/month beyond 90 days) ────────────────────────────

describe('scoreFreshness — decay', () => {
  test('120 days ago → 30 days over → 1.5 penalty → raw 14', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(120)] }, defaultConfig);
    // 30 days / 30 = 1 month × 1.5 = 1.5 → 15 − 1.5 = 13.5 → 14 (rounded)
    expect(result.raw).toBe(14);
  });

  test('180 days ago → 90 days over → 4.5 penalty → raw 11', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(180)] }, defaultConfig);
    // 90 / 30 = 3 months × 1.5 = 4.5 → 15 − 4.5 = 10.5 → 11
    expect(result.raw).toBe(11);
  });
});

// ── Hard cutoff (default: 730 days) ──────────────────────────────────────────

describe('scoreFreshness — hard cutoff', () => {
  test('730 days ago → raw 0', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(730)] }, defaultConfig);
    expect(result.raw).toBe(0);
  });

  test('1000 days ago → raw 0', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(1000)] }, defaultConfig);
    expect(result.raw).toBe(0);
  });
});

// ── Aggregation: median (default) ────────────────────────────────────────────

describe('scoreFreshness — aggregation: median (default)', () => {
  test('median of [10, 200, 400] = 200 days → decayed score', () => {
    const candidates = [10, 200, 400].map(candidateWithAge);
    const result = scoreFreshness({ ...base, candidates }, defaultConfig);
    // median = 200, 110 days over → 3.67 months × 1.5 = 5.5 → 15−5.5 = 9.5 → 10
    expect(result.raw).toBe(10);
  });

  test('candidates without lastUpdated excluded from median', () => {
    const withDate = candidateWithAge(30);
    const noDate: Candidate = { retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 };
    const result = scoreFreshness({ ...base, candidates: [withDate, noDate] }, defaultConfig);
    // Only withDate: 30 days → within window → raw 15
    expect(result.raw).toBe(15);
  });
});

// ── Aggregation: oldest / newest ─────────────────────────────────────────────

describe('scoreFreshness — aggregation modes', () => {
  test('aggregation: oldest → uses the oldest candidate age', () => {
    const oldestConfig: ScoringConfig = {
      freshness: { now: FIXED_NOW, aggregation: 'oldest' },
    };
    // ages [30, 200]: oldest = 200 → decayed
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(30), candidateWithAge(200)] },
      oldestConfig,
    );
    // 200 days, 110 over → 3.67 months × 1.5 = 5.5 → 9.5 → 10
    expect(result.raw).toBe(10);
  });

  test('aggregation: newest → uses the freshest candidate age', () => {
    const newestConfig: ScoringConfig = {
      freshness: { now: FIXED_NOW, aggregation: 'newest' },
    };
    // ages [30, 200]: newest = 30 → within window → raw 15
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(30), candidateWithAge(200)] },
      newestConfig,
    );
    expect(result.raw).toBe(15);
  });

  test('aggregation: oldest → breakdown.diagnostics.aggregation = oldest', () => {
    const config: ScoringConfig = { freshness: { now: FIXED_NOW, aggregation: 'oldest' } };
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(50)] }, config);
    expect(result.breakdown?.diagnostics?.aggregation).toBe('oldest');
  });

  test('aggregation: newest → breakdown.diagnostics.aggregation = newest', () => {
    const config: ScoringConfig = { freshness: { now: FIXED_NOW, aggregation: 'newest' } };
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(50)] }, config);
    expect(result.breakdown?.diagnostics?.aggregation).toBe('newest');
  });

  test('default aggregation → breakdown.diagnostics.aggregation = median', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(50)] }, defaultConfig);
    expect(result.breakdown?.diagnostics?.aggregation).toBe('median');
  });
});

// ── now injection ─────────────────────────────────────────────────────────────

describe('scoreFreshness — now injection', () => {
  test('same inputs + same now → same output (deterministic)', () => {
    const candidates = [candidateWithAge(120)];
    const r1 = scoreFreshness({ ...base, candidates }, defaultConfig);
    const r2 = scoreFreshness({ ...base, candidates }, defaultConfig);
    expect(r1.raw).toBe(r2.raw);
  });

  test('different now shifts age calculation', () => {
    // Use FIXED_NOW and a "now" that is 60 days later
    const laterNow = new Date(FIXED_NOW.getTime() + 60 * 24 * 60 * 60 * 1000);
    const date = daysBeforeNow(30); // 30 days before FIXED_NOW

    const baseResult = scoreFreshness(
      {
        ...base,
        candidates: [{ retrievalScores: { semantic: 0.8 }, combinedScore: 0.8, lastUpdated: date }],
      },
      { freshness: { now: FIXED_NOW } },
    );
    const laterResult = scoreFreshness(
      {
        ...base,
        candidates: [{ retrievalScores: { semantic: 0.8 }, combinedScore: 0.8, lastUpdated: date }],
      },
      { freshness: { now: laterNow } },
    );
    // Same document, but "now" is 60 days later → document appears 90 days old in later check
    // FIXED_NOW: 30 days → raw 15 (full window); laterNow: 90 days → raw 15 (edge of window)
    expect(baseResult.raw).toBe(15);
    expect(laterResult.raw).toBe(15);
  });
});

// ── Custom config ─────────────────────────────────────────────────────────────

describe('scoreFreshness — custom config', () => {
  test('custom maxAgeForFullScore = 30 days', () => {
    const config: ScoringConfig = { freshness: { now: FIXED_NOW, maxAgeForFullScore: 30 } };
    // 60 days = 30 over = 1 month × 1.5 = 1.5 → 14
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(60)] }, config);
    expect(result.raw).toBe(14);
  });

  test('custom hardCutoffAge = 180 days', () => {
    const config: ScoringConfig = { freshness: { now: FIXED_NOW, hardCutoffAge: 180 } };
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(200)] }, config);
    expect(result.raw).toBe(0);
  });

  test('custom penaltyPerMonth = 3', () => {
    const config: ScoringConfig = { freshness: { now: FIXED_NOW, penaltyPerMonth: 3 } };
    // 120 days = 1 month over × 3 = 3 penalty → 15−3 = 12
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(120)] }, config);
    expect(result.raw).toBe(12);
  });
});

// ── DimensionScore shape ──────────────────────────────────────────────────────

describe('scoreFreshness — DimensionScore shape', () => {
  test('returns all required fields', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(30)] }, defaultConfig);
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 15);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
  });

  test('raw never exceeds 15', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(0)] }, defaultConfig);
    expect(result.raw).toBeLessThanOrEqual(15);
  });

  test('breakdown.raw equals DimensionScore.raw', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(30)] }, defaultConfig);
    expect(result.breakdown?.raw).toBe(result.raw);
  });

  test('breakdown.diagnostics.selectedAgeDays present and rounded', () => {
    const result = scoreFreshness({ ...base, candidates: [candidateWithAge(45)] }, defaultConfig);
    expect(result.breakdown?.diagnostics?.selectedAgeDays).toBe(45);
  });

  test('breakdown.diagnostics.datedCandidateCount present', () => {
    const result = scoreFreshness(
      { ...base, candidates: [candidateWithAge(30), candidateWithAge(60)] },
      defaultConfig,
    );
    expect(result.breakdown?.diagnostics?.datedCandidateCount).toBe(2);
  });
});
