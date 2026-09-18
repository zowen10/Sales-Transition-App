import type { ConfirmedMapping } from '@/domain/issueAnalysis/types';

export interface MappedIssueRow {
  externalId: string | null;
  issueType: string | null;
  priority: string | null;
  status: string | null;
  createdDate: Date | null;
  resolvedDate: Date | null;
  reopenedCount: number;
  blockedTestCaseCount: number;
  raw: string;
}

function textField(row: Record<string, string>, column: string | null): string | null {
  if (!column) return null;
  const value = row[column];
  return value && value.trim() ? value.trim() : null;
}

function dateField(row: Record<string, string>, column: string | null): Date | null {
  const raw = textField(row, column);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function intField(row: Record<string, string>, column: string | null): number {
  const raw = textField(row, column);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Applies a PM-confirmed column mapping (never the LLM's raw suggestion) to
 * parsed raw rows, producing the canonical fields an IssueRecord stores. The
 * original row is kept verbatim in `raw` for traceability back to the
 * source export.
 */
export function applyMapping(rows: Record<string, string>[], mapping: ConfirmedMapping): MappedIssueRow[] {
  return rows.map((row) => ({
    externalId: textField(row, mapping.externalId),
    issueType: textField(row, mapping.issueType),
    priority: textField(row, mapping.priority),
    status: textField(row, mapping.status),
    createdDate: dateField(row, mapping.createdDate),
    resolvedDate: dateField(row, mapping.resolvedDate),
    reopenedCount: intField(row, mapping.reopenedCount),
    blockedTestCaseCount: intField(row, mapping.blockedTestCaseCount),
    raw: JSON.stringify(row),
  }));
}
