import type { PlanVersionStatus } from '../versioning/types';
import type { ApprovalRecord, ApprovalStatus, SubmissionCheck } from './types';

/**
 * A plan cannot be submitted if required high-impact answers are
 * unconfirmed, or no executive approver is assigned.
 */
export function checkPlanReadyForSubmission(input: {
  unconfirmedHighImpactAnswerPrompts: string[];
  hasExecutiveApprover: boolean;
}): SubmissionCheck {
  const blockers: string[] = [];
  if (input.unconfirmedHighImpactAnswerPrompts.length) {
    blockers.push(
      `${input.unconfirmedHighImpactAnswerPrompts.length} high-impact answer(s) are not yet confirmed: ${input.unconfirmedHighImpactAnswerPrompts.join('; ')}`
    );
  }
  if (!input.hasExecutiveApprover) {
    blockers.push('No executive sponsor / approver is assigned to this transition.');
  }
  return { ok: blockers.length === 0, blockers };
}

/**
 * A plan cannot be approved if required assumptions, risks, or an approver
 * are missing.
 */
export function checkPlanReadyForApproval(input: {
  assumptionsCount: number;
  risksCount: number;
  hasPendingApprovalRequest: boolean;
}): SubmissionCheck {
  const blockers: string[] = [];
  if (input.assumptionsCount === 0) blockers.push('At least one assumption must be documented before approval.');
  if (input.risksCount === 0) blockers.push('At least one risk must be documented before approval.');
  if (!input.hasPendingApprovalRequest) blockers.push('No approval request is pending for this plan version.');
  return { ok: blockers.length === 0, blockers };
}

export function recordApprovalDecision(
  approval: ApprovalRecord,
  decision: Exclude<ApprovalStatus, 'PENDING'>,
  comment: string | undefined,
  respondedAt: string
): ApprovalRecord {
  if (approval.status !== 'PENDING') {
    throw new Error(`Approval ${approval.id} has already been responded to (${approval.status}).`);
  }
  return { ...approval, status: decision, comment, respondedAt };
}

/**
 * Maps an approver's decision to the resulting plan version status.
 * A rejection routes back to Changes Requested rather than a terminal
 * state, so the transition owner always has a path to rework the plan.
 */
export function nextPlanStatusForDecision(decision: Exclude<ApprovalStatus, 'PENDING'>): PlanVersionStatus {
  switch (decision) {
    case 'APPROVED':
      return 'APPROVED';
    case 'CHANGES_REQUESTED':
    case 'REJECTED':
      return 'CHANGES_REQUESTED';
  }
}

/**
 * An artifact can never claim a plan is Approved unless the plan's actual
 * status is Approved. Draft artifacts remain generatable at any time but
 * must be clearly labeled Draft.
 */
export function assertArtifactGenerationAllowed(planStatus: PlanVersionStatus, claimingApproved: boolean): void {
  if (claimingApproved && planStatus !== 'APPROVED') {
    throw new Error(
      `Cannot generate an artifact representing this plan as Approved: plan version status is ${planStatus}.`
    );
  }
}
