import { y as VLMClientInterface, z as VLMConfig, F as VLMFindRequest, G as VLMFindResponse, V as VLMActionRequest, v as VLMActionResponse, w as VLMAssertRequest, x as VLMAssertResponse, g as CostSummary, H as VLMProvider, f as CostEntry } from './types-CVKrO8qF.js';

/**
 * @flowsight/desktop-test - VLM Client
 *
 * Unified client for Vision-Language Models (Claude, GPT-4V, Doubao, etc.)
 * Used for visual element finding and intelligent UI understanding.
 */

/**
 * VLM Client - provides unified access to various VLM providers
 */
declare class VLMClient implements VLMClientInterface {
    private config;
    private provider;
    private model;
    private costTracker;
    private cursorBridge?;
    constructor(config: VLMConfig);
    /**
     * Check if using Agent mode
     */
    isUsingAgentMode(): boolean;
    /**
     * Get detected agent environment
     */
    getAgentEnvironment(): string | null;
    private normalizeProvider;
    /**
     * Find element by visual description
     */
    findElement(request: VLMFindRequest): Promise<VLMFindResponse>;
    /**
     * Get next action to perform
     */
    getNextAction(request: VLMActionRequest): Promise<VLMActionResponse>;
    /**
     * Perform visual assertion
     */
    assertVisual(request: VLMAssertRequest): Promise<VLMAssertResponse>;
    /**
     * Compare two screenshots and find differences (from Python framework)
     * Note: Currently uses single image analysis. For true comparison,
     * both images should be sent to the VLM.
     */
    compareScreenshots(screenshot1: string, _screenshot2: string, context?: string): Promise<{
        differences: Array<{
            type: string;
            description: string;
            severity: string;
        }>;
        summary: string;
        similarityScore: number;
    }>;
    /**
     * Detect visual issues in screenshot (from Python framework)
     */
    detectVisualIssues(screenshot: string): Promise<Array<{
        type: string;
        severity: string;
        description: string;
        location?: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        suggestion?: string;
    }>>;
    /**
     * Analyze IDE screenshot with specialized prompts (from Python framework)
     */
    analyzeIDEScreenshot(screenshot: string): Promise<{
        elements: Array<{
            elementType: string;
            text?: string;
            bounds: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            attributes?: Record<string, unknown>;
        }>;
        layoutStructure: {
            type: string;
            sidebarWidth?: number;
            editorArea?: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            panels?: string[];
        };
        colorScheme: 'dark' | 'light';
        issues: string[];
    }>;
    /**
     * Get cost summary
     */
    getCostSummary(): CostSummary;
    /**
     * Reset cost tracking
     */
    resetCostTracking(): void;
    /**
     * Call the VLM API
     */
    private callVLM;
    /**
     * Call Anthropic Claude API
     */
    private callAnthropic;
    /**
     * Call OpenAI GPT-4V API
     */
    private callOpenAI;
    /**
     * Call Volcengine (Doubao) API
     */
    private callVolcengine;
    /**
     * Call custom API (OpenAI-compatible)
     */
    private callCustom;
    /**
     * Parse JSON from VLM response (handles markdown code blocks)
     */
    private parseJSON;
}

/**
 * @flowsight/desktop-test - VLM Cost Tracker
 *
 * Tracks API usage and estimates costs across different VLM providers.
 */

/**
 * Pricing information per provider (as of 2024)
 * Prices in USD per unit
 */
declare const PRICING: Record<string, {
    inputTokenPrice: number;
    outputTokenPrice: number;
    imagePrice: number;
}>;
/**
 * Cost Tracker - monitors VLM API usage and costs
 */
declare class CostTracker {
    private entries;
    private customPricing;
    /**
     * Set custom pricing for a provider
     */
    setPricing(provider: string, pricing: typeof PRICING[string]): void;
    /**
     * Get pricing for a provider
     */
    private getPricing;
    /**
     * Track a VLM API call
     */
    track(entry: {
        provider: VLMProvider | string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        images?: number;
        operation: CostEntry['operation'];
    }): CostEntry;
    /**
     * Estimate cost for a potential call (without tracking)
     */
    estimate(entry: {
        provider: VLMProvider | string;
        inputTokens: number;
        outputTokens: number;
        images?: number;
    }): number;
    /**
     * Get cost summary
     */
    getSummary(): CostSummary;
    /**
     * Get recent entries
     */
    getRecentEntries(count?: number): CostEntry[];
    /**
     * Reset tracking
     */
    reset(): void;
    /**
     * Export to JSON
     */
    toJSON(): string;
    /**
     * Print summary to console
     */
    printSummary(): void;
}

export { CostTracker as C, VLMClient as V };
