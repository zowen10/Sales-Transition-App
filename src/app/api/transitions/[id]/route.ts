import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const transition = await db.transition.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        transitionOwner: { select: { id: true, name: true, email: true } },
        salesLead: { select: { id: true, name: true, email: true } },
        executiveSponsor: { select: { id: true, name: true, email: true } },
        classification: true,
        planVersions: {
          orderBy: { versionNumber: 'asc' },
          select: {
            id: true,
            versionNumber: true,
            parentVersionId: true,
            scenarioName: true,
            status: true,
            recommended: true,
            createdAt: true,
            calculationSnapshot: true,
          },
        },
      },
    });
    if (!transition) return NextResponse.json({ error: 'Transition not found' }, { status: 404 });

    return NextResponse.json({
      id: transition.id,
      name: transition.name,
      clientName: transition.client.name,
      opportunityId: transition.opportunityId,
      planType: transition.planType,
      status: transition.status,
      productsInScope: JSON.parse(transition.productsInScope),
      owner: transition.transitionOwner,
      salesLead: transition.salesLead,
      executiveSponsor: transition.executiveSponsor,
      expectedDecisionDate: transition.expectedDecisionDate,
      currentPlanVersionId: transition.currentPlanVersionId,
      classification: transition.classification
        ? {
            ...transition.classification,
            productMix: JSON.parse(transition.classification.productMix),
            siteProfile: JSON.parse(transition.classification.siteProfile),
            integrationProfile: JSON.parse(transition.classification.integrationProfile),
            extensionProfile: JSON.parse(transition.classification.extensionProfile),
            dataReadinessProfile: JSON.parse(transition.classification.dataReadinessProfile),
            reasons: JSON.parse(transition.classification.reasons),
          }
        : null,
      planVersions: transition.planVersions.map((pv) => {
        const snapshot = JSON.parse(pv.calculationSnapshot);
        return {
          id: pv.id,
          versionNumber: pv.versionNumber,
          parentVersionId: pv.parentVersionId,
          scenarioName: pv.scenarioName,
          status: pv.status,
          recommended: pv.recommended,
          createdAt: pv.createdAt,
          totalHours: snapshot.totalHours,
          totalInvestment: snapshot.totalInvestment,
          calendarWeeks: snapshot.calendarWeeks,
          peakWeeklyBurnHours: snapshot.peakWeeklyBurnHours,
        };
      }),
      updatedAt: transition.updatedAt,
      createdAt: transition.createdAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
