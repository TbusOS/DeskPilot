/**
 * @flowsight/desktop-test - Cursor Bridge
 *
 * Enables VLM functionality using Cursor's built-in Claude model.
 * When tests run within a Cursor Agent context, visual analysis
 * requests are automatically processed by the current Claude session.
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  VLMConfig,
  VLMFindRequest,
  VLMFindResponse,
  VLMActionRequest,
  VLMActionResponse,
  VLMAssertRequest,
  VLMAssertResponse,
  CostSummary,
} from '../types.js';

/**
 * Detected Claude Agent environment
 */
export type AgentEnvironment = 
  | 'cursor'           // Cursor IDE
  | 'claude-code'      // Claude Code CLI (terminal)
  | 'vscode-claude'    // VSCode Claude plugin
  | 'claude-desktop'   // Claude Desktop app
  | 'anthropic-mcp'    // Generic MCP environment
  | 'unknown';         // Unknown but likely agent context

/**
 * Detect which Claude Agent environment we're running in
 */
export function detectAgentEnvironment(): AgentEnvironment | null {
  // 1. Cursor IDE
  if (
    process.env.CURSOR_SESSION ||
    process.env.CURSOR_WORKSPACE ||
    process.env.CURSOR_IDE ||
    process.env.CURSOR_TRACE_ID
  ) {
    return 'cursor';
  }

  // 2. Claude Code CLI (terminal)
  if (
    process.env.CLAUDE_CODE ||
    process.env.CLAUDE_CLI ||
    process.env.ANTHROPIC_AGENT ||
    process.env.CLAUDE_SESSION_ID
  ) {
    return 'claude-code';
  }

  // 3. VSCode Claude plugin
  if (
    process.env.VSCODE_CLAUDE ||
    process.env.CLAUDE_VSCODE ||
    process.env.VSCODE_PID && process.env.ANTHROPIC_API_KEY === undefined
  ) {
    return 'vscode-claude';
  }

  // 4. Claude Desktop app
  if (
    process.env.CLAUDE_DESKTOP ||
    process.env.CLAUDE_APP
  ) {
    return 'claude-desktop';
  }

  // 5. Generic MCP environment
  if (
    process.env.MCP_SERVER ||
    process.env.MCP_SESSION
  ) {
    return 'anthropic-mcp';
  }

  // 6. Check if running in TTY with common agent indicators
  if (
    process.stdout.isTTY === false &&
    (process.env.TERM_PROGRAM === 'vscode' || 
     process.env.TERM === 'xterm-256color')
  ) {
    return 'unknown';
  }

  // 7. Explicit flag from user
  if (process.env.USE_AGENT_MODE === 'true') {
    return 'unknown';
  }

  return null;
}

/**
 * Check if we should use Agent mode (any Claude environment)
 */
export function shouldUseAgentMode(): boolean {
  return detectAgentEnvironment() !== null || 
         process.env.USE_CURSOR === 'true' ||
         process.env.USE_AGENT_MODE === 'true';
}

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
export class CursorBridge {
  private screenshotDir: string;
  private requestCount = 0;
  private environment: AgentEnvironment;

  constructor(_config: VLMConfig) {
    this.environment = detectAgentEnvironment() || 'unknown';
    this.screenshotDir = path.join(process.cwd(), '.agent-test-screenshots');

    // Ensure screenshot directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    // Log detected environment
    console.log(`🤖 Agent Bridge initialized (environment: ${this.environment})`);
  }

  /**
   * Get the detected agent environment
   */
  getEnvironment(): AgentEnvironment {
    return this.environment;
  }

  /**
   * Save screenshot and return path
   */
  private saveScreenshot(base64Data: string): string {
    this.requestCount++;
    const filename = `screenshot_${Date.now()}_${this.requestCount}.png`;
    const filepath = path.join(this.screenshotDir, filename);

    // Remove data URL prefix if present
    const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(cleanData, 'base64'));

