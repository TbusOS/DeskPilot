/**
 * @flowsight/desktop-test - Core DesktopTest Class
 *
 * The main entry point for the hybrid desktop testing framework.
 * Implements smart fallback chain: DOM → Accessibility → VLM
 */

import {
  TestMode,
  LocatorStrategy,
  ActionStatus,
  type DesktopTestConfig,
  type SnapshotResult,
  type ElementRef,
  type ElementLocator,
  type ClickOptions,
  type TypeOptions,
  type ScrollOptions,
  type WaitOptions,
  type ScreenshotOptions,
  type ActionResult,
  type BoundingBox,
  type DesktopTestInstance,
  type CostSummary,
  type CDPAdapterInterface,
  type PythonBridgeInterface,
  type NutJSAdapterInterface,
  type VLMClientInterface,
} from '../types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<DesktopTestConfig> = {
  mode: TestMode.HYBRID,
  cdp: { endpoint: 9222, timeout: 30000 },
  vlm: undefined as unknown as Required<DesktopTestConfig>['vlm'],
  pythonBridge: { debug: false },
  nutjs: { keyboard: true, mouse: true, keyDelay: 50, mouseSpeed: 500 },
  timeout: 30000,
  debug: false,
  screenshotDir: './screenshots',
  videoDir: './videos',
  session: 'default',
};

/**
 * Main Desktop Test class - implements the unified API with hybrid mode
 */
export class DesktopTest implements DesktopTestInstance {
  private config: Required<DesktopTestConfig>;
  private cdpAdapter: CDPAdapterInterface | null = null;
  private pythonBridge: PythonBridgeInterface | null = null;
  private nutjsAdapter: NutJSAdapterInterface | null = null;
  private vlmClient: VLMClientInterface | null = null;
  private connected: boolean = false;
  private lastSnapshot: SnapshotResult | null = null;

  constructor(config: DesktopTestConfig = {}) {
    this.config = this.mergeConfig(config);
  }

