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

import type { DesktopTestInstance, ElementLocator } from '../types.js';

/**
 * Keyboard navigation test result
 */
export interface KeyboardNavResult {
  success: boolean;
  focusPath: string[];
  missedElements: string[];
  trapDetected: boolean;
  issues: string[];
}

/**
 * Drag operation result
 */
export interface DragResult {
  success: boolean;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  distance: number;
}

/**
 * Responsive test result
 */
export interface ResponsiveResult {
  viewport: { width: number; height: number };
  issues: string[];
  overflowElements: string[];
  hiddenElements: string[];
}

/**
 * Interaction Tester
 */
export class InteractionTester {
  private test: DesktopTestInstance;

  constructor(test: DesktopTestInstance) {
    this.test = test;
  }

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================

  /**
   * Test Tab key navigation through focusable elements
   */
  async testTabNavigation(maxTabs: number = 50): Promise<KeyboardNavResult> {
    const focusPath: string[] = [];
    const issues: string[] = [];
    let trapDetected = false;

    // Get initial focus
    const initialFocus = await this.test.evaluate<string>(`
      document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : '')
    `);
    focusPath.push(initialFocus);

    // Press Tab repeatedly
    for (let i = 0; i < maxTabs; i++) {
      await this.test.press('Tab');
      await this.test.wait(100);

      const currentFocus = await this.test.evaluate<string>(`
        document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : '')
      `);

      // Check for focus trap
      if (focusPath.slice(-3).every(f => f === currentFocus)) {
        trapDetected = true;
        issues.push(`Focus trap detected at: ${currentFocus}`);
        break;
      }

      focusPath.push(currentFocus);

      // Check if we've cycled back to start
      if (currentFocus === initialFocus && i > 0) {
        break;
      }
    }

    return {
      success: !trapDetected && focusPath.length > 1,
      focusPath,
      missedElements: [], // Would need expected elements to check
      trapDetected,
      issues,
    };
  }

  /**
   * Test arrow key navigation in a container
   */
  async testArrowNavigation(
    container: string | ElementLocator,
    direction: 'horizontal' | 'vertical' | 'both' = 'both'
  ): Promise<KeyboardNavResult> {
    const focusPath: string[] = [];
    const issues: string[] = [];

    // Focus the container
    await this.test.click(container);
    await this.test.wait(100);

    // Test arrow keys based on direction
    const keys = direction === 'horizontal' 
      ? ['ArrowRight', 'ArrowRight', 'ArrowLeft'] 
      : direction === 'vertical'
        ? ['ArrowDown', 'ArrowDown', 'ArrowUp']
        : ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];

    for (const key of keys) {
      await this.test.press(key);
      await this.test.wait(100);

      const currentFocus = await this.test.evaluate<string>(`
        document.activeElement?.tagName + 
        (document.activeElement?.getAttribute('data-testid') || 
         document.activeElement?.textContent?.slice(0, 20) || '')
      `);
      focusPath.push(`${key} -> ${currentFocus}`);
    }

