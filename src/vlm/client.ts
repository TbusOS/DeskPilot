/**
 * @flowsight/desktop-test - VLM Client
 *
 * Unified client for Vision-Language Models (Claude, GPT-4V, Doubao, etc.)
 * Used for visual element finding and intelligent UI understanding.
 */

import {
  VLMProvider,
  type VLMConfig,
  type VLMFindRequest,
  type VLMFindResponse,
  type VLMActionRequest,
  type VLMActionResponse,
  type VLMAssertRequest,
  type VLMAssertResponse,
  type CostSummary,
  type VLMClientInterface,
} from '../types.js';

import { CostTracker } from './cost-tracker.js';
import { CursorBridge, shouldUseAgentMode, detectAgentEnvironment } from './cursor-bridge.js';

/**
 * Default models for each provider
 */
const DEFAULT_MODELS: Record<string, string> = {
  [VLMProvider.ANTHROPIC]: 'claude-sonnet-4-20250514',
  [VLMProvider.OPENAI]: 'gpt-4o',
  [VLMProvider.VOLCENGINE]: 'doubao-1-5-vision-pro',
  [VLMProvider.DOUBAO]: 'doubao-1-5-vision-pro',
  [VLMProvider.CURSOR]: 'claude-opus-4-5', // Uses Cursor's built-in model
};

/**
 * VLM Client - provides unified access to various VLM providers
 */
export class VLMClient implements VLMClientInterface {
  private config: VLMConfig;
  private provider: VLMProvider;
  private model: string;
  private costTracker: CostTracker;
  private cursorBridge?: CursorBridge;

  constructor(config: VLMConfig) {
    this.config = config;
    this.provider = this.normalizeProvider(config.provider);
    this.model = config.model || DEFAULT_MODELS[this.provider] || 'gpt-4o';
    this.costTracker = new CostTracker();

    // Auto-detect agent environment if no API key provided
    const shouldAutoUseAgent = 
      this.provider === VLMProvider.CURSOR ||
      (shouldUseAgentMode() && !config.apiKey && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY);

    if (shouldAutoUseAgent) {
      this.cursorBridge = new CursorBridge(config);
      this.provider = VLMProvider.CURSOR;
      
      const env = detectAgentEnvironment();
      if (env && env !== 'cursor') {
        console.log(`📍 Auto-detected ${env} environment, using Agent mode`);
      }
    }
  }

  /**
   * Check if using Agent mode
   */
  isUsingAgentMode(): boolean {
    return this.cursorBridge !== undefined;
  }

  /**
   * Get detected agent environment
   */
  getAgentEnvironment(): string | null {
    return this.cursorBridge?.getEnvironment() || null;
  }

  private normalizeProvider(provider: VLMProvider | string): VLMProvider {
    if (typeof provider === 'string') {
      const normalized = provider.toLowerCase();
      if (normalized === 'anthropic' || normalized === 'claude') {
        return VLMProvider.ANTHROPIC;
      }
      if (normalized === 'openai' || normalized === 'gpt') {
        return VLMProvider.OPENAI;
      }
      if (normalized === 'volcengine' || normalized === 'volc') {
        return VLMProvider.VOLCENGINE;
      }
      if (normalized === 'doubao') {
        return VLMProvider.DOUBAO;
      }
      if (normalized === 'cursor') {
        return VLMProvider.CURSOR;
      }
      // 'agent' or 'auto' - auto-detect any Claude environment
      if (normalized === 'agent' || normalized === 'auto') {
        return VLMProvider.CURSOR; // Will use CursorBridge for all agent environments
      }
      return VLMProvider.CUSTOM;
    }
    return provider;
  }

  /**
   * Find element by visual description
   */
  async findElement(request: VLMFindRequest): Promise<VLMFindResponse> {
    // Use Cursor bridge if configured
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

${request.context ? `Context: ${request.context}` : ''}

Return a JSON object with:
- coordinates: { x: number, y: number } or null if not found
- confidence: number (0-1)
- reasoning: string
- notFound: boolean
- alternative: string (if not found, suggest what similar element exists)`;

    const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, 'find');

    try {
      const parsed = this.parseJSON(response);
      const coordinates = parsed.coordinates as { x: number; y: number } | undefined;
      return {
        coordinates,
        confidence: (parsed.confidence as number) || 0,
        reasoning: (parsed.reasoning as string) || '',
        notFound: (parsed.notFound as boolean) || !coordinates,
        alternative: parsed.alternative as string | undefined,
      };
    } catch {
      return {
        confidence: 0,
        reasoning: 'Failed to parse VLM response',
        notFound: true,
      };
    }
  }

  /**
   * Get next action to perform
   */
  async getNextAction(request: VLMActionRequest): Promise<VLMActionResponse> {
    // Use Cursor bridge if configured
    if (this.cursorBridge) {
      return this.cursorBridge.getNextAction(request);
    }

    const systemPrompt = `You are a GUI automation agent. Your task is to control a desktop application to complete user instructions.

Available actions:
${request.actionSpaces.join('\n')}

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

    const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, 'action');

