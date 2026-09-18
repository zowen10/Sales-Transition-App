import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Local filesystem storage for uploaded issue-list exports, same pattern as documentStorage.ts. */
const STORAGE_ROOT = path.join(process.cwd(), 'issue-imports');

export async function saveIssueImportFile(batchId: string, filename: string, content: Buffer): Promise<string> {
  const dir = path.join(STORAGE_ROOT, batchId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content);
  return path.relative(process.cwd(), filePath);
}
