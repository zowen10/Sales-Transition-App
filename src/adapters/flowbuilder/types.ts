export type FlowBuilderEventType =
  | 'transition.created'
  | 'intake.completed'
  | 'plan.generated'
  | 'plan.submitted_for_approval'
  | 'plan.approved'
  | 'artifacts.generated'
  | 'plan.superseded';

export interface FlowBuilderEvent {
  type: FlowBuilderEventType;
  transitionId: string;
  planVersionId?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface FlowBuilderPublishResult {
  success: boolean;
  /** Downstream reference id (e.g. a Flow Builder job/run id), when success is true. */
  externalRef?: string;
  error?: string;
}

/**
 * Boundary for everything Flow Builder-specific. Nothing outside this
 * adapter should call a Flow Builder API directly. A caller must check
 * `success` before claiming a downstream action succeeded — this adapter
 * never reports success it cannot verify.
 */
export interface FlowBuilderAdapter {
  publish(event: FlowBuilderEvent): Promise<FlowBuilderPublishResult>;
}
