import { z } from 'zod';
import { ANSWER_SOURCES, ARTIFACT_TYPES, PLAN_TYPES } from '@/lib/enums';

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
