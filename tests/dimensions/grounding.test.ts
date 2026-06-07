import { describe, expect, test } from 'vitest';
import { scoreGrounding } from '../../src/dimensions/grounding';
import type { ScoringInputs } from '../../src/types';

const base: ScoringInputs = {
  supportLevel: 'high',
  candidates: [],
};

describe('scoreGrounding - base scores', () => {
  test('high support, no ambiguity returns raw 30', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'high' });

    expect(result.raw).toBe(30);
    expect(result.max).toBe(30);
  });

  test('high support with ambiguity returns raw 21', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: 'Section 4.2 is unclear' });

    expect(result.raw).toBe(21);
  });

  test('null ambiguityNotes treated as no ambiguity', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: null });

    expect(result.raw).toBe(30);
  });

  test('medium support, no ambiguity returns raw 13', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'medium' });

    expect(result.raw).toBe(13);
  });

  test('medium support with ambiguity returns raw 13 with ambiguity in explanation', () => {
    const result = scoreGrounding({
      ...base,
      supportLevel: 'medium',
      ambiguityNotes: 'Conflicting paragraphs',
    });

    expect(result.raw).toBe(13);
    expect(result.explanation).toContain('Conflicting paragraphs');
  });

  test('low support returns raw 5', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'low' });

    expect(result.raw).toBe(5);
  });
});

describe('scoreGrounding - documentsSilent', () => {
  test('documentsSilent true returns raw 0 with warning regardless of support', () => {
    const result = scoreGrounding({ ...base, supportLevel: 'high', documentsSilent: true });

    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'documents-silent' }));
  });

  test('documentsSilent true ignores penalties', () => {
    const result = scoreGrounding({
      ...base,
      documentsSilent: true,
      requiresExpertReview: true,
      hasConflict: true,
    });

    expect(result.raw).toBe(0);
  });
});

describe('scoreGrounding - standard penalties', () => {
  test('requiresExpertReview subtracts 3 from base', () => {
    const result = scoreGrounding({ ...base, requiresExpertReview: true });

    expect(result.raw).toBe(27);
  });

  test('externalConstraintNote subtracts 2 from base', () => {
    const result = scoreGrounding({
      ...base,
      externalConstraintNote: 'State statute may apply',
    });

    expect(result.raw).toBe(28);
  });

  test('hasConflict subtracts 5 from base', () => {
    const result = scoreGrounding({ ...base, hasConflict: true });

    expect(result.raw).toBe(25);
  });

  test('all three penalties stack on base 30', () => {
    const result = scoreGrounding({
      ...base,
      requiresExpertReview: true,
      externalConstraintNote: 'State statute',
      hasConflict: true,
    });

    expect(result.raw).toBe(20);
  });

  test('penalties on low support floor at 0', () => {
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

describe('scoreGrounding - queryComplexity ceiling', () => {
  test('direct applies no ceiling', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'direct' });

    expect(result.raw).toBe(30);
  });

  test('inferential ceiling 24 applies when score exceeds it', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'inferential' });

    expect(result.raw).toBe(24);
  });

  test('multi-hop ceiling 18 applies', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'multi-hop' });

    expect(result.raw).toBe(18);
  });

  test('comparative ceiling 16 applies', () => {
    const result = scoreGrounding({ ...base, queryComplexity: 'comparative' });

    expect(result.raw).toBe(16);
  });

  test('ceiling not applied when score already below ceiling', () => {
    const result = scoreGrounding({
      ...base,
      supportLevel: 'medium',
      queryComplexity: 'multi-hop',
    });

    expect(result.raw).toBe(13);
  });
});

describe('scoreGrounding - faithfulnessScore', () => {
  test('faithfulnessScore >= 0.9 has no penalty', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.95 });

    expect(result.raw).toBe(30);
  });

  test('faithfulnessScore 0.70-0.89 subtracts 3', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.75 });

    expect(result.raw).toBe(27);
  });

  test('faithfulnessScore 0.50-0.69 subtracts 7', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.6 });

    expect(result.raw).toBe(23);
  });

  test('faithfulnessScore < 0.50 subtracts 12', () => {
    const result = scoreGrounding({ ...base, faithfulnessScore: 0.4 });

    expect(result.raw).toBe(18);
  });

  test('multi-hop ceiling applies before faithfulness penalty', () => {
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

  test('missing faithfulness and claim support returns warning without score penalty', () => {
    const result = scoreGrounding(base);

    expect(result.raw).toBe(30);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'missing-faithfulness' }),
    );
  });
});

