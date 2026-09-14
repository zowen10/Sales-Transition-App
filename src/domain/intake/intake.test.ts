import { describe, expect, it } from 'vitest';
import { evaluateVisibility } from './visibility';
import { normalizeAnswer, validateAnswer } from './normalize';
import { computeIntakeProgress, getApplicableQuestions, unresolvedHighImpactQuestions } from './service';
import type { QuestionDefinition } from './types';

const planTypeQuestion: QuestionDefinition = {
  id: 'q1',
  key: 'scope.plan_type',
  section: 'Scope and plan classification',
  prompt: 'What is the plan type?',
  responseType: 'select',
  options: ['single_site', 'multi_site', 'program', 'specialized'],
  required: true,
  order: 1,
  highImpact: true,
  active: true,
};

const siteCountQuestion: QuestionDefinition = {
  id: 'q2',
  key: 'scope.site_count',
  section: 'Scope and plan classification',
  prompt: 'How many sites are in scope?',
  responseType: 'number',
  required: true,
  order: 2,
  highImpact: false,
  active: true,
  visibilityRule: { op: 'in', key: 'scope.plan_type', values: ['multi_site', 'program'] },
  validationRule: { min: 2 },
};

const integrationCountQuestion: QuestionDefinition = {
  id: 'q3',
  key: 'complexity.integration_count',
  section: 'Complexity drivers',
  prompt: 'How many integrations are required?',
  responseType: 'number',
  required: false,
  order: 1,
  highImpact: false,
  active: true,
};

describe('visibility rules', () => {
  it('shows a question with no rule by default', () => {
    expect(evaluateVisibility(undefined, {})).toBe(true);
  });

  it('hides a conditional question until its dependency matches', () => {
    expect(evaluateVisibility(siteCountQuestion.visibilityRule, { 'scope.plan_type': 'single_site' })).toBe(false);
    expect(evaluateVisibility(siteCountQuestion.visibilityRule, { 'scope.plan_type': 'multi_site' })).toBe(true);
  });

  it('supports all/any/not composition', () => {
    const rule = {
      all: [
        { op: 'equals' as const, key: 'a', value: 1 },
        { any: [{ op: 'equals' as const, key: 'b', value: 2 }, { op: 'equals' as const, key: 'b', value: 3 }] },
        { not: { op: 'exists' as const, key: 'c' } },
      ],
    };
    expect(evaluateVisibility(rule, { a: 1, b: 3 })).toBe(true);
    expect(evaluateVisibility(rule, { a: 1, b: 3, c: 'present' })).toBe(false);
    expect(evaluateVisibility(rule, { a: 1, b: 9 })).toBe(false);
  });
});

describe('answer normalization', () => {
  it('coerces numeric transcripts to numbers', () => {
    const { normalizedValue, errors } = normalizeAnswer(siteCountQuestion, 'about 4 sites');
    expect(normalizedValue).toBe(4);
    expect(errors).toHaveLength(0);
  });

  it('flags an unparsable number', () => {
    const { errors } = normalizeAnswer(siteCountQuestion, 'unknown');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validates a select answer against its options', () => {
    const { normalizedValue, errors } = normalizeAnswer(planTypeQuestion, 'multi_site');
    expect(normalizedValue).toBe('multi_site');
    expect(errors).toHaveLength(0);
    const bad = normalizeAnswer(planTypeQuestion, 'not_a_type');
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('enforces min/max validation rules', () => {
    expect(validateAnswer(siteCountQuestion, 1)).toEqual(
      expect.arrayContaining([expect.stringContaining('at least 2')])
    );
    expect(validateAnswer(siteCountQuestion, 5)).toHaveLength(0);
  });

  it('flags a missing required answer', () => {
    expect(validateAnswer(planTypeQuestion, '')).toEqual(
      expect.arrayContaining([expect.stringContaining('is required')])
    );
  });
});

describe('intake service', () => {
  const questions = [planTypeQuestion, siteCountQuestion, integrationCountQuestion];

  it('does not surface irrelevant conditional questions', () => {
    const applicable = getApplicableQuestions(questions, { 'scope.plan_type': 'single_site' });
    expect(applicable.map((q) => q.key)).toEqual(['complexity.integration_count', 'scope.plan_type']);
  });

  it('surfaces conditional questions once their trigger is answered', () => {
    const applicable = getApplicableQuestions(questions, { 'scope.plan_type': 'multi_site' });
    expect(applicable.map((q) => q.key)).toContain('scope.site_count');
  });

  it('flags unresolved high-impact questions until explicitly confirmed', () => {
    const unresolved = unresolvedHighImpactQuestions(questions, { 'scope.plan_type': 'multi_site' }, new Set());
    expect(unresolved.map((q) => q.key)).toEqual(['scope.plan_type']);

    const resolved = unresolvedHighImpactQuestions(
      questions,
      { 'scope.plan_type': 'multi_site' },
      new Set(['scope.plan_type'])
    );
    expect(resolved).toHaveLength(0);
  });

  it('computes per-section progress', () => {
    const progress = computeIntakeProgress(
      questions,
      { 'scope.plan_type': 'multi_site', 'scope.site_count': 4 },
      new Set(['scope.plan_type'])
    );
    const scopeSection = progress.find((p) => p.section === 'Scope and plan classification')!;
    expect(scopeSection.totalApplicable).toBe(2);
    expect(scopeSection.answered).toBe(2);
    expect(scopeSection.confirmed).toBe(1);
    expect(scopeSection.unresolved).toBe(0);
  });
});
