import { D as DesktopTest } from '../assertions-nzK8eHT2.cjs';
export { a as AssertionError, A as Assertions, T as TestRunner, b as TestRunnerOptions, c as createDesktopTest } from '../assertions-nzK8eHT2.cjs';
import { h as DesktopTestInstance, E as ElementLocator } from '../types-CVKrO8qF.cjs';

/**
 * @flowsight/desktop-test - Accessibility Tree
 *
 * Complete implementation of Accessibility Tree functionality.
 * Provides full access to the accessibility hierarchy for testing
 * with screen readers and assistive technologies.
 */

/**
 * ARIA roles organized by category
 */
declare const ARIA_ROLES: {
    readonly document: readonly ["article", "document", "application", "feed", "figure", "group", "img", "main", "math", "none", "note", "presentation", "separator", "toolbar"];
    readonly landmark: readonly ["banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search"];
    readonly widget: readonly ["button", "checkbox", "combobox", "gridcell", "link", "listbox", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "progressbar", "radio", "scrollbar", "searchbox", "slider", "spinbutton", "switch", "tab", "tabpanel", "textbox", "treeitem"];
    readonly composite: readonly ["combobox", "grid", "listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"];
    readonly live: readonly ["alert", "log", "marquee", "status", "timer"];
    readonly window: readonly ["alertdialog", "dialog"];
};
/**
 * Accessibility tree node
 */
interface AXNode {
    nodeId: string;
    role: string;
    name: string;
    description?: string;
    value?: string;
    properties: AXProperty[];
    children: AXNode[];
    parent?: AXNode;
    isInteractive: boolean;
    isFocusable: boolean;
    isVisible: boolean;
    isLandmark: boolean;
    level?: number;
    backendDOMNodeId?: number;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/**
 * Accessibility property
 */
interface AXProperty {
    name: string;
    value: string | number | boolean;
}
/**
 * Accessibility tree structure
 */
interface AccessibilityTree {
    root: AXNode;
    nodes: Map<string, AXNode>;
    totalNodes: number;
    interactiveNodes: number;
    landmarkCount: number;
    headingCount: number;
}
/**
 * Tree query result
 */
interface AXQueryResult {
    nodes: AXNode[];
    count: number;
}
/**
 * Accessibility issue found during validation
 */
interface AXIssue {
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    node?: AXNode;
    suggestion?: string;
}
/**
 * Accessibility Tree Manager
 *
 * Provides complete access to the page's accessibility tree
 */
declare class AccessibilityTreeManager {
    private test;
    private tree;
    constructor(test: DesktopTestInstance);
    /**
     * Get the full accessibility tree from the page
     */
    getTree(options?: {
        includeHidden?: boolean;
        maxDepth?: number;
    }): Promise<AccessibilityTree>;
    /**
     * Find nodes by role
     */
    findByRole(role: string): Promise<AXQueryResult>;
    /**
     * Find nodes by name (accessible name)
     */
    findByName(name: string, options?: {
        exact?: boolean;
    }): Promise<AXQueryResult>;
    /**
     * Find all landmarks
     */
    findLandmarks(): Promise<AXQueryResult>;
    /**
     * Find all headings
     */
    findHeadings(): Promise<AXQueryResult>;
    /**
     * Find all focusable elements
     */
    findFocusable(): Promise<AXQueryResult>;
    /**
     * Find all interactive elements
     */
    findInteractive(): Promise<AXQueryResult>;
    /**
     * Query with custom predicate
     */
    query(predicate: (node: AXNode) => boolean): Promise<AXQueryResult>;
    /**
     * Validate the accessibility tree for common issues
     */
    validate(): Promise<AXIssue[]>;
    /**
     * Check if a specific ARIA pattern is correctly implemented
     */
    validatePattern(pattern: 'dialog' | 'menu' | 'tabs' | 'tree' | 'listbox'): Promise<AXIssue[]>;
    /**
     * Get the path from root to a node
     */
    getPath(node: AXNode): AXNode[];
    /**
     * Get all siblings of a node
     */
    getSiblings(node: AXNode): AXNode[];
    /**
     * Get all descendants of a node
     */
    getDescendants(node: AXNode): AXNode[];
    /**
     * Serialize tree to text (for screen reader simulation)
     */
    toText(): Promise<string>;
    /**
     * Serialize tree to JSON
     */
    toJSON(): Promise<string>;
    /**
     * Generate accessibility summary report
     */
    generateSummary(): Promise<string>;
}
/**
 * Create accessibility tree manager
 */
declare function createAccessibilityTreeManager(test: DesktopTestInstance): AccessibilityTreeManager;

/**
 * WCAG violation severity levels
 */
type ViolationImpact = 'critical' | 'serious' | 'moderate' | 'minor';
/**
 * Accessibility violation
 */
interface A11yViolation {
    id: string;
    impact: ViolationImpact;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
        html: string;
        target: string[];
        failureSummary: string;
    }>;
}
/**
 * Accessibility test result
 */
interface A11yResult {
    violations: A11yViolation[];
    passes: number;
    incomplete: number;
    inapplicable: number;
}
/**
 * Complete accessibility audit result
 */
interface CompleteA11yResult extends A11yResult {
    treeIssues: AXIssue[];
    summary: {
        totalNodes: number;
        interactiveNodes: number;
        landmarkCount: number;
        headingCount: number;
    };
}
/**
 * WCAG rules categories
 */
declare const WCAG_TAGS: {
    readonly wcag2a: "WCAG 2.0 Level A";
    readonly wcag2aa: "WCAG 2.0 Level AA";
    readonly wcag2aaa: "WCAG 2.0 Level AAA";
    readonly wcag21a: "WCAG 2.1 Level A";
    readonly wcag21aa: "WCAG 2.1 Level AA";
    readonly 'best-practice': "Best Practices";
};
/**
 * Accessibility Tester
 *
 * Provides methods to check accessibility compliance.
 * Combines axe-core auditing with accessibility tree analysis.
 */
declare class A11yTester {
    private test;
    private treeManager;
    constructor(test: DesktopTestInstance);
    /**
     * Get the accessibility tree manager for direct tree access
     */
    get tree(): AccessibilityTreeManager;
    /**
     * Run accessibility audit using axe-core (injected into page)
     */
    audit(options?: {
        tags?: Array<keyof typeof WCAG_TAGS>;
        includeSelectors?: string[];
        excludeSelectors?: string[];
    }): Promise<A11yResult>;
    /**
     * Check for critical violations only
     */
    checkCritical(): Promise<A11yViolation[]>;
    /**
     * Check for serious and critical violations
     */
    checkSerious(): Promise<A11yViolation[]>;
    /**
     * Check color contrast issues
     */
    checkContrast(): Promise<A11yViolation[]>;
    /**
     * Check keyboard navigation issues
     */
    checkKeyboardNav(): Promise<A11yViolation[]>;
    /**
     * Generate accessibility report
     */
    generateReport(): Promise<string>;
    /**
     * Run a complete accessibility audit combining axe-core and tree analysis
     */
    completeAudit(options?: {
        tags?: Array<keyof typeof WCAG_TAGS>;
        includeSelectors?: string[];
        excludeSelectors?: string[];
    }): Promise<CompleteA11yResult>;
    /**
     * Get all landmarks from the page
     */
    getLandmarks(): Promise<AXQueryResult>;
    /**
     * Get all headings from the page
     */
    getHeadings(): Promise<AXQueryResult>;
    /**
     * Get all focusable elements
     */
    getFocusableElements(): Promise<AXQueryResult>;
    /**
     * Get all interactive elements
     */
    getInteractiveElements(): Promise<AXQueryResult>;
    /**
     * Find elements by ARIA role
     */
    findByRole(role: string): Promise<AXQueryResult>;
    /**
     * Find elements by accessible name
     */
    findByName(name: string, options?: {
        exact?: boolean;
    }): Promise<AXQueryResult>;
    /**
     * Validate a specific ARIA pattern
     */
    validatePattern(pattern: 'dialog' | 'menu' | 'tabs' | 'tree' | 'listbox'): Promise<AXIssue[]>;
    /**
     * Get the accessibility tree as text (screen reader simulation)
     */
    getTreeAsText(): Promise<string>;
    /**
     * Get the accessibility tree as JSON
     */
    getTreeAsJSON(): Promise<string>;
    /**
     * Generate complete accessibility summary
     */
    generateCompleteSummary(): Promise<string>;
    /**
     * Check if page has proper heading structure
     */
    checkHeadingStructure(): Promise<{
        valid: boolean;
        issues: string[];
        outline: string;
    }>;
    /**
     * Check if page has proper landmark structure
     */
    checkLandmarkStructure(): Promise<{
        valid: boolean;
        issues: string[];
        landmarks: Array<{
            role: string;
            name: string;
        }>;
    }>;
    /**
     * Check for elements with missing accessible names
     */
    checkAccessibleNames(): Promise<{
        valid: boolean;
        missingNames: Array<{
            role: string;
            suggestion: string;
        }>;
    }>;
    /**
     * Simulate screen reader reading order
     */
    getReadingOrder(): Promise<string[]>;
}
/**
 * Create accessibility tester for a DesktopTest instance
 */
