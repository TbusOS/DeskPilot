'use strict';

var fs = require('fs');
var path = require('path');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);

// src/vlm/cost-tracker.ts
var PRICING = {
  ["anthropic" /* ANTHROPIC */]: {
    inputTokenPrice: 3e-3,
    // Claude 3.5 Sonnet
    outputTokenPrice: 0.015,
    imagePrice: 48e-4
    // ~1280x1280 image
  },
  ["openai" /* OPENAI */]: {
    inputTokenPrice: 5e-3,
    // GPT-4o
    outputTokenPrice: 0.015,
    imagePrice: 765e-5
    // high detail
  },
  ["volcengine" /* VOLCENGINE */]: {
    inputTokenPrice: 8e-4,
    // Doubao Pro (Chinese pricing)
    outputTokenPrice: 2e-3,
    imagePrice: 1e-3
  },
  ["doubao" /* DOUBAO */]: {
    inputTokenPrice: 8e-4,
    outputTokenPrice: 2e-3,
    imagePrice: 1e-3
  },
  // Default/fallback pricing
  default: {
    inputTokenPrice: 3e-3,
    outputTokenPrice: 0.015,
    imagePrice: 5e-3
  }
};
var CostTracker = class {
  entries = [];
  customPricing = {};
  /**
   * Set custom pricing for a provider
   */
  setPricing(provider, pricing) {
    this.customPricing[provider] = pricing;
  }
  /**
   * Get pricing for a provider
   */
  getPricing(provider) {
    return this.customPricing[provider] || PRICING[provider] || PRICING.default;
  }
  /**
   * Track a VLM API call
   */
  track(entry) {
    const pricing = this.getPricing(entry.provider);
    const images = entry.images || 1;
    const cost = entry.inputTokens / 1e3 * pricing.inputTokenPrice + entry.outputTokens / 1e3 * pricing.outputTokenPrice + images * pricing.imagePrice;
    const costEntry = {
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      images,
      cost,
      timestamp: Date.now(),
      operation: entry.operation
    };
    this.entries.push(costEntry);
    return costEntry;
  }
  /**
   * Estimate cost for a potential call (without tracking)
   */
  estimate(entry) {
    const pricing = this.getPricing(entry.provider);
    const images = entry.images || 1;
    return entry.inputTokens / 1e3 * pricing.inputTokenPrice + entry.outputTokens / 1e3 * pricing.outputTokenPrice + images * pricing.imagePrice;
  }
  /**
   * Get cost summary
   */
  getSummary() {
    const byProvider = {};
    const byOperation = {};
    for (const entry of this.entries) {
      byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.cost;
      byOperation[entry.operation] = (byOperation[entry.operation] || 0) + entry.cost;
    }
    return {
      totalCost: this.entries.reduce((sum, e) => sum + e.cost, 0),
      totalCalls: this.entries.length,
      byProvider,
      byOperation,
      entries: [...this.entries]
    };
  }
  /**
   * Get recent entries
   */
  getRecentEntries(count = 10) {
    return this.entries.slice(-count);
  }
  /**
   * Reset tracking
   */
  reset() {
    this.entries = [];
  }
  /**
   * Export to JSON
   */
  toJSON() {
    return JSON.stringify(this.getSummary(), null, 2);
  }
  /**
   * Print summary to console
   */
  printSummary() {
    const summary = this.getSummary();
    console.log("\n=== VLM Cost Summary ===");
    console.log(`Total Cost: $${summary.totalCost.toFixed(4)}`);
    console.log(`Total Calls: ${summary.totalCalls}`);
    if (Object.keys(summary.byProvider).length > 0) {
      console.log("\nBy Provider:");
      for (const [provider, cost] of Object.entries(summary.byProvider)) {
        console.log(`  ${provider}: $${cost.toFixed(4)}`);
      }
    }
    if (Object.keys(summary.byOperation).length > 0) {
      console.log("\nBy Operation:");
      for (const [operation, cost] of Object.entries(summary.byOperation)) {
        console.log(`  ${operation}: $${cost.toFixed(4)}`);
      }
    }
    console.log("========================\n");
  }
};
function detectAgentEnvironment() {
  if (process.env.CURSOR_SESSION || process.env.CURSOR_WORKSPACE || process.env.CURSOR_IDE || process.env.CURSOR_TRACE_ID) {
    return "cursor";
  }
  if (process.env.CLAUDE_CODE || process.env.CLAUDE_CLI || process.env.ANTHROPIC_AGENT || process.env.CLAUDE_SESSION_ID) {
    return "claude-code";
  }
  if (process.env.VSCODE_CLAUDE || process.env.CLAUDE_VSCODE || process.env.VSCODE_PID && process.env.ANTHROPIC_API_KEY === void 0) {
    return "vscode-claude";
  }
  if (process.env.CLAUDE_DESKTOP || process.env.CLAUDE_APP) {
    return "claude-desktop";
  }
  if (process.env.MCP_SERVER || process.env.MCP_SESSION) {
    return "anthropic-mcp";
  }
  if (process.stdout.isTTY === false && (process.env.TERM_PROGRAM === "vscode" || process.env.TERM === "xterm-256color")) {
    return "unknown";
  }
  if (process.env.USE_AGENT_MODE === "true") {
    return "unknown";
  }
  return null;
}
function shouldUseAgentMode() {
  return detectAgentEnvironment() !== null || process.env.USE_CURSOR === "true" || process.env.USE_AGENT_MODE === "true";
}
var CursorBridge = class {
  screenshotDir;
  requestCount = 0;
  environment;
  constructor(_config) {
    this.environment = detectAgentEnvironment() || "unknown";
    this.screenshotDir = path__namespace.join(process.cwd(), ".agent-test-screenshots");
    if (!fs__namespace.existsSync(this.screenshotDir)) {
      fs__namespace.mkdirSync(this.screenshotDir, { recursive: true });
    }
    console.log(`\u{1F916} Agent Bridge initialized (environment: ${this.environment})`);
  }
  /**
   * Get the detected agent environment
   */
  getEnvironment() {
    return this.environment;
  }
  /**
   * Save screenshot and return path
   */
  saveScreenshot(base64Data) {
    this.requestCount++;
    const filename = `screenshot_${Date.now()}_${this.requestCount}.png`;
    const filepath = path__namespace.join(this.screenshotDir, filename);
    const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, "");
    fs__namespace.writeFileSync(filepath, Buffer.from(cleanData, "base64"));
    return filepath;
  }
  /**
   * Find element using Cursor's Claude
   */
  async findElement(request) {
    const screenshotPath = this.saveScreenshot(request.screenshot);
    const analysisRequest = {
      type: "find_element",
      screenshot: screenshotPath,
      description: request.description,
      context: request.context,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const requestFile = path__namespace.join(
      this.screenshotDir,
      `request_${Date.now()}.json`
    );
    fs__namespace.writeFileSync(requestFile, JSON.stringify(analysisRequest, null, 2));
    console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("\u2502 \u{1F50D} CURSOR VLM REQUEST: Find Element                     \u2502");
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`\u2502 Screenshot: ${screenshotPath}`);
    console.log(`\u2502 Target: "${request.description}"`);
    if (request.context) {
      console.log(`\u2502 Context: ${request.context}`);
    }
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log("\u2502 Please analyze the screenshot and provide coordinates   \u2502");
    console.log("\u2502 or set CURSOR_VLM_RESPONSE env var with JSON response   \u2502");
    console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
    if (process.env.CURSOR_VLM_RESPONSE) {
      try {
        const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
        delete process.env.CURSOR_VLM_RESPONSE;
        return response;
      } catch {
      }
    }
    const responseFile = requestFile.replace("request_", "response_");
    if (fs__namespace.existsSync(responseFile)) {
      const response = JSON.parse(fs__namespace.readFileSync(responseFile, "utf-8"));
      return response;
    }
    return {
      confidence: 0,
      reasoning: "Waiting for Cursor Agent to analyze screenshot",
      notFound: true,
      alternative: "Use MCP browser tools or provide manual coordinates"
    };
  }
  /**
   * Get next action using Cursor's Claude
   */
  async getNextAction(request) {
    const screenshotPath = this.saveScreenshot(request.screenshot);
    console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("\u2502 \u{1F3AF} CURSOR VLM REQUEST: Get Next Action                  \u2502");
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`\u2502 Screenshot: ${screenshotPath}`);
    console.log(`\u2502 Instruction: "${request.instruction}"`);
    console.log("\u2502 Available Actions:");
    request.actionSpaces.slice(0, 5).forEach((action) => {
      console.log(`\u2502   - ${action}`);
    });
    console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
    if (process.env.CURSOR_VLM_RESPONSE) {
      try {
        const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
        delete process.env.CURSOR_VLM_RESPONSE;
        return response;
      } catch {
      }
    }
    return {
      actionType: "wait",
      actionParams: {},
      thought: "Waiting for Cursor Agent to provide action",
      finished: false
    };
  }
  /**
   * Visual assertion using Cursor's Claude
   */
  async assertVisual(request) {
    const screenshotPath = this.saveScreenshot(request.screenshot);
    console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("\u2502 \u2705 CURSOR VLM REQUEST: Visual Assertion                 \u2502");
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`\u2502 Screenshot: ${screenshotPath}`);
    console.log(`\u2502 Assertion: "${request.assertion}"`);
    if (request.expected) {
      console.log(`\u2502 Expected: ${request.expected}`);
    }
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log("\u2502 Please verify the assertion and respond with:           \u2502");
    console.log('\u2502 { "passed": true/false, "reasoning": "...", "actual": "..." }');
    console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
    if (process.env.CURSOR_VLM_RESPONSE) {
      try {
        const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
        delete process.env.CURSOR_VLM_RESPONSE;
        return response;
      } catch {
      }
    }
    return {
      passed: false,
      reasoning: "Waiting for Cursor Agent to verify assertion",
      actual: "Pending verification"
    };
  }
  /**
   * Get cost summary (Cursor mode is free - uses existing subscription)
   */
  getCostSummary() {
    return {
      totalCost: 0,
      // Cursor mode is free (uses existing subscription)
      totalCalls: this.requestCount,
      byProvider: { cursor: 0 },
      byOperation: { find: 0, action: 0, assert: 0 },
      entries: []
    };
  }
};
async function handleCursorVLMRequest(requestPath, analyzeImage) {
  if (!fs__namespace.existsSync(requestPath)) {
    throw new Error(`Request file not found: ${requestPath}`);
  }
  const request = JSON.parse(fs__namespace.readFileSync(requestPath, "utf-8"));
  const responsePath = requestPath.replace("request_", "response_");
  let response;
  switch (request.type) {
    case "find_element": {
      const prompt = `Look at this screenshot and find the element described as: "${request.description}"
${request.context ? `Context: ${request.context}` : ""}

Return a JSON object with:
- coordinates: { x: number, y: number } - the center point of the element
- confidence: number (0-1) - how confident you are
- reasoning: string - explanation
- notFound: boolean - true if element cannot be found`;
      const result = await analyzeImage(request.screenshot, prompt);
      response = JSON.parse(result);
      break;
    }
    case "get_action": {
      const prompt = `Look at this screenshot and determine the next action for: "${request.instruction}"

Available actions: ${request.actionSpaces?.join(", ")}

Return a JSON object with:
- actionType: string
- actionParams: object
- thought: string
- finished: boolean`;
      const result = await analyzeImage(request.screenshot, prompt);
      response = JSON.parse(result);
      break;
    }
    case "assert_visual": {
      const prompt = `Look at this screenshot and verify: "${request.assertion}"
${request.expected ? `Expected: ${request.expected}` : ""}

Return a JSON object with:
- passed: boolean
- reasoning: string
- actual: string (what you actually observed)`;
      const result = await analyzeImage(request.screenshot, prompt);
      response = JSON.parse(result);
      break;
    }
    default:
      throw new Error(`Unknown request type: ${request.type}`);
  }
  fs__namespace.writeFileSync(responsePath, JSON.stringify(response, null, 2));
  console.log(`\u2713 Response written to: ${responsePath}`);
}

