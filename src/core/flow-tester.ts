/**
 * FlowTester - Flow Chart / Graph Testing Module
 * 
 * Specialized testing for @xyflow/react (React Flow) and similar graph libraries.
 * Provides node, edge, and layout testing capabilities for FlowSight's execution flow view.
 */

import type { DesktopTest } from './desktop-test';

/** Node position */
export interface Position {
  x: number;
  y: number;
}

/** Node dimensions */
export interface Dimensions {
  width: number;
  height: number;
}

/** Flow node information */
export interface FlowNode {
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
export interface FlowEdge {
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
export interface Viewport {
  /** X offset */
  x: number;
  /** Y offset */
  y: number;
  /** Zoom level */
  zoom: number;
}

/** Layout type */
export type LayoutType = 'tree' | 'dagre' | 'force' | 'radial' | 'custom';

/** Flow state snapshot */
export interface FlowSnapshot {
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
export interface NodeFilterOptions {
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
export interface EdgeFilterOptions {
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
export interface LayoutValidationOptions {
  /** Expected layout type */
  type?: LayoutType;
  /** Minimum horizontal spacing */
  minHorizontalSpacing?: number;
  /** Minimum vertical spacing */
  minVerticalSpacing?: number;
  /** Check for overlapping nodes */
  noOverlap?: boolean;
  /** Check nodes are within bounds */
  withinBounds?: { minX: number; maxX: number; minY: number; maxY: number };
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
export class FlowTester {
  private test: DesktopTest;
  private selector: string;
  private _currentSnapshot: FlowSnapshot | null = null;

  constructor(test: DesktopTest, selector: string = '[data-testid="flow-view"]') {
    this.test = test;
    this.selector = selector;
  }

  /**
   * Get the current snapshot (if available)
   */
  get currentSnapshot(): FlowSnapshot | null {
    return this._currentSnapshot;
  }

  /**
   * Take a snapshot of the current flow state
   */
  async snapshot(): Promise<FlowSnapshot> {
    const data = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Try to get React Flow store
        let nodes = [];
        let edges = [];
        let viewport = { x: 0, y: 0, zoom: 1 };
        
        // Method 1: Access via React Flow's internal store
        const reactFlowInstance = container.querySelector('.react-flow');
        if (reactFlowInstance && reactFlowInstance.__reactFlow) {
          const store = reactFlowInstance.__reactFlow;
          nodes = store.getNodes?.() || [];
          edges = store.getEdges?.() || [];
          viewport = store.getViewport?.() || viewport;
        }
        
        // Method 2: Parse from DOM
        if (nodes.length === 0) {
          const nodeElements = container.querySelectorAll('.react-flow__node');
          nodeElements.forEach((el, idx) => {
            const transform = el.style.transform || '';
            const match = transform.match(/translate\\(([\\d.-]+)px,\\s*([\\d.-]+)px\\)/);
            const x = match ? parseFloat(match[1]) : 0;
            const y = match ? parseFloat(match[2]) : 0;
            
            nodes.push({
              id: el.getAttribute('data-id') || 'node-' + idx,
              type: el.getAttribute('data-type') || 'default',
              label: el.textContent?.trim().slice(0, 100) || '',
              position: { x, y },
              dimensions: {
                width: el.offsetWidth,
                height: el.offsetHeight
              },
              data: {},
              selected: el.classList.contains('selected'),
              draggable: !el.classList.contains('nodrag'),
              visible: el.offsetParent !== null,
              className: el.className,
              style: {}
            });
          });
          
          const edgeElements = container.querySelectorAll('.react-flow__edge');
          edgeElements.forEach((el, idx) => {
            edges.push({
              id: el.getAttribute('data-id') || 'edge-' + idx,
              source: el.getAttribute('data-source') || '',
              target: el.getAttribute('data-target') || '',
              type: el.getAttribute('data-type') || 'default',
              label: el.querySelector('.react-flow__edge-text')?.textContent || '',
              animated: el.classList.contains('animated'),
              selected: el.classList.contains('selected'),
              data: {},
              style: {}
            });
          });
          
          // Get viewport from transform
          const viewportEl = container.querySelector('.react-flow__viewport');
          if (viewportEl) {
            const transform = viewportEl.style.transform || '';
            const translateMatch = transform.match(/translate\\(([\\d.-]+)px,\\s*([\\d.-]+)px\\)/);
            const scaleMatch = transform.match(/scale\\(([\\d.]+)\\)/);
            viewport = {
              x: translateMatch ? parseFloat(translateMatch[1]) : 0,
              y: translateMatch ? parseFloat(translateMatch[2]) : 0,
              zoom: scaleMatch ? parseFloat(scaleMatch[1]) : 1
            };
          }
        }
        
        return {
          nodes,
          edges,
          viewport,
          timestamp: Date.now()
        };
      })()
    `) as FlowSnapshot | null;

    if (!data) {
      throw new Error(`Flow container not found: ${this.selector}`);
    }

    this._currentSnapshot = data;
    return data;
  }

  /**
   * Get all nodes
   */
  async getNodes(filter?: NodeFilterOptions): Promise<FlowNode[]> {
    const snapshot = await this.snapshot();
    let nodes = snapshot.nodes;

    if (filter) {
      nodes = this.filterNodes(nodes, filter);
    }

    return nodes;
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<FlowNode | null> {
    const nodes = await this.getNodes();
    return nodes.find(n => n.id === id) || null;
  }

  /**
   * Get all edges
   */
  async getEdges(filter?: EdgeFilterOptions): Promise<FlowEdge[]> {
    const snapshot = await this.snapshot();
    let edges = snapshot.edges;

    if (filter) {
      edges = this.filterEdges(edges, filter);
    }

    return edges;
  }

  /**
   * Get an edge by ID or source-target pair
   */
  async getEdge(idOrSource: string, target?: string): Promise<FlowEdge | null> {
    const edges = await this.getEdges();
    
    if (target !== undefined) {
      return edges.find(e => e.source === idOrSource && e.target === target) || null;
    }
    
    return edges.find(e => e.id === idOrSource) || null;
  }

  /**
   * Get current viewport
   */
  async getViewport(): Promise<Viewport> {
    const snapshot = await this.snapshot();
    return snapshot.viewport;
  }

  /**
   * Click on a node
   */
  async clickNode(nodeId: string): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (nodeEl) {
          nodeEl.click();
        }
      })()
    `);
  }

