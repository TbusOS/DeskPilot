/**
 * NetworkInterceptor - Network Request Interception and Mocking
 * 
 * Inspired by agent-browser's network interception capabilities.
 * Provides request routing, mocking, and recording for testing edge cases.
 */

import type { DesktopTest } from './desktop-test';

/** HTTP methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** Request info */
export interface RequestInfo {
  /** Request ID */
  id: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: HttpMethod;
  /** Request headers */
  headers: Record<string, string>;
  /** Request body (if any) */
  body?: string | object;
  /** Timestamp */
  timestamp: number;
  /** Resource type */
  resourceType: 'document' | 'script' | 'stylesheet' | 'image' | 'font' | 'xhr' | 'fetch' | 'other';
}

/** Response info */
export interface ResponseInfo {
  /** HTTP status code */
  status: number;
  /** Status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body?: string | object;
  /** Response time in ms */
  responseTime: number;
}

/** Recorded request with response */
export interface RecordedRequest extends RequestInfo {
  /** Response info */
  response?: ResponseInfo;
  /** Whether request was mocked */
  mocked: boolean;
  /** Whether request was aborted */
  aborted: boolean;
}

/** Route handler options */
export interface RouteOptions {
  /** Mock response status (default: 200) */
  status?: number;
  /** Mock response body */
  body?: string | object;
  /** Mock response headers */
  headers?: Record<string, string>;
  /** Abort the request */
  abort?: boolean;
  /** Delay response in ms */
  delay?: number;
  /** Continue with original request (useful for modifying) */
  continue?: boolean;
  /** Modify request before continuing */
  modifyRequest?: (request: RequestInfo) => RequestInfo;
  /** Modify response before returning */
  modifyResponse?: (response: ResponseInfo) => ResponseInfo;
  /** Only match specific methods */
  methods?: HttpMethod[];
  /** Only match requests with specific headers */
  matchHeaders?: Record<string, string | RegExp>;
  /** Number of times to apply this route (default: unlimited) */
  times?: number;
}

/** Route definition */
export interface RouteDefinition {
  /** URL pattern (glob or regex) */
  pattern: string | RegExp;
  /** Route options */
  options: RouteOptions;
  /** Number of times matched */
  matchCount: number;
  /** Route ID */
  id: string;
  /** Whether route is active */
  active: boolean;
}

/** Request filter options */
export interface RequestFilterOptions {
  /** Filter by URL pattern */
  url?: string | RegExp;
  /** Filter by method */
  method?: HttpMethod | HttpMethod[];
  /** Filter by resource type */
  resourceType?: RequestInfo['resourceType'] | RequestInfo['resourceType'][];
  /** Only mocked requests */
  mocked?: boolean;
  /** Only aborted requests */
  aborted?: boolean;
  /** Time range - after timestamp */
  after?: number;
  /** Time range - before timestamp */
  before?: number;
  /** Limit number of results */
  limit?: number;
}

/**
 * NetworkInterceptor - Intercept and mock network requests
 * 
 * @example
 * ```typescript
 * const network = new NetworkInterceptor(test);
 * 
 * // Mock API response
 * await network.route('/api/files', {
 *   body: { files: [], total: 0 }
 * });
 * 
 * // Abort specific requests  
 * await network.route('/analytics/', { abort: true });
 * 
 * // Get recorded requests
 * const requests = network.getRequests({ url: /api/ });
 * ```
 */
export class NetworkInterceptor {
  private test: DesktopTest;
  private routes: Map<string, RouteDefinition> = new Map();
  private requests: RecordedRequest[] = [];
  private recording = false;
  private routeCounter = 0;
  private interceptorSetup = false;

  constructor(test: DesktopTest) {
    this.test = test;
  }

