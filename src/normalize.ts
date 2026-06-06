/**
 * Normalizes a raw dimension score to 0–100.
 * Used both for individual dimension display and the composite scorecard total.
 *
 * @param raw   - Points earned. Clamped to [0, max] before scaling.
 * @param max   - Maximum possible points for this scoring context.
 * @returns       Integer in range 0–100.
 */
export function normalize(raw: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, (raw / max) * 100)));
}
