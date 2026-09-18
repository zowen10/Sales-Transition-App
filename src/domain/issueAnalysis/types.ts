/**
 * Issue-analysis domain types. Pure over IssueRecord data — never touches an
 * LLM. The LLM only ever proposes which raw column maps to which of these
 * canonical fields (src/adapters/issueImportMapping); a human confirms that
 * mapping before any row is parsed into an IssueRecord these functions read.
 */

export const CANONICAL_ISSUE_FIELDS = [
  'externalId',
  'issueType',
  'priority',
  'status',
  'createdDate',
  'resolvedDate',
  'reopenedCount',
  'blockedTestCaseCount',
] as const;

export type CanonicalIssueField = (typeof CANONICAL_ISSUE_FIELDS)[number];

/** What a human ultimately confirms at the mapping stage gate: source column name, or null if unmapped. */
export type ConfirmedMapping = Record<CanonicalIssueField, string | null>;

export interface MappingSuggestion {
  column: string | null;
  confidence: number; // 0-1; 0 when the field couldn't be matched
}

export type SuggestedMapping = Record<CanonicalIssueField, MappingSuggestion>;

export interface IssueRecordLike {
  id: string;
  externalId: string | null;
  issueType: string | null;
  priority: string | null;
  status: string | null;
  createdDate: string | null; // ISO date
  resolvedDate: string | null; // ISO date
  reopenedCount: number;
  blockedTestCaseCount: number;
}

export interface IssueTypeBreakdownRow {
  issueType: string;
  count: number;
  percentOfTotal: number;
}

export interface ArrivalRatePoint {
  date: string; // ISO date, one bucket
  createdCount: number;
  resolvedCount: number;
}

export interface TurnaroundTimeStat {
  issueType: string;
  sampleSize: number;
  medianDays: number;
  p90Days: number;
}

export interface ReopenRateStat {
  resolvedCount: number;
  reopenedCount: number;
  reopenRatePercent: number;
}

export interface BlockedCaseImpactStat {
  openIssueCount: number;
  totalBlockedTestCases: number;
  averageBlockedPerOpenIssue: number;
}