describe('scoreGrounding - claimSupport', () => {
  test('claimSupport applies support penalty when faithfulnessScore is absent', () => {
    const result = scoreGrounding({
      ...base,
      claimSupport: { totalClaims: 4, supportedClaims: 2 },
    });

    expect(result.raw).toBe(23);
    expect(result.breakdown?.diagnostics?.unsupportedClaims).toBe(2);
  });

  test('claimSupport and faithfulnessScore both present use lower support score', () => {
    const result = scoreGrounding({
      ...base,
      faithfulnessScore: 0.95,
      claimSupport: { totalClaims: 4, supportedClaims: 1 },
    });

    expect(result.raw).toBe(18);
  });

  test('contradicted claims add contradiction penalty', () => {
    const result = scoreGrounding({
      ...base,
      faithfulnessScore: 0.95,
      claimSupport: { totalClaims: 4, supportedClaims: 3, contradictedClaims: 1 },
    });

    expect(result.raw).toBe(22);
    expect(result.breakdown?.adjustments.contradictionPenalty).toBe(-5);
  });
});

describe('scoreGrounding - citation quality', () => {
  test('citationCount >= 3 adds 2 bonus capped at max', () => {
    const result = scoreGrounding({ ...base, citationCount: 4 });

    expect(result.raw).toBe(30);
  });

  test('citationCount 2 adds 1 bonus', () => {
    const result = scoreGrounding({
      ...base,
      ambiguityNotes: 'some ambiguity',
      citationCount: 2,
    });

    expect(result.raw).toBe(22);
  });

  test('citationCount 1 has no bonus', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: 'ambiguity', citationCount: 1 });

    expect(result.raw).toBe(21);
  });

  test('bonus cannot push raw above 30', () => {
    const result = scoreGrounding({ ...base, citationCount: 5 });

    expect(result.raw).toBe(30);
  });

  test('invalidCitationCount prevents citation bonus and applies penalty', () => {
    const result = scoreGrounding({
      ...base,
      ambiguityNotes: 'some ambiguity',
      citationCount: 3,
      invalidCitationCount: 1,
      faithfulnessScore: 0.95,
    });

    expect(result.raw).toBe(19);
    expect(result.breakdown?.adjustments.invalidCitationPenalty).toBe(-2);
    expect(result.breakdown?.adjustments.citationBonus).toBeUndefined();
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'invalid-citations' }));
  });

  test('multiple invalid citations apply stronger penalty', () => {
    const result = scoreGrounding({
      ...base,
      ambiguityNotes: 'some ambiguity',
      invalidCitationCount: 2,
      faithfulnessScore: 0.95,
    });

    expect(result.raw).toBe(16);
  });

  test('low citationCoverageScore applies penalty and warning', () => {
    const result = scoreGrounding({
      ...base,
      ambiguityNotes: 'some ambiguity',
      citationCoverageScore: 0.4,
      faithfulnessScore: 0.95,
    });

    expect(result.raw).toBe(18);
    expect(result.breakdown?.adjustments.citationCoveragePenalty).toBe(-3);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'low-citation-coverage' }),
    );
  });

  test('medium citationCoverageScore applies smaller penalty', () => {
    const result = scoreGrounding({
      ...base,
      ambiguityNotes: 'some ambiguity',
      citationCoverageScore: 0.7,
      faithfulnessScore: 0.95,
    });

    expect(result.raw).toBe(20);
    expect(result.breakdown?.adjustments.citationCoveragePenalty).toBe(-1);
  });
});

describe('scoreGrounding - DimensionScore shape', () => {
  test('returns all required fields and structured breakdown', () => {
    const result = scoreGrounding(base);

    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 30);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
    expect(result).toHaveProperty('breakdown');
    expect(result.breakdown?.raw).toBe(result.raw);
    expect(result.breakdown?.uncappedRaw).toBeGreaterThanOrEqual(result.raw);
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  test('normalized = round(raw / 30 * 100)', () => {
    const result = scoreGrounding({ ...base, ambiguityNotes: 'test' });

    expect(result.normalized).toBe(70);
  });
});
