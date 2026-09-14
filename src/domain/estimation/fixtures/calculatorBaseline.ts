/**
 * DEVELOPMENT FIXTURE — do not treat as production template data.
 *
 * Ported verbatim from the reference prototype (`burn_plan_calculator (1).html`,
 * seeded from "24 Week MAWM Services Plan - Single Site - 05052026.xlsx").
 * Used to (a) seed the first published "24-Week Single Site MAWM" plan
 * template and (b) drive calculator-parity tests for the estimation engine.
 */
import type { EstimationConfig, HolidayRule, PhaseDefinition, ProductDefinition, RoleTemplate } from '../types';

export const CALCULATOR_BASELINE_PHASES: PhaseDefinition[] = [
  { id: 'design', name: 'Design', sequence: 1, durationWeeks: 9, color: '#6bb9ff' },
  { id: 'build', name: 'Build', sequence: 2, durationWeeks: 5, color: '#2ad6c5' },
  { id: 'prepare', name: 'Prepare', sequence: 3, durationWeeks: 10, color: '#f4c152' },
  { id: 'deploy', name: 'Deploy', sequence: 4, durationWeeks: 4, color: '#39ff99' },
];

export const CALCULATOR_BASELINE_PRODUCTS: ProductDefinition[] = [
  { id: 'wm', name: 'Manhattan ACTIVE Warehouse Management' },
  { id: 'lm', name: 'Labor Management - Basic Enablement' },
  { id: 'sci', name: 'Supply Chain Intelligence' },
  { id: 'slotting', name: 'Slotting' },
  { id: 'mif', name: 'Manhattan Integration Framework - MIF' },
  { id: 'extension', name: 'Extension Placeholder' },
];

function roleProduct(name: string): string {
  if (name.startsWith('LM ')) return 'lm';
  if (name.startsWith('SCI ')) return 'sci';
  if (name.startsWith('Slotting')) return 'slotting';
  if (name.startsWith('MIF ')) return 'mif';
  return 'wm';
}

const ZERO_28 = Array(28).fill(0);

const RAW_ROLES: { name: string; group: string; hours: number[] }[] = [
  { name: 'WM Design Lead', group: 'design', hours: [40,40,40,40,40,40,40,40,40,20,20,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: 'WM Design Architect', group: 'design', hours: [30,20,30,20,20,10,10,10,10,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: 'TM Design Lead (Optional Services if MAWM is integrating with MATM)', group: 'design', hours: [0,0,20,20,20,20,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: 'Lead Consultant', group: 'functional', hours: [40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40] },
  { name: 'Staff Consultant', group: 'functional', hours: [0,0,20,20,20,20,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40] },
  { name: 'Technical Lead', group: 'technical', hours: [0,0,0,0,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,40,40,40,40,40,40,40,40] },
  { name: 'Staff Analyst', group: 'technical', hours: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,20,20,20,20,20,20,20,20,40,40,0,0] },
  { name: 'Project Manager', group: 'program', hours: [20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,40,40,40,30] },
  { name: 'Project Director', group: 'program', hours: [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,10,10,10,10] },
  { name: 'LM Design Lead', group: 'design', hours: ZERO_28 },
  { name: 'LM Consultant', group: 'functional', hours: [0,0,0,20,20,20,20,20,16,16,16,16,16,16,8,8,8,8,8,8,8,8,8,8,4,0,40,30] },
  { name: 'LM Technical Lead', group: 'technical', hours: ZERO_28 },
  { name: 'Slotting Consultant', group: 'functional', hours: ZERO_28 },
  { name: 'MIF Consultant', group: 'technical', hours: [0,20,20,20,20,20,20,20,20,20,20,20,10,10,10,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: 'SCI Consultant', group: 'functional', hours: [0,0,0,0,0,0,0,0,20,20,20,20,20,20,0,20,0,20,20,20,20,20,20,20,20,30,40,30] },
];

export const CALCULATOR_BASELINE_ROLES: RoleTemplate[] = RAW_ROLES.map((r) => ({
  name: r.name,
  resourceGroup: r.group,
  product: roleProduct(r.name),
  baselineWeeklyHours: r.hours,
}));

export const CALCULATOR_HOLIDAY_RULES: HolidayRule[] = [
  { name: 'Thanksgiving', kind: 'nth-weekday', month: 10, weekday: 4, nth: 4 },
  { name: 'Christmas', kind: 'fixed', month: 11, day: 25 },
  { name: 'New Year’s', kind: 'fixed', month: 0, day: 1, yearOffset: 1 },
];

export const CALCULATOR_BASELINE_CONFIG: EstimationConfig = {
  standardHoursPerWeek: 40,
  holidayRules: CALCULATOR_HOLIDAY_RULES,
  templateOriginalPhaseLengths: [9, 5, 10, 4],
};

export const CALCULATOR_BASELINE_DEFAULTS = {
  startDate: '2027-01-11',
  ratePerHour: 245,
  contingencyPercent: 0,
  holidayMode: 'include' as const,
  holidayReductionPercent: 50,
};
