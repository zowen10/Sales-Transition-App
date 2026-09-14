import type { TemplateStatus } from './types';

/** Draft -> Review -> Published -> Retired. */
const ALLOWED_TRANSITIONS: Record<TemplateStatus, TemplateStatus[]> = {
  DRAFT: ['REVIEW', 'RETIRED'],
  REVIEW: ['PUBLISHED', 'DRAFT', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
};

export function canTransitionTemplate(from: TemplateStatus, to: TemplateStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTemplateTransition(from: TemplateStatus, to: TemplateStatus): void {
  if (!canTransitionTemplate(from, to)) {
    throw new Error(`Cannot transition template from ${from} to ${to}.`);
  }
}

/** Only Published templates may be selected for new plan generation. */
export function assertTemplateUsableForGeneration(status: TemplateStatus): void {
  if (status !== 'PUBLISHED') {
    throw new Error(`Template is ${status}; only Published templates may be used to generate a new plan.`);
  }
}

/** A Published template is immutable — it can never be edited in place. */
export function assertTemplateEditable(status: TemplateStatus): void {
  if (status === 'PUBLISHED' || status === 'RETIRED') {
    throw new Error(`Template is ${status} and cannot be edited. Clone it to create a new draft version instead.`);
  }
}

export function nextTemplateVersion(existingVersions: number[]): number {
  return existingVersions.length ? Math.max(...existingVersions) + 1 : 1;
}

export interface ClonedTemplateDraft {
  templateFamilyId: string;
  name: string;
  type: string;
  ownerId: string;
  version: number;
  status: TemplateStatus;
  clonedFromId: string;
  applicablePlanTypes: string[];
  applicableProducts: string[];
  body: unknown;
}

/**
 * Cloning a Published template (or any template) always creates a brand
 * new Draft version — publishing never overwrites history, and existing
 * plans keep the exact template version their snapshot recorded.
 */
export function buildClonedTemplateDraft(
  source: {
    id: string;
    templateFamilyId: string;
    name: string;
    type: string;
    applicablePlanTypes: string[];
    applicableProducts: string[];
    body: unknown;
  },
  existingVersions: number[],
  newOwnerId: string
): ClonedTemplateDraft {
  return {
    templateFamilyId: source.templateFamilyId,
    name: source.name,
    type: source.type,
    ownerId: newOwnerId,
    version: nextTemplateVersion(existingVersions),
    status: 'DRAFT',
    clonedFromId: source.id,
    applicablePlanTypes: source.applicablePlanTypes,
    applicableProducts: source.applicableProducts,
    body: source.body,
  };
}
