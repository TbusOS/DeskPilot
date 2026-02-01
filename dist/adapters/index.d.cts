import { C as CDPAdapterInterface, d as CDPConfig, o as SnapshotResult, E as ElementLocator, i as ElementRef, e as ClickOptions, u as TypeOptions, n as ScrollOptions, S as ScreenshotOptions, m as PythonBridgeInterface, l as PythonBridgeConfig, N as NutJSAdapterInterface, k as NutJSConfig } from '../types-CVKrO8qF.cjs';

/**
 * @flowsight/desktop-test - CDP Adapter
 *
 * Chrome DevTools Protocol adapter for WebView/Browser control.
 * Uses agent-browser CLI under the hood for Tauri/Electron app testing.
 */

/**
 * CDP Adapter - controls WebView through Chrome DevTools Protocol
 */
declare class CDPAdapter implements CDPAdapterInterface {
    private config;
    private connected;
    private refMap;
    private refCounter;
    private session;
    constructor(config: CDPConfig);
    /**
     * Initialize adapter
     */
    initialize(): Promise<void>;
    /**
     * Cleanup adapter
     */
    cleanup(): Promise<void>;
    /**
     * Check if available
     */
    isAvailable(): boolean;
    /**
     * Connect to the browser/app via CDP
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the browser/app
     */
    disconnect(): Promise<void>;
    /**
     * Get accessibility snapshot with refs
     */
    getSnapshot(options?: {
        interactive?: boolean;
        includeScreenshot?: boolean;
    }): Promise<SnapshotResult>;
    /**
     * Find single element
     */
    find(locator: ElementLocator): Promise<ElementRef | null>;
    /**
     * Find all matching elements
     */
    findAll(locator: ElementLocator): Promise<ElementRef[]>;
    /**
     * Click element
     */
    click(element: ElementRef, options?: ClickOptions): Promise<void>;
    /**
     * Type text
     */
    type(element: ElementRef, text: string, _options?: TypeOptions): Promise<void>;
    /**
     * Press key
     */
    press(key: string): Promise<void>;
    /**
     * Hover over element
     */
    hover(element: ElementRef): Promise<void>;
    /**
     * Scroll
     */
    scroll(options: ScrollOptions): Promise<void>;
    /**
     * Drag element
     */
    drag(from: ElementRef, to: ElementRef): Promise<void>;
    /**
     * Get element text
     */
    getText(element: ElementRef): Promise<string>;
    /**
     * Get element value
     */
    getValue(element: ElementRef): Promise<string>;
    /**
     * Get element attribute
     */
    getAttribute(element: ElementRef, attr: string): Promise<string | null>;
    /**
     * Check if element is visible
     */
    isVisible(element: ElementRef): Promise<boolean>;
    /**
     * Check if element is enabled
     */
    isEnabled(element: ElementRef): Promise<boolean>;
    /**
     * Get current URL
     */
    getUrl(): Promise<string>;
    /**
     * Get page title
     */
    getTitle(): Promise<string>;
    /**
     * Evaluate JavaScript
     */
    evaluate<T>(script: string): Promise<T>;
    /**
     * Take screenshot
     */
    screenshot(screenshotPath?: string, options?: ScreenshotOptions): Promise<string>;
    /**
     * Get screenshot as base64
     */
    getScreenshotBase64(): Promise<string>;
    /**
     * Start recording
     */
    startRecording(recordingPath: string): Promise<void>;
    /**
     * Stop recording
     */
    stopRecording(): Promise<{
        path: string;
    }>;
    /**
     * Wait for page to be idle
     */
    waitForIdle(timeout?: number): Promise<void>;
    private ensureConnected;
    private exec;
    private execJson;
    private locatorToSelector;
    private elementToSelector;
}

/**
 * @flowsight/desktop-test - Python Bridge Adapter
 *
 * Bridge to the existing Python desktop automation framework.
 * Communicates with Python via subprocess and JSON-RPC style messages.
 */

/**
 * Python Bridge - connects to the existing Python desktop automation framework
 */
declare class PythonBridge implements PythonBridgeInterface {
    private config;
    private process;
    private available;
    private requestId;
    private pendingRequests;
    private readline;
    constructor(config?: PythonBridgeConfig);
    /**
     * Initialize the Python bridge
     */
    initialize(): Promise<void>;
    /**
     * Cleanup the Python bridge
     */
    cleanup(): Promise<void>;
    /**
     * Check if available
     */
    isAvailable(): boolean;
    /**
     * Call a Python method
     */
    call<T>(method: string, args?: unknown[]): Promise<T>;
    /**
     * Take screenshot via Python
     */
    screenshot(): Promise<string>;
    /**
     * Click at coordinates via Python
     */
    click(x: number, y: number, button?: string): Promise<void>;
    /**
     * Type text via Python
     */
    typeText(text: string): Promise<void>;
    /**
     * Press key via Python
     */
    pressKey(key: string, modifiers?: string[]): Promise<void>;
    /**
     * Get accessibility tree via Python
     */
    getAccessibilityTree(): Promise<unknown>;
    /**
     * Analyze screenshot with VLM via Python
     */
    analyzeVisual(screenshotBase64: string): Promise<unknown>;
    /**
     * Move mouse to coordinates
     */
    moveMouse(x: number, y: number): Promise<void>;
    /**
     * Double click
     */
    doubleClick(x: number, y: number): Promise<void>;
    /**
     * Right click
     */
    rightClick(x: number, y: number): Promise<void>;
    /**
     * Drag from one point to another
     */
    drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
    /**
     * Scroll
     */
    scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void>;
    /**
     * Find application window
     */
    findApplication(appName: string): Promise<unknown>;
    /**
     * Activate application window
     */
    activateApplication(appName: string): Promise<void>;
    /**
     * Get screen size
     */
    getScreenSize(): Promise<{
        width: number;
        height: number;
    }>;
    /**
     * Find element by name
     */
    findElementByName(name: string, elementType?: string): Promise<unknown>;
    /**
     * Wait for Python process to be ready
     */
    private waitForReady;
    /**
     * Handle response from Python process
     */
    private handleResponse;
}

/**
 * @flowsight/desktop-test - NutJS Adapter
 *
 * Native desktop control adapter using NutJS.
 * Provides cross-platform mouse, keyboard, and screenshot capabilities.
 */

/**
 * NutJS Adapter - native desktop control
 */
declare class NutJSAdapter implements NutJSAdapterInterface {
    private config;
    private initialized;
    private nut;
    constructor(config?: NutJSConfig);
    /**
     * Initialize NutJS
     */
    initialize(): Promise<void>;
    /**
     * Cleanup
     */
    cleanup(): Promise<void>;
    /**
     * Check if NutJS is available
     */
    isAvailable(): boolean;
    /**
     * Click at coordinates
     */
    click(x: number, y: number, button?: 'left' | 'right' | 'middle', count?: number): Promise<void>;
    /**
     * Move mouse to coordinates
     */
    moveTo(x: number, y: number): Promise<void>;
    /**
     * Type text
     */
    type(text: string, delay?: number): Promise<void>;
    /**
     * Press key or key combination
     */
    press(key: string): Promise<void>;
    /**
     * Scroll
     */
    scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number): Promise<void>;
    /**
     * Drag from one point to another
     */
    drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
    /**
     * Take screenshot and return base64
     */
    screenshot(): Promise<string>;
    /**
     * Get screen size
     */
    getScreenSize(): Promise<{
        width: number;
        height: number;
    }>;
    private normalizeKey;
    private sleep;
}

export { CDPAdapter, NutJSAdapter, PythonBridge };
