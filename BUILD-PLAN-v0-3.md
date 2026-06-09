# transparent-confidence v0.3 Implementation Plan

> **STATUS: COMPLETE** — All phases shipped in commit `8dbf6e8` (Prepare v0.3 release). All 412 tests pass. Acceptance criteria met. Merged to master and published as `transparent-confidence@0.3.0`.

**Goal:** Build v0.3 of `transparent-confidence` as the bridge from a deterministic RAG confidence scorecard to a production-ready confidence layer with stricter signal policy, empirical calibration utilities, evaluator signal bridges, stronger retrieval diagnostics, and cleaner release hygiene.

**Architecture:** Keep the runtime scorer deterministic, synchronous, dependency-free, and explainable. Add production hardening around the existing v0.2 scorecard instead of replacing the scoring model: configurable signal requirements, no-dependency calibration analysis, no-dependency evaluator signal mappers, retrieval duplicate/rank penalties, and a Tier 2 index integrity extension. The package remains a scorer and policy layer, not a retriever, vector database client, LLM-as-judge framework, or observability backend.

**Tech Stack:** TypeScript strict mode, Node.js 20+, Vitest, Biome, tsup, dual ESM/CJS output, zero runtime dependencies.

---

## Source Of Truth

This file is the source of truth for the v0.3 build. `BUILD-PLAN-v0-2.md` remains the historical v0.2 plan. Do not implement features outside this file unless this file is updated first.

Target release tag: `v0.3.0`.

Target npm package version: `0.3.0`.

Current published baseline: `transparent-confidence@0.2.0`, confirmed as npm `latest` on 2026-06-08 UTC.

---

## v0.2 Audit Findings That v0.3 Must Address

These findings come from the v0.2 senior RAG architecture review and local verification.

1. The score is explainable but not empirically calibrated. It should not be interpreted as probability of correctness.
2. High-value semantic signals are caller-provided: `supportLevel`, `faithfulnessScore`, `claimSupport`, `answerRelevanceScore`, citation quality, and conflict status.
3. Retrieval scoring is useful but shallow. It does not currently penalize duplicate content hashes, use candidate rank, or help callers tune thresholds from labeled outcomes.
4. Corpus and freshness are not enough for production system readiness. v0.3 needs index integrity signals such as embedding version match, stale indexed content, ingestion failures, and ACL filter status.
5. Default production posture is too permissive for high-stakes deployments unless callers customize config.
6. The npm tarball is clean but omits local `docs/` and `examples/`, while the README references them.
7. Current local verification has issues:
   - `npm test` passes outside the sandbox: 15 files, 393 tests.
   - `npm run build` passes outside the sandbox.
   - `npm run typecheck` fails because a BoardPath sandbox integration probe was tracked under `tests/sandbox/`.
   - `npm run lint` reports Biome formatting/check failures.

v0.3 is complete only when these issues are either fixed or explicitly superseded by documented behavior.

---

## Product Positioning For v0.3

Use this positioning in README, docs, examples, and release notes:

> `transparent-confidence` is a deterministic, auditable runtime confidence layer for RAG systems. It turns retrieval, grounding, evaluator, citation, corpus, freshness, authority, and index integrity signals into a versioned scorecard, action recommendation, and calibration-ready log record.

Say explicitly:

- The score is not a probability of correctness unless the caller calibrates it against their own labeled outcomes.
- The package does not retrieve documents.
- The package does not call an LLM.
- The package does not verify citations by itself.
- The package can consume outputs from RAGAS, DeepEval, TruLens, LangSmith, custom LLM judges, and custom claim checkers through plain object signals.
- Production users should enable strict validation and signal policy.

---

## v0.3 Must Ship

### Release hygiene

- Fix `npm run typecheck`.
- Fix `npm run lint`.
- Add a single release verification script.
- Update package version to `0.3.0`.
- Update algorithm and schema versions to `0.3.0` and `0.3`.
- Include `docs/` and `examples/` in the npm package, or rewrite README links so npm users can reach the GitHub copies. Preferred: include both directories in `files`.
- Preserve zero runtime dependencies.

### Production signal policy

- Add `config.signalPolicy`.
- Allow callers to require evaluator/citation/conflict signals without writing custom warning plumbing.
- Add a production preset that reviews or abstains when critical signals are missing.
- Keep default action behavior close to v0.2 unless `production-v0.3` or an explicit stricter `signalPolicy` is configured.

### Calibration utilities

- Add no-dependency offline calibration helpers.
- Accept labeled historical outcomes.
- Produce score bands, empirical accuracy per band, action confusion summary, threshold recommendations, and warnings about low sample sizes.
- Do not mutate the scorer algorithm from calibration utilities.

### Evaluator signal bridge

- Add a normalized `ExternalEvaluationSignals` type.
- Add helper functions to merge evaluator outputs into `ScoringInputs`.
- Add no-dependency mappers for plain object outputs from common evaluator shapes:
  - RAGAS-like objects.
  - DeepEval-like objects.
  - TruLens-like objects.
  - Generic custom judge objects.
- Do not import those frameworks.

### Retrieval robustness

- Add optional duplicate content penalty using `Candidate.contentHash`.
- Add optional rank-based diagnostics and penalty using `Candidate.rank`.
- Add retrieval calibration helpers that recommend `scoreBands` from labeled candidate scores.
- Keep duplicate and rank behavior off by default or diagnostic-only by default to preserve v0.2 compatibility.

### Index integrity extension

- Add optional Tier 2 dimension `indexIntegrity`.
- Score operational readiness signals that are not captured by corpus completeness or document freshness:
  - embedding model version match.
  - indexed source version match.
  - stale indexed document ratio.
  - failed ingestion count.
  - ACL or tenant filter confirmation.
  - deleted source leakage count.
- This extension must be opt-in.

### Docs and examples

