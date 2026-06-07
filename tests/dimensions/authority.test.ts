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

// ─────────────────────────────────────────────────────────────
// Empty candidates
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - no candidates', () => {
  test('empty candidates returns raw 0', () => {
    const result = scoreAuthority(base, defaultConfig);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Single-candidate base scores (weighted == best for n=1)
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - single-candidate base scores', () => {
  test('rank <= 10 → base 18', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result.raw).toBe(18);
  });

  test('rank <= 20 → base 13', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(20)] }, defaultConfig);
    expect(result.raw).toBe(13);
  });

  test('rank <= 30 → base 7', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(30)] }, defaultConfig);
    expect(result.raw).toBe(7);
  });

  test('rank > 30 (unclassified) → base 2', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(99)] }, defaultConfig);
    expect(result.raw).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// Weighted aggregation (v0.2 default)
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - weighted aggregation (default)', () => {
  test('rank 10 + rank 30, equal weights → weighted base 13, +tier bonus → 14', () => {
    // sumScores=1.6, weights=[0.5,0.5], pts=[18,7] → 12.5 → round 13 + tier bonus 1 = 14
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10), candidate(30)] },
      defaultConfig,
    );
    expect(result.raw).toBe(14);
  });

  test('rank 10 + rank 20, equal weights → weighted base 16, +tier bonus → 17', () => {
    // pts=[18,13], weights=[0.5,0.5] → 15.5 → 16 + tier bonus 1 = 17
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10), candidate(20)] },
      defaultConfig,
    );
    expect(result.raw).toBe(17);
  });

  test('rank 10 amendment + rank 20 → weighted base 16, +amendment +tier bonus → 18', () => {
    // 15.5 → 16 + 1 (amendment) + 1 (tiers) = 18
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10, { isAmendment: true }), candidate(20)] },
      defaultConfig,
    );
    expect(result.raw).toBe(18);
  });

  test('single primary source among 4 unclassified — no longer forces 18+', () => {
    // rank 10 (pts 18) + 4× rank 99 (pts 2 each), equal combinedScores
    // weights = 0.2 each → weighted = 0.2*18 + 4*0.2*2 = 3.6 + 1.6 = 5.2 → 5
    // bonuses: tier1 + unclassified = 2 unique → +1 tier; no amendment; total = 6
    const result = scoreAuthority(
      {
        ...base,
        candidates: [candidate(10), candidate(99), candidate(99), candidate(99), candidate(99)],
      },
      defaultConfig,
    );
    expect(result.raw).toBeLessThan(18);
  });

  test('unequal combinedScores weight higher-scoring candidates more', () => {
    // rank 10, combinedScore 0.9 vs rank 30, combinedScore 0.1
    // sumScores=1.0, weights=[0.9, 0.1], pts=[18, 7] → 0.9*18+0.1*7 = 16.2+0.7 = 16.9 → 17
    // +1 tier bonus = 18
    const hi = { ...candidate(10), combinedScore: 0.9 };
    const lo = { ...candidate(30), combinedScore: 0.1 };
    const result = scoreAuthority({ ...base, candidates: [hi, lo] }, defaultConfig);
    expect(result.raw).toBe(18);
  });

  test('all-zero combinedScores → uniform weights (no divide-by-zero)', () => {
    const c10 = { ...candidate(10), combinedScore: 0 };
    const c20 = { ...candidate(20), combinedScore: 0 };
    // uniform: pts=[18,13] → 15.5 → 16, +tier 1 = 17
    const result = scoreAuthority({ ...base, candidates: [c10, c20] }, defaultConfig);
    expect(result.raw).toBe(17);
  });
});

// ─────────────────────────────────────────────────────────────
// aggregation: 'best' — v0.1 backward compat
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - aggregation: best (v0.1 compat)', () => {
  const bestConfig: ScoringConfig = { authority: { aggregation: 'best' } };

  test('rank 10 + rank 30 → min rank 10 → base 18 + tier bonus → 19', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10), candidate(30)] },
      bestConfig,
    );
    expect(result.raw).toBe(19);
  });

  test('rank 10 amendment + rank 20 → base 18 + amendment + tier = 20', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10, { isAmendment: true }), candidate(20)] },
      bestConfig,
    );
    expect(result.raw).toBe(20);
  });

  test('single rank 10 → base 18 (same as default)', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, bestConfig);
    expect(result.raw).toBe(18);
  });
});

