/**
 * TauriDialogTester - Tauri Native Dialog Testing
 * 
 * Test native file dialogs, message boxes, and system notifications
 * in Tauri applications.
 */

import type { DesktopTest } from './desktop-test';

/** Dialog type */
export type DialogType = 'open' | 'save' | 'message' | 'confirm' | 'directory';

/** File filter */
export interface FileFilter {
  /** Filter name */
  name: string;
  /** Extensions (e.g., ['txt', 'md']) */
  extensions: string[];
}

/** Dialog options */
export interface DialogOptions {
  /** Dialog title */
  title?: string;
  /** Default path */
  defaultPath?: string;
  /** File filters */
  filters?: FileFilter[];
  /** Allow multiple selection */
  multiple?: boolean;
  /** Allow directory selection */
  directory?: boolean;
}

/** Dialog result */
export interface DialogResult {
  /** Whether dialog was cancelled */
  cancelled: boolean;
  /** Selected file path(s) */
  filePaths?: string[];
  /** For message dialogs, the button clicked */
  response?: number;
}

/** Mock dialog configuration */
export interface MockDialogConfig {
  /** Mock file paths to return */
  filePaths?: string[];
  /** Mock cancellation */
  cancelled?: boolean;
  /** Mock button response */
  response?: number;
  /** Delay before returning (ms) */
  delay?: number;
}

/** Dialog invocation record */
export interface DialogInvocation {
  /** Dialog type */
  type: DialogType;
  /** Options passed */
  options: DialogOptions;
  /** Result returned */
  result: DialogResult;
  /** Timestamp */
  timestamp: number;
}

/**
 * TauriDialogTester - Test Tauri native dialogs
 * 
 * @example
 * ```typescript
 * const dialog = new TauriDialogTester(test);
 * 
 * // Mock file open dialog
 * await dialog.mockOpen({ filePaths: ['/path/to/file.c'] });
 * 
 * // Trigger open dialog
 * await test.click('[data-testid="open-file"]');
 * 
 * // Verify dialog was called
 * const invocations = dialog.getInvocations();
 * assert.equal(invocations.length, 1);
 * ```
 */
export class TauriDialogTester {
  private test: DesktopTest;
  private mocks: Map<DialogType, MockDialogConfig> = new Map();
  private _invocations: DialogInvocation[] = [];
  private setupDone = false;

  constructor(test: DesktopTest) {
    this.test = test;
  }

  /**
   * Get cached invocations (call getInvocations() for fresh data)
   */
  get cachedInvocations(): DialogInvocation[] {
    return [...this._invocations];
  }

  /**
   * Setup dialog interception
   */
  async setup(): Promise<void> {
    if (this.setupDone) return;

    await this.test.evaluate(`
      (() => {
        if (window.__tauriDialogMock) return;
        window.__tauriDialogMock = {
          mocks: {},
          invocations: []
        };
        
        // Store original Tauri dialog functions
        const originalDialog = window.__TAURI__?.dialog || {};
        
        // Create mock dialog object
        const mockDialog = {
          open: async (options = {}) => {
            const mock = window.__tauriDialogMock.mocks.open;
            const result = mock ? {
              cancelled: mock.cancelled || false,
              filePaths: mock.filePaths || null
            } : await originalDialog.open?.(options);
            
            window.__tauriDialogMock.invocations.push({
              type: 'open',
              options,
              result,
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return mock?.cancelled ? null : (mock?.filePaths || result?.filePaths);
          },
          
          save: async (options = {}) => {
            const mock = window.__tauriDialogMock.mocks.save;
            const result = mock ? {
              cancelled: mock.cancelled || false,
              filePaths: mock.filePaths || null
            } : await originalDialog.save?.(options);
            
            window.__tauriDialogMock.invocations.push({
              type: 'save',
              options,
              result,
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return mock?.cancelled ? null : (mock?.filePaths?.[0] || result?.filePaths?.[0]);
          },
          
          message: async (message, options = {}) => {
            const mock = window.__tauriDialogMock.mocks.message;
            
            window.__tauriDialogMock.invocations.push({
              type: 'message',
              options: { message, ...options },
              result: { cancelled: false, response: mock?.response || 0 },
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return mock?.response || 0;
          },
          
          ask: async (message, options = {}) => {
            const mock = window.__tauriDialogMock.mocks.confirm;
            const result = mock?.response !== undefined ? mock.response === 1 : true;
            
            window.__tauriDialogMock.invocations.push({
              type: 'confirm',
              options: { message, ...options },
              result: { cancelled: false, response: result ? 1 : 0 },
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return result;
          },
          
          confirm: async (message, options = {}) => {
            return mockDialog.ask(message, options);
          }
        };
        
        // Override Tauri dialog
        if (window.__TAURI__) {
          window.__TAURI__.dialog = mockDialog;
        }
        
        // Also handle @tauri-apps/api style imports
        window.__tauriDialogMock.mockDialog = mockDialog;
      })()
    `);

    this.setupDone = true;
  }

