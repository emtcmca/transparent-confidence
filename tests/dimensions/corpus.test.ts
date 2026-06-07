import { describe, expect, test } from 'vitest';
import { scoreCorpus } from '../../src/dimensions/corpus';
import type { ScoringConfig, ScoringInputs } from '../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const base: ScoringInputs = { supportLevel: 'high', candidates: [] };
const config5: ScoringConfig = { corpus: { expectedTypeCount: 5 } };

// ── Missing input ─────────────────────────────────────────────────────────────

describe('scoreCorpus — missing input', () => {
  test('corpusTypeCount not provided → raw 0 with explanation', () => {
    const result = scoreCorpus(base, config5);
    expect(result.raw).toBe(0);
    expect(result.explanation).toContain('corpusTypeCount not provided');
  });

  test('missing count → emits missing-corpus-count warning', () => {
    const result = scoreCorpus(base, config5);
    const codes = result.warnings?.map((w) => w.code) ?? [];
    expect(codes).toContain('missing-corpus-count');
  });
});

// ── Base scores (count-based) ─────────────────────────────────────────────────

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

// ── missingRelevantType penalty ───────────────────────────────────────────────

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

// ── Custom expectedTypeCount ──────────────────────────────────────────────────

describe('scoreCorpus — custom expectedTypeCount', () => {
  test('proportional scoring for expectedTypeCount = 10', () => {
    const config: ScoringConfig = { corpus: { expectedTypeCount: 10 } };
    // 8 of 10 = 80% → base 12
    const result = scoreCorpus({ ...base, corpusTypeCount: 8 }, config);
    expect(result.raw).toBe(12);
  });

  test('proportional scoring for expectedTypeCount = 3', () => {
    const config: ScoringConfig = { corpus: { expectedTypeCount: 3 } };
    // 2 of 3 = 66% → base 9
    const result = scoreCorpus({ ...base, corpusTypeCount: 2 }, config);
    expect(result.raw).toBe(9);
  });
});

// ── Named types ───────────────────────────────────────────────────────────────

describe('scoreCorpus — named types (presentTypes + expectedTypes)', () => {
  const namedConfig: ScoringConfig = {
    corpus: {
      expectedTypes: ['CC&Rs', 'Bylaws', 'Rules', 'Budget', 'Insurance'],
    },
  };

  test('all 5 expected types present → raw 15', () => {
    const result = scoreCorpus(
      {
        ...base,
        presentTypes: ['CC&Rs', 'Bylaws', 'Rules', 'Budget', 'Insurance'],
      },
      namedConfig,
    );
    expect(result.raw).toBe(15);
  });

  test('3 of 5 types present → raw 9', () => {
    // 60% → base 9
    const result = scoreCorpus(
      { ...base, presentTypes: ['CC&Rs', 'Bylaws', 'Rules'] },
      namedConfig,
    );
    expect(result.raw).toBe(9);
  });

  test('missing types listed in diagnostics', () => {
    const result = scoreCorpus(
      { ...base, presentTypes: ['CC&Rs', 'Bylaws', 'Rules'] },
      namedConfig,
    );
    const missing = result.breakdown?.diagnostics?.missingTypes as string | undefined;
    expect(missing).toContain('Budget');
    expect(missing).toContain('Insurance');
  });

  test('named types derive counts correctly (no corpusTypeCount needed)', () => {
    const result = scoreCorpus(
      { ...base, presentTypes: ['CC&Rs', 'Bylaws', 'Rules'] },
      namedConfig,
    );
    expect(result.breakdown?.diagnostics?.corpusTypeCount).toBe(3);
    expect(result.breakdown?.diagnostics?.expectedTypeCount).toBe(5);
  });

  test('namedTypes = true in diagnostics when array mode used', () => {
    const result = scoreCorpus({ ...base, presentTypes: ['CC&Rs', 'Bylaws'] }, namedConfig);
    expect(result.breakdown?.diagnostics?.namedTypes).toBe(true);
  });

  test('presentTypes without config.corpus.expectedTypes → count-mode fallback', () => {
    // expectedTypes not provided → falls back to corpusTypeCount
    const config: ScoringConfig = { corpus: { expectedTypeCount: 5 } };
    const result = scoreCorpus(
      { ...base, corpusTypeCount: 3, presentTypes: ['CC&Rs', 'Bylaws', 'Rules'] },
      config,
    );
    // count mode: 3/5 = 60% → base 9
    expect(result.raw).toBe(9);
    expect(result.breakdown?.diagnostics?.namedTypes).toBe(false);
  });

  test('3 of 5 named types + missingRelevantType → raw max(0, 9−3) = 6', () => {
    const result = scoreCorpus(
      {
        ...base,
        presentTypes: ['CC&Rs', 'Bylaws', 'Rules'],
        missingRelevantType: true,
      },
      namedConfig,
    );
    expect(result.raw).toBe(6);
  });
});

// ── missingTypes input passthrough ───────────────────────────────────────────

describe('scoreCorpus — missingTypes input passthrough (count mode)', () => {
  test('missingTypes included in explanation when provided', () => {
    const result = scoreCorpus(
      {
        ...base,
        corpusTypeCount: 3,
        missingTypes: ['Budget', 'Insurance'],
      },
      config5,
    );
    expect(result.explanation).toContain('Budget');
  });
});

// ── DimensionScore shape ──────────────────────────────────────────────────────

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

  test('breakdown.raw equals DimensionScore.raw', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 4 }, config5);
    expect(result.breakdown?.raw).toBe(result.raw);
  });

  test('breakdown.components.base present', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 4 }, config5);
    expect(result.breakdown?.components).toHaveProperty('base');
  });

  test('breakdown.diagnostics.ratio present', () => {
    const result = scoreCorpus({ ...base, corpusTypeCount: 3 }, config5);
    expect(result.breakdown?.diagnostics?.ratio).toBe(0.6);
  });
});