- Add `docs/algorithm-v0-3.md`.
- Add `docs/migration-v0-3.md`.
- Add examples for production gating, calibration analysis, evaluator signal merge, retrieval tuning, and index integrity.
- Update README API tables.
- Update CHANGELOG.

---

## v0.3 Must Not Ship

These features are valuable, but out of scope for v0.3:

- Native SDK dependencies for RAGAS, DeepEval, TruLens, LangSmith, OpenTelemetry, vector databases, or model providers.
- Automatic LLM-as-judge calls.
- Automatic retrieval.
- Automatic database introspection.
- Online learning that changes scoring behavior at runtime.
- Python port.
- CLI.
- Browser renderer.
- Breaking removal of v0.2 fields without migration docs.

---

## File Map

### Modify

- `package.json`
  - Set version to `0.3.0`.
  - Add `verify`, `verify:release`, and targeted helper scripts.
  - Include `docs` and `examples` in `files`.
  - Keep runtime dependencies absent.

- `src/index.ts`
  - Export new constants, types, and helpers.

- `src/types.ts`
  - Add signal policy types.
  - Add calibration types.
  - Add external evaluator signal types.
  - Add retrieval duplicate/rank config.
  - Add index integrity input/config/output types.
  - Add `indexIntegrity` to active dimension unions and scorecard shape.

- `src/scorer.ts`
  - Update version constants.
  - Resolve stricter presets.
  - Apply signal policy warnings/actions.
  - Activate and aggregate `indexIntegrity`.
  - Include new warnings and missing signals.

- `src/validation.ts`
  - Validate signal policy config.
  - Validate calibration input helpers where applicable.
  - Validate index integrity config and inputs.
  - Keep strict mode deterministic.

- `src/warnings.ts`
  - Add missing-signal mapping for new warning codes.
  - Keep warnings unique and stable.

- `src/dimensions/retrieval.ts`
  - Add duplicate content penalty.
  - Add rank penalty/diagnostics.
  - Keep v0.2 scoring unchanged unless config opts in.

- `src/labels.ts`
  - No required change unless action-policy reason text moves here.

- `README.md`
  - Update positioning, install, examples, API, algorithm summary, release notes, package contents note, and production guidance.

- `CHANGELOG.md`
  - Add complete `0.3.0` entry.

- `docs/algorithm-v0-2.md`
  - Leave unchanged.

- `docs/migration-v0-2.md`
  - Leave unchanged.

### Create

- `src/calibration.ts`
  - Offline calibration analysis and threshold recommendation helpers.

- `src/evaluators.ts`
  - No-dependency evaluator signal bridge helpers.

- `src/dimensions/index-integrity.ts`
  - Optional Tier 2 index integrity extension.

- `docs/algorithm-v0-3.md`
  - Full algorithm reference for v0.3.

- `docs/migration-v0-3.md`
  - Migration guide from v0.2 to v0.3.

- `examples/production-gating.ts`
  - Strict signal policy example.

- `examples/calibration-analysis.ts`
  - Offline calibration report example.

- `examples/evaluator-bridge.ts`
  - RAGAS-like and custom evaluator merge example.

- `examples/index-integrity.ts`
  - Tier 2 index integrity example.

### Modify tests

- `tests/integration.test.ts`
- `tests/weights.test.ts`
- `tests/action-policy.test.ts`
- `tests/validation.test.ts`
- `tests/warnings.test.ts`
- `tests/dimensions/retrieval.test.ts`

### Create tests

- `tests/calibration.test.ts`
- `tests/evaluators.test.ts`
- `tests/signal-policy.test.ts`
- `tests/dimensions/index-integrity.test.ts`
- `tests/package-surface.test.ts`

---

## Public API Target

### Constants

```typescript
export const ALGORITHM_VERSION = '0.3.0';
export const SCORECARD_SCHEMA_VERSION = '0.3';
```

### Signal Policy

Add:

```typescript
export type SignalName =
  | 'answerRelevanceScore'
  | 'faithfulnessScore'
  | 'claimSupport'
  | 'citationCoverageScore'
  | 'invalidCitationCount'
  | 'citationCount'
  | 'conflictSignal'
  | 'freshnessDates'
  | 'corpusTypes'
  | 'authorityRanks'
  | 'contentHashes'
  | 'candidateRanks'
  | 'indexIntegrity';

export interface SignalPolicy {
  /**
   * Missing signals in this list produce warnings.
   * The default preset uses a conservative list; the legacy preset uses v0.2 behavior.
   */
  require?: SignalName[];

  /**
   * Missing signals in this list force recommendedAction = 'review'.
   */
  reviewWhenMissing?: SignalName[];

  /**
   * Missing signals in this list force recommendedAction = 'abstain'.
   */
  abstainWhenMissing?: SignalName[];

  /**
   * Optional citation quality floors for production gating.
   */
  minCitationCoverageScore?: number;
  maxInvalidCitationCount?: number;
}

export type ScoringPreset = 'legacy-v0.2' | 'balanced-v0.3' | 'production-v0.3';
```

Add to `ScoringConfig`:

```typescript
preset?: ScoringPreset;
signalPolicy?: SignalPolicy;
```

Required behavior:

- `preset` defaults to `balanced-v0.3`.
- `legacy-v0.2` preserves v0.2 warning lists, action thresholds, and action behavior as closely as possible.
- `balanced-v0.3` keeps v0.2 action thresholds but may add non-gating informational warnings that help users prepare for production calibration.
- `production-v0.3` requires `conflictSignal`, `answerRelevanceScore`, and one of `faithfulnessScore` or `claimSupport`.
- Explicit `signalPolicy` overrides preset signal policy arrays.
- Missing required signals must be represented in both `meta.warnings` and `meta.missingSignals`.

### Warning Codes

Add warning codes:

