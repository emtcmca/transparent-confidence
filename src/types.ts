// All public types for transparent-confidence.
// Matches the locked scoring model in BUILD-PLAN.md v1.0.

// ─────────────────────────────────────────────────────────────
// INPUT TYPES
// ─────────────────────────────────────────────────────────────

/**
 * A single retrieved chunk/section from the RAG pipeline.
 * Pass all candidates that were used to generate the answer.
 */
export interface Candidate {
  /**
   * Scores from each retrieval method that found this candidate.
   * Keys are user-defined method names (e.g. "semantic", "keyword", "graph").
   * A candidate is counted as "confirmed" when 2+ methods have score > 0.
   */
  retrievalScores: Record<string, number>;

  /**
   * Final combined relevance score after any fusion/re-ranking. Range 0–1.
   * Used for magnitude scoring and variance calculation.
   */
  combinedScore: number;

  /** Unique identifier for the source document this chunk came from. */
  documentId?: string;

  /**
   * Human-readable document type (e.g. "CC&Rs", "policy", "handbook").
   * Used for authority rank inference when authorityRank is not provided.
   */
  documentType?: string;

  /**
   * Numeric authority rank for this document. Lower = higher authority.
   * Maps to user-defined AuthorityTier ranks in ScoringConfig.authority.
   * Required for accurate Authority extension scoring.
   */
  authorityRank?: number;

  /**
   * True if this chunk comes from an amendment to another document.
   * When present, the amended version controls over original language.
   */
  isAmendment?: boolean;

  /**
   * Quality of source content extraction. Range 0–1.
   * Applies as a multiplier on combinedScore in the magnitude sub-signal.
   * Use when documents were OCR'd, scraped, or otherwise imperfectly extracted.
   */
  extractionQuality?: number;

  /**
   * When this document was last updated. Required for Freshness extension.
   * Scoring uses the median lastUpdated across all candidates.
   */
  lastUpdated?: Date;

  /**
   * Optional stable identifier for duplicate or near-duplicate chunks.
   * Use a content hash, canonical chunk id, or source-version id.
   */
  contentHash?: string;

  /**
   * Optional 1-based final retrieval/rerank position from the caller.
   */
  rank?: number;
}

/** Claim-level support summary from an external citation or claim checker. */
export interface ClaimSupport {
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims?: number;
  contradictedClaims?: number;
}

/**
 * All inputs required to compute a confidence scorecard.
 * Fields marked required must always be provided.
 * All other fields are optional enhanced signals — provide what your pipeline has.
 */
export interface ScoringInputs {
  // ── LLM-assessed fields ──────────────────────────────────────

  /** The LLM's self-assessed confidence in its answer. Required. */
  supportLevel: 'high' | 'medium' | 'low';

  /**
   * Free-text description of ambiguity in the source documents.
   * Set to null if supportLevel is high and no ambiguity exists.
   */
  ambiguityNotes?: string | null;

  /** True if the LLM flagged that expert/legal review is recommended. */
  requiresExpertReview?: boolean;

  /**
   * Note about external laws, regulations, or standards not in the corpus
   * that may affect the answer (e.g. "State statute may impose requirements").
   */
  externalConstraintNote?: string | null;

  /**
   * True when the corpus contains no content addressing the question.
   * When true, Grounding scores 0 and all other Grounding logic is skipped.
   */
  documentsSilent?: boolean;

  /**
   * True when the LLM detected conflicting information across retrieved sections.
   * Use conflictingCandidateCount for a more precise penalty when count is known.
   */
  hasConflict?: boolean;

  /**
   * How many of the provided candidates contain conflicting information.
   * More precise than the boolean hasConflict. When provided, hasConflict is ignored.
   */
  conflictingCandidateCount?: number;

  /**
   * Structural complexity of the question being answered.
   * Applies a ceiling on the Grounding score — complex questions cannot
   * score as high even with perfect retrieval.
   */
  queryComplexity?: 'direct' | 'inferential' | 'multi-hop' | 'comparative';

  /**
   * External faithfulness evaluation score. Range 0–1.
   * Measures whether the answer stays within what the retrieved content supports.
   * Produced by frameworks like RAGAS, TruLens, or DeepEval.
   * When provided, acts as a significant modifier on the Grounding score.
   */
  faithfulnessScore?: number;

  /**
   * Optional claim-level support summary. When present in v0.2 scoring,
   * it is used as a stronger grounding signal than coarse supportLevel alone.
   */
  claimSupport?: ClaimSupport;

