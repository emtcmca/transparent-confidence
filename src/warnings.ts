import type { ConfidenceWarning, ConfidenceWarningCode } from './types.js';

export function createWarning(
  code: ConfidenceWarningCode,
  message: string,
  path?: string,
  severity: ConfidenceWarning['severity'] = 'warn',
): ConfidenceWarning {
  return {
    code,
    severity,
    message,
    ...(path !== undefined && { path }),
  };
}

export function uniqueWarnings(warnings: ConfidenceWarning[]): ConfidenceWarning[] {
  const seen = new Set<string>();
  const unique: ConfidenceWarning[] = [];

  for (const warning of warnings) {
    const key = `${warning.code}:${warning.path ?? ''}:${warning.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(warning);
    }
  }

  return unique;
}

export function missingSignalsForWarnings(warnings: ConfidenceWarning[]): string[] {
  const signals = new Set<string>();

  for (const warning of warnings) {
    if (warning.code === 'missing-candidates') signals.add('candidates');
    if (warning.code === 'missing-answer-relevance') signals.add('answerRelevanceScore');
    if (warning.code === 'missing-faithfulness') signals.add('faithfulnessScore');
    if (warning.code === 'missing-conflict-signal') signals.add('conflictSignal');
    if (warning.code === 'missing-freshness-dates') signals.add('freshnessDates');
    if (warning.code === 'missing-corpus-count') signals.add('corpusTypes');
    if (warning.code === 'authority-unclassified') signals.add('authorityRanks');
  }

  return [...signals];
}
