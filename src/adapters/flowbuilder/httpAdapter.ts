import type { FlowBuilderAdapter, FlowBuilderEvent, FlowBuilderPublishResult } from './types';

/**
 * Real Flow Builder HTTP integration. Used only when FLOWBUILDER_BASE_URL
 * and FLOWBUILDER_API_KEY are configured; otherwise the console/mock
 * adapter is used (see ./index.ts). This adapter only ever returns
 * success:true if Flow Builder's response says so.
 */
export class HttpFlowBuilderAdapter implements FlowBuilderAdapter {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async publish(event: FlowBuilderEvent): Promise<FlowBuilderPublishResult> {
    try {
      const res = await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        return { success: false, error: `Flow Builder responded ${res.status} ${res.statusText}` };
      }
      const body = (await res.json().catch(() => ({}))) as { externalRef?: string };
      return { success: true, externalRef: body.externalRef };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown Flow Builder publish error' };
    }
  }
}