  /**
   * Number of retrieved sections explicitly cited in the answer.
   * Rewards answers that demonstrate grounding in specific retrieved content.
   * Requires structured LLM output that tracks citations.
   */
  citationCount?: number;

  /** Optional 0-1 score for how much of the answer is covered by valid citations. */
  citationCoverageScore?: number;

  /** Number of citations that do not support the cited answer text. */
  invalidCitationCount?: number;

  /** Optional 0-1 score measuring whether the answer addresses the user's question. */
  answerRelevanceScore?: number;

  // ── Retrieval pipeline fields ─────────────────────────────────

  /**
   * All candidate chunks/sections used to generate the answer. Required.
   * Include all candidates passed to the LLM context, not just the top result.
   * An empty array is valid and scores 0 on retrieval-dependent dimensions.
   */
  candidates: Candidate[];

  // ── Corpus state fields (Corpus extension) ───────────────────

  /**
   * How many distinct document types are currently loaded in the corpus.
   * Required when config.corpus is active. Ignored otherwise.
   */
  corpusTypeCount?: number;

  /** Optional names of document types currently present in the corpus. */
  presentTypes?: string[];

  /**
   * True when the document type most relevant to this question is not in the corpus.
   * Applies a penalty to the Corpus Completeness score.
   */
  missingRelevantType?: boolean;

  /** Optional names of document types known to be missing for this query. */
  missingTypes?: string[];
}

// ─────────────────────────────────────────────────────────────
// CONFIG TYPES
// ─────────────────────────────────────────────────────────────

/**
 * A single authority tier in a user-defined document hierarchy.
 * Lower rank numbers = higher authority.
 */
export interface AuthorityTier {
  /** Display name for this tier (e.g. "Declaration", "Policy", "Guideline"). */
  name: string;

  /**
   * Numeric authority rank. Lower = higher authority.
   * Recommended convention: 10 = primary, 20 = secondary, 30 = supporting.
   */
  rank: number;

  /**
   * Substrings to match against Candidate.documentType for automatic rank inference.
   * Case-insensitive. Matched when authorityRank is not directly provided.
   */
  keywords?: string[];
}

/** Configuration for the Document Freshness extension. */
export interface FreshnessConfig {
  /** Documents updated within this many days receive the full freshness score. Default: 90. */
  maxAgeForFullScore?: number;

  /** Points deducted per 30-day period beyond maxAgeForFullScore. Default: 1.5. */
  penaltyPerMonth?: number;

  /** Documents older than this many days score 0 for freshness. Default: 730. */
  hardCutoffAge?: number;

  /** Reference date for deterministic replay and tests. Default: current date/time. */
  now?: Date;

  /** Which candidate age to score. Default: median. */
  aggregation?: 'median' | 'oldest' | 'newest';
}

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

export interface RelevanceConfig {
  required?: boolean;
  scoreBands?: Partial<RetrievalScoreBands>;
}

export interface AuthorityConfig {
  tiers?: AuthorityTier[];
  aggregation?: 'weighted' | 'best';
  topK?: number;
}

export interface CorpusConfig {
  expectedTypeCount?: number;
  expectedTypes?: string[];
}

export type DimensionName =
  | 'grounding'
  | 'retrieval'
  | 'consistency'
  | 'relevance'
  | 'authority'
  | 'corpus'
  | 'freshness';

export type RecommendedAction = 'answer' | 'review' | 'abstain';

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

export interface DimensionBreakdown {
  components: Record<string, number>;
  adjustments: Record<string, number>;
  diagnostics?: Record<string, number | string | boolean>;
  uncappedRaw: number;
  raw: number;
}

export interface ActionPolicy {
  answerAt?: number;
  reviewAt?: number;
  abstainBelow?: number;
  requireTier1AtLeast?: number;
  abstainOnDocumentsSilent?: boolean;
  reviewOnWarnings?: ConfidenceWarningCode[];
  abstainOnWarnings?: ConfidenceWarningCode[];
}

/**
 * Optional extensions that add domain-specific dimensions to the scorecard.
 * Each active extension adds weight to the total and is renormalized to 0–100.
 * All extensions are opt-in — omit any you do not need.
 */
export interface ScoringConfig {
  /** Retrieval scoring configuration. */
  retrieval?: RetrievalConfig;

  /** Optional Answer Relevance dimension configuration. */
  relevance?: RelevanceConfig;

  /**
   * Source Authority extension (+20 pts to maxPossible).
   * Scores how authoritative the source documents are based on a user-defined hierarchy.
   * Omit tiers to use the default 3-tier generic hierarchy (ranks 10, 20, 30).
   */
  authority?: AuthorityConfig;

