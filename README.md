# transparent-confidence

**Deterministic, explainable scorecards for RAG answer confidence — using the retrieval, grounding, citation, freshness, and corpus signals your system already has.**

[![npm version](https://img.shields.io/npm/v/transparent-confidence.svg)](https://www.npmjs.com/package/transparent-confidence)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/emtcmca/transparent-confidence/actions/workflows/ci.yml/badge.svg)](https://github.com/emtcmca/transparent-confidence/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-179%20passing-brightgreen.svg)](https://github.com/emtcmca/transparent-confidence/actions)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

> **Transparent Confidence™** is a scoring methodology that makes RAG answer quality auditable — every point on the 0–100 scale has an explicit reason attached to it.

---

## Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [vs. Alternatives](#vs-alternatives)
- [Best for / Not for](#best-for--not-for)
- [Install](#install)
- [Quick Start](#quick-start)
- [From Your Retriever to Candidate\[\]](#from-your-retriever-to-candidate)
- [Algorithm](#algorithm)
- [API Reference](#api-reference)
- [Extensions](#extensions)
- [Enhanced Signals](#enhanced-signals)
- [Examples](#examples)
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
- **Zero required config** — three core dimensions work out of the box; optional extensions activate on demand
- **Zero dependencies** — no ML stack, no server, no model calls; runs inline in any Node.js 20+ process

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
- Single-retrieval pipelines with no metadata — you'll get a score, but it won't be very differentiated
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

console.log(scorecard.total);      // 100
console.log(scorecard.label);      // 'Strong'
console.log(scorecard.labelColor); // 'green'
```

**Output shape:**

```json
{
  "total": 100,
  "label": "Strong",
  "labelColor": "green",
  "tier1": { "score": 100, "label": "Strong", "color": "green" },
  "tier2": null,
  "dimensions": {
    "grounding":   { "raw": 30, "max": 30, "normalized": 100, "explanation": "Source text directly and unambiguously answers the question. 3 sections explicitly cited in answer (+2)." },
    "retrieval":   { "raw": 25, "max": 25, "normalized": 100, "explanation": "3 candidates confirmed by 2+ retrieval methods. Top-3 effective score avg: 0.85. 3 distinct source documents. 3 total candidates." },
    "consistency": { "raw": 10, "max": 10, "normalized": 100, "explanation": "Score std dev 0.024 — very tight retrieval consistency. No conflict detected (+2)." }
  },
  "meta": {
    "rawTotal": 65,
    "maxPossible": 65,
    "activeExtensions": []
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

## Algorithm

The score is built from three core dimensions (always active) and up to three optional extensions. Raw points from all active dimensions are summed and normalized to 0–100.

```
normalizedScore = round((rawTotal / maxPossible) × 100)

maxPossible = 65                      (core)
            + 20  (Authority active)
            + 15  (Corpus active)
            + 15  (Freshness active)
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

**Tier 1 — Answer Confidence:** Grounding + Retrieval + Consistency + Authority (when active). Normalized independently to 0–100. Labels match composite scale.

**Tier 2 — System Readiness:** Corpus + Freshness (when active). Normalized independently to 0–100. Uses separate labels: Complete / Good / Partial / Thin. Hidden (`null`) when neither extension is configured.

---

### Dimension 1 — Answer Grounding (max 30 pts)

Scores how well the LLM answer is grounded in source documents.

**Required inputs:** `supportLevel`

**Optional inputs:** `ambiguityNotes`, `documentsSilent`, `requiresExpertReview`, `externalConstraintNote`, `hasConflict`, `queryComplexity`, `faithfulnessScore`, `citationCount`

#### Base score

| Condition | Base |
|---|---|
| `documentsSilent = true` | 0 — all further logic skipped |
| `supportLevel = 'low'` | 5 |
| `supportLevel = 'medium'` | 13 |
| `supportLevel = 'high'` + ambiguity present | 21 |
| `supportLevel = 'high'` + no ambiguity | 30 |

#### Penalties (applied after base, floor 0)

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

#### `faithfulnessScore` modifier (applied after ceiling, floor 0)

An external faithfulness score (e.g. from RAGAs or a custom evaluator) that measures whether the LLM answer text is supported by the retrieved passages.

| Value | Modifier |
|---|---|
| ≥ 0.90 | +0 |
| 0.70–0.89 | −3 |
| 0.50–0.69 | −7 |
| < 0.50 | −12 |
| Not provided | Not applied |

#### `citationCount` bonus (applied last, cannot exceed 30)

| Value | Bonus |
|---|---|
| ≥ 3 | +2 |
| 2 | +1 |
| 0–1 or not provided | +0 |

---

### Dimension 2 — Retrieval Confidence (max 25 pts)

Scores the quality, breadth, and agreement of the retrieved candidates. Three sub-signals summed, total capped at 25.

**Required inputs:** `candidates[].retrievalScores`, `candidates[].combinedScore`

**Optional inputs:** `candidates[].documentId`, `candidates[].extractionQuality`

#### Sub-signal A — Method Agreement (0–15)

Counts candidates where ≥ 2 named retrieval methods each scored > 0:

| Candidates confirmed by 2+ methods | Points |
|---|---|
| ≥ 3 | 15 |
| 2 | 12 |
| 1 | 8 |
| 0 | 3 |

#### Sub-signal B — Score Magnitude (0–8)

Average `combinedScore` of top 3 candidates by score. If `extractionQuality` is provided, applies as a multiplier before averaging: `effectiveScore = combinedScore × extractionQuality`.

| Avg effective score | Points |
|---|---|
| ≥ 0.80 | 8 |
| ≥ 0.65 | 6 |
| ≥ 0.50 | 4 |
| ≥ 0.35 | 2 |
| < 0.35 | 0 |

#### Sub-signal C — Source Diversity + Section Breadth (0–5)

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

Scores how consistent the retrieved candidates are with each other.

**Required inputs:** `candidates[].combinedScore`

**Optional inputs:** `conflictingCandidateCount`, `hasConflict`

`conflictingCandidateCount` takes precedence over boolean `hasConflict` when both are provided.

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

#### Sub-signal B — Conflict Status (−2 to +2, total floor 0)

| Condition | Adjustment |
|---|---|
| `conflictingCandidateCount = 0` or no conflict indicators | +2 |
| `conflictingCandidateCount = 1` | 0 |
| `conflictingCandidateCount ≥ 2` | −2 |
| `hasConflict = true` (boolean fallback, no count given) | −2 |

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
| `queryComplexity` | `'direct' \| 'inferential' \| 'multi-hop' \| 'comparative'` | — | Complexity of the question type; applies ceiling to grounding |
| `faithfulnessScore` | `number` | — | 0–1 external faithfulness score (e.g. RAGAs); applies modifier to grounding |
| `citationCount` | `number` | — | Number of distinct source sections explicitly cited in the answer |
| `corpusTypeCount` | `number` | — | Current document type count in the corpus (required when Corpus extension active) |
| `missingRelevantType` | `boolean` | — | True when a known relevant document type is not in the corpus |

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

### `ScoringConfig`

All fields optional. Passing a key activates that extension.

| Field | Type | Default | Description |
|---|---|---|---|
| `authority` | `{ tiers?: AuthorityTier[] }` | — | Activates Source Authority extension |
| `authority.tiers` | `AuthorityTier[]` | See below | Custom authority tier definitions |
| `corpus` | `{ expectedTypeCount: number }` | — | Activates Corpus Completeness extension |
| `corpus.expectedTypeCount` | `number` | *(required)* | Number of document types expected in a complete corpus |
| `freshness` | `FreshnessConfig` | — | Activates Document Freshness extension |
| `freshness.maxAgeForFullScore` | `number` (days) | 90 | Documents within this age receive full freshness points |
| `freshness.penaltyPerMonth` | `number` | 1.5 | Points deducted per 30-day increment beyond window |
| `freshness.hardCutoffAge` | `number` (days) | 730 | Documents at or beyond this age score 0 |

**Default Authority tiers** (when `config.authority.tiers` is omitted):

| Name | Rank |
|---|---|
| Primary | 10 |
| Secondary | 20 |
| Supporting | 30 |

### `ConfidenceScorecard`

| Field | Type | Description |
|---|---|---|
| `total` | `number` | Normalized score 0–100 (integer) |
| `label` | `'Strong' \| 'Moderate' \| 'Limited' \| 'Insufficient'` | Human-readable label |
| `labelColor` | `'green' \| 'amber' \| 'orange' \| 'red'` | Display color for UI badge |
| `tier1` | `{ score, label, color } \| null` | Answer Confidence tier (Grounding + Retrieval + Consistency + Authority) |
| `tier2` | `{ score, label, color } \| null` | System Readiness tier (Corpus + Freshness); null when neither extension active |
| `dimensions.grounding` | `DimensionScore` | Always present |
| `dimensions.retrieval` | `DimensionScore` | Always present |
| `dimensions.consistency` | `DimensionScore` | Always present |
| `dimensions.authority` | `DimensionScore \| undefined` | Present only when Authority extension active |
| `dimensions.corpus` | `DimensionScore \| undefined` | Present only when Corpus extension active |
| `dimensions.freshness` | `DimensionScore \| undefined` | Present only when Freshness extension active |
| `meta.rawTotal` | `number` | Sum of raw points before normalization |
| `meta.maxPossible` | `number` | Maximum achievable raw points given active extensions |
| `meta.activeExtensions` | `string[]` | Names of active extensions, e.g. `['authority', 'corpus']` |

### `DimensionScore`

| Field | Type | Description |
|---|---|---|
| `raw` | `number` | Raw points scored for this dimension |
| `max` | `number` | Maximum raw points for this dimension |
| `normalized` | `number` | `raw / max × 100`, rounded (0–100) |
| `explanation` | `string` | Human-readable summary of what drove the score |

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

Each candidate is classified by matching `documentType` against tier `keywords`. `authorityRank` on the candidate overrides keyword matching if provided.

**Scoring:** 18 base pts for highest-authority source found, +1 if any candidate has `isAmendment: true`, +1 if multiple tiers represented. Max 20.

### Corpus Completeness

Scores how complete the document corpus is relative to what's expected. Surfaces the risk that a correct answer exists but the documents needed to find it haven't been uploaded.

```typescript
const scorecard = computeConfidence(inputs, {
  corpus: { expectedTypeCount: 6 },
});
```

Provide `corpusTypeCount` on inputs with the current document type count. Set `missingRelevantType: true` if a known document type relevant to the query is absent from the corpus.

**Scoring:** 15 pts at 100% coverage, scales down by ratio. −3 penalty for `missingRelevantType`. Floor 0.

### Document Freshness

Scores how recent the retrieved documents are. Uses the median `lastUpdated` date across all candidates.

```typescript
const scorecard = computeConfidence(inputs, {
  freshness: {
    maxAgeForFullScore: 60,   // days — full score if median age ≤ 60
    penaltyPerMonth: 2,       // pts lost per 30-day increment beyond window
    hardCutoffAge: 365,       // days — score = 0 beyond this
  },
});
```

All three config fields are optional; defaults are `maxAgeForFullScore: 90`, `penaltyPerMonth: 1.5`, `hardCutoffAge: 730`. Provide `lastUpdated: Date` on each candidate.

---

## Enhanced Signals

These inputs add nuance to the core dimension scores. All are optional and independently skipped when not provided.

### `faithfulnessScore`

A 0–1 score measuring whether the LLM answer text is actually supported by the retrieved passages — distinct from `supportLevel`, which is a coarse support classification. Tools like [RAGAs](https://docs.ragas.io/) compute this. Applies a −3 to −12 modifier to grounding, preventing high-support scores when the model hallucinates.

```typescript
{ supportLevel: 'high', faithfulnessScore: 0.45, candidates: [...] }
// supportLevel='high' starts at 30; faithfulnessScore < 0.50 → −12 → raw capped lower
```

### `queryComplexity`

Indicates the structural complexity of the question. Sets a ceiling on grounding to prevent high grounding scores on questions that require inference the model may not have made correctly.

| Value | Ceiling | Use when |
|---|---|---|
| `'direct'` | 30 (none) | Factual lookup, single document section |
| `'inferential'` | 24 | Requires reasoning across implicit relationships |
| `'multi-hop'` | 18 | Answer requires chaining multiple document sections |
| `'comparative'` | 16 | Comparing two or more policies, rules, or entities |

### `citationCount`

Number of distinct source sections explicitly cited in the answer. Adds +1 (2 citations) or +2 (≥3 citations) to grounding. Rewards answers that show their work.

### `extractionQuality`

A 0–1 multiplier per candidate reflecting OCR or PDF extraction quality. Applied as `effectiveScore = combinedScore × extractionQuality` before retrieval scoring. Prevents high retrieval scores from poorly-extracted documents.

### Source Diversity (`documentId`)

Setting `documentId` on candidates enables source diversity scoring in the Retrieval dimension. Answers grounded in 3+ distinct documents earn +3 pts; 2 documents earn +1 pt. Encourages retrieval pipelines to cast a wide net rather than pulling multiple chunks from the same document.

---

## Examples

Working examples are in the [`examples/`](examples/) directory. Each file includes the scenario description, expected label, and expected score range in the header comment.

| File | Scenario | Expected |
|---|---|---|
| [`basic-rag.ts`](examples/basic-rag.ts) | Three core dimensions, zero config | Strong (100) |
| [`legal-docs.ts`](examples/legal-docs.ts) | Authority + Corpus, HOA governance | Moderate (78) |
| [`knowledge-base.ts`](examples/knowledge-base.ts) | Freshness only, API documentation KB | Moderate (78) |
| [`full-pipeline.ts`](examples/full-pipeline.ts) | All six dimensions, all enhanced signals | Strong (91) |

Run any example:

```bash
npx tsx examples/basic-rag.ts
```

---

## Upgrading from 0.1.x to 0.2.0

v0.2.0 includes breaking field renames to make the API more precise:

| 0.1.x | 0.2.0 | Why |
|---|---|---|
| `confidenceLevel` | `supportLevel` | The signal describes source support, not calibrated model confidence |
| `corpusDocCount` | `corpusTypeCount` | The Corpus extension counts document types, not raw documents |
| `corpus.expectedDocCount` | `corpus.expectedTypeCount` | Matches the document-type semantics |

Migration is a direct find-and-replace:

```typescript
computeConfidence({
  supportLevel: 'high',
  corpusTypeCount: 4,
  candidates,
}, {
  corpus: { expectedTypeCount: 5 },
});
```

Old field names are removed from the v0.2 TypeScript surface.

---

## Roadmap

Planned for future versions — none of these are started or committed:

- **Calibration API** — supply historical score/outcome pairs to tune dimension weights for your domain
- **Batch scoring** — `computeAll(inputs[])` returning sorted scorecards for comparison
- **Score explanation renderer** — format `DimensionScore.explanation` fields into structured Markdown or HTML for display
- **Streaming scorecard** — emit partial scorecard as dimensions complete, useful for long-running pipelines
- **Python port** — identical algorithm, same test scenarios, same output shape
- **Preset configs** — `createScorer(presets.legalDocs)`, `createScorer(presets.customerSupport)` for common domain setups

---

## Contributing

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

