# transparent-confidence — Build Plan v1.0

> Source of truth for all build decisions. Do not modify without updating the version number and noting the change in the revision log below.

## Revision Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-06 | Initial spec locked |

---

## Package Identity

| Field | Value |
|---|---|
| Package name | `transparent-confidence` |
| Version | `0.1.0` |
| License | Apache 2.0 |
| Language | TypeScript 5.x, strict mode |
| Runtime | Node.js 18+ |
| Module output | ESM + CJS dual (via tsup) |
| Test runner | Vitest |
| Linter/formatter | Biome |
| Build tool | tsup |
| Package manager | npm |

---

## What This Package Does

Computes a structured, explainable confidence score (0–100) for any RAG system answer. Scores three universally-applicable dimensions out of the box with zero configuration. Accepts up to three optional domain-specific extensions. Always normalizes to 0–100 regardless of which extensions are active. Returns a typed scorecard with per-dimension breakdowns and human-readable explanations — not just a number.

---

## Locked Scoring Model

### Normalization Formula

```
normalizedScore = round((rawTotal / maxPossible) × 100)

maxPossible = 65
           + 20  (if withAuthority active)
           + 15  (if withCorpus active)
           + 15  (if withFreshness active)
```

### Labels (applied to normalized 0–100 score)

| Label | Range | Color |
|---|---|---|
| Strong | ≥ 85 | green |
| Moderate | ≥ 65 | amber |
| Limited | ≥ 40 | orange |
| Insufficient | < 40 | red |

### Tier Display

- **Tier 1 — Answer Confidence:** Grounding + Retrieval + Consistency + Authority (if active). Normalized independently to 0–100.
- **Tier 2 — System Readiness:** Corpus + Freshness (if active). Normalized independently to 0–100. Hidden if neither extension is configured.

---

### Dimension 1 — Answer Grounding (max 30 raw pts)

**Inputs:** `confidenceLevel`, `ambiguityNotes`, `documentsSilent`, `requiresExpertReview`, `externalConstraintNote`, `hasConflict`
**Enhanced by:** `queryComplexity` (ceiling), `citationCount` (bonus), `faithfulnessScore` (modifier)

#### Base Score

| Condition | Base |
|---|---|
| `documentsSilent = true` | 0 — skip all remaining logic |
| `confidenceLevel = 'low'` | 5 |
| `confidenceLevel = 'medium'` | 13 |
| `confidenceLevel = 'high'` + ambiguity present | 21 |
| `confidenceLevel = 'high'` + no ambiguity | 30 |

#### Penalties (applied after base, floor 0)

| Condition | Penalty |
|---|---|
| `requiresExpertReview = true` | −3 |
| `externalConstraintNote` present | −2 |
| `hasConflict = true` | −5 |

#### `queryComplexity` Ceiling (applied after penalties)

| Value | Ceiling |
|---|---|
| `'direct'` or not provided | 30 (no ceiling) |
| `'inferential'` | 24 |
| `'multi-hop'` | 18 |
| `'comparative'` | 16 |

#### `faithfulnessScore` Modifier (applied after ceiling, floor 0)

| Value | Modifier |
|---|---|
| ≥ 0.90 | +0 |
| 0.70–0.89 | −3 |
| 0.50–0.69 | −7 |
| < 0.50 | −12 |
| Not provided | Not applied |

#### `citationCount` Bonus (applied last, cannot exceed dimension max of 30)

| Value | Bonus |
|---|---|
| ≥ 3 | +2 |
| 2 | +1 |
| 0–1 or not provided | +0 |

---

### Dimension 2 — Retrieval Confidence (max 25 raw pts)

**Inputs:** `candidates[].retrievalScores` (Record\<string, number\>), `candidates[].combinedScore`, `candidates[].documentId`
**Enhanced by:** `candidates[].extractionQuality`

Three sub-signals summed. Total capped at 25 if sub-signal math exceeds it.

#### Sub-signal A — Method Agreement (0–15)