  /**
   * Corpus Completeness extension (+15 pts to maxPossible).
   * Scores how complete the knowledge base is relative to its expected composition.
   * Requires corpusTypeCount in ScoringInputs.
   */
  corpus?: CorpusConfig;

  /**
   * Document Freshness extension (+15 pts to maxPossible).
   * Scores how current the source documents are.
   * Requires lastUpdated on at least one Candidate.
   */
  freshness?: FreshnessConfig;

  /** Optional per-dimension max-point weights. */
  weights?: Partial<Record<DimensionName, number>>;

  /** Optional runtime action policy. */
  actionPolicy?: ActionPolicy;

  /** Input validation behavior. Config validation always throws. */
  validation?: 'warn' | 'strict';
}

// ─────────────────────────────────────────────────────────────
// OUTPUT TYPES
// ─────────────────────────────────────────────────────────────

/** Score breakdown for a single dimension. */
export interface DimensionScore {
  /** Raw points earned before normalization. */
  raw: number;

  /** Maximum raw points possible for this dimension. */
  max: number;

  /** Dimension score normalized to 0–100 independently. */
  normalized: number;

  /** Human-readable explanation of why this score was assigned. */
  explanation: string;

  /** Machine-readable sub-signal attribution. Migrated dimension-by-dimension in v0.2. */
  breakdown?: DimensionBreakdown;

  /** Dimension-level warnings, rolled up into ConfidenceScorecard.meta.warnings. */
  warnings?: ConfidenceWarning[];
}

/** Tier 1 — Answer Confidence display (Grounding + Retrieval + Consistency + Authority). */
export interface Tier1Result {
  /** Normalized 0–100 score for answer quality dimensions. */
  score: number;
  label: 'Strong' | 'Moderate' | 'Limited' | 'Insufficient' | 'Not Addressed';
  color: 'green' | 'amber' | 'orange' | 'red' | 'gray';
}

/** Tier 2 — System Readiness display (Corpus + Freshness). Null when no system extensions active. */
export interface Tier2Result {
  /** Normalized 0–100 score for system health dimensions. */
  score: number;
  label: 'Complete' | 'Good' | 'Partial' | 'Thin';
  color: 'green' | 'amber' | 'orange' | 'red';
}

/** The complete confidence scorecard returned by computeConfidence. */
export interface ConfidenceScorecard {
  /** Final normalized confidence score. Integer in range 0–100. */
  total: number;

  /** Composite label derived from total score. */
  label: 'Strong' | 'Moderate' | 'Limited' | 'Insufficient';

  /** Color token for the composite label. */
  labelColor: 'green' | 'amber' | 'orange' | 'red';

  /** Runtime action recommendation derived from score, tiers, and warnings. */
  recommendedAction: RecommendedAction;

  /** Human-readable reason for recommendedAction. */
  actionReason: string;

  /**
   * Tier 1: Answer Confidence.
   * Combines Grounding, Retrieval, Consistency, and Authority (if active).
   * Null only when documentsSilent is true and no candidates were provided.
   */
  tier1: Tier1Result | null;

  /**
   * Tier 2: System Readiness.
   * Combines Corpus and Freshness (if active).
   * Null when neither Corpus nor Freshness extension is configured.
   */
  tier2: Tier2Result | null;

  /** Per-dimension breakdown. Optional dimensions present only when their extension is active. */
  dimensions: {
    grounding: DimensionScore;
    retrieval: DimensionScore;
    consistency: DimensionScore;
    relevance?: DimensionScore;
    authority?: DimensionScore;
    corpus?: DimensionScore;
    freshness?: DimensionScore;
  };

  /** Internal scoring metadata for debugging and transparency. */
  meta: {
    /** Algorithm version that produced this scorecard. */
    algorithmVersion: string;

    /** Output schema version. */
    schemaVersion: string;

    /** Sum of all dimension raw scores before normalization. */
    rawTotal: number;

    /** Maximum possible raw score based on active extensions. */
    maxPossible: number;

    /** Names of active optional extensions, e.g. ["authority", "freshness"]. */
    activeExtensions: string[];

    /** Names of all active dimensions, including core dimensions. */
    activeDimensions: DimensionName[];

    /** Input signals that were useful but missing for this scoring context. */
    missingSignals: string[];

    /** Warnings produced while validating and scoring. */
    warnings: ConfidenceWarning[];

    /** Active dimension weights used by the scorer. */
    weights: Partial<Record<DimensionName, number>>;
  };
}
