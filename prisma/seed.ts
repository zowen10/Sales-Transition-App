/**
 * DEVELOPMENT FIXTURE — seeds local users, the intake question set, one
 * published plan template (ported from the Burn Plan Calculator baseline),
 * and a sample transition. Run with `npm run prisma:seed`. Never run
 * against a shared/production database.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  CALCULATOR_BASELINE_CONFIG,
  CALCULATOR_BASELINE_DEFAULTS,
  CALCULATOR_BASELINE_PHASES,
  CALCULATOR_BASELINE_PRODUCTS,
  CALCULATOR_BASELINE_ROLES,
} from '../src/domain/estimation/fixtures/calculatorBaseline';

const db = new PrismaClient();

const DEV_PASSWORD = 'password123'; // local dev only — never used outside seed fixtures

async function upsertUser(email: string, name: string, roles: string[]) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  return db.user.upsert({
    where: { email },
    update: { name, roles: JSON.stringify(roles) },
    create: { email, name, passwordHash, roles: JSON.stringify(roles) },
  });
}

interface SeedQuestion {
  key: string;
  section: string;
  prompt: string;
  helpText?: string;
  primaryRespondent?: string;
  classificationSignal?: string;
  responseType: string;
  options?: string[];
  required?: boolean;
  order: number;
  visibilityRule?: unknown;
  validationRule?: unknown;
  highImpact?: boolean;
}

// The 13-question sales-to-delivery handoff assessment. Replaces the earlier,
// longer question set: one flat list, no sub-sections to click through.
const QUESTIONS: SeedQuestion[] = [
  { key: 'handoff.business_problem_urgency_outcomes', section: 'Sales-to-Delivery Handoff', order: 1,
    prompt: 'What business problem, urgency, and outcomes caused the client to buy now?',
    primaryRespondent: 'Sales', classificationSignal: 'Strategic driver and success profile',
    responseType: 'text', required: true },
  { key: 'scope.products', section: 'Sales-to-Delivery Handoff', order: 2,
    prompt: 'What exact products, modules, sites, users, countries, and environments were sold?',
    primaryRespondent: 'Sales', classificationSignal: 'Project footprint and scale',
    responseType: 'text', required: true, highImpact: true },
  { key: 'handoff.scope_boundary', section: 'Sales-to-Delivery Handoff', order: 3,
    prompt: 'What is explicitly in scope — and what was discussed but excluded or deferred?',
    primaryRespondent: 'Sales + ED', classificationSignal: 'Scope boundary and template risk',
    responseType: 'text', required: true },
  { key: 'commercial.model', section: 'Sales-to-Delivery Handoff', order: 4,
    prompt: 'What commercial model applies: fixed fee, T&M, milestone, or hybrid?',
    primaryRespondent: 'ED', classificationSignal: 'Governance, budget, and control model',
    responseType: 'select', options: ['fixed_fee', 'time_and_materials', 'milestone', 'hybrid'],
    required: true, highImpact: true },
  { key: 'handoff.delivery_approach', section: 'Sales-to-Delivery Handoff', order: 5,
    prompt: 'What delivery approach was promised: standard RPM, phased, Design Accelerator, Agile Configuration, ProActive, CWV, VPT, or another model?',
    primaryRespondent: 'Sales + ED', classificationSignal: 'Delivery-template selection',
    responseType: 'text', required: true },
  { key: 'handoff.agentic_classification', section: 'Sales-to-Delivery Handoff', order: 6,
    prompt: 'Is this a standard implementation, an agentic-enabled implementation, or a standard project where the team may use internal AI tools?',
    helpText: 'Agentic status should not be inferred solely from subscription entitlements.',
    primaryRespondent: 'Sales + ED', classificationSignal: 'Agentic vs. non-agentic classification',
    responseType: 'select', options: ['standard', 'agentic_enabled', 'standard_with_internal_ai_tools'],
    required: true },
  { key: 'handoff.functional_complexity', section: 'Sales-to-Delivery Handoff', order: 7,
    prompt: 'Which processes, functionality areas, extensions, modifications, reports, or future-release commitments were identified during sales?',
    primaryRespondent: 'Sales + Solution Consultant', classificationSignal: 'Functional complexity',
    responseType: 'text', required: true },
  { key: 'handoff.technical_complexity', section: 'Sales-to-Delivery Handoff', order: 8,
    prompt: 'What integrations, host systems, middleware, MHE, hardware, data conversion, or client-built components are involved?',
    primaryRespondent: 'Sales + Technical Lead', classificationSignal: 'Technical and integration complexity',
    responseType: 'text', required: true },
  { key: 'handoff.sites_waves_timeline', section: 'Sales-to-Delivery Handoff', order: 9,
    prompt: 'How many sites or deployment waves are planned, and what are the target go-live dates and sequencing assumptions?',
    primaryRespondent: 'Sales + ED', classificationSignal: 'Multi-site and timeline complexity',
    responseType: 'text', required: true, highImpact: true },
  { key: 'handoff.raci_responsibilities', section: 'Sales-to-Delivery Handoff', order: 10,
    prompt: 'What responsibilities belong to the client, Manhattan, system integrators, and other partners?',
    primaryRespondent: 'ED', classificationSignal: 'Staffing, dependency, and RACI needs',
    responseType: 'text', required: true },
  { key: 'handoff.stakeholders', section: 'Sales-to-Delivery Handoff', order: 11,
    prompt: 'Who are the executive sponsor, decision makers, operational owners, skeptics, and key client influencers?',
    primaryRespondent: 'Sales + ED', classificationSignal: 'Stakeholder and escalation model',
    responseType: 'text', required: true },
  { key: 'handoff.risks_concerns', section: 'Sales-to-Delivery Handoff', order: 12,
    prompt: 'What expectations, assumptions, risks, objections, or unresolved concerns could surprise the delivery team?',
    primaryRespondent: 'ED', classificationSignal: 'Risk level and required controls',
    responseType: 'text', required: true },
  { key: 'handoff.template_recommendation', section: 'Sales-to-Delivery Handoff', order: 13,
    prompt: 'Based on the answers above, which project archetype/template should apply — and what facts would disqualify that template?',
    primaryRespondent: 'ED + Sales + PM/DL', classificationSignal: 'Final classification and template recommendation',
    responseType: 'text', required: true, highImpact: true },
];

async function main() {
  const director = await upsertUser('alex.director@example.com', 'Alex Rivera', ['TRANSITION_OWNER', 'CONTRIBUTOR']);
  const sponsor = await upsertUser('sam.sponsor@example.com', 'Sam Okafor', ['EXECUTIVE_APPROVER']);
  const templateOwner = await upsertUser('tim.templates@example.com', 'Tim Chen', ['TEMPLATE_OWNER']);
  const admin = await upsertUser('admin@example.com', 'PSO Admin', ['ADMINISTRATOR']);
  const salesLead = await upsertUser('pat.sales@example.com', 'Pat Nguyen', ['CONTRIBUTOR']);
  await upsertUser('reviewer@example.com', 'Riley Reviewer', ['REVIEWER']);
  await upsertUser('viewer@example.com', 'Val Stakeholder', ['READ_ONLY_STAKEHOLDER']);

  for (const q of QUESTIONS) {
    await db.questionDefinition.upsert({
      where: { key: q.key },
      update: {
        section: q.section,
        prompt: q.prompt,
        helpText: q.helpText,
        primaryRespondent: q.primaryRespondent,
        classificationSignal: q.classificationSignal,
        responseType: q.responseType,
        options: q.options ? JSON.stringify(q.options) : null,
        required: q.required ?? false,
        order: q.order,
        visibilityRule: q.visibilityRule ? JSON.stringify(q.visibilityRule) : null,
        validationRule: q.validationRule ? JSON.stringify(q.validationRule) : null,
        highImpact: q.highImpact ?? false,
        active: true,
      },
      create: {
        key: q.key,
        section: q.section,
        prompt: q.prompt,
        helpText: q.helpText,
        primaryRespondent: q.primaryRespondent,
        classificationSignal: q.classificationSignal,
        responseType: q.responseType,
        options: q.options ? JSON.stringify(q.options) : null,
        required: q.required ?? false,
        order: q.order,
        visibilityRule: q.visibilityRule ? JSON.stringify(q.visibilityRule) : null,
        validationRule: q.validationRule ? JSON.stringify(q.validationRule) : null,
        highImpact: q.highImpact ?? false,
        active: true,
      },
    });
  }

  // Deactivate any previously-seeded questions that are no longer part of the
  // current set (rather than deleting — IntakeAnswer rows may still reference them).
  await db.questionDefinition.updateMany({
    where: { key: { notIn: QUESTIONS.map((q) => q.key) } },
    data: { active: false },
  });

  const templateFamilyId = 'plan-template-24wk-single-site-mawm';
  const existing = await db.template.findFirst({ where: { templateFamilyId }, orderBy: { version: 'desc' } });
  let planTemplate = existing;
  if (!existing) {
    planTemplate = await db.template.create({
      data: {
        templateFamilyId,
        name: '24-Week Single Site MAWM',
        description: 'Design/Build/Prepare/Deploy plan template ported from the Burn Plan Calculator reference prototype (24 Week MAWM Services Plan - Single Site - 05052026.xlsx).',
        type: 'PLAN_TEMPLATE',
        ownerId: templateOwner.id,
        version: 1,
        status: 'PUBLISHED',
        effectiveDate: new Date(),
        applicablePlanTypes: JSON.stringify(['SINGLE_SITE', 'MULTI_SITE']),
        applicableProducts: JSON.stringify(CALCULATOR_BASELINE_PRODUCTS.map((p) => p.id)),
        changeNotes: 'Initial published version, seeded from the reference calculator baseline.',
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
        createdBy: templateOwner.id,
      },
    });
  }

  const clientName = 'Acme Distribution';
  const client = await db.client.upsert({
    where: { id: 'seed-client-acme' },
    update: {},
    create: { id: 'seed-client-acme', name: clientName },
  });

  const transition = await db.transition.upsert({
    where: { id: 'seed-transition-acme-wm' },
    update: {},
    create: {
      id: 'seed-transition-acme-wm',
      clientId: client.id,
      salesforceOpportunityUrl: 'https://manh.lightning.force.com/lightning/r/Opportunity/0060g_seed/view',
      name: 'Acme Distribution — Phase 1 WM Rollout',
      engagementDirectorName: director.name,
      salesLeadName: salesLead.name,
      executiveSponsorName: sponsor.name,
      planType: 'SINGLE_SITE',
      status: 'DRAFT',
      productsInScope: JSON.stringify(['wm']),
      createdBy: director.id,
    },
  });

  const seedAnswers: { key: string; value: unknown; confirmed: boolean }[] = [
    { key: 'scope.products', value: 'Manhattan ACTIVE Warehouse Management (WM), single site, ~120 users, US only.', confirmed: true },
    { key: 'commercial.model', value: 'time_and_materials', confirmed: true },
  ];
  for (const a of seedAnswers) {
    const question = await db.questionDefinition.findUnique({ where: { key: a.key } });
    if (!question) continue;
    await db.intakeAnswer.upsert({
      where: { transitionId_questionId: { transitionId: transition.id, questionId: question.id } },
      update: {},
      create: {
        transitionId: transition.id,
        questionId: question.id,
        section: question.section,
        normalizedValue: JSON.stringify(a.value),
        valueType: question.responseType,
        source: 'manual',
        isConfirmed: a.confirmed,
        answeredById: director.id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log(`Users (password: ${DEV_PASSWORD}):`);
  for (const u of [director, sponsor, templateOwner, admin, salesLead]) {
    // eslint-disable-next-line no-console
    console.log(`  ${u.email} — ${u.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
