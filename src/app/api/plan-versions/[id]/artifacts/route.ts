import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_GENERATE_ARTIFACTS, requireRole } from '@/lib/rbac';
import { artifactRequestSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { assertArtifactGenerationAllowed } from '@/domain/approval/service';
import { buildDraftSow, buildKickoffPackage, buildSalesTransitionBrief, buildSdsStarterPackage } from '@/domain/artifacts/documents';
import { buildBurnPlanWorkbook } from '@/domain/artifacts/excelWorkbook';
import type { ArtifactContext, ArtifactMetadata } from '@/domain/artifacts/types';
import type { ClassificationResult } from '@/domain/classification/types';
import { saveArtifactFile } from '@/server/artifactStorage';
import { recordAuditEvent } from '@/lib/audit';
import { getFlowBuilderAdapter } from '@/adapters/flowbuilder';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const jobs = await db.artifactJob.findMany({ where: { planVersionId: params.id }, orderBy: { requestedAt: 'desc' } });
    return NextResponse.json(jobs);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_GENERATE_ARTIFACTS);
    const body = artifactRequestSchema.parse(await req.json());

    const pv = await db.planVersion.findUnique({
      where: { id: params.id },
      include: {
        transition: { include: { client: true } },
        primaryTemplate: true,
        assumptions: true,
        risks: true,
        decisions: true,
      },
    });
    if (!pv) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });

    const claimingApproved = body.artifactType === 'APPROVED_BURN_PLAN';
    assertArtifactGenerationAllowed(pv.status as 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'SUPERSEDED' | 'ARCHIVED', claimingApproved);

    const job = await db.artifactJob.create({
      data: {
        planVersionId: pv.id,
        artifactType: body.artifactType,
        templateVersion: String(pv.primaryTemplate.version),
        status: 'RUNNING',
        requestedById: user.id,
      },
    });

    const classificationRow = await db.classification.findUnique({ where: { transitionId: pv.transitionId } });

    const metadata: ArtifactMetadata = {
      transitionId: pv.transitionId,
      transitionName: pv.transition.name,
      planVersionId: pv.id,
      planVersionLabel: `v${pv.versionNumber} — ${pv.scenarioName}`,
      generatedAt: new Date().toISOString(),
      status: pv.status === 'APPROVED' ? 'Approved' : 'Draft',
      templateName: pv.primaryTemplate.name,
      templateVersion: pv.primaryTemplate.version,
      preparedBy: user.name,
    };

    const context: ArtifactContext = {
      metadata,
      transition: {
        clientName: pv.transition.client.name,
        salesforceOpportunityUrl: pv.transition.salesforceOpportunityUrl,
        planType: pv.transition.planType,
        productsInScope: JSON.parse(pv.transition.productsInScope),
        ownerName: pv.transition.engagementDirectorName,
        salesLeadName: pv.transition.salesLeadName,
        sponsorName: pv.transition.executiveSponsorName,
      },
      classification: classificationRow
        ? ({
            planType: classificationRow.planType,
            productMix: JSON.parse(classificationRow.productMix),
            siteProfile: JSON.parse(classificationRow.siteProfile),
            complexityLevel: classificationRow.complexityLevel,
            integrationProfile: JSON.parse(classificationRow.integrationProfile),
            extensionProfile: JSON.parse(classificationRow.extensionProfile),
            dataReadinessProfile: JSON.parse(classificationRow.dataReadinessProfile),
            timelinePressure: classificationRow.timelinePressure,
            commercialModel: classificationRow.commercialModel,
            confidenceLevel: classificationRow.confidenceLevel,
            reasons: JSON.parse(classificationRow.reasons),
          } as unknown as ClassificationResult)
        : null,
      result: JSON.parse(pv.calculationSnapshot),
      assumptions: pv.assumptions,
      risks: pv.risks,
      decisions: pv.decisions,
    };

    try {
      let fileReference: string;
      let filename: string;
      switch (body.artifactType) {
        case 'SALES_TRANSITION_BRIEF':
          filename = 'sales-transition-brief.md';
          fileReference = await saveArtifactFile(job.id, filename, buildSalesTransitionBrief(context));
          break;
        case 'SDS_STARTER_PACKAGE':
          filename = 'sds-starter-package.md';
          fileReference = await saveArtifactFile(job.id, filename, buildSdsStarterPackage(context));
          break;
        case 'DRAFT_SOW':
          filename = 'draft-sow.md';
          fileReference = await saveArtifactFile(job.id, filename, buildDraftSow(context));
          break;
        case 'KICKOFF_PACKAGE':
          filename = 'kickoff-package.md';
          fileReference = await saveArtifactFile(job.id, filename, buildKickoffPackage(context));
          break;
        case 'APPROVED_BURN_PLAN': {
          filename = 'approved-burn-plan.xlsx';
          const wb = buildBurnPlanWorkbook(context);
          const buf = Buffer.from(await wb.xlsx.writeBuffer());
          fileReference = await saveArtifactFile(job.id, filename, buf);
          break;
        }
        default:
          throw new Error(`Unsupported artifact type ${body.artifactType}`);
      }

      const completed = await db.artifactJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETE',
          fileReference,
          metadata: JSON.stringify(metadata),
          completedAt: new Date(),
        },
      });

      await recordAuditEvent({
        transitionId: pv.transitionId,
        actorId: user.id,
        action: 'artifact.generated',
        entityType: 'ArtifactJob',
        entityId: job.id,
        details: { artifactType: body.artifactType, status: metadata.status },
      });

      await getFlowBuilderAdapter().publish({
        type: 'artifacts.generated',
        transitionId: pv.transitionId,
        planVersionId: pv.id,
        occurredAt: new Date().toISOString(),
        payload: { artifactType: body.artifactType, jobId: job.id },
      });

      return NextResponse.json(completed, { status: 201 });
    } catch (genErr) {
      await db.artifactJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: genErr instanceof Error ? genErr.message : 'Unknown error' },
      });
      throw genErr;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
