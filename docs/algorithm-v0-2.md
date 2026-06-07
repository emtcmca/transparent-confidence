# Algorithm Reference — v0.2

Detailed scoring tables and formulas for all dimensions and extensions. See the README for usage examples.

---

## Composite Score

```
total = round((rawTotal / maxPossible) × 100)
```

Where:

```
rawTotal    = sum of weighted dimension scores
maxPossible = sum of active dimension weights
```

**Weighted dimension score:**
```
weightedRaw = (dimension.raw / dimension.max) × activeWeight
```

When `activeWeight === dimension.max` (default), `weightedRaw = dimension.raw`. Proof: `(raw / max) × max = raw`.

### Default dimension max values (= default weights)

| Dimension | Active when | Max pts |
|---|---|---:|
| grounding | always | 30 |
| retrieval | always | 25 |
| consistency | always | 10 |
| relevance | `answerRelevanceScore` provided, or `config.relevance.required` | 15 |
| authority | `config.authority` present | 20 |
| corpus | `config.corpus` present | 15 |
| freshness | `config.freshness` present | 15 |

Core max: **65**. All extensions max: **130**.

---

## Labels

| Label | Range | Color |
|---|---|---|
| Strong | ≥ 85 | green |
| Moderate | ≥ 65 | amber |
| Limited | ≥ 40 | orange |
| Insufficient | < 40 | red |

---

## Tier Display

**Tier 1 — Answer Confidence**
Dimensions: grounding, retrieval, consistency, relevance (if active), authority (if active).
Score: normalized 0–100 from tier1 raw/max.

| Label | Range | Color |
|---|---|---|
| Strong | ≥ 85 | green |
| Moderate | ≥ 65 | amber |
| Limited | ≥ 40 | orange |
| Insufficient | < 40 | red |
| Not Addressed | `documentsSilent = true` | gray |

**Tier 2 — System Readiness**
Dimensions: corpus (if active), freshness (if active). Null when neither active.

| Label | Range | Color |
|---|---|---|
| Complete | ≥ 85 | green |
| Good | ≥ 65 | amber |
| Partial | ≥ 40 | orange |
| Thin | < 40 | red |

---

## Recommended Action Policy

8-rule cascade. First matching rule wins.

| Rule | Condition | Action |
|---|---|---|
| 1 | `documentsSilent === true` | `abstain` |
| 2 | Any warning in `abstainOnWarnings` | `abstain` |
| 3 | `total < abstainBelow` | `abstain` |
| 4 | `tier1.score < requireTier1AtLeast` | `review` |
| 5 | Any warning in `reviewOnWarnings` | `review` |
| 6 | `total >= answerAt` | `answer` |
| 7 | `total >= reviewAt` | `review` |
| 8 | (fallback) | `abstain` |

**Default policy values:**

| Parameter | Default |
|---|---|
| `answerAt` | 65 |
| `reviewAt` | 40 |
| `abstainBelow` | 40 |
| `requireTier1AtLeast` | 40 |
| `reviewOnWarnings` | `['missing-answer-relevance', 'missing-conflict-signal']` |
| `abstainOnWarnings` | `['documents-silent']` |

---

## Dimension 1 — Answer Grounding (max 30)

### Scoring order

1. If `documentsSilent === true` → raw 0, stop
2. Apply support base score
3. Apply penalties
4. Apply `queryComplexity` ceiling
5. Apply faithfulness / claim support modifier
6. Apply citation quality modifier
7. Apply citation count bonus
8. Clamp to `[0, 30]`

### Base score

| `supportLevel` | Condition | Base |
|---|---|---:|
| `'high'` | No `ambiguityNotes` | 30 |
| `'high'` | `ambiguityNotes` non-null | 21 |
| `'medium'` | — | 13 |
| `'low'` | — | 5 |

### Penalties

| Condition | Penalty |
|---|---:|
| `requiresExpertReview = true` | −3 |
| `externalConstraintNote` non-null | −2 |
| `hasConflict = true` | −5 |

### Complexity ceiling

| `queryComplexity` | Ceiling |
|---|---:|
| not provided or `'direct'` | 30 |
| `'inferential'` | 24 |
| `'multi-hop'` | 18 |
| `'comparative'` | 16 |

### Faithfulness / claim support

```typescript
claimSupportScore =
  claimSupport && claimSupport.totalClaims > 0
    ? claimSupport.supportedClaims / claimSupport.totalClaims
    : undefined

effectiveSupportScore =
  both present  ? Math.min(faithfulnessScore, claimSupportScore)
  only one      ? whichever is present
  neither       ? undefined
```

