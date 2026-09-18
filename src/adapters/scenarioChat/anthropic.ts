import { ISSUE_BURN_LEVER_KEYS } from '@/lib/enums';
import type { LeverConfig } from '@/domain/staffingModel/types';
import type { ScenarioChatAdapter, ScenarioChatContext, ScenarioChatReply } from './types';

const PROPOSE_LEVER_CHANGE_TOOL = {
  name: 'propose_lever_change',
  description:
    'Propose a change to ONE lever of the staffing simulation. Call this once per lever you want to change. You never compute the resulting numbers yourself — the deterministic engine recomputes everything once a human applies your proposal.',
  input_schema: {
    type: 'object',
    properties: {
      leverKey: { type: 'string', enum: [...ISSUE_BURN_LEVER_KEYS], description: 'Which lever to change.' },
      enabled: { type: 'boolean', description: 'Whether the lever should be on or off. Omit to leave unchanged.' },
      params: {
        type: 'object',
        description:
          'Only the parameter fields relevant to this lever, e.g. {"fteCount": 4} for resolutionCapacity, or {"casesPerDay": 25} for steadyStateExecution. Omit fields you are not changing.',
      },
    },
    required: ['leverKey'],
  },
};

function buildSystemPrompt(context: ScenarioChatContext): string {
  const varianceLine = context.varianceSummary
    ? `Latest checkpoint variance (workday ${context.varianceSummary.asOfDay}): ${context.varianceSummary.metrics
        .map((m) => `${m.metric} forecast=${m.forecast.toFixed(1)} actual=${m.actual.toFixed(1)} (${m.status})`)
        .join('; ')}`
    : 'No checkpoint has been recorded against this plan yet.';

  return `You are helping a PM adjust a deterministic issue-burn staffing simulation. You are assistive only: you may explain the current plan, answer "why" questions grounded in the data below, and propose lever changes via the propose_lever_change tool — but you never state a computed result as fact unless it comes from the data given to you, and you never silently apply a change.

Current scenario:
- Total test cases: ${context.scenarioInput.totalTestCases}, starting issues: ${context.scenarioInput.startingIssues}, target workday: ${context.scenarioInput.targetWorkday}
- Levers: ${JSON.stringify(context.levers)}
- Latest result: capacity/day=${context.result.capacityPerDay}, clearDay=${context.result.clearDay}, totalIssueWork=${context.result.totalIssueWork.toFixed(1)}
- ${varianceLine}

When the PM asks for a change (e.g. "add 2 more FTEs", "turn off reopens"), call propose_lever_change for each lever affected, then briefly explain your reasoning in your text reply. When they ask an explanatory question, answer directly from the data above without proposing anything.`;
}

/**
 * Anthropic Messages API with tool-calling. The model may call
 * propose_lever_change zero or more times; every call is merged into a
 * single Partial<LeverConfig> patch and returned alongside the model's
 * prose. Nothing here ever writes to the scenario — the caller (the chat
 * API route) only ever persists the reply as a ScenarioChatTurn, and the UI
 * only applies it when the PM clicks Apply.
 */
export class AnthropicScenarioChatAdapter implements ScenarioChatAdapter {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async sendMessage(userMessage: string, context: ScenarioChatContext): Promise<ScenarioChatReply> {
    const messages = [
      ...context.history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: buildSystemPrompt(context),
        tools: [PROPOSE_LEVER_CHANGE_TOOL],
        messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as {
      content?: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[];
    };

    const message = (body.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();

    const validKeys = new Set(ISSUE_BURN_LEVER_KEYS);
    const patch: Partial<LeverConfig> = {};
    for (const block of body.content ?? []) {
      if (block.type !== 'tool_use' || block.name !== 'propose_lever_change') continue;
      const leverKey = block.input?.leverKey;
      if (typeof leverKey !== 'string' || !validKeys.has(leverKey as (typeof ISSUE_BURN_LEVER_KEYS)[number])) continue;
      const key = leverKey as keyof LeverConfig;
      const current = context.levers[key];
      const enabled = typeof block.input?.enabled === 'boolean' ? block.input.enabled : current.enabled;
      const params = typeof block.input?.params === 'object' && block.input?.params !== null ? block.input.params : {};
      (patch as Record<string, unknown>)[key] = { ...current, ...params, enabled };
    }

    return {
      message: message || "I've proposed the change below — review it and click Apply if it looks right.",
      proposedChange: Object.keys(patch).length ? patch : null,
    };
  }
}
