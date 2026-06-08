import type {
  ConfidenceWarning,
  DimensionBreakdown,
  DimensionScore,
  IndexIntegrityConfig,
  IndexIntegrityInputs,
  ScoringConfig,
  ScoringInputs,
} from '../types.js';
import { createWarning } from '../warnings.js';

const MAX = 15;

type ResolvedIndexIntegrityConfig = Required<
  Pick<
    IndexIntegrityConfig,
    | 'maxFailedIngestionsForFullScore'
    | 'staleRatioWarnAt'
    | 'staleRatioZeroAt'
    | 'requireAclFilterConfirmation'
  >
>;

const DEFAULTS: ResolvedIndexIntegrityConfig = {
  maxFailedIngestionsForFullScore: 0,
  staleRatioWarnAt: 0.01,
  staleRatioZeroAt: 0.1,
  requireAclFilterConfirmation: true,
};

/**
 * Extension D - Index Integrity (max 15 raw pts)
 *
 * Scores operational readiness signals for the retrieval index itself.
 * This is opt-in via config.indexIntegrity and does not affect default scores.
 */
export function scoreIndexIntegrity(inputs: ScoringInputs, config: ScoringConfig): DimensionScore {
  const cfg: ResolvedIndexIntegrityConfig = {
    maxFailedIngestionsForFullScore:
      config.indexIntegrity?.maxFailedIngestionsForFullScore ??
      DEFAULTS.maxFailedIngestionsForFullScore,
    staleRatioWarnAt: config.indexIntegrity?.staleRatioWarnAt ?? DEFAULTS.staleRatioWarnAt,
    staleRatioZeroAt: config.indexIntegrity?.staleRatioZeroAt ?? DEFAULTS.staleRatioZeroAt,
    requireAclFilterConfirmation:
      config.indexIntegrity?.requireAclFilterConfirmation ?? DEFAULTS.requireAclFilterConfirmation,
  };

  const index = inputs.indexIntegrity ?? {};
  const warnings: ConfidenceWarning[] = [];
  const parts: string[] = [];

  const embeddingVersion = scoreEmbeddingVersion(index, warnings);
  const sourceVersionMatch = scoreSourceVersionMatch(index, warnings);
  const staleness = scoreStaleness(index, cfg, warnings);
  const ingestionFailures = scoreIngestionFailures(index, cfg, warnings);
  const aclFilter = scoreAclFilter(index, cfg, warnings);
  const deletedSourceLeakage = scoreDeletedSourceLeakage(index, warnings);

  parts.push(`Embedding version: ${embeddingVersion}/4.`);
  parts.push(`Source version match: ${sourceVersionMatch}/3.`);
  parts.push(`Staleness: ${staleness}/3.`);
  parts.push(`Ingestion failures: ${ingestionFailures}/2.`);
  parts.push(`ACL filter: ${aclFilter}/2.`);
  parts.push(`Deleted source leakage: ${deletedSourceLeakage}/1.`);

  const raw =
    embeddingVersion +
    sourceVersionMatch +
    staleness +
    ingestionFailures +
    aclFilter +
    deletedSourceLeakage;

  const breakdown: DimensionBreakdown = {
    components: {
      embeddingVersion,
      sourceVersionMatch,
      staleness,
      ingestionFailures,
      aclFilter,
      deletedSourceLeakage,
    },
    adjustments: {},
    diagnostics: {
      expectedEmbeddingModelVersion: index.expectedEmbeddingModelVersion ?? '',
      actualEmbeddingModelVersion: index.actualEmbeddingModelVersion ?? '',
      sourceVersionMatchRatio: index.sourceVersionMatchRatio ?? -1,
      staleIndexedDocumentRatio: index.staleIndexedDocumentRatio ?? -1,
      failedIngestionCount: index.failedIngestionCount ?? -1,
      aclFilterConfirmed: index.aclFilterConfirmed ?? false,
      deletedSourceLeakageCount: index.deletedSourceLeakageCount ?? -1,
      staleRatioWarnAt: cfg.staleRatioWarnAt,
      staleRatioZeroAt: cfg.staleRatioZeroAt,
      maxFailedIngestionsForFullScore: cfg.maxFailedIngestionsForFullScore,
      requireAclFilterConfirmation: cfg.requireAclFilterConfirmation,
    },
    uncappedRaw: raw,
    raw,
  };

  return {
    raw,
    max: MAX,
    normalized: Math.round((raw / MAX) * 100),
    explanation: parts.join(' '),
    breakdown,
    warnings,
  };
}