  private mergeConfig(config: DesktopTestConfig): Required<DesktopTestConfig> {
    return {
      ...DEFAULT_CONFIG,
      ...config,
      cdp: { ...DEFAULT_CONFIG.cdp, ...config.cdp },
      pythonBridge: { ...DEFAULT_CONFIG.pythonBridge, ...config.pythonBridge },
      nutjs: { ...DEFAULT_CONFIG.nutjs, ...config.nutjs },
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this.connected) return;

    this.log('Connecting to desktop application...');

    // Initialize CDP adapter for WebView control
    if (this.config.cdp) {
      const { CDPAdapter } = await import('../adapters/cdp-adapter.js');
      this.cdpAdapter = new CDPAdapter(this.config.cdp);
      await this.cdpAdapter.initialize();
      await this.cdpAdapter.connect();
      this.log('CDP adapter connected');
    }

    // Initialize Python bridge for native desktop control
    if (this.config.pythonBridge) {
      try {
        const { PythonBridge } = await import('../adapters/python-bridge.js');
        this.pythonBridge = new PythonBridge(this.config.pythonBridge);
        await this.pythonBridge.initialize();
        this.log('Python bridge initialized');
      } catch (e) {
        this.log('Python bridge not available, using NutJS fallback');
      }
    }

    // Initialize NutJS adapter as fallback for native control
    if (this.config.nutjs && !this.pythonBridge?.isAvailable()) {
      try {
        const { NutJSAdapter } = await import('../adapters/nutjs-adapter.js');
        this.nutjsAdapter = new NutJSAdapter(this.config.nutjs);
        await this.nutjsAdapter.initialize();
        this.log('NutJS adapter initialized');
      } catch (e) {
        this.log('NutJS adapter not available');
      }
    }

    // Initialize VLM client if in visual/hybrid mode
    if (this.config.vlm && this.getMode() !== TestMode.DETERMINISTIC) {
      const { VLMClient } = await import('../vlm/client.js');
      this.vlmClient = new VLMClient(this.config.vlm);
      this.log('VLM client initialized');
    }

    this.connected = true;
    this.log('Connected successfully');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    if (this.cdpAdapter) {
      await this.cdpAdapter.cleanup();
      this.cdpAdapter = null;
    }

    if (this.pythonBridge) {
      await this.pythonBridge.cleanup();
      this.pythonBridge = null;
    }

    if (this.nutjsAdapter) {
      await this.nutjsAdapter.cleanup();
      this.nutjsAdapter = null;
    }

    this.vlmClient = null;
    this.connected = false;
    this.log('Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private getMode(): TestMode {
    const mode = this.config.mode;
    if (typeof mode === 'string') {
      return mode as TestMode;
    }
    return mode;
  }

  // ============================================================================
  // Snapshot
  // ============================================================================

  async snapshot(options: { interactive?: boolean } = {}): Promise<SnapshotResult> {
    this.ensureConnected();

    if (!this.cdpAdapter) {
      throw new Error('CDP adapter not available for snapshot');
    }

    const result = await this.cdpAdapter.getSnapshot({
      interactive: options.interactive ?? true,
      includeScreenshot: this.getMode() !== TestMode.DETERMINISTIC,
    });

    this.lastSnapshot = result;
    return result;
  }

  // ============================================================================
  // Element Finding - Core Hybrid Mode Implementation
  // ============================================================================

  /**
   * Find element using hybrid fallback chain:
   * Level 1: Refs from snapshot (free, fast)
   * Level 2: CSS/XPath via CDP (free, fast)
   * Level 3: Visual AI via VLM (paid, intelligent)
   */
  async find(locator: string | ElementLocator): Promise<ElementRef | null> {
    this.ensureConnected();

    const normalized = this.normalizeLocator(locator);
    const mode = this.getMode();

    // Level 1 & 2: Try deterministic approach first (unless in VISUAL mode)
    if (mode !== TestMode.VISUAL) {
      const element = await this.findDeterministic(normalized);
      if (element) {
        this.log(`Found element via deterministic: ${normalized.value}`);
        return element;
      }
    }

    // Level 3: Fall back to VLM if in hybrid/visual mode
    if (mode !== TestMode.DETERMINISTIC && this.vlmClient) {
      this.log(`Falling back to VLM for: ${normalized.value}`);
      return this.findVisual(normalized);
    }

    return null;
  }

  async findAll(locator: string | ElementLocator): Promise<ElementRef[]> {
    this.ensureConnected();

    if (!this.cdpAdapter) return [];

    const normalized = this.normalizeLocator(locator);
    return this.cdpAdapter.findAll(normalized);
  }

  async waitFor(locator: string | ElementLocator, options: WaitOptions = {}): Promise<ElementRef> {
    const timeout = options.timeout || this.config.timeout;
    const interval = options.interval || 100;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = await this.find(locator);
      if (element) {
        if (options.state === 'hidden') {
          await this.wait(interval);
          continue;
        }
        return element;
      }
      await this.wait(interval);
    }

    throw new Error(`Element not found: ${JSON.stringify(locator)} (timeout: ${timeout}ms)`);
  }

  private async findDeterministic(locator: ElementLocator): Promise<ElementRef | null> {
    // Level 1: Try refs from snapshot
    if (locator.strategy === LocatorStrategy.REF) {
      const element = await this.findByRef(locator.value);
      if (element) return element;
    }

    // Level 2: Try CDP/DOM
    if (this.cdpAdapter) {
      return this.cdpAdapter.find(locator);
    }

    return null;
  }

  private async findByRef(ref: string): Promise<ElementRef | null> {
    if (!this.lastSnapshot) {
      await this.snapshot();
    }

    const cleanRef = ref.startsWith('@') ? ref.slice(1) : ref;
    const element = this.lastSnapshot?.refs[cleanRef];

    if (element) {
      return { ...element, source: 'dom' };
    }

    return null;
  }

  private async findVisual(locator: ElementLocator): Promise<ElementRef | null> {
    if (!this.vlmClient) return null;

    // Get screenshot
    const screenshot = await this.getScreenshotBase64();

    // Ask VLM to find the element
    const result = await this.vlmClient.findElement({
      screenshot,
      description: this.locatorToDescription(locator),
    });

    if (result.notFound || !result.coordinates) {
      return null;
    }

    // Create a virtual ElementRef from VLM response
    return {
      id: 'vlm_' + Date.now(),
      role: 'visual',
      name: locator.value,
      boundingBox: {
        x: result.coordinates.x,
        y: result.coordinates.y,
        width: 1,
        height: 1,
      },
      source: 'vlm',
    };
  }

  // ============================================================================
  // Actions
  // ============================================================================

