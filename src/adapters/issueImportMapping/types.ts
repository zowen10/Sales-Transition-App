import type { CanonicalIssueField, SuggestedMapping } from '@/domain/issueAnalysis/types';

export interface MappingSampleInput {
  headers: string[];
  sampleRows: Record<string, string>[];
  canonicalFields: readonly CanonicalIssueField[];
}

/**
 * Proposes which raw export column corresponds to each canonical issue
 * field, from the header row and a few sample rows. This is a proposal
 * only — the mapping stage gate always shows it to a human for review/edit
 * before anything is parsed into IssueRecord rows (mirrors
 * DocumentIntakeExtractor's "suggest, human confirms, never write directly"
 * posture).
 */
export interface ColumnMappingAdapter {
  suggestMapping(input: MappingSampleInput): Promise<SuggestedMapping>;
}
