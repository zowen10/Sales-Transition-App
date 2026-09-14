import { addDays, generateHolidays, holidayInWeek } from './dates';
import { resample } from './resample';
import type {
  CalculationTraceEntry,
  EstimationInput,
  EstimationResult,
  PhaseResult,
  ProductResult,
  RoleResult,
  WeekEntry,
} from './types';

/**
 * Deterministic estimation engine, ported from the Burn Plan Calculator
 * reference prototype. Given explicit inputs (template baselines, dates,
 * durations, multipliers, and documented overrides) it produces the full
 * calculation — hours, cost, schedule, weekly burn — plus a trace
 * explaining every headline number. Nothing here is inferred by an LLM.
 *
 * role_week_hours = template_role_hours × resource_group_multiplier
 *                    × phase_adjustment × product_adjustment × holiday_multiplier
 */
export function runEstimation(input: EstimationInput): EstimationResult {
  const standardHoursPerWeek = input.config.standardHoursPerWeek || 40;
  const workingWeeks = input.phases.reduce((a, p) => a + p.durationWeeks, 0);

  // 1. Resample each role's template baseline onto the plan's phase durations,
  //    apply the resource-group multiplier, and splice in manual overrides.
  const roleModelHours: Record<string, number[]> = {};
  const overriddenWorkIndexes: Record<string, number[]> = {};
  input.roles.forEach((role) => {
    const hours: number[] = [];
    const overrideIdx: number[] = [];
    let cursor = 0;
    let workIndex = 0;
    input.phases.forEach((phase, pi) => {
      const originalLen = input.config.templateOriginalPhaseLengths[pi] ?? phase.durationWeeks;
      const segment = role.baselineWeeklyHours.slice(cursor, cursor + originalLen);
      const multiplier = input.resourceGroupMultipliers[role.resourceGroup] ?? 1;
      resample(segment, phase.durationWeeks).forEach((v) => {
        const key = `${role.name}|${workIndex}`;
        if (input.overrides && Object.prototype.hasOwnProperty.call(input.overrides, key)) {
          hours.push(Number(input.overrides[key]));
          overrideIdx.push(workIndex);
        } else {
          hours.push(v * multiplier);
        }
        workIndex++;
      });
      cursor += originalLen;
    });
    roleModelHours[role.name] = hours;
    overriddenWorkIndexes[role.name] = overrideIdx;
  });

  // 2. Build the calendar week sequence. In 'exclude' mode, holiday weeks are
  //    blacked out (workIndex null) and the schedule extends to absorb them.
  const workPhaseLabels: string[] = [];
  input.phases.forEach((p) => {
    for (let i = 0; i < p.durationWeeks; i++) workPhaseLabels.push(p.id);
  });

  const holidaysAll = generateHolidays(input.startDate, workingWeeks + 10, input.config.holidayRules);
  const weeks: WeekEntry[] = [];
  const holidaysHit: { name: string; date: string }[] = [];
  let workIndex = 0;
  let calendarIndex = 0;
  while (workIndex < workPhaseLabels.length && calendarIndex < 500) {
    const weekStart = addDays(input.startDate, calendarIndex * 7);
    const holiday = holidayInWeek(weekStart, holidaysAll);
    if (holiday && !holidaysHit.some((h) => h.date === holiday.date)) holidaysHit.push(holiday);
    if (holiday && input.holidayMode === 'exclude') {
      weeks.push({ index: calendarIndex + 1, workIndex: null, phaseId: null, weekStart, holiday });
    } else {
      weeks.push({
        index: calendarIndex + 1,
        workIndex,
        phaseId: workPhaseLabels[workIndex] ?? null,
        weekStart,
        holiday,
      });
      workIndex++;
    }
    calendarIndex++;
  }

  // 3. Apply phase/product adjustments and the holiday multiplier to produce
  //    each role's actual weekly hours across the calendar.
  const partialMultiplier = input.holidayMode === 'partial' ? 1 - input.holidayReductionPercent / 100 : 1;
  const phaseFactor = (id: string) => Number(input.phaseAdjustments[id] ?? 1);
  const productFactor = (id: string) => Number(input.productAdjustments[id] ?? 1);

  const roles: RoleResult[] = input.roles.map((role) => {
    const modelHours = roleModelHours[role.name] ?? [];
    const weeklyHours = weeks.map((w) => {
      if (w.workIndex === null || w.phaseId === null) return 0;
      const holidayMult = w.holiday ? partialMultiplier : 1;
      return (modelHours[w.workIndex] ?? 0) * phaseFactor(w.phaseId) * productFactor(role.product) * holidayMult;
    });
    const totalHours = weeklyHours.reduce((a, b) => a + b, 0);
    return {
      name: role.name,
      resourceGroup: role.resourceGroup,
      product: role.product,
      weeklyHours,
      totalHours,
      overriddenWorkIndexes: overriddenWorkIndexes[role.name] ?? [],
    };
  });

  // 4. Roll up by product workstream.
  const products: ProductResult[] = input.products.map((prod) => {
    const relevantRoles = roles.filter((r) => r.product === prod.id);
    const weeklyHours = weeks.map((_, i) => relevantRoles.reduce((s, r) => s + (r.weeklyHours[i] ?? 0), 0));
    const hours = relevantRoles.reduce((s, r) => s + r.totalHours, 0);
    return { id: prod.id, name: prod.name, hours, investment: hours * input.ratePerHour, weeklyHours };
  });

  const weeklyHours = weeks.map((_, i) => products.reduce((s, p) => s + (p.weeklyHours[i] ?? 0), 0));
  const weeklyFte = weeklyHours.map((h) => h / standardHoursPerWeek);

  // 5. Roll up by phase, including modeled calendar start/end dates.
  const phaseHours: Record<string, number> = {};
  const phaseWeekEntries: Record<string, WeekEntry[]> = {};
  weeks.forEach((w, i) => {
    if (!w.phaseId) return;
    phaseHours[w.phaseId] = (phaseHours[w.phaseId] ?? 0) + (weeklyHours[i] ?? 0);
    (phaseWeekEntries[w.phaseId] ??= []).push(w);
  });
  const phases: PhaseResult[] = input.phases.map((p) => {
    const entries = phaseWeekEntries[p.id] ?? [];
    const hours = phaseHours[p.id] ?? 0;
    const startDate = entries[0]?.weekStart ?? input.startDate;
    const lastWeekStart = entries[entries.length - 1]?.weekStart ?? input.startDate;
    return {
      id: p.id,
      name: p.name,
      durationWeeks: p.durationWeeks,
      startDate,
      endDate: addDays(lastWeekStart, 6),
      hours,
      investment: hours * input.ratePerHour,
    };
  });

  // 6. Commercial + resourcing summary.
  const totalHours = weeklyHours.reduce((a, b) => a + b, 0);
  const baseInvestment = totalHours * input.ratePerHour;
  const contingencyAmount = baseInvestment * (input.contingencyPercent / 100);
  const totalInvestment = baseInvestment + contingencyAmount;
  const averageFte = workingWeeks > 0 ? totalHours / (workingWeeks * standardHoursPerWeek) : 0;
  const peakWeeklyBurnHours = weeklyHours.length ? Math.max(...weeklyHours) : 0;
  const calendarWeeks = weeks.length;

  const trace: CalculationTraceEntry[] = [
    {
      output: 'totalHours',
      formula: 'sum(weekly_hours across all calendar weeks)',
      inputs: { calendarWeeks, workingWeeks },
      value: totalHours,
    },
    {
      output: 'baseInvestment',
      formula: 'total_hours × services_rate',
      inputs: { totalHours, ratePerHour: input.ratePerHour },
      value: baseInvestment,
    },
    {
      output: 'contingencyAmount',
      formula: 'base_investment × contingency_percent',
      inputs: { baseInvestment, contingencyPercent: input.contingencyPercent },
      value: contingencyAmount,
    },
    {
      output: 'totalInvestment',
      formula: 'base_investment + contingency_amount',
      inputs: { baseInvestment, contingencyAmount },
      value: totalInvestment,
    },
    {
      output: 'averageFte',
      formula: 'total_hours / (working_weeks × standard_hours_per_week)',
      inputs: { totalHours, workingWeeks, standardHoursPerWeek },
      value: averageFte,
    },
    {
      output: 'peakWeeklyBurnHours',
      formula: 'max(weekly_hours)',
      inputs: { weeksModeled: weeklyHours.length },
      value: peakWeeklyBurnHours,
    },
  ];

  return {
    weeks,
    roles,
    phases,
    products,
    weeklyHours,
    weeklyFte,
    totalHours,
    baseInvestment,
    contingencyAmount,
    totalInvestment,
    averageFte,
    peakWeeklyBurnHours,
    calendarWeeks,
    workingWeeks,
    holidays: holidaysHit,
    trace,
  };
}
