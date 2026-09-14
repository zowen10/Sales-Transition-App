import type { FlowBuilderAdapter, FlowBuilderEvent, FlowBuilderPublishResult } from './types';

/**
 * No Flow Builder base URL/API key is configured in this environment, so
 * this adapter logs the event (structured, no sensitive transcript
 * content) and reports success locally. It never claims a downstream
 * Flow Builder action succeeded beyond "the event was recorded" — there is
 * no real Flow Builder endpoint being called here.
 */
export class ConsoleFlowBuilderAdapter implements FlowBuilderAdapter {
  async publish(event: FlowBuilderEvent): Promise<FlowBuilderPublishResult> {
    // eslint-disable-next-line no-console
    console.log('[flowbuilder:mock]', JSON.stringify({ type: event.type, transitionId: event.transitionId, planVersionId: event.planVersionId, occurredAt: event.occurredAt }));
    return { success: true, externalRef: `mock-${event.type}-${event.transitionId}-${Date.now()}` };
  }
}
