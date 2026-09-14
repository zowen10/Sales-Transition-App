import ExcelJS from 'exceljs';
import type { ArtifactContext } from './types';

/**
 * Builds the Approved Burn Plan Excel workbook from a plan's calculation
 * result. All values come directly from EstimationResult — nothing is
 * recalculated or estimated in the workbook itself.
 */
export function buildBurnPlanWorkbook(ctx: ArtifactContext): ExcelJS.Workbook {
  const { metadata: m, result } = ctx;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sales Transition App';
  wb.created = new Date(m.generatedAt);

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 32 }, { width: 28 }];
  summary.addRows([
    ['Transition', m.transitionName],
    ['Transition ID', m.transitionId],
    ['Plan version', m.planVersionLabel],
    ['Plan version ID', m.planVersionId],
    ['Status', m.status],
    ['Template used', `${m.templateName} v${m.templateVersion}`],
    ['Generated', m.generatedAt],
    ['Prepared by', m.preparedBy],
    [],
    ['Total investment', result.totalInvestment],
    ['Base investment', result.baseInvestment],
    ['Contingency amount', result.contingencyAmount],
    ['MA hours', result.totalHours],
    ['Average FTE', result.averageFte],
    ['Peak weekly burn (hours)', result.peakWeeklyBurnHours],
    ['Calendar weeks', result.calendarWeeks],
    ['Working weeks', result.workingWeeks],
  ]);
  summary.getColumn(2).numFmt = '#,##0.00';

  const phaseSheet = wb.addWorksheet('Phase Summary');
  phaseSheet.columns = [
    { header: 'Phase', key: 'name', width: 20 },
    { header: 'Weeks', key: 'weeks', width: 10 },
    { header: 'Hours', key: 'hours', width: 12 },
    { header: 'Investment', key: 'investment', width: 16 },
    { header: 'Start', key: 'start', width: 14 },
    { header: 'End', key: 'end', width: 14 },
  ];
  result.phases.forEach((p) =>
    phaseSheet.addRow({ name: p.name, weeks: p.durationWeeks, hours: Math.round(p.hours), investment: Math.round(p.investment), start: p.startDate, end: p.endDate })
  );

  const productSheet = wb.addWorksheet('Product Summary');
  productSheet.columns = [
    { header: 'Product Workstream', key: 'name', width: 40 },
    { header: 'Hours', key: 'hours', width: 12 },
    { header: 'Investment', key: 'investment', width: 16 },
  ];
  result.products.forEach((p) => productSheet.addRow({ name: p.name, hours: Math.round(p.hours), investment: Math.round(p.investment) }));

  const weeklySheet = wb.addWorksheet('Weekly Burn');
  weeklySheet.columns = [
    { header: 'Cal. Week', key: 'week', width: 10 },
    { header: 'Week Start', key: 'start', width: 14 },
    { header: 'Phase', key: 'phase', width: 14 },
    { header: 'Holiday', key: 'holiday', width: 16 },
    { header: 'Weekly Hours', key: 'hours', width: 14 },
    { header: 'Weekly FTE', key: 'fte', width: 12 },
  ];
  result.weeks.forEach((w, i) =>
    weeklySheet.addRow({
      week: w.index,
      start: w.weekStart,
      phase: w.phaseId ?? 'Blackout',
      holiday: w.holiday?.name ?? '',
      hours: Math.round(result.weeklyHours[i] ?? 0),
      fte: Number((result.weeklyFte[i] ?? 0).toFixed(2)),
    })
  );

  const roleSheet = wb.addWorksheet('Role Detail');
  roleSheet.columns = [
    { header: 'Role', key: 'role', width: 40 },
    { header: 'Resource Group', key: 'group', width: 16 },
    { header: 'Product', key: 'product', width: 14 },
    { header: 'Total Hours', key: 'hours', width: 14 },
    { header: 'Has Overrides', key: 'override', width: 14 },
  ];
  result.roles.forEach((r) =>
    roleSheet.addRow({
      role: r.name,
      group: r.resourceGroup,
      product: r.product,
      hours: Math.round(r.totalHours),
      override: r.overriddenWorkIndexes.length ? 'Yes' : 'No',
    })
  );

  return wb;
}
