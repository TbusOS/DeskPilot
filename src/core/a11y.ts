/**
 * @flowsight/desktop-test - Accessibility Testing
 *
 * Provides accessibility (a11y) testing capabilities using axe-core standards.
 * Detects WCAG violations and provides remediation suggestions.
 * 
 * Integrates with AccessibilityTreeManager for complete a11y testing.
 */

import type { DesktopTestInstance } from '../types.js';
import { AccessibilityTreeManager, type AXIssue } from './accessibility-tree.js';

/**
 * WCAG violation severity levels
 */
export type ViolationImpact = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Accessibility violation
 */
export interface A11yViolation {
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
export interface A11yResult {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

/**
 * Complete accessibility audit result
 */
export interface CompleteA11yResult extends A11yResult {
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
export const WCAG_TAGS = {
  'wcag2a': 'WCAG 2.0 Level A',
  'wcag2aa': 'WCAG 2.0 Level AA',
  'wcag2aaa': 'WCAG 2.0 Level AAA',
  'wcag21a': 'WCAG 2.1 Level A',
  'wcag21aa': 'WCAG 2.1 Level AA',
  'best-practice': 'Best Practices',
} as const;

/**
 * Accessibility Tester
 * 
 * Provides methods to check accessibility compliance.
 * Combines axe-core auditing with accessibility tree analysis.
 */
export class A11yTester {
  private test: DesktopTestInstance;
  private treeManager: AccessibilityTreeManager;

  constructor(test: DesktopTestInstance) {
    this.test = test;
    this.treeManager = new AccessibilityTreeManager(test);
  }

  /**
   * Get the accessibility tree manager for direct tree access
   */
  get tree(): AccessibilityTreeManager {
    return this.treeManager;
  }

  /**
   * Run accessibility audit using axe-core (injected into page)
   */
  async audit(options: {
    tags?: Array<keyof typeof WCAG_TAGS>;
    includeSelectors?: string[];
    excludeSelectors?: string[];
  } = {}): Promise<A11yResult> {
    const { tags = ['wcag2a', 'wcag2aa'], includeSelectors, excludeSelectors } = options;

    // Inject and run axe-core
    const result = await this.test.evaluate<A11yResult>(`
      (async function() {
        // Load axe-core if not present
        if (!window.axe) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';
          document.head.appendChild(script);
          await new Promise(resolve => script.onload = resolve);
        }

        // Configure axe
        const options = {
          runOnly: {
            type: 'tag',
            values: ${JSON.stringify(tags)}
          }
        };

        ${includeSelectors ? `options.include = ${JSON.stringify(includeSelectors)};` : ''}
        ${excludeSelectors ? `options.exclude = ${JSON.stringify(excludeSelectors)};` : ''}

        // Run audit
        try {
          const results = await window.axe.run(document, options);
          return {
            violations: results.violations.map(v => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              nodes: v.nodes.map(n => ({
                html: n.html,
                target: n.target,
                failureSummary: n.failureSummary
              }))
            })),
            passes: results.passes.length,
            incomplete: results.incomplete.length,
            inapplicable: results.inapplicable.length
          };
        } catch (e) {
          return {
            violations: [{
              id: 'axe-error',
              impact: 'critical',
              description: 'Failed to run axe-core: ' + e.message,
              help: 'Check if axe-core loaded correctly',
              helpUrl: '',
              nodes: []
            }],
            passes: 0,
            incomplete: 0,
            inapplicable: 0
          };
        }
      })()
    `);

    return result;
  }

  /**
   * Check for critical violations only
   */
  async checkCritical(): Promise<A11yViolation[]> {
    const result = await this.audit();
    return result.violations.filter(v => v.impact === 'critical');
  }

  /**
   * Check for serious and critical violations
   */
  async checkSerious(): Promise<A11yViolation[]> {
    const result = await this.audit();
    return result.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    );
  }

  /**
   * Check color contrast issues
   */
  async checkContrast(): Promise<A11yViolation[]> {
    const result = await this.audit({ tags: ['wcag2aa'] });
    return result.violations.filter(v => 
      v.id.includes('contrast') || v.id.includes('color')
    );
  }

