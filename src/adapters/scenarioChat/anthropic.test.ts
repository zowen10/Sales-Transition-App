import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicScenarioChatAdapter } from './anthropic';
import { defaultLeverConfig } from '@/domain/staffingModel/defaults';
import type { ScenarioChatContext } from './types';

function baseContext(): ScenarioChatContext {
  return {
    scenarioInput: { planStartDate: '2026-01-01', totalTestCases: 450, startingIssues: 22, targetWorkday: 35 },
    levers: defaultLeverConfig(),
    result: {
      rows: [],
      clearDay: 44,
      capacityPerDay: 6,
      totalIssueWork: 103,
      totalGenerated: 0,
      totalReopened: 0,
      totalInflux: 0,
      totalCalendarDriven: 0,
      trace: [],
    },
    varianceSummary: null,
    history: [],
  };
}

describe('AnthropicScenarioChatAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges one or more propose_lever_change tool calls into a single LeverConfig patch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: "I'll bump FTEs and turn off reopens." },
          { type: 'tool_use', name: 'propose_lever_change', input: { leverKey: 'resolutionCapacity', params: { fteCount: 5 } } },
          { type: 'tool_use', name: 'propose_lever_change', input: { leverKey: 'reopenRate', enabled: false } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new AnthropicScenarioChatAdapter('test-key', 'claude-sonnet-5');
    const reply = await adapter.sendMessage('add 2 more FTEs and turn off reopens', baseContext());

    expect(reply.message).toBe("I'll bump FTEs and turn off reopens.");
    expect(reply.proposedChange).toEqual({
      resolutionCapacity: { enabled: true, issuesPerDayPerFte: 2, fteCount: 5 },
      reopenRate: { enabled: false, reopenRatePercent: 15 },
    });

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const requestBody = JSON.parse((call[1] as RequestInit).body as string);
    expect(requestBody.tools[0].name).toBe('propose_lever_change');
    expect(requestBody.system).toContain('450');
  });

  it('ignores a tool call with an invalid leverKey rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'tool_use', name: 'propose_lever_change', input: { leverKey: 'notARealLever', params: {} } }],
      }),
    }));

    const adapter = new AnthropicScenarioChatAdapter('test-key', 'claude-sonnet-5');
    const reply = await adapter.sendMessage('do something invalid', baseContext());
    expect(reply.proposedChange).toBeNull();
  });

  it('returns no proposal when the model only replies with text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'You are currently modeling a 44-workday clear date against a target of 35.' }] }),
    }));

    const adapter = new AnthropicScenarioChatAdapter('test-key', 'claude-sonnet-5');
    const reply = await adapter.sendMessage('why are we behind?', baseContext());
    expect(reply.proposedChange).toBeNull();
    expect(reply.message).toContain('44-workday');
  });

  it('throws when the Anthropic API returns a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }));
    const adapter = new AnthropicScenarioChatAdapter('test-key', 'claude-sonnet-5');
    await expect(adapter.sendMessage('hi', baseContext())).rejects.toThrow('Anthropic API error');
  });
});
