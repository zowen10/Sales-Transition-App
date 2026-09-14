import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_EDIT_INTAKE, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { classifyTransition } from '@/domain/classification/service';
import { loadAnswerMap } from '@/server/intakeAnswers';
import { recordAuditEvent } from '@/lib/audit';
import { getFlowBuilderAdapter } from '@/adapters/flowbuilder';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_EDIT_INTAKE);

    const transition = await db.transition.findUnique({ where: { id: params.id } });
    if (!transition) return NextResponse.json({ error: 'Transition not found' }, { status: 404 });

    const { answers } = await loadAnswerMap(params.id);
    const result = classifyTransition(answers);

    const saved = await db.classification.upsert({
      where: { transitionId: params.id },
      update: {
        planType: result.planType.toUpperCase(),
        productMix: JSON.stringify(result.productMix),
        siteProfile: JSON.stringify(result.siteProfile),
        complexityLevel: result.complexityLevel,
        integrationProfile: JSON.stringify(result.integrationProfile),
        extensionProfile: JSON.stringify(result.extensionProfile),
        dataReadinessProfile: JSON.stringify(result.dataReadinessProfile),
        timelinePressure: result.timelinePressure,
        commercialModel: result.commercialModel,
        confidenceLevel: result.confidenceLevel,
        reasons: JSON.stringify(result.reasons),
      },
      create: {
        transitionId: params.id,
        planType: result.planType.toUpperCase(),
        productMix: JSON.stringify(result.productMix),
        siteProfile: JSON.stringify(result.siteProfile),
        complexityLevel: result.complexityLevel,
        integrationProfile: JSON.stringify(result.integrationProfile),
        extensionProfile: JSON.stringify(result.extensionProfile),
        dataReadinessProfile: JSON.stringify(result.dataReadinessProfile),
        timelinePressure: result.timelinePressure,
        commercialModel: result.commercialModel,
        confidenceLevel: result.confidenceLevel,
        reasons: JSON.stringify(result.reasons),
      },
    });

    if (transition.status === 'INTAKE_IN_PROGRESS' || transition.status === 'DRAFT') {
      await db.transition.update({ where: { id: params.id }, data: { status: 'CLASSIFIED' } });
    }

    await recordAuditEvent({
      transitionId: params.id,
      actorId: user.id,
      action: 'classification.updated',
      entityType: 'Classification',
      entityId: saved.id,
    });

    await getFlowBuilderAdapter().publish({
      type: 'intake.completed',
      transitionId: params.id,
      occurredAt: new Date().toISOString(),
      payload: { complexityLevel: result.complexityLevel },
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
