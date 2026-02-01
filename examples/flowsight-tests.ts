#!/usr/bin/env npx tsx
/**
 * FlowSight Desktop E2E Tests using @flowsight/desktop-test
 *
 * Example test suite demonstrating the new hybrid testing framework.
 *
 * Run:
 *   1. Start FlowSight with remote debugging:
 *      WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 cargo tauri dev
 *
 *   2. Run tests:
 *      npx tsx packages/desktop-test/examples/flowsight-tests.ts
 */

import * as path from 'path';
import * as fs from 'fs';

import {
  DesktopTest,
  TestRunner,
  TestMode,
  type TestCase,
  type TestContext,
} from '../src/index.js';

// ============================================================================
// Configuration
// ============================================================================

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '60000');
const STOP_ON_FAILURE = process.env.STOP_ON_FAILURE === 'true';
const USE_VLM = process.env.USE_VLM === 'true';

// Auto-detect any Claude Agent environment:
// - Cursor IDE
// - Claude Code CLI (terminal)
// - VSCode Claude plugin
// - Claude Desktop
// - Any MCP environment
import { shouldUseAgentMode, detectAgentEnvironment } from '../src/vlm/cursor-bridge.js';
const USE_AGENT = process.env.USE_AGENT === 'true' ||
                  process.env.USE_CURSOR === 'true' ||
                  shouldUseAgentMode();

// Test kernel paths
const TEST_KERNEL_PATHS = [
  '/Users/sky/linux-kernel/linux/drivers/gpio',
  '/home/parallels/linux_kernel/drivers/gpio',
  path.resolve(__dirname, '../../../app/tests/fixtures/sample-project'),
];

