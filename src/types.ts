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
}

/**
 * All inputs required to compute a confidence scorecard.
 * Fields marked required must always be provided.
 * All other fields are optional enhanced signals — provide what your pipeline has.
 */
export interface ScoringInputs {
  // ── LLM-assessed fields ──────────────────────────────────────

  /** The LLM's self-assessed confidence in its answer. Required. */
  confidenceLevel: 'high' | 'medium' | 'low';

  /**
   * Free-text description of ambiguity in the source documents.
   * Set to null if confidenceLevel is high and no ambiguity exists.
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
   * Number of retrieved sections explicitly cited in the answer.
   * Rewards answers that demonstrate grounding in specific retrieved content.
   * Requires structured LLM output that tracks citations.
   */
  citationCount?: number;

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
  corpusDocCount?: number;

  /**
   * True when the document type most relevant to this question is not in the corpus.
   * Applies a penalty to the Corpus Completeness score.
   */
  missingRelevantType?: boolean;
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
}

/**
 * Optional extensions that add domain-specific dimensions to the scorecard.
 * Each active extension adds weight to the total and is renormalized to 0–100.
 * All extensions are opt-in — omit any you do not need.
 */
export interface ScoringConfig {
  /**
   * Source Authority extension (+20 pts to maxPossible).
   * Scores how authoritative the source documents are based on a user-defined hierarchy.
   * Omit tiers to use the default 3-tier generic hierarchy (ranks 10, 20, 30).
   */
  authority?: {
    tiers?: AuthorityTier[];
  };

  /**
   * Corpus Completeness extension (+15 pts to maxPossible).
   * Scores how complete the knowledge base is relative to its expected composition.
   * Requires corpusDocCount in ScoringInputs.
   */
  corpus?: {
    /** Total number of distinct document types expected in a complete corpus. */
    expectedDocCount: number;
  };

  /**
   * Document Freshness extension (+15 pts to maxPossible).
   * Scores how current the source documents are.
   * Requires lastUpdated on at least one Candidate.
   */
  freshness?: FreshnessConfig;
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
    authority?: DimensionScore;
    corpus?: DimensionScore;
    freshness?: DimensionScore;
  };

  /** Internal scoring metadata for debugging and transparency. */
  meta: {
    /** Sum of all dimension raw scores before normalization. */
    rawTotal: number;

    /** Maximum possible raw score based on active extensions. */
    maxPossible: number;

    /** Names of active optional extensions, e.g. ["authority", "freshness"]. */
    activeExtensions: string[];
  };
}
