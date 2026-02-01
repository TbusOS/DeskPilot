export { C as CostTracker, V as VLMClient } from '../cost-tracker-BIRSZG9o.cjs';
import { z as VLMConfig, F as VLMFindRequest, G as VLMFindResponse, V as VLMActionRequest, v as VLMActionResponse, w as VLMAssertRequest, x as VLMAssertResponse, g as CostSummary } from '../types-CVKrO8qF.cjs';

/**
 * @flowsight/desktop-test - Cursor Bridge
 *
 * Enables VLM functionality using Cursor's built-in Claude model.
 * When tests run within a Cursor Agent context, visual analysis
 * requests are automatically processed by the current Claude session.
 */

/**
 * Detected Claude Agent environment
 */
type AgentEnvironment = 'cursor' | 'claude-code' | 'vscode-claude' | 'claude-desktop' | 'anthropic-mcp' | 'unknown';
/**
 * Detect which Claude Agent environment we're running in
 */
declare function detectAgentEnvironment(): AgentEnvironment | null;
/**
 * Check if we should use Agent mode (any Claude environment)
 */
declare function shouldUseAgentMode(): boolean;
/**
 * Agent Bridge - Works with any Claude Agent environment
 *
 * Supports:
 * - Cursor IDE
 * - Claude Code CLI (terminal)
 * - VSCode Claude plugin
 * - Claude Desktop
 * - Any MCP-enabled environment
 *
 * This bridge outputs structured requests that the Agent processes,
 * using the model available in the current session.
 */
declare class CursorBridge {
    private screenshotDir;
    private requestCount;
    private environment;
    constructor(_config: VLMConfig);
    /**
     * Get the detected agent environment
     */
    getEnvironment(): AgentEnvironment;
    /**
     * Save screenshot and return path
     */
    private saveScreenshot;
    /**
     * Find element using Cursor's Claude
     */
    findElement(request: VLMFindRequest): Promise<VLMFindResponse>;
    /**
     * Get next action using Cursor's Claude
     */
    getNextAction(request: VLMActionRequest): Promise<VLMActionResponse>;
    /**
     * Visual assertion using Cursor's Claude
     */
    assertVisual(request: VLMAssertRequest): Promise<VLMAssertResponse>;
    /**
     * Get cost summary (Cursor mode is free - uses existing subscription)
     */
    getCostSummary(): CostSummary;
}
/**
 * Create an automated Cursor VLM handler for use in Agent context
 *
 * This function can be called by the Cursor Agent to process VLM requests
 * that were output by the test framework.
 */
declare function handleCursorVLMRequest(requestPath: string, analyzeImage: (imagePath: string, prompt: string) => Promise<string>): Promise<void>;

export { type AgentEnvironment, CursorBridge, detectAgentEnvironment, handleCursorVLMRequest, shouldUseAgentMode };
