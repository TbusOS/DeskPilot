/**
 * StateValidator - Validate application state (Jotai/Zustand/Redux)
 * 
 * Provides deep inspection of JavaScript state management stores
 * for testing state transitions and data correctness.
 */

import type { DesktopTest } from './desktop-test';

/** State assertion operators */
export type StateOperator = 
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'notMatches'
  | 'isNull'
  | 'isNotNull'
  | 'isUndefined'
  | 'isNotUndefined'
  | 'isArray'
  | 'hasLength'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isTrue'
  | 'isFalse'
  | 'hasProperty'
  | 'typeof';

/** State assertion */
export interface StateAssertion {
  /** Path to the value (dot notation) */
  path: string;
  /** Assertion operator */
  operator: StateOperator;
  /** Expected value (for comparison operators) */
  value?: unknown;
  /** Custom error message */
  message?: string;
}

/** State change */
export interface StateChange {
  /** Path to the changed value */
  path: string;
  /** Previous value */
  previousValue: unknown;
  /** New value */
  newValue: unknown;
  /** Timestamp */
  timestamp: number;
}

/** State snapshot */
export interface StateSnapshot {
  /** Store name */
  store: string;
  /** Full state object */
  state: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/** Watch options */
export interface WatchOptions {
  /** Paths to watch (empty = watch all) */
  paths?: string[];
  /** Timeout for waiting */
  timeout?: number;
  /** Poll interval */
  pollInterval?: number;
}

/**
 * StateValidator - Deep state inspection and validation
 * 
 * @example
 * ```typescript
 * const state = new StateValidator(test);
 * 
 * // Get state from Zustand store
 * const analysisStore = await state.getStore('analysisStore');
 * console.log(analysisStore.currentProject);
 * 
 * // Assert state values
 * await state.assert('analysisStore', [
 *   { path: 'currentProject.files_count', operator: 'greaterThan', value: 0 },
 *   { path: 'currentProject.indexed', operator: 'isTrue' },
 *   { path: 'loading', operator: 'isFalse' }
 * ]);
 * 
 * // Watch for state changes
 * const changes = await state.watchUntil('analysisStore', 
 *   { path: 'indexProgress.phase', operator: 'equals', value: 'complete' },
 *   { timeout: 30000 }
 * );
 * 
 * // Compare snapshots
 * const before = await state.snapshot('analysisStore');
 * // ... perform action ...
 * const after = await state.snapshot('analysisStore');
 * const diff = state.diff(before, after);
 * ```
 */
export class StateValidator {
  private test: DesktopTest;
  private watches: Map<string, StateChange[]> = new Map();
  private watchIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(test: DesktopTest) {
    this.test = test;
  }

  /**
   * Get state from a named store
   */
  async getStore(storeName: string): Promise<Record<string, unknown>> {
    const state = await this.test.evaluate(`
      (() => {
        // Try Zustand
        if (window.__ZUSTAND_STORES__ && window.__ZUSTAND_STORES__['${storeName}']) {
          return window.__ZUSTAND_STORES__['${storeName}'].getState();
        }
        
        // Try to find Zustand store by naming convention
        const zustandKey = Object.keys(window).find(k => 
          k.includes('${storeName}') && 
          typeof window[k]?.getState === 'function'
        );
        if (zustandKey) {
          return window[zustandKey].getState();
        }
        
        // Try Redux
        if (window.__REDUX_STORE__) {
          const fullState = window.__REDUX_STORE__.getState();
          return fullState['${storeName}'] || fullState;
        }
        
        // Try Jotai (harder, atoms are per-component)
        if (window.__JOTAI_ATOMS__) {
          return window.__JOTAI_ATOMS__['${storeName}'];
        }
        
        // Try global variable
        if (window['${storeName}']) {
          return window['${storeName}'];
        }
        
        // Try React DevTools
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          // This would require more complex traversal
        }
        
        return null;
      })()
    `) as Record<string, unknown> | null;

    if (!state) {
      throw new Error(`Store not found: ${storeName}. Make sure it's exposed globally.`);
    }

    return state;
  }

