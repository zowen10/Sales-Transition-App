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

// Question set modeled on Manhattan Associates' Sales Cycle / Sales Transition
// meeting document (the sales-to-delivery handoff meeting run by the
// Engagement Manager/Director with Sales Consulting). Sections and prompts
// mirror that document's structure, generalized for reuse across clients.
const QUESTIONS: SeedQuestion[] = [
  // Meeting & Attendees
  { key: 'meeting.date', section: 'Meeting & Attendees', prompt: 'What is the sales-to-delivery transition meeting date?', responseType: 'date', order: 1 },
  { key: 'meeting.coordinator', section: 'Meeting & Attendees', prompt: 'Who is coordinating this meeting?', responseType: 'text', order: 2 },
  { key: 'meeting.engagement_manager', section: 'Meeting & Attendees', prompt: 'Who is the Engagement Manager for this transition?', responseType: 'text', order: 3 },
  { key: 'meeting.attendees', section: 'Meeting & Attendees', prompt: 'Who is present at this meeting (names and roles)?', responseType: 'text', order: 4 },

  // Engagement Context & Objectives
  { key: 'engagement.key_business_requirements', section: 'Engagement Context & Objectives', prompt: "What are the client's key business requirements / project objectives for this engagement?", responseType: 'text', required: true, highImpact: true, order: 1 },
  { key: 'engagement.desired_outcomes', section: 'Engagement Context & Objectives', prompt: 'What business outcomes does the client want from this engagement?', responseType: 'text', order: 2 },
  { key: 'engagement.decision_status', section: 'Engagement Context & Objectives', prompt: 'What is the current decision status, and when is the award expected?', responseType: 'text', order: 3 },
  { key: 'engagement.sales_commitments', section: 'Engagement Context & Objectives', prompt: 'Are there existing sales commitments or proposal references we must honor?', responseType: 'text', required: false, order: 4 },

  // Scope & Plan Classification
  { key: 'scope.plan_type', section: 'Scope & Plan Classification', prompt: 'Will all solution(s) sold be implemented at the same time — in one facility (single site) or multiple facilities (multi-site)?', responseType: 'select', options: ['single_site', 'multi_site'], required: true, highImpact: true, order: 1 },
  { key: 'scope.site_count', section: 'Scope & Plan Classification', prompt: 'How many sites are in scope?', responseType: 'number', required: true, order: 2, validationRule: { min: 1 }, visibilityRule: { op: 'equals', key: 'scope.plan_type', value: 'multi_site' } },
  { key: 'scope.geography', section: 'Scope & Plan Classification', prompt: 'What site(s)/region(s) are in scope (names, locations, user counts)?', responseType: 'text', order: 3 },
  { key: 'scope.rollout_sequence', section: 'Scope & Plan Classification', prompt: 'What is the desired rollout sequence across sites (e.g. big bang vs. phased)?', responseType: 'text', order: 4, visibilityRule: { op: 'equals', key: 'scope.plan_type', value: 'multi_site' } },
  { key: 'scope.products', section: 'Scope & Plan Classification', prompt: 'Which Manhattan products/services were sold and are in scope?', responseType: 'multiselect', options: ['wm', 'lm', 'sci', 'slotting', 'mif', 'extension'], required: true, highImpact: true, order: 5 },
  { key: 'scope.reference_engagement', section: 'Scope & Plan Classification', prompt: 'Is there a reusable template or known reference engagement to model this on?', responseType: 'text', required: false, order: 6 },

  // Systems & Integration Landscape
  { key: 'systems.current_systems', section: 'Systems & Integration Landscape', prompt: 'What relevant systems is the customer currently using, or what systems are we replacing?', responseType: 'text', order: 1 },
  { key: 'systems.other_impacted', section: 'Systems & Integration Landscape', prompt: 'List any other client systems and/or vendors that will be impacted by this implementation.', responseType: 'text', order: 2 },
  { key: 'complexity.integration_count', section: 'Systems & Integration Landscape', prompt: 'How many integrations are required?', responseType: 'number', order: 3, validationRule: { min: 0 } },
  { key: 'complexity.uses_mif', section: 'Systems & Integration Landscape', prompt: 'Does this engagement involve MIF (Manhattan Integration Framework)?', responseType: 'boolean', order: 4 },
  { key: 'complexity.custom_extensions', section: 'Systems & Integration Landscape', prompt: 'Are custom extensions or significant system customizations expected?', responseType: 'boolean', order: 5 },
  { key: 'complexity.extension_count', section: 'Systems & Integration Landscape', prompt: 'How many custom extensions are anticipated?', responseType: 'number', order: 6, visibilityRule: { op: 'equals', key: 'complexity.custom_extensions', value: true } },
  { key: 'delivery.data_migration_concerns', section: 'Systems & Integration Landscape', prompt: 'Are there data migration or data-quality concerns?', responseType: 'boolean', order: 7 },

  // Risks, Constraints & Culture
  { key: 'risks.known_risks', section: 'Risks, Constraints & Culture', prompt: 'What are the major issues, risks, and/or constraints with this implementation? Are there any externally mandated deadlines?', responseType: 'text', order: 1 },
  { key: 'delivery.compliance_requirements', section: 'Risks, Constraints & Culture', prompt: 'Are there client-specific compliance or security requirements?', responseType: 'boolean', order: 2 },
  { key: 'engagement.third_party_involvement', section: 'Risks, Constraints & Culture', prompt: 'Will other business partners or vendors be involved in this project? If so, who?', responseType: 'text', order: 3 },
  { key: 'engagement.client_pm_experience', section: 'Risks, Constraints & Culture', prompt: "What experience does the client's PM and other team members have with this type of project?", responseType: 'text', order: 4 },
  { key: 'engagement.corporate_culture', section: 'Risks, Constraints & Culture', prompt: "Briefly describe the client's corporate culture and any significant political challenges we may face.", responseType: 'text', order: 5 },

  // Stakeholders & Team
  { key: 'stakeholders.steering_committee', section: 'Stakeholders & Team', prompt: 'Have members of the Steering Committee and Project Team been named? List names and roles (e.g. Executive Sponsor, VP IT, IT Director, Ops sponsor).', responseType: 'text', required: true, highImpact: true, order: 1 },
  { key: 'engagement.methodology_reviewed', section: 'Stakeholders & Team', prompt: "Does the client have a base understanding of MA's methodology? Was the RPM process reviewed with the client's project team?", responseType: 'boolean', order: 2 },
  { key: 'engagement.contract_changes', section: 'Stakeholders & Team', prompt: 'Have significant changes occurred since the contract was signed?', responseType: 'text', required: false, order: 3 },

  // Contract & Commercial Summary
  { key: 'commercial.solutions_sold', section: 'Contract & Commercial Summary', prompt: 'List the types of solutions/services sold to the customer.', responseType: 'text', order: 1 },
  { key: 'commercial.model', section: 'Contract & Commercial Summary', prompt: 'What is the commercial model?', responseType: 'select', options: ['fixed_fee', 'time_and_materials', 'other'], required: true, highImpact: true, order: 2 },
  { key: 'commercial.rate_card', section: 'Contract & Commercial Summary', prompt: 'What is the onshore/US services rate (USD per hour)?', responseType: 'text', order: 3 },
  { key: 'commercial.offshore_rate', section: 'Contract & Commercial Summary', prompt: 'What is the offshore rate, if applicable (USD per hour)?', responseType: 'number', required: false, order: 4 },
  { key: 'commercial.offshore_cap_percent', section: 'Contract & Commercial Summary', prompt: 'What is the offshore hours cap, as a percentage of total implementation hours?', responseType: 'number', required: false, order: 5, validationRule: { min: 0, max: 100 } },
  { key: 'commercial.contingency_percent', section: 'Contract & Commercial Summary', prompt: 'What contingency percentage should be applied?', responseType: 'number', order: 6, validationRule: { min: 0, max: 25 } },
  { key: 'commercial.special_incentives', section: 'Contract & Commercial Summary', prompt: 'Describe any special incentives, rates, or penalties.', responseType: 'text', required: false, order: 7 },
  { key: 'commercial.approval_threshold', section: 'Contract & Commercial Summary', prompt: 'What approval threshold and required approvers apply?', responseType: 'text', order: 8 },

  // Timeline & Milestones
  { key: 'timeline.target_start_date', section: 'Timeline & Milestones', prompt: 'When does the customer want to begin the project (kickoff date)?', responseType: 'date', required: true, highImpact: true, order: 1 },
  { key: 'timeline.target_go_live_date', section: 'Timeline & Milestones', prompt: 'Are there externally mandated deadlines? What is the target go-live date?', responseType: 'date', required: true, highImpact: true, order: 2 },
  { key: 'timeline.training_schedule', section: 'Timeline & Milestones', prompt: 'Has client training been scheduled (L1/L2/ProActive dates)?', responseType: 'text', required: false, order: 3 },
  { key: 'timeline.blackout_periods', section: 'Timeline & Milestones', prompt: 'Are there blackout periods or holidays we must plan around?', responseType: 'text', required: false, order: 4 },
  { key: 'timeline.schedule_confidence', section: 'Timeline & Milestones', prompt: 'How confident is the client in this schedule?', responseType: 'select', options: ['low', 'medium', 'high'], order: 5 },

  // Delivery Readiness
  { key: 'readiness.environments_provisioned', section: 'Delivery Readiness', prompt: 'Have environments been provisioned for the client?', responseType: 'boolean', order: 1 },
  { key: 'readiness.client_smes', section: 'Delivery Readiness', prompt: 'Are client SMEs identified and available?', responseType: 'boolean', order: 2 },
  { key: 'readiness.testing_strategy', section: 'Delivery Readiness', prompt: 'What is the testing strategy and is test data ready?', responseType: 'text', order: 3 },

  // Future Opportunities
  { key: 'future.hardware_opportunities', section: 'Future Opportunities', prompt: 'Any future hardware sales opportunities?', responseType: 'text', required: false, order: 1 },
  { key: 'future.subscription_opportunities', section: 'Future Opportunities', prompt: 'Any future product subscription opportunities?', responseType: 'text', required: false, order: 2 },
  { key: 'future.environment_opportunities', section: 'Future Opportunities', prompt: 'Any future environment opportunities (e.g. additional test/performance environments)?', responseType: 'text', required: false, order: 3 },
  { key: 'future.services_opportunities', section: 'Future Opportunities', prompt: 'Any future services opportunities (e.g. CWV, additional workstreams)?', responseType: 'text', required: false, order: 4 },

  // Risks and Open Questions
  { key: 'risks.unvalidated_assumptions', section: 'Risks and Open Questions', prompt: 'What assumptions are not yet validated?', responseType: 'text', order: 1 },
  { key: 'risks.decisions_required', section: 'Risks and Open Questions', prompt: 'What decisions are required before kickoff?', responseType: 'text', required: false, order: 2 },
  { key: 'risks.confidence_level', section: 'Risks and Open Questions', prompt: 'Overall, how confident are you in these answers?', responseType: 'select', options: ['low', 'medium', 'high'], required: true, highImpact: true, order: 3 },
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
