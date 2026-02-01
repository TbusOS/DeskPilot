/**
 * @flowsight/desktop-test/core
 *
 * Core module exports
 */

export { DesktopTest, createDesktopTest } from './desktop-test.js';
export { TestRunner, type TestRunnerOptions } from './test-runner.js';
export { Assertions, AssertionError } from './assertions.js';

// Accessibility Testing
export { 
  A11yTester, 
  createA11yTester,
  type A11yResult,
  type A11yViolation,
  type ViolationImpact,
  WCAG_TAGS,
} from './a11y.js';

// Accessibility Tree
export {
  AccessibilityTreeManager,
  createAccessibilityTreeManager,
  type AXNode,
  type AXProperty,
  type AccessibilityTree,
  type AXQueryResult,
  type AXIssue,
  ARIA_ROLES,
} from './accessibility-tree.js';

// Visual Regression Testing
export {
  VisualRegressionTester,
  createVisualRegressionTester,
  type VisualDiffResult,
  type VisualRegressionOptions,
} from './visual-regression.js';

// Interaction Testing
export {
  InteractionTester,
  createInteractionTester,
  type KeyboardNavResult,
  type DragResult,
  type ResponsiveResult,
  COMMON_VIEWPORTS,
} from './interaction-tests.js';