  /**
   * Add a route to intercept matching requests
   */
  async route(pattern: string | RegExp, options: RouteOptions = {}): Promise<string> {
    const routeId = `route-${++this.routeCounter}`;
    
    const route: RouteDefinition = {
      pattern,
      options,
      matchCount: 0,
      id: routeId,
      active: true
    };

    this.routes.set(routeId, route);

    // Setup interceptor if not already done
    if (!this.interceptorSetup) {
      await this.setupInterceptor();
    }

    return routeId;
  }

  /**
   * Remove a route by ID
   */
  removeRoute(routeId: string): boolean {
    return this.routes.delete(routeId);
  }

  /**
   * Remove all routes matching a pattern
   */
  removeRoutesByPattern(pattern: string | RegExp): number {
    let count = 0;
    const patternStr = pattern.toString();
    
    for (const [id, route] of this.routes) {
      if (route.pattern.toString() === patternStr) {
        this.routes.delete(id);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes.clear();
  }

  /**
   * Start recording requests
   */
  startRecording(): void {
    this.recording = true;
    this.requests = [];
  }

  /**
   * Stop recording requests
   */
  stopRecording(): RecordedRequest[] {
    this.recording = false;
    return [...this.requests];
  }

  /**
   * Get recorded requests with optional filtering
   */
  getRequests(filter?: RequestFilterOptions): RecordedRequest[] {
    let results = [...this.requests];

    if (!filter) return results;

    // Filter by URL
    if (filter.url) {
      const urlPattern = filter.url instanceof RegExp 
        ? filter.url 
        : new RegExp(filter.url.replace(/\*/g, '.*'));
      results = results.filter(r => urlPattern.test(r.url));
    }

    // Filter by method
    if (filter.method) {
      const methods = Array.isArray(filter.method) ? filter.method : [filter.method];
      results = results.filter(r => methods.includes(r.method));
    }

    // Filter by resource type
    if (filter.resourceType) {
      const types = Array.isArray(filter.resourceType) ? filter.resourceType : [filter.resourceType];
      results = results.filter(r => types.includes(r.resourceType));
    }

    // Filter by mocked status
    if (filter.mocked !== undefined) {
      results = results.filter(r => r.mocked === filter.mocked);
    }

    // Filter by aborted status
    if (filter.aborted !== undefined) {
      results = results.filter(r => r.aborted === filter.aborted);
    }

    // Filter by time range
    if (filter.after !== undefined) {
      results = results.filter(r => r.timestamp >= filter.after!);
    }
    if (filter.before !== undefined) {
      results = results.filter(r => r.timestamp <= filter.before!);
    }

    // Limit results
    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Clear recorded requests
   */
  clearRequests(): void {
    this.requests = [];
  }

  /**
   * Wait for a request matching the pattern
   */
  async waitForRequest(
    pattern: string | RegExp, 
    options: { timeout?: number; method?: HttpMethod } = {}
  ): Promise<RecordedRequest> {
    const { timeout = 30000, method } = options;
    const startTime = Date.now();
    const urlPattern = pattern instanceof RegExp 
      ? pattern 
      : new RegExp(pattern.replace(/\*/g, '.*'));

    while (Date.now() - startTime < timeout) {
      const match = this.requests.find(r => {
        if (!urlPattern.test(r.url)) return false;
        if (method && r.method !== method) return false;
        return true;
      });

      if (match) return match;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for request matching ${pattern}`);
  }

  /**
   * Wait for a response matching the pattern
   */
  async waitForResponse(
    pattern: string | RegExp,
    options: { timeout?: number; status?: number } = {}
  ): Promise<RecordedRequest> {
    const { timeout = 30000, status } = options;
    const startTime = Date.now();
    const urlPattern = pattern instanceof RegExp 
      ? pattern 
      : new RegExp(pattern.replace(/\*/g, '.*'));

    while (Date.now() - startTime < timeout) {
      const match = this.requests.find(r => {
        if (!urlPattern.test(r.url)) return false;
        if (!r.response) return false;
        if (status !== undefined && r.response.status !== status) return false;
        return true;
      });

      if (match) return match;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for response matching ${pattern}`);
  }

  /**
   * Mock a specific API endpoint with predefined responses
   */
  async mockApi(
    endpoint: string,
    responses: {
      GET?: RouteOptions;
      POST?: RouteOptions;
      PUT?: RouteOptions;
      DELETE?: RouteOptions;
      PATCH?: RouteOptions;
    }
  ): Promise<string[]> {
    const routeIds: string[] = [];

    for (const [method, options] of Object.entries(responses)) {
      const routeId = await this.route(endpoint, {
        ...options,
        methods: [method as HttpMethod]
      });
      routeIds.push(routeId);
    }

    return routeIds;
  }

  /**
   * Simulate network conditions
   */
  async simulateNetworkConditions(conditions: {
    offline?: boolean;
    latency?: number;
    downloadThroughput?: number;
    uploadThroughput?: number;
  }): Promise<void> {
    const { offline = false, latency = 0, downloadThroughput: _downloadThroughput, uploadThroughput: _uploadThroughput } = conditions;
    // Note: downloadThroughput and uploadThroughput are reserved for future use
    void _downloadThroughput;
    void _uploadThroughput;

    await this.test.evaluate(`
      (() => {
        // Store original fetch
        if (!window.__originalFetch) {
          window.__originalFetch = window.fetch;
        }
        
        // Override fetch with simulated conditions
        window.fetch = async (...args) => {
          if (${offline}) {
            throw new TypeError('Failed to fetch');
          }
          
          if (${latency} > 0) {
            await new Promise(r => setTimeout(r, ${latency}));
          }
          
          return window.__originalFetch(...args);
        };
      })()
    `);
  }

  /**
   * Reset network conditions to normal
   */
  async resetNetworkConditions(): Promise<void> {
    await this.test.evaluate(`
      (() => {
        if (window.__originalFetch) {
          window.fetch = window.__originalFetch;
          delete window.__originalFetch;
        }
      })()
    `);
  }

  /**
   * Get all active routes
   */
  getRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values()).filter(r => r.active);
  }

  /**
   * Get network statistics
   */
  getStats(): {
    totalRequests: number;
    mockedRequests: number;
    abortedRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    byMethod: Record<HttpMethod, number>;
    byResourceType: Record<string, number>;
  } {
    const totalRequests = this.requests.length;
    const mockedRequests = this.requests.filter(r => r.mocked).length;
    const abortedRequests = this.requests.filter(r => r.aborted).length;
    const failedRequests = this.requests.filter(r => 
      r.response && r.response.status >= 400
    ).length;

    const responseTimes = this.requests
      .filter(r => r.response?.responseTime)
      .map(r => r.response!.responseTime);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const byMethod: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};

    for (const request of this.requests) {
      byMethod[request.method] = (byMethod[request.method] || 0) + 1;
      byResourceType[request.resourceType] = (byResourceType[request.resourceType] || 0) + 1;
    }

    return {
      totalRequests,
      mockedRequests,
      abortedRequests,
      failedRequests,
      avgResponseTime,
      byMethod: byMethod as Record<HttpMethod, number>,
      byResourceType
    };
  }

