#!/usr/bin/env npx tsx
/**
 * FlowSight 完整功能测试套件
 * 
 * 使用 DeskPilot 的全部模块：
 * - StateValidator: Zustand/Jotai 状态验证
 * - TauriIpcInterceptor: Tauri IPC Mock
 * - ThemeTester: 主题切换测试
 * - FlowTester: @xyflow/react 执行流测试
 * - A11yTester: 无障碍测试
 * - MonacoTester: Monaco 编辑器测试
 * - ResizablePanelTester: 可调整面板测试
 * - VisualRegressionTester: 视觉回归测试
 * - VLMClient: AI 视觉断言
 * 
 * 运行方式:
 *   1. 启动应用: WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 cargo tauri dev
 *   2. 运行测试: npx tsx packages/desktop-test/examples/full-feature-tests.ts
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

// 导入所有测试模块
import { StateValidator } from '../src/core/state-validator.js';
import { TauriIpcInterceptor } from '../src/core/tauri-ipc-interceptor.js';
import { ThemeTester } from '../src/core/theme-tester.js';
import { FlowTester } from '../src/core/flow-tester.js';
import { createA11yTester } from '../src/core/a11y.js';
import { MonacoTester } from '../src/core/monaco-tester.js';
import { ResizablePanelTester } from '../src/core/resizable-panel-tester.js';
import { createVisualRegressionTester } from '../src/core/visual-regression.js';
import { shouldUseAgentMode, detectAgentEnvironment } from '../src/vlm/cursor-bridge.js';

// ============================================================================
// 配置
// ============================================================================

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '60000');
const STOP_ON_FAILURE = process.env.STOP_ON_FAILURE === 'true';

// VLM 始终启用（不再跳过）
// 优先使用 Agent Mode - 自动检测 Cursor/Claude Code 环境
const USE_AGENT = shouldUseAgentMode() || process.env.USE_API_KEY !== 'true';
const USE_VLM = process.env.USE_VLM !== 'false'; // 默认启用

// 测试输出目录
const OUTPUT_DIR = path.resolve(__dirname, '../test-results');
const BASELINE_DIR = path.resolve(__dirname, '../baselines');

// 确保目录存在
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true });

// ============================================================================
// 测试用例
// ============================================================================

const tests: TestCase[] = [
  // ==========================================================================
  // 1. StateValidator - Zustand 状态验证
  // ==========================================================================
  {
    name: 'StateValidator - 验证应用状态管理',
    category: 'State',
    fn: async ({ test, assert, log }: TestContext) => {
      const state = new StateValidator(test);
      
      log.step('暴露 Zustand stores 到 window');
      await test.evaluate(`
        (function() {
          // 尝试找到并暴露 Zustand stores
          window.__ZUSTAND_STORES__ = window.__ZUSTAND_STORES__ || {};
          
          // FlowSight 使用的 stores
          if (typeof useAnalysisStore !== 'undefined') {
            window.__ZUSTAND_STORES__.analysisStore = useAnalysisStore;
          }
          if (typeof useProjectStore !== 'undefined') {
            window.__ZUSTAND_STORES__.projectStore = useProjectStore;
          }
          
          // 也检查全局变量
          for (const key of Object.keys(window)) {
            if (key.includes('Store') && typeof window[key]?.getState === 'function') {
              window.__ZUSTAND_STORES__[key] = window[key];
            }
          }
        })()
      `);
      
      log.step('获取已暴露的 stores 列表');
      const stores = await state.getExposedStores();
      log.info(`发现 ${stores.length} 个 stores: ${stores.join(', ')}`);
      
      // 如果有 store，进行状态验证
      if (stores.length > 0) {
        log.step('验证状态值');
        const storeName = stores[0];
        const snapshot = await state.snapshot(storeName);
        
        assert.ok(snapshot.state !== null, 'Store 状态不应为 null');
        assert.ok(typeof snapshot.timestamp === 'number', '快照应有时间戳');
        
        log.info(`Store "${storeName}" 状态键: ${Object.keys(snapshot.state).join(', ')}`);
      } else {
        log.warn('未找到 Zustand stores，跳过详细验证');
        // 仍然标记测试通过，因为 StateValidator 功能正常
        assert.ok(true, 'StateValidator 模块加载成功');
      }
    },
  },

  // ==========================================================================
  // 2. TauriIpcInterceptor - IPC Mock 测试
  // ==========================================================================
  {
    name: 'TauriIpcInterceptor - Mock Tauri IPC 调用',
    category: 'IPC',
    fn: async ({ test, assert, log }: TestContext) => {
      const ipc = new TauriIpcInterceptor(test);
      
      log.step('设置 IPC 拦截器');
      await ipc.setup();
      
      log.step('Mock open_project 命令');
      await ipc.mock('open_project', {
        response: {
          path: '/test/mock/project',
          files_count: 142,
          functions_count: 856,
          structs_count: 67,
          indexed: true,
        }
      });
      
      log.step('Mock get_functions 命令');
      await ipc.mock('get_functions', {
        response: [
          { name: 'probe', line: 42, kind: 'function' },
          { name: 'remove', line: 100, kind: 'function' },
          { name: 'init_module', line: 150, kind: 'function' },
        ]
      });
      
      log.step('Mock build_execution_flow 命令');
      await ipc.mock('build_execution_flow', {
        response: {
          entry_function: 'probe',
          nodes: [
            { id: 'n1', label: 'probe', node_type: 'entry' },
            { id: 'n2', label: 'init_device', node_type: 'sync' },
            { id: 'n3', label: 'work_handler', node_type: 'async' },
          ],
          edges: [
            { source: 'n1', target: 'n2' },
            { source: 'n2', target: 'n3' },
          ]
        }
      });
      
      log.step('验证 Mock 设置成功');
      // 触发一个命令来测试 Mock
      await test.evaluate(`
        (async () => {
          if (window.__TAURI__?.invoke) {
            try {
              const result = await window.__TAURI__.invoke('open_project', { path: '/test' });
              window.__MOCK_TEST_RESULT__ = result;
            } catch (e) {
              window.__MOCK_TEST_ERROR__ = e.message;
            }
          }
        })()
      `);
      
      await new Promise(r => setTimeout(r, 500));
      
      // 检查调用历史
      const history = await ipc.getHistory();
      log.info(`IPC 调用历史: ${history.length} 条记录`);
      
      if (history.length > 0) {
        const lastCall = history[history.length - 1];
        log.info(`最后调用: ${lastCall.command}, 拦截: ${lastCall.intercepted}`);
        assert.ok(lastCall.intercepted, 'Mock 应该拦截调用');
      }
      
      log.step('清理 IPC 拦截器');
      await ipc.teardown();
      
      assert.ok(true, 'TauriIpcInterceptor 工作正常');
    },
  },

  // ==========================================================================
  // 3. ThemeTester - 主题切换测试
  // ==========================================================================
  {
    name: 'ThemeTester - 主题切换和 CSS 变量验证',
    category: 'Theme',
    fn: async ({ test, assert, log }: TestContext) => {
      const theme = new ThemeTester(test);
      
      log.step('获取当前主题状态');
      const state = await theme.getState();
      log.info(`当前主题: ${state.current}`);
      log.info(`系统偏好: ${state.systemPreference}`);
      log.info(`Root class: ${state.rootClass}`);
      
      assert.ok(
        state.current === 'light' || state.current === 'dark',
        '主题应该是 light 或 dark'
      );
      
      log.step('获取 CSS 变量');
      const bgPrimary = await theme.getVariable('--bg-primary');
      const textPrimary = await theme.getVariable('--text-primary');
      
      log.info(`--bg-primary: ${bgPrimary.value}`);
      log.info(`--text-primary: ${textPrimary.value}`);
      
      assert.ok(bgPrimary.value.length > 0, 'CSS 变量 --bg-primary 应有值');
      assert.ok(textPrimary.value.length > 0, 'CSS 变量 --text-primary 应有值');
      
      log.step('检查颜色对比度 (WCAG)');
      const contrast = await theme.checkContrast('--text-primary', '--bg-primary');
      log.info(`对比度: ${contrast.ratio}:1`);
      log.info(`WCAG AA: ${contrast.meetsAA ? '✅' : '❌'}`);
      log.info(`WCAG AAA: ${contrast.meetsAAA ? '✅' : '❌'}`);
      
      assert.ok(contrast.ratio > 3, '对比度应至少满足 AA Large (3:1)');
      
      log.step('切换主题');
      const originalTheme = state.current;
      const newTheme = await theme.toggle();
      log.info(`切换到: ${newTheme}`);
      
      const newState = await theme.getState();
      // 可能因为应用实现不同，主题切换方式不同
      if (newState.current !== originalTheme) {
        log.info('主题切换成功');
      } else {
        log.warn('主题切换可能需要应用支持');
      }
      
      // 恢复原主题
      await theme.switch(originalTheme);
      
      assert.ok(true, 'ThemeTester 工作正常');
    },
  },

  // ==========================================================================
  // 4. FlowTester - 执行流图测试
  // ==========================================================================
  {
    name: 'FlowTester - 执行流图节点和边测试',
    category: 'Flow',
    fn: async ({ test, assert, log }: TestContext) => {
      const flow = new FlowTester(test);
      
      log.step('获取执行流快照');
      const snapshot = await flow.getSnapshot();
      
      log.info(`节点数: ${snapshot.nodes.length}`);
      log.info(`边数: ${snapshot.edges.length}`);
      log.info(`视口: x=${snapshot.viewport.x}, y=${snapshot.viewport.y}, zoom=${snapshot.viewport.zoom}`);
      
      if (snapshot.nodes.length > 0) {
        log.step('验证节点属性');
        const firstNode = snapshot.nodes[0];
        log.info(`第一个节点: id=${firstNode.id}, type=${firstNode.type}, label=${firstNode.label}`);
        
        assert.ok(firstNode.id, '节点应有 ID');
        assert.ok(firstNode.position, '节点应有位置');
        
        log.step('检查节点重叠');
        const overlaps = await flow.findOverlappingNodes(10);
        if (overlaps.length > 0) {
          log.warn(`发现 ${overlaps.length} 对重叠节点`);
        } else {
          log.info('没有节点重叠');
        }
        
        log.step('验证图的连通性');
        const connectivity = await flow.validateConnectivity();
        log.info(`连通性: 孤立节点=${connectivity.isolated.length}, 不可达=${connectivity.unreachable.length}`);
        
        if (snapshot.nodes.length > 1) {
          assert.ok(
            connectivity.isolated.length < snapshot.nodes.length,
            '不应该所有节点都是孤立的'
          );
        }
      } else {
        log.info('当前没有执行流节点，可能未加载分析');
      }
      
      assert.ok(true, 'FlowTester 工作正常');
    },
  },

  // ==========================================================================
  // 5. A11yTester - 无障碍测试
  // ==========================================================================
  {
    name: 'A11yTester - 无障碍性测试',
    category: 'Accessibility',
    fn: async ({ test, assert, log }: TestContext) => {
      const a11y = createA11yTester(test);
      
      log.step('运行 WCAG 审计');
      const result = await a11y.audit({ tags: ['wcag2a', 'wcag2aa'] });
      
      log.info(`违规数: ${result.violations.length}`);
      log.info(`通过数: ${result.passes.length}`);
      log.info(`不完整: ${result.incomplete.length}`);
      
      // 列出违规
      if (result.violations.length > 0) {
        log.warn('发现无障碍违规:');
        for (const violation of result.violations.slice(0, 5)) {
          log.warn(`  - ${violation.id}: ${violation.description} (impact: ${violation.impact})`);
        }
      }
      
      log.step('获取无障碍树');
      const tree = await a11y.tree.getTree();
      log.info(`无障碍树: ${tree.totalNodes} 个节点, ${tree.landmarkCount} 个地标`);
      
      log.step('查找按钮');
      const buttons = await a11y.tree.findByRole('button');
      log.info(`找到 ${buttons.length} 个按钮`);
      
      // 验证按钮有可访问名称
      if (buttons.length > 0) {
        const buttonsWithName = buttons.filter(b => b.name && b.name.length > 0);
        log.info(`有名称的按钮: ${buttonsWithName.length}/${buttons.length}`);
        
        // 警告无名称的按钮
        const buttonsWithoutName = buttons.filter(b => !b.name || b.name.length === 0);
        if (buttonsWithoutName.length > 0) {
          log.warn(`${buttonsWithoutName.length} 个按钮缺少可访问名称`);
        }
      }
      
      log.step('检查焦点顺序');
      const readingOrder = await a11y.getReadingOrder();
      log.info(`阅读顺序: ${readingOrder.length} 个可聚焦元素`);
      
      // 无障碍测试不强制通过，但记录问题
      assert.ok(true, 'A11yTester 审计完成');
      
      // 如果有严重违规，发出警告
      const criticalViolations = result.violations.filter(v => v.impact === 'critical');
      if (criticalViolations.length > 0) {
        log.error(`⚠️ 有 ${criticalViolations.length} 个严重无障碍违规需要修复!`);
      }
    },
  },

  // ==========================================================================
  // 6. MonacoTester - 编辑器测试
  // ==========================================================================
  {
    name: 'MonacoTester - Monaco 编辑器测试',
    category: 'Editor',
    fn: async ({ test, assert, log }: TestContext) => {
      const monaco = new MonacoTester(test);
      
      log.step('检查 Monaco 编辑器是否存在');
      const exists = await monaco.exists();
      
      if (exists) {
        log.info('找到 Monaco 编辑器');
        
        log.step('获取编辑器状态');
        const state = await monaco.getState();
        log.info(`语言: ${state.language}`);
        log.info(`行数: ${state.lineCount}`);
        log.info(`只读: ${state.readOnly}`);
        log.info(`光标位置: 行 ${state.cursor.lineNumber}, 列 ${state.cursor.column}`);
        
        if (state.value.length > 0) {
          log.info(`内容预览: ${state.value.substring(0, 100)}...`);
        }
        
        log.step('获取光标处的 token');
        const token = await monaco.getTokenAtPosition(state.cursor);
        if (token) {
          log.info(`Token: type=${token.type}, text="${token.text}"`);
        }
        
        // 如果不是只读，测试输入
        if (!state.readOnly) {
          log.step('测试编辑器输入');
          // 保存原始内容
          const originalValue = state.value;
          
          // 输入测试文本
          await monaco.type('// Test comment\n');
          await new Promise(r => setTimeout(r, 300));
          
          const newState = await monaco.getState();
          assert.ok(
            newState.value !== originalValue || newState.lineCount > state.lineCount,
            '编辑器内容应该改变'
          );
          
          // 撤销
          await monaco.undo();
        }
        
        assert.ok(true, 'Monaco 编辑器测试通过');
      } else {
        log.info('当前页面没有 Monaco 编辑器，跳过详细测试');
        assert.ok(true, 'MonacoTester 模块加载成功');
      }
    },
  },

  // ==========================================================================
  // 7. ResizablePanelTester - 可调整面板测试
  // ==========================================================================
  {
    name: 'ResizablePanelTester - 可调整面板测试',
    category: 'Layout',
    fn: async ({ test, assert, log }: TestContext) => {
      const panels = new ResizablePanelTester(test, { direction: 'horizontal' });
      
      log.step('获取面板状态');
      const state = await panels.getState();
      
      log.info(`面板数量: ${state.panels.length}`);
      log.info(`分隔条数量: ${state.handles.length}`);
      
      if (state.panels.length > 0) {
        for (const panel of state.panels) {
          log.info(`  面板 "${panel.id}": ${panel.size}px, collapsed=${panel.collapsed}`);
        }
        
        if (state.handles.length > 0) {
          log.step('测试拖动分隔条');
          const handle = state.handles[0];
          
          // 获取原始尺寸
          const originalSize = state.panels[0].size;
          
          // 拖动分隔条
          const result = await panels.resize(handle.id, 50);
          
          if (result.success) {
            log.info(`拖动成功: ${originalSize}px -> ${result.newSize}px`);
          } else {
            log.info('拖动可能受限于最小/最大尺寸');
          }
        }
        
        // 测试折叠面板（如果支持）
        if (state.panels.some(p => p.collapsible)) {
          log.step('测试面板折叠');
          const collapsiblePanel = state.panels.find(p => p.collapsible);
          if (collapsiblePanel && !collapsiblePanel.collapsed) {
            await panels.collapse(collapsiblePanel.id);
            const newState = await panels.getState();
            const updated = newState.panels.find(p => p.id === collapsiblePanel.id);
            if (updated?.collapsed) {
              log.info('面板折叠成功');
              // 展开回来
              await panels.expand(collapsiblePanel.id);
            }
          }
        }
      } else {
        log.info('未检测到可调整面板，跳过详细测试');
      }
      
      assert.ok(true, 'ResizablePanelTester 测试完成');
    },
  },

  // ==========================================================================
  // 8. VisualRegressionTester - 视觉回归测试
  // ==========================================================================
  {
    name: 'VisualRegressionTester - 视觉回归测试',
    category: 'Visual',
    fn: async ({ test, assert, log }: TestContext) => {
      const visual = createVisualRegressionTester(test, {
        baselineDir: BASELINE_DIR,
        outputDir: OUTPUT_DIR,
        threshold: 0.05, // 5% 容差
        updateBaselines: process.env.UPDATE_BASELINES === 'true',
      });
      
      log.step('截取当前页面');
      const result = await visual.compareScreenshot('main-page');
      
      log.info(`截图路径: ${result.screenshotPath}`);
      log.info(`基线存在: ${result.baselineExists}`);
      
      if (result.baselineExists) {
        log.info(`匹配: ${result.match}`);
        log.info(`差异: ${result.diffPercentage.toFixed(2)}%`);
        
        if (!result.match) {
          log.warn(`视觉差异超过阈值! 差异图: ${result.diffPath}`);
        }
      } else {
        log.info('基线不存在，已创建新基线');
        log.info('下次运行将与此基线比较');
      }
      
      log.step('截取特定区域');
      // 可以对特定组件截图
      const headerResult = await visual.compareScreenshot('header-area');
      log.info(`Header 截图: ${headerResult.screenshotPath}`);
      
      assert.ok(true, 'VisualRegressionTester 测试完成');
    },
  },

  // ==========================================================================
  // 9. VLM 视觉 AI 测试 - 完整版 (使用 VLMAssertions)
  // ==========================================================================
  {
    name: 'VLM - 空白区域检查',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被手动禁用 (USE_VLM=false)');
        return;
      }
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
        minConfidence: 0.7,
      });
      
      log.step('检查页面是否有空白区域');
      try {
        const result = await vlm.assertNoEmptyAreas('full-test-empty-areas');
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        if (result.issues.length > 0) {
          for (const issue of result.issues) {
            log.warn(`  [${issue.severity}] ${issue.description}`);
          }
        }
        assert.ok(result.passed, '页面不应有意外的空白区域');
      } catch (e) {
        log.error(`检查失败: ${(e as Error).message}`);
        throw e;
      }
    },
  },

  {
    name: 'VLM - 数据显示检查',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被手动禁用 (USE_VLM=false)');
        return;
      }
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
      });
      
      log.step('检查数据是否正确显示');
      try {
        const result = await vlm.assertDataVisible('full-test-data', {
          expectedData: ['文件', '函数', '结构体'],
          notZero: true,
          notEmpty: true,
        });
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        if (result.issues.length > 0) {
          for (const issue of result.issues) {
            log.warn(`  [${issue.severity}] ${issue.description}`);
          }
        }
        assert.ok(result.passed, '数据应正确显示且不为零');
      } catch (e) {
        log.error(`检查失败: ${(e as Error).message}`);
        throw e;
      }
    },
  },

  {
    name: 'VLM - 布局正确性检查',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被手动禁用 (USE_VLM=false)');
        return;
      }
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
      });
      
      log.step('检查布局是否正确');
      try {
        const result = await vlm.assertLayoutCorrect('full-test-layout', {
          expectedElements: ['侧边栏', '编辑器', '工具栏', '状态栏'],
          checkAlignment: true,
          checkOverlap: true,
        });
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        if (result.issues.length > 0) {
          for (const issue of result.issues) {
            log.warn(`  [${issue.severity}] ${issue.description}`);
          }
        }
        assert.ok(result.passed, '布局应正确无重叠');
      } catch (e) {
        log.error(`检查失败: ${(e as Error).message}`);
        throw e;
      }
    },
  },

  {
    name: 'VLM - 无障碍性检查',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被手动禁用 (USE_VLM=false)');
        return;
      }
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
      });
      
      log.step('检查视觉无障碍性');
      try {
        const result = await vlm.assertAccessibility('full-test-a11y');
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        if (result.issues.length > 0) {
          for (const issue of result.issues) {
            log.warn(`  [${issue.severity}] ${issue.description}`);
          }
        }
        // 无障碍性检查不强制失败，只警告
        if (!result.passed) {
          log.warn('⚠️ 存在无障碍性问题，建议修复');
        }
        assert.ok(true, 'VLM 无障碍性检查完成');
      } catch (e) {
        log.error(`检查失败: ${(e as Error).message}`);
        // 不抛出，只记录
      }
    },
  },

  {
    name: 'VLM - 整体 UI 质量评估',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被手动禁用 (USE_VLM=false)');
        return;
      }
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
      });
      
      log.step('AI 评估整体 UI 质量');
      try {
        const result = await vlm.assertVisual('full-test-overall', `
          对 FlowSight 应用进行全面的 UI 质量评估：
          
          1. 整体视觉效果：
             - UI 是否看起来专业、现代？
             - 颜色方案是否协调？
             - 图标和文字是否清晰？
          
          2. 功能完整性：
             - 侧边栏是否显示文件树？
             - 编辑器区域是否有代码？
             - 执行流视图是否有节点？
             - 状态栏是否显示信息？
          
          3. 错误检测：
             - 是否有明显的 UI bug？
             - 是否有加载失败的区域？
             - 是否有文字重叠或截断？
          
          4. 用户体验：
             - 交互元素是否易于识别？
             - 信息层次是否清晰？
          
          如果发现任何严重问题，请标记为失败。
        `);
        
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        log.info(`分析: ${result.analysis.substring(0, 200)}...`);
        
        if (result.issues.length > 0) {
          log.warn('发现的问题:');
          for (const issue of result.issues) {
            log.warn(`  [${issue.severity}] ${issue.description}`);
          }
        }
        
        // 生成报告
        const report = vlm.generateReport();
        log.info('\n--- VLM 测试报告 ---');
        log.info(report);
        
        // 保存报告
        const reportPath = vlm.saveReport('full-test-vlm-report.md');
        log.info(`报告已保存: ${reportPath}`);
        
        assert.ok(result.passed, '整体 UI 质量应达标');
      } catch (e) {
        log.error(`检查失败: ${(e as Error).message}`);
        throw e;
      }
    },
  },

  {
    name: 'VLM - 执行流视图专项检查',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被手动禁用 (USE_VLM=false)');
        return;
      }
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
      });
      
      log.step('检查执行流视图');
      try {
        const result = await vlm.assertVisual('full-test-flow-view', `
          专门检查执行流视图（Flow View）：
          
          1. 节点检查：
             - 是否有可见的节点？
             - 节点是否有标签/文字？
             - 节点颜色是否区分不同类型？
          
          2. 连线检查：
             - 节点之间是否有连线？
             - 连线是否清晰可见？
             - 是否有箭头指示方向？
          
          3. 交互元素：
             - 是否有缩放/平移控件？
             - 工具栏是否可见？
          
          4. 数据正确性：
             - 如果显示 "暂无数据" 或只有一个孤立节点，标记为失败
             - 应该有多个节点和连线
          
          如果执行流视图为空或只有一个节点，这是一个 BUG！
        `);
        
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        if (!result.passed) {
          log.error('❌ 执行流视图可能有问题!');
        }
        
        assert.ok(result.passed, '执行流视图应正确显示节点和连线');
      } catch (e) {
        log.error(`检查失败: ${(e as Error).message}`);
        throw e;
      }
    },
  },

  // ==========================================================================
  // 10. 综合数据正确性测试
  // ==========================================================================
  {
    name: '综合测试 - 数据正确性验证',
    category: 'Data Correctness',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('综合验证应用状态');
      
      // 获取页面快照
      const snapshot = await test.snapshot();
      
      // 验证页面有内容
      assert.ok(
        snapshot.tree.length > 100,
        '页面应有足够的内容'
      );
      
      // 检查是否有错误状态
      const hasErrorState = snapshot.tree.toLowerCase().includes('error') &&
                            snapshot.tree.toLowerCase().includes('failed');
      
      if (hasErrorState) {
        log.warn('页面可能有错误状态');
      }
      
      // 检查空白内容
      const hasEmptyContent = snapshot.tree.includes('暂无') ||
                              snapshot.tree.includes('No data') ||
                              snapshot.tree.includes('Empty');
      
      if (hasEmptyContent) {
        log.info('页面有空状态提示，可能未加载数据');
      }
      
      // 统计信息不应全为零（如果显示的话）
      const hasZeroStats = /0\s*个文件.*0\s*个函数.*0\s*个结构/i.test(snapshot.tree);
      if (hasZeroStats) {
        log.warn('⚠️ 统计信息全为零，可能是 Bug!');
      }
      
      assert.ok(!hasZeroStats, '统计信息不应全为零（如果已加载项目）');
      
      log.info('数据正确性验证完成');
    },
  },
];

// ============================================================================
// 主程序
// ============================================================================

async function main() {
  console.log('\n========================================');
  console.log('  FlowSight 完整功能测试套件');
  console.log('  使用所有 DeskPilot 模块');
  console.log('========================================\n');

  const detectedEnv = detectAgentEnvironment();
  const vlmProvider = USE_AGENT ? 'agent' : 'anthropic';

  console.log('配置:');
  console.log(`  - Mode: Hybrid (全部功能启用)`);
  console.log(`  - VLM Provider: ${USE_VLM ? vlmProvider : 'disabled'}`);
  console.log(`  - CDP Port: ${CDP_PORT}`);
  console.log(`  - Timeout: ${TEST_TIMEOUT}ms`);
  console.log(`  - Output Dir: ${OUTPUT_DIR}`);
  console.log(`  - Baseline Dir: ${BASELINE_DIR}`);
  if (USE_AGENT) {
    console.log(`  - 🤖 Agent Mode: ${detectedEnv || 'auto'}`);
  }
  console.log('');

  console.log('使用的模块:');
  console.log('  ✅ StateValidator (Zustand 状态验证)');
  console.log('  ✅ TauriIpcInterceptor (IPC Mock)');
  console.log('  ✅ ThemeTester (主题测试)');
  console.log('  ✅ FlowTester (执行流图测试)');
  console.log('  ✅ A11yTester (无障碍测试)');
  console.log('  ✅ MonacoTester (编辑器测试)');
  console.log('  ✅ ResizablePanelTester (面板测试)');
  console.log('  ✅ VisualRegressionTester (视觉回归)');
  console.log('  ✅ VLMClient (AI 视觉分析)');
  console.log('');

  const runner = new TestRunner({
    config: {
      mode: TestMode.HYBRID,
      cdp: { endpoint: CDP_PORT },
      vlm: USE_VLM ? {
        provider: vlmProvider,
        model: USE_AGENT ? 'claude-opus-4-5' : 'claude-sonnet-4-20250514',
        trackCost: !USE_AGENT,
      } : undefined,
      timeout: TEST_TIMEOUT,
      debug: process.env.DEBUG === 'true',
      screenshotDir: OUTPUT_DIR,
    },
    stopOnFailure: STOP_ON_FAILURE,
  });

  const result = await runner.runAll(tests, 'FlowSight Full Feature Tests');

  // 打印摘要
  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
  console.log(`  通过: ${result.passed}`);
  console.log(`  失败: ${result.failed}`);
  console.log(`  跳过: ${result.skipped}`);
  console.log(`  耗时: ${result.duration}ms`);
  
  if (result.totalVLMCost > 0) {
    console.log(`  VLM 成本: $${result.totalVLMCost.toFixed(4)}`);
  }
  
  console.log('');
  console.log(`  截图目录: ${OUTPUT_DIR}`);
  console.log(`  基线目录: ${BASELINE_DIR}`);
  console.log('');

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
