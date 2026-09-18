import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';
import { deriveLevers } from '@/domain/issueAnalysis/deriveLevers';
import type { IssueRecordLike } from '@/domain/issueAnalysis/types';

/**
 * Computes a lever-config proposal from every `include`-decision issue
 * import attached to this scenario, plus any expectedUplift each batch
 * carries. Read-only — never writes to the scenario. The workspace UI shows
 * this as a diff against the current lever values and only writes anything
 * once the PM clicks Apply, then Recalculate.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();

    const batches = await db.issueImportBatch.findMany({
      where: { scenarioId: params.id, decision: 'include', confirmedMapping: { not: null } },
      include: { records: true },
    });

    if (!batches.length) {
      return NextResponse.json({ error: 'No included, mapping-confirmed issue imports are attached to this plan yet.' }, { status: 409 });
    }

    const records: IssueRecordLike[] = batches.flatMap((b) =>
      b.records.map((r) => ({
        id: r.id,
        externalId: r.externalId,
        issueType: r.issueType,
        priority: r.priority,
        status: r.status,
        createdDate: r.createdDate?.toISOString() ?? null,
        resolvedDate: r.resolvedDate?.toISOString() ?? null,
        reopenedCount: r.reopenedCount,
        blockedTestCaseCount: r.blockedTestCaseCount,
      }))
    );

    const uplifts = batches
      .map((b) => (b.expectedUplift ? JSON.parse(b.expectedUplift) : null))
      .filter((u): u is { reason: string; effectiveFrom: number; adjustment: number } => Boolean(u));

    const proposal = deriveLevers(records, uplifts);

    return NextResponse.json({
      sourceBatches: batches.map((b) => ({ id: b.id, stageLabel: b.stageLabel, filename: b.filename, rowCount: b.records.length })),
      proposal,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
