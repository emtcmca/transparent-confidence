import { describe, expect, test } from 'vitest';
import { computeConfidence } from '../../src/scorer';
import type { IndexIntegrityInputs, ScoringInputs } from '../../src/types';

const baseInputs: ScoringInputs = {
  supportLevel: 'high',
  hasConflict: false,
  candidates: [
    {
      retrievalScores: { semantic: 0.9, keyword: 0.82 },
      combinedScore: 0.86,
      documentId: 'doc-1',
    },
  ],
};

const cleanIndexIntegrity: IndexIntegrityInputs = {
  expectedEmbeddingModelVersion: 'text-embedding-3-large@2026-01',
  actualEmbeddingModelVersion: 'text-embedding-3-large@2026-01',
  sourceVersionMatchRatio: 1,
  staleIndexedDocumentRatio: 0,
  failedIngestionCount: 0,
  aclFilterConfirmed: true,
  deletedSourceLeakageCount: 0,
};

function scoreIndex(indexIntegrity: IndexIntegrityInputs) {
  return computeConfidence({ ...baseInputs, indexIntegrity }, { indexIntegrity: {} });
}

describe('index integrity dimension', () => {
  test('scores full when all index signals are clean', () => {
    const scorecard = scoreIndex(cleanIndexIntegrity);

    expect(scorecard.dimensions.indexIntegrity?.raw).toBe(15);
    expect(scorecard.dimensions.indexIntegrity?.normalized).toBe(100);
    expect(scorecard.dimensions.indexIntegrity?.breakdown?.components).toEqual({
      embeddingVersion: 4,
      sourceVersionMatch: 3,
      staleness: 3,
      ingestionFailures: 2,
      aclFilter: 2,
      deletedSourceLeakage: 1,
    });
  });

  test('embedding version mismatch scores zero for embedding sub-signal and warns', () => {
    const scorecard = scoreIndex({
      ...cleanIndexIntegrity,
      actualEmbeddingModelVersion: 'text-embedding-3-small@2026-01',
    });

    expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.embeddingVersion).toBe(0);
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'embedding-version-mismatch',
        path: 'indexIntegrity.actualEmbeddingModelVersion',
      }),
    );
  });

  test('missing embedding versions score partial and warn incomplete', () => {
    const {
      expectedEmbeddingModelVersion: _expectedEmbeddingModelVersion,
      actualEmbeddingModelVersion: _actualEmbeddingModelVersion,
      ...indexWithoutEmbeddingVersions
    } = cleanIndexIntegrity;
    const scorecard = scoreIndex(indexWithoutEmbeddingVersions);

    expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.embeddingVersion).toBe(2);
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'index-integrity-incomplete',
        path: 'indexIntegrity.expectedEmbeddingModelVersion',
      }),
    );
  });

  test('sourceVersionMatchRatio bands score 3 2 1 0', () => {
    const cases = [
      [0.99, 3],
      [0.95, 2],
      [0.9, 1],
      [0.89, 0],
    ] as const;

    for (const [sourceVersionMatchRatio, expected] of cases) {
      const scorecard = scoreIndex({ ...cleanIndexIntegrity, sourceVersionMatchRatio });

      expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.sourceVersionMatch).toBe(
        expected,
      );
    }
  });

  test('staleIndexedDocumentRatio bands score 3 1 0', () => {
    const cases = [
      [0.01, 3],
      [0.05, 1],
      [0.1, 0],
    ] as const;

    for (const [staleIndexedDocumentRatio, expected] of cases) {
      const scorecard = scoreIndex({ ...cleanIndexIntegrity, staleIndexedDocumentRatio });

      expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.staleness).toBe(expected);
    }
  });

  test('failedIngestionCount above threshold loses ingestion points', () => {
    const scorecard = scoreIndex({ ...cleanIndexIntegrity, failedIngestionCount: 1 });

    expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.ingestionFailures).toBe(0);
  });

  test('aclFilterConfirmed false warns when required', () => {
    const scorecard = scoreIndex({ ...cleanIndexIntegrity, aclFilterConfirmed: false });

    expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.aclFilter).toBe(0);
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'acl-filter-unconfirmed',
        path: 'indexIntegrity.aclFilterConfirmed',
      }),
    );
  });

  test('deletedSourceLeakageCount greater than zero emits error warning', () => {
    const scorecard = scoreIndex({ ...cleanIndexIntegrity, deletedSourceLeakageCount: 2 });

    expect(scorecard.dimensions.indexIntegrity?.breakdown?.components.deletedSourceLeakage).toBe(0);
    expect(scorecard.meta.warnings).toContainEqual(
      expect.objectContaining({
        code: 'deleted-source-leakage',
        severity: 'error',
        path: 'indexIntegrity.deletedSourceLeakageCount',
      }),
    );
  });

  test('dimension inactive unless config.indexIntegrity exists', () => {
    const scorecard = computeConfidence({ ...baseInputs, indexIntegrity: cleanIndexIntegrity });

    expect(scorecard.dimensions.indexIntegrity).toBeUndefined();
    expect(scorecard.meta.activeDimensions).not.toContain('indexIntegrity');
    expect(scorecard.meta.activeExtensions).not.toContain('indexIntegrity');
  });

  test('tier2 includes indexIntegrity when active', () => {
    const scorecard = scoreIndex(cleanIndexIntegrity);

    expect(scorecard.tier2).not.toBeNull();
    expect(scorecard.tier2?.score).toBe(100);
    expect(scorecard.meta.maxPossible).toBe(80);
    expect(scorecard.meta.activeExtensions).toContain('indexIntegrity');
    expect(scorecard.meta.activeDimensions).toContain('indexIntegrity');
  });

  test('breakdown.raw equals DimensionScore.raw', () => {
    const scorecard = scoreIndex({ ...cleanIndexIntegrity, sourceVersionMatchRatio: 0.95 });

    expect(scorecard.dimensions.indexIntegrity?.breakdown?.raw).toBe(
      scorecard.dimensions.indexIntegrity?.raw,
    );
  });
});