Count candidates where ≥ 2 named retrieval methods each scored > 0:

| Candidates confirmed by 2+ methods | Points |
|---|---|
| ≥ 3 | 15 |
| 2 | 12 |
| 1 | 8 |
| 0 | 3 |

#### Sub-signal B — Score Magnitude (0–8)

Average `combinedScore` of top 3 candidates. If `extractionQuality` is provided per candidate, apply before averaging: `effectiveScore = combinedScore × extractionQuality`.

| Avg effective score | Points |
|---|---|
| ≥ 0.80 | 8 |
| ≥ 0.65 | 6 |
| ≥ 0.50 | 4 |
| ≥ 0.35 | 2 |
| < 0.35 | 0 |

#### Sub-signal C — Source Diversity + Section Breadth (0–5)

| Unique `documentId` values among candidates | Points |
|---|---|
| ≥ 3 distinct documents | +3 |
| 2 distinct documents | +1 |
| 1 or `documentId` not provided | +0 |

| Total candidate count | Points |
|---|---|
| ≥ 5 | +2 |
| 3–4 | +1 |
| ≤ 2 | +0 |

---

### Dimension 3 — Evidence Consistency (max 10 raw pts)

**Inputs:** `candidates[].combinedScore`, `conflictingCandidateCount`, `hasConflict`

Max 10 is achievable: variance < 0.10 (8 pts) + no conflict bonus (+2 pts) = 10.
`conflictingCandidateCount` takes precedence over boolean `hasConflict` when both provided.

#### Sub-signal A — Score Variance (0–8)

Population standard deviation of `combinedScore` across all candidates:

| Condition | Points |
|---|---|
| No candidates | 0 |
| Only 1 candidate | 4 (neutral — variance unmeasurable) |
| std dev < 0.10 | 8 |
| std dev < 0.20 | 6 |
| std dev < 0.30 | 4 |
| std dev ≥ 0.30 | 2 |

#### Sub-signal B — Conflict Status (−2 to +2, floor 0 on total)

| Condition | Adjustment |
|---|---|
| `conflictingCandidateCount = 0` or no conflict indicators | +2 |
| `conflictingCandidateCount = 1` | 0 |
| `conflictingCandidateCount ≥ 2` | −2 |
| `hasConflict = true` (boolean fallback, no count given) | −2 |

---

### Extension A — Source Authority (max 20 raw pts)

**Activate with:** `config.authority`
**Inputs:** `candidates[].documentType`, `candidates[].authorityRank`, `candidates[].isAmendment`

```typescript
interface AuthorityTier {
  name: string;
  rank: number;        // lower = higher authority
  keywords?: string[]; // matched against documentType for auto-classification
}
```

Default tiers when `config.authority.tiers` is omitted:

| Tier | Rank |
|---|---|
| Primary | 10 |
| Secondary | 20 |
| Supporting | 30 |

#### Base Score (by lowest rank among candidates)

| Min effective rank | Base |
|---|---|
| ≤ 10 | 18 |
| ≤ 20 | 13 |
| ≤ 30 | 7 |
| > 30 or unclassified | 2 |
| No candidates | 0 |

#### Bonuses

| Condition | Points |
|---|---|
| Any candidate has `isAmendment = true` | +1 |
| > 1 unique rank tier represented across candidates | +1 |

Max: 20.

---

### Extension B — Corpus Completeness (max 15 raw pts)

**Activate with:** `config.corpus`
**Inputs:** `corpusDocCount`, `missingRelevantType`

```typescript
interface CorpusConfig {
  expectedDocCount: number;
}
```

#### Base Score

```
ratio = min(corpusDocCount, expectedDocCount) / expectedDocCount
```

| Ratio | Base |
|---|---|
| ≥ 1.0 (100%) | 15 |
| ≥ 0.80 | 12 |
| ≥ 0.60 | 9 |
| ≥ 0.40 | 5 |
| ≥ 0.20 | 2 |
| < 0.20 | 0 |

#### Penalty