```typescript
| 'required-signal-missing'
| 'citation-quality-floor'
| 'duplicate-content'
| 'rank-signal-missing'
| 'low-calibration-sample-size'
| 'uncalibrated-score'
| 'index-integrity-incomplete'
| 'embedding-version-mismatch'
| 'acl-filter-unconfirmed'
| 'deleted-source-leakage'
```

Severity rules:

- `required-signal-missing`: `warn`
- `citation-quality-floor`: `warn`
- `duplicate-content`: `info` by default, `warn` when penalty is active
- `rank-signal-missing`: `info`
- `low-calibration-sample-size`: `warn`
- `uncalibrated-score`: `info`
- `index-integrity-incomplete`: `warn`
- `embedding-version-mismatch`: `warn`
- `acl-filter-unconfirmed`: `warn`
- `deleted-source-leakage`: `error`

### Calibration

Add:

```typescript
export type CalibrationOutcome = 'correct' | 'incorrect' | 'accepted' | 'rejected' | 'escalated';

export interface CalibrationSample {
  id?: string;
  total: number;
  recommendedAction?: RecommendedAction;
  outcome: CalibrationOutcome;
  queryType?: string;
  tags?: string[];
}

export interface CalibrationBand {
  min: number;
  max: number;
  count: number;
  positiveCount: number;
  positiveRate: number;
  averageScore: number;
}

export interface CalibrationReport {
  sampleCount: number;
  positiveCount: number;
  positiveRate: number;
  bands: CalibrationBand[];
  actionSummary: Record<RecommendedAction, { count: number; positiveRate: number }>;
  recommendedPolicy: ActionPolicy;
  warnings: ConfidenceWarning[];
}

export interface CalibrationConfig {
  positiveOutcomes?: CalibrationOutcome[];
  bands?: Array<{ min: number; max: number }>;
  minSamplesPerBand?: number;
  targetPrecisionForAnswer?: number;
  targetRecallForAbstain?: number;
}

export function analyzeCalibration(
  samples: CalibrationSample[],
  config?: CalibrationConfig,
): CalibrationReport;
```

Default calibration behavior:

- Positive outcomes default to `['correct', 'accepted']`.
- Default bands are `[0, 40)`, `[40, 65)`, `[65, 85)`, `[85, 101)`.
- Empty sample array throws a config/input error.
- `total` must be a finite integer from 0 to 100.
- Bands must cover only valid score ranges and cannot overlap.
- If any band has fewer than `minSamplesPerBand` samples, return `low-calibration-sample-size`.
- Do not import math/statistics dependencies.

### External Evaluator Signals

Add:

```typescript
export interface ExternalEvaluationSignals {
  faithfulnessScore?: number;
  answerRelevanceScore?: number;
  claimSupport?: ClaimSupport;
  citationCoverageScore?: number;
  invalidCitationCount?: number;
  citationCount?: number;
  hasConflict?: boolean;
  conflictingCandidateCount?: number;
}

export interface EvaluationSignalMergeResult {
  inputs: ScoringInputs;
  warnings: ConfidenceWarning[];
}

export function mergeEvaluationSignals(
  inputs: ScoringInputs,
  signals: ExternalEvaluationSignals,
): EvaluationSignalMergeResult;

export function fromRagasLike(result: Record<string, unknown>): ExternalEvaluationSignals;
export function fromDeepEvalLike(result: Record<string, unknown>): ExternalEvaluationSignals;
export function fromTruLensLike(result: Record<string, unknown>): ExternalEvaluationSignals;
export function fromCustomJudge(result: Record<string, unknown>): ExternalEvaluationSignals;
```

Mapper behavior:

- Accept plain objects only.
- Ignore unknown keys.
- Normalize known 0-1 numeric fields.
- Return no framework-specific classes.
- Do not throw on unknown object shape; return empty signals plus warning when no known fields are found.
- Throw or warn consistently for out-of-range known numeric fields according to validation mode when merged into scoring.

### Retrieval Config Additions

Add:

```typescript
export interface DuplicateContentConfig {
  mode?: 'diagnostic' | 'penalize';
  penaltyPerDuplicate?: number;
  maxPenalty?: number;
}

export interface RankPenaltyConfig {
  mode?: 'diagnostic' | 'penalize';
  afterRank?: number;
  penaltyPerRank?: number;
  maxPenalty?: number;
}
```

Add to `RetrievalConfig`:

```typescript
duplicateContent?: DuplicateContentConfig;
rankPenalty?: RankPenaltyConfig;
```

Defaults:

- `duplicateContent.mode = 'diagnostic'`
- `duplicateContent.penaltyPerDuplicate = 1`
- `duplicateContent.maxPenalty = 4`
- `rankPenalty.mode = 'diagnostic'`
- `rankPenalty.afterRank = 10`
- `rankPenalty.penaltyPerRank = 0.25`
- `rankPenalty.maxPenalty = 3`

Scoring behavior:

- Diagnostic mode records counts and warnings but does not change raw score.
- Penalize mode subtracts penalties from retrieval raw after existing components and before clamp.
- Duplicate count is `sum(count(contentHash) - 1)` for hashes that appear more than once.
- Rank penalty uses only candidates with finite positive integer `rank`.
- Missing ranks in penalize mode produce `rank-signal-missing`.

### Index Integrity

Add dimension name:

```typescript
| 'indexIntegrity'
```

Add input:

```typescript
export interface IndexIntegrityInputs {
  expectedEmbeddingModelVersion?: string;
  actualEmbeddingModelVersion?: string;
  sourceVersionMatchRatio?: number;
  staleIndexedDocumentRatio?: number;
  failedIngestionCount?: number;
  aclFilterConfirmed?: boolean;
  deletedSourceLeakageCount?: number;
}
```

Add to `ScoringInputs`:

```typescript
indexIntegrity?: IndexIntegrityInputs;
```

Add config:

