/**
 * Canonical value sets for fields stored as plain strings in SQLite
 * (which has no native enum type). These are the single source of truth
 * used by Zod schemas at every API boundary; domain-layer TS union types
 * (e.g. PlanVersionStatus in src/domain/versioning/types.ts) must stay in
 * sync with these lists.
 */
export const USER_ROLES = [
  'TRANSITION_OWNER',
  'CONTRIBUTOR',
  'REVIEWER',
  'EXECUTIVE_APPROVER',
  'TEMPLATE_OWNER',
  'ADMINISTRATOR',
  'READ_ONLY_STAKEHOLDER',
] as const;

export const TRANSITION_STATUSES = [
  'DRAFT',
  'INTAKE_IN_PROGRESS',
  'CLASSIFIED',
  'PLAN_IN_PROGRESS',
  'READY_FOR_REVIEW',
  'APPROVED',
  'MOBILIZING',
  'ARCHIVED',
] as const;

export const PLAN_TYPES = ['SINGLE_SITE', 'MULTI_SITE'] as const;

export const TEMPLATE_TYPES = [
  'PLAN_TEMPLATE',
  'QUESTION_SET',
  'ESTIMATION_RULES',
  'PHASE_DURATION',
  'STAFFING_PATTERN',
  'PRODUCT_MAPPING',
  'COMPLEXITY_FACTORS',
  'HOLIDAY_CALENDAR',
  'ARTIFACT_TEMPLATE',
  'APPROVAL_POLICY',
] as const;

export const TEMPLATE_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED'] as const;

export const PLAN_VERSION_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'READY_FOR_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'SUPERSEDED',
  'ARCHIVED',
] as const;

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] as const;

export const ARTIFACT_TYPES = [
  'SALES_TRANSITION_BRIEF',
  'APPROVED_BURN_PLAN',
  'SDS_STARTER_PACKAGE',
  'DRAFT_SOW',
  'KICKOFF_PACKAGE',
] as const;

export const ARTIFACT_JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETE', 'FAILED'] as const;

export const ANSWER_SOURCES = ['voice', 'text', 'imported', 'manual'] as const;
export const RESPONSE_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'boolean'] as const;

export const STAFFING_SCENARIO_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export const ISSUE_BURN_LEVER_KEYS = [
  'steadyStateExecution',
  'executionDrivenIssues',
  'calendarDrivenIssues',
  'issueInfluxEvents',
  'blockedCaseThrottling',
  'reopenRate',
  'clientReviewBuffer',
  'resolutionCapacity',
] as const;

export const ISSUE_IMPORT_DECISIONS = ['include', 'exclude', 'needs_review'] as const;
export const ISSUE_IMPORT_PURPOSES = ['baseline', 'actuals_checkpoint'] as const;