| Effective support score | Modifier |
|---|---:|
| ≥ 0.90 | 0 |
| 0.70–0.89 | −3 |
| 0.50–0.69 | −7 |
| < 0.50 | −12 |
| undefined | 0 + warning `missing-faithfulness` |

Additional: if `claimSupport.contradictedClaims >= 1` → −5.

### Citation quality

| Condition | Effect |
|---|---|
| `invalidCitationCount = 1` | −2, citation bonus suppressed |
| `invalidCitationCount >= 2` | −5, citation bonus suppressed |
| `citationCoverageScore < 0.50` | −3 |
| `citationCoverageScore 0.50–0.79` | −1 |
| `citationCoverageScore >= 0.80` or missing | 0 |

### Citation count bonus (only when no invalid citations)

| `citationCount` | Bonus |
|---|---:|
| ≥ 3 | +2 |
| 2 | +1 |
| 0–1 or missing | 0 |

---

## Dimension 2 — Retrieval Confidence (max 25)

### Method confirmation

A retrieval method confirms a candidate when:
```
candidate.retrievalScores[methodName] > threshold
```

Threshold: `methodThresholds[methodName]` → `defaultMethodThreshold` → 0.

A candidate is confirmed when confirmed-method count ≥ `minConfirmedMethods` (default 2).

### Sub-signal A — Method Agreement (0–15)

| Confirmed candidates | Points |
|---|---:|
| ≥ 3 | 15 |
| 2 | 12 |
| 1 | 8 |
| 0 | 3 |

### Sub-signal B — Score Magnitude (0–8)

Top `topK` (default 3) candidates sorted by `combinedScore` descending.

Effective score per candidate:
```
effectiveScore =
  extractionQuality defined
    ? combinedScore × extractionQuality
    : combinedScore
```

Average effective score across top-K:

| Avg | Points |
|---|---:|
| ≥ `bands.full` (0.80) | 8 |
| ≥ `bands.high` (0.65) | 6 |
| ≥ `bands.medium` (0.50) | 4 |
| ≥ `bands.low` (0.35) | 2 |
| < `bands.low` | 0 |

### Sub-signal C — Source Diversity + Breadth (0–5)

| Unique `documentId` count | Points |
|---|---:|
| ≥ 3 | 3 |
| 2 | 1 |
| 0–1 | 0 |

| Total candidates | Points |
|---|---:|
| ≥ 5 | 2 |
| 3–4 | 1 |
| ≤ 2 | 0 |

Total capped at 25.

### Warnings

| Warning | Condition |
|---|---|
| `missing-candidates` | `candidates.length === 0` |
| `single-retrieval-method` | All candidates single-method AND `minConfirmedMethods > 1` |
| `ambiguous-top-results` | Top score gap < `minTopScoreGapForClearWinner` (default 0.05) |

---

## Dimension 3 — Evidence Consistency (max 10)

### Sub-signal A — Score Stability (0–6)

Population standard deviation of `candidate.combinedScore`:

| Condition | Points |
|---|---:|
| No candidates | 0 |
| 1 candidate | 3 |
| std dev < 0.10 | 6 |
| std dev < 0.20 | 5 |
| std dev < 0.30 | 3 |
| std dev ≥ 0.30 | 1 |

### Sub-signal B — Conflict Signal (0–4)

| Condition | Points |
|---|---:|
| `conflictingCandidateCount = 0` | 4 |
| `hasConflict = false` (no count given) | 4 |
| No conflict signal provided | 2 + warning `missing-conflict-signal` |
| `conflictingCandidateCount = 1` | 1 |
| `conflictingCandidateCount >= 2` | 0 |
| `hasConflict = true` (no count given) | 0 |

`conflictingCandidateCount` takes precedence over boolean `hasConflict`.

---

## Optional Dimension — Answer Relevance (max 15)

**Activation:** `answerRelevanceScore` present, or `config.relevance.required = true`.

| `answerRelevanceScore` | Points |
|---|---:|
| ≥ `bands.full` (0.90) | 15 |
| ≥ `bands.high` (0.75) | 12 |
| ≥ `bands.medium` (0.60) | 8 |
| ≥ `bands.low` (0.40) | 4 |
| < `bands.low` | 0 |
| Missing (required) | 0 + warning `missing-answer-relevance` |

Included in Tier 1 when active.

---

## Extension — Source Authority (max 20)

### Rank resolution

