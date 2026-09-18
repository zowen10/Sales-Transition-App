import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';
import {
  computeArrivalRate,
  computeBlockedCaseImpact,
  computeIssueTypeBreakdown,
  computeReopenRate,
  computeTurnaroundTime,
} from '@/domain/issueAnalysis/metrics';
import type { IssueRecordLike } from '@/domain/issueAnalysis/types';

/**
 * Issue-list analysis for a single import batch — usable the moment a
 * mapping is confirmed, independent of any staffing scenario.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const batch = await db.issueImportBatch.findUnique({ where: { id: params.id }, include: { records: true } });
    if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    if (!batch.confirmedMapping) {
      return NextResponse.json({ error: 'Column mapping has not been confirmed for this import yet.' }, { status: 409 });
    }

    const records: IssueRecordLike[] = batch.records.map((r) => ({
      id: r.id,
      externalId: r.externalId,
      issueType: r.issueType,
      priority: r.priority,
      status: r.status,
      createdDate: r.createdDate?.toISOString() ?? null,
      resolvedDate: r.resolvedDate?.toISOString() ?? null,
      reopenedCount: r.reopenedCount,
      blockedTestCaseCount: r.blockedTestCaseCount,
    }));

    return NextResponse.json({
      rowCount: records.length,
      issueTypeBreakdown: computeIssueTypeBreakdown(records),
      arrivalRate: computeArrivalRate(records),
      turnaroundTime: computeTurnaroundTime(records),
      reopenRate: computeReopenRate(records),
      blockedCaseImpact: computeBlockedCaseImpact(records),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
