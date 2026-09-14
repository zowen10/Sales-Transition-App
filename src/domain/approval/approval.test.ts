import { describe, expect, it } from 'vitest';
import {
  assertArtifactGenerationAllowed,
  checkPlanReadyForApproval,
  checkPlanReadyForSubmission,
  nextPlanStatusForDecision,
  recordApprovalDecision,
} from './service';
import type { ApprovalRecord } from './types';

describe('submission guard', () => {
  it('blocks submission when high-impact answers are unconfirmed or no approver is assigned', () => {
    const result = checkPlanReadyForSubmission({
      unconfirmedHighImpactAnswerPrompts: ['What is the plan type?'],
      hasExecutiveApprover: false,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers).toHaveLength(2);
  });

  it('allows submission once all required conditions are met', () => {
    const result = checkPlanReadyForSubmission({ unconfirmedHighImpactAnswerPrompts: [], hasExecutiveApprover: true });
    expect(result.ok).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});

describe('approval guard', () => {
  it('blocks approval when assumptions, risks, or a pending request are missing', () => {
    const result = checkPlanReadyForApproval({ assumptionsCount: 0, risksCount: 0, hasPendingApprovalRequest: false });
    expect(result.ok).toBe(false);
    expect(result.blockers).toHaveLength(3);
  });

  it('allows approval once assumptions, risks, and a pending request all exist', () => {
    const result = checkPlanReadyForApproval({ assumptionsCount: 2, risksCount: 1, hasPendingApprovalRequest: true });
    expect(result.ok).toBe(true);
  });
});

describe('approval decisions', () => {
  const pending: ApprovalRecord = {
    id: 'a1',
    planVersionId: 'pv1',
    approverId: 'u1',
    approverRole: 'EXECUTIVE_APPROVER',
    status: 'PENDING',
    requestedAt: '2027-01-01T00:00:00.000Z',
  };

  it('records an approval decision exactly once', () => {
    const decided = recordApprovalDecision(pending, 'APPROVED', 'Looks good.', '2027-01-02T00:00:00.000Z');
    expect(decided.status).toBe('APPROVED');
    expect(() => recordApprovalDecision(decided, 'APPROVED', undefined, '2027-01-03T00:00:00.000Z')).toThrow();
  });

  it('maps decisions to the resulting plan status, rejection routes back to Changes Requested', () => {
    expect(nextPlanStatusForDecision('APPROVED')).toBe('APPROVED');
    expect(nextPlanStatusForDecision('CHANGES_REQUESTED')).toBe('CHANGES_REQUESTED');
    expect(nextPlanStatusForDecision('REJECTED')).toBe('CHANGES_REQUESTED');
  });
});

describe('artifact approval-claim guard', () => {
  it('refuses to generate an artifact claiming Approved status unless the plan is actually approved', () => {
    expect(() => assertArtifactGenerationAllowed('READY_FOR_REVIEW', true)).toThrow();
    expect(() => assertArtifactGenerationAllowed('APPROVED', true)).not.toThrow();
    expect(() => assertArtifactGenerationAllowed('DRAFT', false)).not.toThrow();
  });
});
