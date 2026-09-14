import type { EstimationConfig, EstimationInput, HolidayMode, PhaseDefinition, ProductDefinition, RoleTemplate } from '@/domain/estimation/types';

export interface PlanTemplateBody {
  phases: PhaseDefinition[];
  products: ProductDefinition[];
  roles: RoleTemplate[];
  config: EstimationConfig;
  defaults: {
    startDate: string;
    ratePerHour: number;
    contingencyPercent: number;
    holidayMode: HolidayMode;
    holidayReductionPercent: number;
  };
  phaseAdjustments: Record<string, number>;
  productAdjustments: Record<string, number>;
  resourceGroupMultipliers: Record<string, number>;
}

export interface EstimationOverrides {
  startDate?: string;
  ratePerHour?: number;
  contingencyPercent?: number;
  holidayMode?: HolidayMode;
  holidayReductionPercent?: number;
  phaseDurationWeeks?: Record<string, number>;
  phaseAdjustments?: Record<string, number>;
  productAdjustments?: Record<string, number>;
  resourceGroupMultipliers?: Record<string, number>;
  overrides?: Record<string, number>;
}

/**
 * Merges a published template's baseline with scenario-level overrides to
 * produce a concrete EstimationInput. This is the only place template data
 * and scenario edits are combined — the estimation engine itself never
 * sees the template, only the merged input.
 */
export function buildEstimationInput(template: PlanTemplateBody, overrides: EstimationOverrides = {}): EstimationInput {
  const phases = template.phases.map((p) => ({
    ...p,
    durationWeeks: overrides.phaseDurationWeeks?.[p.id] ?? p.durationWeeks,
  }));

  return {
    startDate: overrides.startDate ?? template.defaults.startDate,
    ratePerHour: overrides.ratePerHour ?? template.defaults.ratePerHour,
    contingencyPercent: overrides.contingencyPercent ?? template.defaults.contingencyPercent,
    holidayMode: overrides.holidayMode ?? template.defaults.holidayMode,
    holidayReductionPercent: overrides.holidayReductionPercent ?? template.defaults.holidayReductionPercent,
    phases,
    products: template.products,
    roles: template.roles,
    phaseAdjustments: { ...template.phaseAdjustments, ...overrides.phaseAdjustments },
    productAdjustments: { ...template.productAdjustments, ...overrides.productAdjustments },
    resourceGroupMultipliers: { ...template.resourceGroupMultipliers, ...overrides.resourceGroupMultipliers },
    overrides: overrides.overrides,
    config: template.config,
  };
}

/**
 * Splits free-text intake answers into discrete assumption/risk/decision
 * entries (one per line/semicolon-separated clause). Deterministic string
 * splitting only — no LLM summarization of risk content.
 */
export function splitFreeText(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}