// ─────────────────────────────────────────────────────────────
// Bonuses
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - bonuses', () => {
  test('amendment present on single candidate → +1', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10, { isAmendment: true })] },
      defaultConfig,
    );
    expect(result.raw).toBe(19);
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

// ─────────────────────────────────────────────────────────────
// topK
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - topK', () => {
  test('topK=1 uses only the highest combinedScore candidate', () => {
    const topConfig: ScoringConfig = { authority: { topK: 1 } };
    // rank 10 with combinedScore 0.9 is top, rank 30 with 0.1 excluded
    const hi = { ...candidate(10), combinedScore: 0.9 };
    const lo = { ...candidate(30), combinedScore: 0.1 };
    const result = scoreAuthority({ ...base, candidates: [hi, lo] }, topConfig);
    // Only hi: base 18, no tier diversity bonus (single candidate), no amendment → 18
    expect(result.raw).toBe(18);
  });

  test('topK=3 with 5 candidates limits to 3', () => {
    const topConfig: ScoringConfig = { authority: { topK: 3 } };
    const candidates = [
      { ...candidate(10), combinedScore: 0.9 },
      { ...candidate(10), combinedScore: 0.8 },
      { ...candidate(10), combinedScore: 0.7 },
      { ...candidate(30), combinedScore: 0.3 },
      { ...candidate(30), combinedScore: 0.2 },
    ];
    // top 3 all rank 10, same bucket, no tier diversity → no +1 tier; no amendment
    // weighted = 18, raw = 18
    const result = scoreAuthority({ ...base, candidates }, topConfig);
    expect(result.breakdown?.diagnostics?.includedCount).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// Unclassified warnings
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - unclassified warnings', () => {
  test('candidate with no authorityRank and no documentType → warning', () => {
    const c: Candidate = { retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 };
    const result = scoreAuthority({ ...base, candidates: [c] }, defaultConfig);
    const codes = result.warnings?.map((w) => w.code) ?? [];
    expect(codes).toContain('authority-unclassified');
  });

  test('all classified → no warning', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result.warnings).toHaveLength(0);
  });

  test('breakdown.diagnostics.unclassifiedCount = 2 when two unclassified', () => {
    const c = (cs: number): Candidate => ({
      retrievalScores: { semantic: cs },
      combinedScore: cs,
    });
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10), c(0.5), c(0.4)] },
      defaultConfig,
    );
    expect(result.breakdown?.diagnostics?.unclassifiedCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// Custom tiers
// ─────────────────────────────────────────────────────────────

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

  test('unrecognized documentType returns unclassified rank 99 → base 2', () => {
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

  test('keyword match case-insensitive', () => {
    const c: Candidate = {
      retrievalScores: { semantic: 0.8 },
      combinedScore: 0.8,
      documentType: 'COMPANY HANDBOOK',
    };
    const result = scoreAuthority({ ...base, candidates: [c] }, customConfig);
    expect(result.raw).toBe(13);
  });
});

// ─────────────────────────────────────────────────────────────
// Breakdown shape
// ─────────────────────────────────────────────────────────────

describe('scoreAuthority - breakdown', () => {
  test('breakdown.raw equals DimensionScore.raw', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result.breakdown?.raw).toBe(result.raw);
  });

  test('breakdown.components.weightedAuthority present', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result.breakdown?.components).toHaveProperty('weightedAuthority');
  });

  test('breakdown.diagnostics.aggregation = weighted by default', () => {
    const result = scoreAuthority({ ...base, candidates: [candidate(10)] }, defaultConfig);
    expect(result.breakdown?.diagnostics?.aggregation).toBe('weighted');
  });

  test('breakdown.diagnostics.aggregation = best when configured', () => {
    const result = scoreAuthority(
      { ...base, candidates: [candidate(10)] },
      {
        authority: { aggregation: 'best' },
      },
    );
    expect(result.breakdown?.diagnostics?.aggregation).toBe('best');
  });

  test('returns all required DimensionScore fields', () => {
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
