import type { CanonicalIssueField, SuggestedMapping } from '@/domain/issueAnalysis/types';
import type { ColumnMappingAdapter, MappingSampleInput } from './types';

const MAX_SAMPLE_ROWS = 20;

const FIELD_DESCRIPTIONS: Record<CanonicalIssueField, string> = {
  externalId: 'the issue/case/ticket identifier',
  issueType: 'the issue type or category (e.g. defect, config, data, enhancement)',
  priority: 'priority or severity',
  status: 'current workflow status (e.g. open, in progress, resolved, closed)',
  createdDate: 'the date the issue was created/opened/submitted',
  resolvedDate: 'the date the issue was resolved/closed',
  reopenedCount: 'how many times the issue was reopened (a count, not a boolean)',
  blockedTestCaseCount: 'how many test cases this issue is blocking',
};

function buildSampleTable(input: MappingSampleInput): string {
  const rows = input.sampleRows.slice(0, MAX_SAMPLE_ROWS);
  const lines = [input.headers.join(' | '), ...rows.map((row) => input.headers.map((h) => row[h] ?? '').join(' | '))];
  return lines.join('\n');
}

/**
 * Uses the Anthropic Messages API to propose which raw export column maps to
 * each canonical issue field, from the header row and a few sample rows.
 * Strictly grounded: a field with no supportable column in the data is left
 * unmapped rather than guessed. This is always a proposal — the mapping
 * stage gate UI shows it to a human to review/edit/confirm before any row is
 * parsed into an IssueRecord (see src/adapters/documentExtraction/anthropic.ts
 * for the same "propose, never write directly" posture this mirrors).
 */
export class AnthropicColumnMappingAdapter implements ColumnMappingAdapter {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async suggestMapping(input: MappingSampleInput): Promise<SuggestedMapping> {
    if (!input.headers.length) {
      return Object.fromEntries(input.canonicalFields.map((f) => [f, { column: null, confidence: 0 }])) as SuggestedMapping;
    }

    const fieldList = input.canonicalFields.map((f) => `- "${f}": ${FIELD_DESCRIPTIONS[f]}`).join('\n');
    const prompt = `You are mapping columns from an uploaded issue-tracking export (e.g. a Salesforce case export) to a fixed set of canonical fields, to help a PM review before the data is used.

Source columns and a sample of rows:
${buildSampleTable(input)}

Canonical fields to map, each to exactly one of the source column names above (or omit if no column supports it):
${fieldList}

Respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:
{"<canonical field>": {"column": "<exact source column name>" | null, "confidence": <0 to 1 number>}}

Only map a field to a column when the sample data actually supports it. Never invent a column name that isn't in the source columns list. Omit or set column to null for a field with no reasonable match.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '{}';

    let parsed: Record<string, { column?: unknown; confidence?: unknown }>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {};
    }

    const validColumns = new Set(input.headers);
    const result = {} as SuggestedMapping;
    for (const field of input.canonicalFields) {
      const raw = parsed[field];
      const column = typeof raw?.column === 'string' && validColumns.has(raw.column) ? raw.column : null;
      const confidence = column && typeof raw?.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0;
      result[field] = { column, confidence };
    }
    return result;
  }
}
