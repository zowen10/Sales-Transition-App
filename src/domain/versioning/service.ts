import { isPlanVersionEditable } from './stateMachine';
import type { PlanVersionStatus, PlanVersionSummary, ScenarioComparison } from './types';

export function nextVersionNumber(existingVersionNumbers: number[]): number {
  return existingVersionNumbers.length ? Math.max(...existingVersionNumbers) + 1 : 1;
}

export interface ChildVersionDraft {
  transitionId: string;
  parentVersionId: string;
  versionNumber: number;
  scenarioName: string;
  status: PlanVersionStatus;
}

/**
 * Prepares the metadata for a new plan version cloned from a parent.
 * Scenario creation never mutates the parent — it always produces a new
 * version, whether the parent is a draft baseline or an approved plan
 * (editing an approved plan must go through this path, never in place).
 */
export function buildChildVersionDraft(
  parent: { id: string; transitionId: string },
  existingVersionNumbers: number[],
  scenarioName: string
): ChildVersionDraft {
  return {
    transitionId: parent.transitionId,
    parentVersionId: parent.id,
    versionNumber: nextVersionNumber(existingVersionNumbers),
    scenarioName,
    status: 'DRAFT',
  };
}

export function compareScenarios(
  parent: PlanVersionSummary,
  scenario: PlanVersionSummary,
  changedInputs: Record<string, { from: unknown; to: unknown }>,
  author: string
): ScenarioComparison {
  const parentRiskDescriptions = new Set(parent.risks.map((r) => r.description));
  const newOrChangedRisks = scenario.risks
    .filter((r) => !parentRiskDescriptions.has(r.description))
    .map((r) => r.description);

  return {
    parentVersionId: parent.id,
    scenarioVersionId: scenario.id,
    scenarioName: scenario.scenarioName,
    changedInputs,
    hoursDelta: scenario.totalHours - parent.totalHours,
    investmentDelta: scenario.totalInvestment - parent.totalInvestment,
    scheduleDeltaWeeks: scenario.calendarWeeks - parent.calendarWeeks,
    peakWeeklyBurnDelta: scenario.peakWeeklyBurnHours - parent.peakWeeklyBurnHours,
    newOrChangedRisks,
    author,
    createdAt: scenario.createdAt,
  };
}

/**
 * Exactly one plan version per transition may be marked recommended.
 * Returns the set of version ids whose `recommended` flag should be
 * cleared as a side effect of marking `recommendedId`.
 */
export function versionsToUnrecommend(versions: { id: string; recommended: boolean }[], recommendedId: string): string[] {
  return versions.filter((v) => v.id !== recommendedId && v.recommended).map((v) => v.id);
}

export function assertVersionIsEditable(status: PlanVersionStatus): void {
  if (!isPlanVersionEditable(status)) {
    throw new Error(
      `Plan version is ${status} and cannot be edited in place. Create a new version to change it.`
    );
  }
}
