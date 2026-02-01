/**
 * SessionManager - Multi-Session Parallel Testing
 * 
 * Inspired by agent-browser's session management.
 * Enables running multiple test sessions in parallel with isolation.
 */

import type { DesktopTest } from './desktop-test';

/** Session state */
export type SessionState = 'created' | 'active' | 'paused' | 'closed';

/** Session info */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** Session name */
  name: string;
  /** Session state */
  state: SessionState;
  /** Creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Browser context ID */
  contextId?: string;
  /** Current URL */
  url?: string;
  /** Session metadata */
  metadata: Record<string, unknown>;
}

/** Session options */
export interface SessionOptions {
  /** Session name */
  name?: string;
  /** Initial URL */
  url?: string;
  /** Browser context options */
  contextOptions?: {
    /** Viewport size */
    viewport?: { width: number; height: number };
    /** User agent */
    userAgent?: string;
    /** Locale */
    locale?: string;
    /** Timezone */
    timezone?: string;
    /** Geolocation */
    geolocation?: { latitude: number; longitude: number };
    /** Permissions */
    permissions?: string[];
    /** Extra HTTP headers */
    extraHTTPHeaders?: Record<string, string>;
    /** Ignore HTTPS errors */
    ignoreHTTPSErrors?: boolean;
    /** Offline mode */
    offline?: boolean;
    /** Color scheme */
    colorScheme?: 'light' | 'dark' | 'no-preference';
  };
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Persist session state */
  persist?: boolean;
  /** Storage state file path */
  storageStatePath?: string;
}

/** Session storage state */
export interface StorageState {
  /** Cookies */
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  /** Local storage */
  localStorage: Array<{
    origin: string;
    data: Record<string, string>;
  }>;
  /** Session storage */
  sessionStorage: Array<{
    origin: string;
    data: Record<string, string>;
  }>;
}