| Condition | Penalty |
|---|---|
| `missingRelevantType = true` | −3 |

Floor: 0. Max: 15.

---

### Extension C — Document Freshness (max 15 raw pts)

**Activate with:** `config.freshness`
**Inputs:** `candidates[].lastUpdated` (Date)

```typescript
interface FreshnessConfig {
  maxAgeForFullScore?: number; // days, default 90
  penaltyPerMonth?: number;    // pts/month beyond window, default 1.5
  hardCutoffAge?: number;      // days, default 730
}
```

Scoring uses the median `lastUpdated` across candidates.

| Condition | Score |
|---|---|
| All candidates within `maxAgeForFullScore` | 15 |
| Beyond window: subtract `penaltyPerMonth` per 30-day increment | Decreasing |
| Median age ≥ `hardCutoffAge` | 0 |
| No `lastUpdated` values provided | 0 (with explanation noting missing data) |

Floor: 0. Max: 15.

---

## Complete Type Surface

```typescript
interface Candidate {
  retrievalScores: Record<string, number>; // e.g. { semantic: 0.8, keyword: 0.6 }
  combinedScore: number;                   // 0–1
  documentId?: string;
  documentType?: string;
  authorityRank?: number;
  isAmendment?: boolean;
  extractionQuality?: number;              // 0–1
  lastUpdated?: Date;
}

interface ScoringInputs {
  // LLM-assessed
  confidenceLevel: 'high' | 'medium' | 'low';
  ambiguityNotes?: string | null;
  requiresExpertReview?: boolean;
  externalConstraintNote?: string | null;
  documentsSilent?: boolean;
  hasConflict?: boolean;
  conflictingCandidateCount?: number;
  queryComplexity?: 'direct' | 'inferential' | 'multi-hop' | 'comparative';
  faithfulnessScore?: number;              // 0–1
  citationCount?: number;

  // Retrieval pipeline
  candidates: Candidate[];

  // Corpus state (required only if Corpus extension active)
  corpusDocCount?: number;
  missingRelevantType?: boolean;
}

interface AuthorityTier {
  name: string;
  rank: number;
  keywords?: string[];
}

interface FreshnessConfig {
  maxAgeForFullScore?: number;
  penaltyPerMonth?: number;
  hardCutoffAge?: number;
}

interface ScoringConfig {
  authority?: { tiers?: AuthorityTier[] };
  corpus?: { expectedDocCount: number };
  freshness?: FreshnessConfig;
}

interface DimensionScore {
  raw: number;
  max: number;
  normalized: number;
  explanation: string;
}

interface ConfidenceScorecard {
  total: number;                      // 0–100 normalized integer
  label: 'Strong' | 'Moderate' | 'Limited' | 'Insufficient';
  labelColor: 'green' | 'amber' | 'orange' | 'red';
  tier1: { score: number; label: string; color: string } | null;
  tier2: { score: number; label: string; color: string } | null;
  dimensions: {
    grounding: DimensionScore;
    retrieval: DimensionScore;
    consistency: DimensionScore;
    authority?: DimensionScore;
    corpus?: DimensionScore;
    freshness?: DimensionScore;
  };
  meta: {
    rawTotal: number;
    maxPossible: number;
    activeExtensions: string[];
  };
}

// Public API
function computeConfidence(inputs: ScoringInputs, config?: ScoringConfig): ConfidenceScorecard;
function createScorer(config: ScoringConfig): { compute: (inputs: ScoringInputs) => ConfidenceScorecard };
```

---

## File Structure

