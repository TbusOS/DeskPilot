/**
 * @flowsight/desktop-test - Python Bridge Adapter
 *
 * Bridge to the existing Python desktop automation framework.
 * Communicates with Python via subprocess and JSON-RPC style messages.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';

import {
  type PythonBridgeConfig,
  type PythonBridgeInterface,
} from '../types.js';

/**
 * Default Python bridge configuration
 */
const DEFAULT_CONFIG: Required<PythonBridgeConfig> = {
  pythonPath: 'python3',
  serverPath: '',
  port: 0,
  debug: false,
};

/**
 * Python Bridge - connects to the existing Python desktop automation framework
 */
export class PythonBridge implements PythonBridgeInterface {
  private config: Required<PythonBridgeConfig>;
  private process: ChildProcess | null = null;
  private available: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private readline: readline.Interface | null = null;

  constructor(config: PythonBridgeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Default server path relative to this package
    if (!this.config.serverPath) {
      // Look for bridge server in the app/tests/desktop directory
      this.config.serverPath = path.resolve(
        __dirname,
        '../../../../app/tests/desktop/bridge_server.py'
      );
    }
  }

  /**
   * Initialize the Python bridge
   */
  async initialize(): Promise<void> {
    try {
      // Spawn Python subprocess
      this.process = spawn(this.config.pythonPath, [this.config.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error('Failed to create Python process streams');
      }

      // Set up readline for stdout
      this.readline = readline.createInterface({
        input: this.process.stdout,
        terminal: false,
      });

      // Handle responses
      this.readline.on('line', (line) => {
        this.handleResponse(line);
      });

      // Handle stderr for debugging
      this.process.stderr?.on('data', (data) => {
        if (this.config.debug) {
          console.error(`[Python Bridge stderr] ${data.toString()}`);
        }
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        this.available = false;
        if (this.config.debug) {
          console.log(`[Python Bridge] Process exited with code ${code}`);
        }
      });

      // Wait for ready signal
      await this.waitForReady();
      this.available = true;

      if (this.config.debug) {
        console.log('[Python Bridge] Initialized successfully');
      }
    } catch (error) {
      this.available = false;
      throw error;
    }
  }

  /**
   * Cleanup the Python bridge
   */
  async cleanup(): Promise<void> {
    if (this.process) {
      try {
        await this.call('shutdown');
      } catch {
        // Ignore shutdown errors
      }

      this.process.kill();
      this.process = null;
    }

    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    this.available = false;
    this.pendingRequests.clear();
  }

  /**
   * Check if available
   */
  isAvailable(): boolean {
    return this.available && this.process !== null;
  }

  /**
   * Call a Python method
   */
  async call<T>(method: string, args: unknown[] = []): Promise<T> {
    if (!this.isAvailable()) {
      throw new Error('Python bridge not available');
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: args,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });

      // Send request
      this.process!.stdin!.write(JSON.stringify(request) + '\n');

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Python bridge timeout for method: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Take screenshot via Python
   */
  async screenshot(): Promise<string> {
    return this.call<string>('screenshot');
  }

  /**
   * Click at coordinates via Python
   */
  async click(x: number, y: number, button: string = 'left'): Promise<void> {
    await this.call('click', [x, y, button]);
  }

  /**
   * Type text via Python
   */
  async typeText(text: string): Promise<void> {
    await this.call('type_text', [text]);
  }

  /**
   * Press key via Python
   */
  async pressKey(key: string, modifiers: string[] = []): Promise<void> {
    await this.call('press_key', [key, modifiers]);
  }

  /**
   * Get accessibility tree via Python
   */
  async getAccessibilityTree(): Promise<unknown> {
    return this.call('get_accessibility_tree');
  }

  /**
   * Analyze screenshot with VLM via Python
   */
  async analyzeVisual(screenshotBase64: string): Promise<unknown> {
    return this.call('analyze_visual', [screenshotBase64]);
  }

  // ============================================================================
  // Additional Desktop Control Methods
  // ============================================================================

  /**
   * Move mouse to coordinates
   */
  async moveMouse(x: number, y: number): Promise<void> {
    await this.call('move_mouse', [x, y]);
  }

  /**
   * Double click
   */
  async doubleClick(x: number, y: number): Promise<void> {
    await this.call('double_click', [x, y]);
  }

  /**
   * Right click
   */
  async rightClick(x: number, y: number): Promise<void> {
    await this.call('click', [x, y, 'right']);
  }

  /**
   * Drag from one point to another
   */
  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.call('drag', [fromX, fromY, toX, toY]);
  }

  /**
   * Scroll
   */
  async scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
    await this.call('scroll', [x, y, deltaX, deltaY]);
  }

  /**
   * Find application window
   */
  async findApplication(appName: string): Promise<unknown> {
    return this.call('find_application', [appName]);
  }

  /**
   * Activate application window
   */
  async activateApplication(appName: string): Promise<void> {
    await this.call('activate_application', [appName]);
  }

  /**
   * Get screen size
   */
  async getScreenSize(): Promise<{ width: number; height: number }> {
    return this.call('get_screen_size');
  }

  /**
   * Find element by name
   */
  async findElementByName(name: string, elementType?: string): Promise<unknown> {
    return this.call('find_element_by_name', [name, elementType]);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Wait for Python process to be ready
   */
  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python bridge startup timeout'));
      }, 10000);

      const handler = (line: string) => {
        try {
          const data = JSON.parse(line);
          if (data.status === 'ready') {
            clearTimeout(timeout);
            this.readline?.off('line', handler);
            resolve();
          }
        } catch {
          // Ignore non-JSON lines during startup
        }
      };

      this.readline?.on('line', handler);
    });
  }

  /**
   * Handle response from Python process
   */
  private handleResponse(line: string): void {
    try {
      const response = JSON.parse(line);

      // Skip status messages
      if (response.status) {
        return;
      }

      const { id, result, error } = response;

      if (id && this.pendingRequests.has(id)) {
        const { resolve, reject } = this.pendingRequests.get(id)!;
        this.pendingRequests.delete(id);

        if (error) {
          reject(new Error(error.message || 'Python bridge error'));
        } else {
          resolve(result);
        }
      }
    } catch (e) {
      if (this.config.debug) {
        console.log(`[Python Bridge] Non-JSON output: ${line}`);
      }
    }
  }
}
