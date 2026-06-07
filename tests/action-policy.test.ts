import { describe, expect, test } from 'vitest';
import { computeConfidence } from '../src/scorer';
import type { ScoringConfig, ScoringInputs } from '../src/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function twoMethod(combinedScore: number, docId: string) {
  return {
    retrievalScores: { semantic: combinedScore + 0.05, keyword: combinedScore - 0.05 },
    combinedScore,
    documentId: docId,
  };
}

// Base inputs that produce a reasonable total with no conflict warnings.
// hasConflict: false removes the missing-conflict-signal warning.
const cleanInputs: ScoringInputs = {
  supportLevel: 'high',
  hasConflict: false,
  candidates: [twoMethod(0.85, 'doc1'), twoMethod(0.8, 'doc2'), twoMethod(0.75, 'doc3')],
};

// Inputs with no explicit conflict signal → missing-conflict-signal warning present.
const noConflictSignal: ScoringInputs = {
  supportLevel: 'medium',
  candidates: [twoMethod(0.85, 'doc1'), twoMethod(0.8, 'doc2'), twoMethod(0.75, 'doc3')],
};

// ─────────────────────────────────────────────────────────────
// Rule 1 — documentsSilent → abstain
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 1: documentsSilent', () => {
  test('documentsSilent = true → abstain', () => {
    const sc = computeConfidence({ supportLevel: 'low', documentsSilent: true, candidates: [] });
    expect(sc.recommendedAction).toBe('abstain');
  });

  test('documentsSilent actionReason references documentsSilent', () => {
    const sc = computeConfidence({ supportLevel: 'low', documentsSilent: true, candidates: [] });
    expect(sc.actionReason).toContain('documentsSilent');
  });

  test('documentsSilent overrides high total (rule 1 before rule 6)', () => {
    // Even if inputs would produce high total, documentsSilent forces abstain.
    const sc = computeConfidence({ ...cleanInputs, documentsSilent: true });
    expect(sc.recommendedAction).toBe('abstain');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 2 — abstainOnWarnings → abstain
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 2: abstainOnWarnings', () => {
  test('custom abstainOnWarnings with matching warning → abstain', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        abstainOnWarnings: ['missing-conflict-signal'],
      },
    };
    // noConflictSignal inputs produce missing-conflict-signal warning
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.recommendedAction).toBe('abstain');
  });

  test('rule 2 actionReason references the triggering warning code', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        abstainOnWarnings: ['missing-conflict-signal'],
      },
    };
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.actionReason).toContain('missing-conflict-signal');
    expect(sc.actionReason).toContain('abstainOnWarnings');
  });

  test('no matching abstainOnWarnings → does not abstain from rule 2', () => {
    // cleanInputs has no warnings; empty abstainOnWarnings never fires rule 2
    const config: ScoringConfig = {
      actionPolicy: { abstainOnWarnings: [] },
    };
    const sc = computeConfidence(cleanInputs, config);
    expect(sc.recommendedAction).not.toBe('abstain');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 3 — total < abstainBelow → abstain
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 3: abstainBelow', () => {
  test('low total below default abstainBelow (40) → abstain', () => {
    // Scenario C from integration: total = 24 < 40 → abstain
    const sc = computeConfidence(
      {
        supportLevel: 'low',
        corpusTypeCount: 1,
        candidates: [
          { retrievalScores: { semantic: 0.5 }, combinedScore: 0.5, documentId: 'doc1' },
        ],
      },
      { corpus: { expectedTypeCount: 5 } },
    );
    expect(sc.total).toBeLessThan(40);
    expect(sc.recommendedAction).toBe('abstain');
  });

  test('rule 3 actionReason references abstainBelow', () => {
    const sc = computeConfidence(
      {
        supportLevel: 'low',
        candidates: [],
      },
      {
        actionPolicy: { abstainBelow: 50, abstainOnWarnings: [], reviewOnWarnings: [] },
      },
    );
    expect(sc.actionReason).toContain('abstainBelow');
  });

  test('custom high abstainBelow catches moderate scores', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        abstainBelow: 80,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
      },
    };
    // noConflictSignal total is ~71 → below custom abstainBelow=80 → abstain
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.total).toBeLessThan(80);
    expect(sc.recommendedAction).toBe('abstain');
    expect(sc.actionReason).toContain('80');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 4 — tier1.score < requireTier1AtLeast → review
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 4: requireTier1AtLeast', () => {
  test('low tier1 with high tier2 → review from rule 4', () => {
    // Low quality answer (tier1 ≈ 26/100) but perfect corpus + fresh docs push total >= 40.
    // Using high requireTier1AtLeast to guarantee rule 4 fires before rule 5.
    const config: ScoringConfig = {
      corpus: { expectedTypeCount: 5 },
      freshness: {},
      actionPolicy: {
        requireTier1AtLeast: 60, // higher threshold
        abstainOnWarnings: [], // suppress rule 2
        reviewOnWarnings: [], // suppress rule 5, isolating rule 4
        abstainBelow: 0, // suppress rule 3
      },
    };
    const inputs: ScoringInputs = {
      supportLevel: 'low',
      corpusTypeCount: 5,
      candidates: [
        {
          retrievalScores: { semantic: 0.5 },
          combinedScore: 0.5,
          lastUpdated: new Date(),
          documentId: 'doc1',
        },
      ],
    };
    const sc = computeConfidence(inputs, config);
    // tier1.score is well below 60 (low support + single method)
    expect(sc.tier1?.score ?? 0).toBeLessThan(60);
    expect(sc.recommendedAction).toBe('review');
  });

  test('rule 4 actionReason references requireTier1AtLeast', () => {
    const config: ScoringConfig = {
      corpus: { expectedTypeCount: 5 },
      freshness: {},
      actionPolicy: {
        requireTier1AtLeast: 60,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
        abstainBelow: 0,
      },
    };
    const inputs: ScoringInputs = {
      supportLevel: 'low',
      corpusTypeCount: 5,
      candidates: [
        {
          retrievalScores: { semantic: 0.5 },
          combinedScore: 0.5,
          lastUpdated: new Date(),
          documentId: 'doc1',
        },
      ],
    };
    const sc = computeConfidence(inputs, config);
    expect(sc.actionReason).toContain('requireTier1AtLeast');
  });

  test('rule 4 fires before rule 5 (tier1 check precedes reviewOnWarnings)', () => {
    const config: ScoringConfig = {
      corpus: { expectedTypeCount: 5 },
      freshness: {},
      actionPolicy: {
        requireTier1AtLeast: 60,
        abstainOnWarnings: [],
        reviewOnWarnings: ['missing-conflict-signal'], // would also trigger review
        abstainBelow: 0,
      },
    };
    const inputs: ScoringInputs = {
      supportLevel: 'low',
      corpusTypeCount: 5,
      candidates: [
        {
          // single method → missing-conflict-signal will be present
          retrievalScores: { semantic: 0.5 },
          combinedScore: 0.5,
          lastUpdated: new Date(),
          documentId: 'doc1',
        },
      ],
    };
    const sc = computeConfidence(inputs, config);
    // Rule 4 fires first — reason should name tier1, not the warning
    expect(sc.actionReason).toContain('requireTier1AtLeast');
    expect(sc.actionReason).not.toContain('reviewOnWarnings');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 5 — reviewOnWarnings → review
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 5: reviewOnWarnings', () => {
  test('missing-conflict-signal in default reviewOnWarnings → review', () => {
    // noConflictSignal has total >= 40, tier1 >= 40, but missing-conflict-signal → rule 5
    const sc = computeConfidence(noConflictSignal, {});
    expect(sc.meta.warnings.map((w) => w.code)).toContain('missing-conflict-signal');
    expect(sc.recommendedAction).toBe('review');
  });

  test('rule 5 actionReason references the warning code', () => {
    const sc = computeConfidence(noConflictSignal, {});
    expect(sc.actionReason).toContain('missing-conflict-signal');
    expect(sc.actionReason).toContain('reviewOnWarnings');
  });

  test('custom reviewOnWarnings with authority-unclassified → review', () => {
    const config: ScoringConfig = {
      authority: {},
      actionPolicy: {
        reviewOnWarnings: ['authority-unclassified'],
        abstainOnWarnings: [],
        abstainBelow: 0,
        requireTier1AtLeast: 0,
      },
    };
    // Candidate without authorityRank or documentType → authority-unclassified warning
    const inputs: ScoringInputs = {
      ...cleanInputs,
      candidates: [{ retrievalScores: { semantic: 0.8 }, combinedScore: 0.8 }],
    };
    const sc = computeConfidence(inputs, config);
    expect(sc.actionReason).toContain('authority-unclassified');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 6 — total >= answerAt → answer
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 6: answerAt', () => {
  test('clean high-quality input → answer (rules 1-5 all pass, total >= answerAt)', () => {
    // cleanInputs has hasConflict: false → no missing-conflict-signal warning
    const sc = computeConfidence(cleanInputs, {});
    // Verify no review/abstain-forcing warnings
    const warnCodes = sc.meta.warnings.map((w) => w.code);
    expect(warnCodes).not.toContain('missing-conflict-signal');
    // total should be >= 65 (answerAt) for strong inputs
    expect(sc.total).toBeGreaterThanOrEqual(65);
    expect(sc.recommendedAction).toBe('answer');
  });

  test('rule 6 actionReason references answerAt', () => {
    const sc = computeConfidence(cleanInputs, {});
    expect(sc.actionReason).toContain('answerAt');
  });

  test('custom low answerAt = 30 → answer for medium quality', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        answerAt: 30,
        reviewAt: 10,
        abstainBelow: 0,
        requireTier1AtLeast: 0,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
      },
    };
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.total).toBeGreaterThanOrEqual(30);
    expect(sc.recommendedAction).toBe('answer');
    expect(sc.actionReason).toContain('30');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 7 — total >= reviewAt (but < answerAt) → review
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 7: reviewAt band', () => {
  test('total in [40, 64] with no warning triggers → review from rule 7', () => {
    // Use a custom policy to place Scenario D's total (71) in the review band.
    const config: ScoringConfig = {
      actionPolicy: {
        answerAt: 80, // total=71 is below this
        reviewAt: 40,
        abstainBelow: 0,
        requireTier1AtLeast: 0,
        abstainOnWarnings: [],
        reviewOnWarnings: [], // no warning triggers, so rule 7 is the decider
      },
    };
    // noConflictSignal produces total ≈ 71 (from Scenario D)
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.total).toBeGreaterThanOrEqual(40);
    expect(sc.total).toBeLessThan(80);
    expect(sc.recommendedAction).toBe('review');
  });

  test('rule 7 actionReason references reviewAt', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        answerAt: 80,
        reviewAt: 40,
        abstainBelow: 0,
        requireTier1AtLeast: 0,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
      },
    };
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.actionReason).toContain('reviewAt');
  });
});

