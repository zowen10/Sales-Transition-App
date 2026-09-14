import type { HolidayRule } from './types';

export function dateObj(s: string): Date {
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = dateObj(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const d = new Date(year, month, 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return isoDate(d);
}

/**
 * Expands a template-defined holiday calendar (rules) into concrete dates
 * spanning the plan's schedule plus lookahead buffer, so holidayInWeek can
 * do simple range checks. Mirrors the reference calculator's window
 * (schedule span + 370 days, years spanning start-1..end+1).
 */
export function generateHolidays(
  startDate: string,
  spanWeeks: number,
  rules: HolidayRule[]
): { name: string; date: string }[] {
  const first = dateObj(startDate);
  const last = dateObj(addDays(startDate, Math.max(spanWeeks, 1) * 7 + 370));
  const out: { name: string; date: string }[] = [];
  for (let y = first.getFullYear() - 1; y <= last.getFullYear() + 1; y++) {
    for (const rule of rules) {
      const year = y + (rule.yearOffset ?? 0);
      if (rule.kind === 'nth-weekday') {
        out.push({ name: rule.name, date: nthWeekday(year, rule.month, rule.weekday, rule.nth) });
      } else {
        out.push({ name: rule.name, date: isoDate(new Date(year, rule.month, rule.day)) });
      }
    }
  }
  return out;
}

export function holidayInWeek(
  weekStart: string,
  holidays: { name: string; date: string }[]
): { name: string; date: string } | null {
  const end = addDays(weekStart, 6);
  return holidays.find((h) => h.date >= weekStart && h.date <= end) ?? null;
}