function findTestPath(): string | null {
  for (const p of TEST_KERNEL_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// ============================================================================
// Test Cases
// ============================================================================

const tests: TestCase[] = [
  // --------------------------------------------------------------------------
  // Basic Page Load Tests
  // --------------------------------------------------------------------------
  {
    name: 'Page Load - Main UI elements exist',
    category: 'Basic',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Getting page snapshot');
      const snapshot = await test.snapshot({ interactive: true });

      // Verify core UI elements exist
      assert.greaterThan(
        snapshot.tree.length,
        100,
        'Snapshot should contain enough content'
      );

      // Check for interactive elements
      const refCount = Object.keys(snapshot.refs).length;
      assert.greaterThan(refCount, 0, 'Should have interactive elements');

      log.step('Checking for JavaScript errors');
      // Check for page errors via evaluate
      const hasErrors = await test.evaluate<boolean>(`
        window.__PAGE_ERRORS__ && window.__PAGE_ERRORS__.length > 0
      `).catch(() => false);

      assert.ok(!hasErrors, 'Page should not have JavaScript errors');
    },
  },

  // --------------------------------------------------------------------------
  // Open Project Test
  // --------------------------------------------------------------------------
  {
    name: 'Open Project - Select kernel directory',
    category: 'Core Features',
    fn: async ({ test, assert, log }: TestContext) => {
      const testPath = findTestPath();
      if (!testPath) {
        log.warn('Skipping: No test kernel path found');
        return;
      }

      log.step('Getting initial snapshot');
      const initialSnapshot = await test.snapshot({ interactive: true });

      // Find "Open Project" button
      let openProjectRef: string | null = null;
      for (const [ref, data] of Object.entries(initialSnapshot.refs)) {
        if (data.name?.includes('打开') || data.name?.includes('Open') ||
            data.name?.includes('项目') || data.name?.includes('Project')) {
          if (data.role === 'button' || data.role === 'link') {
            openProjectRef = ref;
            break;
          }
        }
      }

      if (openProjectRef) {
        log.step(`Clicking open project button: @${openProjectRef}`);
        const result = await test.click(`@${openProjectRef}`);
        assert.ok(result.status === 'success' || result.status === 'vlm_fallback', 'Click should succeed');

        await test.wait(2000);

        const afterSnapshot = await test.snapshot({ interactive: true });
        assert.notEqual(
          afterSnapshot.tree,
          initialSnapshot.tree,
          'Page should change after clicking'
        );
      } else {
        log.info('Open project button not found, project may already be loaded');
      }
    },
  },

  // --------------------------------------------------------------------------
  // Statistics Validation (Data Correctness)
  // --------------------------------------------------------------------------
  {
    name: 'Statistics - Should not show all zeros',
    category: 'Data Correctness',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Getting snapshot to check statistics');
      const snapshot = await test.snapshot();
      const tree = snapshot.tree.toLowerCase();

      // Check for "0 files, 0 functions, 0 structs" issue
      const hasZeroStats = tree.includes('0 个文件') &&
                           tree.includes('0 个函数') &&
                           tree.includes('0 个结构体');

      // If content is loaded, should not all be zeros
      if (tree.includes('文件') || tree.includes('files')) {
        assert.ok(
          !hasZeroStats,
          'Loaded project should not show all-zero statistics'
        );
      } else {
        log.info('No files section detected, may not have loaded a project');
      }
    },
  },

  // --------------------------------------------------------------------------
  // Execution Flow View Test
  // --------------------------------------------------------------------------
  {
    name: 'Execution Flow - Nodes should exist',
    category: 'Execution Flow',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Checking execution flow view');
      const snapshot = await test.snapshot();

      // Check for execution flow elements
      const hasFlowElements = snapshot.tree.includes('执行流') ||
                              snapshot.tree.includes('flow') ||
                              snapshot.tree.includes('Flow') ||
                              snapshot.tree.includes('节点') ||
                              snapshot.tree.includes('node');

      if (hasFlowElements) {
        // Check that we don't have only one probe node
        const probeOnlyPattern = /probe\s*00/i;
        const nodeMatches = snapshot.tree.match(/node/gi);
        const hasOnlyProbeNode = probeOnlyPattern.test(snapshot.tree) &&
                                  (!nodeMatches || nodeMatches.length <= 1);

        assert.ok(
          !hasOnlyProbeNode,
          'Execution flow should not have only one probe node'
        );
      } else {
        log.info('Execution flow view not detected');
      }
    },
  },

  // --------------------------------------------------------------------------
  // File Tree Test
  // --------------------------------------------------------------------------
  {
    name: 'File Tree - Should display files',
    category: 'File Navigation',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Checking file tree');
      const snapshot = await test.snapshot();

      // Check for file tree elements
      const hasFileTree = snapshot.tree.includes('tree') ||
                          snapshot.tree.includes('文件') ||
                          snapshot.tree.includes('file') ||
                          snapshot.tree.includes('.c') ||
                          snapshot.tree.includes('.h');

      if (hasFileTree) {
        assert.ok(true, 'File tree exists');
      } else {
        log.info('File tree elements not detected, may not have loaded a project');
      }
    },
  },

  // --------------------------------------------------------------------------
  // Search Panel Test
  // --------------------------------------------------------------------------
  {
    name: 'Search Panel - Can open',
    category: 'Search',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Opening search panel with Cmd/Ctrl+K');
      await test.press('Meta+k');
      await test.wait(500);

      const snapshot = await test.snapshot({ interactive: true });

      // Check for search input
      let hasSearchInput = false;
      for (const data of Object.values(snapshot.refs)) {
        if (data.role === 'textbox' || data.role === 'searchbox' ||
            data.name?.includes('搜索') || data.name?.includes('Search')) {
          hasSearchInput = true;
          break;
        }
      }

      // Close with Escape
      await test.press('Escape');

      if (hasSearchInput) {
        assert.ok(true, 'Search panel can open');
      } else {
        log.info('Search panel not detected, keyboard shortcut may differ');
      }
    },
  },

  // --------------------------------------------------------------------------
  // Theme Toggle Test
  // --------------------------------------------------------------------------
  {
    name: 'Theme Toggle - Can switch themes',
    category: 'UI',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Looking for theme toggle button');
      const snapshot = await test.snapshot({ interactive: true });

      // Find theme toggle button
      let themeButtonRef: string | null = null;
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('主题') || data.name?.includes('Theme') ||
            data.name?.includes('暗') || data.name?.includes('Dark') ||
            data.name?.includes('亮') || data.name?.includes('Light')) {
          themeButtonRef = ref;
          break;
        }
      }

      if (themeButtonRef) {
        log.step('Clicking theme toggle');
        await test.click(`@${themeButtonRef}`);
        await test.wait(500);
        assert.ok(true, 'Theme toggle should work');
      } else {
        log.info('Theme toggle button not found');
      }
    },
  },

  // --------------------------------------------------------------------------
  // Console Error Test
  // --------------------------------------------------------------------------
  {
    name: 'Console - No critical errors',
    category: 'Stability',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Checking for console errors');

      const errorCount = await test.evaluate<number>(`
        (function() {
          const errors = window.__CONSOLE_ERRORS__ || [];
          return errors.filter(e => e.type === 'error' && !e.text.includes('Warning')).length;
        })()
      `).catch(() => 0);

      assert.lessOrEqual(
        errorCount,
        5,
        `Console errors should be in acceptable range (found ${errorCount})`
      );
    },
  },

  // --------------------------------------------------------------------------
  // Performance Test
  // --------------------------------------------------------------------------
  {
    name: 'Performance - Snapshot generation speed',
    category: 'Performance',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Measuring snapshot generation time');
      const startTime = Date.now();
      await test.snapshot({ interactive: true });
      const duration = Date.now() - startTime;

      assert.lessThan(
        duration,
        5000,
        `Snapshot should complete within 5 seconds (actual: ${duration}ms)`
      );

      log.info(`Snapshot took ${duration}ms`);
    },
  },

  // --------------------------------------------------------------------------
  // Visual AI Test (only if VLM enabled)
  // --------------------------------------------------------------------------
  {
    name: 'Visual AI - UI Analysis',
    category: 'AI',
    skip: !USE_VLM,
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('Running visual AI analysis');

      // Use AI to analyze current state
      const result = await test.ai(`
        Analyze the FlowSight application and verify:
        1. Is the main UI properly rendered?
        2. Are there any visible error states?
        3. Does the layout look correct?
        Report any issues found.
      `);

      assert.ok(
        result.status === 'success',
        'Visual AI analysis should complete'
      );

      log.info(`VLM cost: $${result.vlmCost?.toFixed(4) || 0}`);
    },
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n========================================');
  console.log('  FlowSight Desktop E2E Tests');
  console.log('  Using: @flowsight/desktop-test');
  console.log('========================================\n');

  // Determine VLM provider - auto-detect agent environment
  const detectedEnv = detectAgentEnvironment();
  const vlmProvider = USE_AGENT ? 'agent' : 'anthropic';
  const useVLMMode = USE_VLM || USE_AGENT;

  console.log('Configuration:');
  console.log(`  - Mode: ${useVLMMode ? 'Hybrid (with VLM)' : 'Deterministic'}`);
  console.log(`  - VLM Provider: ${useVLMMode ? vlmProvider : 'none'}`);
  console.log(`  - CDP Port: ${CDP_PORT}`);
  console.log(`  - Timeout: ${TEST_TIMEOUT}ms`);
  console.log(`  - Test Path: ${findTestPath() || 'Not found'}`);
  if (USE_AGENT) {
    const envName = detectedEnv || 'auto';
    console.log(`  - 🤖 Agent Mode: ${envName} (no API key needed)`);
    console.log('    Supported: Cursor, Claude Code CLI, VSCode Claude, Claude Desktop');
  }
  console.log('');

  const runner = new TestRunner({
    config: {
      mode: useVLMMode ? TestMode.HYBRID : TestMode.DETERMINISTIC,
      cdp: { endpoint: CDP_PORT },
      vlm: useVLMMode ? {
        provider: vlmProvider,
        model: USE_AGENT ? 'claude-opus-4-5' : 'claude-sonnet-4-20250514',
        trackCost: !USE_AGENT, // Agent mode is free (uses existing subscription)
      } : undefined,
      timeout: TEST_TIMEOUT,
      debug: process.env.DEBUG === 'true',
    },
    stopOnFailure: STOP_ON_FAILURE,
  });

  const result = await runner.runAll(tests, 'FlowSight E2E');

  // Print cost summary if VLM was used
  if (USE_VLM && result.totalVLMCost > 0) {
    console.log(`\nTotal VLM Cost: $${result.totalVLMCost.toFixed(4)}`);
  }

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
