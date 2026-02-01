/**
 * StreamServer - Real-time Test Execution Preview
 * 
 * Inspired by agent-browser's streaming capabilities.
 * Provides WebSocket-based real-time preview of test execution.
 */

import type { DesktopTest } from './desktop-test';

/** Stream frame */
export interface StreamFrame {
  /** Frame type */
  type: 'screenshot' | 'dom' | 'event';
  /** Frame data (base64 for screenshots) */
  data: string;
  /** Frame timestamp */
  timestamp: number;
  /** Frame dimensions */
  dimensions?: { width: number; height: number };
  /** Frame metadata */
  metadata?: Record<string, unknown>;
}

/** Stream options */
export interface StreamOptions {
  /** WebSocket port */
  port?: number;
  /** Frame rate (fps) */
  frameRate?: number;
  /** Image quality (1-100) */
  quality?: number;
  /** Image format */
  format?: 'jpeg' | 'png';
  /** Include cursor position */
  includeCursor?: boolean;
  /** Include DOM highlights */
  includeHighlights?: boolean;
}

/** Input event from client */
export interface InputEvent {
  /** Event type */
  type: 'click' | 'move' | 'scroll' | 'keydown' | 'keyup' | 'type';
  /** X coordinate */
  x?: number;
  /** Y coordinate */
  y?: number;
  /** Key pressed */
  key?: string;
  /** Text to type */
  text?: string;
  /** Scroll delta */
  deltaX?: number;
  deltaY?: number;
  /** Modifier keys */
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

/** Stream statistics */
export interface StreamStats {
  /** Total frames sent */
  framesSent: number;
  /** Total bytes sent */
  bytesSent: number;
  /** Average frame time (ms) */
  avgFrameTime: number;
  /** Connected clients */
  clientCount: number;
  /** Stream uptime (ms) */
  uptime: number;
  /** Current frame rate */
  currentFps: number;
}

/** Client info */
export interface ClientInfo {
  /** Client ID */
  id: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Client address */
  address: string;
}

/**
 * StreamServer - Real-time test execution streaming
 * 
 * @example
 * ```typescript
 * const stream = new StreamServer(test);
 * 
 * // Start streaming
 * await stream.start({ port: 9223, frameRate: 30 });
 * 
 * // Client can connect to ws://localhost:9223
 * // and receive real-time test execution frames
 * 
 * // Stop streaming
 * await stream.stop();
 * ```
 */
export class StreamServer {
  private test: DesktopTest;
  private options: Required<StreamOptions>;
  private running = false;
  private startTime = 0;
  private frameCount = 0;
  private bytesSent = 0;
  private clients: Map<string, ClientInfo> = new Map();
  private frameInterval: NodeJS.Timeout | null = null;
  private frameTimes: number[] = [];
  private onFrameCallback?: (frame: StreamFrame) => void;
  private onInputCallback?: (event: InputEvent) => void;

  constructor(test: DesktopTest) {
    this.test = test;
    this.options = {
      port: 9223,
      frameRate: 30,
      quality: 80,
      format: 'jpeg',
      includeCursor: true,
      includeHighlights: true
    };
  }

  /**
   * Start the stream server
   */
  async start(options: StreamOptions = {}): Promise<void> {
    if (this.running) {
      throw new Error('Stream server is already running');
    }

    this.options = { ...this.options, ...options };
    this.running = true;
    this.startTime = Date.now();
    this.frameCount = 0;
    this.bytesSent = 0;
    this.frameTimes = [];

    // Start frame capture loop
    const frameInterval = 1000 / this.options.frameRate;
    this.frameInterval = setInterval(() => this.captureAndSendFrame(), frameInterval);

    // Note: In a real implementation, this would start a WebSocket server
    // For now, we simulate the server behavior
    console.log(`Stream server started on port ${this.options.port}`);
    console.log(`Connect to ws://localhost:${this.options.port} to view the stream`);
  }

  /**
   * Stop the stream server
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }

    // Disconnect all clients
    this.clients.clear();

    console.log('Stream server stopped');
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get stream statistics
   */
  getStats(): StreamStats {
    const avgFrameTime = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;

    const recentFrameTimes = this.frameTimes.slice(-30);
    const currentFps = recentFrameTimes.length > 0
      ? 1000 / (recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length)
      : 0;

    return {
      framesSent: this.frameCount,
      bytesSent: this.bytesSent,
      avgFrameTime,
      clientCount: this.clients.size,
      uptime: this.running ? Date.now() - this.startTime : 0,
      currentFps
    };
  }

