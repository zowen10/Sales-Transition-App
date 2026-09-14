import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';
import { resolveProjectDocument } from '@/server/documentStorage';

export async function GET(_req: Request, { params }: { params: { docId: string } }) {
  try {
    await requireCurrentUser();
    const doc = await db.projectDocument.findUnique({ where: { id: params.docId } });
    if (!doc || !doc.storagePath) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const filePath = resolveProjectDocument(doc.storagePath);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${path.basename(doc.filename)}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