    return filepath;
  }

  /**
   * Find element using Cursor's Claude
   */
  async findElement(request: VLMFindRequest): Promise<VLMFindResponse> {
    const screenshotPath = this.saveScreenshot(request.screenshot);

    // Create analysis request file for Agent to process
    const analysisRequest = {
      type: 'find_element',
      screenshot: screenshotPath,
      description: request.description,
      context: request.context,
      timestamp: new Date().toISOString(),
    };

    const requestFile = path.join(
      this.screenshotDir,
      `request_${Date.now()}.json`
    );
    fs.writeFileSync(requestFile, JSON.stringify(analysisRequest, null, 2));

    // Output for Agent processing
    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│ 🔍 CURSOR VLM REQUEST: Find Element                     │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Screenshot: ${screenshotPath}`);
    console.log(`│ Target: "${request.description}"`);
    if (request.context) {
      console.log(`│ Context: ${request.context}`);
    }
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Please analyze the screenshot and provide coordinates   │');
    console.log('│ or set CURSOR_VLM_RESPONSE env var with JSON response   │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Check for pre-set response (for automated scenarios)
    if (process.env.CURSOR_VLM_RESPONSE) {
      try {
        const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
        delete process.env.CURSOR_VLM_RESPONSE;
        return response as VLMFindResponse;
      } catch {
        // Continue with default response
      }
    }

    // Check for response file
    const responseFile = requestFile.replace('request_', 'response_');
    if (fs.existsSync(responseFile)) {
      const response = JSON.parse(fs.readFileSync(responseFile, 'utf-8'));
      return response as VLMFindResponse;
    }

    // Default: return not found (Agent should intercept and handle)
    return {
      confidence: 0,
      reasoning: 'Waiting for Cursor Agent to analyze screenshot',
      notFound: true,
      alternative: 'Use MCP browser tools or provide manual coordinates',
    };
  }

  /**
   * Get next action using Cursor's Claude
   */
  async getNextAction(request: VLMActionRequest): Promise<VLMActionResponse> {
    const screenshotPath = this.saveScreenshot(request.screenshot);

    // Output structured request
    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│ 🎯 CURSOR VLM REQUEST: Get Next Action                  │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Screenshot: ${screenshotPath}`);
    console.log(`│ Instruction: "${request.instruction}"`);
    console.log('│ Available Actions:');
    request.actionSpaces.slice(0, 5).forEach((action) => {
      console.log(`│   - ${action}`);
    });
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Check for pre-set response
    if (process.env.CURSOR_VLM_RESPONSE) {
      try {
        const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
        delete process.env.CURSOR_VLM_RESPONSE;
        return response as VLMActionResponse;
      } catch {
        // Continue
      }
    }

    return {
      actionType: 'wait',
      actionParams: {},
      thought: 'Waiting for Cursor Agent to provide action',
      finished: false,
    };
  }

  /**
   * Visual assertion using Cursor's Claude
   */
  async assertVisual(request: VLMAssertRequest): Promise<VLMAssertResponse> {
    const screenshotPath = this.saveScreenshot(request.screenshot);

    // Output structured request
    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│ ✅ CURSOR VLM REQUEST: Visual Assertion                 │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Screenshot: ${screenshotPath}`);
    console.log(`│ Assertion: "${request.assertion}"`);
    if (request.expected) {
      console.log(`│ Expected: ${request.expected}`);
    }
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Please verify the assertion and respond with:           │');
    console.log('│ { "passed": true/false, "reasoning": "...", "actual": "..." }');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Check for pre-set response
    if (process.env.CURSOR_VLM_RESPONSE) {
      try {
        const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
        delete process.env.CURSOR_VLM_RESPONSE;
        return response as VLMAssertResponse;
      } catch {
        // Continue
      }
    }

    // For automated testing, try to use simple heuristics
    // In real usage, the Cursor Agent should intercept and handle
    return {
      passed: false,
      reasoning: 'Waiting for Cursor Agent to verify assertion',
      actual: 'Pending verification',
    };
  }

  /**
   * Get cost summary (Cursor mode is free - uses existing subscription)
   */
  getCostSummary(): CostSummary {
    return {
      totalCost: 0, // Cursor mode is free (uses existing subscription)
      totalCalls: this.requestCount,
      byProvider: { cursor: 0 },
      byOperation: { find: 0, action: 0, assert: 0 },
      entries: [],
    };
  }
}

/**
 * Create an automated Cursor VLM handler for use in Agent context
 *
 * This function can be called by the Cursor Agent to process VLM requests
 * that were output by the test framework.
 */
export async function handleCursorVLMRequest(
  requestPath: string,
  analyzeImage: (imagePath: string, prompt: string) => Promise<string>
): Promise<void> {
  if (!fs.existsSync(requestPath)) {
    throw new Error(`Request file not found: ${requestPath}`);
  }

  const request = JSON.parse(fs.readFileSync(requestPath, 'utf-8'));
  const responsePath = requestPath.replace('request_', 'response_');

  let response: VLMFindResponse | VLMActionResponse | VLMAssertResponse;

  switch (request.type) {
    case 'find_element': {
      const prompt = `Look at this screenshot and find the element described as: "${request.description}"
${request.context ? `Context: ${request.context}` : ''}

Return a JSON object with:
- coordinates: { x: number, y: number } - the center point of the element
- confidence: number (0-1) - how confident you are
- reasoning: string - explanation
- notFound: boolean - true if element cannot be found`;

      const result = await analyzeImage(request.screenshot, prompt);
      response = JSON.parse(result) as VLMFindResponse;
      break;
    }

    case 'get_action': {
      const prompt = `Look at this screenshot and determine the next action for: "${request.instruction}"

Available actions: ${request.actionSpaces?.join(', ')}

Return a JSON object with:
- actionType: string
- actionParams: object
- thought: string
- finished: boolean`;

      const result = await analyzeImage(request.screenshot, prompt);
      response = JSON.parse(result) as VLMActionResponse;
      break;
    }

    case 'assert_visual': {
      const prompt = `Look at this screenshot and verify: "${request.assertion}"
${request.expected ? `Expected: ${request.expected}` : ''}

Return a JSON object with:
- passed: boolean
- reasoning: string
- actual: string (what you actually observed)`;

      const result = await analyzeImage(request.screenshot, prompt);
      response = JSON.parse(result) as VLMAssertResponse;
      break;
    }

    default:
      throw new Error(`Unknown request type: ${request.type}`);
  }

  fs.writeFileSync(responsePath, JSON.stringify(response, null, 2));
  console.log(`✓ Response written to: ${responsePath}`);
}