  /**
   * Get a specific value from a store by path
   */
  async getValue(storeName: string, path: string): Promise<unknown> {
    const store = await this.getStore(storeName);
    return this.getByPath(store, path);
  }

  /**
   * Assert state values
   */
  async assert(storeName: string, assertions: StateAssertion[]): Promise<void> {
    const store = await this.getStore(storeName);
    const failures: string[] = [];

    for (const assertion of assertions) {
      const value = this.getByPath(store, assertion.path);
      const result = this.checkAssertion(value, assertion);

      if (!result.passed) {
        failures.push(
          assertion.message || 
          `${storeName}.${assertion.path}: ${result.message} (got: ${JSON.stringify(value)})`
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(`State assertions failed:\n${failures.join('\n')}`);
    }
  }

  /**
   * Take a snapshot of store state
   */
  async snapshot(storeName: string): Promise<StateSnapshot> {
    const state = await this.getStore(storeName);
    return {
      store: storeName,
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now()
    };
  }

  /**
   * Compare two snapshots and return differences
   */
  diff(before: StateSnapshot, after: StateSnapshot): StateChange[] {
    const changes: StateChange[] = [];
    
    const findChanges = (prev: unknown, next: unknown, path: string) => {
      if (prev === next) return;
      
      if (typeof prev !== typeof next) {
        changes.push({
          path,
          previousValue: prev,
          newValue: next,
          timestamp: after.timestamp
        });
        return;
      }

      if (typeof prev === 'object' && prev !== null && next !== null) {
        const prevObj = prev as Record<string, unknown>;
        const nextObj = next as Record<string, unknown>;
        const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
        
        for (const key of allKeys) {
          findChanges(prevObj[key], nextObj[key], path ? `${path}.${key}` : key);
        }
      } else if (prev !== next) {
        changes.push({
          path,
          previousValue: prev,
          newValue: next,
          timestamp: after.timestamp
        });
      }
    };

    findChanges(before.state, after.state, '');
    return changes;
  }

  /**
   * Watch for state changes
   */
  startWatch(
    storeName: string,
    options: WatchOptions = {}
  ): void {
    const { paths = [], pollInterval = 100 } = options;
    const key = `${storeName}-${paths.join(',')}`;

    if (this.watchIntervals.has(key)) {
      return; // Already watching
    }

    this.watches.set(key, []);
    let previousState: Record<string, unknown> | null = null;

    const interval = setInterval(async () => {
      try {
        const currentState = await this.getStore(storeName);
        
        if (previousState) {
          const changes = this.diff(
            { store: storeName, state: previousState, timestamp: Date.now() - pollInterval },
            { store: storeName, state: currentState, timestamp: Date.now() }
          );

          const filteredChanges = paths.length > 0
            ? changes.filter(c => paths.some(p => c.path.startsWith(p)))
            : changes;

          if (filteredChanges.length > 0) {
            const existingChanges = this.watches.get(key) || [];
            this.watches.set(key, [...existingChanges, ...filteredChanges]);
          }
        }

        previousState = JSON.parse(JSON.stringify(currentState));
      } catch {
        // Store might not be available yet
      }
    }, pollInterval);

    this.watchIntervals.set(key, interval);
  }

  /**
   * Stop watching
   */
  stopWatch(storeName: string, paths: string[] = []): StateChange[] {
    const key = `${storeName}-${paths.join(',')}`;
    
    const interval = this.watchIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.watchIntervals.delete(key);
    }

    const changes = this.watches.get(key) || [];
    this.watches.delete(key);
    
    return changes;
  }

  /**
   * Watch until a condition is met
   */
  async watchUntil(
    storeName: string,
    condition: StateAssertion,
    options: WatchOptions = {}
  ): Promise<StateChange[]> {
    const { timeout = 10000, pollInterval = 100 } = options;
    // Key reserved for future multi-watch support
    void `${storeName}-watchUntil`;
    const changes: StateChange[] = [];
    let previousState: Record<string, unknown> | null = null;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkCondition = async () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error(
            `Timeout waiting for ${storeName}.${condition.path} to ${condition.operator} ${JSON.stringify(condition.value)}`
          ));
          return;
        }

