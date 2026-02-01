/**
 * TauriIpcInterceptor - Intercept and mock Tauri IPC calls
 * 
 * Enables testing of Tauri applications by:
 * - Intercepting invoke() calls
 * - Mocking command responses
 * - Recording command history
 * - Verifying command parameters
 */

import type { DesktopTest } from './desktop-test';

/** Invoke call record */
export interface InvokeRecord {
  /** Command name */
  command: string;
  /** Command arguments */
  args: Record<string, unknown>;
  /** Response (if completed) */
  response?: unknown;
  /** Error (if failed) */
  error?: string;
  /** Timestamp */
  timestamp: number;
  /** Duration (ms) */
  duration?: number;
  /** Was intercepted/mocked */
  intercepted: boolean;
}

/** Mock response configuration */
export interface MockResponse {
  /** Success response */
  response?: unknown;
  /** Error to throw */
  error?: string;
  /** Delay before response (ms) */
  delay?: number;
  /** Function to generate response */
  handler?: (args: Record<string, unknown>) => unknown | Promise<unknown>;
  /** Only mock once, then remove */
  once?: boolean;
  /** Match args pattern */
  matchArgs?: Record<string, unknown>;
}

/** Event listener record */
export interface EventRecord {
  /** Event name */
  event: string;
  /** Payload */
  payload: unknown;
  /** Timestamp */
  timestamp: number;
}

/**
 * TauriIpcInterceptor - Mock and verify Tauri IPC
 * 
 * @example
 * ```typescript
 * const ipc = new TauriIpcInterceptor(test);
 * 
 * // Setup interceptor
 * await ipc.setup();
 * 
 * // Mock a command
 * await ipc.mock('open_project', {
 *   response: { files_count: 100, functions_count: 500 }
 * });
 * 
 * // Mock with handler
 * await ipc.mock('get_file_content', {
 *   handler: (args) => ({ content: `Content of ${args.path}` })
 * });
 * 
 * // ... run test ...
 * 
 * // Verify calls
 * await ipc.assertInvoked('open_project', { times: 1 });
 * await ipc.assertInvokedWith('get_file_content', { path: '/test.c' });
 * 
 * // Get call history
 * const history = await ipc.getHistory();
 * 
 * // Cleanup
 * await ipc.teardown();
 * ```
 */
export class TauriIpcInterceptor {
  private test: DesktopTest;
  private isSetup = false;

  constructor(test: DesktopTest) {
    this.test = test;
  }

