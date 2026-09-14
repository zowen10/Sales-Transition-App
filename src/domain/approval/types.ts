export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

export interface ApprovalRecord {
  id: string;
  planVersionId: string;
  approverId: string;
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
