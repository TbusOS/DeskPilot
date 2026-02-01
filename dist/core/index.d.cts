export { a as AssertionError, A as Assertions, D as DesktopTest, T as TestRunner, b as TestRunnerOptions, c as createDesktopTest } from '../assertions-nzK8eHT2.cjs';
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

export { type A11yResult, A11yTester, type A11yViolation, ARIA_ROLES, type AXIssue, type AXNode, type AXProperty, type AXQueryResult, type AccessibilityTree, AccessibilityTreeManager, COMMON_VIEWPORTS, type DragResult, InteractionTester, type KeyboardNavResult, type ResponsiveResult, type ViolationImpact, type VisualDiffResult, type VisualRegressionOptions, VisualRegressionTester, WCAG_TAGS, createA11yTester, createAccessibilityTreeManager, createInteractionTester, createVisualRegressionTester };
