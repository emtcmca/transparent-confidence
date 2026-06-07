# Migrating from v0.1.x to v0.2.0

This guide covers every breaking change and behavioral difference between v0.1.x and v0.2.0. Apply each section in order.

---

## 1. Required field renames

Three fields were renamed. This is a direct find-and-replace — no logic changes.

| v0.1.x | v0.2.0 | Location |
|---|---|---|
| `confidenceLevel` | `supportLevel` | `ScoringInputs` |
| `corpusDocCount` | `corpusTypeCount` | `ScoringInputs` |
| `corpus.expectedDocCount` | `corpus.expectedTypeCount` | `ScoringConfig.corpus` |

**Before:**
```typescript
computeConfidence({
  confidenceLevel: 'high',
  corpusDocCount: 4,
  candidates: [...],
}, {
  corpus: { expectedDocCount: 5 },
});
```

**After:**
```typescript
computeConfidence({
  supportLevel: 'high',
  corpusTypeCount: 4,
  candidates: [...],
}, {
  corpus: { expectedTypeCount: 5 },
});
```

Verify with:
```bash
npx rg "confidenceLevel|corpusDocCount|expectedDocCount" src tests examples
```

Expected: no matches.

---

## 2. Add `hasConflict: false` where it was omitted

**What changed:** Omitting both `hasConflict` and `conflictingCandidateCount` now generates a `missing-conflict-signal` warning. By default, this warning triggers `recommendedAction: 'review'` via the default `reviewOnWarnings` policy — even when the total score is high.

**What to do:** Wherever your LLM pipeline confirms there is no conflict, add `hasConflict: false` (or `conflictingCandidateCount: 0`) explicitly:

```typescript
computeConfidence({
  supportLevel: 'high',
  hasConflict: false,  // add this
  candidates: [...],
});
```

If your pipeline cannot determine conflict status, the warning and conservative scoring are intentional — the library is signaling that it cannot rule out conflicts.

---

## 3. Handle `recommendedAction` and `actionReason`

`recommendedAction` and `actionReason` are now always present on the scorecard (non-optional in the TypeScript types). If you have downstream code that reads these fields, no changes are needed. If you were ignoring them before, you may want to add runtime gating:

```typescript
const scorecard = computeConfidence(inputs, config);

if (scorecard.recommendedAction === 'abstain') {
  return { answer: null, reason: scorecard.actionReason };
}
if (scorecard.recommendedAction === 'review') {
  return { answer, reviewRequired: true };
}
return { answer };
```

---

## 4. Review default policy behavior

The default action policy:

```typescript
{
  answerAt: 65,
  reviewAt: 40,
  abstainBelow: 40,
  requireTier1AtLeast: 40,
  reviewOnWarnings: ['missing-answer-relevance', 'missing-conflict-signal'],
  abstainOnWarnings: ['documents-silent'],
}
```

**Implication:** if your code omits conflict signals and previously got `answer` from a high-scoring call, you will now get `review` until you add explicit conflict signals. This is intentional — the library defaults to conservative behavior.

To restore v0.1 behavior without changing your inputs, override the policy:

```typescript
computeConfidence(inputs, {
  actionPolicy: { reviewOnWarnings: [] },
});
```

---

## 5. Update Authority extension usage

**What changed:** The default authority aggregation switched from "best source wins" (min-rank) to weighted average across top-K candidates.

**Impact on scores:** If your corpus has a mix of high-authority and low-authority sources, weighted aggregation will produce lower authority scores than v0.1, because low-authority candidates now reduce the weighted average.

**To restore v0.1 behavior:**

```typescript
computeConfidence(inputs, {
  authority: { aggregation: 'best' },
});
```

**To use v0.2 weighted aggregation:** No config needed. It is the default.

---

## 6. Update Evidence Consistency scores

**What changed:** Sub-signal point tables were revised.

| Condition | v0.1 stability pts | v0.2 stability pts |
|---|---|---|
| No candidates | 0 | 0 |
| 1 candidate | 4 | 3 |
| std dev < 0.10 | 8 | 6 |
| std dev < 0.20 | 6 | 5 |
| std dev < 0.30 | 4 | 3 |
| std dev ≥ 0.30 | 2 | 1 |

| Condition | v0.1 conflict pts | v0.2 conflict pts |
|---|---|---|
| No conflict | +2 | 4 |
| No signal | (same as no conflict) | 2 + warning |
| 1 conflicting | 0 | 1 |
| 2+ conflicting | −2 | 0 |

The consistency dimension maximum (10) is unchanged.

**Impact:** If you pass explicit `hasConflict: false`, the total consistency score for tight-retrieval pipelines will be 6+4 = 10 — identical to v0.1 maximum. If you omit the conflict signal, you get 6+2 = 8 maximum instead of the previous 10.

---

## 7. Expect new fields on `meta`

v0.2 adds fields to `scorecard.meta`. These are additive — no removals. Update any code that serializes or validates the full meta object:

**New fields:**
- `meta.algorithmVersion` — `'0.2.0'`
- `meta.schemaVersion` — `'0.2'`
- `meta.activeDimensions` — replaces needing to infer from `activeExtensions`
- `meta.warnings` — structured warnings array
- `meta.missingSignals` — string array
- `meta.weights` — active dimension weights

---

## 8. Expect `breakdown` on `DimensionScore`

`DimensionScore.breakdown` is now populated for all active dimensions (previously undefined). If you were testing for `breakdown === undefined`, update those checks.

The invariant `breakdown.raw === DimensionScore.raw` holds for every dimension.

---

## 9. Update integration test totals

Phase 7 changes (authority weighted aggregation) may reduce authority dimension scores in scenarios with mixed-authority sources. Run your integration tests and update expected totals if they fail.

Specifically: the authority dimension now scores based on the weighted average across top-K candidates, not the best single source. A single primary source among many unclassified sources will score lower in v0.2 than in v0.1.

---

## Quick checklist

- [ ] Replace `confidenceLevel` → `supportLevel`
- [ ] Replace `corpusDocCount` → `corpusTypeCount`
- [ ] Replace `corpus.expectedDocCount` → `corpus.expectedTypeCount`
- [ ] Add `hasConflict: false` or `conflictingCandidateCount: 0` to calls without conflict signal
- [ ] Handle `recommendedAction` in application code
- [ ] Decide whether to keep `reviewOnWarnings: ['missing-conflict-signal']` default or customize
- [ ] Verify authority scores if using Authority extension (weighted vs. best)
- [ ] Update integration test totals if they changed
- [ ] Remove any code that checked `breakdown === undefined`
- [ ] Handle new `meta` fields in serialization/validation code
