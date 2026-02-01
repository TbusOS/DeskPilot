/**
 * TimelineTester - Timeline/Gantt Chart Testing Module
 * 
 * Specialized testing for timeline components and async event visualization.
 * Useful for testing FlowSight's async execution timeline feature.
 */

import type { DesktopTest } from './desktop-test';

/** Timeline event */
export interface TimelineEvent {
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
export interface TimelineState {
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
export interface TimelineFilterOptions {
  /** Filter by type */
  type?: string | string[];
  /** Filter by name (partial match) */
  name?: string | RegExp;
  /** Filter by time range */
  timeRange?: { start?: number; end?: number };
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
export class TimelineTester {
  private test: DesktopTest;
  private selector: string;

  constructor(test: DesktopTest, selector: string = '[data-testid="timeline"]') {
    this.test = test;
    this.selector = selector;
  }

  /**
   * Get the current timeline state
   */
  async getState(): Promise<TimelineState> {
    const state = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Try to access timeline data from various sources
        const timelineData = container.__timelineData || 
                           container.dataset.timeline ? JSON.parse(container.dataset.timeline) : null;
        
        // Parse events from DOM if no data attribute
        let events = [];
        const eventElements = container.querySelectorAll('[data-event-id], .timeline-event, .event-bar');
        
        eventElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          events.push({
            id: el.getAttribute('data-event-id') || el.id || '',
            name: el.getAttribute('data-event-name') || el.textContent?.trim() || '',
            type: el.getAttribute('data-event-type') || el.className.match(/type-(\\w+)/)?.[1] || 'default',
            startTime: parseFloat(el.getAttribute('data-start-time') || '0'),
            endTime: el.getAttribute('data-end-time') ? parseFloat(el.getAttribute('data-end-time')) : undefined,
            duration: el.getAttribute('data-duration') ? parseFloat(el.getAttribute('data-duration')) : undefined,
            color: getComputedStyle(el).backgroundColor,
            selected: el.classList.contains('selected') || el.getAttribute('aria-selected') === 'true',
            lane: parseInt(el.getAttribute('data-lane') || '0', 10),
            data: el.dataset.eventData ? JSON.parse(el.dataset.eventData) : {},
            parentId: el.getAttribute('data-parent-id'),
            childIds: el.getAttribute('data-child-ids')?.split(',').filter(Boolean)
          });
        });
        
        // Get visible and total range
        const visibleRange = {
          start: parseFloat(container.getAttribute('data-visible-start') || '0'),
          end: parseFloat(container.getAttribute('data-visible-end') || '1000')
        };
        
        const totalRange = {
          start: parseFloat(container.getAttribute('data-total-start') || '0'),
          end: parseFloat(container.getAttribute('data-total-end') || '1000')
        };
        
        // Count lanes
        const lanes = new Set(events.map(e => e.lane));
        
        // Get selected IDs
        const selectedIds = events.filter(e => e.selected).map(e => e.id);
        
        // Get playhead position if exists
        const playhead = container.querySelector('.playhead, .time-indicator');
        const playheadPosition = playhead 
          ? parseFloat(playhead.getAttribute('data-position') || playhead.style.left)
          : undefined;
        
