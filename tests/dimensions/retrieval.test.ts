import { describe, expect, test } from 'vitest';
import { scoreRetrieval } from '../../src/dimensions/retrieval';
import type { Candidate, ScoringInputs } from '../../src/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Candidate confirmed by 2 methods with high scores. */
function confirmed(combinedScore = 0.85, documentId?: string): Candidate {
  return {
    retrievalScores: { semantic: 0.82, keyword: 0.78 },
    combinedScore,
    ...(documentId !== undefined && { documentId }),
  };
}

/** Candidate from semantic only (single method). */
function semanticOnly(combinedScore = 0.75, documentId?: string): Candidate {
  return {
    retrievalScores: { semantic: combinedScore },
    combinedScore,
    ...(documentId !== undefined && { documentId }),
  };
}

const base: ScoringInputs = {
  confidenceLevel: 'high',
  candidates: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scoreRetrieval — no candidates', () => {
  test('empty candidates → raw 0', () => {
    const result = scoreRetrieval(base);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
  });
});

describe('scoreRetrieval — method agreement sub-signal', () => {
  test('3+ candidates confirmed by 2+ methods → agreement 15', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [confirmed(0.85), confirmed(0.83), confirmed(0.81)],
    });
    // agreement(15) + magnitude(8 for avg ~0.83) + breadth(1 for 3 candidates) = 24
    expect(result.raw).toBeGreaterThanOrEqual(22);
  });

  test('2 confirmed candidates → agreement 12', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [confirmed(0.85), confirmed(0.83), semanticOnly(0.60)],
    });
    // agreement=12, check it's reflected in score
    expect(result.raw).toBeGreaterThanOrEqual(12);
  });

  test('1 confirmed candidate → agreement 8', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [confirmed(0.80), semanticOnly(0.55), semanticOnly(0.50)],
    });
    expect(result.raw).toBeGreaterThanOrEqual(8);
  });

  test('0 confirmed candidates → agreement 3', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [semanticOnly(0.80), semanticOnly(0.75)],
    });
    // agreement=3 + magnitude 6 (avg 0.775) + diversity 0 + breadth 0 (2 < 3) = 9
    expect(result.raw).toBe(9);
  });
});

describe('scoreRetrieval — magnitude sub-signal', () => {
  test('avg effective score >= 0.80 → magnitude 8', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [confirmed(0.90), confirmed(0.85), confirmed(0.82)],
    });
    // All confirmed (15) + magnitude 8 + breadth 1 = 24
    expect(result.raw).toBe(24);
  });

  test('avg effective score 0.65–0.79 → magnitude 6', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [semanticOnly(0.70), semanticOnly(0.68), semanticOnly(0.66)],
    });
    // agreement 3 + magnitude 6 + breadth 1 = 10
    expect(result.raw).toBe(10);
  });

  test('avg effective score < 0.35 → magnitude 0', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [semanticOnly(0.30), semanticOnly(0.28)],
    });
    // agreement 3 + magnitude 0 (avg 0.29 < 0.35) + diversity 0 + breadth 0 (2 < 3) = 3
    expect(result.raw).toBe(3);
  });

  test('extractionQuality reduces effective score', () => {
    const withQuality: Candidate = {
      retrievalScores: { semantic: 0.9, keyword: 0.85 },
      combinedScore: 0.90,
      extractionQuality: 0.40,
    };
    const withoutQuality: Candidate = {
      retrievalScores: { semantic: 0.9, keyword: 0.85 },
      combinedScore: 0.90,
    };
    const withResult = scoreRetrieval({ ...base, candidates: [withQuality] });
    const withoutResult = scoreRetrieval({ ...base, candidates: [withoutQuality] });
    // 0.90 * 0.40 = 0.36 effective — should score lower magnitude
    expect(withResult.raw).toBeLessThan(withoutResult.raw);
  });
});

describe('scoreRetrieval — source diversity sub-signal', () => {
  test('3+ unique documentIds → +3 diversity pts', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [
        confirmed(0.85, 'doc-a'),
        confirmed(0.83, 'doc-b'),
        confirmed(0.81, 'doc-c'),
      ],
    });
    // agreement 15 + magnitude 8 + diversity 3 + breadth 1 = 27 → capped at 25
    expect(result.raw).toBe(25);
  });

  test('2 unique documentIds → +1 diversity pts', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [semanticOnly(0.70, 'doc-a'), semanticOnly(0.68, 'doc-b')],
    });
    // agreement 3 + magnitude 6 (avg 0.69) + diversity 1 + breadth 0 (2 < 3) = 10
    expect(result.raw).toBe(10);
  });

  test('no documentId provided → 0 diversity pts', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [semanticOnly(0.70), semanticOnly(0.68)],
    });
    // agreement 3 + magnitude 6 (avg 0.69) + diversity 0 + breadth 0 (2 < 3) = 9
    expect(result.raw).toBe(9);
  });
});

describe('scoreRetrieval — section breadth sub-signal', () => {
  test('5+ candidates → +2 breadth pts', () => {
    const candidates = [
      semanticOnly(0.50),
      semanticOnly(0.50),
      semanticOnly(0.50),
      semanticOnly(0.50),
      semanticOnly(0.50),
    ];
    const result = scoreRetrieval({ ...base, candidates });
    // agreement 3 + magnitude 4 + diversity 0 + breadth 2 = 9
    expect(result.raw).toBe(9);
  });

  test('3–4 candidates → +1 breadth pt', () => {
    const candidates = [semanticOnly(0.50), semanticOnly(0.50), semanticOnly(0.50)];
    const result = scoreRetrieval({ ...base, candidates });
    // agreement 3 + magnitude 4 + breadth 1 = 8
    expect(result.raw).toBe(8);
  });

  test('1–2 candidates → +0 breadth pts', () => {
    const result = scoreRetrieval({ ...base, candidates: [semanticOnly(0.50)] });
    // agreement 3 + magnitude 4 + breadth 0 = 7
    expect(result.raw).toBe(7);
  });
});

describe('scoreRetrieval — cap and shape', () => {
  test('score never exceeds 25', () => {
    const result = scoreRetrieval({
      ...base,
      candidates: [
        confirmed(0.95, 'doc-a'),
        confirmed(0.93, 'doc-b'),
        confirmed(0.91, 'doc-c'),
        confirmed(0.89, 'doc-d'),
        confirmed(0.87, 'doc-e'),
      ],
    });
    expect(result.raw).toBe(25);
  });

  test('returns all required DimensionScore fields', () => {
    const result = scoreRetrieval({ ...base, candidates: [confirmed(0.8)] });
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('max', 25);
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('explanation');
  });

  test('normalized = round(raw / 25 * 100)', () => {
    const result = scoreRetrieval({ ...base, candidates: [semanticOnly(0.50)] });
    expect(result.normalized).toBe(Math.round((result.raw / 25) * 100));
  });
});
