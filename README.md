# transparent-confidence

**Deterministic, explainable scorecards for RAG answer confidence — using the retrieval, grounding, citation, freshness, and corpus signals your system already has.**

[![npm version](https://img.shields.io/npm/v/transparent-confidence.svg)](https://www.npmjs.com/package/transparent-confidence)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/emtcmca/transparent-confidence/actions/workflows/ci.yml/badge.svg)](https://github.com/emtcmca/transparent-confidence/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-412%20passing-brightgreen.svg)](https://github.com/emtcmca/transparent-confidence/actions)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/emtcmca/transparent-confidence/tree/master/playground?file=index.js)

> **Transparent Confidence™** is a scoring methodology that makes RAG answer quality auditable — every point on the 0–100 scale has an explicit reason attached to it.

---

`transparent-confidence` v0.3 is a deterministic, auditable runtime confidence layer for RAG systems. It turns retrieval, grounding, evaluator, citation, corpus, freshness, authority, and index integrity signals into a versioned scorecard, action recommendation, and calibration-ready log record.

The score is not a probability of correctness unless you calibrate it against your own labeled outcomes. The package does not retrieve documents, call an LLM, or verify citations by itself.

**[▶ Try it in your browser](https://stackblitz.com/github/emtcmca/transparent-confidence/tree/master/playground?file=index.js)** — zero-install StackBlitz playground. Four scenarios (strong answer, conflicting evidence, weak retrieval, production gating) running the published npm package. Boots in seconds.

## Project Status

| | |
|---|---|
| **Current release** | `v0.3.0` — published to npm, stable, production-ready |
| **Algorithm / schema** | `algorithmVersion 0.3.0` · `schemaVersion 0.3` |
| **Tests** | 412 passing across 19 files · coverage targets ≥ 90% line / ≥ 95% function / ≥ 85% branch |
| **Dimensions** | 3 core (always on) + 5 optional (Relevance, Authority, Corpus, Freshness, Index Integrity) |
| **Runtime dependencies** | 0 (hard architectural constraint) |
| **Node** | ≥ 20 · dual ESM + CJS output with TypeScript declarations |
| **Next milestone** | `v1.0` — API stabilization; candidate scope in [Roadmap](#roadmap) |

v0.3.0 is the current published line and is stable. Work now targets a `v1.0` release that locks the public API surface. The [Roadmap](#roadmap) lists candidate features under evaluation for v1.0; none are committed yet.

## Contents

- [Project Status](#project-status)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [vs. Alternatives](#vs-alternatives)
- [Best for / Not for](#best-for--not-for)
- [Install](#install)
- [Quick Start](#quick-start)
- [From Your Retriever to Candidate\[\]](#from-your-retriever-to-candidate)
- [Recommended Action](#recommended-action)
- [Warnings and Missing Signals](#warnings-and-missing-signals)
- [v0.3 Production Workflows](#v03-production-workflows)
- [Algorithm](#algorithm)
- [Retrieval Tuning](#retrieval-tuning)
- [Signal Policy](#signal-policy)
- [Calibration Utilities](#calibration-utilities)
- [Evaluator Signal Bridge](#evaluator-signal-bridge)
- [Index Integrity](#index-integrity)
- [Answer Relevance](#answer-relevance)
- [Dimension Weights](#dimension-weights)
- [Machine-readable Breakdowns](#machine-readable-breakdowns)
- [Observability Logging](#observability-logging)
- [API Reference](#api-reference)
- [Extensions](#extensions)
- [Enhanced Signals](#enhanced-signals)
- [Examples](#examples)
- [Upgrading from 0.2.x to 0.3.0](#upgrading-from-02x-to-030)
- [Upgrading from 0.1.x to 0.2.0](#upgrading-from-01x-to-020)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## The Problem

You can't put a cosine score in a UI. You can't explain a 0.73 to a compliance team. You can't alert on retrieval drift when the only signal is a number with no context.

RAG pipelines ship answers. They don't ship confidence.

- Retrieval scores (cosine similarity, BM25) measure vector proximity — not whether the answer is correct, grounded, or complete
- LLM self-assessment (`"I'm confident that..."`) is uncalibrated and invisible to downstream systems
- There is no standard for expressing RAG answer quality in a way that is auditable, explainable, and actionable at runtime

---

## The Solution

`transparent-confidence` computes a typed scorecard (0–100) for any RAG answer at query time — no additional model calls, no infrastructure:

- **Always normalized** — score is 0–100 regardless of which optional dimensions are active
- **Per-dimension breakdowns** — every point is explainable, not a black box
- **Tiered display** — Answer Confidence (Tier 1) and System Readiness (Tier 2) shown separately
- **Recommended action** — `answer`, `review`, or `abstain` with a reason string
- **Machine-readable warnings** — structured warning codes for dashboards and alerting
- **Zero required config** — three core dimensions work out of the box; optional extensions activate on demand
- **Zero dependencies** — no ML stack, no server, no model calls; runs inline in any Node.js 20+ process

![The scoring pipeline: signals you already have, 3 core + 5 optional dimensions, versioned scorecard, deterministic action policy](https://raw.githubusercontent.com/emtcmca/transparent-confidence/master/docs/assets/pipeline-diagram.png)

---

## vs. Alternatives

| | transparent-confidence | RAGAs | TruLens | DeepEval |
|---|---|---|---|---|
| Runs at query time | ✅ | ⚠️ async | ⚠️ async | ⚠️ async |
| Requires LLM calls | ✅ none | ❌ yes | ❌ yes | ❌ yes |
| Per-dimension breakdown | ✅ | ✅ | ✅ | ✅ |
| Zero dependencies | ✅ | ❌ | ❌ | ❌ |
| TypeScript-native types | ✅ | ❌ | ❌ | partial |
| Authority / corpus / freshness | ✅ | ❌ | ❌ | ❌ |

**RAGAs, TruLens, and DeepEval** are evaluation frameworks — they run offline or in a separate evaluation pipeline and call LLMs to judge answer quality. That's valuable for batch evaluation and benchmarking.

**transparent-confidence** runs inline at query time using signals your pipeline already has: retrieval scores, document metadata, and LLM-assessed confidence. No extra calls. No separate infrastructure. The tradeoff is that it doesn't do LLM-based faithfulness judgment natively — but it accepts an external `faithfulnessScore` if you run one.

> **Note:** This package does not judge answer *correctness*. It composes signals your system already produces into an explainable, auditable confidence scorecard. Use it alongside — not instead of — offline evaluation tools.

---

## Best for / Not for

**Best for:**
- RAG apps that need a live confidence indicator in a UI, API response, or log
- Systems where you want to gate on answer quality before responding to users (e.g. route to human review if score < 40)
- Domains with structured document hierarchies: legal, compliance, governance, HR policy, technical documentation
- Pipelines that mix multiple retrieval methods (semantic + keyword + rerank) and need a single interpretable signal
- Teams that need to explain AI answer confidence to non-technical stakeholders

**Not for:**
- Offline batch evaluation of a fine-tuned model's accuracy — use RAGAs or DeepEval
- LLM-as-judge faithfulness scoring — those tools call a model to assess the answer; this package does not
- Single-retrieval pipelines with no metadata — you'll get a score, but consider `minConfirmedMethods: 1` (see Retrieval Tuning)
- Replacing a proper eval suite — use this at runtime and eval tools offline; they complement each other

---

## Install

```bash
npm install transparent-confidence
```

Requires Node.js 20+.

---

## Quick Start

```typescript
import { computeConfidence } from 'transparent-confidence';

const scorecard = computeConfidence({
  supportLevel: 'high',
  hasConflict: false,   // explicit — prevents missing-conflict-signal warning
  citationCount: 3,
  candidates: [
    {
      retrievalScores: { semantic: 0.88, keyword: 0.72 },
      combinedScore: 0.88,
      documentId: 'doc-001',
    },
    {
      retrievalScores: { semantic: 0.85, keyword: 0.68 },
      combinedScore: 0.85,
      documentId: 'doc-002',
    },
    {
      retrievalScores: { semantic: 0.82, keyword: 0.65 },
      combinedScore: 0.82,
      documentId: 'doc-003',
    },
  ],
});

console.log(scorecard.total);             // 100
console.log(scorecard.label);             // 'Strong'
console.log(scorecard.recommendedAction); // 'answer'
console.log(scorecard.actionReason);      // 'Score 100 meets answerAt threshold (65).'
```

**Output shape:**

```json
{
  "total": 100,
  "label": "Strong",
  "labelColor": "green",
  "recommendedAction": "answer",
  "actionReason": "Score 100 meets answerAt threshold (65).",
  "tier1": { "score": 100, "label": "Strong", "color": "green" },
  "tier2": null,
  "dimensions": {
    "grounding":   { "raw": 30, "max": 30, "normalized": 100, "explanation": "..." },
    "retrieval":   { "raw": 25, "max": 25, "normalized": 100, "explanation": "..." },
    "consistency": { "raw": 10, "max": 10, "normalized": 100, "explanation": "..." }
  },
  "meta": {
    "algorithmVersion": "0.3.0",
    "schemaVersion": "0.3",
    "rawTotal": 65,
    "maxPossible": 65,
    "activeExtensions": [],
    "activeDimensions": ["grounding", "retrieval", "consistency"],
    "warnings": [],
    "missingSignals": [],
    "weights": { "grounding": 30, "retrieval": 25, "consistency": 10 }
  }
}
```

---

## From Your Retriever to Candidate[]

`Candidate[]` maps directly to what most retrievers already return. Here's how to translate common retriever output shapes:

**LangChain / LlamaIndex document chunks:**
```typescript
import { computeConfidence, type Candidate } from 'transparent-confidence';

// retrievedDocs is what your retriever returns — adjust field names to match your stack
const candidates: Candidate[] = retrievedDocs.map((doc) => ({
  retrievalScores: {
    semantic: doc.metadata.score ?? doc.score,         // cosine or dot-product score
    keyword:  doc.metadata.bm25Score ?? 0,             // BM25 if your pipeline provides it
  },
  combinedScore:    doc.metadata.score ?? doc.score,   // final blended score used for ranking
  documentId:       doc.metadata.source ?? doc.id,     // used for source diversity scoring
  documentType:     doc.metadata.documentType,         // optional — used by Authority extension
  lastUpdated:      doc.metadata.lastUpdated            // optional — used by Freshness extension
                      ? new Date(doc.metadata.lastUpdated)
                      : undefined,
  extractionQuality: doc.metadata.extractionQuality,   // optional — PDF/OCR quality 0–1
}));

const scorecard = computeConfidence({
  supportLevel: 'high',   // how strongly the retrieved sources support the answer
  hasConflict: false,
  candidates,
});
```

**pgvector / Supabase:**
```typescript
// rows from: SELECT *, 1 - (embedding <=> $query_embedding) AS score FROM documents
const candidates: Candidate[] = rows.map((row) => ({
  retrievalScores: { semantic: row.score },
  combinedScore:   row.score,
  documentId:      row.id,
  documentType:    row.document_type,
  lastUpdated:     row.updated_at ? new Date(row.updated_at) : undefined,
}));
```

The minimum required per candidate is `retrievalScores` (any key name, any number of methods) and `combinedScore`. Everything else is optional and activates additional scoring sub-signals.

---

## Recommended Action

Every scorecard includes `recommendedAction` (`'answer'` | `'review'` | `'abstain'`) and `actionReason` (a human-readable string explaining the first rule that decided the action).

### Default policy

The 8-rule cascade runs in order and returns on the first match:

| Rule | Trigger | Action |
|---|---|---|
| 1 | `documentsSilent === true` | `abstain` |
| 2 | Any warning code is in `abstainOnWarnings` | `abstain` |
| 3 | `total < abstainBelow` (default 40) | `abstain` |
| 4 | `tier1.score < requireTier1AtLeast` (default 40) | `review` |
| 5 | Any warning code is in `reviewOnWarnings` | `review` |
| 6 | `total >= answerAt` (default 65) | `answer` |
| 7 | `total >= reviewAt` (default 40) | `review` |
| 8 | Fallback | `abstain` |

Default warning lists:
- `reviewOnWarnings`: `['missing-answer-relevance', 'missing-conflict-signal']`
- `abstainOnWarnings`: `['documents-silent']`

> **Important:** Most simple RAG calls omit `hasConflict` — this generates a `missing-conflict-signal` warning, which fires rule 5 and returns `review` even if the score is high. Pass `hasConflict: false` (or `conflictingCandidateCount: 0`) explicitly to clear this warning.

### Customizing the policy

```typescript
computeConfidence(inputs, {
  actionPolicy: {
    answerAt: 70,                      // raise the answer threshold
    reviewAt: 45,
    abstainBelow: 35,
    requireTier1AtLeast: 50,           // stricter tier 1 floor
    reviewOnWarnings: [],              // disable warning-based review
    abstainOnWarnings: ['documents-silent'],
  },
});
```

### Runtime gating pattern

```typescript
const scorecard = computeConfidence(inputs, config);

if (scorecard.recommendedAction === 'abstain') {
  return { answer: null, reason: scorecard.actionReason };
}

if (scorecard.recommendedAction === 'review') {
  return { answer, reviewRequired: true, confidence: scorecard.total };
}

return { answer, confidence: scorecard.total };
```

---

## Warnings and Missing Signals

`scorecard.meta.warnings` is an array of structured warnings produced during scoring. Each warning has:

| Field | Type | Description |
|---|---|---|
| `code` | `ConfidenceWarningCode` | Machine-readable identifier |
| `severity` | `'info' \| 'warn' \| 'error'` | Severity level |
| `message` | `string` | Human-readable description |
| `path` | `string?` | Input path that triggered the warning |

`scorecard.meta.missingSignals` lists concise identifiers for signals that would improve scoring accuracy if provided.

### Common warning codes

| Code | Severity | Triggered when |
|---|---|---|
| `missing-conflict-signal` | warn | Neither `hasConflict` nor `conflictingCandidateCount` provided |
| `missing-faithfulness` | warn | No `faithfulnessScore` or `claimSupport` provided |
| `missing-answer-relevance` | warn | `config.relevance.required = true` but `answerRelevanceScore` absent |
| `missing-freshness-dates` | warn | Freshness extension active but no candidates have `lastUpdated` |
| `missing-corpus-count` | warn | Corpus extension active but `corpusTypeCount` not provided |
| `authority-unclassified` | warn | Some candidates couldn't be classified against any authority tier |
| `documents-silent` | warn | `documentsSilent = true` — corpus has no content for this question |
| `ambiguous-top-results` | warn | Gap between top-1 and top-2 retrieval scores is smaller than the configured threshold |
| `single-retrieval-method` | warn | All candidates have only one retrieval method and `minConfirmedMethods > 1` |
| `required-signal-missing` | warn | A signal listed in `signalPolicy.require` was not provided |
| `citation-quality-floor` | warn | `citationCoverageScore` is below `signalPolicy.minCitationCoverageScore`, or `invalidCitationCount` exceeds `maxInvalidCitationCount` |
| `invalid-citations` | warn | `invalidCitationCount` is 1 (−2 grounding penalty) or ≥ 2 (−5 penalty) |
| `low-citation-coverage` | warn | `citationCoverageScore` is below 0.50 |
| `duplicate-content` | info/warn | Candidates with duplicate `contentHash` values detected; severity is `warn` when `mode: 'penalize'` is active |
| `rank-signal-missing` | info | Candidates missing `rank` while `rankPenalty.mode = 'penalize'` is active |
| `low-calibration-sample-size` | warn | A calibration band has fewer samples than `config.minSamplesPerBand` |
| `index-integrity-incomplete` | warn | An Index Integrity sub-signal was not provided (scores that sub-signal at 0) |
| `embedding-version-mismatch` | warn | `actualEmbeddingModelVersion` does not match `expectedEmbeddingModelVersion` |
| `acl-filter-unconfirmed` | warn | `aclFilterConfirmed` was not provided or false, and `requireAclFilterConfirmation` is true |
| `deleted-source-leakage` | **error** | `deletedSourceLeakageCount > 0` — deleted source content appears in retrieval results |

### Validation modes

```typescript
// Default: input issues produce warnings, config errors throw
computeConfidence(inputs, config);

// Strict: input issues also throw
computeConfidence(inputs, { ...config, validation: 'strict' });
```

---

## v0.3 Production Workflows

v0.3 adds production hardening around the deterministic scorer without adding runtime dependencies or model calls.

### Production preset

```typescript
const scorecard = computeConfidence(inputs, {
  preset: 'production-v0.3',
});
```

`production-v0.3` requires:

- `answerRelevanceScore`
- `hasConflict` or `conflictingCandidateCount`
- `faithfulnessScore` or `claimSupport`

When these are missing, the scorecard includes `required-signal-missing` warnings and the action is forced to `review`.

Use `preset: 'legacy-v0.2'` when migrating code that expects the closest v0.2 action behavior.

If you pass `signalPolicy` with `preset: 'production-v0.3'`, caller policy is merged with the production preset. Custom policy adds requirements or gates; it does not silently remove the production evaluator/relevance/conflict requirements.

### Signal policy

```typescript
computeConfidence(inputs, {
  signalPolicy: {
    require: ['answerRelevanceScore', 'conflictSignal', 'citationCoverageScore'],
    reviewWhenMissing: ['answerRelevanceScore', 'conflictSignal'],
    abstainWhenMissing: ['citationCoverageScore'],
    minCitationCoverageScore: 0.75,
    maxInvalidCitationCount: 0,
  },
});
```

Signal policy lets you make missing evaluator, citation, conflict, corpus, authority, rank, content-hash, or index-health signals machine-readable and actionable.

### Calibration utilities

```typescript
import { analyzeCalibration } from 'transparent-confidence';

const report = analyzeCalibration(samples, {
  minSamplesPerBand: 30,
  targetPrecisionForAnswer: 0.9,
  targetRecallForAbstain: 0.8,
});
```

Calibration returns score bands, empirical positive rates, action summaries, recommended thresholds, and low-sample warnings. `targetPrecisionForAnswer` tunes `answerAt`; `targetRecallForAbstain` tunes `abstainBelow` and `reviewAt`. It does not change the scoring algorithm.

### Evaluator signal bridge

```typescript
import { fromRagasLike, mergeEvaluationSignals } from 'transparent-confidence';

const signals = fromRagasLike(ragasResult);
const { inputs: enrichedInputs } = mergeEvaluationSignals(inputs, signals);
const scorecard = computeConfidence(enrichedInputs);
```

The bridge accepts plain objects from RAGAS-like, DeepEval-like, TruLens-like, or custom judge outputs. It imports no evaluator SDKs.

### Retrieval duplicate and rank diagnostics

`contentHash` and `rank` are diagnostic-only by default. To make them affect the retrieval raw score:

```typescript
computeConfidence(inputs, {
  retrieval: {
    duplicateContent: { mode: 'penalize' },
    rankPenalty: { mode: 'penalize' },
  },
});
```

### Index integrity

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

Index integrity is an opt-in Tier 2 dimension. It is inactive unless `config.indexIntegrity` is present.

## Algorithm

The score is built from three core dimensions (always active) and optional dimensions/extensions. Raw points from all active dimensions are summed and normalized to 0–100.

```
normalizedScore = round((rawTotal / maxPossible) × 100)

maxPossible = 65                      (core: grounding + retrieval + consistency)
            + 15  (Relevance active)
            + 20  (Authority active)
            + 15  (Corpus active)
            + 15  (Freshness active)
            + 15  (Index Integrity active)
```

### Labels

Applied to the final normalized score:

| Label | Range | Color |
|---|---|---|
| Strong | ≥ 85 | green |
| Moderate | ≥ 65 | amber |
| Limited | ≥ 40 | orange |
| Insufficient | < 40 | red |

### Tier Display

**Tier 1 — Answer Confidence:** Grounding + Retrieval + Consistency + Relevance (when active) + Authority (when active). Normalized independently to 0–100. Labels match composite scale.

**Tier 2 — System Readiness:** Corpus + Freshness + Index Integrity (when active). Normalized independently to 0–100. Uses separate labels: Complete / Good / Partial / Thin. Hidden (`null`) when none of these extensions are configured.

---

### Dimension 1 — Answer Grounding (max 30 pts)

Scores how well the LLM answer is grounded in source documents.

**Required inputs:** `supportLevel`

**Optional inputs:** `ambiguityNotes`, `documentsSilent`, `requiresExpertReview`, `externalConstraintNote`, `hasConflict`, `queryComplexity`, `faithfulnessScore`, `claimSupport`, `citationCount`, `citationCoverageScore`, `invalidCitationCount`

#### Base score

| Condition | Base |
|---|---|
| `documentsSilent = true` | 0 — all further logic skipped |
| `supportLevel = 'low'` | 5 |
| `supportLevel = 'medium'` | 13 |
| `supportLevel = 'high'` + ambiguity present | 21 |
| `supportLevel = 'high'` + no ambiguity | 30 |

#### Penalties (applied after base)

| Condition | Penalty |
|---|---|
| `requiresExpertReview = true` | −3 |
| `externalConstraintNote` present | −2 |
| `hasConflict = true` | −5 |

#### `queryComplexity` ceiling (applied after penalties)

| Value | Ceiling |
|---|---|
| `'direct'` or not provided | 30 (no ceiling) |
| `'inferential'` | 24 |
| `'multi-hop'` | 18 |
| `'comparative'` | 16 |

#### Faithfulness / claim support modifier

An external faithfulness score or claim support summary that measures whether the LLM answer text is supported by the retrieved passages.

| Effective Support Score | Modifier |
|---|---|
| ≥ 0.90 | +0 |
| 0.70–0.89 | −3 |
| 0.50–0.69 | −7 |
| < 0.50 | −12 |
| Both present | Uses the more conservative (lower) value |
| Not provided | Not applied; warning `missing-faithfulness` |

If `claimSupport.contradictedClaims >= 1`, an additional −5 contradiction penalty applies.

#### Citation quality

| Signal | Effect |
|---|---|
| `invalidCitationCount = 1` | −2, no citation bonus |
| `invalidCitationCount >= 2` | −5, no citation bonus |
| `citationCoverageScore < 0.50` | −3 |
| `citationCoverageScore 0.50–0.79` | −1 |

#### Citation count bonus (applied last, cannot exceed max 30)

| Value | Bonus |
|---|---|
| ≥ 3 | +2 |
| 2 | +1 |
| 0–1 or not provided | +0 |

The citation count bonus is not applied when `invalidCitationCount > 0`.

---

### Dimension 2 — Retrieval Confidence (max 25 pts)

Scores the quality, breadth, and agreement of the retrieved candidates. Three sub-signals summed, total capped at 25.

**Required inputs:** `candidates[].retrievalScores`, `candidates[].combinedScore`

**Optional inputs:** `candidates[].documentId`, `candidates[].extractionQuality`, `config.retrieval`

#### Sub-signal A — Method Agreement (0–15)

A candidate is "confirmed" when the number of retrieval methods that scored above the configured threshold is ≥ `minConfirmedMethods` (default 2).

| Confirmed candidates | Points |
|---|---|
| ≥ 3 | 15 |
| 2 | 12 |
| 1 | 8 |
| 0 | 3 |

**Single-vector pipelines:** set `minConfirmedMethods: 1` so all candidates count as confirmed. See [Retrieval Tuning](#retrieval-tuning).

#### Sub-signal B — Score Magnitude (0–8)

Average `combinedScore` of top `topK` (default 3) candidates. If `extractionQuality` is provided: `effectiveScore = combinedScore × extractionQuality`.

| Avg effective score | Points |
|---|---|
| ≥ 0.80 | 8 |
| ≥ 0.65 | 6 |
| ≥ 0.50 | 4 |
| ≥ 0.35 | 2 |
| < 0.35 | 0 |

#### Sub-signal C — Source Diversity + Section Breadth (0–5)

Source diversity counts unique `documentId` values. In v0.3, `contentHash` is diagnostic-only by default; duplicate content hashes reduce retrieval raw score only when `retrieval.duplicateContent.mode = 'penalize'`.

| Unique `documentId` values | Points |
|---|---|
| ≥ 3 distinct documents | +3 |
| 2 distinct documents | +1 |
| 1 or not provided | +0 |

| Total candidate count | Points |
|---|---|
| ≥ 5 | +2 |
| 3–4 | +1 |
| ≤ 2 | +0 |

---

### Dimension 3 — Evidence Consistency (max 10 pts)

Scores retrieval score stability plus explicit evidence conflict status. A missing conflict signal is treated as a conservative neutral, not as implicit agreement.

**Required inputs:** `candidates[].combinedScore`

**Optional inputs:** `conflictingCandidateCount`, `hasConflict`

`conflictingCandidateCount` takes precedence over boolean `hasConflict` when both are provided.

#### Sub-signal A — Score Stability (0–6)

Population standard deviation of `combinedScore` across all candidates:

| Condition | Points |
|---|---|
| No candidates | 0 |
| Only 1 candidate | 3 (neutral — variance unmeasurable) |
| std dev < 0.10 | 6 |
| std dev < 0.20 | 5 |
| std dev < 0.30 | 3 |
| std dev ≥ 0.30 | 1 |

#### Sub-signal B — Conflict Signal (0–4)

| Condition | Points |
|---|---|
| `conflictingCandidateCount = 0` | 4 |
| `hasConflict = false` (no count given) | 4 |
| No conflict signal provided | 2 + warning `missing-conflict-signal` |
| `conflictingCandidateCount = 1` | 1 |
| `conflictingCandidateCount ≥ 2` | 0 |
| `hasConflict = true` (no count given) | 0 |

> Tight retrieval scores are not treated as proof of semantic agreement. An explicit `hasConflict: false` or `conflictingCandidateCount: 0` earns the full conflict-signal points. Omitting both generates a warning and a conservative neutral score.

---

## Retrieval Tuning

The retrieval dimension is fully configurable via `config.retrieval`.

### Score bands

Default score bands (`full: 0.80, high: 0.65, medium: 0.50, low: 0.35`) assume `combinedScore` is normalized to `[0, 1]`. If your scores are not in that range, tune the bands:

```typescript
computeConfidence(inputs, {
  retrieval: {
    scoreBands: {
      full: 0.95,   // your system's "great" threshold
      high: 0.80,
      medium: 0.60,
      low: 0.40,
    },
  },
});
```

> **Warning:** BM25, ColBERT, reranker, and cross-encoder scores are not comparable to cosine similarity without normalization. If you pass unnormalized scores as `combinedScore`, configure `scoreBands` to match your distribution before deploying.

### Single-vector retrieval

For pipelines that use one retrieval method only:

```typescript
computeConfidence(inputs, {
  retrieval: {
    minConfirmedMethods: 1,   // 1 method is enough for confirmation
  },
});
```

Without this, all candidates fail the default "2+ methods" check and method agreement scores at its lowest band (3 pts).

### Method-specific thresholds

```typescript
computeConfidence(inputs, {
  retrieval: {
    methodThresholds: {
      semantic: 0.70,   // semantic score must exceed 0.70 to confirm
      keyword:  0.40,   // keyword score must exceed 0.40 to confirm
      rerank:   0.80,
    },
  },
});
```

### Top-K magnitude window

```typescript
computeConfidence(inputs, {
  retrieval: {
    topK: 5,   // average magnitude over top 5 instead of top 3
  },
});
```

---

## Answer Relevance

The Answer Relevance dimension (max 15 pts) scores whether the answer addresses the user's question. This is distinct from grounding — a grounded answer can still be off-topic.

### Activation

Relevance is active when:
- `inputs.answerRelevanceScore` is provided (any value), or
- `config.relevance.required === true` (scores 0 + warning if score is missing)

```typescript
const scorecard = computeConfidence(
  { ...inputs, answerRelevanceScore: 0.92 },
  {},
);
// Relevance now in Tier 1 and meta.activeDimensions
```

### Scoring

| Score | Points |
|---|---|
| ≥ 0.90 | 15 |
| ≥ 0.75 | 12 |
| ≥ 0.60 | 8 |
| ≥ 0.40 | 4 |
| < 0.40 | 0 |
| Missing (required) | 0 + warning `missing-answer-relevance` |

Custom bands:

```typescript
computeConfidence(inputs, {
  relevance: {
    required: true,
    scoreBands: { full: 0.95, high: 0.80, medium: 0.65, low: 0.50 },
  },
});
```

---

## Dimension Weights

You can override the max-point weight for any dimension. The default weight for each dimension equals its native max points, so default behavior is unchanged. Activating a custom weight changes how much of the 0–100 total that dimension can contribute.

```typescript
computeConfidence(inputs, {
  weights: {
    grounding:   50,   // double grounding's influence
    retrieval:   20,
    consistency: 10,
    relevance:   15,   // only included if relevance is active
    authority:   15,
    corpus:      10,
    freshness:   10,
  },
});
```

### Default weights

| Dimension | Default weight |
|---|---|
| grounding | 30 |
| retrieval | 25 |
| consistency | 10 |
| relevance | 15 |
| authority | 20 |
| corpus | 15 |
| freshness | 15 |
| indexIntegrity | 15 |

### How it works

For each active dimension:

```
weightedRaw = (dimension.raw / dimension.max) × activeWeight
```

When `activeWeight === dimension.max` (the default), `weightedRaw = dimension.raw` — so default behavior is identical to the v0.1 formula. Proof: `(raw / max) × max = raw`.

Changing a weight does not change `dimension.raw` — it changes how much that dimension contributes to the total. `meta.weights` always shows the active weights used.

---

## Machine-readable Breakdowns

Every dimension returns a `breakdown` object for dashboards, diffing, and audit trails.

```typescript
interface DimensionBreakdown {
  components:  Record<string, number>;  // positive sub-signal contributions
  adjustments: Record<string, number>;  // penalties, bonuses, caps, rounding
  diagnostics?: Record<string, number | string | boolean>;  // facts, not points
  uncappedRaw: number;  // score before final clamp
  raw: number;          // final raw score (equals DimensionScore.raw)
}
```

**Invariant:** `breakdown.raw === DimensionScore.raw` for every active dimension, always. This is enforced by tests.

**Example — grounding breakdown for a multi-hop query:**

```json
{
  "components":  { "supportBase": 30 },
  "adjustments": { "complexityCeiling": -12, "citationBonus": 2 },
  "uncappedRaw": 20,
  "raw": 20
}
```

**Example — retrieval breakdown:**

```json
{
  "components": {
    "agreement": 15,
    "magnitude": 8,
    "diversity": 3,
    "breadth":   1
  },
  "adjustments": {},
  "diagnostics": {
    "topScoreGap": 0.03,
    "scoreStdDev": 0.024,
    "singleMethodCandidateCount": 0,
    "duplicateContentHashCount": 0
  },
  "uncappedRaw": 27,
  "raw": 25
}
```

---

## Observability Logging

Log the full scorecard as structured JSON for observability pipelines (OpenTelemetry, Datadog, Splunk, etc.):

```typescript
const scorecard = computeConfidence(inputs, config);

// Structured log entry — include alongside the answer in your LLM response log
const confidenceLog = {
  timestamp:         new Date().toISOString(),
  algorithmVersion:  scorecard.meta.algorithmVersion,
  total:             scorecard.total,
  label:             scorecard.label,
  recommendedAction: scorecard.recommendedAction,
  actionReason:      scorecard.actionReason,
  tier1Score:        scorecard.tier1?.score,
  tier2Score:        scorecard.tier2?.score,
  rawTotal:          scorecard.meta.rawTotal,
  maxPossible:       scorecard.meta.maxPossible,
  activeExtensions:  scorecard.meta.activeExtensions,
  warningCodes:      scorecard.meta.warnings.map((w) => w.code),
  missingSignals:    scorecard.meta.missingSignals,
  dimensions: Object.fromEntries(
    scorecard.meta.activeDimensions.map((name) => [
      name,
      {
        raw:         scorecard.dimensions[name]?.raw,
        max:         scorecard.dimensions[name]?.max,
        normalized:  scorecard.dimensions[name]?.normalized,
      },
    ]),
  ),
};

logger.info('rag_confidence', confidenceLog);
```

This gives you per-dimension drift tracking, warning-code alerting, and action distribution monitoring without any additional infrastructure.

---

## API Reference

### `computeConfidence(inputs, config?)`

```typescript
function computeConfidence(inputs: ScoringInputs, config?: ScoringConfig): ConfidenceScorecard;
```

Scores a single RAG answer. `config` is optional — omitting it runs the three core dimensions only.

### `createScorer(config)`

```typescript
function createScorer(config: ScoringConfig): {
  compute: (inputs: ScoringInputs) => ConfidenceScorecard;
};
```

Returns a scorer pre-bound to a config. Use when scoring many answers against the same corpus/authority setup.

```typescript
const scorer = createScorer({ corpus: { expectedTypeCount: 10 } });
const s1 = scorer.compute(inputs1);
const s2 = scorer.compute(inputs2);
```

---

### `analyzeCalibration(samples, config?)`

```typescript
function analyzeCalibration(
  samples: CalibrationSample[],
  config?: CalibrationConfig,
): CalibrationReport;
```

Offline utility. Takes historical `{ total, outcome, recommendedAction? }` records and returns score bands with empirical positive rates, an action summary, and a recommended `ActionPolicy`. Does not modify the scorer or change any thresholds at runtime.

```typescript
import { analyzeCalibration } from 'transparent-confidence';

const report = analyzeCalibration(historicalSamples, {
  minSamplesPerBand: 30,
  targetPrecisionForAnswer: 0.9,   // tunes answerAt
  targetRecallForAbstain: 0.8,     // tunes abstainBelow
});

console.log(report.recommendedPolicy);
// { answerAt: 75, reviewAt: 45, abstainBelow: 45 }
```

`CalibrationSample.outcome` accepts `'correct' | 'incorrect' | 'accepted' | 'rejected' | 'escalated'`. Configure which outcomes are "positive" via `config.positiveOutcomes` (default: `['correct', 'accepted']`).

---

### `mergeEvaluationSignals(inputs, signals)`

```typescript
function mergeEvaluationSignals(
  inputs: ScoringInputs,
  signals: ExternalEvaluationSignals,
): EvaluationSignalMergeResult;
```

Merges external evaluator signals into `ScoringInputs`. Existing fields on `inputs` are never overwritten — signals fill gaps only. Returns `{ inputs: ScoringInputs, warnings: ConfidenceWarning[] }`.

---

### `fromRagasLike(result)` / `fromDeepEvalLike(result)` / `fromTruLensLike(result)` / `fromCustomJudge(result)`

```typescript
function fromRagasLike(result: Record<string, unknown>): ExternalEvaluationSignals;
function fromDeepEvalLike(result: Record<string, unknown>): ExternalEvaluationSignals;
function fromTruLensLike(result: Record<string, unknown>): ExternalEvaluationSignals;
function fromCustomJudge(result: Record<string, unknown>): ExternalEvaluationSignals;
```

Defensive adapters that extract `ExternalEvaluationSignals` from the plain-object output of common eval frameworks. Accept `Record<string, unknown>` — safe against unexpected shapes. Import no evaluator SDKs.

| Function | Maps from | Fields extracted |
|---|---|---|
| `fromRagasLike` | RAGAs result dict | `faithfulness`, `answer_relevancy` / `answerRelevance` |
| `fromDeepEvalLike` | DeepEval metric result | `faithfulnessScore`, `answerRelevancyScore`, generic `score` when `metric === 'faithfulness'` |
| `fromTruLensLike` | TruLens feedback result | `groundedness` → `faithfulnessScore`, `answer_relevance` |
| `fromCustomJudge` | Any custom judge output | All `ExternalEvaluationSignals` fields by exact key name |

```typescript
import { fromRagasLike, mergeEvaluationSignals, computeConfidence } from 'transparent-confidence';

const signals = fromRagasLike(ragasResult);
const { inputs: enrichedInputs } = mergeEvaluationSignals(inputs, signals);
const scorecard = computeConfidence(enrichedInputs, config);
```

---

### `ScoringInputs`

| Field | Type | Required | Description |
|---|---|---|---|
| `supportLevel` | `'high' \| 'medium' \| 'low'` | ✅ | How strongly the retrieved sources support the answer |
| `candidates` | `Candidate[]` | ✅ | Retrieved chunks used to produce the answer |
| `ambiguityNotes` | `string \| null` | — | Non-null value signals the LLM found ambiguity in the source |
| `requiresExpertReview` | `boolean` | — | LLM recommends human expert review |
| `externalConstraintNote` | `string \| null` | — | Non-null signals an external constraint limits the answer |
| `documentsSilent` | `boolean` | — | True when source documents do not address the question at all |
| `hasConflict` | `boolean` | — | Documents contain conflicting information |
| `conflictingCandidateCount` | `number` | — | Number of conflicting candidates (overrides `hasConflict`) |
| `queryComplexity` | `'direct' \| 'inferential' \| 'multi-hop' \| 'comparative'` | — | Complexity ceiling applied to grounding |
| `faithfulnessScore` | `number` | — | 0–1 external faithfulness score; applies modifier to grounding |
| `claimSupport` | `ClaimSupport` | — | Claim-level support summary (alternative to `faithfulnessScore`) |
| `citationCount` | `number` | — | Distinct source sections explicitly cited in the answer |
| `citationCoverageScore` | `number` | — | 0–1 fraction of answer covered by valid citations |
| `invalidCitationCount` | `number` | — | Citations that do not support the cited answer text |
| `answerRelevanceScore` | `number` | — | 0–1 relevance score; activates the Answer Relevance dimension |
| `corpusTypeCount` | `number` | — | Current document type count in the corpus (required when Corpus extension active) |
| `presentTypes` | `string[]` | — | Named document types present (alternative to `corpusTypeCount` for named-type mode) |
| `missingRelevantType` | `boolean` | — | True when a known relevant document type is not in the corpus |
| `missingTypes` | `string[]` | — | Named document types known to be missing for this query |

| `indexIntegrity` | `IndexIntegrityInputs` | optional | Optional index operational health signals; used only when `config.indexIntegrity` is active |

### `Candidate`

| Field | Type | Required | Description |
|---|---|---|---|
| `retrievalScores` | `Record<string, number>` | ✅ | Named scores per retrieval method, e.g. `{ semantic: 0.8, keyword: 0.6 }` |
| `combinedScore` | `number` | ✅ | Final blended score 0–1 used for ranking |
| `documentId` | `string` | — | Source document identifier; used for diversity scoring |
| `documentType` | `string` | — | Document type label; matched against Authority tier keywords |
| `authorityRank` | `number` | — | Explicit authority rank (lower = higher authority); overrides keyword matching |
| `isAmendment` | `boolean` | — | True if this candidate comes from an amendment to the base document |
| `extractionQuality` | `number` | — | 0–1 OCR or extraction quality multiplier applied to `combinedScore` |
| `lastUpdated` | `Date` | — | Document last-updated date; used by Freshness extension |
| `contentHash` | `string` | — | Stable content hash for duplicate detection; diagnostic by default, penalized only when configured |
| `rank` | `number` | — | 1-based final retrieval/rerank position from your pipeline |

`contentHash` is diagnostic-only by default in v0.3. Configure `retrieval.duplicateContent.mode = 'penalize'` when duplicate chunks should reduce retrieval raw score.

### `ScoringConfig`

All fields optional. Passing a key activates that extension.

| Field | Type | Default | Description |
|---|---|---|---|
| `retrieval` | `RetrievalConfig` | — | Retrieval scoring overrides |
| `preset` | `'legacy-v0.2' \| 'balanced-v0.3' \| 'production-v0.3'` | `'balanced-v0.3'` | Compatibility or production-hardening preset |
| `signalPolicy` | `SignalPolicy` | preset-derived | Required-signal and citation-quality gating policy |
| `retrieval.scoreBands` | `Partial<{ full, high, medium, low }>` | `0.80/0.65/0.50/0.35` | Score magnitude bands |
| `retrieval.minConfirmedMethods` | `number` | `2` | Methods needed to confirm a candidate |
| `retrieval.defaultMethodThreshold` | `number` | `0` | Score threshold for method confirmation |
| `retrieval.methodThresholds` | `Record<string, number>` | `{}` | Per-method score thresholds |
| `retrieval.topK` | `number` | `3` | Candidates used for magnitude scoring |
| `relevance` | `RelevanceConfig` | — | Activates Answer Relevance dimension |
| `retrieval.duplicateContent` | `DuplicateContentConfig` | diagnostic | Duplicate content-hash diagnostics or opt-in penalty |
| `retrieval.rankPenalty` | `RankPenaltyConfig` | diagnostic | Candidate rank diagnostics or opt-in late-rank penalty |
| `relevance.required` | `boolean` | `false` | If true, missing score generates a warning and scores 0 |
| `relevance.scoreBands` | `Partial<{ full, high, medium, low }>` | `0.90/0.75/0.60/0.40` | Relevance score bands |
| `authority` | `AuthorityConfig` | — | Activates Source Authority extension |
| `authority.tiers` | `AuthorityTier[]` | Primary/Secondary/Supporting | Custom document hierarchy |
| `authority.aggregation` | `'weighted' \| 'best'` | `'weighted'` | `'best'` reproduces v0.1 min-rank behavior |
| `authority.topK` | `number` | `5` | Candidates included in authority scoring |
| `corpus` | `CorpusConfig` | — | Activates Corpus Completeness extension |
| `corpus.expectedTypeCount` | `number` | *(required)* | Document types expected in a complete corpus |
| `corpus.expectedTypes` | `string[]` | — | Named expected types (infers `expectedTypeCount`) |
| `freshness` | `FreshnessConfig` | — | Activates Document Freshness extension |
| `freshness.maxAgeForFullScore` | `number` (days) | `90` | Documents within this age receive full freshness points |
| `freshness.penaltyPerMonth` | `number` | `1.5` | Points deducted per 30-day increment beyond window |
| `freshness.hardCutoffAge` | `number` (days) | `730` | Documents at or beyond this age score 0 |
| `freshness.now` | `Date` | `new Date()` | Reference date for deterministic replay and tests |
| `freshness.aggregation` | `'median' \| 'oldest' \| 'newest'` | `'median'` | Which document age to score |
| `weights` | `Partial<Record<DimensionName, number>>` | — | Custom max-point weights per dimension |
| `actionPolicy` | `ActionPolicy` | — | Custom thresholds and warning lists |
| `indexIntegrity` | `IndexIntegrityConfig` | optional | Activates Index Integrity Tier 2 extension |
| `validation` | `'warn' \| 'strict'` | `'warn'` | Strict mode throws on input issues |

### `ConfidenceScorecard`

| Field | Type | Description |
|---|---|---|
| `total` | `number` | Normalized score 0–100 (integer) |
| `label` | `'Strong' \| 'Moderate' \| 'Limited' \| 'Insufficient'` | Human-readable label |
| `labelColor` | `'green' \| 'amber' \| 'orange' \| 'red'` | Display color for UI badge |
| `recommendedAction` | `'answer' \| 'review' \| 'abstain'` | Runtime action recommendation |
| `actionReason` | `string` | First rule that decided the action |
| `tier1` | `Tier1Result \| null` | Answer Confidence tier (Grounding + Retrieval + Consistency + Relevance + Authority) |
| `tier2` | `Tier2Result \| null` | System Readiness tier (Corpus + Freshness + Index Integrity); null when none are active |
| `dimensions.grounding` | `DimensionScore` | Always present |
| `dimensions.retrieval` | `DimensionScore` | Always present |
| `dimensions.consistency` | `DimensionScore` | Always present |
| `dimensions.relevance` | `DimensionScore \| undefined` | Present only when Answer Relevance active |
| `dimensions.authority` | `DimensionScore \| undefined` | Present only when Authority extension active |
| `dimensions.corpus` | `DimensionScore \| undefined` | Present only when Corpus extension active |
| `dimensions.freshness` | `DimensionScore \| undefined` | Present only when Freshness extension active |
| `dimensions.indexIntegrity` | `DimensionScore \| undefined` | Present only when Index Integrity extension active |
| `meta.algorithmVersion` | `string` | Algorithm version, e.g. `'0.3.0'` |
| `meta.schemaVersion` | `string` | Output schema version, e.g. `'0.3'` |
| `meta.rawTotal` | `number` | Sum of weighted raw points before normalization |
| `meta.maxPossible` | `number` | Maximum achievable weighted points given active dimensions |
| `meta.activeExtensions` | `string[]` | Optional extensions active for this call |
| `meta.activeDimensions` | `DimensionName[]` | All active dimensions including core |
| `meta.warnings` | `ConfidenceWarning[]` | Warnings produced during scoring |
| `meta.missingSignals` | `string[]` | Signals that would improve scoring accuracy if provided |
| `meta.weights` | `Partial<Record<DimensionName, number>>` | Active weights used for this scorecard |

### `DimensionScore`

| Field | Type | Description |
|---|---|---|
| `raw` | `number` | Raw points scored for this dimension |
| `max` | `number` | Maximum raw points for this dimension |
| `normalized` | `number` | `raw / max × 100`, rounded (0–100) |
| `explanation` | `string` | Human-readable summary of what drove the score |
| `breakdown` | `DimensionBreakdown` | Machine-readable sub-signal attribution |
| `warnings` | `ConfidenceWarning[]?` | Dimension-level warnings (also in `meta.warnings`) |

---

## Extensions

### Source Authority

Scores how authoritative the retrieved sources are. Useful for legal, compliance, governance, and policy domains where document hierarchy matters.

```typescript
import { computeConfidence } from 'transparent-confidence';

const scorecard = computeConfidence(inputs, {
  authority: {
    tiers: [
      { name: 'CC&Rs',       rank: 10, keywords: ['CC&Rs', 'Declaration', 'Master Deed'] },
      { name: 'Bylaws',      rank: 15, keywords: ['Bylaws'] },
      { name: 'Rules',       rank: 20, keywords: ['Rules', 'Regulations', 'Policy'] },
      { name: 'Board Notes', rank: 30, keywords: ['Minutes', 'Resolution'] },
    ],
  },
});
```

Each candidate is classified by matching `documentType` against tier `keywords` (case-insensitive). `authorityRank` on the candidate overrides keyword matching if provided.

**Default weighted aggregation:** Authority is scored as a weighted average across the top-K candidates, where each candidate's weight is proportional to its `combinedScore`. This rewards answers supported by many strong-scoring authoritative sources, not just the single highest-authority hit.

**v0.1 compat — best source wins:** `aggregation: 'best'` reproduces the original min-rank behavior.

```typescript
authority: { aggregation: 'best' }
```

**Scoring table:**

| Effective Rank | Candidate Points |
|---|---|
| ≤ 10 | 18 |
| ≤ 20 | 13 |
| ≤ 30 | 7 |
| > 30 or unclassified | 2 |

**Bonuses:** +1 if any included candidate has `isAmendment: true`, +1 if more than one rank bucket is represented. Max 20.

### Corpus Completeness

Scores how complete the document corpus is relative to what's expected. Surfaces the risk that a correct answer exists but the documents needed to find it haven't been uploaded.

```typescript
// Count-based
const scorecard = computeConfidence(inputs, {
  corpus: { expectedTypeCount: 6 },
});

// Named-type mode — also tracks which types are missing
const scorecard2 = computeConfidence(
  { ...inputs, presentTypes: ['CC&Rs', 'Bylaws', 'Rules'] },
  { corpus: { expectedTypes: ['CC&Rs', 'Bylaws', 'Rules', 'Amendments', 'Budget'] } },
);
```

**Scoring:** 15 pts at 100% coverage, scales down by ratio. −3 penalty for `missingRelevantType`. Floor 0.

### Document Freshness

Scores how recent the retrieved documents are.

```typescript
const scorecard = computeConfidence(inputs, {
  freshness: {
    maxAgeForFullScore: 60,   // days — full score if selected age ≤ 60
    penaltyPerMonth: 2,       // pts lost per 30-day increment beyond window
    hardCutoffAge: 365,       // days — score = 0 beyond this
    now: referenceDate,       // inject for deterministic tests and replays
    aggregation: 'median',    // 'median' (default) | 'oldest' | 'newest'
  },
});
```

- `'median'` — score the median age across candidates (v0.1 behavior)
- `'oldest'` — score the oldest candidate's age (conservative; useful for compliance)
- `'newest'` — score the newest candidate's age (useful when any current source is sufficient)

All three config fields are optional; defaults are `maxAgeForFullScore: 90`, `penaltyPerMonth: 1.5`, `hardCutoffAge: 730`. Provide `lastUpdated: Date` on each candidate.

### Index Integrity

Scores index operational readiness signals that corpus completeness and document freshness do not cover.

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

Index Integrity is opt-in. It contributes 15 max points to Tier 2 only when `config.indexIntegrity` is present.

---

## Enhanced Signals

These inputs add nuance to the core dimension scores. All are optional and independently skipped when not provided.

### `faithfulnessScore`

A 0–1 score measuring whether the LLM answer text is actually supported by the retrieved passages — distinct from `supportLevel`, which is a coarse support classification. Tools like [RAGAs](https://docs.ragas.io/) compute this. Applies a −3 to −12 modifier to grounding, preventing high-support scores when the model hallucinates.

### `claimSupport`

Structured claim-level support summary. When both `faithfulnessScore` and `claimSupport` are provided, the scoring uses the more conservative (lower) effective support score.

```typescript
{
  claimSupport: {
    totalClaims: 8,
    supportedClaims: 7,
    unsupportedClaims: 1,
    contradictedClaims: 0,
  }
}
```

### `queryComplexity`

Indicates structural complexity of the question. Sets a ceiling on grounding to prevent high scores on questions that require inference the model may not have made correctly.

| Value | Ceiling | Use when |
|---|---|---|
| `'direct'` | 30 (none) | Factual lookup, single document section |
| `'inferential'` | 24 | Requires reasoning across implicit relationships |
| `'multi-hop'` | 18 | Answer requires chaining multiple document sections |
| `'comparative'` | 16 | Comparing two or more policies, rules, or entities |

### `citationCount` / `citationCoverageScore` / `invalidCitationCount`

Citation signals reward answers that show their work and penalize those that cite incorrectly. Set `invalidCitationCount: 0` explicitly to confirm all citations are valid.

### `answerRelevanceScore`

Activates the Answer Relevance dimension. Scores whether the answer addresses the user's question, independent of grounding quality.

### `extractionQuality`

A 0–1 multiplier per candidate reflecting OCR or PDF extraction quality. Applied as `effectiveScore = combinedScore × extractionQuality` before retrieval scoring. Prevents high retrieval scores from poorly-extracted documents.

### Source Diversity (`documentId`)

Setting `documentId` on candidates enables source diversity scoring. Answers grounded in 3+ distinct documents earn +3 pts; 2 documents earn +1 pt. Encourages retrieval pipelines to cast a wide net rather than pulling multiple chunks from the same document.

---

## Examples

Working examples are in the [`examples/`](examples/) directory. Each file includes the scenario description, expected label, expected score range, and expected recommended action in the header comment.

| File | Scenario | Total | Action |
|---|---|---|---|
| [`basic-rag.ts`](examples/basic-rag.ts) | Core dimensions, explicit no-conflict | 100 | `answer` |
| [`knowledge-base.ts`](examples/knowledge-base.ts) | Vector-only retrieval + Freshness | ~78 | `answer` |
| [`legal-docs.ts`](examples/legal-docs.ts) | Authority + Corpus, shows warning-driven review | ~74 | `review` |
| [`full-pipeline.ts`](examples/full-pipeline.ts) | Full pipeline with authority, corpus, and freshness | ~90 | `answer` |
| [`production-gating.ts`](examples/production-gating.ts) | `production-v0.3` required-signal gating | 100 | `review` |
| [`calibration-analysis.ts`](examples/calibration-analysis.ts) | Offline calibration report and policy recommendation | 100 | `answer` |
| [`evaluator-bridge.ts`](examples/evaluator-bridge.ts) | RAGAS-like evaluator output merged into scoring inputs | ~95 | `answer` |
| [`retrieval-tuning.ts`](examples/retrieval-tuning.ts) | Duplicate and rank diagnostics with opt-in penalties | ~97 | `answer` |
| [`index-integrity.ts`](examples/index-integrity.ts) | Opt-in Tier 2 index integrity extension | ~95 | `answer` |

Run any example:

```bash
npx tsx examples/basic-rag.ts
```

Output of `legal-docs.ts` — a 74/100 scorecard where a missing conflict signal forces `review` despite a decent total:

![Terminal output of legal-docs.ts: total 74/100, label Moderate (amber), recommended action review, per-dimension breakdown, and two structured warnings](https://raw.githubusercontent.com/emtcmca/transparent-confidence/master/docs/assets/scorecard-terminal.png)

---

## Upgrading from 0.2.x to 0.3.0

v0.3.0 is mostly additive. See [`docs/migration-v0-3.md`](docs/migration-v0-3.md) for the full guide.

Key decisions:

- Choose `preset: 'legacy-v0.2'`, `balanced-v0.3`, or `production-v0.3`.
- For production gating, provide `answerRelevanceScore`, a conflict signal, and either `faithfulnessScore` or `claimSupport`.
- Add `contentHash` and `rank` when you want retrieval duplicate/rank diagnostics.
- Add `indexIntegrity` inputs only when you opt into `config.indexIntegrity`.
- Use `analyzeCalibration` before treating score thresholds as local reliability thresholds.

Algorithm reference: [`docs/algorithm-v0-3.md`](docs/algorithm-v0-3.md).

---

## Upgrading from 0.1.x to 0.2.0

v0.2.0 includes breaking field renames and behavioral changes. See [`docs/migration-v0-2.md`](docs/migration-v0-2.md) for the full guide.

### Required renames (breaking)

| 0.1.x | 0.2.0 | Why |
|---|---|---|
| `confidenceLevel` | `supportLevel` | The signal describes source support, not calibrated model confidence |
| `corpusDocCount` | `corpusTypeCount` | The Corpus extension counts document types, not raw documents |
| `corpus.expectedDocCount` | `corpus.expectedTypeCount` | Matches the document-type semantics |

Migration is a direct find-and-replace:

```typescript
// Before (0.1.x)
computeConfidence({ confidenceLevel: 'high', corpusDocCount: 4, candidates }, {
  corpus: { expectedDocCount: 5 },
});

// After (0.2.0)
computeConfidence({ supportLevel: 'high', corpusTypeCount: 4, candidates }, {
  corpus: { expectedTypeCount: 5 },
});
```

### Behavioral changes

**Consistency (Dimension 3):** Omitting conflict signals now generates a `missing-conflict-signal` warning and scores conservatively, instead of silently treating the omission as implicit agreement. Pass `hasConflict: false` explicitly.

**Authority (Extension):** Default aggregation changed from "best source wins" (v0.1 min-rank) to weighted average across top-K candidates. Use `authority: { aggregation: 'best' }` to restore v0.1 behavior.

**Recommended action:** `recommendedAction` and `actionReason` are now always present on the scorecard. The default policy includes `missing-conflict-signal` in `reviewOnWarnings`, so scores that were previously labeled Strong may now return `review` if no conflict signal was provided.

**Meta fields added:** `algorithmVersion`, `schemaVersion`, `activeDimensions`, `warnings`, `missingSignals`, `weights`.

---

## Roadmap

**Current line:** `v0.3.0` (published, stable). **Next milestone:** `v1.0` — stabilize and lock the public API surface for a 1.0 commitment.

Candidate features under evaluation for v1.0 — none are started or committed; all remain subject to the zero-runtime-dependency constraint:

- **Batch scoring** — `computeAll(inputs[])` returning sorted scorecards for comparison
- **Score explanation renderer** — format `DimensionScore.explanation` fields into structured Markdown or HTML for display
- **Streaming scorecard** — emit partial scorecard as dimensions complete, useful for long-running pipelines
- **Python port** — identical algorithm, same test scenarios, same output shape
- **Preset configs** — `createScorer(presets.legalDocs)`, `createScorer(presets.customerSupport)` for common domain setups

---

## Contributing

Full guide: [`CONTRIBUTING.md`](CONTRIBUTING.md). Looking for a starting point? Check the [`good first issue`](https://github.com/emtcmca/transparent-confidence/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label.

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/emtcmca/transparent-confidence.git
   cd transparent-confidence
   npm install
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Type-check:
   ```bash
   npm run typecheck
   ```

4. Lint and format:
   ```bash
   npm run lint
   ```

5. File issues at [GitHub Issues](https://github.com/emtcmca/transparent-confidence/issues). PRs welcome — please open an issue first for non-trivial changes.

**Test coverage target:** ≥ 90% line, ≥ 95% function, ≥ 85% branch. Run `npm run coverage` to check.

---

## License

[Apache 2.0](LICENSE)
