import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_MANAGE_TEMPLATES, requireRole } from '@/lib/rbac';
import { templateTransitionSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { assertTemplateTransition } from '@/domain/templates/service';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_MANAGE_TEMPLATES);
    const body = templateTransitionSchema.parse(await req.json());

    const template = await db.template.findUnique({ where: { id: params.id } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    assertTemplateTransition(template.status as 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'RETIRED', body.to);

    const updated = await db.template.update({ where: { id: params.id }, data: { status: body.to } });

    await recordAuditEvent({
      actorId: user.id,
      action: `template.${body.to.toLowerCase()}`,
      entityType: 'Template',
      entityId: template.id,
      details: { from: template.status, to: body.to },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
