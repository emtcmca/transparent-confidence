# transparent-confidence v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v0.2 of `transparent-confidence` as a zero-dependency, inline, fully auditable RAG confidence scorecard that experienced RAG and ML engineers can tune, replay, inspect, and connect to observability/evaluation workflows.

**Architecture:** Keep the package deterministic and dependency-free. Preserve the existing dimension-scoring pattern, but add a clearer type surface, configurable scoring profiles, machine-readable diagnostics, explicit warning/missing-signal metadata, and a safer algorithm for runtime confidence decisions. The package must remain a lightweight scorer, not an LLM-as-judge framework.

**Tech Stack:** TypeScript strict mode, Node.js 20+, Vitest, Biome, tsup, dual ESM/CJS output.

---

## Source Of Truth

This file is the source of truth for the v0.2 build. The existing `BUILD-PLAN.md` remains the v0.1 historical build plan. When v0.2 implementation begins, use this file for scope, API names, algorithm changes, test gates, and documentation requirements.

v0.2 is allowed to contain breaking changes. The intended final release tag is `v0.2.0`.

---

## Product Positioning

`transparent-confidence` should be positioned as:

> A deterministic, auditable, inline scorecard for RAG answer confidence, using retrieval, support, citation, relevance, freshness, authority, and corpus signals your system already has.

It should not be positioned as:

- A replacement for RAGAS, DeepEval, TruLens, LangSmith, or other evaluation frameworks.
- A probabilistic correctness score.
- A native LLM-as-judge faithfulness evaluator.
- A benchmark suite.
- A vector database quality metric by itself.

Experienced RAG engineers are likely to try this package if it gives them:

- No runtime dependencies.
- No network calls.
- No hidden model calls.
- A deterministic scorecard that can run inline per request.
- A type-safe output that can be logged, rendered, thresholded, replayed, and explained.
- Tunable thresholds for their retrieval stack.
- Honest warnings when important signals are missing.
- Machine-readable sub-signal breakdowns for dashboards and diffing.
- A clear migration path between algorithm versions.

---

## Non-Negotiable Constraints

- No runtime dependencies.
- No native LLM calls.
- No async requirement in the public scorer.
- No package-level side effects.
- No production `console.warn` from normal scoring paths.
- All score changes must be explainable by returned metadata.
- Defaults must preserve the current spirit of v0.1: useful with minimal config.
- The algorithm must be auditable from source without reading generated build output.
- All public API changes must be documented in README and CHANGELOG.
- All behavior changes must be covered by tests.

---

## v0.2 Must Ship

### Breaking renames

- Rename `confidenceLevel` to `supportLevel`.
- Rename `corpusDocCount` to `corpusTypeCount`.
- Rename `ScoringConfig.corpus.expectedDocCount` to `expectedTypeCount`.

### Runtime scoring enhancements

- Configurable retrieval score bands.
- Configurable retrieval method confirmation thresholds.
- Configurable retrieval `topK` for magnitude scoring.
- Machine-readable dimension breakdowns.
- Injectable `now` for freshness scoring.
- Optional answer relevance dimension.
- Safer evidence consistency semantics.
- Weighted/aggregated authority scoring instead of "best source wins."
- Query-scoped corpus type names, not only counts.
- Freshness aggregation mode: `median`, `oldest`, or `newest`.
- Warnings and missing-signal metadata.
- Algorithm/schema version metadata.
- Recommended action policy: `answer`, `review`, or `abstain`.
- Optional dimension weights for domain calibration.
- Runtime validation with strict/warn modes.

### Documentation enhancements

- v0.1 to v0.2 migration guide.
- Updated README API reference.
- Updated algorithm tables.
- Example showing single-vector retrieval tuning.
- Example showing hybrid retrieval tuning.
- Example showing runtime gating via `recommendedAction`.
- Example showing observability logging metadata.

---

## v0.2 Must Not Ship

These are valuable, but they are outside v0.2 scope:

- Python port.
- Native RAGAS, DeepEval, TruLens, or LangSmith adapters.
- Native OpenTelemetry package dependency.
- Automatic LLM-as-judge scoring.
- Automatic calibration/training from historical outcomes.
- CLI.
- Browser/UI renderer.
- Streaming scorecard.

v0.2 can expose config surfaces that make future calibration easier. It should not attempt to learn weights automatically.

---

## File Map

### Modify

- `package.json`
  - Version to `0.2.0`.
  - Description if needed.
  - Keep runtime dependencies empty.
  - Consider changing `lint` to `biome check src/ tests/ examples/`.

- `src/types.ts`
  - Public input, config, output, warning, action, and breakdown types.

- `src/scorer.ts`
  - Compute active dimensions.
  - Apply optional dimension weights.
  - Populate warnings, missing signals, algorithm version, and recommended action.
  - Validate config and inputs.

- `src/index.ts`
  - Export new public types.
  - Export any new public constants such as `ALGORITHM_VERSION`.

- `src/normalize.ts`
  - Keep normalization helper.
  - Add tests for weighted normalization if helper expands.

- `src/labels.ts`
  - Keep label derivation.
  - Add recommended action derivation if implemented there.

- `src/dimensions/grounding.ts`
  - Use `supportLevel`.
  - Add citation quality inputs.
  - Add claim support / faithfulness consolidation.
  - Add structured breakdown.

- `src/dimensions/retrieval.ts`
  - Accept retrieval config.
  - Add configurable score bands, method thresholds, `topK`, and structured breakdown.
  - Add diagnostics for top score gap and score spread.

- `src/dimensions/consistency.ts`
  - Change missing conflict signal behavior.
  - Reframe dimension as score stability plus explicit conflict status.
  - Add structured breakdown and warning hooks.

- `src/dimensions/authority.ts`
  - Replace min-rank-only scoring with weighted authority coverage.
  - Add unclassified-source diagnostics.

- `src/dimensions/corpus.ts`
  - Use `corpusTypeCount` and `expectedTypeCount`.
  - Support named `presentTypes`, `expectedTypes`, and `missingTypes`.

- `src/dimensions/freshness.ts`
  - Use `config.freshness.now`.
  - Support aggregation mode.
  - Add structured breakdown.

- `README.md`
  - Update API, algorithm, examples, migration, and caution language.

- `CHANGELOG.md`
  - Add v0.2.0 entry.

### Create

- `src/dimensions/relevance.ts`
  - Optional answer relevance dimension.

- `src/validation.ts`
  - Runtime validation helpers.

- `src/warnings.ts`
  - Warning constructors and missing-signal helpers.

- `docs/migration-v0-2.md`
  - Full migration guide.

- `docs/algorithm-v0-2.md`
  - Detailed algorithm tables if README becomes too long.

### Modify tests

