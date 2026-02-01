/**
 * @flowsight/desktop-test/vlm
 *
 * VLM module exports
 */

export { VLMClient } from './client.js';
export { CostTracker } from './cost-tracker.js';
export { 
  CursorBridge, 
  handleCursorVLMRequest,
  detectAgentEnvironment,
  shouldUseAgentMode,
  type AgentEnvironment,
} from './cursor-bridge.js';
