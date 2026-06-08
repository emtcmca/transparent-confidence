# Algorithm Reference - v0.3

`transparent-confidence` v0.3 computes a deterministic, auditable RAG confidence scorecard from signals supplied by your own pipeline. It does not retrieve documents, call an LLM, verify citations, or turn the score into a probability by itself.

Constants:

```typescript
ALGORITHM_VERSION = '0.3.0'
SCORECARD_SCHEMA_VERSION = '0.3'
```

## Score Meaning

The `total` score is a normalized 0-100 scorecard value. It expresses how strong the supplied retrieval, grounding, consistency, relevance, authority, corpus, freshness, and index-integrity evidence is under the active configuration.

The score is not a probability of correctness unless you calibrate it against labeled outcomes from your own system. Use `analyzeCalibration` to estimate local reliability and tune `actionPolicy` thresholds.

## Active Dimensions

Core dimensions are always active:

| Dimension | Default max | Tier | Purpose |
|---|---:|---|---|
| `grounding` | 30 | Tier 1 | Measures support level, faithfulness/claim support, citations, complexity, silence, and ambiguity |
| `retrieval` | 25 | Tier 1 | Measures method agreement, score magnitude, diversity, breadth, duplicate diagnostics, and rank diagnostics |
| `consistency` | 10 | Tier 1 | Measures score stability and explicit conflict status |

Optional dimensions activate only when the corresponding signal or config is present:

| Dimension | Default max | Tier | Activation |
|---|---:|---|---|
| `relevance` | 15 | Tier 1 | `answerRelevanceScore` is supplied or `config.relevance.required` is true |
| `authority` | 20 | Tier 1 | `config.authority` is supplied |
| `corpus` | 15 | Tier 2 | `config.corpus` is supplied |
| `freshness` | 15 | Tier 2 | `config.freshness` is supplied |
| `indexIntegrity` | 15 | Tier 2 | `config.indexIntegrity` is supplied |

The final score is:

```text
round(weightedRawTotal / maxPossible * 100)
```

Each active dimension contributes:

```text
(dimension.raw / dimension.max) * activeWeight
```

With default weights, each active weight equals the dimension's native max, preserving raw-score behavior.

## Presets And Signal Policy

`preset` defaults to `balanced-v0.3`.

| Preset | Behavior |
|---|---|
| `legacy-v0.2` | Keeps v0.2-like action behavior and does not add production required-signal gates |
| `balanced-v0.3` | Default runtime behavior with v0.3 metadata and diagnostics, without forcing stricter gates |
| `production-v0.3` | Requires `answerRelevanceScore`, a conflict signal, and either `faithfulnessScore` or `claimSupport`; missing critical signals force review |

`config.signalPolicy` can require specific signals, review when they are missing, abstain when they are missing, and enforce citation quality floors. When used with `preset: 'production-v0.3'`, caller policy is merged with the production preset; it extends production requirements instead of removing the required relevance, conflict, and support-evaluator gates.

## Retrieval v0.3 Additions

Duplicate and rank behavior is diagnostic-only by default:

```typescript
retrieval: {
  duplicateContent: { mode: 'diagnostic' },
  rankPenalty: { mode: 'diagnostic' },
}
```

To make duplicates or late-ranked candidates reduce retrieval raw score, set `mode: 'penalize'`.

Default duplicate settings:

| Setting | Default |
|---|---:|
| `penaltyPerDuplicate` | 1 |
| `maxPenalty` | 4 |

Default rank settings:

| Setting | Default |
|---|---:|
| `afterRank` | 10 |
| `penaltyPerRank` | 0.25 |
| `maxPenalty` | 3 |

## Index Integrity

`indexIntegrity` is an opt-in Tier 2 extension with max 15 raw points.

| Sub-signal | Points |
|---|---:|
| Embedding version match | 4 |
| Source version match ratio | 3 |
| Stale indexed document ratio | 3 |
| Failed ingestion count | 2 |
| ACL or tenant filter confirmation | 2 |
| Deleted source leakage | 1 |

Default config:

```typescript
{
  maxFailedIngestionsForFullScore: 0,
  staleRatioWarnAt: 0.01,
  staleRatioZeroAt: 0.10,
  requireAclFilterConfirmation: true,
}
```

Warnings:

| Code | Severity | Meaning |
|---|---|---|
| `index-integrity-incomplete` | warn | A required index-health sub-signal was not supplied |
| `embedding-version-mismatch` | warn | Actual embedding model version does not match expected version |
| `acl-filter-unconfirmed` | warn | ACL/tenant filter confirmation is false or missing while required |
| `deleted-source-leakage` | error | Deleted source content appears to be retrievable |

## Calibration

`analyzeCalibration(samples, config)` is offline and deterministic. It accepts historical totals, actions, and labeled outcomes, then returns:

- empirical positive rate by score band.
- empirical positive rate by action.
- a recommended `ActionPolicy`.
- low-sample warnings.

Positive outcomes default to `correct` and `accepted`.

Default bands:

| Band | Range |
|---|---|
| Abstain band | `[0, 40)` |
| Review-low band | `[40, 65)` |
| Review-high band | `[65, 85)` |
| Answer band | `[85, 101)` |

Calibration never mutates the scorer algorithm.

`targetPrecisionForAnswer` tunes `recommendedPolicy.answerAt`. `targetRecallForAbstain` tunes `recommendedPolicy.abstainBelow` and keeps `recommendedPolicy.reviewAt` aligned to the abstain threshold.

## Evaluator Bridge

The evaluator bridge normalizes plain object outputs into `ExternalEvaluationSignals`. It imports no evaluator SDKs.

Supported mapper shapes:

| Helper | Typical fields |
|---|---|
| `fromRagasLike` | `faithfulness`, `answer_relevancy`, `answerRelevance` |
| `fromDeepEvalLike` | `faithfulnessScore`, `answerRelevancyScore`, `metric: 'faithfulness'` + `score` |
| `fromTruLensLike` | `groundedness`, `answer_relevance` |
| `fromCustomJudge` | direct faithfulness/relevance/citation/conflict fields and claim counts |

Use `mergeEvaluationSignals(inputs, signals)` to fill absent scoring inputs without mutating the original object.