- `tests/integration.test.ts`
- `tests/labels.test.ts`
- `tests/normalize.test.ts`
- `tests/dimensions/grounding.test.ts`
- `tests/dimensions/retrieval.test.ts`
- `tests/dimensions/consistency.test.ts`
- `tests/dimensions/authority.test.ts`
- `tests/dimensions/corpus.test.ts`
- `tests/dimensions/freshness.test.ts`

### Create tests

- `tests/dimensions/relevance.test.ts`
- `tests/validation.test.ts`
- `tests/warnings.test.ts`
- `tests/action-policy.test.ts`
- `tests/weights.test.ts`

---

## Public API Target

### Constants

```typescript
export const ALGORITHM_VERSION = '0.2.0';
export const SCORECARD_SCHEMA_VERSION = '0.2';
```

### Candidate

```typescript
export interface Candidate {
  retrievalScores: Record<string, number>;
  combinedScore: number;
  documentId?: string;
  documentType?: string;
  authorityRank?: number;
  isAmendment?: boolean;
  extractionQuality?: number;
  lastUpdated?: Date;

  /**
   * Optional stable identifier for duplicate or near-duplicate chunks.
   * Use a content hash, canonical chunk id, or source-version id.
   * v0.2 records diagnostics only; it does not collapse candidates by default.
   */
  contentHash?: string;

  /**
   * Optional 1-based rank from the caller's final retrieval/rerank pipeline.
   * If omitted, the library sorts by combinedScore descending and assigns
   * 1-based positional rank for rank-sensitive scoring. Explicit rank wins.
   * Ties preserve caller array order.
   * Prefer providing rank for all candidates or none.
   */
  rank?: number;
}
```

### Claim Support

```typescript
export interface ClaimSupport {
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims?: number;
  contradictedClaims?: number;
}
```

Rules:

- If `totalClaims <= 0`, treat claim support as missing and add a warning.
- If `contradictedClaims` is omitted, treat it as `0`.
- If `unsupportedClaims` is omitted, derive it as `totalClaims - supportedClaims - contradictedClaims`.
- Claim counts must be finite non-negative integers.
- If `supportedClaims + contradictedClaims > totalClaims`, add warning `input-out-of-range` in warn mode or throw in strict mode.
- If `unsupportedClaims` is provided and `supportedClaims + unsupportedClaims + contradictedClaims > totalClaims`, add warning `input-out-of-range` in warn mode or throw in strict mode.
- In warn mode, invalid `claimSupport` is ignored for scoring instead of deriving negative unsupported claims.
- If both `faithfulnessScore` and `claimSupport` are provided, use the more conservative support signal for grounding penalties.

### ScoringInputs

```typescript
export interface ScoringInputs {
  supportLevel: 'high' | 'medium' | 'low';
  candidates: Candidate[];

  ambiguityNotes?: string | null;
  requiresExpertReview?: boolean;
  externalConstraintNote?: string | null;
  documentsSilent?: boolean;
  hasConflict?: boolean;
  conflictingCandidateCount?: number;
  queryComplexity?: 'direct' | 'inferential' | 'multi-hop' | 'comparative';

  faithfulnessScore?: number;
  claimSupport?: ClaimSupport;

  citationCount?: number;
  citationCoverageScore?: number;
  invalidCitationCount?: number;

  answerRelevanceScore?: number;

  corpusTypeCount?: number;
  presentTypes?: string[];
  missingRelevantType?: boolean;
  missingTypes?: string[];
}
```

Rules:

- `supportLevel` is required in v0.2.
- `confidenceLevel` is removed in v0.2.
- `corpusDocCount` is removed in v0.2.
- `answerRelevanceScore` is optional. When present, it activates the answer relevance dimension.
- `citationCoverageScore`, `faithfulnessScore`, and `answerRelevanceScore` must be in `[0, 1]`.

### Retrieval Config

```typescript
export interface RetrievalScoreBands {
  full: number;
  high: number;
  medium: number;
  low: number;
}

export interface RetrievalConfig {
  scoreBands?: Partial<RetrievalScoreBands>;
  defaultMethodThreshold?: number;
  methodThresholds?: Record<string, number>;
  minConfirmedMethods?: number;
  topK?: number;
  minTopScoreGapForClearWinner?: number;
}
```

Defaults:

```typescript
const DEFAULT_RETRIEVAL_CONFIG = {
  scoreBands: {
    full: 0.8,
    high: 0.65,
    medium: 0.5,
    low: 0.35,
  },
  defaultMethodThreshold: 0,
  methodThresholds: {},
  minConfirmedMethods: 2,
  topK: 3,
  minTopScoreGapForClearWinner: 0.05,
};
```

Validation:

- `full >= high >= medium >= low`.
- All band values are finite numbers.
- `topK >= 1`.
- `minConfirmedMethods >= 1`.
- Method thresholds are finite numbers.

### Relevance Config

```typescript
export interface RelevanceConfig {
  required?: boolean;
  scoreBands?: Partial<{
    full: number;
    high: number;
    medium: number;
    low: number;
  }>;
}
```

Defaults:

```typescript
const DEFAULT_RELEVANCE_BANDS = {
  full: 0.9,
  high: 0.75,
  medium: 0.6,
  low: 0.4,
};
```

Rules:

- If `answerRelevanceScore` is provided, relevance is active.
- If `config.relevance.required === true` and `answerRelevanceScore` is missing, relevance is active with raw score `0` and a warning.
- If neither condition is true, relevance is inactive.

### Authority Config

```typescript
export interface AuthorityTier {
  name: string;
  rank: number;
  keywords?: string[];
}

export interface AuthorityConfig {
  tiers?: AuthorityTier[];
  aggregation?: 'weighted' | 'best';
  topK?: number;
}
```

Defaults:

```typescript
const DEFAULT_AUTHORITY_CONFIG = {
  tiers: [
    { name: 'Primary', rank: 10 },
    { name: 'Secondary', rank: 20 },
    { name: 'Supporting', rank: 30 },
  ],
  aggregation: 'weighted',
  topK: 5,
};
```

Rules:

- `weighted` is the v0.2 default.
- `best` reproduces the old min-rank behavior for users who prefer it.
- `topK` limits which candidates participate in authority coverage.

### Corpus Config

```typescript
export interface CorpusConfig {
  expectedTypeCount?: number;
  expectedTypes?: string[];
}
```

Rules:

- At least one of `expectedTypeCount` or `expectedTypes` must be provided when `corpus` is active.
- If `expectedTypes` is provided, `expectedTypeCount` is inferred as `expectedTypes.length` unless both are provided.
- If both are provided and the values disagree, config validation throws.

### Freshness Config

