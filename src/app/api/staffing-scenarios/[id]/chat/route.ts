import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { CAN_RUN_STAFFING_MODEL, requireRole } from '@/lib/rbac';
import { scenarioChatMessageSchema } from '@/server/schemas';
import { handleApiError } from '@/server/apiError';
import { getScenarioChatAdapter } from '@/adapters/scenarioChat';
import type { ScenarioInput, LeverConfig, SimulationResult, VarianceSummary } from '@/domain/staffingModel/types';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCurrentUser();
    const scenario = await db.staffingScenario.findUnique({ where: { id: params.id } });
    if (!scenario?.currentVersionId) return NextResponse.json({ turns: [] });
    const turns = await db.scenarioChatTurn.findMany({
      where: { scenarioVersionId: scenario.currentVersionId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({
      turns: turns.map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content,
        proposedChange: t.proposedChange ? JSON.parse(t.proposedChange) : null,
        applied: t.applied,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Sends a user message to the scenario chat adapter and persists both turns.
 * The adapter (Anthropic when configured, a no-op explainer otherwise) only
 * ever returns prose plus an optional structured lever-diff proposal — it
 * never computes a number or writes to the scenario. The workspace UI shows
 * `proposedChange` as the same applyable diff used for derive-from-import
 * proposals; applying it is a separate, explicit action.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    requireRole(user.roles, ...CAN_RUN_STAFFING_MODEL);
    const body = scenarioChatMessageSchema.parse(await req.json());

    const scenario = await db.staffingScenario.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    const current = scenario.versions[0];
    if (!current) return NextResponse.json({ error: 'This plan has no version to discuss yet.' }, { status: 409 });

    const priorTurns = await db.scenarioChatTurn.findMany({
      where: { scenarioVersionId: current.id },
      orderBy: { createdAt: 'asc' },
    });

    const scenarioInput = JSON.parse(current.scenarioInput) as Omit<ScenarioInput, 'levers'>;
    const levers = JSON.parse(current.leverConfig) as LeverConfig;
    const result = JSON.parse(current.resultSnapshot) as SimulationResult;
    const varianceSummary = current.varianceSummary ? (JSON.parse(current.varianceSummary) as VarianceSummary) : null;

    const reply = await getScenarioChatAdapter().sendMessage(body.message, {
      scenarioInput,
      levers,
      result,
      varianceSummary,
      history: priorTurns.map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content })),
    });

    const [, assistantTurn] = await db.$transaction([
      db.scenarioChatTurn.create({
        data: { scenarioVersionId: current.id, role: 'user', content: body.message, createdById: user.id },
      }),
      db.scenarioChatTurn.create({
        data: {
          scenarioVersionId: current.id,
          role: 'assistant',
          content: reply.message,
          proposedChange: reply.proposedChange ? JSON.stringify(reply.proposedChange) : null,
          createdById: user.id,
        },
      }),
    ]);

    return NextResponse.json({
      id: assistantTurn.id,
      role: assistantTurn.role,
      content: assistantTurn.content,
      proposedChange: reply.proposedChange,
      createdAt: assistantTurn.createdAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