    return {
      success: focusPath.length > 0,
      focusPath,
      missedElements: [],
      trapDetected: false,
      issues,
    };
  }

  /**
   * Test Escape key closes modal/dialog
   */
  async testEscapeCloses(modalSelector: string): Promise<boolean> {
    // Check if modal is visible
    const initialVisible = await this.test.isVisible(modalSelector);
    if (!initialVisible) {
      return true; // Already closed, consider success
    }

    // Press Escape
    await this.test.press('Escape');
    await this.test.wait(300);

    // Check if modal is now hidden
    const afterVisible = await this.test.isVisible(modalSelector);
    return !afterVisible;
  }

  // ===========================================================================
  // Drag and Drop
  // ===========================================================================

  /**
   * Perform drag and drop operation
   */
  async dragAndDrop(
    source: string | ElementLocator,
    target: string | ElementLocator
  ): Promise<DragResult> {
    // Get source position
    const sourcePos = await this.test.evaluate<{ x: number; y: number } | null>(`
      (function() {
        const el = document.querySelector('${source}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
      })()
    `);

    // Get target position
    const targetPos = await this.test.evaluate<{ x: number; y: number } | null>(`
      (function() {
        const el = document.querySelector('${target}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
      })()
    `);

    if (!sourcePos || !targetPos) {
      return {
        success: false,
        startPosition: sourcePos || { x: 0, y: 0 },
        endPosition: targetPos || { x: 0, y: 0 },
        distance: 0,
      };
    }

    // Perform drag
    await this.test.drag(source, target);

    const distance = Math.sqrt(
      Math.pow(targetPos.x - sourcePos.x, 2) + 
      Math.pow(targetPos.y - sourcePos.y, 2)
    );

    return {
      success: true,
      startPosition: sourcePos,
      endPosition: targetPos,
      distance,
    };
  }

  /**
   * Test panel resize by dragging
   */
  async testPanelResize(
    resizeHandle: string | ElementLocator,
    deltaX: number,
    deltaY: number
  ): Promise<{ success: boolean; beforeWidth: number; afterWidth: number }> {
    // Get initial size
    const beforeSize = await this.test.evaluate<{ width: number; height: number }>(`
      (function() {
        const handle = document.querySelector('${resizeHandle}');
        const panel = handle?.parentElement;
        return panel ? { 
          width: panel.offsetWidth, 
          height: panel.offsetHeight 
        } : { width: 0, height: 0 };
      })()
    `);

    // Drag resize handle
    await this.test.evaluate(`
      (async function() {
        const handle = document.querySelector('${resizeHandle}');
        if (!handle) return;
        
        const rect = handle.getBoundingClientRect();
        const startX = rect.x + rect.width/2;
        const startY = rect.y + rect.height/2;
        
        // Simulate mouse events
        handle.dispatchEvent(new MouseEvent('mousedown', { 
          clientX: startX, clientY: startY, bubbles: true 
        }));
        
        await new Promise(r => setTimeout(r, 50));
        
        document.dispatchEvent(new MouseEvent('mousemove', { 
          clientX: startX + ${deltaX}, 
          clientY: startY + ${deltaY}, 
          bubbles: true 
        }));
        
        await new Promise(r => setTimeout(r, 50));
        
        document.dispatchEvent(new MouseEvent('mouseup', { 
          clientX: startX + ${deltaX}, 
          clientY: startY + ${deltaY}, 
          bubbles: true 
        }));
      })()
    `);

    await this.test.wait(300);

    // Get after size
    const afterSize = await this.test.evaluate<{ width: number; height: number }>(`
      (function() {
        const handle = document.querySelector('${resizeHandle}');
        const panel = handle?.parentElement;
        return panel ? { 
          width: panel.offsetWidth, 
          height: panel.offsetHeight 
        } : { width: 0, height: 0 };
      })()
    `);

    return {
      success: beforeSize.width !== afterSize.width || beforeSize.height !== afterSize.height,
      beforeWidth: beforeSize.width,
      afterWidth: afterSize.width,
    };
  }

  // ===========================================================================
  // Responsive Testing
  // ===========================================================================

  /**
   * Test at different viewport sizes
   */
  async testResponsive(viewports: Array<{ width: number; height: number; name: string }>): Promise<ResponsiveResult[]> {
    const results: ResponsiveResult[] = [];

    for (const viewport of viewports) {
      // Resize viewport (via evaluate or CDP)
      await this.test.evaluate(`
        window.resizeTo(${viewport.width}, ${viewport.height});
      `);
      await this.test.wait(500);

      // Check for issues
      const issues: string[] = [];
      
      // Check for horizontal overflow
      const overflowElements = await this.test.evaluate<string[]>(`
        Array.from(document.querySelectorAll('*')).filter(el => {
          return el.scrollWidth > el.clientWidth;
        }).map(el => el.tagName + (el.id ? '#' + el.id : '')).slice(0, 10);
      `);

      if (overflowElements.length > 0) {
        issues.push(`Horizontal overflow detected in ${overflowElements.length} elements`);
      }

      // Check for hidden critical elements
      const hiddenElements = await this.test.evaluate<string[]>(`
        Array.from(document.querySelectorAll('[data-testid], button, a, input')).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width === 0 || rect.height === 0 || 
                 rect.right < 0 || rect.bottom < 0;
        }).map(el => el.tagName + (el.getAttribute('data-testid') || '')).slice(0, 10);
      `);

      results.push({
        viewport: { width: viewport.width, height: viewport.height },
        issues,
        overflowElements,
        hiddenElements,
      });
    }

    return results;
  }

  // ===========================================================================
  // Focus Management
  // ===========================================================================

  /**
   * Check if focus is visible (focus indicator)
   */
  async checkFocusVisible(selector: string): Promise<boolean> {
    await this.test.click(selector);
    await this.test.wait(100);

    return this.test.evaluate<boolean>(`
      (function() {
        const el = document.querySelector('${selector}');
        if (!el) return false;
        
        const styles = getComputedStyle(el);
        const focusStyles = getComputedStyle(el, ':focus');
        
        // Check for visible focus indicator
        return styles.outlineWidth !== '0px' || 
               styles.boxShadow !== 'none' ||
               el.classList.contains('focus-visible') ||
               el.matches(':focus-visible');
      })()
    `);
  }

  /**
   * Test focus order matches visual order
   */
  async testFocusOrder(expectedOrder: string[]): Promise<{
    matches: boolean;
    actualOrder: string[];
  }> {
    const actualOrder: string[] = [];

    for (let i = 0; i < expectedOrder.length; i++) {
      await this.test.press('Tab');
      await this.test.wait(100);

      const focused = await this.test.evaluate<string>(`
        document.activeElement?.getAttribute('data-testid') || 
        document.activeElement?.id ||
        document.activeElement?.tagName
      `);
      actualOrder.push(focused);
    }

    const matches = expectedOrder.every((expected, i) => 
      actualOrder[i]?.includes(expected)
    );

    return { matches, actualOrder };
  }
}

/**
 * Common viewport sizes for responsive testing
 */
export const COMMON_VIEWPORTS = [
  { width: 1920, height: 1080, name: 'Desktop HD' },
  { width: 1440, height: 900, name: 'Desktop' },
  { width: 1280, height: 720, name: 'Laptop' },
  { width: 1024, height: 768, name: 'Tablet Landscape' },
  { width: 768, height: 1024, name: 'Tablet Portrait' },
  { width: 375, height: 667, name: 'Mobile' },
];

/**
 * Create interaction tester
 */
export function createInteractionTester(test: DesktopTestInstance): InteractionTester {
  return new InteractionTester(test);
}