```typescript
export interface FreshnessConfig {
  maxAgeForFullScore?: number;
  penaltyPerMonth?: number;
  hardCutoffAge?: number;
  now?: Date;
  aggregation?: 'median' | 'oldest' | 'newest';
}
```

Defaults:

```typescript
const DEFAULT_FRESHNESS_CONFIG = {
  maxAgeForFullScore: 90,
  penaltyPerMonth: 1.5,
  hardCutoffAge: 730,
  aggregation: 'median',
};
```

Rules:

- `now` defaults to `new Date()`.
- `aggregation: 'median'` preserves v0.1 behavior.
- `aggregation: 'oldest'` is useful for compliance/legal domains where one stale cited source can create risk.
- `aggregation: 'newest'` is useful when callers only care whether at least one current source supports the answer.

### Weights And Action Policy

```typescript
export type DimensionName =
  | 'grounding'
  | 'retrieval'
  | 'consistency'
  | 'relevance'
  | 'authority'
  | 'corpus'
  | 'freshness';

export type RecommendedAction = 'answer' | 'review' | 'abstain';

export interface ActionPolicy {
  answerAt?: number;
  reviewAt?: number;
  abstainBelow?: number;
  requireTier1AtLeast?: number;
  abstainOnDocumentsSilent?: boolean;
  reviewOnWarnings?: ConfidenceWarningCode[];
  abstainOnWarnings?: ConfidenceWarningCode[];
}
```

Defaults:

```typescript
const DEFAULT_WEIGHTS = {
  grounding: 30,
  retrieval: 25,
  consistency: 10,
  relevance: 15,
  authority: 20,
  corpus: 15,
  freshness: 15,
};

const DEFAULT_ACTION_POLICY = {
  answerAt: 65,
  reviewAt: 40,
  abstainBelow: 40,
  requireTier1AtLeast: 40,
  abstainOnDocumentsSilent: true,
  reviewOnWarnings: ['missing-answer-relevance', 'missing-conflict-signal'],
  abstainOnWarnings: ['documents-silent'],
};
```

Rules:

- Weights are dimension max points.
- Defaults preserve the v0.1 max values for existing dimensions.
- A relevance weight is only included when relevance is active.
- Dimension weights must be positive finite numbers.
- `requireTier1AtLeast` compares against `tier1.score` normalized to `0-100`, not raw tier points.
- All numeric action policy score thresholds are normalized `0-100` thresholds.
- `recommendedAction` is derived after total, tier scores, and warnings are known.

### ScoringConfig

```typescript
export interface ScoringConfig {
  retrieval?: RetrievalConfig;
  relevance?: RelevanceConfig;
  authority?: AuthorityConfig;
  corpus?: CorpusConfig;
  freshness?: FreshnessConfig;
  weights?: Partial<Record<DimensionName, number>>;
  actionPolicy?: ActionPolicy;
  validation?: 'warn' | 'strict';
}
```

Validation behavior:

- Config errors always throw.
- If `validation` is omitted, treat it as `'warn'`.
- Input issues produce warnings by default.
- If `validation: 'strict'`, input issues throw instead of becoming warnings.

### Warning Types

```typescript
export type ConfidenceWarningSeverity = 'info' | 'warn' | 'error';

export type ConfidenceWarningCode =
  | 'deprecated-field'
  | 'missing-candidates'
  | 'documents-silent'
  | 'missing-answer-relevance'
  | 'missing-faithfulness'
  | 'missing-conflict-signal'
  | 'missing-freshness-dates'
  | 'missing-corpus-count'
  | 'authority-unclassified'
  | 'single-retrieval-method'
  | 'low-citation-coverage'
  | 'invalid-citations'
  | 'ambiguous-top-results'
  | 'input-out-of-range';

export interface ConfidenceWarning {
  code: ConfidenceWarningCode;
  severity: ConfidenceWarningSeverity;
  message: string;
  path?: string;
}
```

### Dimension Breakdown

Do not use a plain `Record<string, number>` as the final v0.2 breakdown type. Caps, ceilings, floors, and rounding make "all breakdown values sum to raw" misleading.

Use this explicit shape:

```typescript
export interface DimensionBreakdown {
  components: Record<string, number>;
  adjustments: Record<string, number>;
  diagnostics?: Record<string, number | string | boolean>;
  uncappedRaw: number;
  raw: number;
}
```

Rules:

- `breakdown.raw` must equal `DimensionScore.raw`.
- `uncappedRaw` records the score before final max/floor caps.
- `components` are positive base/sub-signal contributions.
- `adjustments` are penalties, bonuses, caps, ceilings, or rounding adjustments.
- `diagnostics` are machine-readable facts that do not directly affect points.

### DimensionScore

```typescript
export interface DimensionScore {
  raw: number;
  max: number;
  normalized: number;
  explanation: string;
  breakdown: DimensionBreakdown;
  warnings?: ConfidenceWarning[];
}
```

### Tier Results

Tier result scores are normalized to `0-100` regardless of which optional dimensions are active. Do not expose or compare raw tier points through `tier1.score` or `tier2.score`.

```typescript
export interface Tier1Result {
  score: number;
  label: 'Strong' | 'Moderate' | 'Limited' | 'Insufficient' | 'Not Addressed';
  color: 'green' | 'amber' | 'orange' | 'red' | 'gray';
}

export interface Tier2Result {
  score: number;
  label: 'Complete' | 'Good' | 'Partial' | 'Thin';
  color: 'green' | 'amber' | 'orange' | 'red';
}
```

### ConfidenceScorecard

```typescript
export interface ConfidenceScorecard {
  total: number;
  label: 'Strong' | 'Moderate' | 'Limited' | 'Insufficient';
  labelColor: 'green' | 'amber' | 'orange' | 'red';
  recommendedAction: RecommendedAction;
  actionReason: string;
  tier1: Tier1Result | null;
  tier2: Tier2Result | null;
  dimensions: {
    grounding: DimensionScore;
    retrieval: DimensionScore;
    consistency: DimensionScore;
    relevance?: DimensionScore;
    authority?: DimensionScore;
    corpus?: DimensionScore;
    freshness?: DimensionScore;
  };
  meta: {
    algorithmVersion: string;
    schemaVersion: string;
    rawTotal: number;
    maxPossible: number;
    activeExtensions: string[];
    activeDimensions: DimensionName[];
    missingSignals: string[];
    warnings: ConfidenceWarning[];
    weights: Partial<Record<DimensionName, number>>;
  };
}
```

---

## Algorithm Target

### Composite Normalization

Default v0.2 scoring still uses raw dimension points and normalizes to 0-100.

```
total = round((rawTotal / maxPossible) * 100)
```

With custom weights, each dimension's `max` becomes the configured weight. Scorers may still compute their native raw points internally, but `computeConfidence` must scale each dimension to the active weight before summing.

