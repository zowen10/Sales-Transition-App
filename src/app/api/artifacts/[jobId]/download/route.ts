import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';
import { resolveArtifactFile } from '@/server/artifactStorage';

const CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  try {
    await requireCurrentUser();
    const job = await db.artifactJob.findUnique({ where: { id: params.jobId } });
    if (!job || !job.fileReference) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });

    const filePath = resolveArtifactFile(job.fileReference);
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath);
    return new NextResponse(buffer, {
      headers: {
        'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'content-disposition': `attachment; filename="${path.basename(filePath)}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
