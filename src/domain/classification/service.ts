import type { AnswerMap } from '../intake/types';
import { DEFAULT_CLASSIFICATION_RULES, type ClassificationRules } from './rules';
import type { ClassificationReason, ClassificationResult, ComplexityLevel, ConfidenceLevel } from './types';

function weeksBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Deterministically classifies a transition from its normalized intake
 * answers. Every field on the result is traceable to specific answers via
 * `reasons` — nothing here is an LLM judgment call. If intake answers
 * change, re-running this function is the only way the classification
 * changes; a UI must never silently overwrite it.
 */
export function classifyTransition(
  answers: AnswerMap,
  rules: ClassificationRules = DEFAULT_CLASSIFICATION_RULES
): ClassificationResult {
  const reasons: ClassificationReason[] = [];

  const planType = (answers['scope.plan_type'] as string) ?? 'single_site';
  reasons.push({
    field: 'planType',
    reason: `Set from the "What is the plan type?" answer (${planType}).`,
    sourceQuestionKeys: ['scope.plan_type'],
  });

  const productMix = Array.isArray(answers['scope.products']) ? (answers['scope.products'] as string[]) : [];
  reasons.push({
    field: 'productMix',
    reason: `Derived from the products/services marked in scope (${productMix.length} selected).`,
    sourceQuestionKeys: ['scope.products'],
  });

  const siteCount = typeof answers['scope.site_count'] === 'number' ? (answers['scope.site_count'] as number) : null;
  const geography = (answers['scope.geography'] as string) ?? null;
  const rolloutSequence = (answers['scope.rollout_sequence'] as string) ?? null;

  const integrationCount =
    typeof answers['complexity.integration_count'] === 'number' ? (answers['complexity.integration_count'] as number) : null;
  const usesMif = Boolean(answers['complexity.uses_mif']);
  const hasCustomExtensions = Boolean(answers['complexity.custom_extensions']);
  const extensionCount =
    typeof answers['complexity.extension_count'] === 'number' ? (answers['complexity.extension_count'] as number) : null;
  const hasMigrationConcerns = Boolean(answers['delivery.data_migration_concerns']);
  const hasComplianceRequirements = Boolean(answers['delivery.compliance_requirements']);

  // --- Complexity score ---------------------------------------------------
  const c = rules.complexity;
  let score = 0;
  const scoreReasons: string[] = [];
  if (planType === 'multi_site') { score += c.multiSitePoints; scoreReasons.push(`multi-site plan (+${c.multiSitePoints})`); }
  if (planType === 'program') { score += c.programPoints; scoreReasons.push(`program plan (+${c.programPoints})`); }
  if (siteCount) { score += siteCount * c.perSitePoints; scoreReasons.push(`${siteCount} sites (+${(siteCount * c.perSitePoints).toFixed(1)})`); }
  if (integrationCount) { score += integrationCount * c.perIntegrationPoints; scoreReasons.push(`${integrationCount} integrations (+${(integrationCount * c.perIntegrationPoints).toFixed(1)})`); }
  if (usesMif) { score += c.mifPoints; scoreReasons.push(`MIF involved (+${c.mifPoints})`); }
  if (hasCustomExtensions) { score += c.customExtensionPoints; scoreReasons.push(`custom extensions (+${c.customExtensionPoints})`); }
  if (hasMigrationConcerns) { score += c.migrationConcernPoints; scoreReasons.push(`data migration concerns (+${c.migrationConcernPoints})`); }
  if (hasComplianceRequirements) { score += c.compliancePoints; scoreReasons.push(`compliance/security requirements (+${c.compliancePoints})`); }

  let complexityLevel: ComplexityLevel = 'low';
  if (planType === 'specialized') {
    complexityLevel = 'custom';
  } else if (score >= c.highThreshold) {
    complexityLevel = 'high';
  } else if (score >= c.mediumThreshold) {
    complexityLevel = 'medium';
  }
  reasons.push({
    field: 'complexityLevel',
    reason:
      planType === 'specialized'
        ? 'Set to "custom" because the plan type is specialized.'
        : `Score ${score.toFixed(1)} (threshold: medium ${c.mediumThreshold}, high ${c.highThreshold}) from: ${scoreReasons.join(', ') || 'no complexity drivers reported'}.`,
    sourceQuestionKeys: [
      'scope.plan_type',
      'scope.site_count',
      'complexity.integration_count',
      'complexity.uses_mif',
      'complexity.custom_extensions',
      'delivery.data_migration_concerns',
      'delivery.compliance_requirements',
    ],
  });

  // --- Timeline pressure ---------------------------------------------------
  const startDate = (answers['timeline.target_start_date'] as string) ?? null;
  const goLiveDate = (answers['timeline.target_go_live_date'] as string) ?? null;
  const weeks = weeksBetween(startDate, goLiveDate);
  let timelinePressure: 'low' | 'medium' | 'high' = 'low';
  if (weeks !== null) {
    if (weeks <= rules.timelinePressure.highPressureMaxWeeks) timelinePressure = 'high';
    else if (weeks <= rules.timelinePressure.mediumPressureMaxWeeks) timelinePressure = 'medium';
  }
  reasons.push({
    field: 'timelinePressure',
    reason:
      weeks === null
        ? 'Defaulted to "low" because start and go-live dates are not both set yet.'
        : `${weeks} weeks between target start and go-live (high ≤ ${rules.timelinePressure.highPressureMaxWeeks}w, medium ≤ ${rules.timelinePressure.mediumPressureMaxWeeks}w).`,
    sourceQuestionKeys: ['timeline.target_start_date', 'timeline.target_go_live_date'],
  });

  // --- Commercial model ---------------------------------------------------
  const commercialModel = ((answers['commercial.model'] as string) ?? 'time_and_materials') as ClassificationResult['commercialModel'];
  reasons.push({
    field: 'commercialModel',
    reason: `Set from the commercial model answer (${commercialModel}).`,
    sourceQuestionKeys: ['commercial.model'],
  });

  // --- Confidence level ----------------------------------------------------
  const explicitConfidence = answers['risks.confidence_level'] as ConfidenceLevel | undefined;
  const confidenceLevel: ConfidenceLevel = explicitConfidence ?? 'medium';
  reasons.push({
    field: 'confidenceLevel',
    reason: explicitConfidence
      ? `Set from the self-reported confidence answer (${explicitConfidence}).`
      : 'Defaulted to "medium" — no explicit confidence answer was captured.',
    sourceQuestionKeys: ['risks.confidence_level'],
  });

  return {
    planType,
    productMix,
    siteProfile: { siteCount, geography, rolloutSequence },
    complexityLevel,
    integrationProfile: { integrationCount, usesMif },
    extensionProfile: { hasCustomExtensions, extensionCount },
    dataReadinessProfile: { hasMigrationConcerns, hasComplianceRequirements },
    timelinePressure,
    commercialModel,
    confidenceLevel,
    reasons,
  };
}
