import type { CanonicalIssueField, SuggestedMapping } from '@/domain/issueAnalysis/types';
import type { ColumnMappingAdapter, MappingSampleInput } from './types';

/**
 * Deterministic fuzzy header-name matching, used when ANTHROPIC_API_KEY
 * isn't configured — the mapping stage gate still works, just with lower
 * suggestion quality. Never fabricates a match: a field with no reasonable
 * candidate is left unmapped (confidence 0) for the PM to fill in by hand.
 */
const FIELD_HINTS: Record<CanonicalIssueField, string[]> = {
  externalId: ['id', 'issue id', 'issue number', 'case number', 'key', 'number'],
  issueType: ['type', 'issue type', 'category', 'record type'],
  priority: ['priority', 'severity'],
  status: ['status', 'stage'],
  createdDate: ['created', 'created date', 'open date', 'date opened', 'submitted'],
  resolvedDate: ['resolved', 'resolved date', 'closed date', 'close date', 'date closed'],
  reopenedCount: ['reopen', 'reopened', 'reopen count', 'times reopened'],
  blockedTestCaseCount: ['blocked', 'blocked cases', 'blocked test cases', 'cases blocked'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreMatch(header: string, hints: string[]): number {
  const normalizedHeader = normalize(header);
  let best = 0;
  for (const hint of hints) {
    const normalizedHint = normalize(hint);
    if (normalizedHeader === normalizedHint) best = Math.max(best, 1);
    else if (normalizedHeader.includes(normalizedHint) || normalizedHint.includes(normalizedHeader)) best = Math.max(best, 0.6);
  }
  return best;
}

export class MockColumnMappingAdapter implements ColumnMappingAdapter {
  async suggestMapping(input: MappingSampleInput): Promise<SuggestedMapping> {
    const result = {} as SuggestedMapping;
    for (const field of input.canonicalFields) {
      let best: { column: string; score: number } | null = null;
      for (const header of input.headers) {
        const score = scoreMatch(header, FIELD_HINTS[field]);
        if (score > 0 && (!best || score > best.score)) best = { column: header, score };
      }
      result[field] = best ? { column: best.column, confidence: best.score } : { column: null, confidence: 0 };
    }
    return result;
  }
}
