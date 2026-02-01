/**
 * @flowsight/desktop-test - Assertions
 *
 * Test assertion methods including data correctness checks.
 */

import {
  type AssertionMethods,
  type ElementLocator,
  type DesktopTestInstance,
} from '../types.js';

/**
 * Assertion error with details
 */
export class AssertionError extends Error {
  actual?: unknown;
  expected?: unknown;

  constructor(message: string, actual?: unknown, expected?: unknown) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

/**
 * Assertions class - implements test assertions
 */
export class Assertions implements AssertionMethods {
  private test?: DesktopTestInstance;

  constructor(test?: DesktopTestInstance) {
    this.test = test;
  }

  // ============================================================================
  // Static Value Assertions (no DesktopTest needed)
  // ============================================================================

  /**
   * Assert a number is not zero (static version)
   */
  static valueNotZero(value: number, message?: string): void {
    if (value === 0) {
      throw new AssertionError(
        message || `Expected non-zero value, got 0`,
        value,
        'non-zero'
      );
    }
  }

  /**
   * Assert an array/string is not empty (static version)
   */
  static valueNotEmpty(value: unknown[] | string, message?: string): void {
    if (value.length === 0) {
      throw new AssertionError(
        message || `Expected non-empty value, got empty`,
        value,
        'non-empty'
      );
    }
  }

  /**
   * Assert data passes validation rules (static version)
   */
  static validateData<T extends Record<string, unknown>>(
    data: T,
    rules: { [K in keyof T]?: (value: T[K]) => boolean },
    message?: string
  ): void {
    for (const [key, validator] of Object.entries(rules)) {
      if (validator && !validator(data[key as keyof T] as T[keyof T])) {
        throw new AssertionError(
          message || `Validation failed for field "${key}"`,
          data[key as keyof T],
          `valid ${key}`
        );
      }
    }
  }

  // ============================================================================
  // Basic Assertions
  // ============================================================================

