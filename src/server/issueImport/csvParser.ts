import Papa from 'papaparse';

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedTable {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data };
}
