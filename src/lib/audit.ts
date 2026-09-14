import { db } from './db';

/**
 * Records a material action to the audit trail. Never pass raw transcripts
 * or full commercial detail into `details` beyond what's needed to
 * reconstruct "what changed" — this is a change log, not a transcript
 * archive.
 */
export async function recordAuditEvent(input: {
  transitionId?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.auditEvent.create({
    data: {
      transitionId: input.transitionId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ? JSON.stringify(input.details) : null,
    },
  });
}