Default active dimension max values:

| Dimension | Active When | Default Max |
|---|---|---:|
| grounding | always | 30 |
| retrieval | always | 25 |
| consistency | always | 10 |
| relevance | `answerRelevanceScore` provided or `config.relevance.required` | 15 |
| authority | `config.authority` present | 20 |
| corpus | `config.corpus` present | 15 |
| freshness | `config.freshness` present | 15 |

Tier 1 includes: grounding, retrieval, consistency, relevance when active, authority when active.

Tier 2 includes: corpus when active, freshness when active.

Tier result `score` fields must be normalized to `0-100` using the active tier raw/max values. This keeps labels and `actionPolicy.requireTier1AtLeast` config-independent when relevance, authority, corpus, or freshness are activated.

### Labels

Keep v0.1 label thresholds:

| Label | Range | Color |
|---|---:|---|
| Strong | `>= 85` | green |
| Moderate | `>= 65` | amber |
| Limited | `>= 40` | orange |
| Insufficient | `< 40` | red |

### Recommended Action

Default action derivation:

1. If `documentsSilent === true`, return `abstain`.
2. If any warning code is in `actionPolicy.abstainOnWarnings`, return `abstain`.
3. If `total < actionPolicy.abstainBelow`, return `abstain`.
4. If normalized `tier1.score < actionPolicy.requireTier1AtLeast`, return `review`.
5. If any warning code is in `actionPolicy.reviewOnWarnings`, return `review`.
6. If `total >= actionPolicy.answerAt`, return `answer`.
7. If `total >= actionPolicy.reviewAt`, return `review`.
8. Otherwise return `abstain`.

The `actionReason` must name the first rule that decided the action.

---

## Dimension 1: Answer Grounding

**File:** `src/dimensions/grounding.ts`

**Max:** 30

**Purpose:** Measures whether the source material supports the generated answer.

### Inputs

- `supportLevel` required.
- `ambiguityNotes`
- `documentsSilent`
- `requiresExpertReview`
- `externalConstraintNote`
- `hasConflict`
- `queryComplexity`
- `faithfulnessScore`
- `claimSupport`
- `citationCount`
- `citationCoverageScore`
- `invalidCitationCount`

### Scoring Order

1. If `documentsSilent === true`, return raw `0`, add warning `documents-silent`, and skip the rest.
2. Apply support base score.
3. Apply expert/external/conflict penalties.
4. Apply query complexity ceiling.
5. Apply faithfulness/claim-support penalty.
6. Apply citation quality penalty.
7. Apply citation count bonus only when citation quality allows it.
8. Clamp to `[0, 30]`.

### Base Score

| Condition | Base |
|---|---:|
| `supportLevel = 'low'` | 5 |
| `supportLevel = 'medium'` | 13 |
| `supportLevel = 'high'` + ambiguity present | 21 |
| `supportLevel = 'high'` + no ambiguity | 30 |

### Standard Penalties

| Condition | Penalty |
|---|---:|
| `requiresExpertReview = true` | -3 |
| `externalConstraintNote` present | -2 |
| `hasConflict = true` | -5 |

### Complexity Ceiling

| Query Complexity | Ceiling |
|---|---:|
| `direct` or omitted | 30 |
| `inferential` | 24 |
| `multi-hop` | 18 |
| `comparative` | 16 |

### Faithfulness / Claim Support Penalty

Compute an effective support score:

```typescript
const claimSupportScore =
  claimSupport && claimSupport.totalClaims > 0
    ? claimSupport.supportedClaims / claimSupport.totalClaims
    : undefined;

const effectiveSupportScore =
  faithfulnessScore !== undefined && claimSupportScore !== undefined
    ? Math.min(faithfulnessScore, claimSupportScore)
    : (faithfulnessScore ?? claimSupportScore);
```

Apply:

| Effective Support Score | Modifier |
|---|---:|
| `>= 0.90` | 0 |
| `0.70 - 0.89` | -3 |
| `0.50 - 0.69` | -7 |
| `< 0.50` | -12 |
| missing | 0 and warning `missing-faithfulness` |

If `claimSupport.contradictedClaims >= 1`, apply an additional `-5` contradiction penalty.

### Citation Quality

| Signal | Effect |
|---|---:|
| `invalidCitationCount = 1` | -2, no citation bonus |
| `invalidCitationCount >= 2` | -5, no citation bonus |
| `citationCoverageScore < 0.50` | -3 |
| `citationCoverageScore >= 0.50 && < 0.80` | -1 |
| `citationCoverageScore` missing | no penalty |

Citation count bonus:

| Citation Count | Bonus |
|---|---:|
| `>= 3` | +2 |
| `2` | +1 |
| `0 - 1` or missing | 0 |

The citation count bonus is not applied when `invalidCitationCount > 0`.

### Required Tests

- `supportLevel: 'high'`, no ambiguity returns `30`.
- `supportLevel: 'high'`, ambiguity returns `21`.
- `documentsSilent: true` returns `0`, warning `documents-silent`, and recommended action `abstain`.
- `claimSupport` and `faithfulnessScore` both present uses the lower support score.
- `invalidCitationCount > 0` prevents citation bonus.
- `citationCoverageScore < 0.50` applies penalty.
- Multi-hop ceiling applies before faithfulness penalty.
- `breakdown.raw === raw`.
- `breakdown.uncappedRaw` records pre-clamp score.

---

## Dimension 2: Retrieval Confidence

**File:** `src/dimensions/retrieval.ts`

**Max:** 25

**Purpose:** Measures retrieval strength using method agreement, score magnitude, source diversity, and breadth.

### Inputs

- `candidates[].retrievalScores`
- `candidates[].combinedScore`
- `candidates[].documentId`
- `candidates[].extractionQuality`
- `candidates[].contentHash`
- `config.retrieval`

### Sub-Signal A: Method Agreement

A retrieval method confirms a candidate when:

```typescript
candidate.retrievalScores[methodName] > threshold
```

Threshold selection:

1. Use `config.retrieval.methodThresholds[methodName]` when present.
2. Otherwise use `config.retrieval.defaultMethodThreshold`.
3. Otherwise use `0`.

A candidate is confirmed when confirmed method count is `>= minConfirmedMethods`.

Default points:

| Confirmed Candidates | Points |
|---|---:|
| `>= 3` | 15 |
| `2` | 12 |
| `1` | 8 |
| `0` | 3 |

Single-vector retrieval users can set:

```typescript
createScorer({
  retrieval: {
    minConfirmedMethods: 1,
  },
});
```

### Sub-Signal B: Score Magnitude

Use top `config.retrieval.topK ?? 3` candidates after sorting by `combinedScore` descending.

Effective score:

