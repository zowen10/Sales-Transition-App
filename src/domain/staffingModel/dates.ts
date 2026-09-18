/**
 * Calendar <-> workday-offset conversion, using the same 5-workdays-per-7-
 * calendar-days approximation as the reference calculator
 * (go_live_recovery_calculator_client.html's `targetWorkday`/`mockDay`
 * calculations) so a scenario's abstract day indices can be anchored back
 * to real dates when actuals are loaded in at a checkpoint.
 */
function dateObj(s: string): Date {
  const d = new Date(s + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function calendarDayDiff(a: string, b: string): number {
  return Math.round((dateObj(b).getTime() - dateObj(a).getTime()) / 86400000);
}

export function workdayOffset(planStartDate: string, date: string): number {
  return Math.max(0, Math.round((calendarDayDiff(planStartDate, date) / 7) * 5));
}

export function addWorkdays(planStartDate: string, offset: number): string {
  const calendarDays = Math.round((offset / 5) * 7);
  const d = dateObj(planStartDate);
  d.setDate(d.getDate() + calendarDays);
  return d.toISOString().slice(0, 10);
}
