import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local filesystem storage for documents uploaded against a project.
 * Swap for real blob storage in a Flow Builder deployment — ProjectDocument.storagePath
 * is storage-agnostic (a relative path here, a blob key/URL there).
 */
const STORAGE_ROOT = path.join(process.cwd(), 'project-documents');

export async function saveProjectDocument(transitionId: string, docId: string, filename: string, content: Buffer): Promise<string> {
  const dir = path.join(STORAGE_ROOT, transitionId, docId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content);
  return path.relative(process.cwd(), filePath);
}

export function resolveProjectDocument(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}