declare function createA11yTester(test: DesktopTestInstance): A11yTester;

/**
 * @flowsight/desktop-test - Visual Regression Testing
 *
 * Provides screenshot comparison and visual regression detection.
 * Supports baseline management and diff generation.
 */

/**
 * Visual diff result
 */
interface VisualDiffResult {
    match: boolean;
    diffPercentage: number;
    diffPixels: number;
    totalPixels: number;
    baselineExists: boolean;
    screenshotPath: string;
    baselinePath: string;
    diffPath?: string;
}
/**
 * Visual regression options
 */
interface VisualRegressionOptions {
    /** Directory to store baselines */
    baselineDir: string;
    /** Directory to store current screenshots */
    outputDir: string;
    /** Threshold for acceptable diff (0-1) */
    threshold?: number;
    /** Update baselines automatically */
    updateBaselines?: boolean;
    /** Mask areas to ignore */
    maskSelectors?: string[];
}
/**
 * Visual Regression Tester
 */
declare class VisualRegressionTester {
    private test;
    private options;
    constructor(test: DesktopTestInstance, options: VisualRegressionOptions);
    /**
     * Generate a unique name for a screenshot
     */
    private getSnapshotName;
    /**
     * Take a screenshot and compare with baseline
     */
    compareScreenshot(name: string, _options?: {
        selector?: string;
        fullPage?: boolean;
        mask?: string[];
    }): Promise<VisualDiffResult>;
    /**
     * Compare two images using pixel-by-pixel comparison
     */
    private compareImages;
    /**
     * Hash a file for quick comparison
     */
    private hashFile;
    /**
     * Compare full page screenshot
     */
    compareFullPage(name: string): Promise<VisualDiffResult>;
    /**
     * Compare specific element
     */
    compareElement(name: string, selector: string): Promise<VisualDiffResult>;
    /**
     * Update all baselines
     */
    updateAllBaselines(): Promise<void>;
    /**
     * Get list of baselines
     */
    getBaselines(): string[];
    /**
     * Delete a baseline
     */
    deleteBaseline(name: string): boolean;
}
/**
 * Create visual regression tester
 */
declare function createVisualRegressionTester(test: DesktopTestInstance, options: VisualRegressionOptions): VisualRegressionTester;

/**
 * @flowsight/desktop-test - Interaction Testing
 *
 * Provides comprehensive interaction testing capabilities:
 * - Keyboard navigation
 * - Drag and drop
 * - Gestures
 * - Focus management
 * - Responsive testing
 */

/**
 * Keyboard navigation test result
 */
interface KeyboardNavResult {
    success: boolean;
    focusPath: string[];
    missedElements: string[];
    trapDetected: boolean;
    issues: string[];
}
/**
 * Drag operation result
 */
interface DragResult {
    success: boolean;
    startPosition: {
        x: number;
        y: number;
    };
    endPosition: {
        x: number;
        y: number;
    };
    distance: number;
}
/**
 * Responsive test result
 */
interface ResponsiveResult {
    viewport: {
        width: number;
        height: number;
    };
    issues: string[];
    overflowElements: string[];
    hiddenElements: string[];
}
/**
 * Interaction Tester
 */
declare class InteractionTester {
    private test;
    constructor(test: DesktopTestInstance);
    /**
     * Test Tab key navigation through focusable elements
     */
    testTabNavigation(maxTabs?: number): Promise<KeyboardNavResult>;
    /**
     * Test arrow key navigation in a container
     */
    testArrowNavigation(container: string | ElementLocator, direction?: 'horizontal' | 'vertical' | 'both'): Promise<KeyboardNavResult>;
    /**
     * Test Escape key closes modal/dialog
     */
    testEscapeCloses(modalSelector: string): Promise<boolean>;
    /**
     * Perform drag and drop operation
     */
    dragAndDrop(source: string | ElementLocator, target: string | ElementLocator): Promise<DragResult>;
    /**
     * Test panel resize by dragging
     */
    testPanelResize(resizeHandle: string | ElementLocator, deltaX: number, deltaY: number): Promise<{
        success: boolean;
        beforeWidth: number;
        afterWidth: number;
    }>;
    /**
     * Test at different viewport sizes
     */
    testResponsive(viewports: Array<{
        width: number;
        height: number;
        name: string;
    }>): Promise<ResponsiveResult[]>;
    /**
     * Check if focus is visible (focus indicator)
     */
    checkFocusVisible(selector: string): Promise<boolean>;
    /**
     * Test focus order matches visual order
     */
    testFocusOrder(expectedOrder: string[]): Promise<{
        matches: boolean;
        actualOrder: string[];
    }>;
}
/**
 * Common viewport sizes for responsive testing
 */
declare const COMMON_VIEWPORTS: {
    width: number;
    height: number;
    name: string;
}[];
/**
 * Create interaction tester
 */
declare function createInteractionTester(test: DesktopTestInstance): InteractionTester;

/**
 * RefManager - Element Reference Management System
 *
 * Inspired by agent-browser's ref mechanism.
 * Provides stable element references (@e1, @e2, ...) for reliable test automation.
 */

/** Ref format: @e1, @e2, @e3, ... */
type ElementRef = `@e${number}`;
/** Element with ref information */
interface RefElement {
    /** Unique reference like @e1, @e2 */
    ref: ElementRef;
    /** Element role (button, textbox, link, etc.) */
    role: string;
    /** Accessible name */
    name: string;
    /** Element tag name */
    tagName: string;
    /** CSS selector for fallback */
    selector: string;
    /** XPath for fallback */
    xpath: string;
    /** Whether element is visible */
    visible: boolean;
    /** Whether element is enabled */
    enabled: boolean;
    /** Whether element is focusable */
    focusable: boolean;
    /** Bounding box */
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Text content */
    text?: string;
    /** Value (for inputs) */
    value?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Additional attributes */
    attributes: Record<string, string>;
    /** nth index for duplicate elements */
    nthIndex?: number;
}
/** Snapshot result with refs */
interface RefSnapshot {
    /** Timestamp when snapshot was taken */
    timestamp: number;
    /** Page URL */
    url: string;
    /** Page title */
    title: string;
    /** All interactive elements with refs */
    elements: RefElement[];
    /** Raw accessibility tree (optional) */
    rawTree?: unknown;
    /** Snapshot ID for tracking */
    snapshotId: string;
}
/** Snapshot options */
interface SnapshotOptions {
    /** Include only interactive elements (default: true) */
    interactiveOnly?: boolean;
    /** Include hidden elements (default: false) */
    includeHidden?: boolean;
    /** Maximum depth to traverse (default: unlimited) */
    maxDepth?: number;
    /** Include raw accessibility tree (default: false) */
    includeRawTree?: boolean;
    /** Compact mode - less details (default: false) */
    compact?: boolean;
}
/** Ref resolution result */
interface RefResolution {
    /** The resolved element */
    element: RefElement;
    /** How the element was found */
    method: 'ref' | 'selector' | 'xpath' | 'text';
    /** Whether the ref is still valid */
    valid: boolean;
}
/**
 * RefManager - Manages element references for stable test automation
 *
 * @example
 * ```typescript
 * const refManager = new RefManager(test);
 *
 * // Take snapshot and get refs
 * const snapshot = await refManager.snapshot();
 * console.log(snapshot.elements); // [{ref: '@e1', role: 'button', name: 'Submit'}, ...]
 *
 * // Use refs for operations
 * await refManager.click('@e1');
 * await refManager.fill('@e3', 'hello');
 * ```
 */
