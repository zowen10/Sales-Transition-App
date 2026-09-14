import { describe, expect, it } from 'vitest';
import { buildSalesTransitionBrief, buildDraftSow } from './documents';
import { buildBurnPlanWorkbook } from './excelWorkbook';
import type { ArtifactContext } from './types';

function baseContext(status: 'Draft' | 'Approved'): ArtifactContext {
  return {
    metadata: {
      transitionId: 't1',
      transitionName: 'Acme — Phase 1',
      planVersionId: 'pv1',
      planVersionLabel: 'v1 — Baseline',
      generatedAt: '2027-01-01T00:00:00.000Z',
      status,
      templateName: '24-Week Single Site MAWM',
      templateVersion: 1,
      preparedBy: 'Alex Rivera',
    },
    transition: {
      clientName: 'Acme Distribution',
      salesforceOpportunityUrl: 'https://manh.lightning.force.com/lightning/r/Opportunity/OPP-1/view',
      planType: 'SINGLE_SITE',
      productsInScope: ['wm'],
      ownerName: 'Alex Rivera',
      salesLeadName: 'Pat Nguyen',
      sponsorName: 'Sam Okafor',
    },
    classification: null,
    result: {
      weeks: [{ index: 1, workIndex: 0, phaseId: 'design', weekStart: '2027-01-11', holiday: null }],
      roles: [{ name: 'Lead Consultant', resourceGroup: 'functional', product: 'wm', weeklyHours: [40], totalHours: 40, overriddenWorkIndexes: [] }],
      phases: [{ id: 'design', name: 'Design', durationWeeks: 9, startDate: '2027-01-11', endDate: '2027-01-17', hours: 40, investment: 9800 }],
      products: [{ id: 'wm', name: 'Manhattan ACTIVE Warehouse Management', hours: 40, investment: 9800, weeklyHours: [40] }],
      weeklyHours: [40],
      weeklyFte: [1],
      totalHours: 40,
      baseInvestment: 9800,
      contingencyAmount: 0,
      totalInvestment: 9800,
      averageFte: 1,
      peakWeeklyBurnHours: 40,
      calendarWeeks: 1,
      workingWeeks: 1,
      holidays: [],
      trace: [],
    },
    assumptions: [{ description: 'Client SMEs available at kickoff.' }],
    risks: [{ description: 'Integration partner readiness unconfirmed.' }],
    decisions: [{ description: 'Confirm rollout sequence.' }],
  };
}

describe('artifact documents', () => {
  it('labels a draft plan clearly as Draft', () => {
    const brief = buildSalesTransitionBrief(baseContext('Draft'));
    expect(brief).toContain('**Status:** Draft');
    expect(brief).toContain('not yet approved');
  });

  it('labels an approved plan as Approved without the draft caveat', () => {
    const brief = buildSalesTransitionBrief(baseContext('Approved'));
    expect(brief).toContain('**Status:** Approved');
    expect(brief).not.toContain('not yet approved');
  });

  it('always marks the SOW as a draft regardless of plan status', () => {
    const sow = buildDraftSow(baseContext('Approved'));
    expect(sow).toContain('DRAFT');
  });

  it('includes transition id, plan version id, timestamp, status, template version, and prepared-by', () => {
    const brief = buildSalesTransitionBrief(baseContext('Draft'));
    expect(brief).toContain('t1');
    expect(brief).toContain('pv1');
    expect(brief).toContain('2027-01-01T00:00:00.000Z');
    expect(brief).toContain('24-Week Single Site MAWM v1');
    expect(brief).toContain('Alex Rivera');
  });
});

describe('burn plan workbook', () => {
  it('builds all required sheets from the calculation result', () => {
    const wb = buildBurnPlanWorkbook(baseContext('Approved'));
    const names = wb.worksheets.map((s) => s.name);
    expect(names).toEqual(['Summary', 'Phase Summary', 'Product Summary', 'Weekly Burn', 'Role Detail']);
    const phaseSheet = wb.getWorksheet('Phase Summary')!;
    expect(phaseSheet.getRow(2).getCell(1).value).toBe('Design');
  });
});