```
C:\Dev\transparent-confidence\
├── src/
│   ├── index.ts                       ← public exports only
│   ├── types.ts                       ← all interfaces/types
│   ├── normalize.ts                   ← rawTotal/maxPossible → 0–100
│   ├── labels.ts                      ← label + tier derivation
│   ├── scorer.ts                      ← computeConfidence + createScorer
│   └── dimensions/
│       ├── grounding.ts               ← Dimension 1
│       ├── retrieval.ts               ← Dimension 2
│       ├── consistency.ts             ← Dimension 3
│       ├── authority.ts               ← Extension A
│       ├── corpus.ts                  ← Extension B
│       └── freshness.ts               ← Extension C
├── tests/
│   ├── dimensions/
│   │   ├── grounding.test.ts
│   │   ├── retrieval.test.ts
│   │   ├── consistency.test.ts
│   │   ├── authority.test.ts
│   │   ├── corpus.test.ts
│   │   └── freshness.test.ts
│   ├── normalize.test.ts
│   ├── labels.test.ts
│   └── integration.test.ts            ← end-to-end scenario suite
├── examples/
│   ├── basic-rag.ts                   ← 3 core dims, zero config
│   ├── legal-docs.ts                  ← Authority + Corpus (HOA scenario)
│   ├── knowledge-base.ts              ← Freshness only, flat KB
│   └── full-pipeline.ts               ← all dims + all enhanced signals
├── .github/
│   └── workflows/
│       ├── ci.yml                     ← lint + tsc + test on push/PR
│       └── publish.yml                ← npm publish on v* tag
├── BUILD-PLAN.md                      ← this document
├── CHANGELOG.md
├── README.md
├── package.json
├── tsconfig.json                      ← includes src/ + tests/ + examples/
├── tsconfig.build.json                ← src/ only, used by tsup
└── biome.json
```

---

## Phase 0 — Repo + Toolchain

**Goal:** Empty project that type-checks, lints clean, and runs an empty test suite.

### Tasks

