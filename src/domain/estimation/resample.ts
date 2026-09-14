/**
 * Resamples a baseline weekly-hours array authored against `arr.length`
 * weeks onto a schedule of `n` weeks, using linear interpolation. This is
 * how a role's template hours stretch or compress when a phase's duration
 * is changed from the template baseline.
 */
export function resample(arr: number[], n: number): number[] {
  if (n <= 0) return [];
  if (!arr.length || arr.every((v) => !v)) return Array(n).fill(0);
  if (n === 1) return [arr.reduce((a, b) => a + b, 0) / arr.length];
  return Array.from({ length: n }, (_, i) => {
    const pos = (i * (arr.length - 1)) / (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const t = pos - lo;
    return (arr[lo] ?? 0) * (1 - t) + (arr[hi] ?? 0) * t;
  });
}