  async click(locator: string | ElementLocator, options: ClickOptions = {}): Promise<ActionResult> {
    const startTime = Date.now();
    let usedVLM = false;

    try {
      const element = await this.find(locator);

      if (!element) {
        return {
          status: ActionStatus.NOT_FOUND,
          error: `Element not found: ${JSON.stringify(locator)}`,
          duration: Date.now() - startTime,
          usedVLM: false,
        };
      }

      usedVLM = element.source === 'vlm';

      // Use native adapter for precise clicking if we have coordinates
      if (element.boundingBox && (this.pythonBridge?.isAvailable() || this.nutjsAdapter?.isAvailable())) {
        const { x, y, width, height } = element.boundingBox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        if (this.pythonBridge?.isAvailable()) {
          await this.pythonBridge.click(centerX, centerY, options.button || 'left');
        } else if (this.nutjsAdapter?.isAvailable()) {
          await this.nutjsAdapter.click(centerX, centerY, options.button || 'left', options.count || 1);
        }
      } else if (this.cdpAdapter) {
        // Use CDP for WebView clicking
        await this.cdpAdapter.click(element, options);
      }

      return {
        status: usedVLM ? ActionStatus.VLM_FALLBACK : ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM,
        vlmCost: usedVLM ? this.vlmClient?.getCostSummary().totalCost : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM,
      };
    }
  }

  async dblclick(locator: string | ElementLocator): Promise<ActionResult> {
    return this.click(locator, { count: 2 });
  }

  async rightClick(locator: string | ElementLocator): Promise<ActionResult> {
    return this.click(locator, { button: 'right' });
  }

  async type(locator: string | ElementLocator, text: string, options: TypeOptions = {}): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const element = await this.find(locator);
      if (!element) {
        return {
          status: ActionStatus.NOT_FOUND,
          error: `Element not found: ${JSON.stringify(locator)}`,
          duration: Date.now() - startTime,
          usedVLM: false,
        };
      }

      // Click to focus first
      await this.click(locator);

      if (options.clear) {
        await this.clear(locator);
      }

      // Type using appropriate adapter
      if (this.pythonBridge?.isAvailable()) {
        await this.pythonBridge.typeText(text);
      } else if (this.nutjsAdapter?.isAvailable()) {
        await this.nutjsAdapter.type(text, options.delay);
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.type(element, text, options);
      }

