export type TemplateStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'RETIRED';

export type TemplateType =
  | 'PLAN_TEMPLATE'
  | 'QUESTION_SET'
  | 'ESTIMATION_RULES'
  | 'PHASE_DURATION'
  | 'STAFFING_PATTERN'
  | 'PRODUCT_MAPPING'
  | 'COMPLEXITY_FACTORS'
  | 'HOLIDAY_CALENDAR'
  | 'ARTIFACT_TEMPLATE'
  | 'APPROVAL_POLICY';

export interface TemplateSummary {
  id: string;
  templateFamilyId: string;
  name: string;
  type: TemplateType;
  ownerId: string;
  version: number;
  status: TemplateStatus;
}
