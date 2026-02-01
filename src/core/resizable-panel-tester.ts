/**
 * ResizablePanelTester - Test resizable panels and dividers
 * 
 * Tests drag-to-resize functionality for IDE panels like:
 * - File explorer width
 * - Right panel width
 * - Bottom panel height
 * - Split view dividers
 */

import type { DesktopTest } from './desktop-test';

/** Panel direction */
export type PanelDirection = 'horizontal' | 'vertical';

/** Panel resize options */
export interface PanelResizeOptions {
  /** Animation duration to wait (ms) */
  animationDuration?: number;
  /** Minimum allowed size */
  minSize?: number;
  /** Maximum allowed size */
  maxSize?: number;
}

/** Panel state */
export interface PanelState {
  /** Current width (for horizontal) */
  width: number;
  /** Current height (for vertical) */
  height: number;
  /** Is panel open/visible */
  isOpen: boolean;
  /** Is panel collapsed */
  isCollapsed: boolean;
  /** Panel direction */
  direction: PanelDirection;
  /** Computed min size */
  minSize?: number;
  /** Computed max size */
  maxSize?: number;
}

/** Resize result */
export interface ResizeResult {
  /** Previous size */
  previousSize: number;
  /** New size */
  newSize: number;
  /** Size change */
  delta: number;
  /** Was resize successful */
  success: boolean;
  /** Was clamped to min/max */
  wasClamped: boolean;
}

/**
 * ResizablePanelTester - Test resizable panel behavior
 * 
 * @example
 * ```typescript
 * const panel = new ResizablePanelTester(test, '[data-testid="left-panel"]');
 * 
 * // Get current state
 * const state = await panel.getState();
 * console.log(`Width: ${state.width}px`);
 * 
 * // Resize to specific size
 * await panel.resizeTo(300);
 * 
 * // Resize by dragging
 * await panel.drag(50); // Increase by 50px
 * await panel.drag(-30); // Decrease by 30px
 * 
 * // Test constraints
 * await panel.assertMinSize(200);
 * await panel.assertMaxSize(500);
 * 
 * // Toggle
 * await panel.collapse();
 * await panel.expand();
 * ```
 */
export class ResizablePanelTester {
  private test: DesktopTest;
  private selector: string;
  private dividerSelector?: string;
  private direction: PanelDirection;
  private options: PanelResizeOptions;

  constructor(
    test: DesktopTest,
    selector: string,
    options: {
      dividerSelector?: string;
      direction?: PanelDirection;
    } & PanelResizeOptions = {}
  ) {
    this.test = test;
    this.selector = selector;
    this.dividerSelector = options.dividerSelector;
    this.direction = options.direction || 'horizontal';
    this.options = {
      animationDuration: options.animationDuration || 300,
      minSize: options.minSize,
      maxSize: options.maxSize
    };
  }

  /**
   * Get current panel state
   */
  async getState(): Promise<PanelState> {
    const result = await this.test.evaluate(`
      (() => {
        const panel = document.querySelector('${this.selector}');
        if (!panel) return null;
        
        const rect = panel.getBoundingClientRect();
        const style = getComputedStyle(panel);
        
        return {
          width: rect.width,
          height: rect.height,
          isOpen: rect.width > 0 && rect.height > 0,
          isCollapsed: rect.width === 0 || rect.height === 0,
          direction: '${this.direction}',
          minSize: parseInt(style.minWidth) || parseInt(style.minHeight) || undefined,
          maxSize: parseInt(style.maxWidth) || parseInt(style.maxHeight) || undefined
        };
      })()
    `) as PanelState | null;

    if (!result) {
      throw new Error(`Panel not found: ${this.selector}`);
    }

    return result;
  }

  /**
   * Resize panel to specific size
   */
  async resizeTo(size: number): Promise<ResizeResult> {
    const state = await this.getState();
    const currentSize = this.direction === 'horizontal' ? state.width : state.height;
    const delta = size - currentSize;

    return this.drag(delta);
  }

  /**
   * Resize panel by dragging the divider
   */
  async drag(delta: number): Promise<ResizeResult> {
    const state = await this.getState();
    const currentSize = this.direction === 'horizontal' ? state.width : state.height;

    // Find the divider
    const dividerSelector = this.dividerSelector || this.findDividerSelector();
    
    // Get divider position
    const dividerPos = await this.test.evaluate(`
      (() => {
        const divider = document.querySelector('${dividerSelector}');
        if (!divider) return null;
        const rect = divider.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      })()
    `) as { x: number; y: number } | null;

    if (!dividerPos) {
      // If no divider, try direct style manipulation
      await this.test.evaluate(`
        (() => {
          const panel = document.querySelector('${this.selector}');
          if (!panel) return;
          
          if ('${this.direction}' === 'horizontal') {
            panel.style.width = '${currentSize + delta}px';
          } else {
            panel.style.height = '${currentSize + delta}px';
          }
        })()
      `);
    } else {
      // Simulate drag
      const startX = dividerPos.x;
      const startY = dividerPos.y;
      const endX = this.direction === 'horizontal' ? startX + delta : startX;
      const endY = this.direction === 'vertical' ? startY + delta : startY;

      // Use CDP to perform mouse drag
      await this.test.evaluate(`
        (() => {
          const divider = document.querySelector('${dividerSelector}');
          if (!divider) return;
          
          // Dispatch mouse events
          divider.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            clientX: ${startX},
            clientY: ${startY}
          }));
          
          document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: ${endX},
            clientY: ${endY}
          }));
          
          document.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            clientX: ${endX},
            clientY: ${endY}
          }));
        })()
      `);
    }

    // Wait for animation
    await new Promise(r => setTimeout(r, this.options.animationDuration));

    // Get new state
    const newState = await this.getState();
    const newSize = this.direction === 'horizontal' ? newState.width : newState.height;
    const actualDelta = newSize - currentSize;

    return {
      previousSize: currentSize,
      newSize,
      delta: actualDelta,
      success: Math.abs(actualDelta) > 0,
      wasClamped: Math.abs(actualDelta - delta) > 1
    };
  }

