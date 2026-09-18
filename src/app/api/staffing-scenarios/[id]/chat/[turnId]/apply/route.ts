import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';

/** Marks a chat turn's proposal as applied — audit-only; the actual lever values are written by the simulate route once the PM recalculates. */
export async function POST(_req: Request, { params }: { params: { id: string; turnId: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const turn = await db.scenarioChatTurn.update({ where: { id: params.turnId }, data: { applied: true } });
    return NextResponse.json({ id: turn.id, applied: turn.applied });
  } catch (err) {
    return handleApiError(err);
  }
}
