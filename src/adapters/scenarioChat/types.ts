import type { LeverConfig, ScenarioInput, SimulationResult, VarianceSummary } from '@/domain/staffingModel/types';

export interface ChatTurnRecord {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScenarioChatContext {
  scenarioInput: Omit<ScenarioInput, 'levers'>;
  levers: LeverConfig;
  result: SimulationResult;
  varianceSummary: VarianceSummary | null;
  history: ChatTurnRecord[];
}

export interface ScenarioChatReply {
  message: string;
  /** A structured diff the UI shows as an applyable proposal — never written until a human clicks Apply. */
  proposedChange: Partial<LeverConfig> | null;
}

/**
 * Lets a user talk to the scenario in natural language. The adapter never
 * computes a number itself — src/domain/staffingModel/engine.ts is the only
 * thing that ever runs the simulation. A reply's `proposedChange` is shown
 * as the same applyable diff as a derive-from-import proposal
 * (src/domain/issueAnalysis/deriveLevers.ts); nothing is written until a
 * human clicks Apply, then Recalculate.
 */
export interface ScenarioChatAdapter {
  sendMessage(userMessage: string, context: ScenarioChatContext): Promise<ScenarioChatReply>;
}
