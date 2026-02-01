/**
 * @flowsight/desktop-test - Core Type Definitions
 *
 * Comprehensive type system for the hybrid desktop testing framework.
 * Combines deterministic DOM testing with VLM-powered visual AI fallback.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Testing mode - determines element location strategy
 */
export enum TestMode {
  /** DOM/Accessibility tree only - free, fast, deterministic */
  DETERMINISTIC = 'deterministic',
  /** VLM-based visual understanding - intelligent but costs API calls */
  VISUAL = 'visual',
  /** Smart: deterministic first, VLM fallback when element not found */
  HYBRID = 'hybrid',
}

/**
 * Element location strategy
 */
export enum LocatorStrategy {
  /** Reference from snapshot (e.g., @e1) */
  REF = 'ref',
  /** CSS selector */
  CSS = 'css',
  /** XPath */
  XPATH = 'xpath',
  /** ARIA role + name */
  ROLE = 'role',
  /** Text content */
  TEXT = 'text',
  /** Visual AI (screenshot + VLM) */
  VISUAL = 'visual',
  /** Test ID attribute */
  TESTID = 'testid',
}

/**
 * Action execution status
 */
export enum ActionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not_found',
  VLM_FALLBACK = 'vlm_fallback',
}

/**
 * VLM Provider
 */
export enum VLMProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  VOLCENGINE = 'volcengine',
  DOUBAO = 'doubao',
  CUSTOM = 'custom',
  /** Use Cursor's built-in Claude model via MCP */
  CURSOR = 'cursor',
  /** 
   * Auto-detect any Claude Agent environment:
   * - Cursor IDE
   * - Claude Code CLI (terminal)
   * - VSCode Claude plugin  
   * - Claude Desktop
   * - Any MCP environment
   */
  AGENT = 'agent',
}

/**
 * Platform type
 */
