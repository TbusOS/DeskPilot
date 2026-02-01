/**
 * @flowsight/desktop-test - VLM Cost Tracker
 *
 * Tracks API usage and estimates costs across different VLM providers.
 */

import {
  VLMProvider,
  type CostEntry,
  type CostSummary,
} from '../types.js';

/**
 * Pricing information per provider (as of 2024)
 * Prices in USD per unit
 */
const PRICING: Record<string, {
  inputTokenPrice: number;      // per 1K tokens
  outputTokenPrice: number;     // per 1K tokens
  imagePrice: number;           // per image
}> = {
  [VLMProvider.ANTHROPIC]: {
    inputTokenPrice: 0.003,     // Claude 3.5 Sonnet
    outputTokenPrice: 0.015,
    imagePrice: 0.0048,         // ~1280x1280 image
  },
  [VLMProvider.OPENAI]: {
    inputTokenPrice: 0.005,     // GPT-4o
    outputTokenPrice: 0.015,
    imagePrice: 0.00765,        // high detail
  },
  [VLMProvider.VOLCENGINE]: {
    inputTokenPrice: 0.0008,    // Doubao Pro (Chinese pricing)
    outputTokenPrice: 0.002,
    imagePrice: 0.001,
  },
  [VLMProvider.DOUBAO]: {
    inputTokenPrice: 0.0008,
    outputTokenPrice: 0.002,
    imagePrice: 0.001,
  },
  // Default/fallback pricing
  default: {
    inputTokenPrice: 0.003,
    outputTokenPrice: 0.015,
    imagePrice: 0.005,
  },
};

/**
 * Cost Tracker - monitors VLM API usage and costs
 */
export class CostTracker {
  private entries: CostEntry[] = [];
  private customPricing: Record<string, typeof PRICING[string]> = {};

  /**
   * Set custom pricing for a provider
   */
  setPricing(provider: string, pricing: typeof PRICING[string]): void {
    this.customPricing[provider] = pricing;
  }

  /**
   * Get pricing for a provider
   */
  private getPricing(provider: string): typeof PRICING[string] {
    return this.customPricing[provider] || PRICING[provider] || PRICING.default;
  }

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
  }): CostEntry {
    const pricing = this.getPricing(entry.provider);
    const images = entry.images || 1;

    const cost =
      (entry.inputTokens / 1000) * pricing.inputTokenPrice +
      (entry.outputTokens / 1000) * pricing.outputTokenPrice +
      images * pricing.imagePrice;

    const costEntry: CostEntry = {
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      images,
      cost,
      timestamp: Date.now(),
      operation: entry.operation,
    };

    this.entries.push(costEntry);
    return costEntry;
  }

  /**
   * Estimate cost for a potential call (without tracking)
   */
  estimate(entry: {
    provider: VLMProvider | string;
    inputTokens: number;
    outputTokens: number;
    images?: number;
  }): number {
    const pricing = this.getPricing(entry.provider);
    const images = entry.images || 1;

    return (
      (entry.inputTokens / 1000) * pricing.inputTokenPrice +
      (entry.outputTokens / 1000) * pricing.outputTokenPrice +
      images * pricing.imagePrice
    );
  }

  /**
   * Get cost summary
   */
  getSummary(): CostSummary {
    const byProvider: Record<string, number> = {};
    const byOperation: Record<string, number> = {};

    for (const entry of this.entries) {
      byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.cost;
      byOperation[entry.operation] = (byOperation[entry.operation] || 0) + entry.cost;
    }

    return {
      totalCost: this.entries.reduce((sum, e) => sum + e.cost, 0),
      totalCalls: this.entries.length,
      byProvider,
      byOperation,
      entries: [...this.entries],
    };
  }

  /**
   * Get recent entries
   */
  getRecentEntries(count: number = 10): CostEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.entries = [];
  }

  /**
   * Export to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.getSummary(), null, 2);
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const summary = this.getSummary();

    console.log('\n=== VLM Cost Summary ===');
    console.log(`Total Cost: $${summary.totalCost.toFixed(4)}`);
    console.log(`Total Calls: ${summary.totalCalls}`);

    if (Object.keys(summary.byProvider).length > 0) {
      console.log('\nBy Provider:');
      for (const [provider, cost] of Object.entries(summary.byProvider)) {
        console.log(`  ${provider}: $${cost.toFixed(4)}`);
      }
    }

    if (Object.keys(summary.byOperation).length > 0) {
      console.log('\nBy Operation:');
      for (const [operation, cost] of Object.entries(summary.byOperation)) {
        console.log(`  ${operation}: $${cost.toFixed(4)}`);
      }
    }

    console.log('========================\n');
  }
}