  // Private methods

  private async setupInterceptor(): Promise<void> {
    // Inject request interceptor into page
    await this.test.evaluate(`
      (() => {
        if (window.__networkInterceptorSetup) return;
        window.__networkInterceptorSetup = true;
        
        // Store original fetch and XMLHttpRequest
        const originalFetch = window.fetch;
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        // Request queue for communication
        window.__interceptedRequests = [];
        window.__networkRoutes = [];
        
        // Override fetch
        window.fetch = async function(input, init = {}) {
          const url = typeof input === 'string' ? input : input.url;
          const method = init.method || 'GET';
          const headers = init.headers || {};
          const body = init.body;
          
          const requestInfo = {
            id: 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            url,
            method,
            headers: Object.fromEntries(
              headers instanceof Headers ? headers.entries() : Object.entries(headers)
            ),
            body,
            timestamp: Date.now(),
            resourceType: 'fetch'
          };
          
          // Check for matching routes
          const route = window.__networkRoutes.find(r => {
            const pattern = r.pattern instanceof RegExp 
              ? r.pattern 
              : new RegExp(r.pattern.replace(/\\*\\*/g, '.*').replace(/\\*/g, '[^/]*'));
            return pattern.test(url);
          });
          
          if (route) {
            route.matchCount++;
            
            if (route.options.abort) {
              requestInfo.aborted = true;
              window.__interceptedRequests.push(requestInfo);
              throw new TypeError('Request aborted by NetworkInterceptor');
            }
            
            if (route.options.delay) {
              await new Promise(r => setTimeout(r, route.options.delay));
            }
            
            if (route.options.body !== undefined || route.options.status !== undefined) {
              const mockResponse = {
                status: route.options.status || 200,
                statusText: route.options.status === 200 ? 'OK' : 'Mocked',
                headers: route.options.headers || { 'Content-Type': 'application/json' },
                body: route.options.body
              };
              
              requestInfo.response = mockResponse;
              requestInfo.mocked = true;
              window.__interceptedRequests.push(requestInfo);
              
              const bodyStr = typeof mockResponse.body === 'object' 
                ? JSON.stringify(mockResponse.body) 
                : mockResponse.body || '';
              
              return new Response(bodyStr, {
                status: mockResponse.status,
                statusText: mockResponse.statusText,
                headers: mockResponse.headers
              });
            }
          }
          
          // Make original request
          const startTime = Date.now();
          try {
            const response = await originalFetch(input, init);
            requestInfo.response = {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              responseTime: Date.now() - startTime
            };
            requestInfo.mocked = false;
            window.__interceptedRequests.push(requestInfo);
            return response;
          } catch (error) {
            requestInfo.error = error.message;
            window.__interceptedRequests.push(requestInfo);
            throw error;
          }
        };
        
        // Override XMLHttpRequest
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this.__interceptInfo = { method, url, timestamp: Date.now() };
          return originalXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
          const info = this.__interceptInfo || {};
          const requestInfo = {
            id: 'xhr-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            url: info.url,
            method: info.method || 'GET',
            headers: {},
            body,
            timestamp: info.timestamp || Date.now(),
            resourceType: 'xhr'
          };
          
          this.addEventListener('load', () => {
            requestInfo.response = {
              status: this.status,
              statusText: this.statusText,
              headers: {},
              responseTime: Date.now() - requestInfo.timestamp
            };
            window.__interceptedRequests.push(requestInfo);
          });
          
          this.addEventListener('error', () => {
            requestInfo.error = 'Network error';
            window.__interceptedRequests.push(requestInfo);
          });
          
          return originalXHRSend.call(this, body);
        };
      })()
    `);

    this.interceptorSetup = true;

    // Start polling for intercepted requests
    this.startRequestPolling();
  }

  private startRequestPolling(): void {
    const pollInterval = setInterval(async () => {
      if (!this.recording && this.routes.size === 0) {
        clearInterval(pollInterval);
        return;
      }

      try {
        // Sync routes to page
        const routesData = Array.from(this.routes.values()).map(r => ({
          pattern: r.pattern.toString(),
          options: r.options,
          matchCount: r.matchCount
        }));

        await this.test.evaluate(`
          window.__networkRoutes = ${JSON.stringify(routesData)}.map(r => ({
            ...r,
            pattern: r.pattern.startsWith('/') && r.pattern.endsWith('/') 
              ? new RegExp(r.pattern.slice(1, -1))
              : r.pattern
          }));
        `);

        // Get intercepted requests
        const requests = await this.test.evaluate(`
          (() => {
            const reqs = window.__interceptedRequests || [];
            window.__interceptedRequests = [];
            return reqs;
          })()
        `) as RecordedRequest[];

        if (requests && requests.length > 0) {
          this.requests.push(...requests);
        }
      } catch {
        // Ignore polling errors
      }
    }, 100);
  }

}

export default NetworkInterceptor;
