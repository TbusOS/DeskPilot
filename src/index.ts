/**
 * @flowsight/desktop-test
 *
 * A powerful, hybrid desktop automation testing suite for Tauri/Electron applications.
 * Combines deterministic DOM testing with VLM-powered visual AI fallback.
 *
 * Features:
 * - Hybrid Mode: Deterministic first, VLM fallback when needed
 * - Multi-Provider VLM: Anthropic Claude, OpenAI GPT-4V, Volcengine Doubao
 * - Cost Tracking: Monitor and control VLM API costs
 * - Cross-Platform: macOS, Linux, Windows via Python bridge
 * - Tauri Native: First-class support for Tauri WebView testing
 *
 * @example
 * ```typescript
 * import { DesktopTest, TestMode } from '@flowsight/desktop-test';
 *
 * const test = new DesktopTest({
 *   mode: TestMode.HYBRID,
 *   cdp: { endpoint: 9222 },
 *   vlm: {
 *     provider: 'anthropic',
 *     model: 'claude-sonnet-4-20250514',
 *   },
 * });
 *
 * await test.connect();
 * await test.click('@e2');  // Deterministic (refs)
 * await test.clickText('Submit');  // Visual AI fallback
 * await test.ai('Fill the login form');  // Full AI control
 *
 * console.log(test.getCostSummary());  // Track VLM costs
 * ```
 */

// Core
export { DesktopTest, createDesktopTest } from './core/desktop-test.js';
export { TestRunner } from './core/test-runner.js';
export { Assertions } from './core/assertions.js';

// Types - Enums
export {
  TestMode,
  LocatorStrategy,
  ActionStatus,
  VLMProvider,
  Platform,
} from './types.js';

// Types - Configurations
export type {
  DesktopTestConfig,
  VLMConfig,
  CDPConfig,
  PythonBridgeConfig,
  NutJSConfig,
} from './types.js';

// Types - Elements
export type {
  SnapshotResult,
  ElementRef,
  ElementLocator,
  BoundingBox,
} from './types.js';

// Types - Actions
export type {
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  WaitOptions,
  ScreenshotOptions,
  ActionResult,
} from './types.js';

// Types - VLM
export type {
  VLMFindRequest,
  VLMFindResponse,
  VLMActionRequest,
  VLMActionResponse,
  VLMAssertRequest,
  VLMAssertResponse,
  CostEntry,
  CostSummary,
} from './types.js';

// Types - Testing
export type {
  TestCase,
  TestFunction,
  TestContext,
  TestResult,
  TestSuiteResult,
  DesktopTestInstance,
  AssertionMethods,
  LogMethods,
  Reporter,
} from './types.js';

// Types - Adapters
export type {
  Adapter,
  CDPAdapterInterface,
  PythonBridgeInterface,
  NutJSAdapterInterface,
  VLMClientInterface,
} from './types.js';

// VLM
export { VLMClient } from './vlm/client.js';
export { CostTracker } from './vlm/cost-tracker.js';

// Adapters
export { CDPAdapter } from './adapters/cdp-adapter.js';
export { PythonBridge } from './adapters/python-bridge.js';
export { NutJSAdapter } from './adapters/nutjs-adapter.js';

// Convenience alias
export { TestMode as HybridMode } from './types.js';
