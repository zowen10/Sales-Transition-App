'use client';

import { CANONICAL_ISSUE_FIELDS, type CanonicalIssueField, type SuggestedMapping } from '@/domain/issueAnalysis/types';

const FIELD_LABELS: Record<CanonicalIssueField, string> = {
  externalId: 'Issue / case ID',
  issueType: 'Issue type',
  priority: 'Priority',
  status: 'Status',
  createdDate: 'Created date',
  resolvedDate: 'Resolved date',
  reopenedCount: 'Reopened count',
  blockedTestCaseCount: 'Blocked test cases',
};

export type MappingDraft = Record<CanonicalIssueField, string | null>;

export function mappingDraftFromSuggestion(suggestion: SuggestedMapping): MappingDraft {
  const draft = {} as MappingDraft;
  for (const field of CANONICAL_ISSUE_FIELDS) draft[field] = suggestion[field]?.column ?? null;
  return draft;
}

/**
 * The LLM-mapping stage gate: shows what the model interpreted each
 * canonical field's source column to be (with confidence), and lets the PM
 * override any of them before anything is parsed into IssueRecord rows.
 */
export default function MappingReviewTable({
  headers,
  suggestion,
  draft,
  onChange,
}: {
  headers: string[];
  suggestion: SuggestedMapping;
  draft: MappingDraft;
  onChange: (next: MappingDraft) => void;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
          <th style={{ padding: '8px 10px' }}>Field</th>
          <th style={{ padding: '8px 10px' }}>LLM-suggested column</th>
          <th style={{ padding: '8px 10px' }}>Confidence</th>
          <th style={{ padding: '8px 10px' }}>Confirmed column</th>
        </tr>
      </thead>
      <tbody>
        {CANONICAL_ISSUE_FIELDS.map((field) => {
          const suggested = suggestion[field];
          const edited = draft[field] !== (suggested?.column ?? null);
          return (
            <tr key={field} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{FIELD_LABELS[field]}</td>
              <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{suggested?.column ?? '— no match —'}</td>
              <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                {suggested?.column ? `${Math.round(suggested.confidence * 100)}%` : '—'}
              </td>
              <td style={{ padding: '8px 10px' }}>
                <select
                  className="input"
                  value={draft[field] ?? ''}
                  onChange={(e) => onChange({ ...draft, [field]: e.target.value || null })}
                  style={{ fontWeight: edited ? 800 : 400, borderColor: edited ? 'var(--teal)' : undefined }}
                >
                  <option value="">— unmapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
