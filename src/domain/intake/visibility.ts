import type { AnswerMap, Condition, VisibilityRule } from './types';

function evaluateCondition(condition: Condition, answers: AnswerMap): boolean {
  const value = answers[condition.key];
  switch (condition.op) {
    case 'exists':
      return value !== undefined && value !== null && value !== '';
    case 'equals':
      return value === condition.value;
    case 'in':
      return condition.values.includes(value);
    case 'gt':
      return typeof value === 'number' && value > condition.value;
    case 'gte':
      return typeof value === 'number' && value >= condition.value;
    case 'lt':
      return typeof value === 'number' && value < condition.value;
    case 'lte':
      return typeof value === 'number' && value <= condition.value;
    case 'includes':
      return Array.isArray(value) && value.includes(condition.value);
    default:
      return false;
  }
}

function isCondition(rule: VisibilityRule | Condition): rule is Condition {
  return 'op' in rule;
}

/**
 * Evaluates a question's visibility rule against the current answer set.
 * A question with no rule is always visible. Rules are pure data (JSON),
 * never code, so they can be authored/maintained by template owners.
 */
export function evaluateVisibility(rule: VisibilityRule | null | undefined, answers: AnswerMap): boolean {
  if (!rule) return true;
  if (isCondition(rule)) return evaluateCondition(rule, answers);
  if ('all' in rule) return rule.all.every((r) => evaluateVisibility(r, answers));
  if ('any' in rule) return rule.any.some((r) => evaluateVisibility(r, answers));
  if ('not' in rule) return !evaluateVisibility(rule.not, answers);
  return true;
}
