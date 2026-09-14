import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local filesystem artifact storage for this build. In a Flow Builder
 * deployment this should be swapped for the platform's blob storage; the
 * ArtifactJob.fileReference field is storage-agnostic (a relative path
 * here, a blob key/URL there).
 */
const STORAGE_ROOT = path.join(process.cwd(), 'artifact-storage');

export async function saveArtifactFile(jobId: string, filename: string, content: Buffer | string): Promise<string> {
  const dir = path.join(STORAGE_ROOT, jobId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content);
  return path.relative(process.cwd(), filePath);
}

export function resolveArtifactFile(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}
