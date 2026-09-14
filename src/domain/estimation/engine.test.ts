import { describe, expect, it } from 'vitest';
import { runEstimation } from './engine';
import {
  CALCULATOR_BASELINE_CONFIG,
  CALCULATOR_BASELINE_DEFAULTS,
  CALCULATOR_BASELINE_PHASES,
  CALCULATOR_BASELINE_PRODUCTS,
  CALCULATOR_BASELINE_ROLES,
} from './fixtures/calculatorBaseline';
import type { EstimationInput } from './types';

/**
 * Calculator parity tests.
 *
 * Expected values were produced by extracting the pure computation (no DOM)
 * from `burn_plan_calculator (1).html` and running it against the exact
 * same baseline data in Node, for a matrix of representative scenarios.
 * Rounding tolerance: 2 decimal places on money/hours, matching the
 * calculator's floating point arithmetic (it does not round mid-calculation).
 */
function baseInput(overrides: Partial<EstimationInput> = {}): EstimationInput {
  return {
    startDate: CALCULATOR_BASELINE_DEFAULTS.startDate,
    ratePerHour: CALCULATOR_BASELINE_DEFAULTS.ratePerHour,
    contingencyPercent: CALCULATOR_BASELINE_DEFAULTS.contingencyPercent,
    holidayMode: CALCULATOR_BASELINE_DEFAULTS.holidayMode,
    holidayReductionPercent: CALCULATOR_BASELINE_DEFAULTS.holidayReductionPercent,
    phases: CALCULATOR_BASELINE_PHASES,
    products: CALCULATOR_BASELINE_PRODUCTS,
    roles: CALCULATOR_BASELINE_ROLES,
    phaseAdjustments: { design: 1, build: 1, prepare: 1, deploy: 1 },
    productAdjustments: { wm: 1, lm: 1, sci: 1, slotting: 1, mif: 1, extension: 1 },
    resourceGroupMultipliers: { design: 1, functional: 1, technical: 1, program: 1 },
    config: CALCULATOR_BASELINE_CONFIG,
    ...overrides,
  };
}