      if (options.submit) {
        await this.press('Enter');
      }

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: element.source === 'vlm',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }
  }

  async fill(locator: string | ElementLocator, text: string): Promise<ActionResult> {
    return this.type(locator, text, { clear: true });
  }

  async clear(locator: string | ElementLocator): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      await this.click(locator);
      await this.press('Control+a');
      await this.press('Backspace');

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }
  }

  async press(key: string): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      // Parse key combination (e.g., "Control+a", "Meta+Shift+s")
      const parts = key.split('+');
      const mainKey = parts[parts.length - 1];
      const modifiers = parts.slice(0, -1);

      if (this.pythonBridge?.isAvailable()) {
        await this.pythonBridge.pressKey(mainKey, modifiers);
      } else if (this.nutjsAdapter?.isAvailable()) {
        await this.nutjsAdapter.press(key);
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.press(key);
      }

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }
  }

  async hover(locator: string | ElementLocator): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const element = await this.find(locator);
      if (!element) {
        return {
          status: ActionStatus.NOT_FOUND,
          error: `Element not found: ${JSON.stringify(locator)}`,
          duration: Date.now() - startTime,
          usedVLM: false,
        };
      }

      if (element.boundingBox && (this.pythonBridge?.isAvailable() || this.nutjsAdapter?.isAvailable())) {
        const { x, y, width, height } = element.boundingBox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        if (this.nutjsAdapter?.isAvailable()) {
          await this.nutjsAdapter.moveTo(centerX, centerY);
        }
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.hover(element);
      }

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: element.source === 'vlm',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }
  }

  async scroll(options: ScrollOptions): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const amount = options.amount || 100;

      if (this.nutjsAdapter?.isAvailable()) {
        await this.nutjsAdapter.scroll(options.direction, amount);
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.scroll(options);
      }

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }
  }

  async drag(from: string | ElementLocator, to: string | ElementLocator): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const fromElement = await this.find(from);
      const toElement = await this.find(to);

      if (!fromElement || !toElement) {
        return {
          status: ActionStatus.NOT_FOUND,
          error: 'Source or target element not found',
          duration: Date.now() - startTime,
          usedVLM: false,
        };
      }

      if (fromElement.boundingBox && toElement.boundingBox && this.nutjsAdapter?.isAvailable()) {
        const fromBox = fromElement.boundingBox;
        const toBox = toElement.boundingBox;
        await this.nutjsAdapter.drag(
          fromBox.x + fromBox.width / 2,
          fromBox.y + fromBox.height / 2,
          toBox.x + toBox.width / 2,
          toBox.y + toBox.height / 2
        );
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.drag(fromElement, toElement);
      }

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }
  }

  // ============================================================================
  // Visual AI Methods
  // ============================================================================

  async clickText(text: string): Promise<ActionResult> {
    return this.click({ strategy: LocatorStrategy.VISUAL, value: `button or link with text "${text}"` });
  }

  async clickImage(description: string): Promise<ActionResult> {
    return this.click({ strategy: LocatorStrategy.VISUAL, value: description });
  }

  async ai(instruction: string): Promise<ActionResult> {
    const startTime = Date.now();

    if (!this.vlmClient) {
      return {
        status: ActionStatus.FAILED,
        error: 'VLM client not configured. Enable visual or hybrid mode.',
        duration: Date.now() - startTime,
        usedVLM: false,
      };
    }

    try {
      const actionSpaces = [
        'click(x, y)',
        'type(text)',
        'scroll(direction)',
        'press(key)',
        'wait()',
        'finished()',
      ];

      let maxIterations = 10;
      let finished = false;

      while (!finished && maxIterations > 0) {
        const screenshot = await this.getScreenshotBase64();

        const response = await this.vlmClient.getNextAction({
          screenshot,
          instruction,
          actionSpaces,
        });

        if (response.finished) {
          finished = true;
          break;
        }

        // Execute the action
        await this.executeVLMAction(response);
        await this.wait(500);
        maxIterations--;
      }

      return {
        status: ActionStatus.SUCCESS,
        duration: Date.now() - startTime,
        usedVLM: true,
        vlmCost: this.vlmClient.getCostSummary().totalCost,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: ActionStatus.FAILED,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: true,
      };
    }
  }

  private async executeVLMAction(response: { actionType: string; actionParams: Record<string, unknown> }): Promise<void> {
    switch (response.actionType) {
      case 'click':
        if (this.nutjsAdapter?.isAvailable() && response.actionParams.x && response.actionParams.y) {
          await this.nutjsAdapter.click(
            response.actionParams.x as number,
            response.actionParams.y as number
          );
        }
        break;
      case 'type':
        if (this.nutjsAdapter?.isAvailable() && response.actionParams.text) {
          await this.nutjsAdapter.type(response.actionParams.text as string);
        }
        break;
      case 'scroll':
        await this.scroll({ direction: (response.actionParams.direction as ScrollOptions['direction']) || 'down' });
        break;
      case 'press':
        await this.press((response.actionParams.key as string) || 'Enter');
        break;
      case 'wait':
        await this.wait(2000);
        break;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  async getText(locator: string | ElementLocator): Promise<string> {
    this.ensureConnected();

    if (!this.cdpAdapter) return '';

    const element = await this.find(locator);
    if (!element) return '';

    return this.cdpAdapter.getText(element);
  }

  async getValue(locator: string | ElementLocator): Promise<string> {
    this.ensureConnected();

    if (!this.cdpAdapter) return '';

    const element = await this.find(locator);
    if (!element) return '';

    return this.cdpAdapter.getValue(element);
  }

  async getAttribute(locator: string | ElementLocator, attr: string): Promise<string | null> {
    this.ensureConnected();

    if (!this.cdpAdapter) return null;

    const element = await this.find(locator);
    if (!element) return null;

    return this.cdpAdapter.getAttribute(element, attr);
  }

  async isVisible(locator: string | ElementLocator): Promise<boolean> {
    const element = await this.find(locator);
    if (!element) return false;

    if (this.cdpAdapter) {
      return this.cdpAdapter.isVisible(element);
    }

    return true;
  }

  async isEnabled(locator: string | ElementLocator): Promise<boolean> {
    const element = await this.find(locator);
    if (!element) return false;

    if (this.cdpAdapter) {
      return this.cdpAdapter.isEnabled(element);
    }

    return true;
  }

  async count(locator: string | ElementLocator): Promise<number> {
    const elements = await this.findAll(locator);
    return elements.length;
  }

  async boundingBox(locator: string | ElementLocator): Promise<BoundingBox | null> {
    const element = await this.find(locator);
    return element?.boundingBox || null;
  }

  // ============================================================================
  // Page
  // ============================================================================

  async getUrl(): Promise<string> {
    this.ensureConnected();

    if (!this.cdpAdapter) return '';

    return this.cdpAdapter.getUrl();
  }

  async getTitle(): Promise<string> {
    this.ensureConnected();

    if (!this.cdpAdapter) return '';

    return this.cdpAdapter.getTitle();
  }

  async evaluate<T>(script: string): Promise<T> {
    this.ensureConnected();

    if (!this.cdpAdapter) {
      throw new Error('CDP adapter not available for evaluate');
    }

    return this.cdpAdapter.evaluate(script);
  }

  // ============================================================================
  // Screenshot & Recording
  // ============================================================================

  async screenshot(path?: string, options: ScreenshotOptions = {}): Promise<string> {
    this.ensureConnected();

    if (!this.cdpAdapter) {
      throw new Error('CDP adapter not available for screenshot');
    }

    return this.cdpAdapter.screenshot(path, options);
  }

  async startRecording(path: string): Promise<void> {
    this.ensureConnected();

    if (!this.cdpAdapter) {
      throw new Error('CDP adapter not available for recording');
    }

    await this.cdpAdapter.startRecording(path);
  }

  async stopRecording(): Promise<{ path: string }> {
    this.ensureConnected();

    if (!this.cdpAdapter) {
      throw new Error('CDP adapter not available for recording');
    }

    return this.cdpAdapter.stopRecording();
  }

  // ============================================================================
  // Cost Tracking
  // ============================================================================

  getCostSummary(): CostSummary {
    if (!this.vlmClient) {
      return {
        totalCost: 0,
        totalCalls: 0,
        byProvider: {},
        byOperation: {},
        entries: [],
      };
    }

    return this.vlmClient.getCostSummary();
  }

  resetCostTracking(): void {
    this.vlmClient?.resetCostTracking();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForIdle(timeout: number = 5000): Promise<void> {
    this.ensureConnected();

    if (this.cdpAdapter) {
      await this.cdpAdapter.waitForIdle(timeout);
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }

  private normalizeLocator(locator: string | ElementLocator): ElementLocator {
    if (typeof locator === 'string') {
      // Parse string locator
      if (locator.startsWith('@')) {
        return { strategy: LocatorStrategy.REF, value: locator };
      }
      if (locator.startsWith('//')) {
        return { strategy: LocatorStrategy.XPATH, value: locator };
      }
      if (locator.startsWith('text=')) {
        return { strategy: LocatorStrategy.TEXT, value: locator.slice(5) };
      }
      if (locator.startsWith('role=')) {
        return { strategy: LocatorStrategy.ROLE, value: locator.slice(5) };
      }
      if (locator.startsWith('[data-testid=')) {
        return { strategy: LocatorStrategy.TESTID, value: locator };
      }
      // Default to CSS
      return { strategy: LocatorStrategy.CSS, value: locator };
    }
    return locator;
  }

  private locatorToDescription(locator: ElementLocator): string {
    switch (locator.strategy) {
      case LocatorStrategy.TEXT:
        return `element with text "${locator.value}"`;
      case LocatorStrategy.ROLE:
        return `${locator.value} element`;
      case LocatorStrategy.VISUAL:
        return locator.value;
      default:
        return `element matching ${locator.value}`;
    }
  }

  private async getScreenshotBase64(): Promise<string> {
    if (this.cdpAdapter) {
      return this.cdpAdapter.getScreenshotBase64();
    }
    if (this.nutjsAdapter?.isAvailable()) {
      return this.nutjsAdapter.screenshot();
    }
    if (this.pythonBridge?.isAvailable()) {
      return this.pythonBridge.screenshot();
    }
    throw new Error('No adapter available for screenshot');
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[desktop-test] ${message}`, ...args);
    }
  }
}

/**
 * Factory function for creating DesktopTest instance
 */
export function createDesktopTest(config: DesktopTestConfig = {}): DesktopTest {
  return new DesktopTest(config);
}
