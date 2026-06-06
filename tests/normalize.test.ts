import { describe, expect, test } from 'vitest';
import { normalize } from '../src/normalize';

describe('normalize', () => {
  test('perfect score returns 100', () => {
    expect(normalize(65, 65)).toBe(100);
  });

  test('zero score returns 0', () => {
    expect(normalize(0, 65)).toBe(0);
  });

  test('rounds to nearest integer', () => {
    expect(normalize(32, 65)).toBe(49);
  });

  test('core + all extensions: normalize(115, 115) = 100', () => {
    expect(normalize(115, 115)).toBe(100);
  });

  test('core + authority: normalize(85, 85) = 100', () => {
    expect(normalize(85, 85)).toBe(100);
  });

  test('partial score with extension max', () => {
    expect(normalize(65, 115)).toBe(57);
  });

  test('zero max returns 0 without throwing', () => {
    expect(normalize(10, 0)).toBe(0);
  });

  test('result is always integer', () => {
    const result = normalize(33, 70);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('result is always in range 0–100', () => {
    expect(normalize(200, 65)).toBe(100);
    expect(normalize(-5, 65)).toBe(0);
  });
});