1. Verify `C:\Dev\transparent-confidence\` exists
2. `npm init -y` — then update `package.json`: name, version `0.1.0`, license `Apache-2.0`, description, keywords, `main`, `module`, `types`, `exports` fields
3. Install dev dependencies: `npm install -D typescript vitest @vitest/coverage-v8 biome tsup tsx`
4. Write `tsconfig.json` — strict, ESNext target, bundler module resolution
5. Write `tsconfig.build.json` — extends tsconfig, includes only `src/`
6. Write `biome.json` — formatter + linter config
7. Add npm scripts to `package.json`: `build`, `test`, `lint`, `typecheck`, `coverage`
8. Create `src/index.ts` (empty export placeholder)
9. Create `src/types.ts` (empty placeholder)
10. Create `tests/integration.test.ts` (single placeholder: `expect(true).toBe(true)`)
11. `git init`, write `.gitignore` (`node_modules/`, `dist/`, `.env`)
12. Create GitHub repo `transparent-confidence`, push initial commit with `BUILD-PLAN.md`

### Pass/Fail Gate — Phase 0

| Check | Command | Expected result |
|---|---|---|
| Dependencies install | `npm install` | Exit 0, no peer warnings |
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 |
| Biome clean | `npx biome check src/` | Exit 0 |
| Tests run | `npx vitest run` | Exit 0, 1 test passes |
| Build output | `npm run build` | Exit 0, `dist/` created |

**Hard stop if any gate fails. Do not proceed to Phase 1.**

---

## Phase 1 — Type System

**Goal:** All interfaces and types defined, exported, and compile clean. No scoring logic yet.

### Tasks

1. Write all types in `src/types.ts`: `Candidate`, `ScoringInputs`, `ScoringConfig`, `AuthorityTier`, `FreshnessConfig`, `DimensionScore`, `ConfidenceScorecard`
2. Export all public types from `src/index.ts`
3. Verify every field from the locked spec is represented
4. Verify optional vs. required designations match the spec exactly

### Pass/Fail Gate — Phase 1

| Check | Command | Expected result |
|---|---|---|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 |
| Biome clean | `npx biome check src/` | Exit 0 |

**Specific type correctness checks (manual):**
- `ScoringInputs.candidates` is `Candidate[]`, required (not optional)
- `ScoringInputs.confidenceLevel` is `'high' | 'medium' | 'low'`, not `string`
- `ScoringConfig` has all three extensions as optional
- `ConfidenceScorecard.dimensions.authority` is `DimensionScore | undefined`
- `ConfidenceScorecard.total` is `number`
- `DimensionScore.raw`, `.max`, `.normalized` are all `number`

---

## Phase 2 — Core Dimensions

**Goal:** Three core dimensions implemented and individually unit tested. Normalization working.

### Tasks

1. Implement `src/dimensions/grounding.ts` — exports `scoreGrounding(inputs: ScoringInputs): DimensionScore`
2. Implement `src/dimensions/retrieval.ts` — exports `scoreRetrieval(inputs: ScoringInputs): DimensionScore`
3. Implement `src/dimensions/consistency.ts` — exports `scoreConsistency(inputs: ScoringInputs): DimensionScore`
4. Implement `src/normalize.ts` — exports `normalize(raw: number, max: number): number`
5. Write `tests/dimensions/grounding.test.ts`
6. Write `tests/dimensions/retrieval.test.ts`
7. Write `tests/dimensions/consistency.test.ts`
8. Write `tests/normalize.test.ts`

### Pass/Fail Gate — Phase 2

| Check | Command | Expected result |
|---|---|---|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 |
| Biome clean | `npx biome check src/` | Exit 0 |
| All tests pass | `npx vitest run` | Exit 0 |

**Required passing test cases:**

*Grounding:*
- `confidenceLevel:'high'`, no ambiguity, no penalties → `raw = 30`
- `confidenceLevel:'high'`, ambiguity present → `raw = 21`
- `confidenceLevel:'medium'` → `raw = 13`
- `confidenceLevel:'low'` → `raw = 5`
- `documentsSilent:true` → `raw = 0` (all other inputs ignored)
- `requiresExpertReview:true` on base 30 → `raw = 27`
- `hasConflict:true` on base 30 → `raw = 25`
- All three penalties stacked on base 30 → `raw = 20`
- All three penalties stacked on base 5 → `raw = 0` (floor)
- `queryComplexity:'multi-hop'` with post-penalty score 25 → capped at 18
- `faithfulnessScore:0.40` applied after ceiling → additional −12, floor 0
- `citationCount:3` bonus does not push `raw` above 30

*Retrieval:*
- 3 candidates all with 2 method scores > 0, avg combinedScore 0.85, 5 candidates, 3 unique documentIds → `raw = 25` (capped)
- 0 candidates → `raw = 0`
- All candidates single-method only, 0 in agreement slot → agreement sub-signal = 3
- `extractionQuality:0.40` reduces effective score vs. same candidates without it
- 3 unique `documentId` values → +3 source diversity points applied

*Consistency:*
- 5 candidates, std dev < 0.10, no conflict → `raw = 10` (8 variance + 2 no-conflict bonus)
- 5 candidates, std dev < 0.10, `conflictingCandidateCount:2` → `raw = 6` (8 − 2)
- 1 candidate, no conflict → `raw = 6` (4 neutral + 2 bonus)
- 0 candidates → `raw = 0`
- `conflictingCandidateCount:1` → neutral adj (0), variance score only
- std dev ≥ 0.30, `conflictingCandidateCount:2` → `raw = max(0, 2 − 2) = 0`

*Normalize:*
- `normalize(65, 65)` → `100`
- `normalize(0, 65)` → `0`
- `normalize(32, 65)` → `49`
- `normalize(65, 115)` → `57`
- Result is always an integer (rounded)

---

## Phase 3 — Optional Extensions

**Goal:** Three extensions implemented and tested. Normalization handles all active-extension combinations correctly.

### Tasks

1. Implement `src/dimensions/authority.ts` — exports `scoreAuthority(inputs: ScoringInputs, config: ScoringConfig): DimensionScore`
2. Implement `src/dimensions/corpus.ts` — exports `scoreCorpus(inputs: ScoringInputs, config: ScoringConfig): DimensionScore`
3. Implement `src/dimensions/freshness.ts` — exports `scoreFreshness(inputs: ScoringInputs, config: ScoringConfig): DimensionScore`
4. Write `tests/dimensions/authority.test.ts`
5. Write `tests/dimensions/corpus.test.ts`
6. Write `tests/dimensions/freshness.test.ts`
7. Update `tests/normalize.test.ts` with all extension combination cases

### Pass/Fail Gate — Phase 3

| Check | Command | Expected result |
|---|---|---|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 |
| Biome clean | `npx biome check src/` | Exit 0 |
| All tests pass | `npx vitest run` | Exit 0 |

**Required passing test cases:**

*Authority:*
- Min rank ≤ 10 + both bonuses → `raw = 20`
- Min rank ≤ 10, no bonuses → `raw = 18`
- Min rank ≤ 20 → `raw = 13`
- Min rank > 30 → `raw = 2`
- No candidates → `raw = 0`
- Custom tier config: keyword match on `documentType` resolves to correct rank

*Corpus:*
- `corpusDocCount:5`, `expectedDocCount:5`, no missing → `raw = 15`
- `corpusDocCount:1`, `expectedDocCount:5` → `raw = 2`
- `corpusDocCount:3`, `expectedDocCount:5`, `missingRelevantType:true` → `raw = max(0, 9 − 3) = 6`
- `corpusDocCount:1`, `expectedDocCount:5`, `missingRelevantType:true` → `raw = max(0, 2 − 3) = 0`

*Freshness:*
- All candidates within `maxAgeForFullScore` → `raw = 15`
- All candidates beyond `hardCutoffAge` → `raw = 0`
- Median age 3 months beyond window, `penaltyPerMonth:1.5` → `raw = 15 − 4.5` → `raw = 10` (rounded)
- No `lastUpdated` provided → `raw = 0`, explanation notes missing data

*Normalization combinations:*
- Core only: `maxPossible = 65` → `normalize(65, 65) = 100`
- Core + Authority: `maxPossible = 85` → `normalize(85, 85) = 100`
- Core + Corpus: `maxPossible = 80` → `normalize(80, 80) = 100`
- Core + Freshness: `maxPossible = 80` → `normalize(80, 80) = 100`
- Core + Authority + Corpus: `maxPossible = 100` → `normalize(100, 100) = 100`
- All extensions: `maxPossible = 115` → `normalize(115, 115) = 100`
- Partial scores always produce integer 0–100

---

## Phase 4 — Scorer + Public API

**Goal:** `computeConfidence` and `createScorer` working end-to-end. Integration test suite passes all locked scenarios.

### Tasks

1. Implement `src/labels.ts` — exports `deriveLabel`, `deriveTier1`, `deriveTier2`
2. Implement `src/scorer.ts` — exports `computeConfidence(inputs, config?)` and `createScorer(config)`
3. Write `tests/labels.test.ts`
4. Write `tests/integration.test.ts` — all locked scenarios from spec
5. Update `src/index.ts` — export `computeConfidence`, `createScorer`, and all public types

### Pass/Fail Gate — Phase 4

| Check | Command | Expected result |
|---|---|---|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 |
| Biome clean | `npx biome check src/` | Exit 0 |
| All tests pass | `npx vitest run` | Exit 0 |

**Required integration scenarios:**

| Scenario | Expected total | Expected label |
|---|---|---|
| All signals maxed, all extensions active | 100 | Strong |
| High conf, tier-1 source, good retrieval, partial corpus | 77–83 | Moderate |
| Medium conf, adequate retrieval, full corpus | 60–68 | Moderate |
| Low conf, single source, thin corpus | 18–28 | Insufficient |
| High conf, empty corpus | 78–84 | Moderate |
| Conflicting docs, medium conf | 38–50 | Limited |
| `documentsSilent:true` | ≤ 15 | Insufficient |

**API contract tests:**
- `computeConfidence(validInputs)` returns a `ConfidenceScorecard` with all required fields populated
- `computeConfidence(validInputs, {})` produces same result as no config (no extensions active)
- `createScorer(config).compute(inputs)` produces identical result to `computeConfidence(inputs, config)`
- `scorecard.total` is an integer satisfying `0 ≤ total ≤ 100`
- `scorecard.meta.rawTotal ≤ scorecard.meta.maxPossible`
- `scorecard.dimensions.authority` is `undefined` when Authority extension is not active
- `candidates: []` does not throw — returns low score with explanation text

---

## Phase 5 — Examples

**Goal:** Four working examples that compile and run, covering the full capability range.

### Tasks

1. Write `examples/basic-rag.ts` — minimal inputs, core only, logs full scorecard to console
2. Write `examples/legal-docs.ts` — Authority + Corpus extensions, HOA-flavored scenario data
3. Write `examples/knowledge-base.ts` — Freshness extension only, flat KB scenario
4. Write `examples/full-pipeline.ts` — all three extensions + all enhanced signals active

Each example file must include a header comment stating: the scenario it demonstrates, the expected label, and the expected score range.

### Pass/Fail Gate — Phase 5

| Check | Command | Expected result |
|---|---|---|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 |
| basic-rag runs | `npx tsx examples/basic-rag.ts` | Exit 0, scorecard printed |
| legal-docs runs | `npx tsx examples/legal-docs.ts` | Exit 0, scorecard printed |
| knowledge-base runs | `npx tsx examples/knowledge-base.ts` | Exit 0, scorecard printed |
| full-pipeline runs | `npx tsx examples/full-pipeline.ts` | Exit 0, scorecard printed |

Each example output must show:
- `total` is a valid integer 0–100
- `label` matches the expected label noted in the file's header comment
- `dimensions` contains entries for all active dimensions only

---

## Phase 6 — README + Documentation

**Goal:** README is accurate, complete, and designed to earn stars. Every claim is verifiable against the code.

### Required Sections (in order)

1. **Header** — package name, one-line description, npm / license / CI badges
2. **The Problem** — 3-bullet pain statement: RAG answers lack explainability; retrieval scores are meaningless to end users; no standard exists for RAG answer quality
3. **The Solution** — what this package does; 4-bullet capability summary
4. **Install** — `npm install transparent-confidence`
5. **Quick Start** — minimal working example, copy-pasteable, runnable as written
6. **Algorithm** — the content that earns stars. Full explanation of all dimensions and sub-signals with scoring tables. Honest about design decisions and tradeoffs. Written for a technical audience.
7. **API Reference** — every `ScoringInputs` field, every `ScoringConfig` option, full output type with field descriptions
8. **Extensions** — how to activate Authority, Corpus, Freshness with working code examples
9. **Enhanced Signals** — faithfulnessScore, queryComplexity, citationCount, extractionQuality, source diversity — when to use each
10. **Examples** — links to `examples/` directory, one-sentence description of each
11. **Roadmap** — honest list of what is planned for future versions
12. **Contributing** — how to file issues, run tests, submit PRs
13. **License** — Apache 2.0

### Pass/Fail Gate — Phase 6

All items must pass before proceeding to Phase 7:

- [ ] Install command in README is correct for the published package name
- [ ] Quick Start snippet compiles with no errors when pasted into a `.ts` file
- [ ] Every `ScoringInputs` field documented with type, required/optional status, and description
- [ ] Every `ScoringConfig` option documented with its default value
- [ ] All scoring tables in the Algorithm section match the locked spec exactly
- [ ] Label thresholds in README match code: Strong ≥ 85, Moderate ≥ 65, Limited ≥ 40
- [ ] At least one complete `ConfidenceScorecard` JSON shown as example output

---

## Phase 7 — CI/CD + Publish

**Goal:** Automated CI on every push/PR. npm publish triggered by version tag. Package installable from npm.

### Tasks

1. Write `.github/workflows/ci.yml`:
   - Triggers: `push` and `pull_request` to `main`
   - Jobs: `npm ci`, `npx tsc --noEmit`, `npx biome check src/`, `npx vitest run`

2. Write `.github/workflows/publish.yml`:
   - Triggers: `push` to tags matching `v*`
   - Jobs: run full CI suite, then `npm publish`

3. Add `NPM_TOKEN` secret to GitHub repo settings

4. Verify `package.json` `files` field includes only: `dist/`, `README.md`, `CHANGELOG.md`, `package.json`

5. Run `npm publish --dry-run` and verify output list matches `files` field

6. Tag `v0.1.0` and push to trigger the publish workflow

### Pass/Fail Gate — Phase 7

| Check | Command | Expected result |
|---|---|---|
| CI workflow syntax | GitHub Actions tab | No parse errors on push |
| CI runs on push | Push to main | All jobs green |
| Dry run passes | `npm publish --dry-run` | Exit 0, lists correct files |
| Pack output correct | `npm pack --dry-run` | Only dist/, README, CHANGELOG, package.json |
| Published package installs | `npm install transparent-confidence` (fresh directory) | Exit 0 |
| Installed package imports | `import { computeConfidence } from 'transparent-confidence'` | No TypeScript errors |

---

## Test Coverage Target

| Metric | Target |
|---|---|
| Line coverage | ≥ 90% |
| Function coverage | ≥ 95% |
| Branch coverage | ≥ 85% |

Run with: `npx vitest run --coverage`

Coverage provided by `@vitest/coverage-v8`. Add to `package.json`: `"coverage": "vitest run --coverage"`.

---

## Integration Test Scenario Reference

These exact scenarios must pass at the Phase 4 gate and remain passing through Phase 7.

### Scenario A — Perfect Answer

```typescript
// All signals maxed, all extensions active
// Expected: total = 100, label = 'Strong'
{
  confidenceLevel: 'high',
  faithfulnessScore: 0.95,
  queryComplexity: 'direct',
  citationCount: 4,
  corpusDocCount: 5,
  candidates: [
    // 5 candidates, all in 2+ retrieval methods, avg combinedScore 0.87,
    // 3 unique documentIds, all authorityRank ≤ 10, all isAmendment false,
    // all extractionQuality ≥ 0.95, all lastUpdated within 30 days
  ]
}
```

### Scenario B — Solid Answer, Incomplete System

```typescript
// High confidence, good retrieval, tier-1 source, but only 2 of 5 doc types loaded
// Expected: total ∈ [77, 83], label = 'Moderate'
{
  confidenceLevel: 'high',
  corpusDocCount: 2,
  // config.corpus.expectedDocCount = 5
  // config.authority active, tier-1 sources
}
```

### Scenario C — Silent Documents

```typescript
// Documents do not address the question at all
// Expected: total ∈ [0, 10], label = 'Insufficient'
{
  confidenceLevel: 'low',
  documentsSilent: true,
  candidates: []
}
```

### Scenario D — Conflicting Evidence

```typescript
// Medium confidence, documents conflict, scattered retrieval scores
// Expected: total ∈ [38, 50], label = 'Limited'
{
  confidenceLevel: 'medium',
  hasConflict: true,
  conflictingCandidateCount: 2,
  candidates: [
    // 4 candidates, combinedScores ranging from 0.32 to 0.81
  ]
}
```

### Scenario E — Multi-hop Query, Faithfulness Warning

```typescript
// High LLM confidence but multi-hop question + low faithfulness score
// Expected: total ∈ [40, 55], label = 'Limited'
{
  confidenceLevel: 'high',
  queryComplexity: 'multi-hop',
  faithfulnessScore: 0.45,
  candidates: [/* 3 candidates, moderate scores */]
}
```

---

## Phase Completion Checklist

| Phase | Description | Status |
|---|---|---|
| 0 | Repo + Toolchain | ✅ Complete |
| 1 | Type System | ✅ Complete |
| 2 | Core Dimensions | ✅ Complete |
| 3 | Optional Extensions | ✅ Complete |
| 4 | Scorer + Public API | ✅ Complete |
| 5 | Examples | — |
| 6 | README + Documentation | — |
| 7 | CI/CD + Publish | — |
