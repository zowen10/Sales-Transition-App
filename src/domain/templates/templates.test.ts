import { describe, expect, it } from 'vitest';
import {
  assertTemplateEditable,
  assertTemplateUsableForGeneration,
  buildClonedTemplateDraft,
  canTransitionTemplate,
  nextTemplateVersion,
} from './service';

describe('template lifecycle', () => {
  it('follows Draft -> Review -> Published -> Retired', () => {
    expect(canTransitionTemplate('DRAFT', 'REVIEW')).toBe(true);
    expect(canTransitionTemplate('REVIEW', 'PUBLISHED')).toBe(true);
    expect(canTransitionTemplate('PUBLISHED', 'RETIRED')).toBe(true);
  });

  it('rejects skipping review before publishing', () => {
    expect(canTransitionTemplate('DRAFT', 'PUBLISHED')).toBe(false);
  });

  it('only allows Published templates to be used for new plan generation', () => {
    expect(() => assertTemplateUsableForGeneration('DRAFT')).toThrow();
    expect(() => assertTemplateUsableForGeneration('PUBLISHED')).not.toThrow();
  });

  it('never allows a Published template to be edited in place', () => {
    expect(() => assertTemplateEditable('PUBLISHED')).toThrow();
    expect(() => assertTemplateEditable('DRAFT')).not.toThrow();
  });

  it('cloning a template always produces a new, incremented draft version', () => {
    const draft = buildClonedTemplateDraft(
      {
        id: 'tpl1',
        templateFamilyId: 'fam1',
        name: '24-Week Single Site MAWM',
        type: 'PLAN_TEMPLATE',
        applicablePlanTypes: ['SINGLE_SITE'],
        applicableProducts: ['wm'],
        body: { phases: [] },
      },
      [1],
      'owner2'
    );
    expect(draft.status).toBe('DRAFT');
    expect(draft.version).toBe(2);
    expect(draft.clonedFromId).toBe('tpl1');
    expect(nextTemplateVersion([1, 2, 5])).toBe(6);
  });
});
