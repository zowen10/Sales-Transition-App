import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_APPROVE, requireRole } from '@/lib/rbac';
import { approvalDecisionSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { checkPlanReadyForApproval, nextPlanStatusForDecision, recordApprovalDecision } from '@/domain/approval/service';
import { assertPlanVersionTransition } from '@/domain/versioning/stateMachine';
import { recordAuditEvent } from '@/lib/audit';
import { getFlowBuilderAdapter } from '@/adapters/flowbuilder';
import type { ApprovalStatus } from '@/domain/approval/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_APPROVE);
    const body = approvalDecisionSchema.parse(await req.json());

    const pv = await db.planVersion.findUnique({
      where: { id: params.id },
      include: { approvals: true, assumptions: true, risks: true },
    });
    if (!pv) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });

    // Any signed-in user with approval access (enforced above by requireRole) may act on a
    // pending request — there is no pre-bound approver identity at this stage; the acting
    // user is recorded as the approver below.
    const pendingApproval = pv.approvals.find((a) => a.status === 'PENDING');
    if (!pendingApproval) {
      return NextResponse.json({ error: 'No pending approval request found on this plan version.' }, { status: 403 });
    }

    const check = checkPlanReadyForApproval({
      assumptionsCount: pv.assumptions.length,
      risksCount: pv.risks.length,
      hasPendingApprovalRequest: true,
    });
    if (!check.ok) return NextResponse.json({ error: 'Plan is not ready for approval', blockers: check.blockers }, { status: 400 });

    const decided = recordApprovalDecision(
      {
        id: pendingApproval.id,
        planVersionId: pendingApproval.planVersionId,
        approverId: pendingApproval.approverId,
        approverRole: pendingApproval.approverRole,
        status: pendingApproval.status as ApprovalStatus,
        comment: pendingApproval.comment ?? undefined,
        requestedAt: pendingApproval.requestedAt.toISOString(),
      },
      body.decision,
      body.comment,
      new Date().toISOString()
    );

    const nextStatus = nextPlanStatusForDecision(body.decision);
    assertPlanVersionTransition(pv.status as 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'SUPERSEDED' | 'ARCHIVED', nextStatus);

    await db.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: pendingApproval.id },
        data: {
          status: decided.status,
          comment: decided.comment,
          respondedAt: new Date(decided.respondedAt!),
          approverId: user.id,
        },
      });

      await tx.planVersion.update({
        where: { id: pv.id },
        data: {
          status: nextStatus,
          approvedAt: nextStatus === 'APPROVED' ? new Date() : null,
          approvedBy: nextStatus === 'APPROVED' ? user.id : null,
        },
      });

      if (nextStatus === 'APPROVED') {
        const siblings = await tx.planVersion.findMany({
          where: { transitionId: pv.transitionId, status: 'APPROVED', id: { not: pv.id } },
        });
        for (const s of siblings) {
          await tx.planVersion.update({ where: { id: s.id }, data: { status: 'SUPERSEDED' } });
        }
        await tx.transition.update({
          where: { id: pv.transitionId },
          data: { status: 'APPROVED', currentPlanVersionId: pv.id },
        });
      } else {
        await tx.transition.update({ where: { id: pv.transitionId }, data: { status: 'PLAN_IN_PROGRESS' } });
      }
    });

    await recordAuditEvent({
      transitionId: pv.transitionId,
      actorId: user.id,
      action: 'plan.approval_decision',
      entityType: 'PlanVersion',
      entityId: pv.id,
      details: { decision: body.decision, comment: body.comment },
    });

    if (nextStatus === 'APPROVED') {
      await getFlowBuilderAdapter().publish({
        type: 'plan.approved',
        transitionId: pv.transitionId,
        planVersionId: pv.id,
        occurredAt: new Date().toISOString(),
        payload: { approverId: user.id },
      });
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (err) {
    return handleApiError(err);
  }
}
