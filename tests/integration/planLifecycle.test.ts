// Integration test: exercises the domain layer against a real (file-based,
// migrated) SQLite database — no mocking of Prisma. Run with
// `npm run test:integration` after `npm run test:integration:setup`.
process.env.DATABASE_URL = 'file:./prisma/test.db';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { runEstimation } from '@/domain/estimation/engine';
import {
  CALCULATOR_BASELINE_CONFIG,
  CALCULATOR_BASELINE_DEFAULTS,
  CALCULATOR_BASELINE_PHASES,
  CALCULATOR_BASELINE_PRODUCTS,
  CALCULATOR_BASELINE_ROLES,
} from '@/domain/estimation/fixtures/calculatorBaseline';
import { classifyTransition } from '@/domain/classification/service';
import { assertPlanVersionTransition } from '@/domain/versioning/stateMachine';
import { assertVersionIsEditable } from '@/domain/versioning/service';
import { checkPlanReadyForApproval, checkPlanReadyForSubmission, nextPlanStatusForDecision, recordApprovalDecision } from '@/domain/approval/service';

const db = new PrismaClient();

describe('plan lifecycle integration (real SQLite database)', () => {
  let ownerId: string;
  let sponsorId: string;
  let templateId: string;
  let transitionId: string;
  let planVersionId: string;

  beforeAll(async () => {
    const owner = await db.user.create({
      data: { email: `owner-${Date.now()}@test.local`, name: 'Test Owner', passwordHash: 'x', roles: JSON.stringify(['TRANSITION_OWNER']) },
    });
    const sponsor = await db.user.create({
      data: { email: `sponsor-${Date.now()}@test.local`, name: 'Test Sponsor', passwordHash: 'x', roles: JSON.stringify(['EXECUTIVE_APPROVER']) },
    });
    ownerId = owner.id;
    sponsorId = sponsor.id;

    const template = await db.template.create({
      data: {
        templateFamilyId: `integration-test-${Date.now()}`,
        name: 'Integration Test Template',
        type: 'PLAN_TEMPLATE',
        ownerId: owner.id,
        version: 1,
        status: 'PUBLISHED',
        applicablePlanTypes: JSON.stringify(['SINGLE_SITE']),
        applicableProducts: JSON.stringify(CALCULATOR_BASELINE_PRODUCTS.map((p) => p.id)),
        body: JSON.stringify({
          phases: CALCULATOR_BASELINE_PHASES,
          products: CALCULATOR_BASELINE_PRODUCTS,
          roles: CALCULATOR_BASELINE_ROLES,
          config: CALCULATOR_BASELINE_CONFIG,
          defaults: CALCULATOR_BASELINE_DEFAULTS,
          phaseAdjustments: Object.fromEntries(CALCULATOR_BASELINE_PHASES.map((p) => [p.id, 1])),
          productAdjustments: Object.fromEntries(CALCULATOR_BASELINE_PRODUCTS.map((p) => [p.id, 1])),
          resourceGroupMultipliers: { design: 1, functional: 1, technical: 1, program: 1 },
        }),
        createdBy: owner.id,
      },
    });
    templateId = template.id;

    const client = await db.client.create({ data: { name: 'Integration Test Client' } });
    const transition = await db.transition.create({
      data: {
        clientId: client.id,
        name: 'Integration Test Transition',
        transitionOwnerId: owner.id,
        executiveSponsorId: sponsor.id,
        planType: 'SINGLE_SITE',
        status: 'DRAFT',
        productsInScope: JSON.stringify(['wm']),
        createdBy: owner.id,
      },
    });
    transitionId = transition.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('classifies the transition from intake answers', () => {
    const result = classifyTransition({ 'scope.plan_type': 'single_site', 'scope.products': ['wm'] });
    expect(result.planType).toBe('single_site');
  });

  it('generates a deterministic plan version and persists phases/roles', async () => {
    const templateRow = await db.template.findUniqueOrThrow({ where: { id: templateId } });
    const body = JSON.parse(templateRow.body);
    const input = {
      startDate: body.defaults.startDate,
      ratePerHour: body.defaults.ratePerHour,
      contingencyPercent: body.defaults.contingencyPercent,
      holidayMode: body.defaults.holidayMode,
      holidayReductionPercent: body.defaults.holidayReductionPercent,
      phases: body.phases,
      products: body.products,
      roles: body.roles,
      phaseAdjustments: body.phaseAdjustments,
      productAdjustments: body.productAdjustments,
      resourceGroupMultipliers: body.resourceGroupMultipliers,
      config: body.config,
    };
    const result = runEstimation(input);
    expect(result.totalHours).toBeCloseTo(5416, 2);

    const pv = await db.planVersion.create({
      data: {
        transitionId,
        versionNumber: 1,
        scenarioName: 'Baseline',
        status: 'DRAFT',
        planType: 'SINGLE_SITE',
        primaryTemplateId: templateId,
        templateSnapshot: JSON.stringify({ id: templateId, version: 1 }),
        inputSnapshot: JSON.stringify(input),
        calculationSnapshot: JSON.stringify(result),
        recommended: true,
        createdById: ownerId,
      },
    });
    planVersionId = pv.id;

    await db.phase.createMany({
      data: result.phases.map((p) => ({
        planVersionId: pv.id,
        phaseType: p.id,
        name: p.name,
        sequence: 1,
        durationWeeks: p.durationWeeks,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        hours: p.hours,
        investment: p.investment,
      })),
    });
    await db.risk.create({ data: { planVersionId: pv.id, description: 'Integration partner readiness unconfirmed.' } });
    await db.assumption.create({ data: { planVersionId: pv.id, description: 'Client SMEs available at kickoff.' } });

    const storedPhases = await db.phase.findMany({ where: { planVersionId: pv.id } });
    expect(storedPhases).toHaveLength(4);
  });

  it('blocks submission until required conditions are met, then allows it', async () => {
    const blocked = checkPlanReadyForSubmission({ unconfirmedHighImpactAnswerPrompts: ['What is the plan type?'], hasExecutiveApprover: true });
    expect(blocked.ok).toBe(false);

    const check = checkPlanReadyForSubmission({ unconfirmedHighImpactAnswerPrompts: [], hasExecutiveApprover: true });
    expect(check.ok).toBe(true);

    assertPlanVersionTransition('DRAFT', 'READY_FOR_REVIEW');
    await db.planVersion.update({ where: { id: planVersionId }, data: { status: 'READY_FOR_REVIEW' } });

    const approval = await db.approval.create({
      data: { planVersionId, approverId: sponsorId, approverRole: 'EXECUTIVE_APPROVER', status: 'PENDING' },
    });
    expect(approval.status).toBe('PENDING');
  });

  it('approves the plan, locks it, and prevents further in-place edits', async () => {
    const pv = await db.planVersion.findUniqueOrThrow({ where: { id: planVersionId }, include: { assumptions: true, risks: true } });
    const approval = await db.approval.findFirstOrThrow({ where: { planVersionId } });

    const check = checkPlanReadyForApproval({
      assumptionsCount: pv.assumptions.length,
      risksCount: pv.risks.length,
      hasPendingApprovalRequest: approval.status === 'PENDING',
    });
    expect(check.ok).toBe(true);

    const decided = recordApprovalDecision(
      { id: approval.id, planVersionId, approverId: sponsorId, approverRole: 'EXECUTIVE_APPROVER', status: 'PENDING', requestedAt: new Date().toISOString() },
      'APPROVED',
      'Looks good',
      new Date().toISOString()
    );
    expect(decided.status).toBe('APPROVED');

    const nextStatus = nextPlanStatusForDecision('APPROVED');
    assertPlanVersionTransition('READY_FOR_REVIEW', nextStatus);

    await db.$transaction([
      db.approval.update({ where: { id: approval.id }, data: { status: 'APPROVED', respondedAt: new Date() } }),
      db.planVersion.update({ where: { id: planVersionId }, data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: sponsorId } }),
    ]);

    const approved = await db.planVersion.findUniqueOrThrow({ where: { id: planVersionId } });
    expect(approved.status).toBe('APPROVED');
    expect(() => assertVersionIsEditable(approved.status as any)).toThrow();
  });

  it('never lets a second decision be recorded against the same approval', async () => {
    const approval = await db.approval.findFirstOrThrow({ where: { planVersionId } });
    expect(() =>
      recordApprovalDecision(
        { id: approval.id, planVersionId, approverId: sponsorId, approverRole: 'EXECUTIVE_APPROVER', status: approval.status as any, requestedAt: approval.requestedAt.toISOString() },
        'APPROVED',
        undefined,
        new Date().toISOString()
      )
    ).toThrow();
  });
});
