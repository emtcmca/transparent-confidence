# Changelog

## [0.2.0] — 2026-06-07

### Breaking

- Renamed `confidenceLevel` → `supportLevel` across all inputs, types, and docs
- Renamed `corpusDocCount` → `corpusTypeCount` in `ScoringInputs`
- Renamed `corpus.expectedDocCount` → `corpus.expectedTypeCount` in `CorpusConfig`
- `recommendedAction` and `actionReason` are now non-optional on `ConfidenceScorecard`
- Evidence Consistency (Dimension 3) sub-signal semantics changed: omitting conflict signals now scores conservatively and generates `missing-conflict-signal` warning instead of treating omission as implicit agreement
- Authority extension default aggregation changed from "best source wins" (min-rank) to weighted average across top-K candidates

### Added

**Core**
- `recommendedAction` (`'answer' | 'review' | 'abstain'`) on all scorecards
- `actionReason` string explaining the first policy rule that decided the action
- Configurable action policy (`config.actionPolicy`): `answerAt`, `reviewAt`, `abstainBelow`, `requireTier1AtLeast`, `reviewOnWarnings`, `abstainOnWarnings`
- Per-dimension configurable weights (`config.weights`): `(raw / nativeMax) × activeWeight` formula; default weights equal native max values, preserving v0.1 totals
- `meta.algorithmVersion` — `'0.2.0'`
- `meta.schemaVersion` — `'0.2'`
- `meta.activeDimensions` — names of all active dimensions including core
- `meta.warnings` — structured warnings with `code`, `severity`, `message`, `path`
- `meta.missingSignals` — concise identifiers for signals that would improve scoring
- `meta.weights` — active dimension weights used for this scorecard
- Input validation with `config.validation: 'warn' | 'strict'`
- Machine-readable `DimensionBreakdown` on every `DimensionScore`: `components`, `adjustments`, `diagnostics`, `uncappedRaw`, `raw`
- Invariant: `breakdown.raw === DimensionScore.raw` for every dimension
- `ALGORITHM_VERSION` and `SCORECARD_SCHEMA_VERSION` exported constants

**Dimensions**
- Answer Relevance optional dimension (max 15 pts): activates when `answerRelevanceScore` provided or `config.relevance.required = true`; included in Tier 1
- Configurable retrieval score bands (`config.retrieval.scoreBands`)
- Configurable retrieval method thresholds (`config.retrieval.methodThresholds`, `config.retrieval.defaultMethodThreshold`)
- Configurable `minConfirmedMethods` (default 2; set to 1 for single-vector pipelines)
- Configurable retrieval `topK` for magnitude scoring
- `claimSupport` grounding signal: claim-level support summary; combined with `faithfulnessScore` using the more conservative value
- `citationCoverageScore` and `invalidCitationCount` grounding signals
- Freshness `config.freshness.now` for deterministic replay and tests
- Freshness `config.freshness.aggregation`: `'median'` (default) | `'oldest'` | `'newest'`
- Authority `config.authority.aggregation: 'weighted'` (default) | `'best'` (v0.1 compat)
- Authority `config.authority.topK` to limit candidates included in authority scoring
- Corpus named type mode: `config.corpus.expectedTypes` + `inputs.presentTypes` for query-scoped type tracking
- Candidate `contentHash` field for duplicate detection (diagnostic-only in v0.2)
- Candidate `rank` field for explicit 1-based retrieval position

**Warnings**
- `missing-conflict-signal` — no `hasConflict` or `conflictingCandidateCount` provided
- `missing-freshness-dates` — Freshness active but no candidates have `lastUpdated`
- `missing-corpus-count` — Corpus active but `corpusTypeCount` and `presentTypes` absent
- `authority-unclassified` — candidates that could not be classified against any tier
- `single-retrieval-method` — all candidates have one method and `minConfirmedMethods > 1`
- `ambiguous-top-results` — top score gap below configured threshold
- `input-out-of-range` — claim support counts are inconsistent

### Changed

- Consistency Dimension: score stability sub-signal uses updated point table (max 6); conflict signal sub-signal uses updated point table (max 4); total max unchanged at 10
- Authority Extension: weighted aggregation default; uniform-weight fallback when all `combinedScore` values are zero
- Corpus Extension: `corpusTypeCount` / `expectedTypeCount` (renamed); named `expectedTypes` / `presentTypes` support added
- Freshness Extension: `now` injection; `aggregation` mode; `missing-freshness-dates` warning
- Tier 1 and Tier 2 `score` fields are normalized to 0–100 using active tier weights; raw tier points are not exposed
- README: comprehensive rewrite for v0.2 API, algorithm tables, new sections
- CHANGELOG: comprehensive v0.2 entry

---

## [0.1.1] — 2026-06-07

### Changed
- README: updated tagline to emphasize retrieval, grounding, citation, freshness, and corpus signals
- README: added "Best for / Not for" section after vs. Alternatives comparison
- README: added answer correctness disclaimer (package scores evidence quality, not answer correctness)
- README: added "From Your Retriever to Candidate[]" integration mapping with LangChain and pgvector examples
- README: updated TOC to include new sections
- BUILD-PLAN: added full 0.2.0 implementation spec (breaking renames, configurable score bands, sub-signal breakdown, injectable `now`)

---

## [0.1.0] — 2026-06-07

### Added
- Initial release
- Core dimensions: Answer Grounding, Retrieval Confidence, Evidence Consistency
- Optional extensions: Source Authority, Corpus Completeness, Document Freshness
- Enhanced signals: faithfulnessScore, queryComplexity, citationCount, extractionQuality, source diversity
- Dual ESM + CJS build output via tsup
- TypeScript declarations included
- 179 unit and integration tests
- GitHub Actions CI (Node 20/22/24) and npm publish workflow
