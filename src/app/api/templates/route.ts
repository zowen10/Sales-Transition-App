import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_MANAGE_TEMPLATES, requireRole } from '@/lib/rbac';
import { templateCreateSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { recordAuditEvent } from '@/lib/audit';

export async function GET(req: Request) {
  try {
    await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const templates = await db.template.findMany({
      where: { type: type ?? undefined, status: status ?? undefined },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ templateFamilyId: 'asc' }, { version: 'desc' }],
    });
    return NextResponse.json(templates);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_MANAGE_TEMPLATES);
    const body = templateCreateSchema.parse(await req.json());
    const templateFamilyId = body.templateFamilyId ?? `${body.type.toLowerCase()}-${Date.now()}`;

    const template = await db.template.create({
      data: {
        templateFamilyId,
        name: body.name,
        description: body.description,
        type: body.type,
        ownerId: user.id,
        version: 1,
        status: 'DRAFT',
        applicablePlanTypes: JSON.stringify(body.applicablePlanTypes),
        applicableProducts: JSON.stringify(body.applicableProducts),
        body: JSON.stringify(body.body ?? {}),
        createdBy: user.id,
      },
    });

    await recordAuditEvent({ actorId: user.id, action: 'template.created', entityType: 'Template', entityId: template.id });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