declare class RefManager {
    private test;
    private currentSnapshot;
    private refMap;
    private snapshotCounter;
    constructor(test: DesktopTest);
    /**
     * Take a snapshot of the page and generate refs for interactive elements
     */
    snapshot(options?: SnapshotOptions): Promise<RefSnapshot>;
    /**
     * Check if a string is a valid ref format
     */
    isRef(value: string): value is ElementRef;
    /**
     * Parse ref to get the index
     */
    parseRef(ref: ElementRef): number;
    /**
     * Get element by ref
     */
    getElement(ref: ElementRef): RefElement | undefined;
    /**
     * Resolve a ref or selector to an element
     */
    resolve(refOrSelector: string): Promise<RefResolution | null>;
    /**
     * Get the locator string for a ref (for use with Playwright/CDP)
     */
    getLocator(ref: ElementRef): Promise<string>;
    /**
     * Click an element by ref
     */
    click(ref: ElementRef): Promise<void>;
    /**
     * Double-click an element by ref
     */
    dblclick(ref: ElementRef): Promise<void>;
    /**
     * Right-click an element by ref
     */
    rightClick(ref: ElementRef): Promise<void>;
    /**
     * Fill an input by ref
     */
    fill(ref: ElementRef, value: string): Promise<void>;
    /**
     * Type text into an element by ref
     */
    type(ref: ElementRef, text: string): Promise<void>;
    /**
     * Hover over an element by ref
     */
    hover(ref: ElementRef): Promise<void>;
    /**
     * Get text from an element by ref
     */
    getText(ref: ElementRef): Promise<string>;
    /**
     * Get value from an element by ref
     */
    getValue(ref: ElementRef): Promise<string>;
    /**
     * Check if element is visible by ref
     */
    isVisible(ref: ElementRef): Promise<boolean>;
    /**
     * Invalidate current snapshot (call after page navigation or significant changes)
     */
    invalidate(): void;
    /**
     * Get current snapshot
     */
    getCurrentSnapshot(): RefSnapshot | null;
    /**
     * Find elements by role
     */
    findByRole(role: string): RefElement[];
    /**
     * Find elements by name (partial match)
     */
    findByName(name: string): RefElement[];
    /**
     * Find elements by text (partial match)
     */
    findByText(text: string): RefElement[];
    /**
     * Get all interactive elements (buttons, links, inputs, etc.)
     */
    getInteractive(): RefElement[];
    /**
     * Format snapshot as text (for AI/LLM consumption)
     */
    toText(options?: {
        includeRefs?: boolean;
        maxElements?: number;
    }): string;
    /**
     * Format snapshot as JSON
     */
    toJSON(): string;
    private collectElements;
    private assignRefs;
    private verifyElement;
}

/**
 * NetworkInterceptor - Network Request Interception and Mocking
 *
 * Inspired by agent-browser's network interception capabilities.
 * Provides request routing, mocking, and recording for testing edge cases.
 */

