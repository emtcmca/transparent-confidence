# Migrating from v0.2 to v0.3

v0.3 is mostly additive. Existing v0.2-style scoring remains usable, and the `legacy-v0.2` preset is available when you want v0.2-like action behavior.

## 1. Upgrade

```bash
npm install transparent-confidence@0.3.0
```

Update any tests that assert version metadata:

```typescript
expect(scorecard.meta.algorithmVersion).toBe('0.3.0');
expect(scorecard.meta.schemaVersion).toBe('0.3');
```

## 2. Choose A Preset

```typescript
computeConfidence(inputs, { preset: 'balanced-v0.3' }); // default
computeConfidence(inputs, { preset: 'legacy-v0.2' });
computeConfidence(inputs, { preset: 'production-v0.3' });
```

Use:

| Preset | When |
|---|---|
| `legacy-v0.2` | You need the closest v0.2 action behavior during migration |
| `balanced-v0.3` | You want v0.3 diagnostics without strict production gates |
| `production-v0.3` | You want missing critical semantic signals to force review |

## 3. Add Production Signals

For `production-v0.3`, provide:

- `answerRelevanceScore`
- `hasConflict` or `conflictingCandidateCount`
- `faithfulnessScore` or `claimSupport`

Example:

```typescript
const scorecard = computeConfidence(inputs, {
  preset: 'production-v0.3',
});
```

If those signals are missing, the scorecard includes `required-signal-missing` warnings and the action should not be `answer`.

If you add `signalPolicy` while using `production-v0.3`, your custom policy extends the production preset. It does not remove the production relevance, conflict, or support-evaluator requirements.

## 4. Optional: Add Retrieval Diagnostics

If your retriever can provide stable content hashes and final ranks, add:

```typescript
{
  contentHash: chunk.contentHash,
  rank: chunk.rank,
}
```

By default these are diagnostic-only. To penalize them:

```typescript
computeConfidence(inputs, {
  retrieval: {
    duplicateContent: { mode: 'penalize' },
    rankPenalty: { mode: 'penalize' },
  },
});
```

## 5. Optional: Calibrate Scores

Export historical scorecards and label outcomes as `correct`, `incorrect`, `accepted`, `rejected`, or `escalated`.

```typescript
import { analyzeCalibration } from 'transparent-confidence';

const report = analyzeCalibration(samples, {
  minSamplesPerBand: 30,
  targetPrecisionForAnswer: 0.9,
  targetRecallForAbstain: 0.8,
});
```

Apply the returned `recommendedPolicy` only after reviewing sample size and domain risk.

## 6. Optional: Merge Evaluator Outputs

```typescript
import { fromRagasLike, mergeEvaluationSignals } from 'transparent-confidence';

const signals = fromRagasLike(ragasResult);
const { inputs: enrichedInputs } = mergeEvaluationSignals(inputs, signals);
const scorecard = computeConfidence(enrichedInputs);
```

The bridge accepts plain objects only and does not import RAGAS, DeepEval, TruLens, LangSmith, or model-provider SDKs.

## 7. Optional: Add Index Integrity

Use `config.indexIntegrity` when you can supply index operational health:

```typescript
const scorecard = computeConfidence(
  {
    ...inputs,
    indexIntegrity: {
      expectedEmbeddingModelVersion: 'text-embedding-3-large@2026-01',
      actualEmbeddingModelVersion: 'text-embedding-3-large@2026-01',
      sourceVersionMatchRatio: 0.998,
      staleIndexedDocumentRatio: 0.004,
      failedIngestionCount: 0,
      aclFilterConfirmed: true,
      deletedSourceLeakageCount: 0,
    },
  },
  { indexIntegrity: {} },
);
```

This extension is inactive unless `config.indexIntegrity` is present.

## 8. Package Contents

v0.3 includes `docs/` and `examples/` in the npm package tarball. Historical v0.2 docs remain available.
