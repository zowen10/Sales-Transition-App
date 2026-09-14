import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_MANAGE_TEMPLATES, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { buildClonedTemplateDraft } from '@/domain/templates/service';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_MANAGE_TEMPLATES);

    const source = await db.template.findUnique({ where: { id: params.id } });
    if (!source) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const siblings = await db.template.findMany({ where: { templateFamilyId: source.templateFamilyId }, select: { version: true } });
    const draft = buildClonedTemplateDraft(
      {
        id: source.id,
        templateFamilyId: source.templateFamilyId,
        name: source.name,
        type: source.type,
        applicablePlanTypes: JSON.parse(source.applicablePlanTypes),
        applicableProducts: JSON.parse(source.applicableProducts),
        body: JSON.parse(source.body),
      },
      siblings.map((s) => s.version),
      user.id
    );

    const cloned = await db.template.create({
      data: {
        templateFamilyId: draft.templateFamilyId,
        name: draft.name,
        description: source.description,
        type: draft.type,
        ownerId: draft.ownerId,
        version: draft.version,
        status: draft.status,
        applicablePlanTypes: JSON.stringify(draft.applicablePlanTypes),
        applicableProducts: JSON.stringify(draft.applicableProducts),
        body: JSON.stringify(draft.body),
        clonedFromId: draft.clonedFromId,
        createdBy: user.id,
      },
    });

    await recordAuditEvent({
      actorId: user.id,
      action: 'template.cloned',
      entityType: 'Template',
      entityId: cloned.id,
      details: { clonedFromId: source.id },
    });

    return NextResponse.json(cloned, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
