export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

export interface ApprovalRecord {
  id: string;
  planVersionId: string;
  /** Unset until someone actually acts on the request — access is enforced by role, not a pre-bound login. */
  approverId?: string | null;
  approverRole: string;
  status: ApprovalStatus;
  comment?: string;
  requestedAt: string;
  respondedAt?: string;
}

export interface SubmissionCheck {
  ok: boolean;
  blockers: string[];
}