```typescript
export interface IndexIntegrityConfig {
  maxFailedIngestionsForFullScore?: number;
  staleRatioWarnAt?: number;
  staleRatioZeroAt?: number;
  requireAclFilterConfirmation?: boolean;
}
```

Add to `ScoringConfig`:

```typescript
indexIntegrity?: IndexIntegrityConfig;
```

Scoring target:

- Max raw: 15.
- Tier: Tier 2 System Readiness.
- Active only when `config.indexIntegrity` is present.

Points:

| Sub-signal | Points |
|---|---:|
| Embedding version match | 4 |
| Source version match ratio | 3 |
| Stale indexed document ratio | 3 |
| Failed ingestion count | 2 |
| ACL filter confirmation | 2 |
| Deleted source leakage | 1 |

Rules:

- Embedding match gets 4 when both versions are present and equal.
- Embedding mismatch gets 0 and warning `embedding-version-mismatch`.
- Missing one or both versions gets 2 and warning `index-integrity-incomplete`.
- Source version match ratio: `>= 0.99` -> 3, `>= 0.95` -> 2, `>= 0.90` -> 1, else 0.
- Stale indexed document ratio: `<= staleRatioWarnAt` -> 3, `< staleRatioZeroAt` -> 1, else 0.
- Failed ingestion count: `<= maxFailedIngestionsForFullScore` -> 2, else 0.
- ACL filter confirmation: true -> 2, false or missing -> 0 and warning `acl-filter-unconfirmed` when config requires it.
- Deleted source leakage count: 0 -> 1, >0 -> 0 and warning `deleted-source-leakage`.

Default config:

```typescript
{
  maxFailedIngestionsForFullScore: 0,
  staleRatioWarnAt: 0.01,
  staleRatioZeroAt: 0.10,
  requireAclFilterConfirmation: true,
}
```

---

## Phase 0: Baseline Health And Release Hygiene

**Purpose:** Make the current v0.2 tree verifiable before adding v0.3 behavior and remove package-external sandbox probes from the library test suite.

**Files:**

- Delete: `tests/sandbox/boardpath-scenarios.test.ts`
- Modify: `.gitignore`
- Modify: files flagged by `npm run lint`
- Modify: `package.json`
- Modify: `README.md` if package contents links are changed in this phase

### Required Work

- [x] Remove `tests/sandbox/boardpath-scenarios.test.ts` from the tracked repository.
- [x] Add `tests/sandbox/` to `.gitignore` so package-external probes do not re-enter the TC test suite.
- [x] Confirm no package docs, scripts, or tests reference `BoardPath`, `boardpath`, or `tests/sandbox`. Use `rg --no-ignore` against the exact files/directories that would be packed so ignored local integration notes are not accidentally hidden from package checks.

- [x] Fix Biome formatting/check failures in `src/`, `tests/`, and `examples/`.
- [x] Add scripts:

```json
{
  "verify": "npm run typecheck && npm run lint && npm test && npm run build",
  "verify:release": "npm run verify && npm run coverage && npm pack --dry-run && npm publish --dry-run"
}
```

- [x] Decide package contents:
- Preferred: add public `docs/*.md` files and `"examples"` to `package.json.files`.
  - Acceptable alternative: keep tarball small and update README links to GitHub URLs for docs/examples.
  - Do not leave README links pointing to files that are absent from the npm tarball unless they are GitHub URLs.

### Tests

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

PASS:

- Typecheck exits 0.
- Lint exits 0.
- Vitest exits 0.
- Build exits 0.
- Pack output includes exactly the intended file set.
- If README links local `docs/` or `examples/`, pack output includes those directories.
- `rg --no-ignore "BoardPath|boardpath|tests/sandbox" tests src README.md package.json docs/algorithm-v0-2.md docs/migration-v0-2.md` returns no matches for files that would be packed.

FAIL:

- Any command exits non-zero.
- `tests/sandbox/` contains tracked files.
- BoardPath-specific tests remain in the TC package verification suite.
- README references package-local docs/examples that are absent from the tarball.

Suggested commit:

```bash
git add .gitignore package.json README.md tests examples src
git commit -m "chore: restore v0.2 verification baseline"
```

---

## Phase 1: v0.3 API Surface And Versioning

**Purpose:** Add the public type surface for v0.3 before behavior changes.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Modify: `src/scorer.ts`
- Modify: `tests/weights.test.ts`
- Modify: `tests/integration.test.ts`
- Create: `tests/package-surface.test.ts`

### Required Work

- [x] Update `ALGORITHM_VERSION` to `0.3.0`.
- [x] Update `SCORECARD_SCHEMA_VERSION` to `0.3`.
- [x] Add new type exports listed in Public API Target.
- [x] Add `indexIntegrity` to `DimensionName`.
- [x] Add optional `dimensions.indexIntegrity`.
- [x] Add `indexIntegrity` to `meta.activeDimensions` only when active.
- [x] Keep `total`, `label`, `recommendedAction`, `tier1`, `tier2`, and existing dimensions backward-compatible.
- [x] Add tests that import every new public type/function from `src/index.ts`.

### Tests

Add assertions:

```typescript
expect(ALGORITHM_VERSION).toBe('0.3.0');
expect(SCORECARD_SCHEMA_VERSION).toBe('0.3');
```

Add package surface compile test in `tests/package-surface.test.ts`:

```typescript
import {
  analyzeCalibration,
  computeConfidence,
  fromCustomJudge,
  mergeEvaluationSignals,
} from '../src/index';

test('v0.3 public helpers are exported', () => {
  expect(typeof computeConfidence).toBe('function');
  expect(typeof analyzeCalibration).toBe('function');
  expect(typeof mergeEvaluationSignals).toBe('function');
  expect(typeof fromCustomJudge).toBe('function');
});
```

Run:

```bash
npm test -- tests/package-surface.test.ts
npm test -- tests/weights.test.ts
npm test -- tests/integration.test.ts
npm run typecheck
```

