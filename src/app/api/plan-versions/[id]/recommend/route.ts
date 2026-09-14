import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_GENERATE_PLAN, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { versionsToUnrecommend } from '@/domain/versioning/service';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_GENERATE_PLAN);

    const pv = await db.planVersion.findUnique({ where: { id: params.id } });
    if (!pv) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });

    const siblings = await db.planVersion.findMany({
      where: { transitionId: pv.transitionId },
      select: { id: true, recommended: true },
    });
    const toUnset = versionsToUnrecommend(siblings, pv.id);

    await db.$transaction([
      ...toUnset.map((id) => db.planVersion.update({ where: { id }, data: { recommended: false } })),
      db.planVersion.update({ where: { id: pv.id }, data: { recommended: true } }),
    ]);

    await recordAuditEvent({
      transitionId: pv.transitionId,
      actorId: user.id,
      action: 'scenario.recommended',
      entityType: 'PlanVersion',
      entityId: pv.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
