import { describe, expect, test } from 'vitest';
import { scoreGrounding } from '../../src/dimensions/grounding';
import type { ScoringInputs } from '../../src/types';

const base: ScoringInputs = {
  supportLevel: 'high',
  candidates: [],
};

describe('scoreGrounding — base scores', () => {
  test('high confidence, no ambiguity → raw 30', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'high' });
    expect(result.raw).toBe(30);
    expect(result.max).toBe(30);
  });

  test('high confidence with ambiguity → raw 21', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: 'Section 4.2 is unclear' });
    expect(result.raw).toBe(21);
  });

  test('null ambiguityNotes treated as no ambiguity', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: null });
    expect(result.raw).toBe(30);
  });

  test('medium confidence, no ambiguity → raw 13', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'medium' });
    expect(result.raw).toBe(13);
  });

  test('medium confidence with ambiguity → raw 13 (ambiguity in explanation only)', () => {
    const result = scoreGrounding({
      ...base,
      supportLevel: 'medium',
      ambiguityNotes: 'Conflicting paragraphs',
    });
    expect(result.raw).toBe(13);
    expect(result.explanation).toContain('Conflicting paragraphs');
  });

  test('low confidence → raw 5', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'low' });
    expect(result.raw).toBe(5);
  });
});

describe('scoreGrounding — documentsSilent', () => {
  test('documentsSilent = true → raw 0 regardless of confidence', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'high', documentsSilent: true });
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });

  test('documentsSilent = true ignores penalties', () => {
    const result = scoreGrounding({
      ...base,
      documentsSilent: true,
      requiresExpertReview: true,
      hasConflict: true,
    });
    expect(result.raw).toBe(0);
  });
});

describe('scoreGrounding — penalties', () => {
  test('requiresExpertReview → −3 from base', () => {
    const result = scoreGrounding({ ...base, requiresExpertReview: true });
    expect(result.raw).toBe(27);
  });

  test('externalConstraintNote → −2 from base', () => {
    const result = scoreGrounding({
      ...base,
      externalConstraintNote: 'State statute may apply',
    });
    expect(result.raw).toBe(28);
  });

  test('hasConflict → −5 from base', () => {
    const result = scoreGrounding({ ...base, hasConflict: true });
    expect(result.raw).toBe(25);
  });

  test('all three penalties stacked on base 30 → raw 20', () => {
    const result = scoreGrounding({
      ...base,
      requiresExpertReview: true,
      externalConstraintNote: 'State statute',
      hasConflict: true,
    });
    expect(result.raw).toBe(20);
  });

  test('penalties on low confidence floor at 0', () => {
    const result = scoreGrounding({
      ...base,
      supportLevel: 'low',
      requiresExpertReview: true,
      externalConstraintNote: 'note',
      hasConflict: true,
    });
    expect(result.raw).toBe(0);
  });
});

describe('scoreGrounding — queryComplexity ceiling', () => {
  test('direct: no ceiling applied', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'direct' });
    expect(result.raw).toBe(30);
  });

  test('inferential: ceiling 24 applied when score exceeds it', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'inferential' });
    expect(result.raw).toBe(24);
  });

  test('multi-hop: ceiling 18', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'multi-hop' });
    expect(result.raw).toBe(18);
  });

  test('comparative: ceiling 16', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'comparative' });
    expect(result.raw).toBe(16);
  });

  test('ceiling not applied when score already below ceiling', () => {
    // medium confidence (13) + multi-hop ceiling (18) — 13 < 18, no cap
    const result = scoreGrounding({
      ...base,
      supportLevel: 'medium',
      queryComplexity: 'multi-hop',
    });
    expect(result.raw).toBe(13);
  });
});

describe('scoreGrounding — faithfulnessScore', () => {
  test('faithfulnessScore >= 0.9 → no penalty', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.95 });
    expect(result.raw).toBe(30);
  });

  test('faithfulnessScore 0.70–0.89 → −3', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.75 });
    expect(result.raw).toBe(27);
  });

  test('faithfulnessScore 0.50–0.69 → −7', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.6 });
    expect(result.raw).toBe(23);
  });

  test('faithfulnessScore < 0.50 → −12', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.4 });
    expect(result.raw).toBe(18);
  });

  test('faithfulnessScore 0.40 with multi-hop ceiling 18 → raw 6', () => {
    // base 30, ceiling 18, then −12 from faithfulness
    const result = scoreGrounding({
      ...base,
      queryComplexity: 'multi-hop',
      faithfulnessScore: 0.4,
    });
    expect(result.raw).toBe(6);
  });

  test('faithfulnessScore penalty floors at 0', () => {
    const result = scoreGrounding({
      ...base,
      supportLevel: 'low',
      faithfulnessScore: 0.1,
    });
    expect(result.raw).toBe(0);
  });
});

describe('scoreGrounding — citationCount bonus', () => {
  test('citationCount >= 3 → +2 bonus', () => {
    const result = scoreGrounding({ ...base, citationCount: 4 });
    expect(result.raw).toBe(30); // already at max, capped
  });

  test('citationCount 2 → +1 bonus', () => {
    // Start at 21 (ambiguity), +1 citation = 22
    const result = scoreGrounding({
      ...base,
      ambiguityNotes: 'some ambiguity',
      citationCount: 2,
    });
    expect(result.raw).toBe(22);
  });

  test('citationCount 1 → no bonus', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: 'ambiguity', citationCount: 1 });
    expect(result.raw).toBe(21);
  });

  test('bonus cannot push raw above 30', () => {
    const result = scoreGrounding({ ...base, citationCount: 5 });
    expect(result.raw).toBe(30);
  });
});

describe('scoreGrounding — DimensionScore shape', () => {
  test('returns all required fields', () => {
    const result = scoreGrounding(base);
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 30);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  test('normalized = round(raw / 30 * 100)', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: 'test' }); // raw 21
    expect(result.normalized).toBe(70);
  });
});