PASS:

- New exports compile from the package root.
- Version constants return v0.3 values.
- Existing v0.2 core scorecard calls still compile.
- `indexIntegrity` is absent from active dimensions unless configured.

FAIL:

- Any public type is only available from an internal path.
- Existing v0.2 examples fail to compile.
- Active dimension metadata includes inactive dimensions.

Suggested commit:

```bash
git add src tests
git commit -m "feat: add v0.3 public API surface"
```

---

## Phase 2: Production Signal Policy

**Purpose:** Let production callers require critical evaluator and citation signals without custom action-policy code.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/scorer.ts`
- Modify: `src/validation.ts`
- Modify: `src/warnings.ts`
- Create: `tests/signal-policy.test.ts`
- Modify: `tests/action-policy.test.ts`
- Modify: `tests/warnings.test.ts`
- Create: `examples/production-gating.ts`

### Required Work

- [x] Implement `preset` resolution.
- [x] Implement `signalPolicy` resolution.
- [x] Detect missing signals:
  - `answerRelevanceScore`
  - `faithfulnessScore`
  - `claimSupport`
  - `citationCoverageScore`
  - `invalidCitationCount`
  - `citationCount`
  - `conflictSignal`
  - `freshnessDates`
  - `corpusTypes`
  - `authorityRanks`
  - `contentHashes`
  - `candidateRanks`
  - `indexIntegrity`
- [x] Implement "one of" production support rule:
  - Production requires at least one of `faithfulnessScore` or valid `claimSupport`.
- [x] Add warning `required-signal-missing`.
- [x] Add warning `citation-quality-floor`.
- [x] Add action cascade integration:
  - `abstainWhenMissing` wins before score thresholds.
  - `reviewWhenMissing` wins before `answerAt`.
- [x] Preserve v0.2 behavior under `preset: 'legacy-v0.2'`.
- [x] Add README section explaining production preset.

### Required Tests

Create `tests/signal-policy.test.ts` with these tests:

- `legacy-v0.2 preset does not require answerRelevanceScore`.
- `production-v0.3 preset reviews when answerRelevanceScore is missing`.
- `production-v0.3 preset reviews when both faithfulnessScore and claimSupport are missing`.
- `production-v0.3 preset answers when answer relevance, support evaluator, and conflict signal are present and score is high`.
- `signalPolicy.abstainWhenMissing forces abstain`.
- `signalPolicy.reviewWhenMissing forces review`.
- `signalPolicy.minCitationCoverageScore warns below floor`.
- `signalPolicy.maxInvalidCitationCount warns above floor`.
- `explicit signalPolicy overrides preset defaults`.

Example high-confidence production input:

```typescript
const productionReadyInputs: ScoringInputs = {
  supportLevel: 'high',
  hasConflict: false,
  answerRelevanceScore: 0.94,
  faithfulnessScore: 0.93,
  citationCoverageScore: 0.91,
  invalidCitationCount: 0,
  citationCount: 4,
  candidates: [
    { retrievalScores: { semantic: 0.88, keyword: 0.72 }, combinedScore: 0.88, documentId: 'a' },
    { retrievalScores: { semantic: 0.85, keyword: 0.70 }, combinedScore: 0.85, documentId: 'b' },
    { retrievalScores: { semantic: 0.82, keyword: 0.67 }, combinedScore: 0.82, documentId: 'c' },
  ],
};
```

Run:

```bash
npm test -- tests/signal-policy.test.ts
npm test -- tests/action-policy.test.ts
npm test -- tests/warnings.test.ts
npm run typecheck
```

PASS:

- Missing production signals appear in `meta.warnings`.
- Missing production signals appear in `meta.missingSignals`.
- Action policy respects signal policy before answer thresholds.
- Legacy preset preserves v0.2 action behavior.

FAIL:

- Production preset returns `answer` without answer relevance.
- Production preset returns `answer` without faithfulness or claim support.
- Missing required signals are only human-readable strings and not machine-readable warnings.

Suggested commit:

```bash
git add src tests examples README.md
git commit -m "feat: add production signal policy"
```

---

## Phase 3: Retrieval Robustness

**Purpose:** Make retrieval scoring harder to fool with repeated chunks, missing ranks, or score scales that look confident but are not calibrated.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/dimensions/retrieval.ts`
- Modify: `src/validation.ts`
- Modify: `src/warnings.ts`
- Modify: `tests/dimensions/retrieval.test.ts`
- Create or modify: `examples/retrieval-tuning.ts`

### Required Work

- [x] Add `DuplicateContentConfig`.
- [x] Add `RankPenaltyConfig`.
- [x] Add retrieval diagnostics:
  - `duplicateContentHashCount`
  - `rankedCandidateCount`
  - `missingRankCount`
  - `rankPenalty`
  - `duplicatePenalty`
- [x] Keep duplicate content diagnostic-only by default.
- [x] Keep rank diagnostic-only by default.
- [x] Add duplicate penalty when `duplicateContent.mode = 'penalize'`.
- [x] Add rank penalty when `rankPenalty.mode = 'penalize'`.
- [x] Validate config values:
  - penalties are finite and non-negative.
  - max penalties are finite and non-negative.
  - `afterRank` is integer >= 1.
- [x] Add warning `duplicate-content`.
- [x] Add warning `rank-signal-missing`.

### Required Tests

Add to `tests/dimensions/retrieval.test.ts`:

- `duplicate content hashes are diagnostic-only by default`.
- `duplicate content penalty reduces retrieval raw when enabled`.
- `duplicate content penalty is capped`.
- `rank penalty is diagnostic-only by default`.
- `rank penalty reduces retrieval raw when enabled`.
- `missing ranks warn when rank penalty is enabled`.
- `invalid duplicate penalty config throws`.
- `invalid rank penalty config throws`.
- `v0.2 retrieval totals remain unchanged when new configs are omitted`.

