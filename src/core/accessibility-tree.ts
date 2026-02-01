/**
 * @flowsight/desktop-test - Accessibility Tree
 *
 * Complete implementation of Accessibility Tree functionality.
 * Provides full access to the accessibility hierarchy for testing
 * with screen readers and assistive technologies.
 */

import type { DesktopTestInstance } from '../types.js';

// ===========================================================================
// Types
// ===========================================================================

/**
 * ARIA roles organized by category
 */
export const ARIA_ROLES = {
  // Document structure
  document: ['article', 'document', 'application', 'feed', 'figure', 'group', 'img', 'main', 'math', 'none', 'note', 'presentation', 'separator', 'toolbar'],
  
  // Landmark roles
  landmark: ['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search'],
  
  // Widget roles (interactive)
  widget: ['button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'progressbar', 'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'tabpanel', 'textbox', 'treeitem'],
  
  // Composite widgets
  composite: ['combobox', 'grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
  
  // Live regions
  live: ['alert', 'log', 'marquee', 'status', 'timer'],
  
  // Window roles
  window: ['alertdialog', 'dialog'],
} as const;

/**
 * Accessibility tree node
 */
export interface AXNode {
  nodeId: string;
  role: string;
  name: string;
  description?: string;
  value?: string;
  properties: AXProperty[];
  children: AXNode[];
  parent?: AXNode;
  
  // Computed properties
  isInteractive: boolean;
  isFocusable: boolean;
  isVisible: boolean;
  isLandmark: boolean;
  level?: number;
  
  // DOM reference
  backendDOMNodeId?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Accessibility property
 */
export interface AXProperty {
  name: string;
  value: string | number | boolean;
}

/**
 * Accessibility tree structure
 */
export interface AccessibilityTree {
  root: AXNode;
  nodes: Map<string, AXNode>;
  
  // Statistics
  totalNodes: number;
  interactiveNodes: number;
  landmarkCount: number;
  headingCount: number;
}

/**
 * Tree query result
 */
export interface AXQueryResult {
  nodes: AXNode[];
  count: number;
}

/**
 * Accessibility issue found during validation
 */
export interface AXIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  node?: AXNode;
  suggestion?: string;
}

// ===========================================================================
// Accessibility Tree Builder
// ===========================================================================

/**
 * Accessibility Tree Manager
 * 
 * Provides complete access to the page's accessibility tree
 */
export class AccessibilityTreeManager {
  private test: DesktopTestInstance;
  private tree: AccessibilityTree | null = null;

  constructor(test: DesktopTestInstance) {
    this.test = test;
  }

  // =========================================================================
  // Tree Building
  // =========================================================================

  /**
   * Get the full accessibility tree from the page
   */
  async getTree(options: {
    includeHidden?: boolean;
    maxDepth?: number;
  } = {}): Promise<AccessibilityTree> {
    const { includeHidden = false, maxDepth = 100 } = options;

    // Get accessibility tree via page evaluation
    const rawTree = await this.test.evaluate<{
      tree: RawAXNode;
      stats: { total: number; interactive: number; landmarks: number; headings: number };
    }>(`
      (function() {
        const stats = { total: 0, interactive: 0, landmarks: 0, headings: 0 };
        const landmarkRoles = ['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search'];
        const interactiveRoles = ['button', 'checkbox', 'combobox', 'link', 'listbox', 'menuitem', 'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem'];
        
        function getAccessibleName(el) {
          // aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labels = labelledBy.split(' ').map(id => document.getElementById(id)?.textContent || '').join(' ');
            if (labels.trim()) return labels.trim();
          }
          
          // aria-label
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;
          
          // <label> for form elements
          if (el.id) {
            const label = document.querySelector('label[for="' + el.id + '"]');
            if (label) return label.textContent?.trim() || '';
          }
          
          // title attribute
          const title = el.getAttribute('title');
          if (title) return title;
          
          // alt for images
          const alt = el.getAttribute('alt');
          if (alt) return alt;
          
          // Text content for certain elements
          const tagName = el.tagName.toLowerCase();
          if (['button', 'a', 'label', 'legend', 'caption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            return el.textContent?.trim() || '';
          }
          
          // value for inputs
          if (tagName === 'input' && ['submit', 'button', 'reset'].includes(el.type)) {
            return el.value || '';
          }
          
          return '';
        }
        
        function getRole(el) {
          // Explicit role
          const role = el.getAttribute('role');
          if (role) return role;
          
          // Implicit roles
          const tagName = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || '';
          
          const implicitRoles = {
            'a[href]': 'link',
            'button': 'button',
            'input[type=button]': 'button',
            'input[type=submit]': 'button',
            'input[type=reset]': 'button',
            'input[type=image]': 'button',
            'input[type=checkbox]': 'checkbox',
            'input[type=radio]': 'radio',
            'input[type=range]': 'slider',
            'input[type=search]': 'searchbox',
            'input[type=text]': 'textbox',
            'input[type=email]': 'textbox',
            'input[type=password]': 'textbox',
            'input[type=tel]': 'textbox',
            'input[type=url]': 'textbox',
            'input': 'textbox',
            'select': 'combobox',
            'textarea': 'textbox',
            'article': 'article',
            'aside': 'complementary',
            'footer': 'contentinfo',
            'form': 'form',
            'header': 'banner',
            'main': 'main',
            'nav': 'navigation',
            'section': 'region',
            'img': 'img',
            'ul': 'list',
            'ol': 'list',
            'li': 'listitem',
            'table': 'table',
            'tr': 'row',
            'td': 'cell',
            'th': 'columnheader',
            'h1': 'heading',
            'h2': 'heading',
            'h3': 'heading',
            'h4': 'heading',
            'h5': 'heading',
            'h6': 'heading',
            'dialog': 'dialog',
            'progress': 'progressbar',
            'meter': 'meter',
            'option': 'option',
            'menu': 'menu',
          };
          
          // Check with attribute
          if (tagName === 'a' && el.hasAttribute('href')) return 'link';
          if (tagName === 'input' && type) {
            return implicitRoles['input[type=' + type + ']'] || implicitRoles['input'] || 'generic';
          }
          
          return implicitRoles[tagName] || 'generic';
        }
        
        function getProperties(el) {
          const props = [];
          
          // ARIA states
          const ariaProps = ['aria-checked', 'aria-disabled', 'aria-expanded', 'aria-hidden', 'aria-invalid', 'aria-pressed', 'aria-readonly', 'aria-required', 'aria-selected', 'aria-busy', 'aria-live', 'aria-haspopup', 'aria-controls', 'aria-describedby', 'aria-owns', 'aria-level', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'];
          
          for (const attr of ariaProps) {
            const value = el.getAttribute(attr);
            if (value !== null) {
              props.push({ name: attr.replace('aria-', ''), value: value === 'true' ? true : value === 'false' ? false : value });
            }
          }
          
          // Standard properties
          if (el.disabled !== undefined) props.push({ name: 'disabled', value: !!el.disabled });
          if (el.readOnly !== undefined) props.push({ name: 'readonly', value: !!el.readOnly });
          if (el.required !== undefined) props.push({ name: 'required', value: !!el.required });
          if (el.checked !== undefined) props.push({ name: 'checked', value: !!el.checked });
          
          // Tabindex
          const tabindex = el.getAttribute('tabindex');
          if (tabindex !== null) props.push({ name: 'tabindex', value: parseInt(tabindex, 10) });
          
          return props;
        }
        
        function isVisible(el) {
          if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
          const style = getComputedStyle(el);
          if (style.display === 'none') return false;
          if (style.visibility === 'hidden') return false;
          if (parseFloat(style.opacity) === 0) return false;
          if (el.getAttribute('aria-hidden') === 'true') return false;
          return true;
        }
        
        function isFocusable(el) {
          if (el.disabled) return false;
          const tabindex = el.getAttribute('tabindex');
          if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true;
          const focusable = ['a[href]', 'button', 'input', 'select', 'textarea', '[contenteditable]'];
          return focusable.some(sel => el.matches(sel));
        }
        
        function buildTree(el, depth = 0, includeHidden = false, maxDepth = 100) {
          if (!el || depth > maxDepth) return null;
          if (!includeHidden && !isVisible(el)) return null;
          
          stats.total++;
          
          const role = getRole(el);
          const name = getAccessibleName(el);
          
          if (landmarkRoles.includes(role)) stats.landmarks++;
          if (role === 'heading') stats.headings++;
          if (interactiveRoles.includes(role)) stats.interactive++;
          
          const rect = el.getBoundingClientRect();
          const node = {
            nodeId: 'ax_' + stats.total,
            role: role,
            name: name,
            description: el.getAttribute('aria-description') || '',
            value: el.value || el.getAttribute('aria-valuenow') || '',
            properties: getProperties(el),
            children: [],
            isInteractive: interactiveRoles.includes(role),
            isFocusable: isFocusable(el),
            isVisible: isVisible(el),
            isLandmark: landmarkRoles.includes(role),
            level: role === 'heading' ? parseInt(el.tagName[1]) || 1 : undefined,
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
          
          // Process children
          for (const child of el.children) {
            const childNode = buildTree(child, depth + 1, includeHidden, maxDepth);
            if (childNode) {
              node.children.push(childNode);
            }
          }
          
          return node;
        }
        
        const tree = buildTree(document.body, 0, ${includeHidden}, ${maxDepth});
        return { tree, stats };
      })()
    `);

    // Build the tree structure
    const nodes = new Map<string, AXNode>();
    
    const processNode = (raw: RawAXNode, parent?: AXNode): AXNode => {
      const node: AXNode = {
        nodeId: raw.nodeId,
        role: raw.role,
        name: raw.name,
        description: raw.description,
        value: raw.value,
        properties: raw.properties,
        children: [],
        parent,
        isInteractive: raw.isInteractive,
        isFocusable: raw.isFocusable,
        isVisible: raw.isVisible,
        isLandmark: raw.isLandmark,
        level: raw.level,
        boundingBox: raw.boundingBox,
      };
      
      nodes.set(node.nodeId, node);
      
      for (const childRaw of raw.children) {
        node.children.push(processNode(childRaw, node));
      }
      
      return node;
    };

    const root = processNode(rawTree.tree);

    this.tree = {
      root,
      nodes,
      totalNodes: rawTree.stats.total,
      interactiveNodes: rawTree.stats.interactive,
      landmarkCount: rawTree.stats.landmarks,
      headingCount: rawTree.stats.headings,
    };

    return this.tree;
  }

  // =========================================================================
  // Tree Queries
  // =========================================================================

  /**
   * Find nodes by role
   */
  async findByRole(role: string): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];

    const search = (node: AXNode) => {
      if (node.role === role) results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    return { nodes: results, count: results.length };
  }

  /**
   * Find nodes by name (accessible name)
   */
  async findByName(name: string, options: { exact?: boolean } = {}): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];
    const { exact = false } = options;

    const search = (node: AXNode) => {
      const match = exact 
        ? node.name === name 
        : node.name.toLowerCase().includes(name.toLowerCase());
      if (match) results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    return { nodes: results, count: results.length };
  }

  /**
   * Find all landmarks
   */
  async findLandmarks(): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];

    const search = (node: AXNode) => {
      if (node.isLandmark) results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    return { nodes: results, count: results.length };
  }

  /**
   * Find all headings
   */
  async findHeadings(): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];

    const search = (node: AXNode) => {
      if (node.role === 'heading') results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    
    // Sort by level
    results.sort((a, b) => (a.level || 0) - (b.level || 0));
    return { nodes: results, count: results.length };
  }

  /**
   * Find all focusable elements
   */
  async findFocusable(): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];

    const search = (node: AXNode) => {
      if (node.isFocusable) results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    return { nodes: results, count: results.length };
  }

  /**
   * Find all interactive elements
   */
  async findInteractive(): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];

    const search = (node: AXNode) => {
      if (node.isInteractive) results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    return { nodes: results, count: results.length };
  }

  /**
   * Query with custom predicate
   */
  async query(predicate: (node: AXNode) => boolean): Promise<AXQueryResult> {
    const tree = this.tree || await this.getTree();
    const results: AXNode[] = [];

    const search = (node: AXNode) => {
      if (predicate(node)) results.push(node);
      for (const child of node.children) search(child);
    };

    search(tree.root);
    return { nodes: results, count: results.length };
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Validate the accessibility tree for common issues
   */
  async validate(): Promise<AXIssue[]> {
    const tree = this.tree || await this.getTree();
    const issues: AXIssue[] = [];

    // Check for missing landmarks
    const landmarks = await this.findLandmarks();
    if (!landmarks.nodes.some(n => n.role === 'main')) {
      issues.push({
        type: 'error',
        code: 'missing-main-landmark',
        message: 'Page is missing a main landmark',
        suggestion: 'Add <main> or role="main" to the main content area',
      });
    }
    if (!landmarks.nodes.some(n => n.role === 'navigation')) {
      issues.push({
        type: 'warning',
        code: 'missing-navigation-landmark',
        message: 'Page is missing a navigation landmark',
        suggestion: 'Add <nav> or role="navigation" to navigation areas',
      });
    }

    // Check heading structure
    const headings = await this.findHeadings();
    if (headings.count === 0) {
      issues.push({
        type: 'error',
        code: 'no-headings',
        message: 'Page has no headings',
        suggestion: 'Add heading elements (h1-h6) to structure the content',
      });
    } else {
      // Check for h1
      const h1s = headings.nodes.filter(n => n.level === 1);
      if (h1s.length === 0) {
        issues.push({
          type: 'error',
          code: 'missing-h1',
          message: 'Page is missing an h1 heading',
          suggestion: 'Add a single h1 heading as the main page title',
        });
      } else if (h1s.length > 1) {
        issues.push({
          type: 'warning',
          code: 'multiple-h1',
          message: `Page has ${h1s.length} h1 headings`,
          suggestion: 'Consider using only one h1 per page',
        });
      }

      // Check for skipped heading levels
      let prevLevel = 0;
      for (const heading of headings.nodes) {
        const level = heading.level || 0;
        if (level > prevLevel + 1 && prevLevel > 0) {
          issues.push({
            type: 'warning',
            code: 'skipped-heading-level',
            message: `Heading level skipped from h${prevLevel} to h${level}`,
            node: heading,
            suggestion: 'Use sequential heading levels without skipping',
          });
        }
        prevLevel = level;
      }
    }

    // Check for buttons/links without accessible names
    const validate = (node: AXNode) => {
      if (node.isInteractive && !node.name) {
        issues.push({
          type: 'error',
          code: 'missing-accessible-name',
          message: `${node.role} element has no accessible name`,
          node,
          suggestion: 'Add aria-label, aria-labelledby, or visible text content',
        });
      }

      // Check for images without alt
      if (node.role === 'img' && !node.name && !node.properties.some(p => p.name === 'hidden' && p.value === true)) {
        issues.push({
          type: 'error',
          code: 'missing-alt-text',
          message: 'Image has no alt text',
          node,
          suggestion: 'Add alt attribute to the image',
        });
      }

      for (const child of node.children) validate(child);
    };

    validate(tree.root);

    return issues;
  }

  /**
   * Check if a specific ARIA pattern is correctly implemented
   */
  async validatePattern(pattern: 'dialog' | 'menu' | 'tabs' | 'tree' | 'listbox'): Promise<AXIssue[]> {
    const issues: AXIssue[] = [];

    switch (pattern) {
      case 'dialog': {
        const dialogs = await this.findByRole('dialog');
        for (const dialog of dialogs.nodes) {
          if (!dialog.name) {
            issues.push({
              type: 'error',
              code: 'dialog-no-label',
              message: 'Dialog has no accessible name',
              node: dialog,
              suggestion: 'Add aria-label or aria-labelledby to the dialog',
            });
          }
          // Check for focus trap
          const focusable = dialog.children.filter(n => n.isFocusable);
          if (focusable.length === 0) {
            issues.push({
              type: 'warning',
              code: 'dialog-no-focusable',
              message: 'Dialog has no focusable elements',
              node: dialog,
            });
          }
        }
        break;
      }

      case 'tabs': {
        const tablists = await this.findByRole('tablist');
        for (const tablist of tablists.nodes) {
          const tabs = tablist.children.filter(n => n.role === 'tab');
          if (tabs.length === 0) {
            issues.push({
              type: 'error',
              code: 'tablist-no-tabs',
              message: 'Tablist contains no tabs',
              node: tablist,
            });
          }
          // Check for selected tab
          const selected = tabs.filter(t => t.properties.some(p => p.name === 'selected' && p.value === true));
          if (selected.length === 0 && tabs.length > 0) {
            issues.push({
              type: 'warning',
              code: 'tabs-no-selection',
              message: 'No tab is marked as selected',
              node: tablist,
              suggestion: 'Add aria-selected="true" to the active tab',
            });
          }
        }
        break;
      }

      case 'menu': {
        const menus = await this.findByRole('menu');
        for (const menu of menus.nodes) {
          const items = menu.children.filter(n => 
            n.role === 'menuitem' || n.role === 'menuitemcheckbox' || n.role === 'menuitemradio'
          );
          if (items.length === 0) {
            issues.push({
              type: 'error',
              code: 'menu-no-items',
              message: 'Menu contains no menu items',
              node: menu,
            });
          }
        }
        break;
      }

      case 'tree': {
        const trees = await this.findByRole('tree');
        for (const tree of trees.nodes) {
          const items = await this.query(n => n.role === 'treeitem');
          if (items.count === 0) {
            issues.push({
              type: 'error',
              code: 'tree-no-items',
              message: 'Tree contains no tree items',
              node: tree,
            });
          }
        }
        break;
      }

      case 'listbox': {
        const listboxes = await this.findByRole('listbox');
        for (const listbox of listboxes.nodes) {
          const options = listbox.children.filter(n => n.role === 'option');
          if (options.length === 0) {
            issues.push({
              type: 'error',
              code: 'listbox-no-options',
              message: 'Listbox contains no options',
              node: listbox,
            });
          }
        }
        break;
      }
    }

    return issues;
  }

  // =========================================================================
  // Tree Traversal
  // =========================================================================

  /**
   * Get the path from root to a node
   */
  getPath(node: AXNode): AXNode[] {
    const path: AXNode[] = [];
    let current: AXNode | undefined = node;
    
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    
    return path;
  }

  /**
   * Get all siblings of a node
   */
  getSiblings(node: AXNode): AXNode[] {
    if (!node.parent) return [];
    return node.parent.children.filter(n => n.nodeId !== node.nodeId);
  }

  /**
   * Get all descendants of a node
   */
  getDescendants(node: AXNode): AXNode[] {
    const descendants: AXNode[] = [];
    
    const collect = (n: AXNode) => {
      for (const child of n.children) {
        descendants.push(child);
        collect(child);
      }
    };
    
    collect(node);
    return descendants;
  }

  // =========================================================================
  // Output Formats
  // =========================================================================

  /**
   * Serialize tree to text (for screen reader simulation)
   */
  async toText(): Promise<string> {
    const tree = this.tree || await this.getTree();
    const lines: string[] = [];

    const visit = (node: AXNode, indent: number = 0) => {
      if (!node.isVisible) return;
      
      const prefix = '  '.repeat(indent);
      let line = prefix;

      // Role and name
      if (node.role !== 'generic' || node.name) {
        line += `[${node.role}]`;
        if (node.name) line += ` "${node.name}"`;
        if (node.value) line += ` value="${node.value}"`;
        if (node.level) line += ` level=${node.level}`;
        
        // Key properties
        const keyProps = node.properties.filter(p => 
          ['checked', 'selected', 'expanded', 'disabled'].includes(p.name)
        );
        if (keyProps.length > 0) {
          line += ' (' + keyProps.map(p => `${p.name}=${p.value}`).join(', ') + ')';
        }

        if (line.trim() !== prefix.trim()) {
          lines.push(line);
        }
      }

      for (const child of node.children) {
        visit(child, indent + 1);
      }
    };

    visit(tree.root);
    return lines.join('\n');
  }

  /**
   * Serialize tree to JSON
   */
  async toJSON(): Promise<string> {
    const tree = this.tree || await this.getTree();
    
    const simplify = (node: AXNode): object => ({
      role: node.role,
      name: node.name,
      ...(node.value && { value: node.value }),
      ...(node.level && { level: node.level }),
      ...(node.properties.length > 0 && { properties: node.properties }),
      ...(node.children.length > 0 && { children: node.children.map(simplify) }),
    });

    return JSON.stringify(simplify(tree.root), null, 2);
  }

  /**
   * Generate accessibility summary report
   */
  async generateSummary(): Promise<string> {
    const tree = this.tree || await this.getTree();
    const issues = await this.validate();
    
    let report = '# Accessibility Tree Summary\n\n';
    
    report += '## Statistics\n';
    report += `- Total nodes: ${tree.totalNodes}\n`;
    report += `- Interactive elements: ${tree.interactiveNodes}\n`;
    report += `- Landmarks: ${tree.landmarkCount}\n`;
    report += `- Headings: ${tree.headingCount}\n\n`;

    // Landmarks list
    const landmarks = await this.findLandmarks();
    if (landmarks.count > 0) {
      report += '## Landmarks\n';
      for (const landmark of landmarks.nodes) {
        report += `- ${landmark.role}${landmark.name ? `: "${landmark.name}"` : ''}\n`;
      }
      report += '\n';
    }

    // Headings outline
    const headings = await this.findHeadings();
    if (headings.count > 0) {
      report += '## Heading Outline\n';
      for (const heading of headings.nodes) {
        const indent = '  '.repeat((heading.level || 1) - 1);
        report += `${indent}- h${heading.level}: "${heading.name}"\n`;
      }
      report += '\n';
    }

    // Issues
    if (issues.length > 0) {
      report += '## Issues Found\n';
      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');
      
      if (errors.length > 0) {
        report += `\n### Errors (${errors.length})\n`;
        for (const issue of errors) {
          report += `- **${issue.code}**: ${issue.message}\n`;
          if (issue.suggestion) report += `  - Suggestion: ${issue.suggestion}\n`;
        }
      }
      
      if (warnings.length > 0) {
        report += `\n### Warnings (${warnings.length})\n`;
        for (const issue of warnings) {
          report += `- **${issue.code}**: ${issue.message}\n`;
          if (issue.suggestion) report += `  - Suggestion: ${issue.suggestion}\n`;
        }
      }
    } else {
      report += '## No Issues Found\n';
      report += 'The accessibility tree passes basic validation checks.\n';
    }

    return report;
  }
}

// ===========================================================================
// Internal Types
// ===========================================================================

interface RawAXNode {
  nodeId: string;
  role: string;
  name: string;
  description: string;
  value: string;
  properties: AXProperty[];
  children: RawAXNode[];
  isInteractive: boolean;
  isFocusable: boolean;
  isVisible: boolean;
  isLandmark: boolean;
  level?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

// ===========================================================================
// Factory
// ===========================================================================

/**
 * Create accessibility tree manager
 */
export function createAccessibilityTreeManager(test: DesktopTestInstance): AccessibilityTreeManager {
  return new AccessibilityTreeManager(test);
}