// src/vlm/client.ts
var DEFAULT_MODELS = {
  ["anthropic" /* ANTHROPIC */]: "claude-sonnet-4-20250514",
  ["openai" /* OPENAI */]: "gpt-4o",
  ["volcengine" /* VOLCENGINE */]: "doubao-1-5-vision-pro",
  ["doubao" /* DOUBAO */]: "doubao-1-5-vision-pro",
  ["cursor" /* CURSOR */]: "claude-opus-4-5"
  // Uses Cursor's built-in model
};
var VLMClient = class {
  config;
  provider;
  model;
  costTracker;
  cursorBridge;
  constructor(config) {
    this.config = config;
    this.provider = this.normalizeProvider(config.provider);
    this.model = config.model || DEFAULT_MODELS[this.provider] || "gpt-4o";
    this.costTracker = new CostTracker();
    const shouldAutoUseAgent = this.provider === "cursor" /* CURSOR */ || shouldUseAgentMode() && !config.apiKey && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY;
    if (shouldAutoUseAgent) {
      this.cursorBridge = new CursorBridge(config);
      this.provider = "cursor" /* CURSOR */;
      const env = detectAgentEnvironment();
      if (env && env !== "cursor") {
        console.log(`\u{1F4CD} Auto-detected ${env} environment, using Agent mode`);
      }
    }
  }
  /**
   * Check if using Agent mode
   */
  isUsingAgentMode() {
    return this.cursorBridge !== void 0;
  }
  /**
   * Get detected agent environment
   */
  getAgentEnvironment() {
    return this.cursorBridge?.getEnvironment() || null;
  }
  normalizeProvider(provider) {
    if (typeof provider === "string") {
      const normalized = provider.toLowerCase();
      if (normalized === "anthropic" || normalized === "claude") {
        return "anthropic" /* ANTHROPIC */;
      }
      if (normalized === "openai" || normalized === "gpt") {
        return "openai" /* OPENAI */;
      }
      if (normalized === "volcengine" || normalized === "volc") {
        return "volcengine" /* VOLCENGINE */;
      }
      if (normalized === "doubao") {
        return "doubao" /* DOUBAO */;
      }
      if (normalized === "cursor") {
        return "cursor" /* CURSOR */;
      }
      if (normalized === "agent" || normalized === "auto") {
        return "cursor" /* CURSOR */;
      }
      return "custom" /* CUSTOM */;
    }
    return provider;
  }
  /**
   * Find element by visual description
   */
  async findElement(request) {
    if (this.cursorBridge) {
      return this.cursorBridge.findElement(request);
    }
    const systemPrompt = `You are a GUI automation assistant. Your task is to find UI elements in screenshots.

Given a screenshot and an element description, you need to:
1. Locate the described element in the screenshot
2. Return the center coordinates (x, y) of the element
3. Provide your confidence level (0-1)
4. Explain your reasoning

If the element cannot be found, set notFound to true and suggest alternatives.

IMPORTANT: Return coordinates in the format that can be used for clicking.
The screenshot dimensions will be provided.`;
    const userPrompt = `Find the following element in the screenshot:
"${request.description}"

${request.context ? `Context: ${request.context}` : ""}

Return a JSON object with:
- coordinates: { x: number, y: number } or null if not found
- confidence: number (0-1)
- reasoning: string
- notFound: boolean
- alternative: string (if not found, suggest what similar element exists)`;
    const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, "find");
    try {
      const parsed = this.parseJSON(response);
      const coordinates = parsed.coordinates;
      return {
        coordinates,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || "",
        notFound: parsed.notFound || !coordinates,
        alternative: parsed.alternative
      };
    } catch {
      return {
        confidence: 0,
        reasoning: "Failed to parse VLM response",
        notFound: true
      };
    }
  }
  /**
   * Get next action to perform
   */
  async getNextAction(request) {
    if (this.cursorBridge) {
      return this.cursorBridge.getNextAction(request);
    }
    const systemPrompt = `You are a GUI automation agent. Your task is to control a desktop application to complete user instructions.

Available actions:
${request.actionSpaces.join("\n")}

For each step:
1. Analyze the current screenshot
2. Decide the best action to take
3. Return the action with parameters

When the task is complete, return finished: true.

IMPORTANT: 
- Think step by step
- Only perform one action at a time
- Be precise with coordinates`;
    const userPrompt = `Instruction: "${request.instruction}"

Based on the current screenshot, what action should be taken next?

Return a JSON object with:
- actionType: string (one of the available actions)
- actionParams: object (parameters for the action)
- thought: string (your reasoning)
- reflection: string (any observations)
- finished: boolean (true if task is complete)`;
    const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, "action");
    try {
      const parsed = this.parseJSON(response);
      return {
        actionType: parsed.actionType || "wait",
        actionParams: parsed.actionParams || {},
        thought: parsed.thought || "",
        reflection: parsed.reflection,
        finished: parsed.finished || false
      };
    } catch {
      return {
        actionType: "wait",
        actionParams: {},
        thought: "Failed to parse VLM response",
        finished: false
      };
    }
  }
  /**
   * Perform visual assertion
   */
  async assertVisual(request) {
    if (this.cursorBridge) {
      return this.cursorBridge.assertVisual(request);
    }
    const systemPrompt = `You are a QA automation assistant. Your task is to verify UI states and conditions.

Given a screenshot and an assertion, you need to:
1. Analyze the screenshot carefully
2. Determine if the assertion is true or false
3. Provide detailed reasoning
4. If the assertion fails, suggest how to fix it`;
    const userPrompt = `Assertion: "${request.assertion}"

${request.expected ? `Expected: ${request.expected}` : ""}

Analyze the screenshot and verify the assertion.

Return a JSON object with:
- passed: boolean
- reasoning: string (detailed explanation)
- actual: string (what you actually observed)
- suggestions: string[] (if failed, how to fix)`;
    const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, "assert");
    try {
      const parsed = this.parseJSON(response);
      return {
        passed: parsed.passed || false,
        reasoning: parsed.reasoning || "",
        actual: parsed.actual || "",
        suggestions: parsed.suggestions
      };
    } catch {
      return {
        passed: false,
        reasoning: "Failed to parse VLM response",
        actual: "Unknown"
      };
    }
  }
  /**
   * Compare two screenshots and find differences (from Python framework)
   * Note: Currently uses single image analysis. For true comparison, 
   * both images should be sent to the VLM.
   */
  async compareScreenshots(screenshot1, _screenshot2, context) {
    const systemPrompt = `You are a UI testing assistant. Compare two screenshots and identify all differences.`;
    const userPrompt = `Compare these two screenshots and identify differences.
${context ? `Context: ${context}` : ""}

Return a JSON object with:
- differences: array of { type: "added|removed|changed|moved", description: string, severity: "high|medium|low" }
- summary: string (overall summary)
- similarityScore: number (0-1, how similar they are)`;
    const response = await this.callVLM(systemPrompt, userPrompt, screenshot1, "assert");
    try {
      const parsed = this.parseJSON(response);
      return {
        differences: parsed.differences || [],
        summary: parsed.summary || "",
        similarityScore: parsed.similarityScore || 0
      };
    } catch {
      return {
        differences: [],
        summary: "Failed to parse response",
        similarityScore: 0
      };
    }
  }
  /**
   * Detect visual issues in screenshot (from Python framework)
   */
  async detectVisualIssues(screenshot) {
    const systemPrompt = `You are a UI quality assurance expert. Detect visual issues and UI defects.`;
    const userPrompt = `Analyze this screenshot for visual issues and UI defects.

Check for:
1. Text truncation or overflow
2. Element overlap
3. Alignment issues
4. Color contrast problems
5. Blurry or distorted elements
6. Inconsistent spacing
7. Layout errors

Return a JSON object with:
{
  "issues": [
    {
      "type": "text_truncation|overlap|misalignment|contrast|blur|spacing|layout",
      "severity": "critical|high|medium|low",
      "description": "description of the issue",
      "location": {"x": 100, "y": 200, "width": 50, "height": 20},
      "suggestion": "how to fix it"
    }
  ]
}`;
    const response = await this.callVLM(systemPrompt, userPrompt, screenshot, "assert");
    try {
      const parsed = this.parseJSON(response);
      return parsed.issues || [];
    } catch {
      return [];
    }
  }
  /**
   * Analyze IDE screenshot with specialized prompts (from Python framework)
   */
  async analyzeIDEScreenshot(screenshot) {
    const systemPrompt = `You are an IDE interface analysis expert. Analyze IDE screenshots to identify all UI elements.

IDE common element types:
- menu: Menu bar (File, Edit, View, etc.)
- sidebar: Sidebar (file tree, outline, etc.)
- editor: Code editor area
- tab: Tab pages
- toolbar: Toolbar
- statusbar: Status bar
- panel: Panels (terminal, output, etc.)
- button: Buttons (run, debug, settings, etc.)
- icon: Icons
- input: Input fields, search boxes
- dropdown: Dropdown menus
- tooltip: Tooltips`;
    const userPrompt = `Analyze this IDE screenshot and identify all interface elements.

Return a JSON object with:
{
  "elements": [
    {
      "elementType": "type",
      "text": "text content",
      "bounds": {"x": 0, "y": 0, "width": 100, "height": 30},
      "attributes": {"active": true, "collapsed": false}
    }
  ],
  "layoutStructure": {
    "type": "three-column|two-column|single-column",
    "sidebarWidth": 250,
    "editorArea": {"x": 250, "y": 50, "width": 800, "height": 600},
    "panels": ["terminal", "output"]
  },
  "colorScheme": "dark|light",
  "issues": []
}`;
    const response = await this.callVLM(systemPrompt, userPrompt, screenshot, "find");
    try {
      const parsed = this.parseJSON(response);
      return {
        elements: parsed.elements || [],
        layoutStructure: parsed.layoutStructure || { type: "unknown" },
        colorScheme: parsed.colorScheme === "light" ? "light" : "dark",
        issues: parsed.issues || []
      };
    } catch {
      return {
        elements: [],
        layoutStructure: { type: "unknown" },
        colorScheme: "dark",
        issues: ["Failed to analyze screenshot"]
      };
    }
  }
  /**
   * Get cost summary
   */
  getCostSummary() {
    if (this.cursorBridge) {
      return this.cursorBridge.getCostSummary();
    }
    return this.costTracker.getSummary();
  }
  /**
   * Reset cost tracking
   */
  resetCostTracking() {
    this.costTracker.reset();
  }
  /**
   * Call the VLM API
   */
  async callVLM(systemPrompt, userPrompt, screenshot, operation) {
    let response;
    let inputTokens = 0;
    let outputTokens = 0;
    switch (this.provider) {
      case "anthropic" /* ANTHROPIC */:
        ({ response, inputTokens, outputTokens } = await this.callAnthropic(systemPrompt, userPrompt, screenshot));
        break;
      case "openai" /* OPENAI */:
        ({ response, inputTokens, outputTokens } = await this.callOpenAI(systemPrompt, userPrompt, screenshot));
        break;
      case "volcengine" /* VOLCENGINE */:
      case "doubao" /* DOUBAO */:
        ({ response, inputTokens, outputTokens } = await this.callVolcengine(systemPrompt, userPrompt, screenshot));
        break;
      case "custom" /* CUSTOM */:
        ({ response, inputTokens, outputTokens } = await this.callCustom(systemPrompt, userPrompt, screenshot));
        break;
      default:
        throw new Error(`Unsupported VLM provider: ${this.provider}`);
    }
    if (this.config.trackCost !== false) {
      this.costTracker.track({
        provider: this.provider,
        model: this.model,
        inputTokens,
        outputTokens,
        images: 1,
        operation
      });
    }
    return response;
  }
  /**
   * Call Anthropic Claude API
   */
  async callAnthropic(systemPrompt, userPrompt, screenshot) {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API key not provided. Set ANTHROPIC_API_KEY or pass apiKey in config.");
    }
    const fetchResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: screenshot
                }
              },
              {
                type: "text",
                text: userPrompt
              }
            ]
          }
        ]
      })
    });
    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Anthropic API error: ${error}`);
    }
    const data = await fetchResponse.json();
    return {
      response: data.content[0].text,
      inputTokens: data.usage?.input_tokens || 1e3,
      outputTokens: data.usage?.output_tokens || 500
    };
  }
  /**
   * Call OpenAI GPT-4V API
   */
  async callOpenAI(systemPrompt, userPrompt, screenshot) {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not provided. Set OPENAI_API_KEY or pass apiKey in config.");
    }
    const baseURL = this.config.baseURL || "https://api.openai.com/v1";
    const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot}`
                }
              },
              {
                type: "text",
                text: userPrompt
              }
            ]
          }
        ]
      })
    });
    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    const data = await fetchResponse.json();
    return {
      response: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens || 1e3,
      outputTokens: data.usage?.completion_tokens || 500
    };
  }
  /**
   * Call Volcengine (Doubao) API
   */
  async callVolcengine(systemPrompt, userPrompt, screenshot) {
    const apiKey = this.config.apiKey || process.env.VOLCENGINE_API_KEY || process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      throw new Error("Volcengine API key not provided. Set VOLCENGINE_API_KEY or pass apiKey in config.");
    }
    const baseURL = this.config.baseURL || "https://ark.cn-beijing.volces.com/api/v3";
    const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot}`
                }
              },
              {
                type: "text",
                text: userPrompt
              }
            ]
          }
        ]
      })
    });
    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Volcengine API error: ${error}`);
    }
    const data = await fetchResponse.json();
    return {
      response: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens || 1e3,
      outputTokens: data.usage?.completion_tokens || 500
    };
  }
  /**
   * Call custom API (OpenAI-compatible)
   */
  async callCustom(systemPrompt, userPrompt, screenshot) {
    if (!this.config.baseURL) {
      throw new Error("Custom provider requires baseURL");
    }
    const headers = {
      "Content-Type": "application/json"
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    const fetchResponse = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot}`
                }
              },
              {
                type: "text",
                text: userPrompt
              }
            ]
          }
        ]
      })
    });
    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Custom API error: ${error}`);
    }
    const data = await fetchResponse.json();
    return {
      response: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens || 1e3,
      outputTokens: data.usage?.completion_tokens || 500
    };
  }
  /**
   * Parse JSON from VLM response (handles markdown code blocks)
   */
  parseJSON(text) {
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      throw new Error("Could not parse JSON from response");
    }
  }
};

exports.CostTracker = CostTracker;
exports.CursorBridge = CursorBridge;
exports.VLMClient = VLMClient;
exports.detectAgentEnvironment = detectAgentEnvironment;
exports.handleCursorVLMRequest = handleCursorVLMRequest;
exports.shouldUseAgentMode = shouldUseAgentMode;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map