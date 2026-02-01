/**
 * Benchmark - Performance Testing Module
 * 
 * Measure and assert performance metrics including timing,
 * memory usage, and resource consumption.
 */

import type { DesktopTest } from './desktop-test';

/** Timing measurement */
export interface TimingMeasurement {
  /** Measurement name */
  name: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Memory measurement */
export interface MemoryMeasurement {
  /** Used JS heap size */
  usedJSHeapSize: number;
  /** Total JS heap size */
  totalJSHeapSize: number;
  /** JS heap size limit */
  jsHeapSizeLimit: number;
  /** Timestamp */
  timestamp: number;
}

/** Performance entry */
export interface PerformanceEntry {
  /** Entry name */
  name: string;
  /** Entry type */
  entryType: string;
  /** Start time */
  startTime: number;
  /** Duration */
  duration: number;
}

/** Resource timing */
export interface ResourceTiming extends PerformanceEntry {
  /** Initiator type */
  initiatorType: string;
  /** Transfer size */
  transferSize: number;
  /** Encoded body size */
  encodedBodySize: number;
  /** Decoded body size */
  decodedBodySize: number;
}

/** Performance report */
export interface PerformanceReport {
  /** Test name */
  testName: string;
  /** All timing measurements */
  timings: TimingMeasurement[];
  /** Memory snapshots */
  memory: MemoryMeasurement[];
  /** Resource timings */
  resources: ResourceTiming[];
  /** Long tasks (>50ms) */
  longTasks: PerformanceEntry[];
  /** Summary statistics */
  summary: {
    totalDuration: number;
    avgTiming: number;
    maxTiming: number;
    minTiming: number;
    peakMemory: number;
    avgMemory: number;
    resourceCount: number;
    totalTransferSize: number;
  };
}

/** Threshold configuration */
export interface ThresholdConfig {
  /** Maximum duration in ms */
  maxDuration?: number;
  /** Maximum memory in bytes */
  maxMemory?: number;
  /** Maximum resource count */
  maxResourceCount?: number;
  /** Maximum transfer size in bytes */
  maxTransferSize?: number;
}

/**
 * Benchmark - Performance testing and measurement
 * 
 * @example
 * ```typescript
 * const benchmark = new Benchmark(test, 'Index Project Test');
 * 
 * // Measure operation
 * await benchmark.measure('open-dialog', async () => {
 *   await test.click('[data-testid="open-project"]');
 * });
 * 
 * await benchmark.measure('index-files', async () => {
 *   await test.waitFor('[data-testid="index-complete"]');
 * });
 * 
 * // Assert performance
 * benchmark.assertDuration('index-files', { maxDuration: 5000 });
 * 
 * // Generate report
 * const report = benchmark.generateReport();
 * ```
 */
export class Benchmark {
  private test: DesktopTest;
  private testName: string;
  private timings: TimingMeasurement[] = [];
  private memorySnapshots: MemoryMeasurement[] = [];
  private activeMeasurements: Map<string, number> = new Map();

  constructor(test: DesktopTest, testName: string = 'Benchmark') {
    this.test = test;
    this.testName = testName;
  }

  /**
   * Measure the duration of an operation
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    this.activeMeasurements.set(name, startTime);

    try {
      const result = await fn();
      const endTime = performance.now();
      
      this.timings.push({
        name,
        startTime,
        endTime,
        duration: endTime - startTime
      });

      this.activeMeasurements.delete(name);
      return result;
    } catch (error) {
      this.activeMeasurements.delete(name);
      throw error;
    }
  }

  /**
   * Start a named timing measurement
   */
  startTiming(name: string): void {
    this.activeMeasurements.set(name, performance.now());
  }

