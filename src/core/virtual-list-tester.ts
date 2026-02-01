/**
 * VirtualListTester - Virtual Scrolling / Virtualized List Testing
 * 
 * Specialized testing for virtualized lists, trees, and tables.
 * Handles large datasets (2000万+ lines) with virtual scrolling.
 */

import type { DesktopTest } from './desktop-test';

/** Virtual list item */
export interface VirtualItem {
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
export interface VirtualListState {
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
export interface ScrollPerformance {
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
export interface ScrollOptions {
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
export class VirtualListTester {
  private test: DesktopTest;
  private selector: string;

  constructor(test: DesktopTest, selector: string) {
    this.test = test;
    this.selector = selector;
  }

  /**
   * Get the current state of the virtual list
   */
  async getState(): Promise<VirtualListState> {
    const state = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Find the scrollable element
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        
        // Get all rendered items
        const itemSelector = '[data-index], [data-key], [role="treeitem"], [role="row"], [role="listitem"]';
        const items = Array.from(scrollEl.querySelectorAll(itemSelector));
        
        // Calculate indices
        const indices = items.map(el => {
          const idx = el.getAttribute('data-index');
          return idx ? parseInt(idx, 10) : -1;
        }).filter(i => i >= 0);
        
        const startIndex = indices.length > 0 ? Math.min(...indices) : 0;
        const endIndex = indices.length > 0 ? Math.max(...indices) : 0;
        
        // Estimate total count
        let totalCount = 0;
        const totalAttr = scrollEl.getAttribute('data-total-count') ||
                         container.getAttribute('data-total-count');
        if (totalAttr) {
          totalCount = parseInt(totalAttr, 10);
        } else {
          // Estimate from scroll height
          const avgHeight = items.length > 0 
            ? items.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) / items.length
            : 30;
          totalCount = Math.ceil(scrollEl.scrollHeight / avgHeight);
        }
        
        // Get visible items
        const containerRect = scrollEl.getBoundingClientRect();
        const visibleItems = items.map((el, i) => {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.top < containerRect.bottom && rect.bottom > containerRect.top;
          
          return {
            index: indices[i] >= 0 ? indices[i] : i,
            id: el.getAttribute('data-id') || el.getAttribute('data-key') || undefined,
            text: el.textContent?.trim().slice(0, 200) || '',
            data: {
              ...Object.fromEntries(
                Array.from(el.attributes)
                  .filter(a => a.name.startsWith('data-'))
                  .map(a => [a.name, a.value])
              )
            },
            bounds: {
              top: rect.top - containerRect.top,
              left: rect.left - containerRect.left,
              width: rect.width,
              height: rect.height
            },
            visible: isVisible,
            selected: el.classList.contains('selected') || el.getAttribute('aria-selected') === 'true',
            level: el.getAttribute('aria-level') ? parseInt(el.getAttribute('aria-level'), 10) : undefined,
            expanded: el.getAttribute('aria-expanded') === 'true',
            hasChildren: el.querySelector('[role="group"]') !== null || 
                        el.getAttribute('aria-expanded') !== null
          };
        });
        
        return {
          totalCount,
          renderedCount: items.length,
          startIndex,
          endIndex,
          scrollTop: scrollEl.scrollTop,
          scrollHeight: scrollEl.scrollHeight,
          clientHeight: scrollEl.clientHeight,
          avgItemHeight: items.length > 0 
            ? items.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) / items.length
            : 30,
          visibleItems
        };
      })()
    `) as VirtualListState | null;

    if (!state) {
      throw new Error(`Virtual list not found: ${this.selector}`);
    }

    return state;
  }

  /**
   * Get currently visible items
   */
  async getVisibleItems(): Promise<VirtualItem[]> {
    const state = await this.getState();
    return state.visibleItems.filter(item => item.visible);
  }

  /**
   * Get item by index
   */
  async getItemByIndex(index: number): Promise<VirtualItem | null> {
    // First scroll to make item visible
    await this.scrollToIndex(index);
    
    const state = await this.getState();
    return state.visibleItems.find(item => item.index === index) || null;
  }

  /**
   * Get item by text (partial match)
   */
  async getItemByText(text: string): Promise<VirtualItem | null> {
    const state = await this.getState();
    const lowerText = text.toLowerCase();
    return state.visibleItems.find(item => 
      item.text.toLowerCase().includes(lowerText)
    ) || null;
  }

  /**
   * Scroll to a specific index
   */
  async scrollToIndex(index: number, options: ScrollOptions = {}): Promise<void> {
    const { behavior = 'auto', timeout = 5000 } = options;

    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        
        // Estimate scroll position
        const items = scrollEl.querySelectorAll('[data-index], [role="treeitem"], [role="row"]');
        const avgHeight = items.length > 0 
          ? Array.from(items).reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) / items.length
          : 30;
        
        const targetTop = ${index} * avgHeight;
        scrollEl.scrollTo({
          top: targetTop,
          behavior: '${behavior}'
        });
      })()
    `);

