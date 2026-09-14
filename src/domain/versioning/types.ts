export type PlanVersionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export interface PlanVersionSummary {
  id: string;
  transitionId: string;
  versionNumber: number;
  parentVersionId: string | null;
  scenarioName: string;
  status: PlanVersionStatus;
  recommended: boolean;
  totalHours: number;
  totalInvestment: number;
  calendarWeeks: number;
  peakWeeklyBurnHours: number;
  changedInputs?: Record<string, { from: unknown; to: unknown }>;
  risks: { id: string; description: string }[];
  createdAt: string;
}

export interface ScenarioComparison {
  parentVersionId: string;
  scenarioVersionId: string;
  scenarioName: string;
  changedInputs: Record<string, { from: unknown; to: unknown }>;
  hoursDelta: number;
  investmentDelta: number;
  scheduleDeltaWeeks: number;
  peakWeeklyBurnDelta: number;
  newOrChangedRisks: string[];
  author: string;
  createdAt: string;
}