  /**
   * Check keyboard navigation issues
   */
  async checkKeyboardNav(): Promise<A11yViolation[]> {
    const result = await this.audit({ tags: ['wcag2a'] });
    return result.violations.filter(v => 
      v.id.includes('focus') || 
      v.id.includes('keyboard') || 
      v.id.includes('tabindex')
    );
  }

  /**
   * Generate accessibility report
   */
  async generateReport(): Promise<string> {
    const result = await this.audit();
    
    let report = '# Accessibility Report\n\n';
    report += `## Summary\n`;
    report += `- Violations: ${result.violations.length}\n`;
    report += `- Passes: ${result.passes}\n`;
    report += `- Incomplete: ${result.incomplete}\n\n`;

    if (result.violations.length > 0) {
      report += '## Violations\n\n';
      
      // Group by impact
      const byImpact: Record<ViolationImpact, A11yViolation[]> = {
        critical: [],
        serious: [],
        moderate: [],
        minor: [],
      };

      for (const v of result.violations) {
        byImpact[v.impact].push(v);
      }

      for (const impact of ['critical', 'serious', 'moderate', 'minor'] as ViolationImpact[]) {
        const violations = byImpact[impact];
        if (violations.length > 0) {
          report += `### ${impact.toUpperCase()} (${violations.length})\n\n`;
          for (const v of violations) {
            report += `#### ${v.id}\n`;
            report += `- ${v.description}\n`;
            report += `- Help: ${v.help}\n`;
            report += `- URL: ${v.helpUrl}\n`;
            report += `- Affected: ${v.nodes.length} elements\n\n`;
          }
        }
      }
    }

    return report;
  }

  // =========================================================================
  // Complete Audit (axe-core + tree analysis)
  // =========================================================================

  /**
   * Run a complete accessibility audit combining axe-core and tree analysis
   */
  async completeAudit(options: {
    tags?: Array<keyof typeof WCAG_TAGS>;
    includeSelectors?: string[];
    excludeSelectors?: string[];
  } = {}): Promise<CompleteA11yResult> {
    // Run axe-core audit
    const axeResult = await this.audit(options);
    
    // Get accessibility tree and validate
    const tree = await this.treeManager.getTree();
    const treeIssues = await this.treeManager.validate();
    
    return {
      ...axeResult,
      treeIssues,
      summary: {
        totalNodes: tree.totalNodes,
        interactiveNodes: tree.interactiveNodes,
        landmarkCount: tree.landmarkCount,
        headingCount: tree.headingCount,
      },
    };
  }

  /**
   * Get all landmarks from the page
   */
  async getLandmarks() {
    return this.treeManager.findLandmarks();
  }

  /**
   * Get all headings from the page
   */
  async getHeadings() {
    return this.treeManager.findHeadings();
  }

  /**
   * Get all focusable elements
   */
  async getFocusableElements() {
    return this.treeManager.findFocusable();
  }

  /**
   * Get all interactive elements
   */
  async getInteractiveElements() {
    return this.treeManager.findInteractive();
  }

  /**
   * Find elements by ARIA role
   */
  async findByRole(role: string) {
    return this.treeManager.findByRole(role);
  }

  /**
   * Find elements by accessible name
   */
  async findByName(name: string, options?: { exact?: boolean }) {
    return this.treeManager.findByName(name, options);
  }

  /**
   * Validate a specific ARIA pattern
   */
  async validatePattern(pattern: 'dialog' | 'menu' | 'tabs' | 'tree' | 'listbox') {
    return this.treeManager.validatePattern(pattern);
  }

  /**
   * Get the accessibility tree as text (screen reader simulation)
   */
  async getTreeAsText(): Promise<string> {
    return this.treeManager.toText();
  }

  /**
   * Get the accessibility tree as JSON
   */
  async getTreeAsJSON(): Promise<string> {
    return this.treeManager.toJSON();
  }

  /**
   * Generate complete accessibility summary
   */
  async generateCompleteSummary(): Promise<string> {
    const axeReport = await this.generateReport();
    const treeSummary = await this.treeManager.generateSummary();
    
    return `${axeReport}\n\n---\n\n${treeSummary}`;
  }

  // =========================================================================
  // Specific Checks
  // =========================================================================