    // Wait for scroll to complete
    if (behavior === 'smooth') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Verify item is now in view
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const state = await this.getState();
      if (index >= state.startIndex && index <= state.endIndex) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Scroll to an item by text
   */
  async scrollToItem(text: string, options: ScrollOptions = {}): Promise<void> {
    const { timeout = 10000 } = options;
    const startTime = Date.now();

    // Incremental scroll through the list
    while (Date.now() - startTime < timeout) {
      // Check if item is already visible
      const visibleItem = await this.getItemByText(text);
      if (visibleItem) {
        return;
      }

      // Scroll through the list incrementally
      const state = await this.getState();
      const nextIndex = Math.min(state.endIndex + 20, state.totalCount - 1);
      
      if (nextIndex <= state.endIndex) {
        // Reached the end, item not found
        throw new Error(`Item not found: "${text}"`);
      }

      await this.scrollToIndex(nextIndex);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout scrolling to item: "${text}"`);
  }

  /**
   * Click an item by index
   */
  async clickItem(index: number): Promise<void> {
    await this.scrollToIndex(index);
    
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const item = container.querySelector('[data-index="${index}"]') ||
                    Array.from(container.querySelectorAll('[role="treeitem"], [role="row"]'))[${index}];
        if (item) {
          item.click();
        }
      })()
    `);
  }