export enum Platform {
  MACOS = 'darwin',
  WINDOWS = 'win32',
  LINUX = 'linux',
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * VLM configuration
 */
export interface VLMConfig {
  /** Provider name */
  provider: VLMProvider | string;
  /** Model name */
  model?: string;
  /** API key (can also use env var) */
  apiKey?: string;
  /** API base URL (for custom providers) */
  baseURL?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Enable cost tracking */
  trackCost?: boolean;
}

/**
 * CDP (Chrome DevTools Protocol) configuration
 */
export interface CDPConfig {
  /** Port number or WebSocket URL */
  endpoint: string | number;
  /** Timeout for connection (ms) */
  timeout?: number;
}

/**
 * Python bridge configuration
 */
export interface PythonBridgeConfig {
  /** Path to Python executable */
  pythonPath?: string;
  /** Path to bridge server script */
  serverPath?: string;
  /** Communication port */
  port?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * NutJS (native desktop control) configuration
 */
export interface NutJSConfig {
  /** Enable keyboard control */
  keyboard?: boolean;
  /** Enable mouse control */
  mouse?: boolean;
  /** Key press delay (ms) */
  keyDelay?: number;
  /** Mouse move speed */
  mouseSpeed?: number;
}

/**
 * Main test configuration
 */
export interface DesktopTestConfig {
  /** Testing mode */
  mode?: TestMode | 'deterministic' | 'visual' | 'hybrid';
  /** CDP configuration (for WebView testing) */
  cdp?: CDPConfig;
  /** VLM configuration (for visual AI mode) */
  vlm?: VLMConfig;
  /** Python bridge configuration (for native desktop control) */
  pythonBridge?: PythonBridgeConfig;
  /** NutJS configuration (for cross-platform native control) */
  nutjs?: NutJSConfig;
  /** Default timeout (ms) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Screenshot directory */
  screenshotDir?: string;
  /** Video recording directory */
  videoDir?: string;
  /** Session name (for parallel testing) */
  session?: string;
}

// ============================================================================
// Element Types
// ============================================================================

/**
 * Bounding box for element positioning
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Element reference from snapshot
 */
export interface ElementRef {
  /** Reference ID (e.g., "e1") */
  id: string;
  /** ARIA role */
  role: string;
  /** Accessible name */
  name?: string;
  /** Nth index (for disambiguation) */
  nth?: number;
  /** Bounding box (if available) */
  boundingBox?: BoundingBox;
  /** Source: how this element was found */
  source?: 'dom' | 'accessibility' | 'vlm';
}

/**
 * Snapshot result from page
 */
export interface SnapshotResult {
  /** Accessibility tree as string */
  tree: string;
  /** Element references map */
  refs: Record<string, ElementRef>;
  /** Timestamp */
  timestamp: number;
  /** Screenshot base64 (if captured) */
  screenshot?: string;
}

/**
 * Element locator specification
 */
export interface ElementLocator {
  /** Locator strategy */
  strategy: LocatorStrategy;
  /** Locator value */
  value: string;
  /** Optional: within another element */
  within?: ElementLocator;
  /** Optional: nth match */
  nth?: number;
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * Click options
 */
export interface ClickOptions {
  /** Button: left, right, middle */
  button?: 'left' | 'right' | 'middle';
  /** Click count */
  count?: number;
  /** Delay between clicks (ms) */
  delay?: number;
  /** Force click even if not visible */
  force?: boolean;
  /** Timeout (ms) */
  timeout?: number;
}

/**
 * Type/input options
 */
export interface TypeOptions {
  /** Delay between keystrokes (ms) */
  delay?: number;
  /** Clear existing content first */
  clear?: boolean;
  /** Press Enter after typing */
  submit?: boolean;
}

/**
 * Scroll options
 */
export interface ScrollOptions {
  /** Direction */
  direction: 'up' | 'down' | 'left' | 'right';
  /** Amount in pixels */
  amount?: number;
  /** Smooth scroll */
  smooth?: boolean;
}

/**
 * Wait options
 */
export interface WaitOptions {
  /** Timeout (ms) */
  timeout?: number;
  /** Polling interval (ms) */
  interval?: number;
  /** State to wait for */
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  /** Full page screenshot */
  fullPage?: boolean;
  /** Format */
  format?: 'png' | 'jpeg';
  /** Quality (jpeg only) */
  quality?: number;
  /** Clip region */
  clip?: BoundingBox;
}

/**
 * Action result with detailed information
 */
export interface ActionResult<T = void> {
  /** Status */
  status: ActionStatus;
  /** Result data */
  data?: T;
  /** Error message */
  error?: string;
  /** Execution time (ms) */
  duration: number;
  /** Used VLM fallback */
  usedVLM: boolean;
  /** VLM cost (if tracked) */
  vlmCost?: number;
  /** Screenshot (if captured) */
  screenshot?: string;
}

// ============================================================================
// VLM Types
// ============================================================================

/**
 * VLM request for element finding
 */
export interface VLMFindRequest {
  /** Screenshot base64 */
  screenshot: string;
  /** Element description */
  description: string;
  /** Context (what we're looking for) */
  context?: string;
  /** Previous actions (for context) */
  history?: string[];
}

/**
 * VLM response for element finding
 */
export interface VLMFindResponse {
  /** Found element coordinates */
  coordinates?: { x: number; y: number };
  /** Confidence (0-1) */
  confidence: number;
  /** Reasoning */
  reasoning: string;
  /** Element not found */
  notFound?: boolean;
  /** Suggested alternative */
  alternative?: string;
}

/**
 * VLM request for action execution
 */
export interface VLMActionRequest {
  /** Screenshot base64 */
  screenshot: string;
  /** Instruction */
  instruction: string;
  /** Available action spaces */
  actionSpaces: string[];
}

/**
 * VLM response for action execution
 */
export interface VLMActionResponse {
  /** Action type */
  actionType: string;
  /** Action parameters */
  actionParams: Record<string, unknown>;
  /** Thought process */
  thought: string;
  /** Reflection */
  reflection?: string;
  /** Is task finished */
  finished: boolean;
}

/**
 * VLM request for assertion
 */
export interface VLMAssertRequest {
  /** Screenshot base64 */
  screenshot: string;
  /** Assertion description */
  assertion: string;
  /** Expected behavior */
  expected?: string;
}

/**
 * VLM response for assertion
 */
export interface VLMAssertResponse {
  /** Assertion passed */
  passed: boolean;
  /** Reasoning */
  reasoning: string;
  /** Actual observation */
  actual: string;
  /** Suggestions for fixing */
  suggestions?: string[];
}

/**
 * Cost tracking entry
 */
export interface CostEntry {
  /** Provider */
  provider: VLMProvider | string;
  /** Model */
  model: string;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Images count */
  images: number;
  /** Estimated cost (USD) */
  cost: number;
  /** Timestamp */
  timestamp: number;
  /** Operation type */
  operation: 'find' | 'action' | 'assert' | 'analyze';
}

/**
 * Cost summary
 */
export interface CostSummary {
  /** Total cost (USD) */
  totalCost: number;
  /** Total API calls */
  totalCalls: number;
  /** Cost by provider */
  byProvider: Record<string, number>;
  /** Cost by operation */
  byOperation: Record<string, number>;
  /** Detailed entries */
  entries: CostEntry[];
}

// ============================================================================
// Test Types
// ============================================================================

/**
 * Test case definition
 */
export interface TestCase {
  /** Test name */
  name: string;
  /** Test category */
  category?: string;
  /** Test function */
  fn: TestFunction;
  /** Test timeout */
  timeout?: number;
  /** Skip test */
  skip?: boolean;
  /** Only run this test */
  only?: boolean;
  /** Retry count */
  retries?: number;
}

/**
 * Test function signature
 */
export type TestFunction = (ctx: TestContext) => Promise<void>;

/**
 * Test context (passed to test functions)
 */
export interface TestContext {
  /** Desktop test instance */
  test: DesktopTestInstance;
  /** Assertions */
  assert: AssertionMethods;
  /** Logger */
  log: LogMethods;
}

/**
 * Desktop test instance interface (main API)
 */
export interface DesktopTestInstance {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Snapshot
  snapshot(options?: { interactive?: boolean }): Promise<SnapshotResult>;