  /**
   * End a named timing measurement
   */
  endTiming(name: string, metadata?: Record<string, unknown>): TimingMeasurement {
    const startTime = this.activeMeasurements.get(name);
    if (startTime === undefined) {
      throw new Error(`No active measurement found: ${name}`);
    }

    const endTime = performance.now();
    const measurement: TimingMeasurement = {
      name,
      startTime,
      endTime,
      duration: endTime - startTime,
      metadata
    };

    this.timings.push(measurement);
    this.activeMeasurements.delete(name);

    return measurement;
  }

  /**
   * Get timing by name
   */
  getTiming(name: string): TimingMeasurement | undefined {
    return this.timings.find(t => t.name === name);
  }

  /**
   * Get all timings
   */
  getTimings(): TimingMeasurement[] {
    return [...this.timings];
  }

  /**
   * Measure memory usage
   */
  async measureMemory(): Promise<MemoryMeasurement> {
    const memory = await this.test.evaluate(`
      (() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          };
        }
        return null;
      })()
    `) as MemoryMeasurement | null;

    if (!memory) {
      // Fallback for non-Chrome browsers
      const fallback: MemoryMeasurement = {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        timestamp: Date.now()
      };
      this.memorySnapshots.push(fallback);
      return fallback;
    }

    this.memorySnapshots.push(memory);
    return memory;
  }

  /**
   * Get memory snapshots
   */
  getMemorySnapshots(): MemoryMeasurement[] {
    return [...this.memorySnapshots];
  }

  /**
   * Get performance entries from the browser
   */
  async getPerformanceEntries(type?: string): Promise<PerformanceEntry[]> {
    const entries = await this.test.evaluate(`
      (() => {
        const entries = ${type ? `performance.getEntriesByType('${type}')` : 'performance.getEntries()'};
        return entries.map(e => ({
          name: e.name,
          entryType: e.entryType,
          startTime: e.startTime,
          duration: e.duration,
          initiatorType: e.initiatorType,
          transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize,
          decodedBodySize: e.decodedBodySize
        }));
      })()
    `) as PerformanceEntry[];

    return entries;
  }

  /**
   * Get resource timing entries
   */
  async getResourceTimings(): Promise<ResourceTiming[]> {
    return this.getPerformanceEntries('resource') as Promise<ResourceTiming[]>;
  }

  /**
   * Get long tasks (>50ms)
   */
  async getLongTasks(): Promise<PerformanceEntry[]> {
    return this.getPerformanceEntries('longtask');
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.timings = [];
    this.memorySnapshots = [];
    this.activeMeasurements.clear();
  }

  /**
   * Clear browser performance entries
   */
  async clearBrowserEntries(): Promise<void> {
    await this.test.evaluate(`performance.clearResourceTimings()`);
  }

  /**
   * Assert duration is within threshold
   */
  assertDuration(name: string, thresholds: ThresholdConfig): void {
    const timing = this.getTiming(name);
    if (!timing) {
      throw new Error(`Timing measurement not found: ${name}`);
    }

    if (thresholds.maxDuration !== undefined && timing.duration > thresholds.maxDuration) {
      throw new Error(
        `${name}: Duration ${timing.duration.toFixed(2)}ms exceeds maximum ${thresholds.maxDuration}ms`
      );
    }
  }

  /**
   * Assert memory is within threshold
   */
  assertMemory(thresholds: ThresholdConfig): void {
    const peakMemory = Math.max(...this.memorySnapshots.map(m => m.usedJSHeapSize));
    
    if (thresholds.maxMemory !== undefined && peakMemory > thresholds.maxMemory) {
      throw new Error(
        `Peak memory ${this.formatBytes(peakMemory)} exceeds maximum ${this.formatBytes(thresholds.maxMemory)}`
      );
    }
  }