  /**
   * Setup the interceptor (call once before mocking)
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    await this.test.evaluate(`
      (() => {
        // Store original functions
        if (!window.__TAURI_IPC_ORIGINAL__) {
          window.__TAURI_IPC_ORIGINAL__ = {
            invoke: window.__TAURI__?.invoke || window.__TAURI_INVOKE__,
            listen: window.__TAURI__?.event?.listen
          };
        }
        
        // Initialize storage
        window.__TAURI_IPC_MOCKS__ = window.__TAURI_IPC_MOCKS__ || {};
        window.__TAURI_IPC_HISTORY__ = window.__TAURI_IPC_HISTORY__ || [];
        window.__TAURI_EVENT_HISTORY__ = window.__TAURI_EVENT_HISTORY__ || [];
        
        // Intercept invoke
        const interceptedInvoke = async (cmd, args = {}) => {
          const startTime = Date.now();
          const record = {
            command: cmd,
            args: args,
            timestamp: startTime,
            intercepted: false
          };
          
          try {
            // Check for mock
            const mock = window.__TAURI_IPC_MOCKS__[cmd];
            if (mock) {
              record.intercepted = true;
              
              // Check args match
              if (mock.matchArgs) {
                const matches = Object.entries(mock.matchArgs).every(
                  ([key, value]) => JSON.stringify(args[key]) === JSON.stringify(value)
                );
                if (!matches) {
                  // Don't use mock, call original
                  record.intercepted = false;
                }
              }
              
              if (record.intercepted) {
                // Apply delay
                if (mock.delay) {
                  await new Promise(r => setTimeout(r, mock.delay));
                }
                
                // Handle mock
                if (mock.error) {
                  record.error = mock.error;
                  record.duration = Date.now() - startTime;
                  window.__TAURI_IPC_HISTORY__.push(record);
                  
                  // Remove if once
                  if (mock.once) delete window.__TAURI_IPC_MOCKS__[cmd];
                  
                  throw new Error(mock.error);
                }
                
                let response;
                if (mock.handler) {
                  response = await mock.handler(args);
                } else {
                  response = mock.response;
                }
                
                record.response = response;
                record.duration = Date.now() - startTime;
                window.__TAURI_IPC_HISTORY__.push(record);
                
                // Remove if once
                if (mock.once) delete window.__TAURI_IPC_MOCKS__[cmd];
                
                return response;
              }
            }
            
            // Call original
            if (window.__TAURI_IPC_ORIGINAL__.invoke) {
              const response = await window.__TAURI_IPC_ORIGINAL__.invoke(cmd, args);
              record.response = response;
              record.duration = Date.now() - startTime;
              window.__TAURI_IPC_HISTORY__.push(record);
              return response;
            }
            
            throw new Error('Tauri invoke not available');
          } catch (error) {
            record.error = error?.message || String(error);
            record.duration = Date.now() - startTime;
            window.__TAURI_IPC_HISTORY__.push(record);
            throw error;
          }
        };
        
        // Replace invoke
        if (window.__TAURI__) {
          window.__TAURI__.invoke = interceptedInvoke;
        }
        if (window.__TAURI_INVOKE__) {
          window.__TAURI_INVOKE__ = interceptedInvoke;
        }
        // Also patch tauri-api wrapper
        if (window.tauriInvoke) {
          window.tauriInvokeOriginal = window.tauriInvoke;
          window.tauriInvoke = interceptedInvoke;
        }
      })()
    `);

    this.isSetup = true;
  }

  /**
   * Remove interceptor and restore original functions
   */
  async teardown(): Promise<void> {
    if (!this.isSetup) return;

    await this.test.evaluate(`
      (() => {
        if (window.__TAURI_IPC_ORIGINAL__) {
          if (window.__TAURI__) {
            window.__TAURI__.invoke = window.__TAURI_IPC_ORIGINAL__.invoke;
          }
          if (window.__TAURI_INVOKE__) {
            window.__TAURI_INVOKE__ = window.__TAURI_IPC_ORIGINAL__.invoke;
          }
          if (window.tauriInvokeOriginal) {
            window.tauriInvoke = window.tauriInvokeOriginal;
          }
        }
        
        window.__TAURI_IPC_MOCKS__ = {};
        window.__TAURI_IPC_HISTORY__ = [];
        window.__TAURI_EVENT_HISTORY__ = [];
      })()
    `);

    this.isSetup = false;
  }

  /**
   * Mock a Tauri command
   */
  async mock(command: string, config: MockResponse): Promise<void> {
    await this.ensureSetup();

    // Convert handler to string if provided
    const handlerStr = config.handler 
      ? `(${config.handler.toString()})` 
      : 'null';

    await this.test.evaluate(`
      (() => {
        window.__TAURI_IPC_MOCKS__['${command}'] = {
          response: ${JSON.stringify(config.response)},
          error: ${config.error ? JSON.stringify(config.error) : 'null'},
          delay: ${config.delay || 0},
          handler: ${handlerStr},
          once: ${config.once || false},
          matchArgs: ${config.matchArgs ? JSON.stringify(config.matchArgs) : 'null'}
        };
      })()
    `);
  }

  /**
   * Remove a mock
   */
  async unmock(command: string): Promise<void> {
    await this.test.evaluate(`
      delete window.__TAURI_IPC_MOCKS__?.['${command}'];
    `);
  }

  /**
   * Clear all mocks
   */
  async clearMocks(): Promise<void> {
    await this.test.evaluate(`
      window.__TAURI_IPC_MOCKS__ = {};
    `);
  }

  /**
   * Get invoke history
   */
  async getHistory(filter?: { command?: string }): Promise<InvokeRecord[]> {
    const history = await this.test.evaluate(`
      window.__TAURI_IPC_HISTORY__ || []
    `) as InvokeRecord[];

    if (filter?.command) {
      return history.filter(r => r.command === filter.command);
    }

    return history;
  }

  /**
   * Clear invoke history
   */
  async clearHistory(): Promise<void> {
    await this.test.evaluate(`
      window.__TAURI_IPC_HISTORY__ = [];
    `);
  }

  /**
   * Get the last invoke call
   */
  async getLastInvoke(command?: string): Promise<InvokeRecord | null> {
    const history = await this.getHistory(command ? { command } : undefined);
    return history[history.length - 1] || null;
  }

  /**
   * Wait for a command to be invoked
   */
  async waitForInvoke(
    command: string,
    options: { timeout?: number; matchArgs?: Record<string, unknown> } = {}
  ): Promise<InvokeRecord> {
    const { timeout = 10000, matchArgs } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const history = await this.getHistory({ command });
      
      const match = history.find(record => {
        if (!matchArgs) return true;
        return Object.entries(matchArgs).every(
          ([key, value]) => JSON.stringify(record.args[key]) === JSON.stringify(value)
        );
      });

      if (match) {
        return match;
      }

      await new Promise(r => setTimeout(r, 100));
    }

