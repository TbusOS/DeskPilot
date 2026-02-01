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

// Ref Manager (agent-browser inspired)
export {
  RefManager,
  type ElementRef,
  type RefElement,
  type RefSnapshot,
  type SnapshotOptions,
  type RefResolution,
} from './ref-manager.js';

// Network Interceptor
export {
  NetworkInterceptor,
  type HttpMethod,
  type RequestInfo,
  type ResponseInfo,
  type RecordedRequest,
  type RouteOptions,
  type RouteDefinition,
  type RequestFilterOptions,
} from './network-interceptor.js';

// Flow Tester (@xyflow/react)
export {
  FlowTester,
  type FlowNode,
  type FlowEdge,
  type Viewport,
  type LayoutType,
  type FlowSnapshot,
  type NodeFilterOptions,
  type EdgeFilterOptions,
  type LayoutValidationOptions,
} from './flow-tester.js';

// Virtual List Tester
export {
  VirtualListTester,
  type VirtualItem,
  type VirtualListState,
  type ScrollPerformance,
  type ScrollOptions,
} from './virtual-list-tester.js';

// Session Manager
export {
  SessionManager,
  Session,
  type SessionState,
  type SessionInfo,
  type SessionOptions,
  type StorageState,
} from './session-manager.js';

// Visualizer (UI-TARS inspired)
export {
  Visualizer,
  type StepType,
  type StepStatus,
  type TestStep,
  type TestRunInfo,
  type VisualizerOptions,
} from './visualizer.js';

// Monaco Editor Tester
export {
  MonacoTester,
  type CursorPosition,
  type SelectionRange,
  type TokenInfo,
  type CompletionItem,
  type Diagnostic,
  type EditorState,
} from './monaco-tester.js';

// Tauri Dialog Tester
export {
  TauriDialogTester,
  type DialogType,
  type FileFilter,
  type DialogOptions,
  type DialogResult,
  type MockDialogConfig,
  type DialogInvocation,
} from './tauri-dialog.js';

// Benchmark (Performance Testing)
export {
  Benchmark,
  type TimingMeasurement,
  type MemoryMeasurement,
  type PerformanceEntry,
  type ResourceTiming,
  type PerformanceReport,
  type ThresholdConfig,
} from './benchmark.js';

// Stream Server (Real-time Preview)
export {
  StreamServer,
  type StreamFrame,
  type StreamOptions,
  type InputEvent,
  type StreamStats,
  type ClientInfo,
} from './stream-server.js';

// Timeline Tester
export {
  TimelineTester,
  type TimelineEvent,
  type TimelineState,
  type TimelineFilterOptions,
} from './timeline-tester.js';
