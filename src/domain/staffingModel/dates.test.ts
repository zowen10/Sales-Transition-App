import { describe, expect, it } from 'vitest';
import { addWorkdays, workdayOffset } from './dates';

describe('workdayOffset / addWorkdays', () => {
  it('matches the reference calculator baseline conversion (Sep 21 -> Nov 9 == 35 workdays)', () => {
    expect(workdayOffset('2026-09-21', '2026-11-09')).toBe(35);
  });

  it('round-trips approximately back to the same calendar date', () => {
    const offset = workdayOffset('2026-09-21', '2026-11-09');
    expect(addWorkdays('2026-09-21', offset)).toBe('2026-11-09');
  });

  it('never returns a negative offset for a date before plan start', () => {
    expect(workdayOffset('2026-09-21', '2026-09-01')).toBe(0);
  });
});
