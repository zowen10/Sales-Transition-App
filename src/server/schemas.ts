import { z } from 'zod';
import { ANSWER_SOURCES, ARTIFACT_TYPES, ISSUE_IMPORT_DECISIONS, PLAN_TYPES } from '@/lib/enums';
import { CANONICAL_ISSUE_FIELDS } from '@/domain/issueAnalysis/types';

export const createTransitionSchema = z.object({
  clientName: z.string().min(1),
  salesforceOpportunityUrl: z.string().optional(),
  name: z.string().min(1),
  engagementDirectorName: z.string().min(1),
  salesLeadName: z.string().optional(),
  executiveSponsorName: z.string().optional(),
  salesTransitionFolderUrl: z.string().optional(),
  planType: z.enum(PLAN_TYPES),
  productsInScope: z.array(z.string()).default([]),
});

export const upsertAnswerSchema = z.object({
  questionKey: z.string().min(1),
  value: z.unknown(),
  source: z.enum(ANSWER_SOURCES),
  confidence: z.number().min(0).max(1).optional(),
  isConfirmed: z.boolean().default(false),
  rawTranscript: z.string().optional(),
});

export const generatePlanSchema = z.object({
  templateId: z.string().optional(),
  scenarioName: z.string().default('Baseline'),
});

export const scenarioAdjustmentSchema = z.object({
  scenarioName: z.string().min(1),
  ratePerHour: z.number().positive().optional(),
  contingencyPercent: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  holidayMode: z.enum(['include', 'exclude', 'partial']).optional(),
  holidayReductionPercent: z.number().min(0).max(100).optional(),
  phaseDurationWeeks: z.record(z.string(), z.number().positive()).optional(),
  phaseAdjustments: z.record(z.string(), z.number().min(0)).optional(),
  productAdjustments: z.record(z.string(), z.number().min(0)).optional(),
  resourceGroupMultipliers: z.record(z.string(), z.number().min(0)).optional(),
  overrides: z.record(z.string(), z.number().min(0)).optional(),
});

export const updateInPlaceSchema = scenarioAdjustmentSchema.omit({ scenarioName: true }).partial();

export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
  comment: z.string().optional(),
});

export const artifactRequestSchema = z.object({
  artifactType: z.enum(ARTIFACT_TYPES),
});

export const templateCreateSchema = z.object({
  templateFamilyId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  applicablePlanTypes: z.array(z.string()).default([]),
  applicableProducts: z.array(z.string()).default([]),
  body: z.unknown(),
});

export const templateTransitionSchema = z.object({
  to: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED']),
});

export const linkSharepointDocumentSchema = z.object({
  sharepointUrl: z.string().min(1),
  filename: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Staffing / issue-burn recovery calculator
// ---------------------------------------------------------------------------

const issueInfluxEventSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  day: z.number().int().min(0),
  issueCount: z.number().min(0),
});

const calendarIssueRatePointSchema = z.object({
  day: z.number().int().min(0),
  ratePerDay: z.number().min(0),
});

export const leverConfigSchema = z.object({
  steadyStateExecution: z.object({ enabled: z.boolean(), casesPerDay: z.number().min(0) }),
  executionDrivenIssues: z.object({ enabled: z.boolean(), casesPerIssue: z.number().min(0.1) }),
  calendarDrivenIssues: z.object({
    enabled: z.boolean(),
    baseRatePerDay: z.number().min(0),
    schedule: z.array(calendarIssueRatePointSchema).optional(),
  }),
  issueInfluxEvents: z.object({ enabled: z.boolean(), events: z.array(issueInfluxEventSchema) }),
  blockedCaseThrottling: z.object({ enabled: z.boolean(), blockedCasesPerIssue: z.number().min(0) }),
  reopenRate: z.object({ enabled: z.boolean(), reopenRatePercent: z.number().min(0).max(100) }),
  clientReviewBuffer: z.object({ enabled: z.boolean(), bufferDays: z.number().int().min(0) }),
  resolutionCapacity: z.object({ enabled: z.boolean(), issuesPerDayPerFte: z.number().min(0), fteCount: z.number().min(0) }),
});

export const scenarioInputSchema = z.object({
  totalTestCases: z.number().min(0),
  startingIssues: z.number().min(0),
  targetWorkday: z.number().int().min(0),
  levers: leverConfigSchema,
});

export const createStaffingScenarioSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().optional(),
  transitionId: z.string().optional(),
  label: z.string().default('Baseline'),
  scenarioInput: scenarioInputSchema,
});

export const updateStaffingScenarioSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

export const simulateStaffingScenarioSchema = z.object({
  label: z.string().min(1).optional(),
  scenarioInput: scenarioInputSchema,
  resourcePlanOverrides: z.record(z.string(), z.record(z.string(), z.number())).optional(),
});

// ---------------------------------------------------------------------------
// Issue-list import + LLM column-mapping stage gate
// ---------------------------------------------------------------------------

export const confirmMappingSchema = z.object({
  mapping: z.record(z.enum(CANONICAL_ISSUE_FIELDS), z.string().nullable()),
});

export const issueImportDecisionSchema = z.object({
  decision: z.enum(ISSUE_IMPORT_DECISIONS).optional(),
  pmNote: z.string().optional(),
  expectedUplift: z
    .object({ reason: z.string().min(1), effectiveFrom: z.number().int().min(0), adjustment: z.number() })
    .nullable()
    .optional(),
});
