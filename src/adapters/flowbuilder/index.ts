import { ConsoleFlowBuilderAdapter } from './consoleAdapter';
import { HttpFlowBuilderAdapter } from './httpAdapter';
import type { FlowBuilderAdapter } from './types';

export * from './types';
export { ConsoleFlowBuilderAdapter, HttpFlowBuilderAdapter };

export function getFlowBuilderAdapter(): FlowBuilderAdapter {
  const baseUrl = process.env.FLOWBUILDER_BASE_URL;
  const apiKey = process.env.FLOWBUILDER_API_KEY;
  if (baseUrl && apiKey) return new HttpFlowBuilderAdapter(baseUrl, apiKey);
  return new ConsoleFlowBuilderAdapter();
}