  /**
   * Click an item by text
   */
  async clickItemByText(text: string): Promise<void> {
    await this.scrollToItem(text);
    
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"], [role="row"], [role="listitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            item.click();
            break;
          }
        }
      })()
    `);
  }

  /**
   * Double-click an item by text
   */
  async dblclickItemByText(text: string): Promise<void> {
    await this.scrollToItem(text);
    
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"], [role="row"], [role="listitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            break;
          }
        }
      })()
    `);
  }

  /**
   * Expand a tree item
   */
  async expandItem(text: string): Promise<void> {
    await this.scrollToItem(text);
    
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            if (item.getAttribute('aria-expanded') !== 'true') {
              const expander = item.querySelector('[data-expand], .expand-icon, .chevron');
              if (expander) {
                expander.click();
              } else {
                item.click();
              }
            }
            break;
          }
        }
      })()
    `);
  }

  /**
   * Collapse a tree item
   */
  async collapseItem(text: string): Promise<void> {
    await this.scrollToItem(text);
    
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            if (item.getAttribute('aria-expanded') === 'true') {
              const expander = item.querySelector('[data-expand], .expand-icon, .chevron');
              if (expander) {
                expander.click();
              } else {
                item.click();
              }
            }
            break;
          }
        }
      })()
    `);
  }

  /**
   * Measure scroll performance
   */
  async measureScrollPerformance(options: {
    scrollDistance?: number;
    duration?: number;
  } = {}): Promise<ScrollPerformance> {
    const { scrollDistance = 5000, duration = 2000 } = options;

    const result = await this.test.evaluate(`
      (() => {
        return new Promise((resolve) => {
          const container = document.querySelector('${this.selector}');
          if (!container) {
            resolve(null);
            return;
          }
          
          const scrollEl = container.querySelector('[data-virtualized]') ||
                          container.querySelector('[style*="overflow"]') ||
                          container;
          
          const frames = [];
          let lastTime = performance.now();
          let itemsRendered = 0;
          let rafId;
          
          // Count initial items
          const countItems = () => 
            scrollEl.querySelectorAll('[data-index], [role="treeitem"], [role="row"]').length;
          
          const initialItems = countItems();
          
          // Start measuring frames
          const measureFrame = () => {
            const now = performance.now();
            frames.push(now - lastTime);
            lastTime = now;
            
            const currentItems = countItems();
            if (currentItems !== itemsRendered) {
              itemsRendered = Math.max(itemsRendered, currentItems);
            }
            
            rafId = requestAnimationFrame(measureFrame);
          };
          
          rafId = requestAnimationFrame(measureFrame);
          
          // Scroll
          const startScroll = performance.now();
          const startTop = scrollEl.scrollTop;
          
          const scrollStep = () => {
            const elapsed = performance.now() - startScroll;
            const progress = Math.min(elapsed / ${duration}, 1);
            scrollEl.scrollTop = startTop + (${scrollDistance} * progress);
            
            if (progress < 1) {
              requestAnimationFrame(scrollStep);
            } else {
              // Stop measuring and calculate results
              cancelAnimationFrame(rafId);
              
              const fps = frames.length / (${duration} / 1000);
              const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
              const maxFrameTime = Math.max(...frames);
              const droppedFrames = frames.filter(f => f > 33.33).length; // >30fps threshold
              
              resolve({
                fps: Math.round(fps),
                avgFrameTime: Math.round(avgFrameTime * 100) / 100,
                maxFrameTime: Math.round(maxFrameTime * 100) / 100,
                droppedFrames,
                duration: ${duration},
                distance: ${scrollDistance},
                itemsRendered
              });
            }
          };
          
          requestAnimationFrame(scrollStep);
        });
      })()
    `) as ScrollPerformance | null;

    if (!result) {
      throw new Error(`Virtual list not found: ${this.selector}`);
    }

    return result;
  }

  /**
   * Assert item is visible
   */
  async assertItemVisible(text: string, message?: string): Promise<void> {
    const item = await this.getItemByText(text);
    if (!item || !item.visible) {
      throw new Error(message || `Expected item "${text}" to be visible`);
    }
  }

  /**
   * Assert item count
   */
  async assertItemCount(expected: number, message?: string): Promise<void> {
    const state = await this.getState();
    if (state.totalCount !== expected) {
      throw new Error(message || `Expected ${expected} items, got ${state.totalCount}`);
    }
  }

  /**
   * Assert minimum item count
   */
  async assertMinItemCount(min: number, message?: string): Promise<void> {
    const state = await this.getState();
    if (state.totalCount < min) {
      throw new Error(message || `Expected at least ${min} items, got ${state.totalCount}`);
    }
  }

  /**
   * Assert item is selected
   */
  async assertItemSelected(text: string, message?: string): Promise<void> {
    const item = await this.getItemByText(text);
    if (!item?.selected) {
      throw new Error(message || `Expected item "${text}" to be selected`);
    }
  }

  /**
   * Assert item is expanded (for trees)
   */
  async assertItemExpanded(text: string, message?: string): Promise<void> {
    const item = await this.getItemByText(text);
    if (!item?.expanded) {
      throw new Error(message || `Expected item "${text}" to be expanded`);
    }
  }

  /**
   * Assert scroll performance meets threshold
   */
  async assertScrollPerformance(options: {
    minFps?: number;
    maxFrameTime?: number;
    maxDroppedFrames?: number;
  }): Promise<void> {
    const metrics = await this.measureScrollPerformance();

    if (options.minFps && metrics.fps < options.minFps) {
      throw new Error(`Scroll FPS ${metrics.fps} is below minimum ${options.minFps}`);
    }

    if (options.maxFrameTime && metrics.maxFrameTime > options.maxFrameTime) {
      throw new Error(`Max frame time ${metrics.maxFrameTime}ms exceeds ${options.maxFrameTime}ms`);
    }

    if (options.maxDroppedFrames && metrics.droppedFrames > options.maxDroppedFrames) {
      throw new Error(`Dropped frames ${metrics.droppedFrames} exceeds ${options.maxDroppedFrames}`);
    }
  }

  /**
   * Scroll to top
   */
  async scrollToTop(): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        scrollEl.scrollTop = 0;
      })()
    `);
  }

  /**
   * Scroll to bottom
   */
  async scrollToBottom(): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      })()
    `);
  }
}

export default VirtualListTester;
