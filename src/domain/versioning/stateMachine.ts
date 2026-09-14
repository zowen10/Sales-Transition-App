import type { PlanVersionStatus } from './types';

/**
 * The lifecycle required by the spec:
 * Draft -> In Progress -> Ready for Review -> Changes Requested -> Approved -> Superseded -> Archived
 *
 * Additional edges: Ready for Review can go straight to Approved (approver
 * agrees without changes); Changes Requested loops back to In Progress;
 * any non-terminal status can be Archived by an administrator.
 */
const ALLOWED_TRANSITIONS: Record<PlanVersionStatus, PlanVersionStatus[]> = {
  // IN_PROGRESS is reached once a user edits the generated baseline; a
  // freshly generated plan that nobody has touched yet can still be
  // submitted straight from Draft.
  DRAFT: ['IN_PROGRESS', 'READY_FOR_REVIEW', 'ARCHIVED'],
  IN_PROGRESS: ['READY_FOR_REVIEW', 'ARCHIVED'],
  READY_FOR_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED'],
  CHANGES_REQUESTED: ['IN_PROGRESS', 'ARCHIVED'],
  APPROVED: ['SUPERSEDED', 'ARCHIVED'],
  SUPERSEDED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionPlanVersion(from: PlanVersionStatus, to: PlanVersionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidPlanVersionTransitionError extends Error {
  constructor(from: PlanVersionStatus, to: PlanVersionStatus) {
    super(`Cannot transition plan version from ${from} to ${to}.`);
    this.name = 'InvalidPlanVersionTransitionError';
  }
}

export function assertPlanVersionTransition(from: PlanVersionStatus, to: PlanVersionStatus): void {
  if (!canTransitionPlanVersion(from, to)) throw new InvalidPlanVersionTransitionError(from, to);
}

/** An approved plan is immutable. Any structural edit must go through cloning into a new version. */
export function isPlanVersionEditable(status: PlanVersionStatus): boolean {
  return status === 'DRAFT' || status === 'IN_PROGRESS' || status === 'CHANGES_REQUESTED';
}

export function isPlanVersionLocked(status: PlanVersionStatus): boolean {
  return status === 'APPROVED' || status === 'SUPERSEDED' || status === 'ARCHIVED';
}