describe('estimation engine — calculator parity', () => {
  it('matches baseline (include holidays, 0% contingency)', () => {
    const result = runEstimation(baseInput());
    expect(result.totalHours).toBeCloseTo(5416, 2);
    expect(result.baseInvestment).toBeCloseTo(1326920, 2);
    expect(result.contingencyAmount).toBeCloseTo(0, 2);
    expect(result.totalInvestment).toBeCloseTo(1326920, 2);
    expect(result.averageFte).toBeCloseTo(4.835714285714285, 6);
    expect(result.peakWeeklyBurnHours).toBeCloseTo(250, 2);
    expect(result.calendarWeeks).toBe(28);
    expect(result.workingWeeks).toBe(28);
    expect(result.holidays).toHaveLength(0);

    const phaseHours = Object.fromEntries(result.phases.map((p) => [p.id, p.hours]));
    expect(phaseHours).toMatchObject({ design: 1792, build: 950, prepare: 1730, deploy: 944 });

    const productHours = Object.fromEntries(result.products.map((p) => [p.id, p.hours]));
    expect(productHours).toMatchObject({ wm: 4416, lm: 350, sci: 400, slotting: 0, mif: 250, extension: 0 });

    expect(result.weeklyHours.slice(0, 5)).toEqual([134, 144, 194, 204, 224]);
    expect(result.weeklyHours.slice(-5)).toEqual([192, 234, 240, 250, 220]);
  });

  it('applies contingency percentage on top of base investment', () => {
    const result = runEstimation(baseInput({ contingencyPercent: 10 }));
    expect(result.baseInvestment).toBeCloseTo(1326920, 2);
    expect(result.contingencyAmount).toBeCloseTo(132692, 2);
    expect(result.totalInvestment).toBeCloseTo(1459612, 2);
  });

  it('exclude holiday mode is a no-op when no holiday falls in the schedule window', () => {
    const result = runEstimation(baseInput({ holidayMode: 'exclude' }));
    expect(result.totalHours).toBeCloseTo(5416, 2);
    expect(result.calendarWeeks).toBe(28);
  });

  it('applies resource group multipliers to role, phase, and product totals', () => {
    const result = runEstimation(
      baseInput({ resourceGroupMultipliers: { design: 1, functional: 1, technical: 1.25, program: 0.5 } })
    );
    expect(result.totalHours).toBeCloseTo(5315.5, 2);
    expect(result.baseInvestment).toBeCloseTo(1302297.5, 2);
    expect(result.averageFte).toBeCloseTo(4.745982142857143, 6);
    expect(result.peakWeeklyBurnHours).toBeCloseTo(235, 2);

    const phaseHours = Object.fromEntries(result.phases.map((p) => [p.id, p.hours]));
    expect(phaseHours.design).toBeCloseTo(1749, 2);
    expect(phaseHours.build).toBeCloseTo(935, 2);
    expect(phaseHours.prepare).toBeCloseTo(1722.5, 2);
    expect(phaseHours.deploy).toBeCloseTo(909, 2);

    const productHours = Object.fromEntries(result.products.map((p) => [p.id, p.hours]));
    expect(productHours.wm).toBeCloseTo(4253, 2);
    expect(productHours.mif).toBeCloseTo(312.5, 2);
  });

  it('exclude mode blacks out holiday weeks and extends the calendar without changing total hours', () => {
    const result = runEstimation(baseInput({ startDate: '2027-11-01', holidayMode: 'exclude' }));
    expect(result.calendarWeeks).toBe(31);
    expect(result.workingWeeks).toBe(28);
    expect(result.totalHours).toBeCloseTo(5416, 2);
    expect(result.holidays.map((h) => h.date)).toEqual(['2027-11-25', '2027-12-25', '2028-01-01']);
    expect(result.weeklyHours.slice(0, 5)).toEqual([134, 144, 194, 0, 204]);
  });

  it('partial mode reduces holiday-week hours by the configured percentage while holding schedule duration', () => {
    const result = runEstimation(
      baseInput({ startDate: '2027-11-01', holidayMode: 'partial', holidayReductionPercent: 50 })
    );
    expect(result.calendarWeeks).toBe(28);
    expect(result.totalHours).toBeCloseTo(5092, 2);
    expect(result.baseInvestment).toBeCloseTo(1247540, 2);
    expect(result.averageFte).toBeCloseTo(4.546428571428572, 6);

    const phaseHours = Object.fromEntries(result.phases.map((p) => [p.id, p.hours]));
    expect(phaseHours.design).toBeCloseTo(1468, 2);

    const productHours = Object.fromEntries(result.products.map((p) => [p.id, p.hours]));
    expect(productHours.wm).toBeCloseTo(4160, 2);
    expect(productHours.lm).toBeCloseTo(322, 2);

    expect(result.weeklyHours.slice(0, 5)).toEqual([134, 144, 194, 102, 224]);
  });

  it('include mode leaves holiday weeks at full hours', () => {
    const result = runEstimation(baseInput({ startDate: '2027-11-01', holidayMode: 'include' }));
    expect(result.calendarWeeks).toBe(28);
    expect(result.totalHours).toBeCloseTo(5416, 2);
  });

  it('applies phase and product adjustment percentages multiplicatively', () => {
    const result = runEstimation(
      baseInput({
        phaseAdjustments: { design: 1.5, build: 1, prepare: 1, deploy: 1 },
        productAdjustments: { wm: 0.8, lm: 1, sci: 1, slotting: 1, mif: 1, extension: 1 },
      })
    );
    expect(result.totalHours).toBeCloseTo(5279.2, 1);
    expect(result.baseInvestment).toBeCloseTo(1293404, 0);
    expect(result.peakWeeklyBurnHours).toBeCloseTo(292.8, 1);

    const phaseHours = Object.fromEntries(result.phases.map((p) => [p.id, p.hours]));
    expect(phaseHours.design).toBeCloseTo(2239.2, 1);

    const productHours = Object.fromEntries(result.products.map((p) => [p.id, p.hours]));
    expect(productHours.wm).toBeCloseTo(4131.2, 1);
  });

  it('applies a manual role-week override and recalculates dependent totals', () => {
    const result = runEstimation(baseInput({ overrides: { 'WM Design Lead|0': 99 } }));
    expect(result.totalHours).toBeCloseTo(5475, 2);
    expect(result.baseInvestment).toBeCloseTo(1341375, 2);
    expect(result.weeklyHours.slice(0, 5)).toEqual([193, 144, 194, 204, 224]);

    const wmDesignLead = result.roles.find((r) => r.name === 'WM Design Lead')!;
    expect(wmDesignLead.overriddenWorkIndexes).toEqual([0]);
    expect(wmDesignLead.weeklyHours[0]).toBe(99);
  });

  it('produces a calculation trace for every headline output', () => {
    const result = runEstimation(baseInput());
    const outputs = result.trace.map((t) => t.output);
    expect(outputs).toEqual([
      'totalHours',
      'baseInvestment',
      'contingencyAmount',
      'totalInvestment',
      'averageFte',
      'peakWeeklyBurnHours',
    ]);
    for (const entry of result.trace) {
      expect(typeof entry.formula).toBe('string');
      expect(entry.formula.length).toBeGreaterThan(0);
    }
  });
});