```typescript
effectiveScore =
  candidate.extractionQuality === undefined
    ? candidate.combinedScore
    : candidate.combinedScore * candidate.extractionQuality;
```

Points use configurable bands:

| Avg Effective Score | Points |
|---|---:|
| `>= full` | 8 |
| `>= high` | 6 |
| `>= medium` | 4 |
| `>= low` | 2 |
| `< low` | 0 |

Default bands are `0.80`, `0.65`, `0.50`, `0.35`.

### Sub-Signal C: Source Diversity + Breadth

Keep v0.1 defaults:

Source diversity counts unique `documentId` values. `contentHash` is diagnostic-only in v0.2; duplicate content hashes do not collapse candidates and do not reduce source diversity points by default.

| Unique `documentId` Values | Points |
|---|---:|
| `>= 3` | +3 |
| `2` | +1 |
| `0 - 1` | +0 |

| Candidate Count | Points |
|---|---:|
| `>= 5` | +2 |
| `3 - 4` | +1 |
| `<= 2` | +0 |

### Diagnostics

Add diagnostics but do not change raw score by default:

- `topScoreGap`: top score minus second score.
- `scoreStdDev`: standard deviation of `combinedScore`.
- `duplicateContentHashCount`: count of repeated `contentHash` values.
- `singleMethodCandidateCount`: candidates with fewer than two retrieval methods present.

Warnings:

- If candidates are empty, warning `missing-candidates`.
- If all candidates are single-method and `minConfirmedMethods > 1`, warning `single-retrieval-method`.
- If `topScoreGap < minTopScoreGapForClearWinner`, warning `ambiguous-top-results`.

### Required Tests

- Default score bands preserve v0.1 retrieval scores.
- Partial score band override merges with defaults.
- Invalid score band order throws config validation error.
- `minConfirmedMethods: 1` lets vector-only retrieval score agreement without a warning.
- Method-specific thresholds change confirmation count.
- `topK: 5` changes magnitude average.
- Empty candidates returns `0` with `missing-candidates` warning.
- `breakdown.components` contains `agreement`, `magnitude`, `diversity`, `breadth`.
- Retrieval cap records cap adjustment when uncapped raw exceeds 25.
- Duplicate `contentHash` values are counted in diagnostics but do not change diversity points by default.

---

## Dimension 3: Evidence Consistency

**File:** `src/dimensions/consistency.ts`

**Max:** 10

**Purpose:** Measures retrieval score stability and explicit evidence conflict status. v0.2 must avoid treating "no conflict signal provided" as proof of agreement.

### Inputs

- `candidates[].combinedScore`
- `conflictingCandidateCount`
- `hasConflict`

### Sub-Signal A: Score Stability

| Condition | Points |
|---|---:|
| No candidates | 0 |
| One candidate | 3 |
| std dev `< 0.10` | 6 |
| std dev `< 0.20` | 5 |
| std dev `< 0.30` | 3 |
| std dev `>= 0.30` | 1 |

### Sub-Signal B: Conflict Signal

| Condition | Points |
|---|---:|
| `conflictingCandidateCount = 0` | 4 |
| `hasConflict = false` and no count given | 4 |
| no conflict signal provided | 2 plus warning `missing-conflict-signal` |
| `conflictingCandidateCount = 1` | 1 |
| `conflictingCandidateCount >= 2` | 0 |
| `hasConflict = true` and no count given | 0 |

Rationale:

- Tight retrieval scores are not semantic agreement by themselves.
- Explicit no-conflict signals are rewarded.
- Missing conflict signals are neutral-ish but flagged.
- Conflict count takes precedence over boolean `hasConflict`.

### Required Tests

- Tight scores plus explicit no conflict returns max `10`.
- Tight scores with missing conflict signal returns `8` and warning `missing-conflict-signal`.
- Tight scores with two conflicts returns `6`.
- Scattered scores plus major conflict returns `1` or `0` after floor depending implementation cap.
- `conflictingCandidateCount: 0` overrides `hasConflict: true`.
- Empty candidates returns `0`.
- `breakdown.components.scoreStability` and `breakdown.components.conflictStatus` are present.

---

## Optional Dimension: Answer Relevance

**Create:** `src/dimensions/relevance.ts`

**Max:** 15

**Purpose:** Measures whether the answer addresses the user's question. This is distinct from grounding. A grounded answer can still be irrelevant.

### Activation

Active when:

- `inputs.answerRelevanceScore !== undefined`, or
- `config.relevance.required === true`.

### Scoring

| Answer Relevance Score | Points |
|---|---:|
| `>= full` | 15 |
| `>= high` | 12 |
| `>= medium` | 8 |
| `>= low` | 4 |
| `< low` | 0 |
| missing and required | 0 plus warning `missing-answer-relevance` |

Default bands:

| Band | Value |
|---|---:|
| full | 0.90 |
| high | 0.75 |
| medium | 0.60 |
| low | 0.40 |

### Required Tests

- Missing score and no required config leaves relevance inactive.
- Provided score activates dimension and increases active dimensions.
- Required config with missing score returns raw `0` and warning.
- Custom relevance bands work.
- Relevance is included in Tier 1 when active.
- Relevance is included in `maxPossible` only when active.

---

## Extension: Source Authority

**File:** `src/dimensions/authority.ts`

**Max:** 20

**Purpose:** Measures whether retrieved/cited evidence comes from authoritative source types.

### v0.2 Change

Replace default "best source wins" scoring with weighted authority coverage.

### Rank To Candidate Authority Points

| Effective Rank | Candidate Points |
|---|---:|
| `<= 10` | 18 |
| `<= 20` | 13 |
| `<= 30` | 7 |
| `> 30` or unclassified | 2 |

### Weighted Aggregation

Use top `config.authority.topK ?? 5` candidates sorted by effective final rank:

1. Candidates with explicit `rank` sort by `rank` ascending.
2. Candidates without explicit `rank` sort by `combinedScore` descending and receive 1-based positional ranks.
3. Ties preserve caller array order.

Callers should provide `rank` for all candidates or none. If ranks are mixed, ranked candidates are ordered first by explicit rank; rankless candidates follow by `combinedScore` descending.

For each included candidate:

```typescript
scoreForWeight = Math.max(candidate.combinedScore, 0)
weight =
  sum(scoreForWeight of included candidates) > 0
    ? scoreForWeight / sum(scoreForWeight of included candidates)
    : 1 / includedCandidateCount
weightedAuthority = sum(candidateAuthorityPoints * weight)
base = Math.round(weightedAuthority)
```

The uniform fallback prevents division by zero when all included candidates have zero or negative `combinedScore` values.

Bonuses:

| Condition | Points |
|---|---:|
| Any included candidate has `isAmendment = true` | +1 |
| More than one rank bucket represented | +1 |

