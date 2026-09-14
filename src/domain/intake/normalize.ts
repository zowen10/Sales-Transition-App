import type { QuestionDefinition, ResponseType } from './types';

export interface NormalizeResult {
  normalizedValue: unknown;
  valueType: ResponseType;
  errors: string[];
}

/**
 * Converts a raw answer (transcript text, spoken number, UI selection) into
 * the normalized, typed value stored against the question. This is the only
 * place raw input is coerced — the estimation and classification engines
 * only ever see normalized values.
 */
export function normalizeAnswer(question: QuestionDefinition, raw: unknown): NormalizeResult {
  const errors: string[] = [];
  const type = question.responseType;

  switch (type) {
    case 'number': {
      const stripped = String(raw ?? '').replace(/[^0-9.\-]/g, '');
      const n = typeof raw === 'number' ? raw : stripped === '' ? NaN : Number(stripped);
      if (Number.isNaN(n)) errors.push(`"${question.prompt}" requires a numeric answer.`);
      return { normalizedValue: Number.isNaN(n) ? null : n, valueType: type, errors };
    }
    case 'boolean': {
      const s = String(raw ?? '').trim().toLowerCase();
      const truthy = ['yes', 'true', 'y', '1'].includes(s);
      const falsy = ['no', 'false', 'n', '0'].includes(s);
      if (typeof raw === 'boolean') return { normalizedValue: raw, valueType: type, errors };
      if (!truthy && !falsy) errors.push(`"${question.prompt}" requires a yes/no answer.`);
      return { normalizedValue: truthy, valueType: type, errors };
    }
    case 'date': {
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) errors.push(`"${question.prompt}" requires a valid date.`);
      return { normalizedValue: isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10), valueType: type, errors };
    }
    case 'select': {
      const s = String(raw ?? '').trim();
      if (question.options && question.options.length && !question.options.includes(s)) {
        errors.push(`"${question.prompt}" must be one of: ${question.options.join(', ')}.`);
      }
      return { normalizedValue: s, valueType: type, errors };
    }
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (question.options && question.options.length) {
        const invalid = arr.filter((v) => !question.options!.includes(v));
        if (invalid.length) errors.push(`"${question.prompt}" contains unrecognized options: ${invalid.join(', ')}.`);
      }
      return { normalizedValue: arr, valueType: type, errors };
    }
    case 'text':
    default: {
      const s = String(raw ?? '').trim();
      return { normalizedValue: s, valueType: 'text', errors };
    }
  }
}

export function validateAnswer(question: QuestionDefinition, normalizedValue: unknown): string[] {
  const errors: string[] = [];
  const rule = question.validationRule;

  if (question.required && (normalizedValue === null || normalizedValue === undefined || normalizedValue === '')) {
    errors.push(`"${question.prompt}" is required.`);
  }
  if (!rule || normalizedValue === null || normalizedValue === undefined) return errors;

  if (typeof normalizedValue === 'number') {
    if (rule.min !== undefined && normalizedValue < rule.min) errors.push(`"${question.prompt}" must be at least ${rule.min}.`);
    if (rule.max !== undefined && normalizedValue > rule.max) errors.push(`"${question.prompt}" must be at most ${rule.max}.`);
  }
  if (typeof normalizedValue === 'string') {
    if (rule.minLength !== undefined && normalizedValue.length < rule.minLength) {
      errors.push(`"${question.prompt}" must be at least ${rule.minLength} characters.`);
    }
    if (rule.maxLength !== undefined && normalizedValue.length > rule.maxLength) {
      errors.push(`"${question.prompt}" must be at most ${rule.maxLength} characters.`);
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(normalizedValue)) {
      errors.push(`"${question.prompt}" is not in the expected format.`);
    }
  }
  return errors;
}
