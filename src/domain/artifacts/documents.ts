import { metadataBlock } from './metadata';
import type { ArtifactContext } from './types';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const hours = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * All four text artifacts below are deterministic string templates over
 * the plan's actual calculation result and intake-derived assumptions,
 * risks, and decisions — no generative narrative content is fabricated
 * beyond formatting what the plan and intake already established.
 */

export function buildSalesTransitionBrief(ctx: ArtifactContext): string {
  const { metadata: m, transition, result, classification } = ctx;
  return `# Sales Transition Brief\n\n${metadataBlock(m)}\n\n## Client & Opportunity\n- **Client:** ${transition.clientName}\n- **Salesforce opportunity:** ${transition.salesforceOpportunityUrl ?? 'Not yet assigned'}\n- **Sales lead:** ${transition.salesLeadName ?? 'Unassigned'}\n- **Executive sponsor:** ${transition.sponsorName ?? 'Unassigned'}\n\n## Scope & Plan Type\n- **Plan type:** ${transition.planType}\n- **Products/services in scope:** ${transition.productsInScope.join(', ') || 'None recorded'}\n- **Complexity level:** ${classification?.complexityLevel ?? 'Not yet classified'}\n\n## Commercial Summary\n- **Total investment:** ${money(result.totalInvestment)} (base ${money(result.baseInvestment)} + contingency ${money(result.contingencyAmount)})\n- **MA hours:** ${hours(result.totalHours)}\n- **Schedule:** ${result.calendarWeeks} calendar weeks (${result.workingWeeks} working weeks)\n\n## Key Assumptions\n${ctx.assumptions.length ? ctx.assumptions.map((a) => `- ${a.description}`).join('\n') : '- None documented yet.'}\n\n## Key Risks\n${ctx.risks.length ? ctx.risks.map((r) => `- ${r.description}`).join('\n') : '- None documented yet.'}\n\n## Open Decisions\n${ctx.decisions.length ? ctx.decisions.map((d) => `- ${d.description}`).join('\n') : '- None documented yet.'}\n`;
}

export function buildSdsStarterPackage(ctx: ArtifactContext): string {
  const { metadata: m, result } = ctx;
  const workstreams = result.products.filter((p) => p.hours > 0);
  return `# SDS Starter Package\n\n${metadataBlock(m)}\n\n## Workstream Structure\n${workstreams.map((p) => `- **${p.name}** — ${hours(p.hours)} hours modeled`).join('\n')}\n\n## Known Products & Integrations\n${workstreams.map((p) => `- ${p.name}`).join('\n')}\n\n## Initial Solution-Design Topics\n- Confirm integration touchpoints per workstream above.\n- Confirm data migration approach and source systems.\n- Confirm environment and access strategy.\n\n## Open Questions\n${ctx.decisions.length ? ctx.decisions.map((d) => `- ${d.description}`).join('\n') : '- None documented yet.'}\n\n## Dependencies\n${ctx.risks.length ? ctx.risks.map((r) => `- ${r.description}`).join('\n') : '- None documented yet.'}\n\n## Design Assumptions\n${ctx.assumptions.length ? ctx.assumptions.map((a) => `- ${a.description}`).join('\n') : '- None documented yet.'}\n`;
}

export function buildDraftSow(ctx: ArtifactContext): string {
  const { metadata: m, transition, result } = ctx;
  return `# Draft Statement of Work\n\n${metadataBlock(m)}\n\n**This is a DRAFT for internal review. Commercial values are placeholders pending approval and legal review.**\n\n## Scope\n${transition.productsInScope.join(', ') || 'To be confirmed'} for ${transition.clientName}, plan type ${transition.planType}.\n\n## Deliverables\n${result.phases.map((p) => `- ${p.name} phase deliverables (${p.durationWeeks} weeks)`).join('\n')}\n\n## Milestones\n${result.phases.map((p) => `- ${p.name}: ${p.startDate} → ${p.endDate}`).join('\n')}\n\n## Assumptions\n${ctx.assumptions.length ? ctx.assumptions.map((a) => `- ${a.description}`).join('\n') : '- None documented yet.'}\n\n## Exclusions\n- Anything outside the listed products/services in scope.\n\n## Client Responsibilities\n- Provide SMEs, environment access, and timely decisions per the mobilization checklist.\n\n## Manhattan Responsibilities\n- Deliver the phases and deliverables listed above per the approved plan.\n\n## Commercial Placeholders\n- **Estimated investment:** ${money(result.totalInvestment)} (DRAFT — subject to commercial review)\n- **Commercial model:** ${ctx.classification?.commercialModel ?? 'Not yet classified'}\n\n## Approval Status\n**DRAFT — not an executed agreement.**\n`;
}

export function buildKickoffPackage(ctx: ArtifactContext): string {
  const { metadata: m, transition, result } = ctx;
  return `# Kickoff Package\n\n${metadataBlock(m)}\n\n## Kickoff Deck Outline\n1. Welcome & introductions\n2. Engagement scope and objectives\n3. Plan overview (phases, schedule, investment)\n4. Roles & governance\n5. Next steps\n\n## Agenda & Facilitator Guide\n- 30 min: introductions & objectives\n- 45 min: plan walkthrough\n- 30 min: roles, RACI, governance cadence\n- 15 min: next steps & open questions\n\n## 30/60/90-Day Plan\n- **0-30 days:** ${result.phases[0]?.name ?? 'Design'} kickoff, SME alignment, environment access confirmation.\n- **31-60 days:** Continue ${result.phases[1]?.name ?? 'Build'} phase execution.\n- **61-90 days:** ${result.phases[2]?.name ?? 'Prepare'} phase readiness checks.\n\n## RACI (starter)\n| Activity | Responsible | Accountable | Consulted | Informed |\n|---|---|---|---|---|\n| Plan execution | Delivery team | ${transition.ownerName} | ${transition.sponsorName ?? 'Sponsor TBD'} | Stakeholders |\n\n## RAID Baseline\n- **Risks:** ${ctx.risks.length}\n- **Assumptions:** ${ctx.assumptions.length}\n- **Decisions pending:** ${ctx.decisions.length}\n\n## Decision Log\n${ctx.decisions.length ? ctx.decisions.map((d) => `- ${d.description} — Owner: TBD`).join('\n') : '- None documented yet.'}\n\n## Governance Cadence\n- Weekly status call, bi-weekly steering committee (default — confirm with client).\n\n## Mobilization Checklist\n- [ ] Client SMEs identified\n- [ ] Environments provisioned\n- [ ] Kickoff scheduled\n- [ ] RACI confirmed\n\n## Client Readiness Scorecard\n- To be completed during kickoff based on Delivery Readiness intake answers.\n\n## Success Measures & KPI Baseline\n- On-time delivery against the ${result.calendarWeeks}-week schedule.\n- Investment tracked against ${money(result.totalInvestment)} baseline.\n`;
}
