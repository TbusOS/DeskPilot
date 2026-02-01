/**
 * @flowsight/desktop-test - Test Runner
 *
 * Runs test cases and manages test lifecycle.
 */

import {
  type TestCase,
  type TestResult,
  type TestSuiteResult,
  type TestContext,
  type DesktopTestConfig,
  type Reporter,
} from '../types.js';

import { DesktopTest } from './desktop-test.js';
import { Assertions } from './assertions.js';

/**
 * Test runner options
 */
export interface TestRunnerOptions {
  /** Desktop test configuration */
  config?: DesktopTestConfig;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Video recording directory */
  videoDir?: string;
  /** Reporter */
  reporter?: Reporter;
}

/**
 * Logger implementation
 */
class Logger {
  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }

  step(message: string): void {
    console.log(`  → ${message}`);
  }
}

/**
 * Test Runner - manages test execution
 */
export class TestRunner {
  private options: TestRunnerOptions;
  private desktopTest: DesktopTest;
  private results: TestResult[] = [];
  private logger = new Logger();

  constructor(options: TestRunnerOptions = {}) {
    this.options = {
      stopOnFailure: false,
      ...options,
    };
    this.desktopTest = new DesktopTest(options.config);
  }

  /**
   * Run a single test case
   */
  async runTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const screenshots: string[] = [];
    let passed = false;
    let error: Error | undefined;
    let usedVLM = false;

    // Notify reporter
    this.options.reporter?.onTestStart(test);

    console.log(`\n  [TEST] ${test.name}`);

    // Start video recording if configured
    let videoPath: string | undefined;
    if (this.options.videoDir) {
      const sanitizedName = test.name.replace(/[^a-zA-Z0-9]/g, '_');
      videoPath = `${this.options.videoDir}/${sanitizedName}.webm`;
      try {
        await this.desktopTest.startRecording(videoPath);
      } catch {
        // Ignore recording start errors
      }
    }

    // Create test context
    const assertions = new Assertions(this.desktopTest);
    const context: TestContext = {
      test: this.desktopTest,
      assert: assertions,
      log: this.logger,
    };

    // Run test with retries
    const maxRetries = test.retries || 0;
    let attempts = 0;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        await test.fn(context);
        passed = true;
        break;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        if (attempts <= maxRetries) {
          console.log(`    Retry ${attempts}/${maxRetries}...`);
        }
      }
    }

    // Stop video recording
    if (videoPath) {
      try {
        await this.desktopTest.stopRecording();
      } catch {
        // Ignore recording stop errors
      }
    }

    // Check VLM usage
    const costSummary = this.desktopTest.getCostSummary();
    usedVLM = costSummary.totalCalls > 0;

    const result: TestResult = {
      test,
      passed,
      error,
      duration: Date.now() - startTime,
      screenshots,
      video: videoPath,
      usedVLM,
      vlmCost: costSummary.totalCost,
    };

    this.results.push(result);

    // Print result
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${status} (${result.duration}ms)${usedVLM ? ` [VLM: $${costSummary.totalCost.toFixed(4)}]` : ''}`);
    if (error) {
      console.log(`    ${error.message}`);
    }

    // Notify reporter
    this.options.reporter?.onTestEnd(result);

    return result;
  }

  /**
   * Run all test cases
   */
  async runAll(tests: TestCase[], suiteName: string = 'Desktop Tests'): Promise<TestSuiteResult> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ${suiteName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Notify reporter
    this.options.reporter?.onSuiteStart(suiteName);

    // Connect to the application
    console.log('  Connecting to application...');
    try {
      await this.desktopTest.connect();
      console.log('  ✓ Connected\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Connection failed: ${message}`);
      console.log('  Please ensure the Tauri app is running with remote debugging enabled.');
      process.exit(1);
    }

    // Filter tests
    const onlyTests = tests.filter(t => t.only);
    const testsToRun = onlyTests.length > 0 ? onlyTests : tests.filter(t => !t.skip);

    // Run tests
    for (const test of testsToRun) {
      const result = await this.runTest(test);

      if (!result.passed && this.options.stopOnFailure) {
        console.log('\n  Stopping: stopOnFailure is enabled');
        break;
      }
    }

    // Disconnect
    await this.desktopTest.disconnect();

    // Build suite result
    const suiteResult: TestSuiteResult = {
      name: suiteName,
      tests: this.results,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      skipped: tests.filter(t => t.skip).length,
      duration: this.results.reduce((sum, r) => sum + r.duration, 0),
      totalVLMCost: this.results.reduce((sum, r) => sum + (r.vlmCost || 0), 0),
    };

    // Print summary
    this.printSummary(suiteResult);

    // Notify reporter
    this.options.reporter?.onSuiteEnd(suiteResult);

    return suiteResult;
  }

  /**
   * Print test summary
   */
  private printSummary(result: TestSuiteResult): void {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Test Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`  Total:    ${result.tests.length} tests`);
    console.log(`  Passed:   ${result.passed} ✓`);
    console.log(`  Failed:   ${result.failed} ✗`);
    console.log(`  Skipped:  ${result.skipped}`);
    console.log(`  Duration: ${result.duration}ms`);

    if (result.totalVLMCost > 0) {
      console.log(`  VLM Cost: $${result.totalVLMCost.toFixed(4)}`);
    }

    if (result.failed > 0) {
      console.log('\n  Failed tests:');
      for (const test of result.tests.filter(t => !t.passed)) {
        console.log(`    - ${test.test.name}`);
        if (test.error) {
          console.log(`      ${test.error.message}`);
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Set exit code
    if (result.failed > 0) {
      process.exitCode = 1;
    }
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return this.results;
  }

  /**
   * Reset results
   */
  reset(): void {
    this.results = [];
    this.desktopTest.resetCostTracking();
  }
}
