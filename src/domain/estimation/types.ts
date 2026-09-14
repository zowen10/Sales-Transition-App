/**
 * Estimation domain types.
 *
 * The estimation engine is deterministic: every field here is either an
 * explicit input (dates, rates, durations, multipliers, overrides) or a
 * value calculated from those inputs. No field is ever populated by an LLM.
 */

export type HolidayMode = 'include' | 'exclude' | 'partial';

export interface PhaseDefinition {
  id: string;
  name: string;
  sequence: number;
  durationWeeks: number;
  color?: string;
}

export interface ProductDefinition {
  id: string;
  name: string;
}

export interface RoleTemplate {
  name: string;
  resourceGroup: string; // e.g. design | functional | technical | program (template-defined, not hardcoded)
  product: string; // ProductDefinition.id
  /**
   * Baseline weekly hours as authored in the template, concatenated across
   * phases in phase order. Length must equal the sum of
   * `EstimationConfig.templateOriginalPhaseLengths`.
   */
  baselineWeeklyHours: number[];
}

export type HolidayRule =
  | { name: string; kind: 'nth-weekday'; month: number; weekday: number; nth: number; yearOffset?: number }
  | { name: string; kind: 'fixed'; month: number; day: number; yearOffset?: number };

export interface EstimationConfig {
  /** Standard hours in a full working week, used for FTE calculations. */
  standardHoursPerWeek: number;
  /** Holiday calendar template — leader-maintained, not hardcoded in the engine. */
  holidayRules: HolidayRule[];
  /**
   * Number of weeks each phase's `baselineWeeklyHours` segment was authored
   * against in the template, aligned 1:1 with the `phases` array order.
   * The engine resamples each role's baseline segment to the plan's actual
   * `durationWeeks` for that phase.
   */
  templateOriginalPhaseLengths: number[];
}

export interface EstimationInput {
  startDate: string; // ISO yyyy-mm-dd
  ratePerHour: number;
  contingencyPercent: number;
  holidayMode: HolidayMode;
  /** PM/holiday-week reduction percentage, used only when holidayMode === 'partial'. */
  holidayReductionPercent: number;
  phases: PhaseDefinition[];
  products: ProductDefinition[];
  roles: RoleTemplate[];
  /** 1.00 = template baseline. Keyed by phase id. */
  phaseAdjustments: Record<string, number>;
  /** 1.00 = template baseline. Keyed by product id. */
  productAdjustments: Record<string, number>;
  /** 1.00 = template baseline. Keyed by resource group. */
  resourceGroupMultipliers: Record<string, number>;
  /** Manual role-week overrides, source = manual_override. Key: `${roleName}|${workIndex}`. */
  overrides?: Record<string, number>;
  config: EstimationConfig;
}

export interface WeekEntry {
  index: number; // 1-based calendar week
  workIndex: number | null; // null when this calendar week is blacked out (holidayMode === 'exclude')
  phaseId: string | null;
  weekStart: string; // ISO date
  holiday: { name: string; date: string } | null;
}

export interface RoleResult {
  name: string;
  resourceGroup: string;
  product: string;
  /** Weekly hours aligned 1:1 with EstimationResult.weeks. */
  weeklyHours: number[];
  totalHours: number;
  /** workIndex values (not calendar week index) that carry a manual override. */
  overriddenWorkIndexes: number[];
}

export interface PhaseResult {
  id: string;
  name: string;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  hours: number;
  investment: number;
}

export interface ProductResult {
  id: string;
  name: string;
  hours: number;
  investment: number;
  weeklyHours: number[];
}

export interface CalculationTraceEntry {
  output: string;
  formula: string;
  inputs: Record<string, number | string>;
  value: number;
}

export interface EstimationResult {
  weeks: WeekEntry[];
  roles: RoleResult[];
  phases: PhaseResult[];
  products: ProductResult[];
  weeklyHours: number[];
  weeklyFte: number[];
  totalHours: number;
  baseInvestment: number;
  contingencyAmount: number;
  totalInvestment: number;
  averageFte: number;
  peakWeeklyBurnHours: number;
  calendarWeeks: number;
  workingWeeks: number;
  holidays: { name: string; date: string }[];
  trace: CalculationTraceEntry[];
}
