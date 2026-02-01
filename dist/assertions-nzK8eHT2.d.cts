import { h as DesktopTestInstance, D as DesktopTestConfig, o as SnapshotResult, E as ElementLocator, i as ElementRef, W as WaitOptions, e as ClickOptions, A as ActionResult, u as TypeOptions, n as ScrollOptions, B as BoundingBox, S as ScreenshotOptions, g as CostSummary, R as Reporter, p as TestCase, s as TestResult, t as TestSuiteResult, c as AssertionMethods } from './types-CVKrO8qF.cjs';

/**
 * @flowsight/desktop-test - Core DesktopTest Class
 *
 * The main entry point for the hybrid desktop testing framework.
 * Implements smart fallback chain: DOM → Accessibility → VLM
 */

/**
 * Main Desktop Test class - implements the unified API with hybrid mode
 */
declare class DesktopTest implements DesktopTestInstance {
    private config;
    private cdpAdapter;
    private pythonBridge;
    private nutjsAdapter;
    private vlmClient;
    private connected;
    private lastSnapshot;
    constructor(config?: DesktopTestConfig);
    private mergeConfig;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    private getMode;
    snapshot(options?: {
        interactive?: boolean;
    }): Promise<SnapshotResult>;
    /**
     * Find element using hybrid fallback chain:
     * Level 1: Refs from snapshot (free, fast)
     * Level 2: CSS/XPath via CDP (free, fast)
     * Level 3: Visual AI via VLM (paid, intelligent)
     */
    find(locator: string | ElementLocator): Promise<ElementRef | null>;
    findAll(locator: string | ElementLocator): Promise<ElementRef[]>;
    waitFor(locator: string | ElementLocator, options?: WaitOptions): Promise<ElementRef>;
    private findDeterministic;
    private findByRef;
    private findVisual;
    click(locator: string | ElementLocator, options?: ClickOptions): Promise<ActionResult>;
    dblclick(locator: string | ElementLocator): Promise<ActionResult>;
    rightClick(locator: string | ElementLocator): Promise<ActionResult>;
    type(locator: string | ElementLocator, text: string, options?: TypeOptions): Promise<ActionResult>;
    fill(locator: string | ElementLocator, text: string): Promise<ActionResult>;
    clear(locator: string | ElementLocator): Promise<ActionResult>;
    press(key: string): Promise<ActionResult>;
    hover(locator: string | ElementLocator): Promise<ActionResult>;
    scroll(options: ScrollOptions): Promise<ActionResult>;
    drag(from: string | ElementLocator, to: string | ElementLocator): Promise<ActionResult>;
    clickText(text: string): Promise<ActionResult>;
    clickImage(description: string): Promise<ActionResult>;
    ai(instruction: string): Promise<ActionResult>;
    private executeVLMAction;
    getText(locator: string | ElementLocator): Promise<string>;
    getValue(locator: string | ElementLocator): Promise<string>;
    getAttribute(locator: string | ElementLocator, attr: string): Promise<string | null>;
    isVisible(locator: string | ElementLocator): Promise<boolean>;
    isEnabled(locator: string | ElementLocator): Promise<boolean>;
    count(locator: string | ElementLocator): Promise<number>;
    boundingBox(locator: string | ElementLocator): Promise<BoundingBox | null>;
    getUrl(): Promise<string>;
    getTitle(): Promise<string>;
    evaluate<T>(script: string): Promise<T>;
    screenshot(path?: string, options?: ScreenshotOptions): Promise<string>;
    startRecording(path: string): Promise<void>;
    stopRecording(): Promise<{
        path: string;
    }>;
    getCostSummary(): CostSummary;
    resetCostTracking(): void;
    wait(ms: number): Promise<void>;
    waitForIdle(timeout?: number): Promise<void>;
    private ensureConnected;
    private normalizeLocator;
    private locatorToDescription;
    private getScreenshotBase64;
    private log;
}
/**
 * Factory function for creating DesktopTest instance
 */
