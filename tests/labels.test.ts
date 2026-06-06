import { describe, expect, test } from 'vitest';
import { deriveLabel, deriveTier1, deriveTier2 } from '../src/labels';

// ── deriveLabel ───────────────────────────────────────────────────────────────

describe('deriveLabel — Strong (≥ 85)', () => {
  test('100 → Strong / green', () => {
    const r = deriveLabel(100);
    expect(r.label).toBe('Strong');
    expect(r.color).toBe('green');
  });

  test('85 → Strong / green (lower boundary)', () => {
    const r = deriveLabel(85);
    expect(r.label).toBe('Strong');
    expect(r.color).toBe('green');
  });
});

describe('deriveLabel — Moderate (65–84)', () => {
  test('84 → Moderate / amber', () => {
    const r = deriveLabel(84);
    expect(r.label).toBe('Moderate');
    expect(r.color).toBe('amber');
  });

  test('65 → Moderate / amber (lower boundary)', () => {
    const r = deriveLabel(65);
    expect(r.label).toBe('Moderate');
    expect(r.color).toBe('amber');
  });
});

describe('deriveLabel — Limited (40–64)', () => {
  test('64 → Limited / orange', () => {
    const r = deriveLabel(64);
    expect(r.label).toBe('Limited');
    expect(r.color).toBe('orange');
  });

  test('40 → Limited / orange (lower boundary)', () => {
    const r = deriveLabel(40);
    expect(r.label).toBe('Limited');
    expect(r.color).toBe('orange');
  });
});

describe('deriveLabel — Insufficient (< 40)', () => {
  test('39 → Insufficient / red', () => {
    const r = deriveLabel(39);
    expect(r.label).toBe('Insufficient');
    expect(r.color).toBe('red');
  });

  test('0 → Insufficient / red', () => {
    const r = deriveLabel(0);
    expect(r.label).toBe('Insufficient');
    expect(r.color).toBe('red');
  });
});

// ── deriveTier1 ───────────────────────────────────────────────────────────────

describe('deriveTier1 — standard path', () => {
  test('max ≤ 0 → null', () => {
    expect(deriveTier1(0, 0)).toBeNull();
  });

  test('raw 65, max 65 → score 100, Strong', () => {
    const r = deriveTier1(65, 65);
    expect(r?.score).toBe(100);
    expect(r?.label).toBe('Strong');
    expect(r?.color).toBe('green');
  });

  test('raw 0, max 65 → score 0, Insufficient', () => {
    const r = deriveTier1(0, 65);
    expect(r?.score).toBe(0);
    expect(r?.label).toBe('Insufficient');
    expect(r?.color).toBe('red');
  });

  test('raw 52, max 65 → score 80, Moderate', () => {
    // round(52/65 * 100) = round(80) = 80
    const r = deriveTier1(52, 65);
    expect(r?.score).toBe(80);
    expect(r?.label).toBe('Moderate');
  });

  test('raw 26, max 65 → score 40, Limited', () => {
    // round(26/65 * 100) = round(40) = 40
    const r = deriveTier1(26, 65);
    expect(r?.score).toBe(40);
    expect(r?.label).toBe('Limited');
  });
});

describe('deriveTier1 — not addressed', () => {
  test('notAddressed=true → score 0, Not Addressed, gray', () => {
    const r = deriveTier1(0, 65, true);
    expect(r?.score).toBe(0);
    expect(r?.label).toBe('Not Addressed');
    expect(r?.color).toBe('gray');
  });

  test('notAddressed=true overrides raw/max (even with max > 0)', () => {
    const r = deriveTier1(60, 65, true);
    expect(r?.label).toBe('Not Addressed');
    expect(r?.color).toBe('gray');
  });
});

// ── deriveTier2 ───────────────────────────────────────────────────────────────

describe('deriveTier2 — null when no system extensions', () => {
  test('max ≤ 0 → null', () => {
    expect(deriveTier2(0, 0)).toBeNull();
  });
});

describe('deriveTier2 — Complete (≥ 85)', () => {
  test('raw 30, max 30 → score 100, Complete, green', () => {
    const r = deriveTier2(30, 30);
    expect(r?.score).toBe(100);
    expect(r?.label).toBe('Complete');
    expect(r?.color).toBe('green');
  });

  test('score 85 → Complete (lower boundary)', () => {
    // round(26/30 * 100) = round(86.67) = 87
    const r = deriveTier2(26, 30);
    expect(r?.label).toBe('Complete');
  });
});

describe('deriveTier2 — Good (65–84)', () => {
  test('score ~83 → Good', () => {
    // round(25/30 * 100) = round(83.33) = 83
    const r = deriveTier2(25, 30);
    expect(r?.label).toBe('Good');
    expect(r?.color).toBe('amber');
  });

  test('score ~67 → Good (near lower boundary)', () => {
    // round(20/30 * 100) = round(66.67) = 67
    const r = deriveTier2(20, 30);
    expect(r?.label).toBe('Good');
  });
});

describe('deriveTier2 — Partial (40–64)', () => {
  test('score ~63 → Partial', () => {
    // round(19/30 * 100) = round(63.33) = 63
    const r = deriveTier2(19, 30);
    expect(r?.label).toBe('Partial');
    expect(r?.color).toBe('orange');
  });

  test('score 40 → Partial (lower boundary)', () => {
    // round(12/30 * 100) = round(40) = 40
    const r = deriveTier2(12, 30);
    expect(r?.label).toBe('Partial');
  });
});

describe('deriveTier2 — Thin (< 40)', () => {
  test('score ~37 → Thin', () => {
    // round(11/30 * 100) = round(36.67) = 37
    const r = deriveTier2(11, 30);
    expect(r?.label).toBe('Thin');
    expect(r?.color).toBe('red');
  });

  test('raw 0, max 30 → score 0, Thin', () => {
    const r = deriveTier2(0, 30);
    expect(r?.score).toBe(0);
    expect(r?.label).toBe('Thin');
  });
});