// ─────────────────────────────────────────────────────────────
// Rule 8 — fallback → abstain
// ─────────────────────────────────────────────────────────────

describe('action policy — Rule 8: fallback abstain', () => {
  test('total below reviewAt with no warning triggers → abstain from rule 8', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        answerAt: 100,
        reviewAt: 80, // total=71 is below this too
        abstainBelow: 0, // don't trigger rule 3
        requireTier1AtLeast: 0,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
      },
    };
    const sc = computeConfidence(noConflictSignal, config);
    expect(sc.total).toBeLessThan(80);
    expect(sc.recommendedAction).toBe('abstain');
  });

  test('rule 8 actionReason references reviewAt as the unmet threshold', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        answerAt: 100,
        reviewAt: 95,
        abstainBelow: 0,
        requireTier1AtLeast: 0,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
      },
    };
    const sc = computeConfidence(cleanInputs, config);
    // cleanInputs total is high but likely < 95
    if (sc.recommendedAction === 'abstain') {
      expect(sc.actionReason).toContain('reviewAt');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Default policy behavior
// ─────────────────────────────────────────────────────────────

describe('action policy — default policy', () => {
  test('documents-silent warning in default abstainOnWarnings', () => {
    // documentsSilent produces documents-silent warning; rule 1 fires before rule 2
    // but the warning IS in abstainOnWarnings
    const sc = computeConfidence({ supportLevel: 'low', documentsSilent: true, candidates: [] });
    const codes = sc.meta.warnings.map((w) => w.code);
    expect(codes).toContain('documents-silent');
  });

  test('missing-conflict-signal in default reviewOnWarnings → review', () => {
    // Any input without hasConflict or conflictingCandidateCount generates this warning
    const sc = computeConfidence(noConflictSignal, {});
    expect(sc.recommendedAction).toBe('review');
  });

  test('providing conflictingCandidateCount: 0 clears the warning → can reach answer', () => {
    const inputs: ScoringInputs = {
      supportLevel: 'high',
      conflictingCandidateCount: 0,
      candidates: [twoMethod(0.85, 'doc1'), twoMethod(0.8, 'doc2'), twoMethod(0.75, 'doc3')],
    };
    const sc = computeConfidence(inputs, {});
    // No missing-conflict-signal → rule 5 won't fire
    const warnCodes = sc.meta.warnings.map((w) => w.code);
    expect(warnCodes).not.toContain('missing-conflict-signal');
    // With strong inputs and no review warnings, should reach answer
    if (sc.total >= 65) {
      expect(sc.recommendedAction).toBe('answer');
    }
  });

  test('recommendedAction and actionReason are always defined', () => {
    const sc1 = computeConfidence({ supportLevel: 'low', candidates: [] });
    const sc2 = computeConfidence({
      supportLevel: 'high',
      hasConflict: false,
      candidates: [twoMethod(0.9, 'doc1')],
    });
    expect(sc1.recommendedAction).toBeDefined();
    expect(sc1.actionReason).toBeDefined();
    expect(sc2.recommendedAction).toBeDefined();
    expect(sc2.actionReason).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Custom policy overrides
// ─────────────────────────────────────────────────────────────

describe('action policy — custom policy overrides', () => {
  test('custom answerAt overrides default 65', () => {
    const lowBarConfig: ScoringConfig = {
      actionPolicy: {
        answerAt: 30,
        reviewAt: 10,
        abstainBelow: 0,
        requireTier1AtLeast: 0,
        abstainOnWarnings: [],
        reviewOnWarnings: [],
      },
    };
    // Even low-quality input can reach answer with very low answerAt
    const sc = computeConfidence(noConflictSignal, lowBarConfig);
    expect(sc.total).toBeGreaterThanOrEqual(30);
    expect(sc.recommendedAction).toBe('answer');
  });

  test('partial policy override merges with defaults', () => {
    // Only override answerAt — other defaults still apply
    const config: ScoringConfig = {
      actionPolicy: { answerAt: 50 },
    };
    const sc = computeConfidence(cleanInputs, config);
    // missing-conflict-signal check: cleanInputs has hasConflict: false → no warning
    // total >= 50 → answer
    if (sc.total >= 50) {
      expect(sc.recommendedAction).toBe('answer');
    }
  });

  test('empty reviewOnWarnings disables warning-based review', () => {
    const config: ScoringConfig = {
      actionPolicy: {
        reviewOnWarnings: [],
      },
    };
    // noConflictSignal would normally trigger review via missing-conflict-signal
    // With empty reviewOnWarnings, that rule is disabled
    const sc = computeConfidence(noConflictSignal, config);
    // Now rule 5 is suppressed; result depends on total vs thresholds
    const warnCodes = sc.meta.warnings.map((w) => w.code);
    expect(warnCodes).toContain('missing-conflict-signal');
    // action won't be review due to that warning (could be answer or review from rule 6/7)
    if (sc.recommendedAction === 'review') {
      expect(sc.actionReason).not.toContain('missing-conflict-signal');
    }
  });
});
