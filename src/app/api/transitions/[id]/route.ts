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
        classification: true,
        documents: { orderBy: { uploadedAt: 'desc' }, include: { uploadedBy: { select: { name: true } } } },
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
      salesforceOpportunityUrl: transition.salesforceOpportunityUrl,
      salesTransitionFolderUrl: transition.salesTransitionFolderUrl,
      planType: transition.planType,
      status: transition.status,
      productsInScope: JSON.parse(transition.productsInScope),
      engagementDirectorName: transition.engagementDirectorName,
      salesLeadName: transition.salesLeadName,
      executiveSponsorName: transition.executiveSponsorName,
      currentPlanVersionId: transition.currentPlanVersionId,
      documents: transition.documents.map((d) => ({
        id: d.id,
        source: d.source,
        filename: d.filename,
        sharepointUrl: d.sharepointUrl,
        uploadedByName: d.uploadedBy.name,
        uploadedAt: d.uploadedAt,
      })),
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