1. If `candidate.authorityRank` is set → use it directly
2. Otherwise match `candidate.documentType` (case-insensitive) against `tier.keywords`
3. No match → rank 99 (unclassified)

**Default tiers:**

| Name | Rank |
|---|---:|
| Primary | 10 |
| Secondary | 20 |
| Supporting | 30 |

### Candidate authority points

| Effective rank | Points |
|---|---:|
| ≤ 10 | 18 |
| 11–20 | 13 |
| 21–30 | 7 |
| > 30 or unclassified | 2 |

### Weighted aggregation (default)

Top `topK` (default 5) candidates included.

```
sumScores = sum of max(combinedScore, 0) for included candidates
weight[i] =
  sumScores > 0
    ? combinedScore[i] / sumScores
    : 1 / includedCount            // uniform fallback for all-zero scores

base = round( sum(weight[i] × candidatePoints[i]) )
```

**Bonuses:**
- +1 if any included candidate has `isAmendment = true`
- +1 if more than one rank bucket represented

Raw capped at 20.

### Rank buckets (for diversity bonus)

| Rank range | Bucket |
|---|---|
| ≤ 10 | high |
| 11–20 | mid |
| 21–30 | low |
| > 30 or unclassified | unclassified |

### Best-source compat mode (`aggregation: 'best'`)

```
base = rankToPoints( min(ranks of included candidates) )
```

Bonuses and cap apply identically.

---

## Extension — Corpus Completeness (max 15)

### Count-based scoring

```
effectiveCoverage = corpusTypeCount / expectedTypeCount
```

| Coverage ratio | Base pts |
|---|---:|
| ≥ 1.0 | 15 |
| ≥ 0.80 | 12 |
| ≥ 0.60 | 9 |
| ≥ 0.40 | 5 |
| ≥ 0.20 | 2 |
| < 0.20 | 0 |

Penalty: `missingRelevantType = true` → −3.

### Named-type mode

Activated when `config.corpus.expectedTypes` and `inputs.presentTypes` are both provided.

```
missingTypes = expectedTypes.filter(t => !presentTypes.includes(t))
corpusTypeCount = presentTypes.length
expectedTypeCount = expectedTypes.length
```

Missing types recorded in `breakdown.diagnostics.missingTypes`.

### Warnings

| Warning | Condition |
|---|---|
| `missing-corpus-count` | `corpusTypeCount` missing AND `presentTypes` missing |

---

## Extension — Document Freshness (max 15)

### Age selection

```
ages = candidates.filter(c => c.lastUpdated != null)
                .map(c => (now - c.lastUpdated) / 86400000)

selectedAge =
  aggregation === 'oldest'  ? max(ages)
  aggregation === 'newest'  ? min(ages)
                            : median(ages)
```

If no candidates have `lastUpdated` → raw 0, warning `missing-freshness-dates`.

### Scoring

```
if selectedAge <= maxAgeForFullScore:
  raw = max (15)

elif selectedAge >= hardCutoffAge:
  raw = 0

else:
  extraDays    = selectedAge - maxAgeForFullScore
  extraMonths  = extraDays / 30
  raw = round(max(15 - penaltyPerMonth × extraMonths, 0))
```

### Default config values

| Parameter | Default |
|---|---|
| `maxAgeForFullScore` | 90 days |
| `penaltyPerMonth` | 1.5 pts |
| `hardCutoffAge` | 730 days |
| `aggregation` | `'median'` |
| `now` | `new Date()` |

---

## Warning Codes

| Code | Severity | Triggered when |
|---|---|---|
| `deprecated-field` | warn | v0.1 field name used |
| `missing-candidates` | warn | `candidates.length === 0` |
| `documents-silent` | warn | `documentsSilent === true` |
| `missing-answer-relevance` | warn | Relevance required but score absent |
| `missing-faithfulness` | info | No `faithfulnessScore` or `claimSupport` |
| `missing-conflict-signal` | warn | No `hasConflict` or `conflictingCandidateCount` |
| `missing-freshness-dates` | warn | Freshness active, no `lastUpdated` |
| `missing-corpus-count` | warn | Corpus active, count/types absent |
| `authority-unclassified` | warn | Candidates not matching any tier |
| `single-retrieval-method` | warn | All single-method + `minConfirmedMethods > 1` |
| `low-citation-coverage` | warn | `citationCoverageScore < 0.50` |
| `invalid-citations` | warn | `invalidCitationCount > 0` |
| `ambiguous-top-results` | info | Top score gap below threshold |
| `input-out-of-range` | warn | Input value outside valid range |