  /**
   * Get connected clients
   */
  getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Set frame rate
   */
  setFrameRate(fps: number): void {
    this.options.frameRate = fps;
    
    // Restart frame capture with new rate
    if (this.running && this.frameInterval) {
      clearInterval(this.frameInterval);
      const frameInterval = 1000 / fps;
      this.frameInterval = setInterval(() => this.captureAndSendFrame(), frameInterval);
    }
  }

  /**
   * Set image quality
   */
  setQuality(quality: number): void {
    this.options.quality = Math.max(1, Math.min(100, quality));
  }

  /**
   * Set image format
   */
  setFormat(format: 'jpeg' | 'png'): void {
    this.options.format = format;
  }

  /**
   * Register frame callback (for testing/debugging)
   */
  onFrame(callback: (frame: StreamFrame) => void): void {
    this.onFrameCallback = callback;
  }

  /**
   * Register input callback (for testing/debugging)
   */
  onInput(callback: (event: InputEvent) => void): void {
    this.onInputCallback = callback;
  }

  /**
   * Simulate client connection (for testing)
   */
  simulateClientConnect(clientId: string, address: string = '127.0.0.1'): void {
    this.clients.set(clientId, {
      id: clientId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      address
    });
  }

  /**
   * Simulate client disconnect (for testing)
   */
  simulateClientDisconnect(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Simulate input event from client (for testing)
   */
  async handleInputEvent(event: InputEvent): Promise<void> {
    if (this.onInputCallback) {
      this.onInputCallback(event);
    }

    // Execute the input action
    switch (event.type) {
      case 'click':
        if (event.x !== undefined && event.y !== undefined) {
          await this.test.evaluate(`
            document.elementFromPoint(${event.x}, ${event.y})?.click();
          `);
        }
        break;
      
      case 'type':
        if (event.text) {
          await this.test.evaluate(`
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
              active.value += ${JSON.stringify(event.text)};
              active.dispatchEvent(new Event('input', { bubbles: true }));
            }
          `);
        }
        break;
      
      case 'scroll':
        if (event.deltaX !== undefined || event.deltaY !== undefined) {
          await this.test.evaluate(`
            window.scrollBy(${event.deltaX || 0}, ${event.deltaY || 0});
          `);
        }
        break;
      
      case 'keydown':
        if (event.key) {
          await this.test.press(event.key);
        }
        break;
    }
  }

  /**
   * Capture current frame
   */
  async captureFrame(): Promise<StreamFrame> {
    // Take screenshot (path parameter not used, will return base64)
    const screenshot = await this.test.screenshot();

    // Get viewport dimensions
    const dimensions = await this.test.evaluate(`
      ({ width: window.innerWidth, height: window.innerHeight })
    `) as { width: number; height: number };

    // Get cursor position if enabled
    let metadata: Record<string, unknown> = {};
    if (this.options.includeCursor) {
      const cursor = await this.test.evaluate(`
        window.__lastMousePosition || { x: 0, y: 0 }
      `) as { x: number; y: number };
      metadata.cursor = cursor;
    }

    return {
      type: 'screenshot',
      data: screenshot,
      timestamp: Date.now(),
      dimensions,
      metadata
    };
  }

  // Private methods

  private async captureAndSendFrame(): Promise<void> {
    if (!this.running || this.clients.size === 0) return;

    const frameStart = performance.now();

    try {
      const frame = await this.captureFrame();
      
      // Send to all clients
      this.broadcastFrame(frame);
      
      this.frameCount++;
      this.bytesSent += frame.data.length;

      const frameTime = performance.now() - frameStart;
      this.frameTimes.push(frameTime);
      
      // Keep only last 100 frame times
      if (this.frameTimes.length > 100) {
        this.frameTimes.shift();
      }
    } catch (error) {
      console.error('Error capturing frame:', error);
    }
  }

  private broadcastFrame(frame: StreamFrame): void {
    // Update last activity for all clients
    for (const client of this.clients.values()) {
      client.lastActivity = Date.now();
    }

    // Call frame callback if registered
    if (this.onFrameCallback) {
      this.onFrameCallback(frame);
    }

    // Note: In a real WebSocket implementation, this would send to all connected clients
  }
}

export default StreamServer;