Cap raw at 20.

### Best-Source Compatibility Mode

If `config.authority.aggregation === 'best'`, reproduce v0.1 min-rank behavior.

### Warnings

- If any included candidate cannot be classified, add warning `authority-unclassified`.
- If all included candidates are unclassified, raw should be low and explanation should say authority is unavailable.

### Required Tests

- A single primary source among many unclassified sources no longer automatically scores 18+ in weighted mode.
- `aggregation: 'best'` preserves v0.1 behavior.
- Authority rank overrides keyword matching.
- Keyword matching remains case-insensitive.
- Unclassified candidates create warning.
- `breakdown.diagnostics.unclassifiedCount` is present.
- All-zero `combinedScore` values use uniform authority weights and never produce `NaN`.
- Unsorted candidates without explicit `rank` produce the same authority result as the same candidates sorted by `combinedScore` with explicit ranks.

---

## Extension: Corpus Completeness

**File:** `src/dimensions/corpus.ts`

**Max:** 15

**Purpose:** Surfaces risk that the right answer exists but the corpus lacks the necessary document type.

### v0.2 Names

- `corpusDocCount` becomes `corpusTypeCount`.
- `expectedDocCount` becomes `expectedTypeCount`.

### Count-Based Scoring

Keep v0.1 score table:

| Coverage Ratio | Base |
|---|---:|
| `>= 1.0` | 15 |
| `>= 0.80` | 12 |
| `>= 0.60` | 9 |
| `>= 0.40` | 5 |
| `>= 0.20` | 2 |
| `< 0.20` | 0 |

Penalty:

| Condition | Penalty |
|---|---:|
| `missingRelevantType = true` | -3 |

### Named Type Support

If `config.corpus.expectedTypes` and `inputs.presentTypes` are provided:

```typescript
missingTypes = expectedTypes.filter((type) => !presentTypes.includes(type));
corpusTypeCount = presentTypes.length;
expectedTypeCount = expectedTypes.length;
```

If `inputs.missingTypes` is provided, include it in diagnostics and explanation.

### Required Tests

- Count-only scoring preserves v0.1 behavior with renamed fields.
- Named `expectedTypes` infers expected count.
- Named `presentTypes` infers current count.
- Mismatched `expectedTypes.length` and `expectedTypeCount` throws config validation error.
- Missing relevant type penalty applies.
- Missing corpus count when corpus active returns raw `0` plus warning `missing-corpus-count`.

---

## Extension: Document Freshness

**File:** `src/dimensions/freshness.ts`

**Max:** 15

**Purpose:** Measures whether retrieved documents are current enough for the domain.

### v0.2 Changes

- Add `config.freshness.now`.
- Add `config.freshness.aggregation`.

### Age Selection

```typescript
const ages = candidatesWithLastUpdated.map(ageInDays);

const selectedAge =
  aggregation === 'oldest' ? Math.max(...ages)
  : aggregation === 'newest' ? Math.min(...ages)
  : median(ages);
```

### Scoring

Keep v0.1 decay:

- Full score if selected age is within `maxAgeForFullScore`.
- Score `0` if selected age is `>= hardCutoffAge`.
- Otherwise subtract `penaltyPerMonth` for each 30-day period beyond the full-score window.
- Round final raw to nearest integer.

### Required Tests

- Fixed `now` makes tests deterministic.
- Median aggregation preserves v0.1 expected scores.
- Oldest aggregation penalizes when one retrieved source is stale.
- Newest aggregation scores based on freshest source.
- No `lastUpdated` returns raw `0` plus warning `missing-freshness-dates`.
- `breakdown.diagnostics.selectedAgeDays` is present.

---

## Validation

**Create:** `src/validation.ts`

### Config Validation Throws

Throw for:

- Non-monotonic retrieval or relevance bands.
- Negative or zero weights.
- Non-finite weights.
- `topK < 1`.
- `minConfirmedMethods < 1`.
- Freshness `hardCutoffAge <= maxAgeForFullScore`.
- Freshness `penaltyPerMonth < 0`.
- Corpus config missing both `expectedTypeCount` and `expectedTypes`.
- Corpus config provides both `expectedTypeCount` and `expectedTypes` with different counts.

### Input Validation Warns By Default

Warn for:

- Empty candidates.
- Out-of-range scores.
- Inconsistent `claimSupport` counts.
- Missing freshness dates when freshness active.
- Missing corpus count/types when corpus active.
- Missing answer relevance when required.
- Missing conflict signal.

If `config.validation` is omitted, use warn mode.

If `config.validation === 'strict'`, input validation throws instead of returning warnings.

### Required Tests

- Invalid config throws in `computeConfidence`.
- Invalid config throws in `createScorer`.
- Input issue returns warning when validation is `warn`.
- Input issue throws when validation is `strict`.
- Inconsistent `claimSupport` counts return warning `input-out-of-range` in warn mode.
- Inconsistent `claimSupport` counts throw in strict mode.
- Warnings are included in `scorecard.meta.warnings`.
- Dimension-level warnings are rolled up into `scorecard.meta.warnings`.

---

## Warning And Missing Signal Metadata

**Create:** `src/warnings.ts`

### Missing Signals

`scorecard.meta.missingSignals` should include concise identifiers:

- `answerRelevanceScore`
- `faithfulnessScore`
- `claimSupport`
- `conflictSignal`
- `freshnessDates`
- `corpusTypes`
- `authorityRanks`

Missing signals are informational unless the active config requires them.

### Required Tests

- Missing answer relevance is recorded when relevance required.
- Missing faithfulness is recorded but does not reduce score by default.
- Missing conflict signal creates warning and missing signal.
- Missing freshness dates creates warning only when freshness active.
- Missing authority ranks creates warning only when authority active and candidates cannot be classified.

---

## Aggregation, Weights, And Meta

**File:** `src/scorer.ts`

### Required Behavior

- Gather dimension scores.
- Gather dimension warnings.
- Gather validation warnings.
- Determine active dimensions.
- Apply weights.
- Compute total.
- Derive labels.
- Derive tier scores.
- Derive recommended action.
- Return algorithm/schema versions.

### Weighted Score Formula

For each active dimension:

```typescript
weightedRaw = (dimension.raw / dimension.max) * activeWeight;
weightedMax = activeWeight;
```

Then:

```typescript
rawTotal = sum(weightedRaw);
maxPossible = sum(weightedMax);
total = round((rawTotal / maxPossible) * 100);
```

Default weights equal default dimension max values, so default behavior remains intuitive. Proof: when `activeWeight === dimension.max`, `(dimension.raw / dimension.max) * activeWeight = dimension.raw`, preserving the default raw numerator.

### Required Tests

