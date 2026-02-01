/**
 * RefManager - Element Reference Management System
 * 
 * Inspired by agent-browser's ref mechanism.
 * Provides stable element references (@e1, @e2, ...) for reliable test automation.
 */

import type { DesktopTest } from './desktop-test';

/** Ref format: @e1, @e2, @e3, ... */
export type ElementRef = `@e${number}`;

/** Element with ref information */
export interface RefElement {
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
export interface RefSnapshot {
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
export interface SnapshotOptions {
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
export interface RefResolution {
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
export class RefManager {
  private test: DesktopTest;
  private currentSnapshot: RefSnapshot | null = null;
  private refMap: Map<ElementRef, RefElement> = new Map();
  private snapshotCounter = 0;

  constructor(test: DesktopTest) {
    this.test = test;
  }

  /**
   * Take a snapshot of the page and generate refs for interactive elements
   */
  async snapshot(options: SnapshotOptions = {}): Promise<RefSnapshot> {
    const {
      interactiveOnly = true,
      includeHidden = false,
      maxDepth,
      includeRawTree = false,
      compact = false
    } = options;

    // Get page info
    const url = await this.test.getUrl();
    const title = await this.test.getTitle();

    // Get elements via accessibility tree or DOM
    const elements = await this.collectElements({
      interactiveOnly,
      includeHidden,
      maxDepth
    });

    // Generate refs for elements
    const refElements = this.assignRefs(elements, compact);

    // Create snapshot
    const snapshot: RefSnapshot = {
      timestamp: Date.now(),
      url,
      title,
      elements: refElements,
      snapshotId: `snapshot-${++this.snapshotCounter}`
    };

    if (includeRawTree) {
      try {
        const rawSnapshot = await this.test.snapshot();
        snapshot.rawTree = rawSnapshot;
      } catch {
        // Ignore if raw snapshot fails
      }
    }

    // Update current snapshot and ref map
    this.currentSnapshot = snapshot;
    this.refMap.clear();
    for (const element of refElements) {
      this.refMap.set(element.ref, element);
    }

    return snapshot;
  }

  /**
   * Check if a string is a valid ref format
   */
  isRef(value: string): value is ElementRef {
    return /^@e\d+$/.test(value);
  }

  /**
   * Parse ref to get the index
   */
  parseRef(ref: ElementRef): number {
    const match = ref.match(/^@e(\d+)$/);
    if (!match) {
      throw new Error(`Invalid ref format: ${ref}`);
    }
    return parseInt(match[1], 10);
  }

  /**
   * Get element by ref
   */
  getElement(ref: ElementRef): RefElement | undefined {
    return this.refMap.get(ref);
  }

  /**
   * Resolve a ref or selector to an element
   */
  async resolve(refOrSelector: string): Promise<RefResolution | null> {
    // If it's a ref, look up in current snapshot
    if (this.isRef(refOrSelector)) {
      const element = this.refMap.get(refOrSelector);
      if (element) {
        // Verify element still exists
        const exists = await this.verifyElement(element);
        return {
          element,
          method: 'ref',
          valid: exists
        };
      }
      return null;
    }

    // Otherwise, find by selector
    const elements = await this.collectElements({ interactiveOnly: false, includeHidden: true });
    const found = elements.find(e => 
      e.selector === refOrSelector ||
      e.xpath === refOrSelector ||
      e.text === refOrSelector ||
      e.name === refOrSelector
    );

    if (found) {
      const refElement = this.assignRefs([found], false)[0];
      return {
        element: refElement,
        method: 'selector',
        valid: true
      };
    }

    return null;
  }

  /**
   * Get the locator string for a ref (for use with Playwright/CDP)
   */
  async getLocator(ref: ElementRef): Promise<string> {
    const element = this.refMap.get(ref);
    if (!element) {
      throw new Error(`Ref not found: ${ref}. Did you take a snapshot first?`);
    }

    // Prefer role-based locator
    if (element.role && element.name) {
      return `role=${element.role}[name="${element.name}"]`;
    }

    // Fall back to test-id
    if (element.attributes['data-testid']) {
      return `[data-testid="${element.attributes['data-testid']}"]`;
    }

    // Fall back to CSS selector
    return element.selector;
  }

  /**
   * Click an element by ref
   */
  async click(ref: ElementRef): Promise<void> {
    const locator = await this.getLocator(ref);
    await this.test.click(locator);
  }