function scoreEmbeddingVersion(index: IndexIntegrityInputs, warnings: ConfidenceWarning[]): number {
  const expected = index.expectedEmbeddingModelVersion;
  const actual = index.actualEmbeddingModelVersion;

  if (expected === undefined || actual === undefined) {
    warnings.push(
      createWarning(
        'index-integrity-incomplete',
        'Embedding model version information is incomplete.',
        'indexIntegrity.expectedEmbeddingModelVersion',
      ),
    );
    return 2;
  }

  if (expected !== actual) {
    warnings.push(
      createWarning(
        'embedding-version-mismatch',
        'Actual embedding model version does not match the expected index version.',
        'indexIntegrity.actualEmbeddingModelVersion',
      ),
    );
    return 0;
  }

  return 4;
}

function scoreSourceVersionMatch(
  index: IndexIntegrityInputs,
  warnings: ConfidenceWarning[],
): number {
  const ratio = index.sourceVersionMatchRatio;

  if (ratio === undefined) {
    warnings.push(
      createWarning(
        'index-integrity-incomplete',
        'sourceVersionMatchRatio was not provided.',
        'indexIntegrity.sourceVersionMatchRatio',
      ),
    );
    return 0;
  }

  if (ratio >= 0.99) return 3;
  if (ratio >= 0.95) return 2;
  if (ratio >= 0.9) return 1;
  return 0;
}

function scoreStaleness(
  index: IndexIntegrityInputs,
  cfg: ResolvedIndexIntegrityConfig,
  warnings: ConfidenceWarning[],
): number {
  const ratio = index.staleIndexedDocumentRatio;

  if (ratio === undefined) {
    warnings.push(
      createWarning(
        'index-integrity-incomplete',
        'staleIndexedDocumentRatio was not provided.',
        'indexIntegrity.staleIndexedDocumentRatio',
      ),
    );
    return 0;
  }

  if (ratio <= cfg.staleRatioWarnAt) return 3;
  if (ratio < cfg.staleRatioZeroAt) return 1;
  return 0;
}

function scoreIngestionFailures(
  index: IndexIntegrityInputs,
  cfg: ResolvedIndexIntegrityConfig,
  warnings: ConfidenceWarning[],
): number {
  const failedCount = index.failedIngestionCount;

  if (failedCount === undefined) {
    warnings.push(
      createWarning(
        'index-integrity-incomplete',
        'failedIngestionCount was not provided.',
        'indexIntegrity.failedIngestionCount',
      ),
    );
    return 0;
  }

  return failedCount <= cfg.maxFailedIngestionsForFullScore ? 2 : 0;
}

function scoreAclFilter(
  index: IndexIntegrityInputs,
  cfg: ResolvedIndexIntegrityConfig,
  warnings: ConfidenceWarning[],
): number {
  if (index.aclFilterConfirmed === true) return 2;

  if (cfg.requireAclFilterConfirmation) {
    warnings.push(
      createWarning(
        'acl-filter-unconfirmed',
        'ACL or tenant filter confirmation was not provided.',
        'indexIntegrity.aclFilterConfirmed',
      ),
    );
  }

  return 0;
}

function scoreDeletedSourceLeakage(
  index: IndexIntegrityInputs,
  warnings: ConfidenceWarning[],
): number {
  const leakageCount = index.deletedSourceLeakageCount;

  if (leakageCount === undefined) {
    warnings.push(
      createWarning(
        'index-integrity-incomplete',
        'deletedSourceLeakageCount was not provided.',
        'indexIntegrity.deletedSourceLeakageCount',
      ),
    );
    return 0;
  }

  if (leakageCount > 0) {
    warnings.push(
      createWarning(
        'deleted-source-leakage',
        'Deleted source content appears in retrieval results.',
        'indexIntegrity.deletedSourceLeakageCount',
        'error',
      ),
    );
    return 0;
  }

  return 1;
}