  /**
   * Collapse the panel
   */
  async collapse(): Promise<void> {
    const state = await this.getState();
    if (state.isCollapsed) return;

    // Try to find collapse button
    const hasButton = await this.test.evaluate(`
      (() => {
        const panel = document.querySelector('${this.selector}');
        if (!panel) return false;
        const button = panel.querySelector('[data-collapse], [aria-label*="collapse"], [aria-label*="隐藏"]');
        if (button) {
          button.click();
          return true;
        }
        return false;
      })()
    `) as boolean;

    if (!hasButton) {
      // Direct resize to 0
      await this.resizeTo(0);
    }

    await new Promise(r => setTimeout(r, this.options.animationDuration));
  }

  /**
   * Expand the panel
   */
  async expand(size?: number): Promise<void> {
    const state = await this.getState();
    if (!state.isCollapsed && state.isOpen) return;

    // Try to find expand button
    const hasButton = await this.test.evaluate(`
      (() => {
        const panel = document.querySelector('${this.selector}');
        const parent = panel?.parentElement;
        const button = parent?.querySelector('[data-expand], [aria-label*="expand"], [aria-label*="显示"]');
        if (button) {
          button.click();
          return true;
        }
        return false;
      })()
    `) as boolean;

    if (!hasButton && size) {
      await this.resizeTo(size);
    }

    await new Promise(r => setTimeout(r, this.options.animationDuration));
  }

  /**
   * Toggle panel open/closed
   */
  async toggle(): Promise<void> {
    const state = await this.getState();
    if (state.isOpen) {
      await this.collapse();
    } else {
      await this.expand();
    }
  }

  /**
   * Assert panel size
   */
  async assertSize(expectedSize: number, tolerance = 5): Promise<void> {
    const state = await this.getState();
    const actualSize = this.direction === 'horizontal' ? state.width : state.height;
    
    if (Math.abs(actualSize - expectedSize) > tolerance) {
      throw new Error(
        `Panel size assertion failed: expected ${expectedSize}±${tolerance}, got ${actualSize}`
      );
    }
  }

  /**
   * Assert minimum size constraint
   */
  async assertMinSize(minSize: number): Promise<void> {
    // Try to resize below min
    const state = await this.getState();
    const currentSize = this.direction === 'horizontal' ? state.width : state.height;
    
    await this.resizeTo(minSize - 50);
    
    const newState = await this.getState();
    const newSize = this.direction === 'horizontal' ? newState.width : newState.height;
    
    if (newSize < minSize - 5) {
      throw new Error(
        `Min size constraint not enforced: expected >= ${minSize}, got ${newSize}`
      );
    }

    // Restore
    await this.resizeTo(currentSize);
  }

  /**
   * Assert maximum size constraint
   */
  async assertMaxSize(maxSize: number): Promise<void> {
    // Try to resize above max
    const state = await this.getState();
    const currentSize = this.direction === 'horizontal' ? state.width : state.height;
    
    await this.resizeTo(maxSize + 100);
    
    const newState = await this.getState();
    const newSize = this.direction === 'horizontal' ? newState.width : newState.height;
    
    if (newSize > maxSize + 5) {
      throw new Error(
        `Max size constraint not enforced: expected <= ${maxSize}, got ${newSize}`
      );
    }

    // Restore
    await this.resizeTo(currentSize);
  }

  /**
   * Assert panel is open/visible
   */
  async assertOpen(): Promise<void> {
    const state = await this.getState();
    if (!state.isOpen) {
      throw new Error('Panel is not open');
    }
  }

  /**
   * Assert panel is collapsed/hidden
   */
  async assertCollapsed(): Promise<void> {
    const state = await this.getState();
    if (!state.isCollapsed) {
      throw new Error('Panel is not collapsed');
    }
  }

  /**
   * Measure resize performance
   */
  async measureResizePerformance(iterations = 10): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    fps: number;
  }> {
    const times: number[] = [];
    const state = await this.getState();
    const baseSize = this.direction === 'horizontal' ? state.width : state.height;

    for (let i = 0; i < iterations; i++) {
      const delta = i % 2 === 0 ? 50 : -50;
      const start = Date.now();
      await this.drag(delta);
      times.push(Date.now() - start);
    }

    // Restore original size
    await this.resizeTo(baseSize);

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      averageTime: avg,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      fps: 1000 / avg
    };
  }

  // Private methods

  private findDividerSelector(): string {
    // Try common divider patterns
    const patterns = [
      `${this.selector} + [class*="divider"]`,
      `${this.selector} + [class*="resize"]`,
      `${this.selector} > [class*="divider"]:last-child`,
      `${this.selector} ~ [class*="divider"]`,
      '[data-resize-handle]',
      '.resize-handle',
      '.divider'
    ];

    return patterns[0];
  }
}

/**
 * Create a resizable panel tester for horizontal panels (width)
 */
export function createHorizontalPanelTester(
  test: DesktopTest,
  selector: string,
  options?: PanelResizeOptions
): ResizablePanelTester {
  return new ResizablePanelTester(test, selector, { ...options, direction: 'horizontal' });
}

/**
 * Create a resizable panel tester for vertical panels (height)
 */
export function createVerticalPanelTester(
  test: DesktopTest,
  selector: string,
  options?: PanelResizeOptions
): ResizablePanelTester {
  return new ResizablePanelTester(test, selector, { ...options, direction: 'vertical' });
}

export default ResizablePanelTester;
