import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_GENERATE_PLAN, requireRole } from '@/lib/rbac';
import { updateInPlaceSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { runEstimation } from '@/domain/estimation/engine';
import { assertVersionIsEditable } from '@/domain/versioning/service';
import { recordAuditEvent } from '@/lib/audit';
import type { EstimationInput } from '@/domain/estimation/types';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const pv = await db.planVersion.findUnique({
      where: { id: params.id },
      include: {
        transition: { select: { id: true, name: true, status: true } },
        primaryTemplate: { select: { id: true, name: true, version: true, status: true } },
        assumptions: true,
        risks: true,
        decisions: true,
        approvals: { include: { approver: { select: { id: true, name: true } } } },
        artifactJobs: true,
      },
    });
    if (!pv) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });

    const templateRow = await db.template.findUnique({ where: { id: pv.primaryTemplateId } });

    return NextResponse.json({
      id: pv.id,
      transitionId: pv.transitionId,
      transitionName: pv.transition.name,
      versionNumber: pv.versionNumber,
      parentVersionId: pv.parentVersionId,
      scenarioName: pv.scenarioName,
      status: pv.status,
      recommended: pv.recommended,
      template: pv.primaryTemplate,
      templateBody: templateRow ? JSON.parse(templateRow.body) : null,
      inputSnapshot: JSON.parse(pv.inputSnapshot),
      result: JSON.parse(pv.calculationSnapshot),
      assumptions: pv.assumptions,
      risks: pv.risks,
      decisions: pv.decisions,
      approvals: pv.approvals,
      artifactJobs: pv.artifactJobs,
      approvedAt: pv.approvedAt,
      approvedBy: pv.approvedBy,
      createdAt: pv.createdAt,
      updatedAt: pv.updatedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_GENERATE_PLAN);
    const overrides = updateInPlaceSchema.parse(await req.json());

    const pv = await db.planVersion.findUnique({ where: { id: params.id } });
    if (!pv) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
    assertVersionIsEditable(pv.status as 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'SUPERSEDED' | 'ARCHIVED');

    const baseline: EstimationInput = JSON.parse(pv.inputSnapshot);
    const merged: EstimationInput = {
      ...baseline,
      startDate: overrides.startDate ?? baseline.startDate,
      ratePerHour: overrides.ratePerHour ?? baseline.ratePerHour,
      contingencyPercent: overrides.contingencyPercent ?? baseline.contingencyPercent,
      holidayMode: overrides.holidayMode ?? baseline.holidayMode,
      holidayReductionPercent: overrides.holidayReductionPercent ?? baseline.holidayReductionPercent,
      phases: baseline.phases.map((p) => ({
        ...p,
        durationWeeks: overrides.phaseDurationWeeks?.[p.id] ?? p.durationWeeks,
      })),
      phaseAdjustments: { ...baseline.phaseAdjustments, ...overrides.phaseAdjustments },
      productAdjustments: { ...baseline.productAdjustments, ...overrides.productAdjustments },
      resourceGroupMultipliers: { ...baseline.resourceGroupMultipliers, ...overrides.resourceGroupMultipliers },
      overrides: { ...baseline.overrides, ...overrides.overrides },
    };

    const result = runEstimation(merged);

    await db.$transaction(async (tx) => {
      await tx.phase.deleteMany({ where: { planVersionId: pv.id } });
      await tx.roleAllocation.deleteMany({ where: { planVersionId: pv.id } });

      await tx.phase.createMany({
        data: result.phases.map((p, i) => ({
          planVersionId: pv.id,
          phaseType: p.id,
          name: p.name,
          sequence: i + 1,
          durationWeeks: p.durationWeeks,
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
          hours: p.hours,
          investment: p.investment,
        })),
      });
      await tx.roleAllocation.createMany({
        data: result.roles.map((r) => ({
          planVersionId: pv.id,
          roleName: r.name,
          resourceGroup: r.resourceGroup,
          productWorkstream: r.product,
          totalHours: r.totalHours,
          weeklyHours: JSON.stringify(r.weeklyHours),
          source: r.overriddenWorkIndexes.length ? 'manual_override' : 'template',
        })),
      });

      await tx.planVersion.update({
        where: { id: pv.id },
        data: {
          inputSnapshot: JSON.stringify(merged),
          calculationSnapshot: JSON.stringify(result),
          status: pv.status === 'DRAFT' ? 'IN_PROGRESS' : pv.status,
        },
      });
    });

    await recordAuditEvent({
      transitionId: pv.transitionId,
      actorId: user.id,
      action: 'plan.recalculated',
      entityType: 'PlanVersion',
      entityId: pv.id,
      details: { changedFields: Object.keys(overrides) },
    });

    return NextResponse.json({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
