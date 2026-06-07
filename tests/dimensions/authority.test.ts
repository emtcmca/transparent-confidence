import { describe, expect, test } from 'vitest';
import { scoreAuthority } from '../../src/dimensions/authority';
import type { Candidate, ScoringConfig, ScoringInputs } from '../../src/types';

function candidate(authorityRank: number, opts: Partial<Candidate> = {}): Candidate {
  return {
    retrievalScores: { semantic: 0.8 },
    combinedScore: 0.8,
    authorityRank,
    ...opts,
  };
}

const base: ScoringInputs = { supportLevel: 'high', candidates: [] };
const defaultConfig: ScoringConfig = { authority: {} };

describe('scoreAuthority - no candidates', () => {
  test('empty candidates returns raw 0', () => {
    const result = scoreAuthority(base, defaultConfig);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });
});

describe('scoreAuthority - base scores', () => {
  test('min rank <= 10 returns base 18', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result.raw).toBe(18);
  });

  test('min rank <= 20 returns base 13', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(20)] }, defaultConfig);
    expect(result.raw).toBe(13);
  });

  test('min rank <= 30 returns base 7', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(30)] }, defaultConfig);
    expect(result.raw).toBe(7);
  });

  test('min rank > 30 unclassified returns base 2', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(99)] }, defaultConfig);
    expect(result.raw).toBe(2);
  });

  test('uses lowest rank when candidates have mixed ranks', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10), candidate(30)] },
      defaultConfig,
    );
    expect(result.raw).toBeGreaterThanOrEqual(18);
  });
});

describe('scoreAuthority - bonuses', () => {
  test('amendment present adds 1 bonus', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10, { isAmendment: true })] },
      defaultConfig,
    );
    expect(result.raw).toBe(19);
  });

  test('multiple tier levels adds 1 bonus', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10), candidate(20)] },
      defaultConfig,
    );
    expect(result.raw).toBe(19);
  });

  test('both bonuses max at 20', () => {
    const result = scoreAuthority(
      {
        ...base,
        candidates: [candidate(10, { isAmendment: true }), candidate(20)],
      },
      defaultConfig,
    );
    expect(result.raw).toBe(20);
  });

  test('raw never exceeds 20', () => {
    const result = scoreAuthority(
      {
        ...base,
        candidates: [
          candidate(10, { isAmendment: true }),
          candidate(20, { isAmendment: true }),
          candidate(30),
        ],
      },
      defaultConfig,
    );
    expect(result.raw).toBeLessThanOrEqual(20);
  });
});

describe('scoreAuthority - custom tiers', () => {
  const customConfig: ScoringConfig = {
    authority: {
      tiers: [
        { name: 'Constitution', rank: 10, keywords: ['constitution', 'charter'] },
        { name: 'Policy', rank: 20, keywords: ['policy', 'handbook'] },
        { name: 'Guideline', rank: 30, keywords: ['guideline', 'faq'] },
      ],
    },
  };

  test('keyword match resolves rank when authorityRank not set', () => {
    const c: Candidate = {
      retrievalScores: { semantic: 0.8 },
      combinedScore: 0.8,
      documentType: 'Company Constitution v2',
    };
    const result = scoreAuthority({ ...base, candidates: [c] }, customConfig);
    expect(result.raw).toBe(18);
  });

  test('unrecognized documentType returns unclassified rank 99 and base 2', () => {
    const c: Candidate = {
      retrievalScores: { semantic: 0.8 },
      combinedScore: 0.8,
      documentType: 'Meeting Notes 2024',
    };
    const result = scoreAuthority({ ...base, candidates: [c] }, customConfig);
    expect(result.raw).toBe(2);
  });

  test('explicit authorityRank takes precedence over keyword matching', () => {
    const c: Candidate = {
      retrievalScores: { semantic: 0.8 },
      combinedScore: 0.8,
      authorityRank: 20,
      documentType: 'Company Constitution',
    };
    const result = scoreAuthority({ ...base, candidates: [c] }, customConfig);
    expect(result.raw).toBe(13);
  });
});

describe('scoreAuthority - DimensionScore shape', () => {
  test('returns all required fields', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 20);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
  });

  test('normalized = round(raw / 20 * 100)', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(20)] }, defaultConfig);
    expect(result.normalized).toBe(Math.round((result.raw / 20) * 100));
  });
});
