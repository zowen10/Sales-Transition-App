import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { simulateStaffingScenarioSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { runIssueBurnSimulation, solveRequiredFtes } from '@/domain/staffingModel/engine';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Re-runs the deterministic engine against an edited lever configuration and
 * saves the result as a new child version of the plan — a plain manual edit,
 * as opposed to a checkpoint (see the checkpoint route, added in a later
 * phase) which additionally carries actuals/variance.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = simulateStaffingScenarioSchema.parse(await req.json());

    const scenario = await db.staffingScenario.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const parent = scenario.versions[0];
    const nextVersionNumber = (parent?.versionNumber ?? 0) + 1;
    const result = runIssueBurnSimulation(body.scenarioInput);
    const sensitivity = solveRequiredFtes(body.scenarioInput);

    const version = await db.$transaction(async (tx) => {
      const created = await tx.staffingScenarioVersion.create({
        data: {
          scenarioId: scenario.id,
          parentVersionId: parent?.id,
          versionNumber: nextVersionNumber,
          label: body.label ?? parent?.label ?? 'Baseline',
          leverConfig: JSON.stringify(body.scenarioInput.levers),
          scenarioInput: JSON.stringify({
            planStartDate: body.scenarioInput.planStartDate,
            totalTestCases: body.scenarioInput.totalTestCases,
            startingIssues: body.scenarioInput.startingIssues,
            targetWorkday: body.scenarioInput.targetWorkday,
          }),
          resourcePlanOverrides: body.resourcePlanOverrides ? JSON.stringify(body.resourcePlanOverrides) : undefined,
          resultSnapshot: JSON.stringify(result),
          createdById: user.id,
        },
      });
      await tx.staffingScenario.update({ where: { id: scenario.id }, data: { currentVersionId: created.id } });
      return created;
    });

    await recordAuditEvent({
      transitionId: scenario.transitionId ?? undefined,
      actorId: user.id,
      action: 'staffing_scenario.simulated',
      entityType: 'StaffingScenarioVersion',
      entityId: version.id,
      details: { versionNumber: nextVersionNumber, clearDay: result.clearDay },
    });

    return NextResponse.json({ versionId: version.id, versionNumber: nextVersionNumber, result, sensitivity }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
