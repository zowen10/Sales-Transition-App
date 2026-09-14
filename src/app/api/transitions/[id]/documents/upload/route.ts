import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_EDIT_INTAKE, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { saveProjectDocument } from '@/server/documentStorage';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Stores an uploaded file against a project. Documents are shown for the
 * Engagement Director to reference — nothing is auto-extracted into intake
 * answers.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_EDIT_INTAKE);

    const transition = await db.transition.findUnique({ where: { id: params.id } });
    if (!transition) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const doc = await db.projectDocument.create({
      data: {
        transitionId: params.id,
        source: 'upload',
        filename: file.name,
        uploadedById: user.id,
      },
    });

    const storagePath = await saveProjectDocument(params.id, doc.id, file.name, buffer);
    const updated = await db.projectDocument.update({
      where: { id: doc.id },
      data: { storagePath },
      include: { uploadedBy: { select: { name: true } } },
    });

    await recordAuditEvent({
      transitionId: params.id,
      actorId: user.id,
      action: 'document.uploaded',
      entityType: 'ProjectDocument',
      entityId: doc.id,
      details: { filename: file.name },
    });

    return NextResponse.json(
      {
        id: updated.id,
        source: updated.source,
        filename: updated.filename,
        sharepointUrl: updated.sharepointUrl,
        uploadedByName: updated.uploadedBy.name,
        uploadedAt: updated.uploadedAt,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
