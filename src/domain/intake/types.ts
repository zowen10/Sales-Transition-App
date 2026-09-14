export type ResponseType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
export type AnswerSource = 'voice' | 'text' | 'imported' | 'manual';

export interface QuestionDefinition {
  id: string;
  key: string; // stable business identifier, e.g. "scope.plan_type"
  section: string;
  prompt: string;
  helpText?: string | null;
  responseType: ResponseType;
  options?: string[] | null;
  required: boolean;
  order: number;
  visibilityRule?: VisibilityRule | null;
  validationRule?: ValidationRule | null;
  highImpact: boolean;
  active: boolean;
}

export type Condition =
  | { op: 'equals'; key: string; value: unknown }
  | { op: 'in'; key: string; values: unknown[] }
  | { op: 'exists'; key: string }
  | { op: 'gt'; key: string; value: number }
  | { op: 'gte'; key: string; value: number }
  | { op: 'lt'; key: string; value: number }
  | { op: 'lte'; key: string; value: number }
  | { op: 'includes'; key: string; value: unknown }; // for multiselect arrays

export type VisibilityRule =
  | { all: (VisibilityRule | Condition)[] }
  | { any: (VisibilityRule | Condition)[] }
  | { not: VisibilityRule | Condition }
  | Condition;

export interface ValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface NormalizedAnswer {
  questionKey: string;
  normalizedValue: unknown;
  valueType: ResponseType;
  source: AnswerSource;
  confidence?: number;
  isConfirmed: boolean;
  rawTranscript?: string;
}

/** Map of question key -> normalized value, used to evaluate visibility & classification rules. */
export type AnswerMap = Record<string, unknown>;
