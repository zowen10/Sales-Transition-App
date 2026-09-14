import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_GENERATE_PLAN, requireRole } from '@/lib/rbac';
import { createTransitionSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { recordAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    await requireCurrentUser();
    const transitions = await db.transition.findMany({
      include: {
        client: true,
        transitionOwner: { select: { id: true, name: true } },
        executiveSponsor: { select: { id: true, name: true } },
        planVersions: { select: { id: true, status: true, versionNumber: true, recommended: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(
      transitions.map((t) => ({
        id: t.id,
        name: t.name,
        clientName: t.client.name,
        opportunityId: t.opportunityId,
        planType: t.planType,
        status: t.status,
        ownerName: t.transitionOwner.name,
        sponsorName: t.executiveSponsor?.name ?? null,
        planVersionCount: t.planVersions.length,
        currentPlanVersionId: t.currentPlanVersionId,
        updatedAt: t.updatedAt,
      }))
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_GENERATE_PLAN);
    const body = createTransitionSchema.parse(await req.json());

    let client = await db.client.findFirst({ where: { name: body.clientName } });
    if (!client) client = await db.client.create({ data: { name: body.clientName } });

    if (body.opportunityId) {
      const duplicate = await db.transition.findFirst({ where: { opportunityId: body.opportunityId } });
      if (duplicate) {
        return NextResponse.json(
          { error: `A transition already exists for opportunity ${body.opportunityId}: "${duplicate.name}".`, duplicateTransitionId: duplicate.id },
          { status: 409 }
        );
      }
    }

    const transition = await db.transition.create({
      data: {
        clientId: client.id,
        opportunityId: body.opportunityId,
        name: body.name,
        transitionOwnerId: body.transitionOwnerId,
        salesLeadId: body.salesLeadId,
        executiveSponsorId: body.executiveSponsorId,
        expectedDecisionDate: body.expectedDecisionDate ? new Date(body.expectedDecisionDate) : null,
        planType: body.planType,
        status: 'DRAFT',
        productsInScope: JSON.stringify(body.productsInScope),
        createdBy: user.id,
      },
    });

    await recordAuditEvent({
      transitionId: transition.id,
      actorId: user.id,
      action: 'transition.created',
      entityType: 'Transition',
      entityId: transition.id,
    });

    return NextResponse.json(transition, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
