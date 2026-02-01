/**
 * DaemonManager - Persistent Process for Accelerated Testing
 * 
 * Inspired by agent-browser's daemon mode.
 * Provides browser instance reuse for faster consecutive test runs.
 */

import * as fs from 'fs';
import * as net from 'net';
import type { DesktopTest } from './desktop-test';

/** Daemon configuration */
export interface DaemonConfig {
  /** Socket path (Unix) or port (TCP) */
  socket?: string;
  /** TCP port (if not using Unix socket) */
  port?: number;
  /** PID file path */
  pidFile?: string;
  /** Auto-restart on crash */
  autoRestart?: boolean;
  /** Max idle time before shutdown (ms) */
  maxIdleTime?: number;
  /** Log file path */
  logFile?: string;
  /** Debug mode */
  debug?: boolean;
}

/** Daemon status */
export interface DaemonStatus {
  /** Is daemon running */
  running: boolean;
  /** Process ID */
  pid?: number;
  /** Uptime in milliseconds */
  uptime?: number;
  /** Number of connected clients */
  clients?: number;
  /** Total requests served */
  requestsServed?: number;
  /** Current memory usage */
  memoryUsage?: number;
  /** Socket/port being used */
  endpoint?: string;
}

/** Command sent to daemon */
export interface DaemonCommand {
  /** Command type */
  type: 'execute' | 'status' | 'shutdown' | 'reset';
  /** Command ID for response matching */
  id: string;
  /** Command payload */
  payload?: unknown;
}

/** Response from daemon */
export interface DaemonResponse {
  /** Command ID this responds to */
  id: string;
  /** Success status */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

/** Client connection to daemon */
export interface DaemonClient {
  /** Send command and wait for response */
  execute<T>(method: string, params?: unknown): Promise<T>;
  /** Get daemon status */
  status(): Promise<DaemonStatus>;
  /** Disconnect from daemon */
  disconnect(): Promise<void>;
  /** Check if connected */
  isConnected(): boolean;
}

/**
 * DaemonManager - Manage persistent test daemon process
 * 
 * @example
 * ```typescript
 * // Start daemon (usually in a separate process)
 * const daemon = new DaemonManager({ port: 9224 });
 * await daemon.start();
 * 
 * // Connect from test file
 * const client = await DaemonManager.connect({ port: 9224 });
 * const result = await client.execute('screenshot');
 * await client.disconnect();
 * 
 * // Stop daemon
 * await daemon.stop();
 * ```
 */
export class DaemonManager {
  private config: Required<DaemonConfig>;
  private server: net.Server | null = null;
  private clients: Set<net.Socket> = new Set();
  private testInstance: DesktopTest | null = null;
  private startTime: number = 0;
  private requestCount: number = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: DaemonConfig = {}) {
    this.config = {
      socket: config.socket || '',
      port: config.port || 9224,
      pidFile: config.pidFile || '/tmp/deskpilot-daemon.pid',
      autoRestart: config.autoRestart ?? true,
      maxIdleTime: config.maxIdleTime || 30 * 60 * 1000, // 30 minutes
      logFile: config.logFile || '/tmp/deskpilot-daemon.log',
      debug: config.debug ?? false
    };
  }

  /**
   * Start the daemon server
   */
  async start(testInstance?: DesktopTest): Promise<void> {
    if (this.isRunning) {
      throw new Error('Daemon is already running');
    }

    // Check if another daemon is already running
    if (await this.isDaemonRunning()) {
      throw new Error('Another daemon instance is already running');
    }

    this.testInstance = testInstance || null;
    this.startTime = Date.now();
    this.requestCount = 0;

    // Create server
    this.server = net.createServer((socket) => this.handleConnection(socket));

    // Listen on socket or port
    await new Promise<void>((resolve, reject) => {
      if (!this.server) return reject(new Error('Server not initialized'));

      const onError = (err: Error) => {
        this.server?.removeListener('error', onError);
        reject(err);
      };

      this.server.once('error', onError);

      if (this.config.socket) {
        // Clean up old socket file if exists
        if (fs.existsSync(this.config.socket)) {
          fs.unlinkSync(this.config.socket);
        }
        this.server.listen(this.config.socket, () => {
          this.server?.removeListener('error', onError);
          resolve();
        });
      } else {
        this.server.listen(this.config.port, '127.0.0.1', () => {
          this.server?.removeListener('error', onError);
          resolve();
        });
      }
    });

    // Write PID file
    fs.writeFileSync(this.config.pidFile, String(process.pid));

    this.isRunning = true;
    this.log('Daemon started', { 
      endpoint: this.getEndpoint(),
      pid: process.pid 
    });

    // Start idle timer
    this.resetIdleTimer();
  }