  /**
   * Check if page has proper heading structure
   */
  async checkHeadingStructure(): Promise<{
    valid: boolean;
    issues: string[];
    outline: string;
  }> {
    const headings = await this.getHeadings();
    const issues: string[] = [];
    
    // Check for h1
    const h1s = headings.nodes.filter(n => n.level === 1);
    if (h1s.length === 0) {
      issues.push('Page is missing an h1 heading');
    } else if (h1s.length > 1) {
      issues.push(`Page has ${h1s.length} h1 headings (should have 1)`);
    }
    
    // Check for skipped levels
    let prevLevel = 0;
    for (const heading of headings.nodes) {
      const level = heading.level || 0;
      if (level > prevLevel + 1 && prevLevel > 0) {
        issues.push(`Heading level skipped from h${prevLevel} to h${level}`);
      }
      prevLevel = level;
    }
    
    // Generate outline
    const outline = headings.nodes.map(h => {
      const indent = '  '.repeat((h.level || 1) - 1);
      return `${indent}h${h.level}: ${h.name || '(empty)'}`;
    }).join('\n');
    
    return {
      valid: issues.length === 0,
      issues,
      outline,
    };
  }

  /**
   * Check if page has proper landmark structure
   */
  async checkLandmarkStructure(): Promise<{
    valid: boolean;
    issues: string[];
    landmarks: Array<{ role: string; name: string }>;
  }> {
    const landmarks = await this.getLandmarks();
    const issues: string[] = [];
    
    // Check for main landmark
    if (!landmarks.nodes.some(n => n.role === 'main')) {
      issues.push('Page is missing a main landmark');
    }
    
    // Check for multiple main landmarks
    const mains = landmarks.nodes.filter(n => n.role === 'main');
    if (mains.length > 1) {
      issues.push(`Page has ${mains.length} main landmarks (should have 1)`);
    }
    
    // Check for navigation
    if (!landmarks.nodes.some(n => n.role === 'navigation')) {
      issues.push('Page is missing a navigation landmark');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      landmarks: landmarks.nodes.map(n => ({ role: n.role, name: n.name })),
    };
  }

  /**
   * Check for elements with missing accessible names
   */
  async checkAccessibleNames(): Promise<{
    valid: boolean;
    missingNames: Array<{ role: string; suggestion: string }>;
  }> {
    const interactive = await this.getInteractiveElements();
    const missingNames: Array<{ role: string; suggestion: string }> = [];
    
    for (const node of interactive.nodes) {
      if (!node.name) {
        missingNames.push({
          role: node.role,
          suggestion: `Add aria-label, aria-labelledby, or visible text to ${node.role}`,
        });
      }
    }
    
    return {
      valid: missingNames.length === 0,
      missingNames,
    };
  }

  /**
   * Simulate screen reader reading order
   */
  async getReadingOrder(): Promise<string[]> {
    const tree = await this.treeManager.getTree();
    const order: string[] = [];
    
    const visit = (node: typeof tree.root) => {
      if (!node.isVisible) return;
      
      // Add meaningful content
      if (node.name && node.role !== 'generic') {
        let text = '';
        
        // Role announcement
        if (node.isLandmark) {
          text += `[${node.role} landmark] `;
        } else if (node.role === 'heading') {
          text += `[heading level ${node.level}] `;
        } else if (node.isInteractive) {
          text += `[${node.role}] `;
        }
        
        text += node.name;
        
        // State announcements
        const states: string[] = [];
        for (const prop of node.properties) {
          if (prop.name === 'checked' && prop.value) states.push('checked');
          if (prop.name === 'selected' && prop.value) states.push('selected');
          if (prop.name === 'expanded') states.push(prop.value ? 'expanded' : 'collapsed');
          if (prop.name === 'disabled' && prop.value) states.push('disabled');
        }
        if (states.length > 0) {
          text += ` (${states.join(', ')})`;
        }
        
        if (text.trim()) order.push(text.trim());
      }
      
      for (const child of node.children) visit(child);
    };
    
    visit(tree.root);
    return order;
  }
}

/**
 * Create accessibility tester for a DesktopTest instance
 */
export function createA11yTester(test: DesktopTestInstance): A11yTester {
  return new A11yTester(test);
}