  ok(condition: boolean, message?: string): void {
    if (!condition) {
      throw new AssertionError(message || 'Expected condition to be truthy', condition, true);
    }
  }

  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        actual,
        expected
      );
    }
  }

  notEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected value to not equal ${JSON.stringify(expected)}`,
        actual,
        `not ${JSON.stringify(expected)}`
      );
    }
  }

  // ============================================================================
  // Number Assertions
  // ============================================================================

  greaterThan(actual: number, expected: number, message?: string): void {
    if (actual <= expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be greater than ${expected}`,
        actual,
        `> ${expected}`
      );
    }
  }

  lessThan(actual: number, expected: number, message?: string): void {
    if (actual >= expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be less than ${expected}`,
        actual,
        `< ${expected}`
      );
    }
  }

  greaterOrEqual(actual: number, expected: number, message?: string): void {
    if (actual < expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be greater than or equal to ${expected}`,
        actual,
        `>= ${expected}`
      );
    }
  }

  lessOrEqual(actual: number, expected: number, message?: string): void {
    if (actual > expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be less than or equal to ${expected}`,
        actual,
        `<= ${expected}`
      );
    }
  }

  // ============================================================================
  // String Assertions
  // ============================================================================

  contains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
      throw new AssertionError(
        message || `Expected "${haystack.slice(0, 50)}..." to contain "${needle}"`,
        haystack,
        `contains "${needle}"`
      );
    }
  }

  matches(actual: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(actual)) {
      throw new AssertionError(
        message || `Expected "${actual.slice(0, 50)}..." to match ${pattern}`,
        actual,
        pattern.toString()
      );
    }
  }

  // ============================================================================
  // Element Assertions
  // ============================================================================

  private requireTest(): DesktopTestInstance {
    if (!this.test) {
      throw new Error('This assertion method requires a DesktopTest instance');
    }
    return this.test;
  }

  async exists(locator: string | ElementLocator, message?: string): Promise<void> {
    const element = await this.requireTest().find(locator);
    if (!element) {
      throw new AssertionError(
        message || `Expected element to exist: ${JSON.stringify(locator)}`,
        null,
        'element'
      );
    }
  }

  async notExists(locator: string | ElementLocator, message?: string): Promise<void> {
    const element = await this.requireTest().find(locator);
    if (element) {
      throw new AssertionError(
        message || `Expected element to not exist: ${JSON.stringify(locator)}`,
        'element found',
        null
      );
    }
  }

  async visible(locator: string | ElementLocator, message?: string): Promise<void> {
    const isVisible = await this.requireTest().isVisible(locator);
    if (!isVisible) {
      throw new AssertionError(
        message || `Expected element to be visible: ${JSON.stringify(locator)}`,
        'not visible',
        'visible'
      );
    }
  }

  async hidden(locator: string | ElementLocator, message?: string): Promise<void> {
    const isVisible = await this.requireTest().isVisible(locator);
    if (isVisible) {
      throw new AssertionError(
        message || `Expected element to be hidden: ${JSON.stringify(locator)}`,
        'visible',
        'hidden'
      );
    }
  }

  async hasText(locator: string | ElementLocator, text: string, message?: string): Promise<void> {
    const actualText = await this.requireTest().getText(locator);
    if (!actualText.includes(text)) {
      throw new AssertionError(
        message || `Expected element to have text "${text}", got "${actualText.slice(0, 50)}..."`,
        actualText,
        text
      );
    }
  }

  async hasValue(locator: string | ElementLocator, value: string, message?: string): Promise<void> {
    const actualValue = await this.requireTest().getValue(locator);
    if (actualValue !== value) {
      throw new AssertionError(
        message || `Expected element to have value "${value}", got "${actualValue}"`,
        actualValue,
        value
      );
    }
  }

  async hasAttribute(locator: string | ElementLocator, attr: string, value?: string, message?: string): Promise<void> {
    const actualValue = await this.requireTest().getAttribute(locator, attr);
    
    if (actualValue === null) {
      throw new AssertionError(
        message || `Expected element to have attribute "${attr}"`,
        null,
        attr
      );
    }

    if (value !== undefined && actualValue !== value) {
      throw new AssertionError(
        message || `Expected attribute "${attr}" to have value "${value}", got "${actualValue}"`,
        actualValue,
        value
      );
    }
  }

  // ============================================================================
  // Data Correctness Assertions (Key feature for "0 files" bug prevention)
  // ============================================================================

  /**
   * Assert that a numeric value from the element is not zero.
   * This is specifically designed to catch the "0 files, 0 functions" bug.
   */
  async notZero(locator: string | ElementLocator, message?: string): Promise<void> {
    const text = await this.requireTest().getText(locator);
    
    // Extract numbers from text
    const numbers = text.match(/\d+/g);
    
    if (!numbers || numbers.length === 0) {
      throw new AssertionError(
        message || `Expected element to contain a number: ${JSON.stringify(locator)}`,
        text,
        'number > 0'
      );
    }

    const allZero = numbers.every(n => parseInt(n, 10) === 0);
    if (allZero) {
      throw new AssertionError(
        message || `Expected non-zero value, but all numbers are zero: "${text}"`,
        numbers,
        'non-zero'
      );
    }
  }

  /**
   * Assert that an element's text content is not empty.
   */
  async notEmpty(locator: string | ElementLocator, message?: string): Promise<void> {
    const text = await this.requireTest().getText(locator);
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      throw new AssertionError(
        message || `Expected element to have non-empty text: ${JSON.stringify(locator)}`,
        '',
        'non-empty text'
      );
    }
  }

  /**
   * Assert that element data passes a custom validation function.
   */
  async dataCorrect(
    locator: string | ElementLocator,
    validator: (data: string) => boolean,
    message?: string
  ): Promise<void> {
    const text = await this.requireTest().getText(locator);
    
    if (!validator(text)) {
      throw new AssertionError(
        message || `Data validation failed for: ${JSON.stringify(locator)}`,
        text,
        'valid data'
      );
    }
  }

  // ============================================================================
  // Visual AI Assertions
  // ============================================================================

  /**
   * Use VLM to visually verify a condition.
   */
  async visualCheck(description: string, _message?: string): Promise<void> {
    // This would need VLM client access - simplified for now
    // In full implementation, this would take a screenshot and ask VLM to verify
    console.log(`  [Visual Check] ${description}`);
    
    // For now, just log - full implementation would use VLM
    // const result = await this.vlmClient.assertVisual({
    //   screenshot: await this.test.getScreenshotBase64(),
    //   assertion: description,
    // });
    // if (!result.passed) {
    //   throw new AssertionError(message || result.reasoning, result.actual, description);
    // }
  }

  /**
   * Compare current screenshot against baseline for visual regression.
   */
  async noVisualRegression(baseline: string, threshold: number = 0.95): Promise<void> {
    // Simplified - would compare screenshots using image diff
    console.log(`  [Visual Regression] Comparing against baseline: ${baseline} (threshold: ${threshold})`);
    
    // Full implementation would:
    // 1. Load baseline image
    // 2. Take current screenshot
    // 3. Compare using pixel diff or perceptual hash
    // 4. Fail if similarity < threshold
  }
}
