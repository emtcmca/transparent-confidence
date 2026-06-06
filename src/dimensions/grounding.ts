import type { DimensionScore, ScoringInputs } from '../types.js';

const MAX = 30;

const COMPLEXITY_CEILINGS: Record<NonNullable<ScoringInputs['queryComplexity']>, number> = {
  direct: 30,
  inferential: 24,
  'multi-hop': 18,
  comparative: 16,
};

/**
 * Dimension 1 — Answer Grounding (max 30 raw pts)
 *
 * Measures how directly and faithfully the source text answered the question.
 * Primary signal is the LLM's self-assessed confidence level. Modified by
 * faithfulness evaluation, query complexity, penalties, and citation bonus.
 */
export function scoreGrounding(inputs: ScoringInputs): DimensionScore {
  const parts: string[] = [];

  // documentsSilent short-circuits all other logic
  if (inputs.documentsSilent === true) {
    return {
      raw: 0,
      max: MAX,
      normalized: 0,
      explanation: 'Source documents do not address this question.',
    };
  }

  // ── Base score ───────────────────────────────────────────────
  let score: number;

  if (inputs.confidenceLevel === 'high' && !inputs.ambiguityNotes) {
    score = 30;
    parts.push('Source text directly and unambiguously answers the question.');
  } else if (inputs.confidenceLevel === 'high') {
    score = 21;
    parts.push(
      `Source text addresses the question but contains ambiguity: ${inputs.ambiguityNotes}`,
    );
  } else if (inputs.confidenceLevel === 'medium') {
    score = 13;
    if (inputs.ambiguityNotes) {
      parts.push(
        `Answer is inferrable from source text but not explicit. Ambiguity: ${inputs.ambiguityNotes}`,
      );
    } else {
      parts.push('Answer is inferrable from source text but not explicitly stated.');
    }
  } else {
    score = 5;
    parts.push(
      'Source documents are insufficient, conflicting, or ambiguous on this question. Answer reflects best available inference.',
    );
  }

  // ── Penalties (applied in order, floor enforced once at end) ─
  if (inputs.requiresExpertReview === true) {
    score -= 3;
    parts.push('Expert review recommended before acting on this answer (−3).');
  }

  if (inputs.externalConstraintNote) {
    score -= 2;
    parts.push(
      `External constraint may affect this answer: ${inputs.externalConstraintNote} (−2).`,
    );
  }

  if (inputs.hasConflict === true) {
    score -= 5;
    parts.push('Conflicting information detected across retrieved sections (−5).');
  }

  score = Math.max(0, score);

  // ── queryComplexity ceiling ──────────────────────────────────
  if (inputs.queryComplexity && inputs.queryComplexity !== 'direct') {
    const ceiling = COMPLEXITY_CEILINGS[inputs.queryComplexity];
    if (score > ceiling) {
      score = ceiling;
      parts.push(`Score capped at ${ceiling} for ${inputs.queryComplexity} question type.`);
    }
  }

  // ── faithfulnessScore modifier ───────────────────────────────
  if (inputs.faithfulnessScore !== undefined) {
    const fs = inputs.faithfulnessScore;
    if (fs < 0.5) {
      score = Math.max(0, score - 12);
      parts.push(
        `Faithfulness score ${fs.toFixed(2)} indicates significant hallucination risk (−12).`,
      );
    } else if (fs < 0.7) {
      score = Math.max(0, score - 7);
      parts.push(`Faithfulness score ${fs.toFixed(2)} indicates moderate hallucination risk (−7).`);
    } else if (fs < 0.9) {
      score = Math.max(0, score - 3);
      parts.push(`Faithfulness score ${fs.toFixed(2)} indicates minor hallucination risk (−3).`);
    }
    // fs >= 0.9: no penalty, no note needed
  }

  // ── citationCount bonus (cannot exceed MAX) ──────────────────
  if (inputs.citationCount !== undefined && inputs.citationCount > 0) {
    const bonus = inputs.citationCount >= 3 ? 2 : inputs.citationCount === 2 ? 1 : 0;
    if (bonus > 0) {
      score = Math.min(MAX, score + bonus);
      parts.push(`${inputs.citationCount} sections explicitly cited in answer (+${bonus}).`);
    }
  }

  const raw = Math.max(0, Math.min(MAX, score));

  return {
    raw,
    max: MAX,
    normalized: normalize(raw, MAX),
    explanation: parts.join(' '),
  };
}

function normalize(raw: number, max: number): number {
  return Math.round((raw / max) * 100);
}