  // Element finding
  find(locator: string | ElementLocator): Promise<ElementRef | null>;
  findAll(locator: string | ElementLocator): Promise<ElementRef[]>;
  waitFor(locator: string | ElementLocator, options?: WaitOptions): Promise<ElementRef>;

  // Actions
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

  // Visual AI methods (VLM mode)
  clickText(text: string): Promise<ActionResult>;
  clickImage(description: string): Promise<ActionResult>;
  ai(instruction: string): Promise<ActionResult>;

  // Getters
  getText(locator: string | ElementLocator): Promise<string>;
  getValue(locator: string | ElementLocator): Promise<string>;
  getAttribute(locator: string | ElementLocator, attr: string): Promise<string | null>;
  isVisible(locator: string | ElementLocator): Promise<boolean>;
  isEnabled(locator: string | ElementLocator): Promise<boolean>;
  count(locator: string | ElementLocator): Promise<number>;
  boundingBox(locator: string | ElementLocator): Promise<BoundingBox | null>;

  // Page
  getUrl(): Promise<string>;
  getTitle(): Promise<string>;
  evaluate<T>(script: string): Promise<T>;

  // Screenshot & Recording
  screenshot(path?: string, options?: ScreenshotOptions): Promise<string>;
  startRecording(path: string): Promise<void>;
  stopRecording(): Promise<{ path: string }>;

  // Cost tracking
  getCostSummary(): CostSummary;
  resetCostTracking(): void;

  // Utilities
  wait(ms: number): Promise<void>;
  waitForIdle(timeout?: number): Promise<void>;
}

/**
 * Assertion methods
 */
export interface AssertionMethods {
  // Basic
  ok(condition: boolean, message?: string): void;
  equal<T>(actual: T, expected: T, message?: string): void;
  notEqual<T>(actual: T, expected: T, message?: string): void;

  // Numbers
  greaterThan(actual: number, expected: number, message?: string): void;
  lessThan(actual: number, expected: number, message?: string): void;
  greaterOrEqual(actual: number, expected: number, message?: string): void;
  lessOrEqual(actual: number, expected: number, message?: string): void;

  // Strings
  contains(haystack: string, needle: string, message?: string): void;
  matches(actual: string, pattern: RegExp, message?: string): void;

  // Elements
  exists(locator: string | ElementLocator, message?: string): Promise<void>;
  notExists(locator: string | ElementLocator, message?: string): Promise<void>;
  visible(locator: string | ElementLocator, message?: string): Promise<void>;
  hidden(locator: string | ElementLocator, message?: string): Promise<void>;
  hasText(locator: string | ElementLocator, text: string, message?: string): Promise<void>;
  hasValue(locator: string | ElementLocator, value: string, message?: string): Promise<void>;
  hasAttribute(locator: string | ElementLocator, attr: string, value?: string, message?: string): Promise<void>;

  // Data correctness (key feature for preventing "0 files" bug)
  notZero(locator: string | ElementLocator, message?: string): Promise<void>;
  notEmpty(locator: string | ElementLocator, message?: string): Promise<void>;
  dataCorrect(locator: string | ElementLocator, validator: (data: string) => boolean, message?: string): Promise<void>;