  /**
   * Assert all thresholds
   */
  async assertThresholds(thresholds: ThresholdConfig): Promise<void> {
    // Check duration (use total if not specific)
    if (thresholds.maxDuration !== undefined) {
      const totalDuration = this.timings.reduce((sum, t) => sum + t.duration, 0);
      if (totalDuration > thresholds.maxDuration) {
        throw new Error(
          `Total duration ${totalDuration.toFixed(2)}ms exceeds maximum ${thresholds.maxDuration}ms`
        );
      }
    }

    // Check memory
    if (thresholds.maxMemory !== undefined) {
      this.assertMemory(thresholds);
    }

    // Check resources
    if (thresholds.maxResourceCount !== undefined || thresholds.maxTransferSize !== undefined) {
      const resources = await this.getResourceTimings();
      
      if (thresholds.maxResourceCount !== undefined && resources.length > thresholds.maxResourceCount) {
        throw new Error(
          `Resource count ${resources.length} exceeds maximum ${thresholds.maxResourceCount}`
        );
      }

      if (thresholds.maxTransferSize !== undefined) {
        const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
        if (totalSize > thresholds.maxTransferSize) {
          throw new Error(
            `Total transfer size ${this.formatBytes(totalSize)} exceeds maximum ${this.formatBytes(thresholds.maxTransferSize)}`
          );
        }
      }
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(): Promise<PerformanceReport> {
    const resources = await this.getResourceTimings();
    const longTasks = await this.getLongTasks();
    
    const durations = this.timings.map(t => t.duration);
    const memoryValues = this.memorySnapshots.map(m => m.usedJSHeapSize);

    return {
      testName: this.testName,
      timings: this.timings,
      memory: this.memorySnapshots,
      resources,
      longTasks,
      summary: {
        totalDuration: durations.reduce((a, b) => a + b, 0),
        avgTiming: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        maxTiming: durations.length > 0 ? Math.max(...durations) : 0,
        minTiming: durations.length > 0 ? Math.min(...durations) : 0,
        peakMemory: memoryValues.length > 0 ? Math.max(...memoryValues) : 0,
        avgMemory: memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0,
        resourceCount: resources.length,
        totalTransferSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
      }
    };
  }

  /**
   * Export report as JSON
   */
  async exportJSON(): Promise<string> {
    const report = await this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Compare with baseline
   */
  async compareWithBaseline(baseline: PerformanceReport, tolerance = 0.1): Promise<{
    passed: boolean;
    differences: Array<{
      metric: string;
      baseline: number;
      current: number;
      diff: number;
      diffPercent: number;
    }>;
  }> {
    const current = await this.generateReport();
    const differences: Array<{
      metric: string;
      baseline: number;
      current: number;
      diff: number;
      diffPercent: number;
    }> = [];

    // Compare timings by name
    for (const timing of current.timings) {
      const baselineTiming = baseline.timings.find(t => t.name === timing.name);
      if (baselineTiming) {
        const diff = timing.duration - baselineTiming.duration;
        const diffPercent = diff / baselineTiming.duration;
        
        differences.push({
          metric: `timing:${timing.name}`,
          baseline: baselineTiming.duration,
          current: timing.duration,
          diff,
          diffPercent
        });
      }
    }

    // Compare summary metrics
    const summaryMetrics: Array<[string, number, number]> = [
      ['totalDuration', baseline.summary.totalDuration, current.summary.totalDuration],
      ['peakMemory', baseline.summary.peakMemory, current.summary.peakMemory],
      ['resourceCount', baseline.summary.resourceCount, current.summary.resourceCount],
      ['totalTransferSize', baseline.summary.totalTransferSize, current.summary.totalTransferSize]
    ];

    for (const [metric, baseValue, currentValue] of summaryMetrics) {
      if (baseValue > 0) {
        const diff = currentValue - baseValue;
        const diffPercent = diff / baseValue;
        
        differences.push({
          metric,
          baseline: baseValue,
          current: currentValue,
          diff,
          diffPercent
        });
      }
    }

    // Check if any metric exceeds tolerance
    const passed = differences.every(d => Math.abs(d.diffPercent) <= tolerance);

    return { passed, differences };
  }

  // Private helpers

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

export default Benchmark;
