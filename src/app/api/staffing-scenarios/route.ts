import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { createStaffingScenarioSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { runIssueBurnSimulation, solveRequiredFtes } from '@/domain/staffingModel/engine';
import { recordAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    await requireCurrentUser();
    const scenarios = await db.staffingScenario.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { createdBy: { select: { name: true } }, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    return NextResponse.json({
      scenarios: scenarios.map((s) => {
        const latest = s.versions[0];
        const result = latest ? JSON.parse(latest.resultSnapshot) : null;
        return {
          id: s.id,
          name: s.name,
          status: s.status,
          createdByName: s.createdBy.name,
          updatedAt: s.updatedAt.toISOString(),
          latestVersionNumber: latest?.versionNumber ?? null,
          clearDay: result?.clearDay ?? null,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = createStaffingScenarioSchema.parse(await req.json());

    const result = runIssueBurnSimulation(body.scenarioInput);
    const sensitivity = solveRequiredFtes(body.scenarioInput);

    const scenario = await db.$transaction(async (tx) => {
      const created = await tx.staffingScenario.create({
        data: {
          name: body.name,
          clientId: body.clientId,
          transitionId: body.transitionId,
          createdById: user.id,
        },
      });
      const version = await tx.staffingScenarioVersion.create({
        data: {
          scenarioId: created.id,
          versionNumber: 1,
          label: body.label,
          leverConfig: JSON.stringify(body.scenarioInput.levers),
          scenarioInput: JSON.stringify({
            planStartDate: body.scenarioInput.planStartDate,
            totalTestCases: body.scenarioInput.totalTestCases,
            startingIssues: body.scenarioInput.startingIssues,
            targetWorkday: body.scenarioInput.targetWorkday,
          }),
          resultSnapshot: JSON.stringify(result),
          createdById: user.id,
        },
      });
      await tx.staffingScenario.update({ where: { id: created.id }, data: { currentVersionId: version.id } });
      return { scenario: created, version };
    });

    await recordAuditEvent({
      transitionId: body.transitionId,
      actorId: user.id,
      action: 'staffing_scenario.created',
      entityType: 'StaffingScenario',
      entityId: scenario.scenario.id,
      details: { name: body.name },
    });

    return NextResponse.json({ scenarioId: scenario.scenario.id, versionId: scenario.version.id, result, sensitivity }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
