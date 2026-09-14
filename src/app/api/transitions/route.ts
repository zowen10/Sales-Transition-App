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
        planVersions: { select: { id: true, status: true, versionNumber: true, recommended: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(
      transitions.map((t) => ({
        id: t.id,
        name: t.name,
        clientName: t.client.name,
        salesforceOpportunityUrl: t.salesforceOpportunityUrl,
        planType: t.planType,
        status: t.status,
        ownerName: t.engagementDirectorName,
        sponsorName: t.executiveSponsorName,
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

    if (body.salesforceOpportunityUrl) {
      const duplicate = await db.transition.findFirst({ where: { salesforceOpportunityUrl: body.salesforceOpportunityUrl } });
      if (duplicate) {
        return NextResponse.json(
          { error: `A project already exists for this Salesforce opportunity: "${duplicate.name}".`, duplicateTransitionId: duplicate.id },
          { status: 409 }
        );
      }
    }

    const transition = await db.transition.create({
      data: {
        clientId: client.id,
        salesforceOpportunityUrl: body.salesforceOpportunityUrl,
        name: body.name,
        engagementDirectorName: body.engagementDirectorName,
        salesLeadName: body.salesLeadName,
        executiveSponsorName: body.executiveSponsorName,
        salesTransitionFolderUrl: body.salesTransitionFolderUrl,
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
