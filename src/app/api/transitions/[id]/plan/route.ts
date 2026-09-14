import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_GENERATE_PLAN, requireRole } from '@/lib/rbac';
import { generatePlanSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { runEstimation } from '@/domain/estimation/engine';
import { buildEstimationInput, splitFreeText, type PlanTemplateBody } from '@/server/planGeneration';
import { assertTemplateUsableForGeneration } from '@/domain/templates/service';
import { loadAnswerMap } from '@/server/intakeAnswers';
import { recordAuditEvent } from '@/lib/audit';
import { getFlowBuilderAdapter } from '@/adapters/flowbuilder';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_GENERATE_PLAN);
    const body = generatePlanSchema.parse(await req.json().catch(() => ({})));

    const transition = await db.transition.findUnique({
      where: { id: params.id },
      include: { planVersions: { select: { versionNumber: true } } },
    });
    if (!transition) return NextResponse.json({ error: 'Transition not found' }, { status: 404 });

    const template = body.templateId
      ? await db.template.findUnique({ where: { id: body.templateId } })
      : await db.template.findFirst({
          where: {
            type: 'PLAN_TEMPLATE',
            status: 'PUBLISHED',
            applicablePlanTypes: { contains: transition.planType },
          },
          orderBy: { version: 'desc' },
        });
    if (!template) {
      return NextResponse.json({ error: 'No published plan template is applicable to this plan type.' }, { status: 404 });
    }
    assertTemplateUsableForGeneration(template.status as 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'RETIRED');

    const templateBody: PlanTemplateBody = JSON.parse(template.body);
    const estimationInput = buildEstimationInput(templateBody);
    const result = runEstimation(estimationInput);

    const versionNumber = transition.planVersions.length
      ? Math.max(...transition.planVersions.map((v) => v.versionNumber)) + 1
      : 1;

    const { answers } = await loadAnswerMap(params.id);

    const planVersion = await db.$transaction(async (tx) => {
      const pv = await tx.planVersion.create({
        data: {
          transitionId: params.id,
          versionNumber,
          scenarioName: body.scenarioName,
          status: 'DRAFT',
          planType: transition.planType,
          primaryTemplateId: template.id,
          templateSnapshot: JSON.stringify({ id: template.id, name: template.name, version: template.version }),
          inputSnapshot: JSON.stringify(estimationInput),
          calculationSnapshot: JSON.stringify(result),
          recommended: versionNumber === 1,
          createdById: user.id,
        },
      });

      await tx.phase.createMany({
        data: result.phases.map((p) => ({
          planVersionId: pv.id,
          phaseType: p.id,
          name: p.name,
          sequence: templateBody.phases.find((tp) => tp.id === p.id)?.sequence ?? 0,
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

      const assumptionTexts = splitFreeText(answers['risks.unvalidated_assumptions']);
      if (assumptionTexts.length) {
        await tx.assumption.createMany({
          data: assumptionTexts.map((description) => ({ planVersionId: pv.id, description, source: 'intake' })),
        });
      }
      const riskTexts = splitFreeText(answers['risks.known_risks']);
      if (riskTexts.length) {
        await tx.risk.createMany({
          data: riskTexts.map((description) => ({ planVersionId: pv.id, description, source: 'intake' })),
        });
      }
      const decisionTexts = splitFreeText(answers['risks.decisions_required']);
      if (decisionTexts.length) {
        await tx.decision.createMany({
          data: decisionTexts.map((description) => ({ planVersionId: pv.id, description, source: 'intake' })),
        });
      }

      await tx.transition.update({
        where: { id: params.id },
        data: { currentPlanVersionId: pv.id, status: 'PLAN_IN_PROGRESS' },
      });

      return pv;
    });

    await recordAuditEvent({
      transitionId: params.id,
      actorId: user.id,
      action: 'plan.generated',
      entityType: 'PlanVersion',
      entityId: planVersion.id,
      details: { versionNumber, templateId: template.id, templateVersion: template.version },
    });

    await getFlowBuilderAdapter().publish({
      type: 'plan.generated',
      transitionId: params.id,
      planVersionId: planVersion.id,
      occurredAt: new Date().toISOString(),
      payload: { totalHours: result.totalHours, totalInvestment: result.totalInvestment },
    });

    return NextResponse.json({ planVersionId: planVersion.id, result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