  /**
   * Double-click an element by ref
   */
  async dblclick(ref: ElementRef): Promise<void> {
    const locator = await this.getLocator(ref);
    await this.test.dblclick(locator);
  }

  /**
   * Right-click an element by ref
   */
  async rightClick(ref: ElementRef): Promise<void> {
    const locator = await this.getLocator(ref);
    await this.test.rightClick(locator);
  }

  /**
   * Fill an input by ref
   */
  async fill(ref: ElementRef, value: string): Promise<void> {
    const locator = await this.getLocator(ref);
    await this.test.fill(locator, value);
  }

  /**
   * Type text into an element by ref
   */
  async type(ref: ElementRef, text: string): Promise<void> {
    const locator = await this.getLocator(ref);
    await this.test.type(locator, text);
  }

  /**
   * Hover over an element by ref
   */
  async hover(ref: ElementRef): Promise<void> {
    const locator = await this.getLocator(ref);
    await this.test.hover(locator);
  }

  /**
   * Get text from an element by ref
   */
  async getText(ref: ElementRef): Promise<string> {
    const locator = await this.getLocator(ref);
    return this.test.getText(locator);
  }

  /**
   * Get value from an element by ref
   */
  async getValue(ref: ElementRef): Promise<string> {
    const locator = await this.getLocator(ref);
    return this.test.getValue(locator);
  }

  /**
   * Check if element is visible by ref
   */
  async isVisible(ref: ElementRef): Promise<boolean> {
    const locator = await this.getLocator(ref);
    return this.test.isVisible(locator);
  }

  /**
   * Invalidate current snapshot (call after page navigation or significant changes)
   */
  invalidate(): void {
    this.currentSnapshot = null;
    this.refMap.clear();
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): RefSnapshot | null {
    return this.currentSnapshot;
  }

  /**
   * Find elements by role
   */
  findByRole(role: string): RefElement[] {
    return Array.from(this.refMap.values()).filter(e => e.role === role);
  }

  /**
   * Find elements by name (partial match)
   */
  findByName(name: string): RefElement[] {
    const lowerName = name.toLowerCase();
    return Array.from(this.refMap.values()).filter(e => 
      e.name.toLowerCase().includes(lowerName)
    );
  }

  /**
   * Find elements by text (partial match)
   */
  findByText(text: string): RefElement[] {
    const lowerText = text.toLowerCase();
    return Array.from(this.refMap.values()).filter(e => 
      e.text?.toLowerCase().includes(lowerText)
    );
  }

  /**
   * Get all interactive elements (buttons, links, inputs, etc.)
   */
  getInteractive(): RefElement[] {
    const interactiveRoles = new Set([
      'button', 'link', 'textbox', 'checkbox', 'radio',
      'combobox', 'listbox', 'option', 'menuitem', 'tab',
      'slider', 'spinbutton', 'switch', 'searchbox'
    ]);
    return Array.from(this.refMap.values()).filter(e => 
      interactiveRoles.has(e.role) || e.focusable
    );
  }

  /**
   * Format snapshot as text (for AI/LLM consumption)
   */
  toText(options: { includeRefs?: boolean; maxElements?: number } = {}): string {
    const { includeRefs = true, maxElements = 100 } = options;
    
    if (!this.currentSnapshot) {
      return 'No snapshot available. Call snapshot() first.';
    }

    const lines: string[] = [
      `Page: ${this.currentSnapshot.title}`,
      `URL: ${this.currentSnapshot.url}`,
      `Elements (${this.currentSnapshot.elements.length}):`,
      ''
    ];

    const elements = this.currentSnapshot.elements.slice(0, maxElements);
    for (const element of elements) {
      const ref = includeRefs ? `${element.ref} ` : '';
      const name = element.name ? ` "${element.name}"` : '';
      const text = element.text && element.text !== element.name ? ` [${element.text.slice(0, 50)}]` : '';
      lines.push(`  ${ref}${element.role}${name}${text}`);
    }

    if (this.currentSnapshot.elements.length > maxElements) {
      lines.push(`  ... and ${this.currentSnapshot.elements.length - maxElements} more`);
    }

    return lines.join('\n');
  }