- Default weights preserve expected v0.2 scenario totals.
- Custom retrieval weight changes total but not dimension raw.
- Inactive dimensions do not contribute weight.
- `meta.weights` contains active weights.
- `meta.activeDimensions` includes relevance only when active.
- `meta.algorithmVersion === '0.2.0'`.
- `meta.schemaVersion === '0.2'`.
- `tier1.score` is normalized to `0-100` with relevance inactive and active.
- `actionPolicy.requireTier1AtLeast` compares against normalized `tier1.score`.

---

## Backward Compatibility Pre-Work: v0.1.2

Before v0.2, optionally ship v0.1.2 as a migration bridge.

### v0.1.2 Behavior

- Add `supportLevel` while still accepting `confidenceLevel`.
- Add `corpusTypeCount` while still accepting `corpusDocCount`.
- Add `expectedTypeCount` while still accepting `expectedDocCount`.
- New names take precedence.
- Do not use `console.warn`.
- Return deprecation warnings in `scorecard.meta.warnings`.

### v0.1.2 Tests

- Old names still work.
- New names work.
- New names take precedence.
- Deprecated names create warning `deprecated-field`.
- Existing v0.1 tests continue passing.

If v0.1.2 is skipped, v0.2 README must make the breaking changes extremely clear.

---

## Phase 1: Breaking Renames

**Files:**

- Modify: `src/types.ts`
- Modify: `src/dimensions/grounding.ts`
- Modify: `src/dimensions/corpus.ts`
- Modify: `tests/**/*.test.ts`
- Modify: `examples/*.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

### Steps

- [ ] Replace every runtime use of `confidenceLevel` with `supportLevel`.
- [ ] Replace every runtime use of `corpusDocCount` with `corpusTypeCount`.
- [ ] Replace every runtime use of `expectedDocCount` with `expectedTypeCount`.
- [ ] Update all tests to use new field names.
- [ ] Update all examples to use new field names.
- [ ] Update README quick start and API tables.
- [ ] Add README migration section with exact replacements:

```text
confidenceLevel -> supportLevel
corpusDocCount -> corpusTypeCount
expectedDocCount -> expectedTypeCount
```

### Gate

Run:

```bash
npm run typecheck
npx biome check src/ tests/ examples/
npm test
rg "confidenceLevel|corpusDocCount|expectedDocCount" src tests examples
```

Expected:

- Typecheck exits 0.
- Biome exits 0.
- Tests pass.
- `rg` finds no old names in source, tests, or examples.
- README and migration docs may mention old names only when explaining the v0.1 to v0.2 migration.

---

## Phase 2: Type Surface, Validation, Warnings

**Files:**

- Modify: `src/types.ts`
- Create: `src/validation.ts`
- Create: `src/warnings.ts`
- Modify: `src/index.ts`
- Create: `tests/validation.test.ts`
- Create: `tests/warnings.test.ts`

### Steps

- [ ] Add all v0.2 public types from the "Public API Target" section.
- [ ] Export new public types from `src/index.ts`.
- [ ] Implement config validation.
- [ ] Implement input validation.
- [ ] Implement warning constructors.
- [ ] Add tests for config errors.
- [ ] Add tests for input warnings and strict mode.

### Gate

Run:

```bash
npm run typecheck
npx biome check src/ tests/
npm test
```

Expected: all commands exit 0.

---

## Phase 3: Retrieval Config And Diagnostics

**Files:**

- Modify: `src/dimensions/retrieval.ts`
- Modify: `src/scorer.ts`
- Modify: `tests/dimensions/retrieval.test.ts`
- Modify: `tests/integration.test.ts`

### Steps

- [ ] Change `scoreRetrieval` signature to accept config.
- [ ] Merge retrieval defaults with partial user config.
- [ ] Add method thresholds.
- [ ] Add `minConfirmedMethods`.
- [ ] Add `topK`.
- [ ] Add top score gap diagnostics.
- [ ] Add structured breakdown.
- [ ] Update tests for defaults and overrides.

### Gate

Run:

```bash
npm test -- tests/dimensions/retrieval.test.ts
npm test
```

Expected: retrieval tests pass first, then full suite passes.

---

## Phase 4: Grounding, Claims, And Citations

**Files:**

- Modify: `src/dimensions/grounding.ts`
- Modify: `tests/dimensions/grounding.test.ts`
- Modify: `tests/integration.test.ts`

### Steps

- [ ] Replace `confidenceLevel` logic with `supportLevel`.
- [ ] Add claim support score handling.
- [ ] Add citation coverage handling.
- [ ] Add invalid citation handling.
- [ ] Add structured breakdown.
- [ ] Add dimension warnings.
- [ ] Update tests for support levels, claims, faithfulness, and citation quality.

### Gate

Run:

```bash
npm test -- tests/dimensions/grounding.test.ts
npm test
```

Expected: grounding tests pass first, then full suite passes.

---

## Phase 5: Consistency Semantics

**Files:**

- Modify: `src/dimensions/consistency.ts`
- Modify: `tests/dimensions/consistency.test.ts`
- Modify: `tests/integration.test.ts`
- Modify: `README.md`

### Steps

- [ ] Change score stability points to v0.2 table.
- [ ] Change conflict signal points to v0.2 table.
- [ ] Add warning for missing conflict signal.
- [ ] Add structured breakdown.
- [ ] Update README wording: this dimension measures retrieval score stability plus explicit conflict status.

### Gate

Run:

```bash
npm test -- tests/dimensions/consistency.test.ts
npm test
```

Expected: consistency tests pass first, then full suite passes.

---

## Phase 6: Answer Relevance Dimension

**Files:**

- Create: `src/dimensions/relevance.ts`
- Modify: `src/scorer.ts`
- Modify: `src/types.ts`
- Create: `tests/dimensions/relevance.test.ts`
- Modify: `tests/integration.test.ts`
- Modify: `README.md`

### Steps

- [ ] Add relevance scorer.
- [ ] Activate relevance when score is provided or required.
- [ ] Include relevance in Tier 1 when active.
- [ ] Add relevance to active dimensions and maxPossible.
- [ ] Add warning behavior when required and missing.
- [ ] Add README section explaining answer relevance vs grounding.

### Gate

Run:

```bash
npm test -- tests/dimensions/relevance.test.ts
npm test
```

Expected: relevance tests pass first, then full suite passes.

---

## Phase 7: Authority, Corpus, Freshness

**Files:**

- Modify: `src/dimensions/authority.ts`
- Modify: `src/dimensions/corpus.ts`
- Modify: `src/dimensions/freshness.ts`
- Modify: `tests/dimensions/authority.test.ts`
- Modify: `tests/dimensions/corpus.test.ts`
- Modify: `tests/dimensions/freshness.test.ts`

### Steps

- [ ] Add weighted authority aggregation.
- [ ] Add authority compatibility mode `aggregation: 'best'`.
- [ ] Add unclassified authority warnings.
- [ ] Add corpus named type support.
- [ ] Add freshness `now`.
- [ ] Add freshness aggregation mode.
- [ ] Add structured breakdowns for all three dimensions.

### Gate

Run:

```bash
npm test -- tests/dimensions/authority.test.ts
npm test -- tests/dimensions/corpus.test.ts
npm test -- tests/dimensions/freshness.test.ts
npm test
```

Expected: dimension tests pass individually, then full suite passes.

---

## Phase 8: Weights, Meta, And Action Policy

**Files:**

- Modify: `src/scorer.ts`
- Modify: `src/labels.ts`
- Create: `tests/weights.test.ts`
- Create: `tests/action-policy.test.ts`
- Modify: `tests/integration.test.ts`

### Steps

- [ ] Add active dimension weight resolution.
- [ ] Add weighted total calculation.
- [ ] Add algorithm/schema version metadata.
- [ ] Add active dimensions metadata.
- [ ] Roll up warnings and missing signals.
- [ ] Add recommended action derivation.
- [ ] Add action reason string.

### Gate

Run:

```bash
npm test -- tests/weights.test.ts
npm test -- tests/action-policy.test.ts
npm test
```

Expected: targeted tests pass first, then full suite passes.

---

## Phase 9: Examples And Docs

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/migration-v0-2.md`
- Create: `docs/algorithm-v0-2.md`
- Modify: `examples/basic-rag.ts`
- Modify: `examples/legal-docs.ts`
- Modify: `examples/knowledge-base.ts`
- Modify: `examples/full-pipeline.ts`

