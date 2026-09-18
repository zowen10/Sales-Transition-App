import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { confirmMappingSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { parseCsv } from '@/server/issueImport/csvParser';
import { parseXlsx } from '@/server/issueImport/xlsxParser';
import { applyMapping } from '@/server/issueImport/applyMapping';
import type { ConfirmedMapping } from '@/domain/issueAnalysis/types';
import { recordAuditEvent } from '@/lib/audit';

/**
 * The mapping stage gate's confirm step: takes the PM-reviewed (possibly
 * edited) mapping — never the LLM's raw suggestion directly — re-parses the
 * full stored file, and only now creates IssueRecord rows. Re-confirming
 * (e.g. after fixing a mapping mistake) replaces the previously parsed rows.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = confirmMappingSchema.parse(await req.json());

    const batch = await db.issueImportBatch.findUnique({ where: { id: params.id } });
    if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });

    const buffer = await readFile(path.join(process.cwd(), batch.storagePath));
    const isXlsx = /\.xlsx?$/i.test(batch.filename);
    const table = isXlsx ? await parseXlsx(buffer) : parseCsv(buffer.toString('utf-8'));

    const mapping = body.mapping as ConfirmedMapping;
    const mappedRows = applyMapping(table.rows, mapping);

    await db.$transaction(async (tx) => {
      await tx.issueRecord.deleteMany({ where: { importBatchId: batch.id } });
      if (mappedRows.length) {
        await tx.issueRecord.createMany({
          data: mappedRows.map((r) => ({ importBatchId: batch.id, ...r })),
        });
      }
      await tx.issueImportBatch.update({
        where: { id: batch.id },
        data: {
          confirmedMapping: JSON.stringify(mapping),
          mappingConfirmedById: user.id,
          mappingConfirmedAt: new Date(),
          rowCount: mappedRows.length,
        },
      });
    });

    await recordAuditEvent({
      actorId: user.id,
      action: 'issue_import.mapping_confirmed',
      entityType: 'IssueImportBatch',
      entityId: batch.id,
      details: { mapping, rowCount: mappedRows.length },
    });

    return NextResponse.json({ id: batch.id, rowCount: mappedRows.length });
  } catch (err) {
    return handleApiError(err);
  }
}