/**
 * SessionManager - Manage multiple test sessions
 * 
 * @example
 * ```typescript
 * const sessionManager = new SessionManager();
 * 
 * // Create sessions
 * const session1 = await sessionManager.create('main');
 * const session2 = await sessionManager.create('secondary');
 * 
 * // Run tests in parallel
 * await Promise.all([
 *   session1.test.navigate('/page1'),
 *   session2.test.navigate('/page2')
 * ]);
 * 
 * // Switch active session
 * await sessionManager.switch('main');
 * 
 * // List sessions
 * const sessions = sessionManager.list();
 * ```
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private activeSessionId: string | null = null;
  private sessionCounter = 0;
  private createTestFn: (options?: SessionOptions) => Promise<DesktopTest>;

  constructor(createTestFn: (options?: SessionOptions) => Promise<DesktopTest>) {
    this.createTestFn = createTestFn;
  }

  /**
   * Create a new session
   */
  async create(nameOrOptions?: string | SessionOptions): Promise<Session> {
    const options: SessionOptions = typeof nameOrOptions === 'string'
      ? { name: nameOrOptions }
      : nameOrOptions || {};

    const id = `session-${++this.sessionCounter}`;
    const name = options.name || id;

    // Check for duplicate names
    for (const session of this.sessions.values()) {
      if (session.info.name === name) {
        throw new Error(`Session with name "${name}" already exists`);
      }
    }

    // Create test instance
    const test = await this.createTestFn(options);

    // Create session
    const session = new Session({
      id,
      name,
      test,
      options,
      onClose: () => this.handleSessionClose(id)
    });

    this.sessions.set(id, session);

    // Set as active if first session
    if (!this.activeSessionId) {
      this.activeSessionId = id;
    }

    return session;
  }

  /**
   * Get session by ID or name
   */
  get(idOrName: string): Session | undefined {
    // Try by ID first
    if (this.sessions.has(idOrName)) {
      return this.sessions.get(idOrName);
    }

    // Try by name
    for (const session of this.sessions.values()) {
      if (session.info.name === idOrName) {
        return session;
      }
    }

    return undefined;
  }

  /**
   * Get the active session
   */
  getActive(): Session | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Switch to a different session
   */
  async switch(idOrName: string): Promise<Session> {
    const session = this.get(idOrName);
    if (!session) {
      throw new Error(`Session not found: ${idOrName}`);
    }

    if (session.info.state === 'closed') {
      throw new Error(`Cannot switch to closed session: ${idOrName}`);
    }

    this.activeSessionId = session.info.id;
    session.activate();

    return session;
  }

  /**
   * List all sessions
   */
  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.info);
  }

  /**
   * Close a session
   */
  async close(idOrName: string): Promise<void> {
    const session = this.get(idOrName);
    if (!session) {
      throw new Error(`Session not found: ${idOrName}`);
    }

    await session.close();
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.sessions.values())
      .filter(s => s.info.state !== 'closed')
      .map(s => s.close());

    await Promise.all(closePromises);
  }

  /**
   * Run a function in parallel across multiple sessions
   */
  async parallel<T>(
    fn: (session: Session) => Promise<T>,
    options?: { filter?: (session: Session) => boolean }
  ): Promise<Map<string, T>> {
    let sessions = Array.from(this.sessions.values())
      .filter(s => s.info.state === 'active');

    if (options?.filter) {
      sessions = sessions.filter(options.filter);
    }

    const results = new Map<string, T>();
    const promises = sessions.map(async session => {
      const result = await fn(session);
      results.set(session.info.id, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Run a function sequentially across sessions
   */
  async sequential<T>(
    fn: (session: Session) => Promise<T>,
    options?: { filter?: (session: Session) => boolean }
  ): Promise<Map<string, T>> {
    let sessions = Array.from(this.sessions.values())
      .filter(s => s.info.state === 'active');

    if (options?.filter) {
      sessions = sessions.filter(options.filter);
    }

    const results = new Map<string, T>();
    for (const session of sessions) {
      const result = await fn(session);
      results.set(session.info.id, result);
    }

    return results;
  }

  /**
   * Get session count
   */
  get count(): number {
    return this.sessions.size;
  }

  /**
   * Get active session count
   */
  get activeCount(): number {
    return Array.from(this.sessions.values())
      .filter(s => s.info.state === 'active').length;
  }

  private handleSessionClose(id: string): void {
    if (this.activeSessionId === id) {
      // Find another active session
      const activeSession = Array.from(this.sessions.values())
        .find(s => s.info.state === 'active' && s.info.id !== id);
      this.activeSessionId = activeSession?.info.id || null;
    }
  }
}

/**
 * Session - Individual test session
 */
export class Session {
  private _info: SessionInfo;
  private _test: DesktopTest;
  private _options: SessionOptions;
  private onClose: () => void;

  constructor(config: {
    id: string;
    name: string;
    test: DesktopTest;
    options: SessionOptions;
    onClose: () => void;
  }) {
    this._info = {
      id: config.id,
      name: config.name,
      state: 'active',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: config.options.metadata || {}
    };

    this._test = config.test;
    this._options = config.options;
    this.onClose = config.onClose;
  }

  /**
   * Get session info
   */
  get info(): SessionInfo {
    return { ...this._info };
  }

  /**
   * Get session options
   */
  get options(): SessionOptions {
    return { ...this._options };
  }

  /**
   * Get test instance
   */
  get test(): DesktopTest {
    this.updateActivity();
    return this._test;
  }

  /**
   * Activate this session
   */
  activate(): void {
    if (this._info.state === 'closed') {
      throw new Error('Cannot activate closed session');
    }
    this._info.state = 'active';
    this.updateActivity();
  }

  /**
   * Pause this session
   */
  pause(): void {
    if (this._info.state === 'closed') {
      throw new Error('Cannot pause closed session');
    }
    this._info.state = 'paused';
    this.updateActivity();
  }

  /**
   * Close this session
   */
  async close(): Promise<void> {
    if (this._info.state === 'closed') return;

    try {
      await this._test.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    this._info.state = 'closed';
    this.onClose();
  }

  /**
   * Save session storage state
   */
  async saveState(filePath?: string): Promise<StorageState> {
    // TODO: Save to file if filePath provided
    void filePath;
    
    const state = await this._test.evaluate(`
      (() => {
        const cookies = document.cookie.split(';').map(c => {
          const [name, value] = c.trim().split('=');
          return { name, value, domain: location.hostname, path: '/', expires: -1, httpOnly: false, secure: location.protocol === 'https:', sameSite: 'Lax' };
        });
        
        const localStorage = [{
          origin: location.origin,
          data: Object.fromEntries(Object.entries(window.localStorage))
        }];
        
        const sessionStorage = [{
          origin: location.origin,
          data: Object.fromEntries(Object.entries(window.sessionStorage))
        }];
        
        return { cookies, localStorage, sessionStorage };
      })()
    `) as StorageState;

    // TODO: Save to file if filePath provided

    return state;
  }

  /**
   * Load session storage state
   */
  async loadState(state: StorageState): Promise<void> {
    await this._test.evaluate(`
      (() => {
        // Restore localStorage
        const localData = ${JSON.stringify(state.localStorage[0]?.data || {})};
        for (const [key, value] of Object.entries(localData)) {
          window.localStorage.setItem(key, value);
        }
        
        // Restore sessionStorage
        const sessionData = ${JSON.stringify(state.sessionStorage[0]?.data || {})};
        for (const [key, value] of Object.entries(sessionData)) {
          window.sessionStorage.setItem(key, value);
        }
      })()
    `);
  }

  /**
   * Set session metadata
   */
  setMetadata(key: string, value: unknown): void {
    this._info.metadata[key] = value;
    this.updateActivity();
  }

  /**
   * Get session metadata
   */
  getMetadata<T = unknown>(key: string): T | undefined {
    return this._info.metadata[key] as T | undefined;
  }

  private updateActivity(): void {
    this._info.lastActivity = Date.now();
  }
}

export default SessionManager;