  /**
   * Stop the daemon server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.log('Stopping daemon...');

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Close all client connections
    for (const client of this.clients) {
      client.end();
      client.destroy();
    }
    this.clients.clear();

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }

    // Remove PID file
    if (fs.existsSync(this.config.pidFile)) {
      fs.unlinkSync(this.config.pidFile);
    }

    // Remove socket file
    if (this.config.socket && fs.existsSync(this.config.socket)) {
      fs.unlinkSync(this.config.socket);
    }

    this.isRunning = false;
    this.log('Daemon stopped');
  }

  /**
   * Get daemon status
   */
  getStatus(): DaemonStatus {
    return {
      running: this.isRunning,
      pid: process.pid,
      uptime: this.isRunning ? Date.now() - this.startTime : undefined,
      clients: this.clients.size,
      requestsServed: this.requestCount,
      memoryUsage: process.memoryUsage().heapUsed,
      endpoint: this.getEndpoint()
    };
  }

  /**
   * Set or update the test instance
   */
  setTestInstance(test: DesktopTest): void {
    this.testInstance = test;
  }

  /**
   * Check if daemon is running (from PID file)
   */
  async isDaemonRunning(): Promise<boolean> {
    if (!fs.existsSync(this.config.pidFile)) {
      return false;
    }

    try {
      const pid = parseInt(fs.readFileSync(this.config.pidFile, 'utf-8').trim());
      // Check if process exists
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist, clean up stale PID file
      fs.unlinkSync(this.config.pidFile);
      return false;
    }
  }