/** HTTP methods */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
/** Request info */
interface RequestInfo {
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
interface ResponseInfo {
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
interface RecordedRequest extends RequestInfo {
    /** Response info */
    response?: ResponseInfo;
    /** Whether request was mocked */
    mocked: boolean;
    /** Whether request was aborted */
    aborted: boolean;
}
/** Route handler options */
interface RouteOptions {
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
interface RouteDefinition {
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
interface RequestFilterOptions {
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
declare class NetworkInterceptor {
    private test;
    private routes;
    private requests;
    private recording;
    private routeCounter;
    private interceptorSetup;
    constructor(test: DesktopTest);
    /**
     * Add a route to intercept matching requests
     */
    route(pattern: string | RegExp, options?: RouteOptions): Promise<string>;
    /**
     * Remove a route by ID
     */
    removeRoute(routeId: string): boolean;
    /**
     * Remove all routes matching a pattern
     */
    removeRoutesByPattern(pattern: string | RegExp): number;
    /**
     * Clear all routes
     */
    clearRoutes(): void;
    /**
     * Start recording requests
     */
    startRecording(): void;
    /**
     * Stop recording requests
     */
    stopRecording(): RecordedRequest[];
    /**
     * Get recorded requests with optional filtering
     */
    getRequests(filter?: RequestFilterOptions): RecordedRequest[];
    /**
     * Clear recorded requests
     */
    clearRequests(): void;
    /**
     * Wait for a request matching the pattern
     */
    waitForRequest(pattern: string | RegExp, options?: {
        timeout?: number;
        method?: HttpMethod;
    }): Promise<RecordedRequest>;
    /**
     * Wait for a response matching the pattern
     */
    waitForResponse(pattern: string | RegExp, options?: {
        timeout?: number;
        status?: number;
    }): Promise<RecordedRequest>;
    /**
     * Mock a specific API endpoint with predefined responses
     */
    mockApi(endpoint: string, responses: {
        GET?: RouteOptions;
        POST?: RouteOptions;
        PUT?: RouteOptions;
        DELETE?: RouteOptions;
        PATCH?: RouteOptions;
    }): Promise<string[]>;
    /**
     * Simulate network conditions
     */
    simulateNetworkConditions(conditions: {
        offline?: boolean;
        latency?: number;
        downloadThroughput?: number;
        uploadThroughput?: number;
    }): Promise<void>;
    /**
     * Reset network conditions to normal
     */
    resetNetworkConditions(): Promise<void>;
    /**
     * Get all active routes
     */
    getRoutes(): RouteDefinition[];
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
    };
    private setupInterceptor;
    private startRequestPolling;
}

/**
 * FlowTester - Flow Chart / Graph Testing Module
 *
 * Specialized testing for @xyflow/react (React Flow) and similar graph libraries.
 * Provides node, edge, and layout testing capabilities for FlowSight's execution flow view.
 */

/** Node position */
interface Position {
    x: number;
    y: number;
}
/** Node dimensions */
interface Dimensions {
    width: number;
    height: number;
}
/** Flow node information */
interface FlowNode {
    /** Node ID */
    id: string;
    /** Node type */
    type: string;
    /** Node label/title */
    label: string;
    /** Node position */
    position: Position;
    /** Node dimensions */
    dimensions?: Dimensions;
    /** Node data (custom properties) */
    data: Record<string, unknown>;
    /** Whether node is selected */
    selected: boolean;
    /** Whether node is draggable */
    draggable: boolean;
    /** Whether node is visible in viewport */
    visible: boolean;
    /** Parent node ID (for nested nodes) */
    parentId?: string;
    /** CSS classes */
    className?: string;
    /** Node style */
    style?: Record<string, string>;
}
/** Flow edge/connection information */
interface FlowEdge {
    /** Edge ID */
    id: string;
    /** Source node ID */
    source: string;
    /** Target node ID */
    target: string;
    /** Source handle ID */
    sourceHandle?: string;
    /** Target handle ID */
    targetHandle?: string;
    /** Edge type */
    type: string;
    /** Edge label */
    label?: string;
    /** Whether edge is animated */
    animated: boolean;
    /** Whether edge is selected */
    selected: boolean;
    /** Edge data (custom properties) */
    data: Record<string, unknown>;
    /** Edge style */
    style?: Record<string, string>;
}
/** Viewport information */
interface Viewport {
    /** X offset */
    x: number;
    /** Y offset */
    y: number;
    /** Zoom level */
    zoom: number;
}
/** Layout type */
type LayoutType = 'tree' | 'dagre' | 'force' | 'radial' | 'custom';
/** Flow state snapshot */
interface FlowSnapshot {
    /** All nodes */
    nodes: FlowNode[];
    /** All edges */
    edges: FlowEdge[];
    /** Current viewport */
    viewport: Viewport;
    /** Timestamp */
    timestamp: number;
}
/** Node filter options */
interface NodeFilterOptions {
    /** Filter by type */
    type?: string | string[];
    /** Filter by label (partial match) */
    label?: string | RegExp;
    /** Filter by data property */
    data?: Record<string, unknown>;
    /** Only selected nodes */
    selected?: boolean;
    /** Only visible nodes */
    visible?: boolean;
    /** Filter by parent */
    parentId?: string;
}
/** Edge filter options */
interface EdgeFilterOptions {
    /** Filter by source node */
    source?: string;
    /** Filter by target node */
    target?: string;
    /** Filter by type */
    type?: string;
    /** Only animated edges */
    animated?: boolean;
    /** Only selected edges */
    selected?: boolean;
}
/** Layout validation options */
interface LayoutValidationOptions {
    /** Expected layout type */
    type?: LayoutType;
    /** Minimum horizontal spacing */
    minHorizontalSpacing?: number;
    /** Minimum vertical spacing */
    minVerticalSpacing?: number;
    /** Check for overlapping nodes */
    noOverlap?: boolean;
    /** Check nodes are within bounds */
    withinBounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
}
/**
 * FlowTester - Test flow charts and graph visualizations
 *
 * @example
 * ```typescript
 * const flow = new FlowTester(test, '[data-testid="flow-view"]');
 *
 * // Get all nodes
 * const nodes = await flow.getNodes();
 *
 * // Click a node
 * await flow.clickNode('probe');
 *
 * // Verify edge exists
 * await flow.assertEdgeExists('probe', 'usb_register_driver');
 *
 * // Test layout
 * await flow.assertLayout('tree');
 * ```
 */
declare class FlowTester {
    private test;
    private selector;
    private _currentSnapshot;
    constructor(test: DesktopTest, selector?: string);
    /**
     * Get the current snapshot (if available)
     */
    get currentSnapshot(): FlowSnapshot | null;
    /**
     * Take a snapshot of the current flow state
     */
    snapshot(): Promise<FlowSnapshot>;
    /**
     * Get all nodes
     */
    getNodes(filter?: NodeFilterOptions): Promise<FlowNode[]>;
    /**
     * Get a node by ID
     */
    getNode(id: string): Promise<FlowNode | null>;
    /**
     * Get all edges
     */
    getEdges(filter?: EdgeFilterOptions): Promise<FlowEdge[]>;
    /**
     * Get an edge by ID or source-target pair
     */
    getEdge(idOrSource: string, target?: string): Promise<FlowEdge | null>;
    /**
     * Get current viewport
     */
    getViewport(): Promise<Viewport>;
    /**
     * Click on a node
     */
    clickNode(nodeId: string): Promise<void>;
    /**
     * Double-click on a node
     */
    dblclickNode(nodeId: string): Promise<void>;
    /**
     * Hover over a node
     */
    hoverNode(nodeId: string): Promise<void>;
    /**
     * Click on an edge
     */
    clickEdge(edgeId: string): Promise<void>;
    /**
     * Select a node
     */
    selectNode(nodeId: string): Promise<void>;
    /**
     * Select multiple nodes
     */
    selectNodes(nodeIds: string[]): Promise<void>;
    /**
     * Drag a node to a new position
     */
    dragNode(nodeId: string, targetPosition: Position): Promise<void>;
    /**
     * Zoom the viewport
     */
    zoom(level: number): Promise<void>;
    /**
     * Pan the viewport
     */
    pan(deltaX: number, deltaY: number): Promise<void>;
    /**
     * Fit all nodes in view
     */
    fitView(): Promise<void>;
    /**
     * Assert a node exists
     */
    assertNodeExists(nodeId: string, message?: string): Promise<void>;
    /**
     * Assert a node does not exist
     */
    assertNodeNotExists(nodeId: string, message?: string): Promise<void>;
    /**
     * Assert an edge exists between two nodes
     */
    assertEdgeExists(source: string, target: string, message?: string): Promise<void>;
    /**
     * Assert an edge does not exist
     */
    assertEdgeNotExists(source: string, target: string, message?: string): Promise<void>;
    /**
     * Assert node count
     */
    assertNodeCount(expected: number, message?: string): Promise<void>;
    /**
     * Assert edge count
     */
    assertEdgeCount(expected: number, message?: string): Promise<void>;
    /**
     * Assert a node is selected
     */
    assertNodeSelected(nodeId: string, message?: string): Promise<void>;
    /**
     * Assert layout properties
     */
    assertLayout(options: LayoutValidationOptions): Promise<void>;
    /**
     * Get nodes connected to a given node
     */
    getConnectedNodes(nodeId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<FlowNode[]>;
    /**
     * Get the path between two nodes
     */
    getPath(sourceId: string, targetId: string): Promise<string[]>;
    /**
     * Assert a path exists between two nodes
     */
    assertPathExists(sourceId: string, targetId: string, message?: string): Promise<void>;
    private filterNodes;
    private filterEdges;
    private nodesOverlap;
    private detectLayoutType;
}

/**
 * VirtualListTester - Virtual Scrolling / Virtualized List Testing
 *
 * Specialized testing for virtualized lists, trees, and tables.
 * Handles large datasets (2000万+ lines) with virtual scrolling.
 */

/** Virtual list item */
interface VirtualItem {
    /** Item index */
    index: number;
    /** Item ID (if available) */
    id?: string;
    /** Item text content */
    text: string;
    /** Item data attributes */
    data: Record<string, string>;
    /** Bounding rect */
    bounds: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    /** Whether item is visible in viewport */
    visible: boolean;
    /** Whether item is selected */
    selected: boolean;
    /** Item level (for trees) */
    level?: number;
    /** Whether item is expanded (for trees) */
    expanded?: boolean;
    /** Whether item has children (for trees) */
    hasChildren?: boolean;
}
/** Virtual list state */
interface VirtualListState {
    /** Total item count */
    totalCount: number;
    /** Currently rendered item count */
    renderedCount: number;
    /** First visible index */
    startIndex: number;
    /** Last visible index */
    endIndex: number;
    /** Scroll position */
    scrollTop: number;
    /** Scroll height */
    scrollHeight: number;
    /** Client height */
    clientHeight: number;
    /** Average item height */
    avgItemHeight: number;
    /** Visible items */
    visibleItems: VirtualItem[];
}
/** Scroll performance metrics */
interface ScrollPerformance {
    /** Frames per second during scroll */
    fps: number;
    /** Average frame time in ms */
    avgFrameTime: number;
    /** Max frame time (jank indicator) */
    maxFrameTime: number;
    /** Number of dropped frames */
    droppedFrames: number;
    /** Total scroll duration in ms */
    duration: number;
    /** Scroll distance in pixels */
    distance: number;
    /** Items rendered during scroll */
    itemsRendered: number;
}
/** Scroll options */
interface ScrollOptions {
    /** Scroll behavior */
    behavior?: 'auto' | 'smooth';
    /** Block alignment */
    block?: 'start' | 'center' | 'end' | 'nearest';
    /** Timeout for scroll completion */
    timeout?: number;
}
/**
 * VirtualListTester - Test virtualized lists and trees
 *
 * @example
 * ```typescript
 * const list = new VirtualListTester(test, '[data-testid="file-tree"]');
 *
 * // Scroll to item
 * await list.scrollToItem('gpio-brcmstb.c');
 *
 * // Verify item is visible
 * await list.assertItemVisible('gpio-brcmstb.c');
 *
 * // Measure scroll performance
 * const metrics = await list.measureScrollPerformance();
 * assert.greaterThan(metrics.fps, 30);
 * ```
 */
declare class VirtualListTester {
    private test;
    private selector;
    constructor(test: DesktopTest, selector: string);
    /**
     * Get the current state of the virtual list
     */
    getState(): Promise<VirtualListState>;
    /**
     * Get currently visible items
     */
    getVisibleItems(): Promise<VirtualItem[]>;
    /**
     * Get item by index
     */
    getItemByIndex(index: number): Promise<VirtualItem | null>;
    /**
     * Get item by text (partial match)
     */
    getItemByText(text: string): Promise<VirtualItem | null>;
    /**
     * Scroll to a specific index
     */
    scrollToIndex(index: number, options?: ScrollOptions): Promise<void>;
    /**
     * Scroll to an item by text
     */
    scrollToItem(text: string, options?: ScrollOptions): Promise<void>;
    /**
     * Click an item by index
     */
    clickItem(index: number): Promise<void>;
    /**
     * Click an item by text
     */
    clickItemByText(text: string): Promise<void>;
    /**
     * Double-click an item by text
     */
    dblclickItemByText(text: string): Promise<void>;
    /**
     * Expand a tree item
     */
    expandItem(text: string): Promise<void>;
    /**
     * Collapse a tree item
     */
    collapseItem(text: string): Promise<void>;
    /**
     * Measure scroll performance
     */
    measureScrollPerformance(options?: {
        scrollDistance?: number;
        duration?: number;
    }): Promise<ScrollPerformance>;
    /**
     * Assert item is visible
     */
    assertItemVisible(text: string, message?: string): Promise<void>;
    /**
     * Assert item count
     */
    assertItemCount(expected: number, message?: string): Promise<void>;
    /**
     * Assert minimum item count
     */
    assertMinItemCount(min: number, message?: string): Promise<void>;
    /**
     * Assert item is selected
     */
    assertItemSelected(text: string, message?: string): Promise<void>;
    /**
     * Assert item is expanded (for trees)
     */
    assertItemExpanded(text: string, message?: string): Promise<void>;
    /**
     * Assert scroll performance meets threshold
     */
    assertScrollPerformance(options: {
        minFps?: number;
        maxFrameTime?: number;
        maxDroppedFrames?: number;
    }): Promise<void>;
    /**
     * Scroll to top
     */
    scrollToTop(): Promise<void>;
    /**
     * Scroll to bottom
     */
    scrollToBottom(): Promise<void>;
}

/**
 * SessionManager - Multi-Session Parallel Testing
 *
 * Inspired by agent-browser's session management.
 * Enables running multiple test sessions in parallel with isolation.
 */

/** Session state */
type SessionState = 'created' | 'active' | 'paused' | 'closed';
/** Session info */
interface SessionInfo {
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
interface SessionOptions {
    /** Session name */
    name?: string;
    /** Initial URL */
    url?: string;
    /** Browser context options */
    contextOptions?: {
        /** Viewport size */
        viewport?: {
            width: number;
            height: number;
        };
        /** User agent */
        userAgent?: string;
        /** Locale */
        locale?: string;
        /** Timezone */
        timezone?: string;
        /** Geolocation */
        geolocation?: {
            latitude: number;
            longitude: number;
        };
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
interface StorageState {
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
declare class SessionManager {
    private sessions;
    private activeSessionId;
    private sessionCounter;
    private createTestFn;
    constructor(createTestFn: (options?: SessionOptions) => Promise<DesktopTest>);
    /**
     * Create a new session
     */
    create(nameOrOptions?: string | SessionOptions): Promise<Session>;
    /**
     * Get session by ID or name
     */
    get(idOrName: string): Session | undefined;
    /**
     * Get the active session
     */
    getActive(): Session | undefined;
    /**
     * Switch to a different session
     */
    switch(idOrName: string): Promise<Session>;
    /**
     * List all sessions
     */
    list(): SessionInfo[];
    /**
     * Close a session
     */
    close(idOrName: string): Promise<void>;
    /**
     * Close all sessions
     */
    closeAll(): Promise<void>;
    /**
     * Run a function in parallel across multiple sessions
     */
    parallel<T>(fn: (session: Session) => Promise<T>, options?: {
        filter?: (session: Session) => boolean;
    }): Promise<Map<string, T>>;
    /**
     * Run a function sequentially across sessions
     */
    sequential<T>(fn: (session: Session) => Promise<T>, options?: {
        filter?: (session: Session) => boolean;
    }): Promise<Map<string, T>>;
    /**
     * Get session count
     */
    get count(): number;
    /**
     * Get active session count
     */
    get activeCount(): number;
    private handleSessionClose;
}
/**
 * Session - Individual test session
 */
declare class Session {
    private _info;
    private _test;
    private _options;
    private onClose;
    constructor(config: {
        id: string;
        name: string;
        test: DesktopTest;
        options: SessionOptions;
        onClose: () => void;
    });
    /**
     * Get session info
     */
    get info(): SessionInfo;
    /**
     * Get session options
     */
    get options(): SessionOptions;
    /**
     * Get test instance
     */
    get test(): DesktopTest;
    /**
     * Activate this session
     */
    activate(): void;
    /**
     * Pause this session
     */
    pause(): void;
    /**
     * Close this session
     */
    close(): Promise<void>;
    /**
     * Save session storage state
     */
    saveState(filePath?: string): Promise<StorageState>;
    /**
     * Load session storage state
     */
    loadState(state: StorageState): Promise<void>;
    /**
     * Set session metadata
     */
    setMetadata(key: string, value: unknown): void;
    /**
     * Get session metadata
     */
    getMetadata<T = unknown>(key: string): T | undefined;
    private updateActivity;
}

/**
 * Visualizer - Test Execution Flow Visualization
 *
 * Inspired by UI-TARS Visualizer.
 * Generates visual reports of test execution for debugging and review.
 */
/** Test step type */
type StepType = 'action' | 'assertion' | 'navigation' | 'wait' | 'screenshot' | 'error' | 'info';
/** Test step status */
type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
/** Test step */
interface TestStep {
    /** Step ID */
    id: string;
    /** Step type */
    type: StepType;
    /** Step description */
    description: string;
    /** Step status */
    status: StepStatus;
    /** Start timestamp */
    startTime: number;
    /** End timestamp */
    endTime?: number;
    /** Duration in ms */
    duration?: number;
    /** Screenshot path (if captured) */
    screenshot?: string;
    /** Screenshot base64 data */
    screenshotData?: string;
    /** Error message (if failed) */
    error?: string;
    /** Error stack trace */
    stackTrace?: string;
    /** Step metadata */
    metadata?: Record<string, unknown>;
    /** Parent step ID (for nested steps) */
    parentId?: string;
    /** Child step IDs */
    childIds?: string[];
}
/** Test run info */
interface TestRunInfo {
    /** Test run ID */
    id: string;
    /** Test name */
    name: string;
    /** Test file */
    file?: string;
    /** Start timestamp */
    startTime: number;
    /** End timestamp */
    endTime?: number;
    /** Duration in ms */
    duration?: number;
    /** Test status */
    status: 'running' | 'passed' | 'failed' | 'skipped';
    /** All steps */
    steps: TestStep[];
    /** Environment info */
    environment?: {
        os: string;
        browser: string;
        viewport: {
            width: number;
            height: number;
        };
    };
    /** Error count */
    errorCount: number;
    /** Warning count */
    warningCount: number;
}
/** Visualizer options */
interface VisualizerOptions {
    /** Auto-capture screenshots on steps */
    autoScreenshot?: boolean;
    /** Screenshot on failure only */
    screenshotOnFailure?: boolean;
    /** Include stack traces */
    includeStackTrace?: boolean;
    /** Output directory */
    outputDir?: string;
    /** Report filename */
    reportFilename?: string;
}
/**
 * Visualizer - Create visual test execution reports
 *
 * @example
 * ```typescript
 * const visualizer = new Visualizer({ outputDir: './reports' });
 *
 * visualizer.startRun('Login Test');
 *
 * const step1 = visualizer.startStep('action', 'Click login button');
 * await test.click('#login');
 * visualizer.endStep(step1, 'passed');
 *
 * visualizer.endRun();
 * await visualizer.generateReport('./reports/login-test.html');
 * ```
 */
declare class Visualizer {
    private options;
    private currentRun;
    private runs;
    private stepCounter;
    constructor(options?: VisualizerOptions);
    /**
     * Start a new test run
     */
    startRun(name: string, file?: string): TestRunInfo;
    /**
     * End the current test run
     */
    endRun(status?: 'passed' | 'failed' | 'skipped'): TestRunInfo | null;
    /**
     * Start a new step
     */
    startStep(type: StepType, description: string, metadata?: Record<string, unknown>): string;
    /**
     * End a step
     */
    endStep(stepId: string, status: StepStatus, options?: {
        error?: string;
        screenshot?: string;
        screenshotData?: string;
    }): void;
    /**
     * Add a step that already completed
     */
    addStep(step: Partial<TestStep>): void;
    /**
     * Add a screenshot to the current run
     */
    addScreenshot(screenshotData: string, description?: string): void;
    /**
     * Add an info message
     */
    addInfo(message: string, metadata?: Record<string, unknown>): void;
    /**
     * Add an error
     */
    addError(error: Error | string, description?: string): void;
    /**
     * Get current run
     */
    getCurrentRun(): TestRunInfo | null;
    /**
     * Get all runs
     */
    getAllRuns(): TestRunInfo[];
    /**
     * Generate HTML report
     */
    generateReport(outputPath?: string): Promise<string>;
    /**
     * Export to YAML format
     */
    exportYAML(): string;
    /**
     * Export to JSON format
     */
    exportJSON(): string;
    /**
     * Clear all runs
     */
    clear(): void;
    private generateHTML;
    private renderTestRun;
    private formatDuration;
    private toYAML;
}

/**
 * MonacoTester - Monaco Editor Testing Module
 *
 * Specialized testing for Monaco Editor integration.
 * Supports syntax highlighting, code navigation, completions, and more.
 */

/** Cursor position */
interface CursorPosition {
    lineNumber: number;
    column: number;
}
/** Selection range */
interface SelectionRange {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}
/** Token info */
interface TokenInfo {
    /** Token text */
    text: string;
    /** Token type/scope */
    type: string;
    /** Start column */
    startColumn: number;
    /** End column */
    endColumn: number;
    /** Foreground color */
    foreground?: string;
    /** Font style (bold, italic) */
    fontStyle?: string;
}
/** Completion item */
interface CompletionItem {
    /** Label */
    label: string;
    /** Kind (function, variable, etc.) */
    kind: string;
    /** Detail */
    detail?: string;
    /** Documentation */
    documentation?: string;
    /** Insert text */
    insertText?: string;
}
/** Diagnostic (error/warning) */
interface Diagnostic {
    /** Severity (error, warning, info, hint) */
    severity: 'error' | 'warning' | 'info' | 'hint';
    /** Message */
    message: string;
    /** Start line */
    startLineNumber: number;
    /** Start column */
    startColumn: number;
    /** End line */
    endLineNumber: number;
    /** End column */
    endColumn: number;
    /** Source */
    source?: string;
    /** Code */
    code?: string;
}
/** Editor state */
interface EditorState {
    /** Current content */
    content: string;
    /** Line count */
    lineCount: number;
    /** Current cursor position */
    cursor: CursorPosition;
    /** Current selection */
    selection: SelectionRange | null;
    /** Language ID */
    language: string;
    /** Is read-only */
    readOnly: boolean;
    /** Has focus */
    hasFocus: boolean;
    /** Visible line range */
    visibleRange: {
        startLine: number;
        endLine: number;
    };
}
/**
 * MonacoTester - Test Monaco Editor functionality
 *
 * @example
 * ```typescript
 * const editor = new MonacoTester(test, '[data-testid="code-editor"]');
 *
 * // Set content
 * await editor.setValue('int main() { return 0; }');
 *
 * // Navigate
 * await editor.goToLine(10);
 *
 * // Test syntax highlighting
 * const tokens = await editor.getTokensAtLine(1);
 * await editor.assertTokenType(1, 'int', 'keyword');
 *
 * // Test code completion
 * await editor.triggerCompletion();
 * await editor.selectCompletion('printf');
 * ```
 */
declare class MonacoTester {
    private test;
    private selector;
    constructor(test: DesktopTest, selector?: string);
    /**
     * Get the current editor state
     */
    getState(): Promise<EditorState>;
    /**
     * Get editor content
     */
    getValue(): Promise<string>;
    /**
     * Set editor content
     */
    setValue(content: string): Promise<void>;
    /**
     * Insert text at current position
     */
    insertText(text: string): Promise<void>;
    /**
     * Get line content
     */
    getLineContent(lineNumber: number): Promise<string>;
    /**
     * Go to a specific line
     */
    goToLine(lineNumber: number, column?: number): Promise<void>;
    /**
     * Set cursor position
     */
    setCursor(lineNumber: number, column: number): Promise<void>;
    /**
     * Get cursor position
     */
    getCursor(): Promise<CursorPosition>;
    /**
     * Select text range
     */
    select(range: SelectionRange): Promise<void>;
    /**
     * Select all
     */
    selectAll(): Promise<void>;
    /**
     * Get tokens at a specific line
     */
    getTokensAtLine(lineNumber: number): Promise<TokenInfo[]>;
    /**
     * Trigger code completion
     */
    triggerCompletion(): Promise<void>;
    /**
     * Get completion suggestions
     */
    getCompletions(): Promise<CompletionItem[]>;
    /**
     * Select a completion item
     */
    selectCompletion(label: string): Promise<void>;
    /**
     * Go to definition
     */
    goToDefinition(): Promise<void>;
    /**
     * Find all references
     */
    findReferences(): Promise<void>;
    /**
     * Get diagnostics (errors, warnings)
     */
    getDiagnostics(): Promise<Diagnostic[]>;
    /**
     * Focus the editor
     */
    focus(): Promise<void>;
    /**
     * Execute an editor action
     */
    executeAction(actionId: string): Promise<void>;
    /**
     * Undo
     */
    undo(): Promise<void>;
    /**
     * Redo
     */
    redo(): Promise<void>;
    /**
     * Format document
     */
    format(): Promise<void>;
    /**
     * Toggle comment
     */
    toggleComment(): Promise<void>;
    /**
     * Assert content equals
     */
    assertContent(expected: string, message?: string): Promise<void>;
    /**
     * Assert content contains
     */
    assertContains(text: string, message?: string): Promise<void>;
    /**
     * Assert token type at position
     */
    assertTokenType(lineNumber: number, tokenText: string, expectedType: string, message?: string): Promise<void>;
    /**
     * Assert no errors
     */
    assertNoErrors(message?: string): Promise<void>;
    /**
     * Assert cursor position
     */
    assertCursor(lineNumber: number, column: number, message?: string): Promise<void>;
}

/**
 * TauriDialogTester - Tauri Native Dialog Testing
 *
 * Test native file dialogs, message boxes, and system notifications
 * in Tauri applications.
 */

/** Dialog type */
type DialogType = 'open' | 'save' | 'message' | 'confirm' | 'directory';
/** File filter */
interface FileFilter {
    /** Filter name */
    name: string;
    /** Extensions (e.g., ['txt', 'md']) */
    extensions: string[];
}
/** Dialog options */
interface DialogOptions {
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
interface DialogResult {
    /** Whether dialog was cancelled */
    cancelled: boolean;
    /** Selected file path(s) */
    filePaths?: string[];
    /** For message dialogs, the button clicked */
    response?: number;
}
/** Mock dialog configuration */
interface MockDialogConfig {
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
interface DialogInvocation {
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
declare class TauriDialogTester {
    private test;
    private mocks;
    private _invocations;
    private setupDone;
    constructor(test: DesktopTest);
    /**
     * Get cached invocations (call getInvocations() for fresh data)
     */
    get cachedInvocations(): DialogInvocation[];
    /**
     * Setup dialog interception
     */
    setup(): Promise<void>;
    /**
     * Mock the file open dialog
     */
    mockOpen(config: MockDialogConfig): Promise<void>;
    /**
     * Mock the file save dialog
     */
    mockSave(config: MockDialogConfig): Promise<void>;
    /**
     * Mock the message dialog
     */
    mockMessage(config: MockDialogConfig): Promise<void>;
    /**
     * Mock the confirm dialog
     */
    mockConfirm(config: MockDialogConfig): Promise<void>;
    /**
     * Mock the directory picker
     */
    mockDirectory(config: MockDialogConfig): Promise<void>;
    /**
     * Clear all mocks
     */
    clearMocks(): Promise<void>;
    /**
     * Get all dialog invocations
     */
    getInvocations(): Promise<DialogInvocation[]>;
    /**
     * Get invocations by type
     */
    getInvocationsByType(type: DialogType): Promise<DialogInvocation[]>;
    /**
     * Clear invocation history
     */
    clearInvocations(): Promise<void>;
    /**
     * Wait for a dialog to be opened
     */
    waitForDialog(type: DialogType, timeout?: number): Promise<DialogInvocation>;
    /**
     * Expect an open dialog to be called
     */
    expectOpen(): Promise<DialogInvocation>;
    /**
     * Expect a save dialog to be called
     */
    expectSave(): Promise<DialogInvocation>;
    /**
     * Expect a confirm dialog to be called
     */
    expectConfirm(): Promise<DialogInvocation>;
    /**
     * Expect a directory picker to be called
     */
    expectDirectory(): Promise<DialogInvocation>;
    /**
     * Assert that a dialog was called
     */
    assertDialogCalled(type: DialogType, message?: string): Promise<void>;
    /**
     * Assert that a dialog was called with specific options
     */
    assertDialogCalledWith(type: DialogType, expectedOptions: Partial<DialogOptions>, message?: string): Promise<void>;
    /**
     * Assert dialog count
     */
    assertDialogCount(type: DialogType, expected: number, message?: string): Promise<void>;
    /**
     * Simulate selecting files in open dialog (for manual testing)
     */
    selectFiles(filePaths: string[]): Promise<void>;
    /**
     * Simulate cancelling a dialog (for manual testing)
     */
    cancel(): Promise<void>;
}

/**
 * Benchmark - Performance Testing Module
 *
 * Measure and assert performance metrics including timing,
 * memory usage, and resource consumption.
 */

/** Timing measurement */
interface TimingMeasurement {
    /** Measurement name */
    name: string;
    /** Start timestamp */
    startTime: number;
    /** End timestamp */
    endTime: number;
    /** Duration in milliseconds */
    duration: number;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/** Memory measurement */
interface MemoryMeasurement {
    /** Used JS heap size */
    usedJSHeapSize: number;
    /** Total JS heap size */
    totalJSHeapSize: number;
    /** JS heap size limit */
    jsHeapSizeLimit: number;
    /** Timestamp */
    timestamp: number;
}
/** Performance entry */
interface PerformanceEntry {
    /** Entry name */
    name: string;
    /** Entry type */
    entryType: string;
    /** Start time */
    startTime: number;
    /** Duration */
    duration: number;
}
/** Resource timing */
interface ResourceTiming extends PerformanceEntry {
    /** Initiator type */
    initiatorType: string;
    /** Transfer size */
    transferSize: number;
    /** Encoded body size */
    encodedBodySize: number;
    /** Decoded body size */
    decodedBodySize: number;
}
/** Performance report */
interface PerformanceReport {
    /** Test name */
    testName: string;
    /** All timing measurements */
    timings: TimingMeasurement[];
    /** Memory snapshots */
    memory: MemoryMeasurement[];
    /** Resource timings */
    resources: ResourceTiming[];
    /** Long tasks (>50ms) */
    longTasks: PerformanceEntry[];
    /** Summary statistics */
    summary: {
        totalDuration: number;
        avgTiming: number;
        maxTiming: number;
        minTiming: number;
        peakMemory: number;
        avgMemory: number;
        resourceCount: number;
        totalTransferSize: number;
    };
}
/** Threshold configuration */
interface ThresholdConfig {
    /** Maximum duration in ms */
    maxDuration?: number;
    /** Maximum memory in bytes */
    maxMemory?: number;
    /** Maximum resource count */
    maxResourceCount?: number;
    /** Maximum transfer size in bytes */
    maxTransferSize?: number;
}
/**
 * Benchmark - Performance testing and measurement
 *
 * @example
 * ```typescript
 * const benchmark = new Benchmark(test, 'Index Project Test');
 *
 * // Measure operation
 * await benchmark.measure('open-dialog', async () => {
 *   await test.click('[data-testid="open-project"]');
 * });
 *
 * await benchmark.measure('index-files', async () => {
 *   await test.waitFor('[data-testid="index-complete"]');
 * });
 *
 * // Assert performance
 * benchmark.assertDuration('index-files', { maxDuration: 5000 });
 *
 * // Generate report
 * const report = benchmark.generateReport();
 * ```
 */
declare class Benchmark {
    private test;
    private testName;
    private timings;
    private memorySnapshots;
    private activeMeasurements;
    constructor(test: DesktopTest, testName?: string);
    /**
     * Measure the duration of an operation
     */
    measure<T>(name: string, fn: () => Promise<T>): Promise<T>;
    /**
     * Start a named timing measurement
     */
    startTiming(name: string): void;
    /**
     * End a named timing measurement
     */
    endTiming(name: string, metadata?: Record<string, unknown>): TimingMeasurement;
    /**
     * Get timing by name
     */
    getTiming(name: string): TimingMeasurement | undefined;
    /**
     * Get all timings
     */
    getTimings(): TimingMeasurement[];
    /**
     * Measure memory usage
     */
    measureMemory(): Promise<MemoryMeasurement>;
    /**
     * Get memory snapshots
     */
    getMemorySnapshots(): MemoryMeasurement[];
    /**
     * Get performance entries from the browser
     */
    getPerformanceEntries(type?: string): Promise<PerformanceEntry[]>;
    /**
     * Get resource timing entries
     */
    getResourceTimings(): Promise<ResourceTiming[]>;
    /**
     * Get long tasks (>50ms)
     */
    getLongTasks(): Promise<PerformanceEntry[]>;
    /**
     * Clear all measurements
     */
    clear(): void;
    /**
     * Clear browser performance entries
     */
    clearBrowserEntries(): Promise<void>;
    /**
     * Assert duration is within threshold
     */
    assertDuration(name: string, thresholds: ThresholdConfig): void;
    /**
     * Assert memory is within threshold
     */
    assertMemory(thresholds: ThresholdConfig): void;
    /**
     * Assert all thresholds
     */
    assertThresholds(thresholds: ThresholdConfig): Promise<void>;
    /**
     * Generate performance report
     */
    generateReport(): Promise<PerformanceReport>;
    /**
     * Export report as JSON
     */
    exportJSON(): Promise<string>;
    /**
     * Compare with baseline
     */
    compareWithBaseline(baseline: PerformanceReport, tolerance?: number): Promise<{
        passed: boolean;
        differences: Array<{
            metric: string;
            baseline: number;
            current: number;
            diff: number;
            diffPercent: number;
        }>;
    }>;
    private formatBytes;
}

/**
 * StreamServer - Real-time Test Execution Preview
 *
 * Inspired by agent-browser's streaming capabilities.
 * Provides WebSocket-based real-time preview of test execution.
 */

/** Stream frame */
interface StreamFrame {
    /** Frame type */
    type: 'screenshot' | 'dom' | 'event';
    /** Frame data (base64 for screenshots) */
    data: string;
    /** Frame timestamp */
    timestamp: number;
    /** Frame dimensions */
    dimensions?: {
        width: number;
        height: number;
    };
    /** Frame metadata */
    metadata?: Record<string, unknown>;
}
/** Stream options */
interface StreamOptions {
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
interface InputEvent {
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
interface StreamStats {
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
interface ClientInfo {
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
declare class StreamServer {
    private test;
    private options;
    private running;
    private startTime;
    private frameCount;
    private bytesSent;
    private clients;
    private frameInterval;
    private frameTimes;
    private onFrameCallback?;
    private onInputCallback?;
    constructor(test: DesktopTest);
    /**
     * Start the stream server
     */
    start(options?: StreamOptions): Promise<void>;
    /**
     * Stop the stream server
     */
    stop(): Promise<void>;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
    /**
     * Get stream statistics
     */
    getStats(): StreamStats;
    /**
     * Get connected clients
     */
    getClients(): ClientInfo[];
    /**
     * Set frame rate
     */
    setFrameRate(fps: number): void;
    /**
     * Set image quality
     */
    setQuality(quality: number): void;
    /**
     * Set image format
     */
    setFormat(format: 'jpeg' | 'png'): void;
    /**
     * Register frame callback (for testing/debugging)
     */
    onFrame(callback: (frame: StreamFrame) => void): void;
    /**
     * Register input callback (for testing/debugging)
     */
    onInput(callback: (event: InputEvent) => void): void;
    /**
     * Simulate client connection (for testing)
     */
    simulateClientConnect(clientId: string, address?: string): void;
    /**
     * Simulate client disconnect (for testing)
     */
    simulateClientDisconnect(clientId: string): void;
    /**
     * Simulate input event from client (for testing)
     */
    handleInputEvent(event: InputEvent): Promise<void>;
    /**
     * Capture current frame
     */
    captureFrame(): Promise<StreamFrame>;
    private captureAndSendFrame;
    private broadcastFrame;
}

/**
 * TimelineTester - Timeline/Gantt Chart Testing Module
 *
 * Specialized testing for timeline components and async event visualization.
 * Useful for testing FlowSight's async execution timeline feature.
 */

/** Timeline event */
interface TimelineEvent {
    /** Event ID */
    id: string;
    /** Event name/label */
    name: string;
    /** Event type/category */
    type: string;
    /** Start time (ms from timeline start) */
    startTime: number;
    /** End time (ms from timeline start) */
    endTime?: number;
    /** Duration (ms) */
    duration?: number;
    /** Event color */
    color?: string;
    /** Whether event is selected */
    selected: boolean;
    /** Event lane/row */
    lane?: number;
    /** Event data */
    data?: Record<string, unknown>;
    /** Parent event ID (for hierarchical events) */
    parentId?: string;
    /** Child event IDs */
    childIds?: string[];
}
/** Timeline state */
interface TimelineState {
    /** All events */
    events: TimelineEvent[];
    /** Visible time range */
    visibleRange: {
        start: number;
        end: number;
    };
    /** Total time range */
    totalRange: {
        start: number;
        end: number;
    };
    /** Current zoom level */
    zoom: number;
    /** Current scroll position */
    scrollPosition: number;
    /** Number of lanes */
    laneCount: number;
    /** Selected event IDs */
    selectedIds: string[];
    /** Playhead position (if playing) */
    playheadPosition?: number;
    /** Is timeline playing */
    isPlaying: boolean;
}
/** Timeline filter options */
interface TimelineFilterOptions {
    /** Filter by type */
    type?: string | string[];
    /** Filter by name (partial match) */
    name?: string | RegExp;
    /** Filter by time range */
    timeRange?: {
        start?: number;
        end?: number;
    };
    /** Filter by lane */
    lane?: number;
    /** Only selected events */
    selected?: boolean;
    /** Only events with duration */
    withDuration?: boolean;
}
/**
 * TimelineTester - Test timeline and async visualization components
 *
 * @example
 * ```typescript
 * const timeline = new TimelineTester(test, '[data-testid="async-timeline"]');
 *
 * // Get events
 * const events = await timeline.getEvents();
 *
 * // Click an event
 * await timeline.clickEvent('workqueue');
 *
 * // Verify event order
 * await timeline.assertEventOrder(['irq', 'workqueue', 'callback']);
 *
 * // Zoom to range
 * await timeline.zoomToRange(100, 500);
 * ```
 */
declare class TimelineTester {
    private test;
    private selector;
    constructor(test: DesktopTest, selector?: string);
    /**
     * Get the current timeline state
     */
    getState(): Promise<TimelineState>;
    /**
     * Get all events
     */
    getEvents(filter?: TimelineFilterOptions): Promise<TimelineEvent[]>;
    /**
     * Get event by ID
     */
    getEvent(id: string): Promise<TimelineEvent | null>;
    /**
     * Get events by name (partial match)
     */
    getEventsByName(name: string): Promise<TimelineEvent[]>;
    /**
     * Get events by type
     */
    getEventsByType(type: string): Promise<TimelineEvent[]>;
    /**
     * Click on an event
     */
    clickEvent(idOrName: string): Promise<void>;
    /**
     * Double-click on an event
     */
    dblclickEvent(idOrName: string): Promise<void>;
    /**
     * Hover over an event
     */
    hoverEvent(idOrName: string): Promise<void>;
    /**
     * Zoom to a specific range
     */
    zoomToRange(start: number, end: number): Promise<void>;
    /**
     * Zoom in
     */
    zoomIn(): Promise<void>;
    /**
     * Zoom out
     */
    zoomOut(): Promise<void>;
    /**
     * Fit all events in view
     */
    fitAll(): Promise<void>;
    /**
     * Scroll to a specific time position
     */
    scrollToTime(time: number): Promise<void>;
    /**
     * Play timeline (if supported)
     */
    play(): Promise<void>;
    /**
     * Pause timeline
     */
    pause(): Promise<void>;
    /**
     * Assert event exists
     */
    assertEventExists(idOrName: string, message?: string): Promise<void>;
    /**
     * Assert event order
     */
    assertEventOrder(expectedOrder: string[], message?: string): Promise<void>;
    /**
     * Assert concurrent events
     */
    assertConcurrentEvents(eventNames: string[], message?: string): Promise<void>;
    /**
     * Assert time range
     */
    assertTimeRange(expectedStart: number, expectedEnd: number, message?: string): Promise<void>;
    /**
     * Assert event count
     */
    assertEventCount(expected: number, message?: string): Promise<void>;
    /**
     * Assert event is selected
     */
    assertEventSelected(idOrName: string, message?: string): Promise<void>;
    private filterEvents;
}

export { type A11yResult, A11yTester, type A11yViolation, ARIA_ROLES, type AXIssue, type AXNode, type AXProperty, type AXQueryResult, type AccessibilityTree, AccessibilityTreeManager, Benchmark, COMMON_VIEWPORTS, type ClientInfo, type CompletionItem, type CursorPosition, DesktopTest, type Diagnostic, type DialogInvocation, type DialogOptions, type DialogResult, type DialogType, type DragResult, type EdgeFilterOptions, type EditorState, type ElementRef, type FileFilter, type FlowEdge, type FlowNode, type FlowSnapshot, FlowTester, type HttpMethod, type InputEvent, InteractionTester, type KeyboardNavResult, type LayoutType, type LayoutValidationOptions, type MemoryMeasurement, type MockDialogConfig, MonacoTester, NetworkInterceptor, type NodeFilterOptions, type PerformanceEntry, type PerformanceReport, type RecordedRequest, type RefElement, RefManager, type RefResolution, type RefSnapshot, type RequestFilterOptions, type RequestInfo, type ResourceTiming, type ResponseInfo, type ResponsiveResult, type RouteDefinition, type RouteOptions, type ScrollOptions, type ScrollPerformance, type SelectionRange, Session, type SessionInfo, SessionManager, type SessionOptions, type SessionState, type SnapshotOptions, type StepStatus, type StepType, type StorageState, type StreamFrame, type StreamOptions, StreamServer, type StreamStats, TauriDialogTester, type TestRunInfo, type TestStep, type ThresholdConfig, type TimelineEvent, type TimelineFilterOptions, type TimelineState, TimelineTester, type TimingMeasurement, type TokenInfo, type Viewport, type ViolationImpact, type VirtualItem, type VirtualListState, VirtualListTester, type VisualDiffResult, type VisualRegressionOptions, VisualRegressionTester, Visualizer, type VisualizerOptions, WCAG_TAGS, createA11yTester, createAccessibilityTreeManager, createInteractionTester, createVisualRegressionTester };