Use this duplicate scenario:

```typescript
const duplicateCandidates: Candidate[] = [
  {
    retrievalScores: { semantic: 0.91, keyword: 0.81 },
    combinedScore: 0.91,
    documentId: 'doc-1',
    contentHash: 'same',
    rank: 1,
  },
  {
    retrievalScores: { semantic: 0.89, keyword: 0.79 },
    combinedScore: 0.89,
    documentId: 'doc-1',
    contentHash: 'same',
    rank: 2,
  },
  {
    retrievalScores: { semantic: 0.87, keyword: 0.77 },
    combinedScore: 0.87,
    documentId: 'doc-2',
    contentHash: 'different',
    rank: 11,
  },
];
```

Run:

```bash
npm test -- tests/dimensions/retrieval.test.ts
npm test -- tests/integration.test.ts
npm run typecheck
```

PASS:

- Existing retrieval behavior is unchanged with default config.
- Penalty modes reduce raw score only when explicitly enabled.
- All penalties appear in `breakdown.adjustments`.
- Diagnostics are present in `breakdown.diagnostics`.

FAIL:

- Duplicate chunks reduce score without opt-in config.
- Penalties can make raw score negative.
- Missing ranks in diagnostic mode force review.

Suggested commit:

```bash
git add src tests examples README.md
git commit -m "feat: add retrieval duplicate and rank diagnostics"
```

---

## Phase 4: Calibration Utilities

**Purpose:** Let users evaluate whether scores and action thresholds match real outcomes in their own RAG system.

**Files:**

- Create: `src/calibration.ts`
- Modify: `src/index.ts`
- Modify: `src/types.ts`
- Modify: `src/warnings.ts`
- Create: `tests/calibration.test.ts`
- Create: `examples/calibration-analysis.ts`
- Modify: `README.md`
- Create or modify: `docs/algorithm-v0-3.md`

### Required Work

- [x] Implement `analyzeCalibration`.
- [x] Validate calibration samples.
- [x] Generate default score bands.
- [x] Compute positive rate by band.
- [x] Compute positive rate by recommended action.
- [x] Recommend an action policy from targets:
  - `answerAt` should be the lowest threshold whose band meets `targetPrecisionForAnswer`.
  - `reviewAt` should remain at or below `answerAt`.
  - `abstainBelow` should be the highest threshold below which outcomes fail `targetRecallForAbstain`.
  - If sample size is too low, keep conservative defaults and emit `low-calibration-sample-size`.
- [x] Add warning `uncalibrated-score` to docs as a recommended production log warning, not a default scorer warning.
- [x] Add README section: "Calibration: turning score into local reliability."

### Required Tests

Create `tests/calibration.test.ts` with:

- `throws on empty samples`.
- `throws on total below 0`.
- `throws on total above 100`.
- `computes default bands`.
- `computes positive rate per band`.
- `computes action summary`.
- `uses custom positive outcomes`.
- `emits low-calibration-sample-size warning`.
- `recommends higher answerAt when moderate band has low precision`.
- `does not mutate input samples`.

Use deterministic sample fixture:

```typescript
const samples: CalibrationSample[] = [
  { id: '1', total: 92, recommendedAction: 'answer', outcome: 'correct' },
  { id: '2', total: 88, recommendedAction: 'answer', outcome: 'correct' },
  { id: '3', total: 76, recommendedAction: 'answer', outcome: 'incorrect' },
  { id: '4', total: 68, recommendedAction: 'review', outcome: 'correct' },
  { id: '5', total: 52, recommendedAction: 'review', outcome: 'incorrect' },
  { id: '6', total: 31, recommendedAction: 'abstain', outcome: 'incorrect' },
];
```

Run:

```bash
npm test -- tests/calibration.test.ts
npm run typecheck
```

PASS:

- Calibration helpers are deterministic.
- No runtime dependencies are added.
- Report fields are machine-readable.
- Low sample warnings are returned, not logged.

FAIL:

- Calibration changes `computeConfidence`.
- Calibration imports external packages.
- Calibration reports only prose and no structured bands.

Suggested commit:

```bash
git add src tests examples README.md docs
git commit -m "feat: add calibration analysis utilities"
```

---

## Phase 5: External Evaluator Signal Bridge

**Purpose:** Make it easy to feed outputs from existing evaluation systems into `computeConfidence` without coupling to those systems.

**Files:**

- Create: `src/evaluators.ts`
- Modify: `src/index.ts`
- Modify: `src/types.ts`
- Modify: `src/validation.ts`
- Create: `tests/evaluators.test.ts`
- Create: `examples/evaluator-bridge.ts`
- Modify: `README.md`

### Required Work

- [x] Implement `mergeEvaluationSignals`.
- [x] Implement `fromRagasLike`.
- [x] Implement `fromDeepEvalLike`.
- [x] Implement `fromTruLensLike`.
- [x] Implement `fromCustomJudge`.
- [x] Add plain object field mapping tables to docs.
- [x] Return warnings for no recognized fields.
- [x] Never import external evaluator SDKs.

### Field Mapping Targets

RAGAS-like:

| Input key | Signal |
|---|---|
| `faithfulness` | `faithfulnessScore` |
| `answer_relevancy` | `answerRelevanceScore` |
| `answerRelevance` | `answerRelevanceScore` |
| `context_precision` | diagnostic only |
| `context_recall` | diagnostic only |

DeepEval-like:

| Input key | Signal |
|---|---|
| `faithfulnessScore` | `faithfulnessScore` |
| `answerRelevancyScore` | `answerRelevanceScore` |
| `score` with `metric: 'faithfulness'` | `faithfulnessScore` |

TruLens-like:

| Input key | Signal |
|---|---|
| `groundedness` | `faithfulnessScore` |
| `answer_relevance` | `answerRelevanceScore` |
| `context_relevance` | diagnostic only |