    try {
      const parsed = this.parseJSON(response);
      return {
        actionType: (parsed.actionType as string) || 'wait',
        actionParams: (parsed.actionParams as Record<string, unknown>) || {},
        thought: (parsed.thought as string) || '',
        reflection: parsed.reflection as string | undefined,
        finished: (parsed.finished as boolean) || false,
      };
    } catch {
      return {
        actionType: 'wait',
        actionParams: {},
        thought: 'Failed to parse VLM response',
        finished: false,
      };
    }
  }

  /**
   * Perform visual assertion
   */
  async assertVisual(request: VLMAssertRequest): Promise<VLMAssertResponse> {
    // Use Cursor bridge if configured
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

${request.expected ? `Expected: ${request.expected}` : ''}

Analyze the screenshot and verify the assertion.

Return a JSON object with:
- passed: boolean
- reasoning: string (detailed explanation)
- actual: string (what you actually observed)
- suggestions: string[] (if failed, how to fix)`;

    const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, 'assert');

    try {
      const parsed = this.parseJSON(response);
      return {
        passed: (parsed.passed as boolean) || false,
        reasoning: (parsed.reasoning as string) || '',
        actual: (parsed.actual as string) || '',
        suggestions: parsed.suggestions as string[] | undefined,
      };
    } catch {
      return {
        passed: false,
        reasoning: 'Failed to parse VLM response',
        actual: 'Unknown',
      };
    }
  }

  /**
   * Compare two screenshots and find differences (from Python framework)
   * Note: Currently uses single image analysis. For true comparison, 
   * both images should be sent to the VLM.
   */
  async compareScreenshots(
    screenshot1: string,
    _screenshot2: string,
    context?: string
  ): Promise<{
    differences: Array<{ type: string; description: string; severity: string }>;
    summary: string;
    similarityScore: number;
  }> {
    const systemPrompt = `You are a UI testing assistant. Compare two screenshots and identify all differences.`;

    const userPrompt = `Compare these two screenshots and identify differences.
${context ? `Context: ${context}` : ''}

Return a JSON object with:
- differences: array of { type: "added|removed|changed|moved", description: string, severity: "high|medium|low" }
- summary: string (overall summary)
- similarityScore: number (0-1, how similar they are)`;

    // For this we need to send both images - simplified version
    const response = await this.callVLM(systemPrompt, userPrompt, screenshot1, 'assert');

    try {
      const parsed = this.parseJSON(response);
      return {
        differences: (parsed.differences as Array<{ type: string; description: string; severity: string }>) || [],
        summary: (parsed.summary as string) || '',
        similarityScore: (parsed.similarityScore as number) || 0,
      };
    } catch {
      return {
        differences: [],
        summary: 'Failed to parse response',
        similarityScore: 0,
      };
    }
  }

  /**
   * Detect visual issues in screenshot (from Python framework)
   */
  async detectVisualIssues(screenshot: string): Promise<Array<{
    type: string;
    severity: string;
    description: string;
    location?: { x: number; y: number; width: number; height: number };
    suggestion?: string;
  }>> {
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

    const response = await this.callVLM(systemPrompt, userPrompt, screenshot, 'assert');

    try {
      const parsed = this.parseJSON(response);
      return (parsed.issues as Array<{
        type: string;
        severity: string;
        description: string;
        location?: { x: number; y: number; width: number; height: number };
        suggestion?: string;
      }>) || [];
    } catch {
      return [];
    }
  }

  /**
   * Analyze IDE screenshot with specialized prompts (from Python framework)
   */
  async analyzeIDEScreenshot(screenshot: string): Promise<{
    elements: Array<{
      elementType: string;
      text?: string;
      bounds: { x: number; y: number; width: number; height: number };
      attributes?: Record<string, unknown>;
    }>;
    layoutStructure: {
      type: string;
      sidebarWidth?: number;
      editorArea?: { x: number; y: number; width: number; height: number };
      panels?: string[];
    };
    colorScheme: 'dark' | 'light';
    issues: string[];
  }> {
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

    const response = await this.callVLM(systemPrompt, userPrompt, screenshot, 'find');

    try {
      const parsed = this.parseJSON(response);
      return {
        elements: (parsed.elements as Array<{
          elementType: string;
          text?: string;
          bounds: { x: number; y: number; width: number; height: number };
          attributes?: Record<string, unknown>;
        }>) || [],
        layoutStructure: (parsed.layoutStructure as {
          type: string;
          sidebarWidth?: number;
          editorArea?: { x: number; y: number; width: number; height: number };
          panels?: string[];
        }) || { type: 'unknown' },
        colorScheme: ((parsed.colorScheme as string) === 'light' ? 'light' : 'dark'),
        issues: (parsed.issues as string[]) || [],
      };
    } catch {
      return {
        elements: [],
        layoutStructure: { type: 'unknown' },
        colorScheme: 'dark',
        issues: ['Failed to analyze screenshot'],
      };
    }
  }

  /**
   * Get cost summary
   */
  getCostSummary(): CostSummary {
    // Cursor mode is free (uses existing subscription)
    if (this.cursorBridge) {
      return this.cursorBridge.getCostSummary();
    }
    return this.costTracker.getSummary();
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(): void {
    this.costTracker.reset();
  }

  /**
   * Call the VLM API
   */
  private async callVLM(
    systemPrompt: string,
    userPrompt: string,
    screenshot: string,
    operation: 'find' | 'action' | 'assert' | 'analyze'
  ): Promise<string> {
    let response: string;
    let inputTokens = 0;
    let outputTokens = 0;

    switch (this.provider) {
      case VLMProvider.ANTHROPIC:
        ({ response, inputTokens, outputTokens } = await this.callAnthropic(systemPrompt, userPrompt, screenshot));
        break;
      case VLMProvider.OPENAI:
        ({ response, inputTokens, outputTokens } = await this.callOpenAI(systemPrompt, userPrompt, screenshot));
        break;
      case VLMProvider.VOLCENGINE:
      case VLMProvider.DOUBAO:
        ({ response, inputTokens, outputTokens } = await this.callVolcengine(systemPrompt, userPrompt, screenshot));
        break;
      case VLMProvider.CUSTOM:
        ({ response, inputTokens, outputTokens } = await this.callCustom(systemPrompt, userPrompt, screenshot));
        break;
      default:
        throw new Error(`Unsupported VLM provider: ${this.provider}`);
    }

    // Track cost
    if (this.config.trackCost !== false) {
      this.costTracker.track({
        provider: this.provider,
        model: this.model,
        inputTokens,
        outputTokens,
        images: 1,
        operation,
      });
    }

    return response;
  }

  /**
   * Call Anthropic Claude API
   */
  private async callAnthropic(
    systemPrompt: string,
    userPrompt: string,
    screenshot: string
  ): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not provided. Set ANTHROPIC_API_KEY or pass apiKey in config.');
    }

    const fetchResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: screenshot,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await fetchResponse.json() as {
      content: Array<{ text: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      response: data.content[0].text,
      inputTokens: data.usage?.input_tokens || 1000,
      outputTokens: data.usage?.output_tokens || 500,
    };
  }

  /**
   * Call OpenAI GPT-4V API
   */
  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    screenshot: string
  ): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not provided. Set OPENAI_API_KEY or pass apiKey in config.');
    }

    const baseURL = this.config.baseURL || 'https://api.openai.com/v1';

    const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot}`,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await fetchResponse.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      response: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens || 1000,
      outputTokens: data.usage?.completion_tokens || 500,
    };
  }

  /**
   * Call Volcengine (Doubao) API
   */
  private async callVolcengine(
    systemPrompt: string,
    userPrompt: string,
    screenshot: string
  ): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
    const apiKey = this.config.apiKey || process.env.VOLCENGINE_API_KEY || process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      throw new Error('Volcengine API key not provided. Set VOLCENGINE_API_KEY or pass apiKey in config.');
    }

    const baseURL = this.config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3';

    const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot}`,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Volcengine API error: ${error}`);
    }

    const data = await fetchResponse.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      response: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens || 1000,
      outputTokens: data.usage?.completion_tokens || 500,
    };
  }

  /**
   * Call custom API (OpenAI-compatible)
   */
  private async callCustom(
    systemPrompt: string,
    userPrompt: string,
    screenshot: string
  ): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
    if (!this.config.baseURL) {
      throw new Error('Custom provider requires baseURL');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const fetchResponse = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${screenshot}`,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Custom API error: ${error}`);
    }

    const data = await fetchResponse.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      response: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens || 1000,
      outputTokens: data.usage?.completion_tokens || 500,
    };
  }

  /**
   * Parse JSON from VLM response (handles markdown code blocks)
   */
  private parseJSON(text: string): Record<string, unknown> {
    // Try direct parse first
    try {
      return JSON.parse(text);
    } catch {
      // Try extracting from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }

      // Try finding JSON object in text
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }

      throw new Error('Could not parse JSON from response');
    }
  }
}
