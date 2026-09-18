import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';
import { solveRequiredFtes } from '@/domain/staffingModel/engine';
import { buildStaffingMarkdownSummary, buildStaffingWorkbook, type StaffingExportContext } from '@/domain/staffingModel/export';
import type { LeverConfig, ScenarioInput } from '@/domain/staffingModel/types';

/**
 * Synchronous export — no ArtifactJob/async storage needed, unlike the
 * Transition Excel export: the staffing simulation is fast enough to build
 * and stream in-memory on request.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const format = new URL(req.url).searchParams.get('format') === 'md' ? 'md' : 'xlsx';

    const scenario = await db.staffingScenario.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    const current = scenario.versions[0];
    if (!current) return NextResponse.json({ error: 'This plan has no version to export yet.' }, { status: 409 });

    const scenarioInput = JSON.parse(current.scenarioInput) as Omit<ScenarioInput, 'levers'>;
    const levers = JSON.parse(current.leverConfig) as LeverConfig;
    const { sensitivity, recommendedFtes } = solveRequiredFtes({ ...scenarioInput, levers });

    const ctx: StaffingExportContext = {
      scenarioName: scenario.name,
      versionLabel: current.label,
      versionNumber: current.versionNumber,
      generatedAt: new Date().toISOString(),
      scenarioInput,
      levers,
      result: JSON.parse(current.resultSnapshot),
      sensitivity,
      recommendedFtes,
    };

    const safeName = scenario.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();

    if (format === 'md') {
      const markdown = buildStaffingMarkdownSummary(ctx);
      return new NextResponse(markdown, {
        headers: {
          'content-type': 'text/markdown',
          'content-disposition': `attachment; filename="${safeName}-v${current.versionNumber}.md"`,
        },
      });
    }

    const workbook = buildStaffingWorkbook(ctx);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return new NextResponse(buffer, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${safeName}-v${current.versionNumber}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