### Required README Sections

- What v0.2 score means.
- What v0.2 score does not mean.
- Quick start with `supportLevel`.
- Migration from v0.1 to v0.2.
- Answer relevance section.
- Retrieval tuning section.
- Retrieval tuning section warns that if `combinedScore` is not normalized to `[0, 1]`, users must configure `scoreBands` to match their score distribution before deploying.
- Retrieval tuning section explains that BM25, ColBERT, reranker, and cross-encoder scores may not be comparable without caller-side normalization or tuned bands.
- Warning and missing signal section.
- Recommended action section.
- Machine-readable breakdown section.
- Machine-readable breakdown section states `breakdown.raw === DimensionScore.raw` for every dimension.
- Observability logging recipe.
- Weighting section includes the default-weight proof: `(raw / max) * max = raw`.
- Retrieval diversity section states that diversity counts unique `documentId` values, while `contentHash` is diagnostic-only in v0.2.
- Updated API reference.
- Updated algorithm tables.

### Required Examples

- Basic RAG with explicit `hasConflict: false`.
- Vector-only retrieval using `minConfirmedMethods: 1`.
- Hybrid retrieval with method thresholds.
- Full pipeline with relevance, warnings, action policy, and breakdown.
- Runtime gating example:

```typescript
if (scorecard.recommendedAction === 'abstain') {
  return { answer: null, reason: scorecard.actionReason };
}

if (scorecard.recommendedAction === 'review') {
  return { answer, reviewRequired: true, confidence: scorecard.total };
}

return { answer, confidence: scorecard.total };
```

### Gate

Run:

```bash
npx biome check src/ tests/ examples/
npx tsx examples/basic-rag.ts
npx tsx examples/legal-docs.ts
npx tsx examples/knowledge-base.ts
npx tsx examples/full-pipeline.ts
```

Expected:

- Biome exits 0.
- Every example exits 0.
- Example labels match their header comments.

---

## Phase 10: Release Gate

Before tagging `v0.2.0`, run:

```bash
npm run typecheck
npx biome check src/ tests/ examples/
npm test
npm run coverage
npm run build
npm pack --dry-run
npm publish --dry-run
```

Expected:

- Typecheck exits 0.
- Biome exits 0.
- Full test suite exits 0.
- Coverage remains at or above:
  - Line: 90%
  - Function: 95%
  - Branch: 85%
- Build emits ESM, CJS, and declarations.
- Pack output contains only intended package files.
- Publish dry-run exits 0.

Also run:

```bash
rg "confidenceLevel|corpusDocCount|expectedDocCount" src tests examples
```

Expected:

- No matches.

Phase 10 integration tests must also assert that every active dimension satisfies:

```typescript
expect(dimension.breakdown.raw).toBe(dimension.raw);
```

This invariant must hold for grounding, retrieval, consistency, relevance, authority, corpus, and freshness whenever the dimension is active.

---

## Suggested Commit Sequence

Use small commits so behavior changes are reviewable.

1. `chore: add v0.2 type surface`
2. `feat: rename v0.2 scoring inputs`
3. `feat: add validation and warnings`
4. `feat: tune retrieval scoring config`
5. `feat: add grounding claim and citation signals`
6. `feat: revise consistency scoring semantics`
7. `feat: add answer relevance dimension`
8. `feat: improve authority corpus and freshness extensions`
9. `feat: add scoring weights and action policy`
10. `docs: update v0.2 README and migration guide`
11. `chore: prepare v0.2 release`

---

## Acceptance Criteria

v0.2 is complete only when all of these are true:

- Public API uses `supportLevel`, `corpusTypeCount`, and `expectedTypeCount`.
- Old field names are absent from `src/`, `tests/`, and `examples/`.
- Runtime package still has zero dependencies.
- No scorer path logs to console.
- Every dimension returns `breakdown`.
- Every dimension's `breakdown.raw` equals its `DimensionScore.raw`.
- Every scorecard includes algorithm version and schema version.
- Every scorecard includes `warnings` and `missingSignals`.
- Every scorecard includes `recommendedAction` and `actionReason`.
- Tier result scores are normalized to `0-100`; raw tier points are not exposed through `tier1.score` or `tier2.score`.
- Relevance dimension activates only when configured or supplied.
- Retrieval thresholds are configurable and validated.
- Consistency no longer treats missing conflict signal as full agreement.
- Authority weighted aggregation is the default.
- Authority weighted aggregation has a no-positive-score fallback to uniform weights.
- Freshness tests use fixed `now`.
- README clearly states this is not a correctness probability.
- Migration guide is present.
- Full verification gate passes.

---

## Design Notes For Future Versions

These are intentionally not part of v0.2:

- Automatic calibration from historical accepted/rejected answers.
- Native adapters for RAGAS, DeepEval, TruLens, or LangSmith.
- Native OpenTelemetry exporter.
- Python port.
- CLI scoring tool.
- HTML/Markdown scorecard renderer.

v0.2 should make those future additions easier by returning stable, structured, versioned scorecards.
