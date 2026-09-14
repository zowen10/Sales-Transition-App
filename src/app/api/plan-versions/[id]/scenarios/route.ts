import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_GENERATE_PLAN, requireRole } from '@/lib/rbac';
import { scenarioAdjustmentSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { runEstimation } from '@/domain/estimation/engine';
import { buildChildVersionDraft, compareScenarios } from '@/domain/versioning/service';
import type { EstimationInput } from '@/domain/estimation/types';
import type { PlanVersionSummary } from '@/domain/versioning/types';
import { recordAuditEvent } from '@/lib/audit';

function diffScalarInputs(base: EstimationInput, merged: EstimationInput): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const scalarKeys: (keyof EstimationInput)[] = ['startDate', 'ratePerHour', 'contingencyPercent', 'holidayMode', 'holidayReductionPercent'];
  for (const key of scalarKeys) {
    if (JSON.stringify(base[key]) !== JSON.stringify(merged[key])) diff[key] = { from: base[key], to: merged[key] };
  }
  base.phases.forEach((p, i) => {
    if (p.durationWeeks !== merged.phases[i]?.durationWeeks) {
      diff[`phase.${p.id}.durationWeeks`] = { from: p.durationWeeks, to: merged.phases[i]?.durationWeeks };
    }
  });
  for (const key of Object.keys({ ...base.phaseAdjustments, ...merged.phaseAdjustments })) {
    if ((base.phaseAdjustments[key] ?? 1) !== (merged.phaseAdjustments[key] ?? 1)) {
      diff[`phaseAdjustment.${key}`] = { from: base.phaseAdjustments[key] ?? 1, to: merged.phaseAdjustments[key] ?? 1 };
    }
  }
  for (const key of Object.keys({ ...base.productAdjustments, ...merged.productAdjustments })) {
    if ((base.productAdjustments[key] ?? 1) !== (merged.productAdjustments[key] ?? 1)) {
      diff[`productAdjustment.${key}`] = { from: base.productAdjustments[key] ?? 1, to: merged.productAdjustments[key] ?? 1 };
    }
  }
  for (const key of Object.keys({ ...base.resourceGroupMultipliers, ...merged.resourceGroupMultipliers })) {
    if ((base.resourceGroupMultipliers[key] ?? 1) !== (merged.resourceGroupMultipliers[key] ?? 1)) {
      diff[`resourceGroupMultiplier.${key}`] = { from: base.resourceGroupMultipliers[key] ?? 1, to: merged.resourceGroupMultipliers[key] ?? 1 };
    }
  }
  return diff;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_GENERATE_PLAN);
    const overrides = scenarioAdjustmentSchema.parse(await req.json());

    const parent = await db.planVersion.findUnique({
      where: { id: params.id },
      include: { risks: true, transition: { include: { planVersions: { select: { versionNumber: true } } } } },
    });
    if (!parent) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });

    const baseline: EstimationInput = JSON.parse(parent.inputSnapshot);
    const merged: EstimationInput = {
      ...baseline,
      startDate: overrides.startDate ?? baseline.startDate,
      ratePerHour: overrides.ratePerHour ?? baseline.ratePerHour,
      contingencyPercent: overrides.contingencyPercent ?? baseline.contingencyPercent,
      holidayMode: overrides.holidayMode ?? baseline.holidayMode,
      holidayReductionPercent: overrides.holidayReductionPercent ?? baseline.holidayReductionPercent,
      phases: baseline.phases.map((p) => ({ ...p, durationWeeks: overrides.phaseDurationWeeks?.[p.id] ?? p.durationWeeks })),
      phaseAdjustments: { ...baseline.phaseAdjustments, ...overrides.phaseAdjustments },
      productAdjustments: { ...baseline.productAdjustments, ...overrides.productAdjustments },
      resourceGroupMultipliers: { ...baseline.resourceGroupMultipliers, ...overrides.resourceGroupMultipliers },
      overrides: { ...baseline.overrides, ...overrides.overrides },
    };
    const result = runEstimation(merged);
    const changedInputs = diffScalarInputs(baseline, merged);

    const draft = buildChildVersionDraft(
      { id: parent.id, transitionId: parent.transitionId },
      parent.transition.planVersions.map((v) => v.versionNumber),
      overrides.scenarioName
    );

    const scenario = await db.$transaction(async (tx) => {
      const pv = await tx.planVersion.create({
        data: {
          transitionId: draft.transitionId,
          parentVersionId: draft.parentVersionId,
          versionNumber: draft.versionNumber,
          scenarioName: draft.scenarioName,
          status: draft.status,
          planType: parent.planType,
          primaryTemplateId: parent.primaryTemplateId,
          templateSnapshot: parent.templateSnapshot,
          inputSnapshot: JSON.stringify(merged),
          calculationSnapshot: JSON.stringify(result),
          recommended: false,
          createdById: user.id,
        },
      });

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
      // Scenarios inherit the parent's assumptions/risks/decisions as a starting point.
      if (parent.risks.length) {
        await tx.risk.createMany({
          data: parent.risks.map((r) => ({ planVersionId: pv.id, description: r.description, ownerId: r.ownerId, status: r.status, impact: r.impact, source: r.source })),
        });
      }

      return pv;
    });

    const parentSummary: PlanVersionSummary = {
      id: parent.id,
      transitionId: parent.transitionId,
      versionNumber: parent.versionNumber,
      parentVersionId: parent.parentVersionId,
      scenarioName: parent.scenarioName,
      status: parent.status as PlanVersionSummary['status'],
      recommended: parent.recommended,
      totalHours: JSON.parse(parent.calculationSnapshot).totalHours,
      totalInvestment: JSON.parse(parent.calculationSnapshot).totalInvestment,
      calendarWeeks: JSON.parse(parent.calculationSnapshot).calendarWeeks,
      peakWeeklyBurnHours: JSON.parse(parent.calculationSnapshot).peakWeeklyBurnHours,
      risks: parent.risks.map((r) => ({ id: r.id, description: r.description })),
      createdAt: parent.createdAt.toISOString(),
    };
    const scenarioSummary: PlanVersionSummary = {
      id: scenario.id,
      transitionId: scenario.transitionId,
      versionNumber: scenario.versionNumber,
      parentVersionId: scenario.parentVersionId,
      scenarioName: scenario.scenarioName,
      status: scenario.status as PlanVersionSummary['status'],
      recommended: scenario.recommended,
      totalHours: result.totalHours,
      totalInvestment: result.totalInvestment,
      calendarWeeks: result.calendarWeeks,
      peakWeeklyBurnHours: result.peakWeeklyBurnHours,
      risks: parent.risks.map((r) => ({ id: r.id, description: r.description })),
      createdAt: scenario.createdAt.toISOString(),
    };
    const comparison = compareScenarios(parentSummary, scenarioSummary, changedInputs, user.name);

    await recordAuditEvent({
      transitionId: parent.transitionId,
      actorId: user.id,
      action: 'scenario.created',
      entityType: 'PlanVersion',
      entityId: scenario.id,
      details: { parentVersionId: parent.id, scenarioName: overrides.scenarioName },
    });

    return NextResponse.json({ planVersionId: scenario.id, result, comparison }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
