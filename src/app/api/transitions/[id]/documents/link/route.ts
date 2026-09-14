import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_EDIT_INTAKE, requireRole } from '@/lib/rbac';
import { linkSharepointDocumentSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Registers a link to a document living in the project's Sales Transition
 * SharePoint folder. This does NOT crawl or fetch from SharePoint — no
 * Graph API credentials are configured in this build. It just records the
 * link so it shows in the project's document list alongside uploads.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_EDIT_INTAKE);
    const body = linkSharepointDocumentSchema.parse(await req.json());

    const transition = await db.transition.findUnique({ where: { id: params.id } });
    if (!transition) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const doc = await db.projectDocument.create({
      data: {
        transitionId: params.id,
        source: 'sharepoint_link',
        filename: body.filename,
        sharepointUrl: body.sharepointUrl,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: { name: true } } },
    });

    await recordAuditEvent({
      transitionId: params.id,
      actorId: user.id,
      action: 'document.linked',
      entityType: 'ProjectDocument',
      entityId: doc.id,
      details: { filename: body.filename },
    });

    return NextResponse.json(
      {
        id: doc.id,
        source: doc.source,
        filename: doc.filename,
        sharepointUrl: doc.sharepointUrl,
        uploadedByName: doc.uploadedBy.name,
        uploadedAt: doc.uploadedAt,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