  /**
   * Mock the file open dialog
   */
  async mockOpen(config: MockDialogConfig): Promise<void> {
    await this.setup();
    this.mocks.set('open', config);
    
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.open = ${JSON.stringify(config)};
    `);
  }

  /**
   * Mock the file save dialog
   */
  async mockSave(config: MockDialogConfig): Promise<void> {
    await this.setup();
    this.mocks.set('save', config);
    
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.save = ${JSON.stringify(config)};
    `);
  }

  /**
   * Mock the message dialog
   */
  async mockMessage(config: MockDialogConfig): Promise<void> {
    await this.setup();
    this.mocks.set('message', config);
    
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.message = ${JSON.stringify(config)};
    `);
  }

  /**
   * Mock the confirm dialog
   */
  async mockConfirm(config: MockDialogConfig): Promise<void> {
    await this.setup();
    this.mocks.set('confirm', config);
    
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.confirm = ${JSON.stringify(config)};
    `);
  }

  /**
   * Mock the directory picker
   */
  async mockDirectory(config: MockDialogConfig): Promise<void> {
    await this.mockOpen({ ...config, directory: true } as MockDialogConfig & { directory: boolean });
  }

  /**
   * Clear all mocks
   */
  async clearMocks(): Promise<void> {
    this.mocks.clear();
    
    await this.test.evaluate(`
      if (window.__tauriDialogMock) {
        window.__tauriDialogMock.mocks = {};
      }
    `);
  }

  /**
   * Get all dialog invocations
   */
  async getInvocations(): Promise<DialogInvocation[]> {
    const invocations = await this.test.evaluate(`
      window.__tauriDialogMock?.invocations || []
    `) as DialogInvocation[];

    this._invocations = invocations;
    return invocations;
  }

  /**
   * Get invocations by type
   */
  async getInvocationsByType(type: DialogType): Promise<DialogInvocation[]> {
    const all = await this.getInvocations();
    return all.filter(i => i.type === type);
  }

  /**
   * Clear invocation history
   */
  async clearInvocations(): Promise<void> {
    this._invocations = [];
    
    await this.test.evaluate(`
      if (window.__tauriDialogMock) {
        window.__tauriDialogMock.invocations = [];
      }
    `);
  }

  /**
   * Wait for a dialog to be opened
   */
  async waitForDialog(type: DialogType, timeout = 5000): Promise<DialogInvocation> {
    const startTime = Date.now();
    const initialCount = (await this.getInvocations()).filter(i => i.type === type).length;

    while (Date.now() - startTime < timeout) {
      const invocations = await this.getInvocationsByType(type);
      if (invocations.length > initialCount) {
        return invocations[invocations.length - 1];
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for ${type} dialog`);
  }

  /**
   * Expect an open dialog to be called
   */
  async expectOpen(): Promise<DialogInvocation> {
    return this.waitForDialog('open');
  }

  /**
   * Expect a save dialog to be called
   */
  async expectSave(): Promise<DialogInvocation> {
    return this.waitForDialog('save');
  }

  /**
   * Expect a confirm dialog to be called
   */
  async expectConfirm(): Promise<DialogInvocation> {
    return this.waitForDialog('confirm');
  }

  /**
   * Expect a directory picker to be called
   */
  async expectDirectory(): Promise<DialogInvocation> {
    return this.waitForDialog('directory');
  }

  /**
   * Assert that a dialog was called
   */
  async assertDialogCalled(type: DialogType, message?: string): Promise<void> {
    const invocations = await this.getInvocationsByType(type);
    if (invocations.length === 0) {
      throw new Error(message || `Expected ${type} dialog to be called`);
    }
  }

  /**
   * Assert that a dialog was called with specific options
   */
  async assertDialogCalledWith(
    type: DialogType, 
    expectedOptions: Partial<DialogOptions>,
    message?: string
  ): Promise<void> {
    const invocations = await this.getInvocationsByType(type);
    
    const match = invocations.find(inv => {
      for (const [key, value] of Object.entries(expectedOptions)) {
        if (JSON.stringify(inv.options[key as keyof DialogOptions]) !== JSON.stringify(value)) {
          return false;
        }
      }
      return true;
    });

    if (!match) {
      throw new Error(message || `Expected ${type} dialog to be called with ${JSON.stringify(expectedOptions)}`);
    }
  }

  /**
   * Assert dialog count
   */
  async assertDialogCount(type: DialogType, expected: number, message?: string): Promise<void> {
    const invocations = await this.getInvocationsByType(type);
    if (invocations.length !== expected) {
      throw new Error(message || `Expected ${expected} ${type} dialogs, got ${invocations.length}`);
    }
  }

  /**
   * Simulate selecting files in open dialog (for manual testing)
   */
  async selectFiles(filePaths: string[]): Promise<void> {
    await this.mockOpen({ filePaths });
  }

  /**
   * Simulate cancelling a dialog (for manual testing)
   */
  async cancel(): Promise<void> {
    // Set all mocks to cancelled
    await this.mockOpen({ cancelled: true });
    await this.mockSave({ cancelled: true });
  }
}

export default TauriDialogTester;
