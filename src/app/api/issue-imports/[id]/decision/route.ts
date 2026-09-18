import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { issueImportDecisionSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Lets a PM be selective about which imports feed a scenario's derived
 * levers: include, exclude, or leave needs_review, plus an optional note
 * and an explicit expectedUplift adjustment (e.g. "UAT typically runs ~2x
 * SIT's issue rate") that stays visible as its own labeled step rather than
 * being folded silently into "the data said so".
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = issueImportDecisionSchema.parse(await req.json());

    const batch = await db.issueImportBatch.findUnique({ where: { id: params.id } });
    if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });

    const updated = await db.issueImportBatch.update({
      where: { id: params.id },
      data: {
        decision: body.decision,
        pmNote: body.pmNote,
        expectedUplift: body.expectedUplift === undefined ? undefined : body.expectedUplift ? JSON.stringify(body.expectedUplift) : null,
      },
    });

    await recordAuditEvent({
      actorId: user.id,
      action: 'issue_import.decision_updated',
      entityType: 'IssueImportBatch',
      entityId: updated.id,
      details: body,
    });

    return NextResponse.json({ id: updated.id, decision: updated.decision, pmNote: updated.pmNote });
  } catch (err) {
    return handleApiError(err);
  }
}