    throw new Error(`Timeout waiting for invoke: ${command}`);
  }

  /**
   * Assert that a command was invoked
   */
  async assertInvoked(
    command: string,
    options: { times?: number; atLeast?: number; atMost?: number } = {}
  ): Promise<void> {
    const history = await this.getHistory({ command });
    const count = history.length;

    if (options.times !== undefined && count !== options.times) {
      throw new Error(
        `Expected ${command} to be invoked ${options.times} times, but was invoked ${count} times`
      );
    }

    if (options.atLeast !== undefined && count < options.atLeast) {
      throw new Error(
        `Expected ${command} to be invoked at least ${options.atLeast} times, but was invoked ${count} times`
      );
    }

    if (options.atMost !== undefined && count > options.atMost) {
      throw new Error(
        `Expected ${command} to be invoked at most ${options.atMost} times, but was invoked ${count} times`
      );
    }
  }

  /**
   * Assert that a command was invoked with specific arguments
   */
  async assertInvokedWith(
    command: string,
    expectedArgs: Record<string, unknown>
  ): Promise<void> {
    const history = await this.getHistory({ command });
    
    const found = history.some(record =>
      Object.entries(expectedArgs).every(
        ([key, value]) => JSON.stringify(record.args[key]) === JSON.stringify(value)
      )
    );

    if (!found) {
      const actualArgs = history.map(r => r.args);
      throw new Error(
        `Expected ${command} to be invoked with ${JSON.stringify(expectedArgs)}, ` +
        `but was invoked with: ${JSON.stringify(actualArgs)}`
      );
    }
  }

  /**
   * Assert that a command was not invoked
   */
  async assertNotInvoked(command: string): Promise<void> {
    const history = await this.getHistory({ command });
    
    if (history.length > 0) {
      throw new Error(
        `Expected ${command} to not be invoked, but was invoked ${history.length} times`
      );
    }
  }

  /**
   * Emit a Tauri event (for testing event listeners)
   */
  async emit(event: string, payload: unknown): Promise<void> {
    await this.test.evaluate(`
      (() => {
        // Record event
        window.__TAURI_EVENT_HISTORY__ = window.__TAURI_EVENT_HISTORY__ || [];
        window.__TAURI_EVENT_HISTORY__.push({
          event: '${event}',
          payload: ${JSON.stringify(payload)},
          timestamp: Date.now()
        });
        
        // Emit via Tauri event system
        if (window.__TAURI__?.event?.emit) {
          window.__TAURI__.event.emit('${event}', ${JSON.stringify(payload)});
        }
        
        // Also dispatch as custom DOM event for fallback
        window.dispatchEvent(new CustomEvent('tauri:${event}', {
          detail: ${JSON.stringify(payload)}
        }));
      })()
    `);
  }

  /**
   * Get event history
   */
  async getEventHistory(filter?: { event?: string }): Promise<EventRecord[]> {
    const history = await this.test.evaluate(`
      window.__TAURI_EVENT_HISTORY__ || []
    `) as EventRecord[];

    if (filter?.event) {
      return history.filter(r => r.event === filter.event);
    }

    return history;
  }

  /**
   * Create a mock for simulating project open
   */
  async mockOpenProject(projectInfo: {
    path: string;
    files_count: number;
    functions_count: number;
    structs_count: number;
  }): Promise<void> {
    await this.mock('open_project', {
      response: projectInfo
    });

    // Also emit index-progress events
    await this.mock('get_index_status', {
      response: { indexed: true, ...projectInfo }
    });
  }

  /**
   * Create a mock for simulating empty project (the bug case)
   */
  async mockEmptyProject(path: string): Promise<void> {
    await this.mock('open_project', {
      response: {
        path,
        files_count: 0,
        functions_count: 0,
        structs_count: 0
      }
    });
  }

  /**
   * Create a mock for API error
   */
  async mockError(command: string, errorMessage: string): Promise<void> {
    await this.mock(command, {
      error: errorMessage
    });
  }

  /**
   * Create a mock with delay (for testing loading states)
   */
  async mockWithDelay(
    command: string,
    response: unknown,
    delayMs: number
  ): Promise<void> {
    await this.mock(command, {
      response,
      delay: delayMs
    });
  }

  // Private methods

  private async ensureSetup(): Promise<void> {
    if (!this.isSetup) {
      await this.setup();
    }
  }
}

export default TauriIpcInterceptor;
