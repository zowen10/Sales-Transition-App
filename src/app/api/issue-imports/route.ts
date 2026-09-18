import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { handleApiError } from '@/server/apiError';
import { parseCsv } from '@/server/issueImport/csvParser';
import { parseXlsx } from '@/server/issueImport/xlsxParser';
import { saveIssueImportFile } from '@/server/issueImportStorage';
import { getColumnMappingAdapter } from '@/adapters/issueImportMapping';
import { CANONICAL_ISSUE_FIELDS } from '@/domain/issueAnalysis/types';
import { recordAuditEvent } from '@/lib/audit';

const SAMPLE_ROW_COUNT = 20;

export async function GET(req: Request) {
  try {
    await requireCurrentUser();
    const scenarioId = new URL(req.url).searchParams.get('scenarioId');
    const batches = await db.issueImportBatch.findMany({
      where: scenarioId ? { scenarioId } : undefined,
      orderBy: { uploadedAt: 'desc' },
      include: { uploadedBy: { select: { name: true } } },
    });
    return NextResponse.json({
      batches: batches.map((b) => ({
        id: b.id,
        filename: b.filename,
        stageLabel: b.stageLabel,
        purpose: b.purpose,
        asOfDate: b.asOfDate?.toISOString() ?? null,
        rowCount: b.rowCount,
        decision: b.decision,
        pmNote: b.pmNote,
        expectedUplift: b.expectedUplift ? JSON.parse(b.expectedUplift) : null,
        mappingConfirmed: Boolean(b.confirmedMapping),
        uploadedByName: b.uploadedBy.name,
        uploadedAt: b.uploadedAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Uploads a raw issue-list export, parses its header + a sample of rows, and
 * asks the column-mapping adapter to propose a mapping. Nothing is parsed
 * into IssueRecord rows yet — that only happens once a human confirms the
 * mapping at the stage gate (POST .../mapping/confirm).
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const scenarioId = (form.get('scenarioId') as string) || undefined;
    const stageLabel = (form.get('stageLabel') as string) || undefined;
    const purpose = (form.get('purpose') as string) === 'actuals_checkpoint' ? 'actuals_checkpoint' : 'baseline';
    const asOfDate = form.get('asOfDate') ? new Date(form.get('asOfDate') as string) : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const table = isXlsx ? await parseXlsx(buffer) : parseCsv(buffer.toString('utf-8'));

    if (!table.headers.length) {
      return NextResponse.json({ error: 'Could not detect any columns in the uploaded file.' }, { status: 400 });
    }

    const batch = await db.issueImportBatch.create({
      data: {
        scenarioId,
        filename: file.name,
        storagePath: '',
        stageLabel,
        purpose,
        asOfDate,
        rowCount: table.rows.length,
        uploadedById: user.id,
      },
    });

    const storagePath = await saveIssueImportFile(batch.id, file.name, buffer);

    const suggestedMapping = await getColumnMappingAdapter().suggestMapping({
      headers: table.headers,
      sampleRows: table.rows.slice(0, SAMPLE_ROW_COUNT),
      canonicalFields: CANONICAL_ISSUE_FIELDS,
    });

    const updated = await db.issueImportBatch.update({
      where: { id: batch.id },
      data: { storagePath, suggestedMapping: JSON.stringify(suggestedMapping) },
    });

    await recordAuditEvent({
      actorId: user.id,
      action: 'issue_import.uploaded',
      entityType: 'IssueImportBatch',
      entityId: batch.id,
      details: { filename: file.name, rowCount: table.rows.length, purpose },
    });

    return NextResponse.json(
      {
        id: updated.id,
        headers: table.headers,
        sampleRows: table.rows.slice(0, 10),
        rowCount: table.rows.length,
        suggestedMapping,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