  /**
   * Double-click on a node
   */
  async dblclickNode(nodeId: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (nodeEl) {
          nodeEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      })()
    `);
  }

  /**
   * Hover over a node
   */
  async hoverNode(nodeId: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (nodeEl) {
          nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          nodeEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
      })()
    `);
  }

  /**
   * Click on an edge
   */
  async clickEdge(edgeId: string): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const edgeEl = container?.querySelector('[data-id="${edgeId}"]');
        if (edgeEl) {
          edgeEl.click();
        }
      })()
    `);
  }

  /**
   * Select a node
   */
  async selectNode(nodeId: string): Promise<void> {
    await this.clickNode(nodeId);
  }

  /**
   * Select multiple nodes
   */
  async selectNodes(nodeIds: string[]): Promise<void> {
    // Hold Ctrl/Cmd and click each node
    for (let i = 0; i < nodeIds.length; i++) {
      await this.test.evaluate(`
        (() => {
          const container = document.querySelector('${this.selector}');
          const nodeEl = container?.querySelector('[data-id="${nodeIds[i]}"]');
          if (nodeEl) {
            nodeEl.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              ctrlKey: ${i > 0},
              metaKey: ${i > 0}
            }));
          }
        })()
      `);
    }
  }

  /**
   * Drag a node to a new position
   */
  async dragNode(nodeId: string, targetPosition: Position): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const deltaX = targetPosition.x - node.position.x;
    const deltaY = targetPosition.y - node.position.y;

    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (!nodeEl) return;
        
        const rect = nodeEl.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        
        nodeEl.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientX: startX,
          clientY: startY
        }));
        
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: startX + ${deltaX},
          clientY: startY + ${deltaY}
        }));
        
        document.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          clientX: startX + ${deltaX},
          clientY: startY + ${deltaY}
        }));
      })()
    `);
  }

  /**
   * Zoom the viewport
   */
  async zoom(level: number): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Dispatch wheel event for zoom
        container.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          deltaY: ${level > 1 ? -100 : 100} * Math.abs(${level} - 1),
          ctrlKey: true
        }));
      })()
    `);
  }

  /**
   * Pan the viewport
   */
  async pan(deltaX: number, deltaY: number): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        container.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientX: centerX,
          clientY: centerY,
          button: 1 // Middle button for pan
        }));
        
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: centerX + ${deltaX},
          clientY: centerY + ${deltaY}
        }));
        
        document.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true
        }));
      })()
    `);
  }

  /**
   * Fit all nodes in view
   */
  async fitView(): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Try to find and click fitView button if exists
        const fitBtn = container.querySelector('[data-testid="fit-view-button"]') ||
                      container.querySelector('.react-flow__controls-fitview');
        if (fitBtn) {
          fitBtn.click();
        }
      })()
    `);
  }

  /**
   * Assert a node exists
   */
  async assertNodeExists(nodeId: string, message?: string): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(message || `Expected node "${nodeId}" to exist`);
    }
  }

  /**
   * Assert a node does not exist
   */
  async assertNodeNotExists(nodeId: string, message?: string): Promise<void> {
    const node = await this.getNode(nodeId);
    if (node) {
      throw new Error(message || `Expected node "${nodeId}" to not exist`);
    }
  }

  /**
   * Assert an edge exists between two nodes
   */
  async assertEdgeExists(source: string, target: string, message?: string): Promise<void> {
    const edge = await this.getEdge(source, target);
    if (!edge) {
      throw new Error(message || `Expected edge from "${source}" to "${target}" to exist`);
    }
  }

  /**
   * Assert an edge does not exist
   */
  async assertEdgeNotExists(source: string, target: string, message?: string): Promise<void> {
    const edge = await this.getEdge(source, target);
    if (edge) {
      throw new Error(message || `Expected edge from "${source}" to "${target}" to not exist`);
    }
  }

  /**
   * Assert node count
   */
  async assertNodeCount(expected: number, message?: string): Promise<void> {
    const nodes = await this.getNodes();
    if (nodes.length !== expected) {
      throw new Error(message || `Expected ${expected} nodes, got ${nodes.length}`);
    }
  }

  /**
   * Assert edge count
   */
  async assertEdgeCount(expected: number, message?: string): Promise<void> {
    const edges = await this.getEdges();
    if (edges.length !== expected) {
      throw new Error(message || `Expected ${expected} edges, got ${edges.length}`);
    }
  }

  /**
   * Assert a node is selected
   */
  async assertNodeSelected(nodeId: string, message?: string): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node?.selected) {
      throw new Error(message || `Expected node "${nodeId}" to be selected`);
    }
  }

  /**
   * Assert layout properties
   */
  async assertLayout(options: LayoutValidationOptions): Promise<void> {
    const snapshot = await this.snapshot();
    const nodes = snapshot.nodes;

    // Check for overlapping nodes
    if (options.noOverlap) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (this.nodesOverlap(nodes[i], nodes[j])) {
            throw new Error(`Nodes "${nodes[i].id}" and "${nodes[j].id}" overlap`);
          }
        }
      }
    }

    // Check minimum spacing
    if (options.minHorizontalSpacing || options.minVerticalSpacing) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = Math.abs(nodes[i].position.x - nodes[j].position.x);
          const dy = Math.abs(nodes[i].position.y - nodes[j].position.y);

          if (options.minHorizontalSpacing && dx < options.minHorizontalSpacing && dy < 50) {
            throw new Error(
              `Nodes "${nodes[i].id}" and "${nodes[j].id}" have horizontal spacing ${dx}, expected >= ${options.minHorizontalSpacing}`
            );
          }

          if (options.minVerticalSpacing && dy < options.minVerticalSpacing && dx < 50) {
            throw new Error(
              `Nodes "${nodes[i].id}" and "${nodes[j].id}" have vertical spacing ${dy}, expected >= ${options.minVerticalSpacing}`
            );
          }
        }
      }
    }

    // Check bounds
    if (options.withinBounds) {
      const { minX, maxX, minY, maxY } = options.withinBounds;
      for (const node of nodes) {
        if (node.position.x < minX || node.position.x > maxX ||
            node.position.y < minY || node.position.y > maxY) {
          throw new Error(
            `Node "${node.id}" at (${node.position.x}, ${node.position.y}) is outside bounds`
          );
        }
      }
    }

    // Check layout type (heuristic)
    if (options.type) {
      const detectedLayout = this.detectLayoutType(nodes);
      if (detectedLayout !== options.type && options.type !== 'custom') {
        throw new Error(`Expected layout type "${options.type}", detected "${detectedLayout}"`);
      }
    }
  }

  /**
   * Get nodes connected to a given node
   */
  async getConnectedNodes(nodeId: string, direction: 'incoming' | 'outgoing' | 'both' = 'both'): Promise<FlowNode[]> {
    const edges = await this.getEdges();
    const nodes = await this.getNodes();
    const nodeIds = new Set<string>();

    for (const edge of edges) {
      if (direction === 'outgoing' || direction === 'both') {
        if (edge.source === nodeId) {
          nodeIds.add(edge.target);
        }
      }
      if (direction === 'incoming' || direction === 'both') {
        if (edge.target === nodeId) {
          nodeIds.add(edge.source);
        }
      }
    }

    return nodes.filter(n => nodeIds.has(n.id));
  }

  /**
   * Get the path between two nodes
   */
  async getPath(sourceId: string, targetId: string): Promise<string[]> {
    const edges = await this.getEdges();
    
    // BFS to find shortest path
    const queue: string[][] = [[sourceId]];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      if (current === targetId) {
        return path;
      }

      for (const edge of edges) {
        if (edge.source === current && !visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push([...path, edge.target]);
        }
      }
    }

    return []; // No path found
  }

  /**
   * Assert a path exists between two nodes
   */
  async assertPathExists(sourceId: string, targetId: string, message?: string): Promise<void> {
    const path = await this.getPath(sourceId, targetId);
    if (path.length === 0) {
      throw new Error(message || `Expected path from "${sourceId}" to "${targetId}"`);
    }
  }

  // Private helper methods

  private filterNodes(nodes: FlowNode[], filter: NodeFilterOptions): FlowNode[] {
    return nodes.filter(node => {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(node.type)) return false;
      }

      if (filter.label) {
        if (filter.label instanceof RegExp) {
          if (!filter.label.test(node.label)) return false;
        } else {
          if (!node.label.toLowerCase().includes(filter.label.toLowerCase())) return false;
        }
      }

      if (filter.data) {
        for (const [key, value] of Object.entries(filter.data)) {
          if (node.data[key] !== value) return false;
        }
      }

      if (filter.selected !== undefined && node.selected !== filter.selected) return false;
      if (filter.visible !== undefined && node.visible !== filter.visible) return false;
      if (filter.parentId !== undefined && node.parentId !== filter.parentId) return false;

      return true;
    });
  }

  private filterEdges(edges: FlowEdge[], filter: EdgeFilterOptions): FlowEdge[] {
    return edges.filter(edge => {
      if (filter.source && edge.source !== filter.source) return false;
      if (filter.target && edge.target !== filter.target) return false;
      if (filter.type && edge.type !== filter.type) return false;
      if (filter.animated !== undefined && edge.animated !== filter.animated) return false;
      if (filter.selected !== undefined && edge.selected !== filter.selected) return false;
      return true;
    });
  }

  private nodesOverlap(a: FlowNode, b: FlowNode): boolean {
    if (!a.dimensions || !b.dimensions) return false;

    const aRight = a.position.x + a.dimensions.width;
    const aBottom = a.position.y + a.dimensions.height;
    const bRight = b.position.x + b.dimensions.width;
    const bBottom = b.position.y + b.dimensions.height;

    return !(aRight < b.position.x ||
             a.position.x > bRight ||
             aBottom < b.position.y ||
             a.position.y > bBottom);
  }

  private detectLayoutType(nodes: FlowNode[]): LayoutType {
    if (nodes.length < 2) return 'custom';

    // Check for tree layout (hierarchical Y positions)
    const yPositions = [...new Set(nodes.map(n => Math.round(n.position.y / 50) * 50))];
    if (yPositions.length > 1 && yPositions.length < nodes.length / 2) {
      return 'tree';
    }

    // Check for dagre layout (similar to tree but may have more variation)
    const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
    let isHierarchical = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].position.y < sorted[i - 1].position.y - 10) {
        isHierarchical = false;
        break;
      }
    }
    if (isHierarchical) return 'dagre';

    return 'custom';
  }
}

export default FlowTester;