  /**
   * Format snapshot as JSON
   */
  toJSON(): string {
    if (!this.currentSnapshot) {
      return '{}';
    }
    return JSON.stringify(this.currentSnapshot, null, 2);
  }

  // Private methods

  private async collectElements(options: {
    interactiveOnly: boolean;
    includeHidden: boolean;
    maxDepth?: number;
  }): Promise<Partial<RefElement>[]> {
    const { interactiveOnly, includeHidden } = options;

    // Use evaluate to collect elements from the page
    const elements = await this.test.evaluate(`
      (() => {
        const interactiveRoles = new Set([
          'button', 'link', 'textbox', 'checkbox', 'radio',
          'combobox', 'listbox', 'option', 'menuitem', 'menuitemcheckbox',
          'menuitemradio', 'tab', 'tabpanel', 'slider', 'spinbutton',
          'switch', 'searchbox', 'treeitem', 'gridcell'
        ]);
        
        const interactiveTags = new Set([
          'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
          'DETAILS', 'SUMMARY'
        ]);
        
        const elements = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          const el = node;
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const isInteractive = interactiveRoles.has(role) || 
                               interactiveTags.has(el.tagName) ||
                               el.hasAttribute('onclick') ||
                               el.hasAttribute('tabindex');
          
          if (${interactiveOnly} && !isInteractive) continue;
          
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                           getComputedStyle(el).visibility !== 'hidden' &&
                           getComputedStyle(el).display !== 'none';
          
          if (!${includeHidden} && !isVisible) continue;
          
          const name = el.getAttribute('aria-label') ||
                      el.getAttribute('title') ||
                      el.getAttribute('alt') ||
                      (el.tagName === 'INPUT' ? el.placeholder : '') ||
                      '';
          
          elements.push({
            role: role,
            name: name,
            tagName: el.tagName.toLowerCase(),
            selector: generateSelector(el),
            xpath: generateXPath(el),
            visible: isVisible,
            enabled: !el.disabled,
            focusable: el.tabIndex >= 0 || isInteractive,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            text: el.textContent?.trim().slice(0, 100) || '',
            value: el.value || '',
            placeholder: el.placeholder || '',
            attributes: {
              id: el.id || '',
              class: el.className || '',
              'data-testid': el.getAttribute('data-testid') || '',
              href: el.getAttribute('href') || '',
              type: el.getAttribute('type') || ''
            }
          });
        }
        
        function generateSelector(el) {
          if (el.id) return '#' + el.id;
          if (el.getAttribute('data-testid')) 
            return '[data-testid="' + el.getAttribute('data-testid') + '"]';
          
          let selector = el.tagName.toLowerCase();
          if (el.className) {
            const classes = el.className.split(' ').filter(c => c && !c.includes(':'));
            if (classes.length > 0) {
              selector += '.' + classes.slice(0, 2).join('.');
            }
          }
          return selector;
        }
        
        function generateXPath(el) {
          const parts = [];
          let current = el;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = current.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && 
                  sibling.tagName === current.tagName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
            current = current.parentNode;
          }
          return '/' + parts.join('/');
        }
        
        return elements;
      })()
    `);

    return elements as Partial<RefElement>[];
  }

  private assignRefs(elements: Partial<RefElement>[], compact: boolean): RefElement[] {
    const result: RefElement[] = [];
    const roleCount: Map<string, number> = new Map();

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const role = element.role || 'generic';
      
      // Track nth index for duplicate roles
      const count = roleCount.get(role) || 0;
      roleCount.set(role, count + 1);

      const refElement: RefElement = {
        ref: `@e${i + 1}` as ElementRef,
        role,
        name: element.name || '',
        tagName: element.tagName || 'div',
        selector: element.selector || '',
        xpath: element.xpath || '',
        visible: element.visible ?? true,
        enabled: element.enabled ?? true,
        focusable: element.focusable ?? false,
        attributes: element.attributes || {},
        nthIndex: count > 0 ? count : undefined
      };

      if (!compact) {
        refElement.bounds = element.bounds;
        refElement.text = element.text;
        refElement.value = element.value;
        refElement.placeholder = element.placeholder;
      }

      result.push(refElement);
    }

    return result;
  }

  private async verifyElement(element: RefElement): Promise<boolean> {
    try {
      const exists = await this.test.isVisible(element.selector);
      return exists;
    } catch {
      return false;
    }
  }
}

export default RefManager;
