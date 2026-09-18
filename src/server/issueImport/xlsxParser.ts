import ExcelJS from 'exceljs';
import type { ParsedTable } from './csvParser';

export async function parseXlsx(buffer: Buffer): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (!header) return;
      const cell = row.getCell(i + 1);
      const value = cell.value;
      record[header] = value === null || value === undefined ? '' : String(value instanceof Date ? value.toISOString() : value);
    });
    rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows };
}
