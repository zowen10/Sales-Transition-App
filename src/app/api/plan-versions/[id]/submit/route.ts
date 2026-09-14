import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_SUBMIT_FOR_REVIEW, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { checkPlanReadyForSubmission } from '@/domain/approval/service';
import { assertPlanVersionTransition } from '@/domain/versioning/stateMachine';
import { getApplicableQuestions, unresolvedHighImpactQuestions } from '@/domain/intake/service';
import { loadAnswerMap } from '@/server/intakeAnswers';
import { recordAuditEvent } from '@/lib/audit';
import { getFlowBuilderAdapter } from '@/adapters/flowbuilder';
import type { QuestionDefinition } from '@/domain/intake/types';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_SUBMIT_FOR_REVIEW);

    const pv = await db.planVersion.findUnique({
      where: { id: params.id },
      include: { transition: { include: { executiveSponsor: true } } },
    });
    if (!pv) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });

    const dbQuestions = await db.questionDefinition.findMany({ where: { active: true } });
    const questions: QuestionDefinition[] = dbQuestions.map((q) => ({
      id: q.id,
      key: q.key,
      section: q.section,
      prompt: q.prompt,
      helpText: q.helpText,
      responseType: q.responseType as QuestionDefinition['responseType'],
      options: q.options ? JSON.parse(q.options) : null,
      required: q.required,
      order: q.order,
      visibilityRule: q.visibilityRule ? JSON.parse(q.visibilityRule) : null,
      validationRule: q.validationRule ? JSON.parse(q.validationRule) : null,
      highImpact: q.highImpact,
      active: q.active,
    }));
    const { answers, confirmedKeys } = await loadAnswerMap(pv.transitionId);
    const unresolved = unresolvedHighImpactQuestions(questions, answers, confirmedKeys);

    const check = checkPlanReadyForSubmission({
      unconfirmedHighImpactAnswerPrompts: unresolved.map((q) => q.prompt),
      hasExecutiveApprover: Boolean(pv.transition.executiveSponsor),
    });
    if (!check.ok) return NextResponse.json({ error: 'Plan is not ready for submission', blockers: check.blockers }, { status: 400 });

    assertPlanVersionTransition(pv.status as 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'SUPERSEDED' | 'ARCHIVED', 'READY_FOR_REVIEW');

    const approval = await db.$transaction(async (tx) => {
      await tx.planVersion.update({ where: { id: pv.id }, data: { status: 'READY_FOR_REVIEW' } });
      await tx.transition.update({ where: { id: pv.transitionId }, data: { status: 'READY_FOR_REVIEW' } });
      return tx.approval.create({
        data: {
          planVersionId: pv.id,
          approverId: pv.transition.executiveSponsor!.id,
          approverRole: 'EXECUTIVE_APPROVER',
          status: 'PENDING',
        },
      });
    });

    await recordAuditEvent({
      transitionId: pv.transitionId,
      actorId: user.id,
      action: 'plan.submitted_for_approval',
      entityType: 'PlanVersion',
      entityId: pv.id,
      details: { approverId: approval.approverId },
    });

    await getFlowBuilderAdapter().publish({
      type: 'plan.submitted_for_approval',
      transitionId: pv.transitionId,
      planVersionId: pv.id,
      occurredAt: new Date().toISOString(),
      payload: { approverId: approval.approverId },
    });

    return NextResponse.json({ ok: true, approval });
  } catch (err) {
    return handleApiError(err);
  }
}