Custom judge:

| Input key | Signal |
|---|---|
| `faithfulnessScore` | `faithfulnessScore` |
| `answerRelevanceScore` | `answerRelevanceScore` |
| `supportedClaims` + `totalClaims` | `claimSupport` |
| `citationCoverageScore` | `citationCoverageScore` |
| `invalidCitationCount` | `invalidCitationCount` |
| `hasConflict` | `hasConflict` |
| `conflictingCandidateCount` | `conflictingCandidateCount` |

### Required Tests

Create `tests/evaluators.test.ts` with:

- `fromRagasLike maps faithfulness and answer relevancy`.
- `fromDeepEvalLike maps direct score fields`.
- `fromTruLensLike maps groundedness`.
- `fromCustomJudge maps claim counts`.
- `mergeEvaluationSignals does not mutate original inputs`.
- `mergeEvaluationSignals overrides absent fields`.
- `mergeEvaluationSignals preserves explicit existing fields unless override option is added`.
- `unknown evaluator shape returns empty signals`.
- `out-of-range mapped values produce validation warning during computeConfidence`.

Run:

```bash
npm test -- tests/evaluators.test.ts
npm test -- tests/signal-policy.test.ts
npm run typecheck
```

PASS:

- Common evaluator shapes produce expected normalized signals.
- Unknown fields are ignored.
- Unknown shapes are safe.
- Existing scorer validation handles bad numeric values.

FAIL:

- Helper imports external evaluator packages.
- Mapper throws on harmless unknown fields.
- Merge mutates the input object.

Suggested commit:

```bash
git add src tests examples README.md
git commit -m "feat: add evaluator signal bridge"
```

---

## Phase 6: Index Integrity Extension

**Purpose:** Extend Tier 2 from corpus/freshness only to a more realistic production readiness score.

**Files:**

- Create: `src/dimensions/index-integrity.ts`
- Modify: `src/types.ts`
- Modify: `src/scorer.ts`
- Modify: `src/validation.ts`
- Modify: `src/warnings.ts`
- Create: `tests/dimensions/index-integrity.test.ts`
- Modify: `tests/integration.test.ts`
- Create: `examples/index-integrity.ts`
- Modify: `README.md`
- Modify: `docs/algorithm-v0-3.md`

### Required Work

- [x] Implement max 15 raw point dimension.
- [x] Add dimension breakdown with components:
  - `embeddingVersion`
  - `sourceVersionMatch`
  - `staleness`
  - `ingestionFailures`
  - `aclFilter`
  - `deletedSourceLeakage`
- [x] Add diagnostics for all raw input values.
- [x] Add warnings:
  - `index-integrity-incomplete`
  - `embedding-version-mismatch`
  - `acl-filter-unconfirmed`
  - `deleted-source-leakage`
- [x] Add to Tier 2 calculation when active.
- [x] Add to `meta.activeExtensions`.
- [x] Add to `meta.activeDimensions`.
- [x] Keep inactive when `config.indexIntegrity` is absent.

### Required Tests

Create `tests/dimensions/index-integrity.test.ts` with:

- `scores full when all index signals are clean`.
- `embedding version mismatch scores zero for embedding sub-signal and warns`.
- `missing embedding versions score partial and warn incomplete`.
- `sourceVersionMatchRatio bands score 3 2 1 0`.
- `staleIndexedDocumentRatio bands score 3 1 0`.
- `failedIngestionCount above threshold loses ingestion points`.
- `aclFilterConfirmed false warns when required`.
- `deletedSourceLeakageCount greater than zero emits error warning`.
- `dimension inactive unless config.indexIntegrity exists`.
- `tier2 includes indexIntegrity when active`.
- `breakdown.raw equals DimensionScore.raw`.

Run:

```bash
npm test -- tests/dimensions/index-integrity.test.ts
npm test -- tests/integration.test.ts
npm run typecheck
```

PASS:

- Dimension is opt-in.
- Tier 2 score changes only when active.
- Deleted source leakage is visible as an error severity warning.
- All sub-signals are machine-readable.

FAIL:

- Index integrity changes default v0.2/v0.3 core scores when inactive.
- Warning is only in explanation text and not in metadata.
- Dimension score cannot be reconstructed from breakdown.

Suggested commit:

```bash
git add src tests examples README.md docs
git commit -m "feat: add index integrity extension"
```

---

## Phase 7: Documentation, Examples, And Migration

**Purpose:** Make v0.3 understandable to users and implementable by downstream teams.

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/algorithm-v0-3.md`
- Create: `docs/migration-v0-3.md`
- Create: `examples/production-gating.ts`
- Create: `examples/calibration-analysis.ts`
- Create: `examples/evaluator-bridge.ts`
- Create: `examples/index-integrity.ts`
- Modify: existing examples if output scores change under default preset

### Required README Sections

- [x] What the v0.3 score means.
- [x] What the v0.3 score does not mean.
- [x] v0.2 compatibility preset.
- [x] Production preset.
- [x] Signal policy reference.
- [x] Calibration utilities.
- [x] Evaluator signal bridge.
- [x] Retrieval duplicate/rank diagnostics.
- [x] Index integrity extension.
- [x] Package contents.
- [x] Release verification commands.
- [x] Updated API reference.
- [x] Updated warning code table.
- [x] Updated algorithm summary.

### Required Migration Guide Sections

- [x] Upgrade package version.
- [x] Decide preset: `legacy-v0.2`, `balanced-v0.3`, or `production-v0.3`.
- [x] If using strict production gating, provide `answerRelevanceScore` and either `faithfulnessScore` or `claimSupport`.
- [x] If using retrieval duplicate/rank penalties, add `contentHash` and `rank` to candidates.
- [x] If using index integrity, provide `inputs.indexIntegrity`.
- [x] If relying on npm package docs/examples, note that v0.3 includes them in the tarball.
- [x] Update tests for algorithm/schema version.

### Required Example Outputs

Every example must:

- Exit 0 under `npx tsx`.
- Print `total`.
- Print `recommendedAction`.
- Print warning codes.
- Include a header comment with expected label/action range.

Run:

```bash
npx tsx examples/basic-rag.ts
npx tsx examples/legal-docs.ts
npx tsx examples/knowledge-base.ts
npx tsx examples/full-pipeline.ts
npx tsx examples/production-gating.ts
npx tsx examples/calibration-analysis.ts
npx tsx examples/evaluator-bridge.ts
npx tsx examples/index-integrity.ts
npm run lint
```

PASS:

- README describes limitations clearly.
- Migration guide has no vague instructions.
- Every example runs.
- Docs match actual exported API names.

FAIL:

- README implies the score is calibrated by default.
- README implies the package verifies citations by itself.
- Examples require dependencies not in `devDependencies`.
- Docs contain public API names that do not compile.

Suggested commit:

```bash
git add README.md CHANGELOG.md docs examples
git commit -m "docs: document v0.3 production confidence workflows"
```

---

## Phase 8: Full Integration And Release Gate

**Purpose:** Verify v0.3 as a publishable release.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` only if npm changes it during version/script updates
- Modify: release docs as needed