declare function createDesktopTest(config?: DesktopTestConfig): DesktopTest;

/**
 * @flowsight/desktop-test - Test Runner
 *
 * Runs test cases and manages test lifecycle.
 */

/**
 * Test runner options
 */
interface TestRunnerOptions {
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
 * Test Runner - manages test execution
 */
declare class TestRunner {
    private options;
    private desktopTest;
    private results;
    private logger;
    constructor(options?: TestRunnerOptions);
    /**
     * Run a single test case
     */
    runTest(test: TestCase): Promise<TestResult>;
    /**
     * Run all test cases
     */
    runAll(tests: TestCase[], suiteName?: string): Promise<TestSuiteResult>;
    /**
     * Print test summary
     */
    private printSummary;
    /**
     * Get test results
     */
    getResults(): TestResult[];
    /**
     * Reset results
     */
    reset(): void;
}

/**
 * @flowsight/desktop-test - Assertions
 *
 * Test assertion methods including data correctness checks.
 */

/**
 * Assertion error with details
 */
declare class AssertionError extends Error {
    actual?: unknown;
    expected?: unknown;
    constructor(message: string, actual?: unknown, expected?: unknown);
}
/**
 * Assertions class - implements test assertions
 */
declare class Assertions implements AssertionMethods {
    private test?;
    constructor(test?: DesktopTestInstance);
    /**
     * Assert a number is not zero (static version)
     */
    static valueNotZero(value: number, message?: string): void;
    /**
     * Assert an array/string is not empty (static version)
     */
    static valueNotEmpty(value: unknown[] | string, message?: string): void;
    /**
     * Assert data passes validation rules (static version)
     */
    static validateData<T extends Record<string, unknown>>(data: T, rules: {
        [K in keyof T]?: (value: T[K]) => boolean;
    }, message?: string): void;
    ok(condition: boolean, message?: string): void;
    equal<T>(actual: T, expected: T, message?: string): void;
    notEqual<T>(actual: T, expected: T, message?: string): void;
    greaterThan(actual: number, expected: number, message?: string): void;
    lessThan(actual: number, expected: number, message?: string): void;
    greaterOrEqual(actual: number, expected: number, message?: string): void;
    lessOrEqual(actual: number, expected: number, message?: string): void;
    contains(haystack: string, needle: string, message?: string): void;
    matches(actual: string, pattern: RegExp, message?: string): void;
    private requireTest;
    exists(locator: string | ElementLocator, message?: string): Promise<void>;
    notExists(locator: string | ElementLocator, message?: string): Promise<void>;
    visible(locator: string | ElementLocator, message?: string): Promise<void>;
    hidden(locator: string | ElementLocator, message?: string): Promise<void>;
    hasText(locator: string | ElementLocator, text: string, message?: string): Promise<void>;
    hasValue(locator: string | ElementLocator, value: string, message?: string): Promise<void>;
    hasAttribute(locator: string | ElementLocator, attr: string, value?: string, message?: string): Promise<void>;
    /**
     * Assert that a numeric value from the element is not zero.
     * This is specifically designed to catch the "0 files, 0 functions" bug.
     */
    notZero(locator: string | ElementLocator, message?: string): Promise<void>;
    /**
     * Assert that an element's text content is not empty.
     */
    notEmpty(locator: string | ElementLocator, message?: string): Promise<void>;
    /**
     * Assert that element data passes a custom validation function.
     */
    dataCorrect(locator: string | ElementLocator, validator: (data: string) => boolean, message?: string): Promise<void>;
    /**
     * Use VLM to visually verify a condition.
     */
    visualCheck(description: string, _message?: string): Promise<void>;
    /**
     * Compare current screenshot against baseline for visual regression.
     */
    noVisualRegression(baseline: string, threshold?: number): Promise<void>;
}

export { Assertions as A, DesktopTest as D, TestRunner as T, AssertionError as a, type TestRunnerOptions as b, createDesktopTest as c };
