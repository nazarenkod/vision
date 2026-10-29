/**
 * How long a bar beside a number is: a share of the largest value in the same
 * table (REQ-018-64), so one look tells which row matters most.
 */
export function barShare(value: number, max: number): number {
  if (!max || max <= 0 || !value || value <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

export const largest = (values: number[]): number =>
  values.reduce((max, value) => (value > max ? value : max), 0);