### Required Work

- [x] Set `package.json.version` to `0.3.0`.
- [x] Confirm `package-lock.json` version entries match `0.3.0`.
- [x] Confirm package has zero runtime dependencies.
- [x] Confirm new docs/examples are either included in package or linked to GitHub.
- [x] Confirm no generated tarball is left in the repo.
- [x] Confirm untracked files are intentional.

### Release Verification

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run coverage
npm run build
npm pack --dry-run
npm publish --dry-run
```

Run version checks:

```bash
rg "0\\.2\\.0|schemaVersion.*0\\.2|ALGORITHM_VERSION = '0\\.2\\.0'|SCORECARD_SCHEMA_VERSION = '0\\.2'" src tests examples README.md docs CHANGELOG.md package.json
```

Expected version-check behavior:

- Matches are allowed only in historical migration/changelog sections that explicitly discuss v0.2.
- No source, active tests, current README quick start, or current algorithm docs should identify the active algorithm as v0.2.

Run package-content check:

```bash
npm pack --dry-run
```

Expected package contents:

- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`
- `dist/index.d.cts`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `package.json`
- `docs/algorithm-v0-3.md`
- `docs/migration-v0-3.md`
- examples included if README links package-local examples

Coverage thresholds:

- Lines: >= 90%
- Functions: >= 95%
- Branches: >= 85%
- Statements: >= 90%

PASS:

- Every release command exits 0.
- Coverage meets thresholds.
- Pack output is intentional.
- Runtime dependencies remain empty.
- `npm publish --dry-run` exits 0.

FAIL:

- Any release command exits non-zero.
- Version constants are stale.
- Tarball omits docs/examples while README uses package-local links.
- Runtime dependencies are added.
- New public helpers are not exported from package root.

Suggested commit:

```bash
git add package.json package-lock.json README.md CHANGELOG.md docs examples src tests
git commit -m "chore: prepare v0.3 release"
```

---

## Suggested Commit Sequence

Use small commits so behavior changes are reviewable.

1. `chore: restore v0.2 verification baseline`
2. `feat: add v0.3 public API surface`
3. `feat: add production signal policy`
4. `feat: add retrieval duplicate and rank diagnostics`
5. `feat: add calibration analysis utilities`
6. `feat: add evaluator signal bridge`
7. `feat: add index integrity extension`
8. `docs: document v0.3 production confidence workflows`
9. `chore: prepare v0.3 release`

---

## Acceptance Criteria

v0.3 is complete only when all of these are true:

- `npm run typecheck` exits 0.
- `npm run lint` exits 0.
- `npm test` exits 0.
- `npm run coverage` meets thresholds.
- `npm run build` exits 0.
- `npm pack --dry-run` shows intended files.
- `npm publish --dry-run` exits 0.
- Runtime package still has zero dependencies.
- Package exports every new public helper from `src/index.ts`.
- Algorithm version is `0.3.0`.
- Schema version is `0.3`.
- Existing v0.2-style core scoring remains usable.
- `legacy-v0.2` preset preserves v0.2 action behavior as closely as possible.
- `production-v0.3` does not return `answer` when answer relevance is missing.
- `production-v0.3` does not return `answer` when both faithfulness and claim support are missing.
- Signal policy missing signals are machine-readable.
- Calibration report includes bands, action summary, recommended policy, and warnings.
- Evaluator bridge consumes plain objects and imports no external evaluator SDKs.
- Retrieval duplicate/rank penalties are opt-in.
- Index integrity is opt-in and included in Tier 2 only when active.
- Every active dimension has `breakdown.raw === DimensionScore.raw`.
- No scorer path logs to console.
- README clearly states the score is not calibrated by default.
- README clearly states the package does not verify citations by itself.
- Migration guide is present.
- Algorithm reference is present.
- Examples run with `npx tsx`.

---

## Design Notes For v0.4 And v1.0

These should remain out of v0.3 unless this plan is revised:

- v0.4 candidate: OpenTelemetry export helpers with no hard dependency.
- v0.4 candidate: CLI for scoring JSONL logs offline.
- v0.4 candidate: HTML/Markdown scorecard renderer.
- v0.4 candidate: richer retrieval calibration with query classes.
- v1.0 candidate: stable public schema contract and formal semver policy.
- v1.0 candidate: published calibration benchmark examples.
- v1.0 candidate: framework-specific adapter packages outside the core package.

The core package should stay small, deterministic, and audit-friendly. The center of gravity is a trustworthy scorecard, not a platform.
