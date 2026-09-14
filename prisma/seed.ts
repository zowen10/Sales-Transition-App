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
  responseType: string;
  options?: string[];
  required?: boolean;
  order: number;
  visibilityRule?: unknown;
  validationRule?: unknown;
  highImpact?: boolean;
}

const QUESTIONS: SeedQuestion[] = [
  // Engagement context
  { key: 'engagement.desired_outcomes', section: 'Engagement context', prompt: 'What business outcomes does the client want from this engagement?', responseType: 'text', order: 1 },
  { key: 'engagement.decision_status', section: 'Engagement context', prompt: 'What is the current decision status, and when is the award expected?', responseType: 'text', order: 2 },
  { key: 'engagement.sales_commitments', section: 'Engagement context', prompt: 'Are there existing sales commitments or proposal references we must honor?', responseType: 'text', required: false, order: 3 },

  // Scope and plan classification
  { key: 'scope.plan_type', section: 'Scope and plan classification', prompt: 'What is the plan type?', responseType: 'select', options: ['single_site', 'multi_site', 'program', 'specialized'], required: true, highImpact: true, order: 1 },
  { key: 'scope.site_count', section: 'Scope and plan classification', prompt: 'How many sites are in scope?', responseType: 'number', required: true, order: 2, validationRule: { min: 1 }, visibilityRule: { op: 'in', key: 'scope.plan_type', values: ['multi_site', 'program'] } },
  { key: 'scope.geography', section: 'Scope and plan classification', prompt: 'What geography/region(s) are in scope?', responseType: 'text', order: 3 },
  { key: 'scope.rollout_sequence', section: 'Scope and plan classification', prompt: 'What is the desired rollout sequence across sites?', responseType: 'text', order: 4, visibilityRule: { op: 'in', key: 'scope.plan_type', values: ['multi_site', 'program'] } },
  { key: 'scope.products', section: 'Scope and plan classification', prompt: 'Which Manhattan products/services are in scope?', responseType: 'multiselect', options: ['wm', 'lm', 'sci', 'slotting', 'mif', 'extension'], required: true, highImpact: true, order: 5 },
  { key: 'scope.reference_engagement', section: 'Scope and plan classification', prompt: 'Is there a reusable template or known reference engagement to model this on?', responseType: 'text', required: false, order: 6 },

  // Complexity drivers
  { key: 'complexity.integration_count', section: 'Complexity drivers', prompt: 'How many integrations are required?', responseType: 'number', order: 1, validationRule: { min: 0 } },
  { key: 'complexity.uses_mif', section: 'Complexity drivers', prompt: 'Does this engagement involve MIF (Manhattan Integration Framework)?', responseType: 'boolean', order: 2 },
  { key: 'complexity.custom_extensions', section: 'Complexity drivers', prompt: 'Are custom extensions or special workflows required?', responseType: 'boolean', order: 3 },
  { key: 'complexity.extension_count', section: 'Complexity drivers', prompt: 'How many custom extensions are anticipated?', responseType: 'number', order: 4, visibilityRule: { op: 'equals', key: 'complexity.custom_extensions', value: true } },
  { key: 'delivery.data_migration_concerns', section: 'Complexity drivers', prompt: 'Are there data migration or data-quality concerns?', responseType: 'boolean', order: 5 },
  { key: 'delivery.compliance_requirements', section: 'Complexity drivers', prompt: 'Are there client-specific compliance or security requirements?', responseType: 'boolean', order: 6 },

  // Timeline and milestones
  { key: 'timeline.target_start_date', section: 'Timeline and milestones', prompt: 'What is the target start date?', responseType: 'date', required: true, highImpact: true, order: 1 },
  { key: 'timeline.target_go_live_date', section: 'Timeline and milestones', prompt: 'What is the target go-live date?', responseType: 'date', required: true, highImpact: true, order: 2 },
  { key: 'timeline.blackout_periods', section: 'Timeline and milestones', prompt: 'Are there blackout periods or holidays we must plan around?', responseType: 'text', required: false, order: 3 },
  { key: 'timeline.schedule_confidence', section: 'Timeline and milestones', prompt: 'How confident is the client in this schedule?', responseType: 'select', options: ['low', 'medium', 'high'], order: 4 },

  // Delivery readiness
  { key: 'readiness.client_smes', section: 'Delivery readiness', prompt: 'Are client SMEs identified and available?', responseType: 'boolean', order: 1 },
  { key: 'readiness.environments', section: 'Delivery readiness', prompt: 'Are environments and access ready?', responseType: 'boolean', order: 2 },
  { key: 'readiness.testing_strategy', section: 'Delivery readiness', prompt: 'What is the testing strategy and is test data ready?', responseType: 'text', order: 3 },

  // Commercial assumptions
  { key: 'commercial.model', section: 'Commercial assumptions', prompt: 'What is the commercial model?', responseType: 'select', options: ['fixed_fee', 'time_and_materials', 'other'], required: true, highImpact: true, order: 1 },
  { key: 'commercial.rate_card', section: 'Commercial assumptions', prompt: 'Which services rate or rate card applies?', responseType: 'text', order: 2 },
  { key: 'commercial.contingency_percent', section: 'Commercial assumptions', prompt: 'What contingency percentage should be applied?', responseType: 'number', order: 3, validationRule: { min: 0, max: 25 } },
  { key: 'commercial.approval_threshold', section: 'Commercial assumptions', prompt: 'What approval threshold and approvers are required?', responseType: 'text', order: 4 },

  // Risks and open questions
  { key: 'risks.known_risks', section: 'Risks and open questions', prompt: 'What known risks should be documented?', responseType: 'text', order: 1 },
  { key: 'risks.unvalidated_assumptions', section: 'Risks and open questions', prompt: 'What assumptions are not yet validated?', responseType: 'text', order: 2 },
  { key: 'risks.decisions_required', section: 'Risks and open questions', prompt: 'What decisions are required before kickoff?', responseType: 'text', required: false, order: 4 },
  { key: 'risks.confidence_level', section: 'Risks and open questions', prompt: 'Overall, how confident are you in these answers?', responseType: 'select', options: ['low', 'medium', 'high'], required: true, highImpact: true, order: 3 },
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
      opportunityId: 'OPP-10432',
      name: 'Acme Distribution — Phase 1 WM Rollout',
      transitionOwnerId: director.id,
      salesLeadId: salesLead.id,
      executiveSponsorId: sponsor.id,
      planType: 'SINGLE_SITE',
      status: 'DRAFT',
      productsInScope: JSON.stringify(['wm']),
      createdBy: director.id,
    },
  });

  const seedAnswers: { key: string; value: unknown; confirmed: boolean }[] = [
    { key: 'scope.plan_type', value: 'single_site', confirmed: true },
    { key: 'scope.products', value: ['wm'], confirmed: true },
    { key: 'timeline.target_start_date', value: CALCULATOR_BASELINE_DEFAULTS.startDate, confirmed: true },
    { key: 'commercial.model', value: 'time_and_materials', confirmed: true },
    { key: 'risks.confidence_level', value: 'medium', confirmed: true },
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