        try {
          const currentState = await this.getStore(storeName);
          
          // Track changes
          if (previousState) {
            const newChanges = this.diff(
              { store: storeName, state: previousState, timestamp: Date.now() - pollInterval },
              { store: storeName, state: currentState, timestamp: Date.now() }
            );
            changes.push(...newChanges);
          }
          previousState = JSON.parse(JSON.stringify(currentState));

          // Check condition
          const value = this.getByPath(currentState, condition.path);
          const result = this.checkAssertion(value, condition);

          if (result.passed) {
            clearInterval(interval);
            resolve(changes);
          }
        } catch {
          // Store might not be available yet
        }
      };

      const interval = setInterval(checkCondition, pollInterval);
      checkCondition(); // Check immediately
    });
  }

  /**
   * Wait for state to stabilize (no changes for duration)
   */
  async waitForStable(
    storeName: string,
    options: { duration?: number; timeout?: number; paths?: string[] } = {}
  ): Promise<void> {
    const { duration = 500, timeout = 10000, paths = [] } = options;
    const startTime = Date.now();
    let lastChangeTime = Date.now();
    let previousState: Record<string, unknown> | null = null;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for state to stabilize`));
          return;
        }

        try {
          const currentState = await this.getStore(storeName);
          
          if (previousState) {
            const changes = this.diff(
              { store: storeName, state: previousState, timestamp: 0 },
              { store: storeName, state: currentState, timestamp: 0 }
            );

            const relevantChanges = paths.length > 0
              ? changes.filter(c => paths.some(p => c.path.startsWith(p)))
              : changes;

            if (relevantChanges.length > 0) {
              lastChangeTime = Date.now();
            }
          }

          previousState = JSON.parse(JSON.stringify(currentState));

          if (Date.now() - lastChangeTime >= duration) {
            clearInterval(interval);
            resolve();
          }
        } catch {
          // Store might not be available yet
        }
      }, 50);
    });
  }

  /**
   * Expose a store globally for testing
   */
  async exposeStore(storeName: string, storeAccessCode: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        window.__ZUSTAND_STORES__ = window.__ZUSTAND_STORES__ || {};
        window.__ZUSTAND_STORES__['${storeName}'] = ${storeAccessCode};
      })()
    `);
  }

  /**
   * Get all exposed stores
   */
  async getExposedStores(): Promise<string[]> {
    const stores = await this.test.evaluate(`
      (() => {
        const stores = [];
        
        // Check ZUSTAND_STORES
        if (window.__ZUSTAND_STORES__) {
          stores.push(...Object.keys(window.__ZUSTAND_STORES__));
        }
        
        // Check global variables that look like stores
        for (const key of Object.keys(window)) {
          if (typeof window[key]?.getState === 'function') {
            stores.push(key);
          }
        }
        
        return [...new Set(stores)];
      })()
    `) as string[];

    return stores;
  }

  // Private methods

  private getByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private checkAssertion(
    value: unknown,
    assertion: StateAssertion
  ): { passed: boolean; message: string } {
    const { operator, value: expected } = assertion;

    switch (operator) {
      case 'equals':
        return {
          passed: JSON.stringify(value) === JSON.stringify(expected),
          message: `expected to equal ${JSON.stringify(expected)}`
        };
      
      case 'notEquals':
        return {
          passed: JSON.stringify(value) !== JSON.stringify(expected),
          message: `expected to not equal ${JSON.stringify(expected)}`
        };
      
      case 'greaterThan':
        return {
          passed: (value as number) > (expected as number),
          message: `expected to be greater than ${expected}`
        };
      
      case 'lessThan':
        return {
          passed: (value as number) < (expected as number),
          message: `expected to be less than ${expected}`
        };
      
      case 'greaterThanOrEqual':
        return {
          passed: (value as number) >= (expected as number),
          message: `expected to be greater than or equal to ${expected}`
        };
      
      case 'lessThanOrEqual':
        return {
          passed: (value as number) <= (expected as number),
          message: `expected to be less than or equal to ${expected}`
        };
      
      case 'contains':
        if (typeof value === 'string') {
          return {
            passed: value.includes(expected as string),
            message: `expected to contain "${expected}"`
          };
        }
        if (Array.isArray(value)) {
          return {
            passed: value.includes(expected),
            message: `expected array to contain ${JSON.stringify(expected)}`
          };
        }
        return { passed: false, message: 'value is not string or array' };
      
      case 'notContains':
        if (typeof value === 'string') {
          return {
            passed: !value.includes(expected as string),
            message: `expected to not contain "${expected}"`
          };
        }
        if (Array.isArray(value)) {
          return {
            passed: !value.includes(expected),
            message: `expected array to not contain ${JSON.stringify(expected)}`
          };
        }
        return { passed: false, message: 'value is not string or array' };
      
      case 'matches':
        return {
          passed: new RegExp(expected as string).test(value as string),
          message: `expected to match ${expected}`
        };
      
      case 'notMatches':
        return {
          passed: !new RegExp(expected as string).test(value as string),
          message: `expected to not match ${expected}`
        };
      
      case 'isNull':
        return { passed: value === null, message: 'expected to be null' };
      
      case 'isNotNull':
        return { passed: value !== null, message: 'expected to not be null' };
      
      case 'isUndefined':
        return { passed: value === undefined, message: 'expected to be undefined' };
      
      case 'isNotUndefined':
        return { passed: value !== undefined, message: 'expected to not be undefined' };
      
      case 'isArray':
        return { passed: Array.isArray(value), message: 'expected to be an array' };
      
      case 'hasLength':
        return {
          passed: Array.isArray(value) && value.length === expected,
          message: `expected array to have length ${expected}`
        };
      
      case 'isEmpty':
        if (Array.isArray(value)) {
          return { passed: value.length === 0, message: 'expected array to be empty' };
        }
        if (typeof value === 'string') {
          return { passed: value.length === 0, message: 'expected string to be empty' };
        }
        if (typeof value === 'object' && value !== null) {
          return {
            passed: Object.keys(value).length === 0,
            message: 'expected object to be empty'
          };
        }
        return { passed: false, message: 'value is not array, string, or object' };
      
      case 'isNotEmpty':
        if (Array.isArray(value)) {
          return { passed: value.length > 0, message: 'expected array to not be empty' };
        }
        if (typeof value === 'string') {
          return { passed: value.length > 0, message: 'expected string to not be empty' };
        }
        if (typeof value === 'object' && value !== null) {
          return {
            passed: Object.keys(value).length > 0,
            message: 'expected object to not be empty'
          };
        }
        return { passed: false, message: 'value is not array, string, or object' };
      
      case 'isTrue':
        return { passed: value === true, message: 'expected to be true' };
      
      case 'isFalse':
        return { passed: value === false, message: 'expected to be false' };
      
      case 'hasProperty':
        return {
          passed: typeof value === 'object' && value !== null && (expected as string) in value,
          message: `expected to have property "${expected}"`
        };
      
      case 'typeof':
        return {
          passed: typeof value === expected,
          message: `expected typeof to be "${expected}"`
        };
      
      default:
        return { passed: false, message: `Unknown operator: ${operator}` };
    }
  }
}

export default StateValidator;