        return {
          events,
          visibleRange,
          totalRange,
          zoom: parseFloat(container.getAttribute('data-zoom') || '1'),
          scrollPosition: container.scrollLeft || 0,
          laneCount: lanes.size,
          selectedIds,
          playheadPosition,
          isPlaying: container.classList.contains('playing')
        };
      })()
    `) as TimelineState | null;

    if (!state) {
      throw new Error(`Timeline not found: ${this.selector}`);
    }

    return state;
  }

  /**
   * Get all events
   */
  async getEvents(filter?: TimelineFilterOptions): Promise<TimelineEvent[]> {
    const state = await this.getState();
    let events = state.events;

    if (filter) {
      events = this.filterEvents(events, filter);
    }

    return events;
  }

  /**
   * Get event by ID
   */
  async getEvent(id: string): Promise<TimelineEvent | null> {
    const events = await this.getEvents();
    return events.find(e => e.id === id) || null;
  }

  /**
   * Get events by name (partial match)
   */
  async getEventsByName(name: string): Promise<TimelineEvent[]> {
    return this.getEvents({ name });
  }

  /**
   * Get events by type
   */
  async getEventsByType(type: string): Promise<TimelineEvent[]> {
    return this.getEvents({ type });
  }

  /**
   * Click on an event
   */
  async clickEvent(idOrName: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Find by ID first
        let event = container.querySelector('[data-event-id="${idOrName}"]');
        
        // Find by name if not found
        if (!event) {
          const events = container.querySelectorAll('[data-event-id], .timeline-event');
          for (const el of events) {
            if (el.textContent?.toLowerCase().includes('${idOrName.toLowerCase()}')) {
              event = el;
              break;
            }
          }
        }
        
        if (event) {
          event.click();
        }
      })()
    `);
  }

  /**
   * Double-click on an event
   */
  async dblclickEvent(idOrName: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        let event = container.querySelector('[data-event-id="${idOrName}"]');
        
        if (!event) {
          const events = container.querySelectorAll('[data-event-id], .timeline-event');
          for (const el of events) {
            if (el.textContent?.toLowerCase().includes('${idOrName.toLowerCase()}')) {
              event = el;
              break;
            }
          }
        }
        
        if (event) {
          event.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      })()
    `);
  }

  /**
   * Hover over an event
   */
  async hoverEvent(idOrName: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        let event = container.querySelector('[data-event-id="${idOrName}"]');
        
        if (!event) {
          const events = container.querySelectorAll('[data-event-id], .timeline-event');
          for (const el of events) {
            if (el.textContent?.toLowerCase().includes('${idOrName.toLowerCase()}')) {
              event = el;
              break;
            }
          }
        }
        
        if (event) {
          event.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          event.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
      })()
    `);
  }

  /**
   * Zoom to a specific range
   */
  async zoomToRange(start: number, end: number): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Dispatch custom zoom event
        container.dispatchEvent(new CustomEvent('timeline-zoom', {
          detail: { start: ${start}, end: ${end} },
          bubbles: true
        }));
        
        // Also try setting attributes directly
        container.setAttribute('data-visible-start', '${start}');
        container.setAttribute('data-visible-end', '${end}');
      })()
    `);
  }

  /**
   * Zoom in
   */
  async zoomIn(): Promise<void> {
    const state = await this.getState();
    const range = state.visibleRange.end - state.visibleRange.start;
    const center = (state.visibleRange.start + state.visibleRange.end) / 2;
    const newRange = range * 0.5;
    
    await this.zoomToRange(center - newRange / 2, center + newRange / 2);
  }

  /**
   * Zoom out
   */
  async zoomOut(): Promise<void> {
    const state = await this.getState();
    const range = state.visibleRange.end - state.visibleRange.start;
    const center = (state.visibleRange.start + state.visibleRange.end) / 2;
    const newRange = range * 2;
    
    await this.zoomToRange(
      Math.max(state.totalRange.start, center - newRange / 2),
      Math.min(state.totalRange.end, center + newRange / 2)
    );
  }

  /**
   * Fit all events in view
   */
  async fitAll(): Promise<void> {
    const state = await this.getState();
    await this.zoomToRange(state.totalRange.start, state.totalRange.end);
  }

  /**
   * Scroll to a specific time position
   */
  async scrollToTime(time: number): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        container.dispatchEvent(new CustomEvent('timeline-scroll', {
          detail: { time: ${time} },
          bubbles: true
        }));
      })()
    `);
  }

  /**
   * Play timeline (if supported)
   */
  async play(): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const playBtn = container?.querySelector('[data-action="play"], .play-button');
        if (playBtn) playBtn.click();
      })()
    `);
  }

  /**
   * Pause timeline
   */
  async pause(): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const pauseBtn = container?.querySelector('[data-action="pause"], .pause-button');
        if (pauseBtn) pauseBtn.click();
      })()
    `);
  }

  /**
   * Assert event exists
   */
  async assertEventExists(idOrName: string, message?: string): Promise<void> {
    const events = await this.getEvents();
    const found = events.find(e => 
      e.id === idOrName || 
      e.name.toLowerCase().includes(idOrName.toLowerCase())
    );
    
    if (!found) {
      throw new Error(message || `Expected event "${idOrName}" to exist`);
    }
  }

  /**
   * Assert event order
   */
  async assertEventOrder(expectedOrder: string[], message?: string): Promise<void> {
    const events = await this.getEvents();
    
    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    
    // Find matching events in order
    let orderIndex = 0;
    for (const event of sortedEvents) {
      if (orderIndex < expectedOrder.length) {
        const expectedName = expectedOrder[orderIndex].toLowerCase();
        if (event.id.toLowerCase() === expectedName || 
            event.name.toLowerCase().includes(expectedName)) {
          orderIndex++;
        }
      }
    }

    if (orderIndex !== expectedOrder.length) {
      const actualOrder = sortedEvents.map(e => e.name || e.id).join(' -> ');
      throw new Error(
        message || 
        `Expected event order: ${expectedOrder.join(' -> ')}\nActual order: ${actualOrder}`
      );
    }
  }

  /**
   * Assert concurrent events
   */
  async assertConcurrentEvents(eventNames: string[], message?: string): Promise<void> {
    const events = await this.getEvents();
    
    // Find events by name
    const matchedEvents = eventNames.map(name => {
      const found = events.find(e => 
        e.id.toLowerCase() === name.toLowerCase() || 
        e.name.toLowerCase().includes(name.toLowerCase())
      );
      if (!found) {
        throw new Error(`Event "${name}" not found`);
      }
      return found;
    });

    // Check for time overlap
    for (let i = 0; i < matchedEvents.length; i++) {
      for (let j = i + 1; j < matchedEvents.length; j++) {
        const a = matchedEvents[i];
        const b = matchedEvents[j];
        const aEnd = a.endTime || (a.startTime + (a.duration || 0));
        const bEnd = b.endTime || (b.startTime + (b.duration || 0));
        
        const overlaps = a.startTime < bEnd && aEnd > b.startTime;
        if (!overlaps) {
          throw new Error(
            message || 
            `Events "${a.name}" and "${b.name}" are not concurrent`
          );
        }
      }
    }
  }

  /**
   * Assert time range
   */
  async assertTimeRange(expectedStart: number, expectedEnd: number, message?: string): Promise<void> {
    const state = await this.getState();
    
    if (state.totalRange.start !== expectedStart || state.totalRange.end !== expectedEnd) {
      throw new Error(
        message || 
        `Expected time range [${expectedStart}, ${expectedEnd}], got [${state.totalRange.start}, ${state.totalRange.end}]`
      );
    }
  }

  /**
   * Assert event count
   */
  async assertEventCount(expected: number, message?: string): Promise<void> {
    const events = await this.getEvents();
    if (events.length !== expected) {
      throw new Error(message || `Expected ${expected} events, got ${events.length}`);
    }
  }

  /**
   * Assert event is selected
   */
  async assertEventSelected(idOrName: string, message?: string): Promise<void> {
    const events = await this.getEvents({ selected: true });
    const found = events.find(e => 
      e.id === idOrName || 
      e.name.toLowerCase().includes(idOrName.toLowerCase())
    );
    
    if (!found) {
      throw new Error(message || `Expected event "${idOrName}" to be selected`);
    }
  }

  // Private methods

  private filterEvents(events: TimelineEvent[], filter: TimelineFilterOptions): TimelineEvent[] {
    return events.filter(event => {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(event.type)) return false;
      }

      if (filter.name) {
        if (filter.name instanceof RegExp) {
          if (!filter.name.test(event.name)) return false;
        } else {
          if (!event.name.toLowerCase().includes(filter.name.toLowerCase())) return false;
        }
      }

      if (filter.timeRange) {
        const eventEnd = event.endTime || (event.startTime + (event.duration || 0));
        if (filter.timeRange.start !== undefined && eventEnd < filter.timeRange.start) return false;
        if (filter.timeRange.end !== undefined && event.startTime > filter.timeRange.end) return false;
      }

      if (filter.lane !== undefined && event.lane !== filter.lane) return false;
      if (filter.selected !== undefined && event.selected !== filter.selected) return false;
      if (filter.withDuration && !event.duration) return false;

      return true;
    });
  }
}

export default TimelineTester;
