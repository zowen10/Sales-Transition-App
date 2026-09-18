import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { updateStaffingScenarioSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { recordAuditEvent } from '@/lib/audit';
import { solveRequiredFtes } from '@/domain/staffingModel/engine';
import type { LeverConfig } from '@/domain/staffingModel/types';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const scenario = await db.staffingScenario.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const current = scenario.versions.find((v) => v.id === scenario.currentVersionId) ?? scenario.versions[0];
    const sensitivity = current
      ? solveRequiredFtes({
          ...(JSON.parse(current.scenarioInput) as { totalTestCases: number; startingIssues: number; targetWorkday: number }),
          levers: JSON.parse(current.leverConfig) as LeverConfig,
        })
      : null;

    return NextResponse.json({
      id: scenario.id,
      name: scenario.name,
      status: scenario.status,
      clientId: scenario.clientId,
      transitionId: scenario.transitionId,
      currentVersion: current
        ? {
            id: current.id,
            versionNumber: current.versionNumber,
            label: current.label,
            leverConfig: JSON.parse(current.leverConfig),
            scenarioInput: JSON.parse(current.scenarioInput),
            result: JSON.parse(current.resultSnapshot),
            checkpointDate: current.checkpointDate?.toISOString() ?? null,
            varianceSummary: current.varianceSummary ? JSON.parse(current.varianceSummary) : null,
            createdAt: current.createdAt.toISOString(),
          }
        : null,
      sensitivity,
      versions: scenario.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        label: v.label,
        parentVersionId: v.parentVersionId,
        checkpointDate: v.checkpointDate?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = updateStaffingScenarioSchema.parse(await req.json());

    const scenario = await db.staffingScenario.findUnique({ where: { id: params.id } });
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const updated = await db.staffingScenario.update({
      where: { id: params.id },
      data: { name: body.name, status: body.status },
    });

    await recordAuditEvent({
      transitionId: scenario.transitionId ?? undefined,
      actorId: user.id,
      action: 'staffing_scenario.updated',
      entityType: 'StaffingScenario',
      entityId: updated.id,
      details: body,
    });

    return NextResponse.json({ id: updated.id, name: updated.name, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}