  /**
   * Connect to a running daemon
   */
  static async connect(config: DaemonConfig = {}): Promise<DaemonClient> {
    const socket = config.socket || '';
    const port = config.port || 9224;
    
    return new Promise((resolve, reject) => {
      const client = socket 
        ? net.createConnection(socket)
        : net.createConnection(port, '127.0.0.1');

      let connected = false;
      let buffer = '';
      const pendingRequests = new Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }>();

      client.on('connect', () => {
        connected = true;
        resolve({
          async execute<T>(method: string, params?: unknown): Promise<T> {
            const id = Math.random().toString(36).substring(2);
            const command: DaemonCommand = {
              type: 'execute',
              id,
              payload: { method, params }
            };

            return new Promise((res, rej) => {
              pendingRequests.set(id, { 
                resolve: res as (value: unknown) => void, 
                reject: rej 
              });
              client.write(JSON.stringify(command) + '\n');
            });
          },

          async status(): Promise<DaemonStatus> {
            const id = Math.random().toString(36).substring(2);
            const command: DaemonCommand = { type: 'status', id };

            return new Promise((res, rej) => {
              pendingRequests.set(id, { 
                resolve: res as (value: unknown) => void, 
                reject: rej 
              });
              client.write(JSON.stringify(command) + '\n');
            });
          },

          async disconnect(): Promise<void> {
            return new Promise((res) => {
              client.end(() => res());
            });
          },

          isConnected(): boolean {
            return connected && !client.destroyed;
          }
        });
      });

      client.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response: DaemonResponse = JSON.parse(line);
            const pending = pendingRequests.get(response.id);
            if (pending) {
              pendingRequests.delete(response.id);
              if (response.success) {
                pending.resolve(response.data);
              } else {
                pending.reject(new Error(response.error || 'Unknown error'));
              }
            }
          } catch {
            // Invalid JSON, ignore
          }
        }
      });

      client.on('error', (err) => {
        if (!connected) {
          reject(err);
        }
        connected = false;
      });

      client.on('close', () => {
        connected = false;
        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
          pending.reject(new Error('Connection closed'));
          pendingRequests.delete(id);
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (!connected) {
          client.destroy();
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Stop a running daemon by PID file
   */
  static async stopByPidFile(pidFile: string = '/tmp/deskpilot-daemon.pid'): Promise<boolean> {
    if (!fs.existsSync(pidFile)) {
      return false;
    }

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      process.kill(pid, 'SIGTERM');
      
      // Wait for process to exit
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        try {
          process.kill(pid, 0);
        } catch {
          // Process exited
          return true;
        }
      }

      // Force kill
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }

  // Private methods

  private handleConnection(socket: net.Socket): void {
    this.clients.add(socket);
    this.log('Client connected', { total: this.clients.size });
    this.resetIdleTimer();

    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const command: DaemonCommand = JSON.parse(line);
          const response = await this.handleCommand(command);
          socket.write(JSON.stringify(response) + '\n');
        } catch (err) {
          const errorResponse: DaemonResponse = {
            id: 'unknown',
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          };
          socket.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      this.log('Client disconnected', { total: this.clients.size });
      this.resetIdleTimer();
    });

    socket.on('error', (err) => {
      this.log('Client error', { error: err.message });
      this.clients.delete(socket);
    });
  }

  private async handleCommand(command: DaemonCommand): Promise<DaemonResponse> {
    this.requestCount++;
    this.resetIdleTimer();

    try {
      switch (command.type) {
        case 'status':
          return {
            id: command.id,
            success: true,
            data: this.getStatus()
          };

        case 'shutdown':
          // Schedule shutdown after response
          setTimeout(() => this.stop(), 100);
          return {
            id: command.id,
            success: true,
            data: { message: 'Shutting down' }
          };

        case 'reset':
          // Reset test instance state
          this.testInstance = null;
          return {
            id: command.id,
            success: true,
            data: { message: 'Reset complete' }
          };

        case 'execute':
          if (!this.testInstance) {
            return {
              id: command.id,
              success: false,
              error: 'No test instance available'
            };
          }

          const { method, params } = command.payload as { method: string; params?: unknown };
          const testMethod = (this.testInstance as unknown as Record<string, unknown>)[method];
          
          if (typeof testMethod !== 'function') {
            return {
              id: command.id,
              success: false,
              error: `Unknown method: ${method}`
            };
          }

          const result = await (testMethod as Function).call(this.testInstance, params);
          return {
            id: command.id,
            success: true,
            data: result
          };

        default:
          return {
            id: command.id,
            success: false,
            error: `Unknown command type: ${command.type}`
          };
      }
    } catch (err) {
      return {
        id: command.id,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  private getEndpoint(): string {
    if (this.config.socket) {
      return `unix://${this.config.socket}`;
    }
    return `tcp://127.0.0.1:${this.config.port}`;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    if (this.clients.size === 0 && this.config.maxIdleTime > 0) {
      this.idleTimer = setTimeout(() => {
        this.log('Idle timeout reached, shutting down');
        this.stop();
      }, this.config.maxIdleTime);
    }
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (!this.config.debug) return;

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;

    // Write to log file
    if (this.config.logFile) {
      fs.appendFileSync(this.config.logFile, logLine);
    }

    // Also log to console in debug mode
    console.log(logLine.trim());
  }
}

/**
 * Helper function to ensure daemon is running
 */
export async function ensureDaemon(config: DaemonConfig = {}): Promise<DaemonClient> {
  const manager = new DaemonManager(config);
  
  // Check if daemon is already running
  if (await manager.isDaemonRunning()) {
    return DaemonManager.connect(config);
  }

  // Start daemon in background
  await manager.start();
  
  // Connect to it
  return DaemonManager.connect(config);
}

/**
 * Helper function to run tests with daemon
 */
export async function withDaemon<T>(
  config: DaemonConfig,
  fn: (client: DaemonClient) => Promise<T>
): Promise<T> {
  const client = await ensureDaemon(config);
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

export default DaemonManager;
