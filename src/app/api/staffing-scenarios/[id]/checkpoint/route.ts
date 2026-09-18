import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { checkpointStaffingScenarioSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { computeActualsAsOf } from '@/domain/issueAnalysis/metrics';
import type { IssueRecordLike } from '@/domain/issueAnalysis/types';
import { compareForecastToActuals } from '@/domain/staffingModel/variance';
import { workdayOffset } from '@/domain/staffingModel/dates';
import type { ScenarioInput, SimulationResult } from '@/domain/staffingModel/types';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Loads actuals from a confirmed issue import into an existing plan: compares
 * what's actually known as of a date against the current version's forecast,
 * and records the comparison as a new checkpoint version. This does NOT
 * change the forecast itself — it's the plan's answer to "how are we
 * actually doing," with the answer visible in that version's history entry.
 * Re-deriving levers or adjusting them by hand from here is a separate,
 * deliberate action via the existing Recalculate flow.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = checkpointStaffingScenarioSchema.parse(await req.json());

    const scenario = await db.staffingScenario.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    const current = scenario.versions[0];
    if (!current) return NextResponse.json({ error: 'This plan has no version to checkpoint against yet.' }, { status: 409 });

    const batch = await db.issueImportBatch.findUnique({
      where: { id: body.actualsImportBatchId },
      include: { records: true },
    });
    if (!batch) return NextResponse.json({ error: 'Actuals import not found' }, { status: 404 });
    if (!batch.confirmedMapping) {
      return NextResponse.json({ error: 'Column mapping has not been confirmed for this import yet.' }, { status: 409 });
    }

    const records: IssueRecordLike[] = batch.records.map((r) => ({
      id: r.id,
      externalId: r.externalId,
      issueType: r.issueType,
      priority: r.priority,
      status: r.status,
      createdDate: r.createdDate?.toISOString() ?? null,
      resolvedDate: r.resolvedDate?.toISOString() ?? null,
      reopenedCount: r.reopenedCount,
      blockedTestCaseCount: r.blockedTestCaseCount,
    }));

    const scenarioInput = JSON.parse(current.scenarioInput) as Omit<ScenarioInput, 'levers'>;
    const asOfDay = workdayOffset(scenarioInput.planStartDate, body.asOfDate);
    const actuals = computeActualsAsOf(records, body.asOfDate);
    const forecast = JSON.parse(current.resultSnapshot) as SimulationResult;
    const variance = compareForecastToActuals(forecast, {
      asOfDay,
      openBacklog: actuals.openBacklog,
      resolvedIssuesCumulative: actuals.resolvedIssuesCumulative,
    });

    const nextVersionNumber = current.versionNumber + 1;
    const checkpointVersion = await db.$transaction(async (tx) => {
      const created = await tx.staffingScenarioVersion.create({
        data: {
          scenarioId: scenario.id,
          parentVersionId: current.id,
          versionNumber: nextVersionNumber,
          label: current.label,
          leverConfig: current.leverConfig,
          scenarioInput: current.scenarioInput,
          resourcePlanOverrides: current.resourcePlanOverrides,
          resultSnapshot: current.resultSnapshot,
          derivedFrom: current.derivedFrom,
          checkpointDate: new Date(body.asOfDate),
          actualsImportBatchId: batch.id,
          varianceSummary: JSON.stringify(variance),
          createdById: user.id,
        },
      });
      await tx.staffingScenario.update({ where: { id: scenario.id }, data: { currentVersionId: created.id } });
      return created;
    });

    await recordAuditEvent({
      transitionId: scenario.transitionId ?? undefined,
      actorId: user.id,
      action: 'staffing_scenario.checkpoint',
      entityType: 'StaffingScenarioVersion',
      entityId: checkpointVersion.id,
      details: { asOfDate: body.asOfDate, actualsImportBatchId: batch.id, variance },
    });

    return NextResponse.json({ versionId: checkpointVersion.id, versionNumber: nextVersionNumber, variance }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
