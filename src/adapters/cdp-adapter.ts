/**
 * @flowsight/desktop-test - CDP Adapter
 *
 * Chrome DevTools Protocol adapter for WebView/Browser control.
 * Uses agent-browser CLI under the hood for Tauri/Electron app testing.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

import {
  LocatorStrategy,
  type CDPConfig,
  type SnapshotResult,
  type ElementRef,
  type ElementLocator,
  type ClickOptions,
  type TypeOptions,
  type ScrollOptions,
  type ScreenshotOptions,
  type CDPAdapterInterface,
} from '../types.js';

/**
 * CDP Adapter - controls WebView through Chrome DevTools Protocol
 */
export class CDPAdapter implements CDPAdapterInterface {
  private config: Required<CDPConfig>;
  private connected: boolean = false;
  private refMap: Map<string, ElementRef> = new Map();
  private refCounter: number = 0;
  private session: string;

  constructor(config: CDPConfig) {
    this.config = {
      endpoint: config.endpoint,
      timeout: config.timeout || 30000,
    };
    this.session = `session_${Date.now()}`;
  }

  /**
   * Initialize adapter
   */
  async initialize(): Promise<void> {
    // Check if agent-browser is available
    try {
      execSync('agent-browser --version', { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      console.warn('[CDP Adapter] agent-browser not found. Install with: npm install -g agent-browser');
    }
  }

  /**
   * Cleanup adapter
   */
  async cleanup(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Check if available
   */
  isAvailable(): boolean {
    try {
      execSync('agent-browser --version', { encoding: 'utf-8', stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect to the browser/app via CDP
   */
  async connect(): Promise<void> {
    const endpoint = typeof this.config.endpoint === 'number'
      ? String(this.config.endpoint)
      : this.config.endpoint;

    try {
      this.exec(['open', `--cdp=${endpoint}`]);
      this.connected = true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect via CDP: ${message}`);
    }
  }

  /**
   * Disconnect from the browser/app
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      this.exec(['close']);
    } catch {
      // Ignore close errors
    }

    this.connected = false;
  }

  /**
   * Get accessibility snapshot with refs
   */
  async getSnapshot(options: { interactive?: boolean; includeScreenshot?: boolean } = {}): Promise<SnapshotResult> {
    this.ensureConnected();

    const args = ['snapshot'];
    if (options.interactive) args.push('-i');

    const result = this.execJson<{ snapshot: string; refs?: Record<string, { role: string; name?: string }> }>(args);

    // Convert refs to our format
    const refs: Record<string, ElementRef> = {};
    if (result.refs) {
      for (const [key, value] of Object.entries(result.refs)) {
        refs[key] = {
          id: key,
          role: value.role,
          name: value.name,
          source: 'dom',
        };
        this.refMap.set(key, refs[key]);
      }
    }

    let screenshot: string | undefined;
    if (options.includeScreenshot) {
      screenshot = await this.getScreenshotBase64();
    }

    return {
      tree: result.snapshot || '',
      refs,
      timestamp: Date.now(),
      screenshot,
    };
  }

  /**
   * Find single element
   */
  async find(locator: ElementLocator): Promise<ElementRef | null> {
    this.ensureConnected();

    try {
      const selector = this.locatorToSelector(locator);
      const result = this.execJson<{ visible: boolean }>(['is', 'visible', selector]);

      if (result.visible) {
        const refId = `cdp_${++this.refCounter}`;
        return {
          id: refId,
          role: 'element',
          name: locator.value,
          source: 'dom',
        };
      }
    } catch {
      // Element not found
    }

    return null;
  }

  /**
   * Find all matching elements
   */
  async findAll(locator: ElementLocator): Promise<ElementRef[]> {
    this.ensureConnected();

    try {
      const selector = this.locatorToSelector(locator);
      const result = this.execJson<{ count: number }>(['get', 'count', selector]);

      const count = result.count || 0;
      return Array.from({ length: count }, (_, i) => ({
        id: `cdp_${++this.refCounter}`,
        role: 'element',
        name: locator.value,
        nth: i,
        source: 'dom' as const,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Click element
   */
  async click(element: ElementRef, options: ClickOptions = {}): Promise<void> {
    this.ensureConnected();

    const selector = this.elementToSelector(element);
    const args = ['click', selector];

    if (options.count && options.count > 1) {
      // For double-click
      this.exec(['dblclick', selector]);
    } else {
      this.exec(args);
    }
  }

  /**
   * Type text
   */
  async type(element: ElementRef, text: string, _options: TypeOptions = {}): Promise<void> {
    this.ensureConnected();

    const selector = this.elementToSelector(element);
    const escapedText = text.replace(/"/g, '\\"');
    this.exec(['type', selector, `"${escapedText}"`]);
  }

  /**
   * Press key
   */
  async press(key: string): Promise<void> {
    this.ensureConnected();
    this.exec(['press', key]);
  }

  /**
   * Hover over element
   */
  async hover(element: ElementRef): Promise<void> {
    this.ensureConnected();

    const selector = this.elementToSelector(element);
    this.exec(['hover', selector]);
  }

  /**
   * Scroll
   */
  async scroll(options: ScrollOptions): Promise<void> {
    this.ensureConnected();

    const amount = options.amount || 100;
    this.exec(['scroll', options.direction, String(amount)]);
  }

  /**
   * Drag element
   */
  async drag(from: ElementRef, to: ElementRef): Promise<void> {
    this.ensureConnected();

    const fromSelector = this.elementToSelector(from);
    const toSelector = this.elementToSelector(to);
    this.exec(['drag', fromSelector, toSelector]);
  }

  /**
   * Get element text
   */
  async getText(element: ElementRef): Promise<string> {
    this.ensureConnected();

    const selector = this.elementToSelector(element);
    const result = this.execJson<{ text: string }>(['get', 'text', selector]);
    return result.text || '';
  }

  /**
   * Get element value
   */
  async getValue(element: ElementRef): Promise<string> {
    this.ensureConnected();

    const selector = this.elementToSelector(element);
    const result = this.execJson<{ value: string }>(['get', 'value', selector]);
    return result.value || '';
  }

  /**
   * Get element attribute
   */
  async getAttribute(element: ElementRef, attr: string): Promise<string | null> {
    this.ensureConnected();

    const selector = this.elementToSelector(element);
    const result = this.execJson<{ value: string | null }>(['get', 'attr', selector, attr]);
    return result.value;
  }

  /**
   * Check if element is visible
   */
  async isVisible(element: ElementRef): Promise<boolean> {
    this.ensureConnected();

    try {
      const selector = this.elementToSelector(element);
      const result = this.execJson<{ visible: boolean }>(['is', 'visible', selector]);
      return result.visible;
    } catch {
      return false;
    }
  }

  /**
   * Check if element is enabled
   */
  async isEnabled(element: ElementRef): Promise<boolean> {
    this.ensureConnected();

    try {
      const selector = this.elementToSelector(element);
      const result = this.execJson<{ enabled: boolean }>(['is', 'enabled', selector]);
      return result.enabled;
    } catch {
      return false;
    }
  }

  /**
   * Get current URL
   */
  async getUrl(): Promise<string> {
    this.ensureConnected();

    const result = this.execJson<{ url: string }>(['get', 'url']);
    return result.url || '';
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    this.ensureConnected();

    const result = this.execJson<{ title: string }>(['get', 'title']);
    return result.title || '';
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate<T>(script: string): Promise<T> {
    this.ensureConnected();

    const escapedScript = script.replace(/"/g, '\\"');
    const result = this.execJson<{ result: T }>(['eval', `"${escapedScript}"`]);
    return result.result;
  }

  /**
   * Take screenshot
   */
  async screenshot(screenshotPath?: string, options: ScreenshotOptions = {}): Promise<string> {
    this.ensureConnected();

    const args = ['screenshot'];
    if (screenshotPath) args.push(screenshotPath);
    if (options.fullPage) args.push('--full');

    const result = this.execJson<{ path: string }>(args);
    return result.path;
  }

  /**
   * Get screenshot as base64
   */
  async getScreenshotBase64(): Promise<string> {
    const tempPath = `/tmp/desktop-test-screenshot-${Date.now()}.jpg`;

    try {
      this.exec(['screenshot', tempPath]);
      const data = fs.readFileSync(tempPath);
      return data.toString('base64');
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  /**
   * Start recording
   */
  async startRecording(recordingPath: string): Promise<void> {
    this.ensureConnected();
    this.exec(['record', 'start', recordingPath]);
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<{ path: string }> {
    this.ensureConnected();

    const result = this.execJson<{ path: string }>(['record', 'stop']);
    return { path: result.path || '' };
  }

  /**
   * Wait for page to be idle
   */
  async waitForIdle(timeout: number = 5000): Promise<void> {
    this.ensureConnected();
    this.exec(['wait', '--load', 'networkidle'], { timeout });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('CDP adapter not connected');
    }
  }

  private exec(args: string[], options: { timeout?: number } = {}): string {
    const sessionArg = `--session=${this.session}`;
    const cmd = `agent-browser ${sessionArg} ${args.join(' ')}`.trim();

    try {
      return execSync(cmd, {
        encoding: 'utf-8',
        timeout: options.timeout ?? this.config.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (err: unknown) {
      const error = err as { stderr?: Buffer; stdout?: Buffer; message?: string };
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      throw new Error(`agent-browser command failed: ${cmd}\nstderr: ${stderr}\nstdout: ${stdout}`);
    }
  }

  private execJson<T>(args: string[]): T {
    const result = this.exec([...args, '--json']);

    try {
      const parsed = JSON.parse(result);
      if (!parsed.success && parsed.error) {
        throw new Error(parsed.error);
      }
      return (parsed.data || parsed) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('agent-browser')) {
        throw err;
      }
      throw new Error(`JSON parse failed: ${result}`);
    }
  }

  private locatorToSelector(locator: ElementLocator): string {
    switch (locator.strategy) {
      case LocatorStrategy.REF:
        return locator.value.startsWith('@') ? locator.value : `@${locator.value}`;
      case LocatorStrategy.CSS:
        return locator.value;
      case LocatorStrategy.XPATH:
        return `xpath=${locator.value}`;
      case LocatorStrategy.TEXT:
        return `text=${locator.value}`;
      case LocatorStrategy.ROLE:
        return `role=${locator.value}`;
      case LocatorStrategy.TESTID:
        return locator.value;
      default:
        return locator.value;
    }
  }

  private elementToSelector(element: ElementRef): string {
    if (element.id.startsWith('cdp_')) {
      return element.name || '';
    }
    return `@${element.id}`;
  }
}