  // Visual AI assertions
  visualCheck(description: string, message?: string): Promise<void>;
  noVisualRegression(baseline: string, threshold?: number): Promise<void>;
}

/**
 * Log methods
 */
export interface LogMethods {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  step(message: string): void;
}

// ============================================================================
// Test Runner Types
// ============================================================================

/**
 * Test result
 */
export interface TestResult {
  /** Test case */
  test: TestCase;
  /** Passed */
  passed: boolean;
  /** Error */
  error?: Error;
  /** Duration (ms) */
  duration: number;
  /** Screenshots captured */
  screenshots: string[];
  /** Video path */
  video?: string;
  /** Used VLM */
  usedVLM: boolean;
  /** VLM cost */
  vlmCost?: number;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite name */
  name: string;
  /** Test results */
  tests: TestResult[];
  /** Total passed */
  passed: number;
  /** Total failed */
  failed: number;
  /** Total skipped */
  skipped: number;
  /** Total duration */
  duration: number;
  /** Total VLM cost */
  totalVLMCost: number;
}

/**
 * Reporter interface
 */
export interface Reporter {
  onTestStart(test: TestCase): void;
  onTestEnd(result: TestResult): void;
  onSuiteStart(name: string): void;
  onSuiteEnd(result: TestSuiteResult): void;
}

// ============================================================================
// Adapter Interfaces
// ============================================================================

/**
 * Base adapter interface
 */
export interface Adapter {
  /** Initialize adapter */
  initialize(): Promise<void>;
  /** Cleanup adapter */
  cleanup(): Promise<void>;
  /** Check if available */
  isAvailable(): boolean;
}

/**
 * CDP adapter interface
 */
export interface CDPAdapterInterface extends Adapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(options?: { interactive?: boolean; includeScreenshot?: boolean }): Promise<SnapshotResult>;
  find(locator: ElementLocator): Promise<ElementRef | null>;
  findAll(locator: ElementLocator): Promise<ElementRef[]>;
  click(element: ElementRef, options?: ClickOptions): Promise<void>;
  type(element: ElementRef, text: string, options?: TypeOptions): Promise<void>;
  press(key: string): Promise<void>;
  hover(element: ElementRef): Promise<void>;
  scroll(options: ScrollOptions): Promise<void>;
  drag(from: ElementRef, to: ElementRef): Promise<void>;
  getText(element: ElementRef): Promise<string>;
  getValue(element: ElementRef): Promise<string>;
  getAttribute(element: ElementRef, attr: string): Promise<string | null>;
  isVisible(element: ElementRef): Promise<boolean>;
  isEnabled(element: ElementRef): Promise<boolean>;
  getUrl(): Promise<string>;
  getTitle(): Promise<string>;
  evaluate<T>(script: string): Promise<T>;
  screenshot(path?: string, options?: ScreenshotOptions): Promise<string>;
  getScreenshotBase64(): Promise<string>;
  startRecording(path: string): Promise<void>;
  stopRecording(): Promise<{ path: string }>;
  waitForIdle(timeout?: number): Promise<void>;
}

/**
 * Python bridge adapter interface
 */
export interface PythonBridgeInterface extends Adapter {
  /** Call Python method */
  call<T>(method: string, args?: unknown[]): Promise<T>;
  /** Take screenshot via Python */
  screenshot(): Promise<string>;
  /** Click at coordinates via Python */
  click(x: number, y: number, button?: string): Promise<void>;
  /** Type text via Python */
  typeText(text: string): Promise<void>;
  /** Press key via Python */
  pressKey(key: string, modifiers?: string[]): Promise<void>;
  /** Get accessibility tree via Python */
  getAccessibilityTree(): Promise<unknown>;
  /** Analyze screenshot with VLM via Python */
  analyzeVisual(screenshotBase64: string): Promise<unknown>;
}

/**
 * NutJS adapter interface
 */
export interface NutJSAdapterInterface extends Adapter {
  click(x: number, y: number, button?: 'left' | 'right' | 'middle', count?: number): Promise<void>;
  moveTo(x: number, y: number): Promise<void>;
  type(text: string, delay?: number): Promise<void>;
  press(key: string): Promise<void>;
  scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number): Promise<void>;
  drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
  screenshot(): Promise<string>;
  getScreenSize(): Promise<{ width: number; height: number }>;
}

/**
 * VLM client interface
 */
export interface VLMClientInterface {
  findElement(request: VLMFindRequest): Promise<VLMFindResponse>;
  getNextAction(request: VLMActionRequest): Promise<VLMActionResponse>;
  assertVisual(request: VLMAssertRequest): Promise<VLMAssertResponse>;
  getCostSummary(): CostSummary;
  resetCostTracking(): void;
}
