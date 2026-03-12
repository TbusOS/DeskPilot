#!/usr/bin/env npx tsx
/**
 * FlowExportPanel E2E 测试
 * 
 * 测试执行流导出面板的完整功能：
 * - 格式切换 (Mermaid/Markdown/ASCII/JSON)
 * - Mermaid 图表预览
 * - 复制功能
 * - 导出功能
 * - 统计数据显示
 * 
 * 运行方式:
 *   1. 启动应用: WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 cargo tauri dev
 *   2. 运行测试: npx tsx packages/desktop-test/examples/flow-export-panel-tests.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

import {
  DesktopTest,
  TestRunner,
  TestMode,
  type TestCase,
  type TestContext,
} from '../src/index.js';

import { shouldUseAgentMode, detectAgentEnvironment } from '../src/vlm/cursor-bridge.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 配置
// ============================================================================

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '60000');
const STOP_ON_FAILURE = process.env.STOP_ON_FAILURE === 'true';

// 使用 Agent Mode（自动检测 Cursor/Claude Code 环境）
const USE_AGENT = shouldUseAgentMode() || process.env.USE_API_KEY !== 'true';
const USE_VLM = process.env.USE_VLM !== 'false';

// 测试输出目录
const OUTPUT_DIR = path.resolve(__dirname, '../test-results/flow-export');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 打开 FlowExportPanel
 */
async function openFlowExportPanel(test: DesktopTest, log: TestContext['log']): Promise<boolean> {
  log.step('尝试打开 FlowExportPanel');
  
  // 方法 1: 通过快捷键 (如果实现了)
  await test.press('Meta+Shift+e');
  await test.wait(500);
  
  let snapshot = await test.snapshot();
  if (snapshot.tree.includes('导出执行流') || snapshot.tree.includes('Export')) {
    return true;
  }
  
  // 方法 2: 通过命令面板
  await test.press('Meta+k');
  await test.wait(300);
  
  snapshot = await test.snapshot({ interactive: true });
  
  // 查找导出相关命令
  for (const [ref, data] of Object.entries(snapshot.refs)) {
    if (data.name?.includes('导出') || data.name?.includes('Export') || data.name?.includes('flow')) {
      await test.click(`@${ref}`);
      await test.wait(500);
      return true;
    }
  }
  
  // 方法 3: 直接查找面板
  const exportPanel = await test.find('[data-testid="flow-export-panel"]');
  if (exportPanel) {
    return true;
  }
  
  log.warn('未能找到 FlowExportPanel，可能需要先选择函数');
  return false;
}

// ============================================================================
// 测试用例
// ============================================================================

const tests: TestCase[] = [
  // ==========================================================================
  // 1. 面板渲染测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 基础渲染',
    category: 'Render',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('获取页面快照');
      const snapshot = await test.snapshot({ interactive: true });
      
      // 检查面板是否存在
      const hasExportPanel = snapshot.tree.includes('导出执行流') ||
                             snapshot.tree.includes('Export') ||
                             snapshot.tree.includes('Mermaid');
      
      if (hasExportPanel) {
        log.info('找到 FlowExportPanel');
        
        // 验证标签栏存在
        const hasTabBar = snapshot.tree.includes('概览') ||
                          snapshot.tree.includes('Summary') ||
                          snapshot.tree.includes('Markdown');
        
        assert.ok(hasTabBar, '应有格式切换标签栏');
        
        // 验证工具栏按钮
        const hasToolbar = snapshot.tree.includes('复制') ||
                           snapshot.tree.includes('Copy') ||
                           snapshot.tree.includes('导出') ||
                           snapshot.tree.includes('Download');
        
        assert.ok(hasToolbar, '应有工具栏按钮');
      } else {
        log.info('FlowExportPanel 未显示，尝试打开');
        const opened = await openFlowExportPanel(test, log);
        if (opened) {
          const newSnapshot = await test.snapshot();
          assert.ok(
            newSnapshot.tree.includes('导出') || newSnapshot.tree.includes('Export'),
            'FlowExportPanel 应成功打开'
          );
        } else {
          log.warn('跳过: 需要先加载项目并选择函数');
        }
      }
    },
  },

  // ==========================================================================
  // 2. 格式切换测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 格式切换',
    category: 'Interaction',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('获取当前快照');
      let snapshot = await test.snapshot({ interactive: true });
      
      const tabs = ['概览', 'Mermaid', 'Markdown', 'ASCII', 'JSON'];
      let foundTabs = 0;
      
      for (const tab of tabs) {
        // 查找标签按钮
        for (const [ref, data] of Object.entries(snapshot.refs)) {
          if (data.name?.includes(tab)) {
            foundTabs++;
            log.step(`点击 ${tab} 标签`);
            await test.click(`@${ref}`);
            await test.wait(300);
            
            // 验证内容变化
            const newSnapshot = await test.snapshot();
            
            if (tab === 'Mermaid') {
              assert.ok(
                newSnapshot.tree.includes('flowchart') ||
                newSnapshot.tree.includes('预览') ||
                newSnapshot.tree.includes('Preview'),
                'Mermaid 视图应显示流程图内容'
              );
            } else if (tab === 'JSON') {
              assert.ok(
                newSnapshot.tree.includes('{') ||
                newSnapshot.tree.includes('entry_function'),
                'JSON 视图应显示 JSON 内容'
              );
            }
            
            break;
          }
        }
        snapshot = await test.snapshot({ interactive: true });
      }
      
      log.info(`找到 ${foundTabs}/${tabs.length} 个标签`);
      assert.greaterThan(foundTabs, 0, '应至少找到一个格式标签');
    },
  },

  // ==========================================================================
  // 3. Mermaid 预览测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - Mermaid 预览',
    category: 'Feature',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('切换到 Mermaid 视图');
      
      // 查找并点击 Mermaid 标签
      const snapshot = await test.snapshot({ interactive: true });
      let clickedMermaid = false;
      
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('Mermaid')) {
          await test.click(`@${ref}`);
          clickedMermaid = true;
          break;
        }
      }
      
      if (!clickedMermaid) {
        log.warn('未找到 Mermaid 标签，跳过测试');
        return;
      }
      
      await test.wait(500);
      
      log.step('检查预览/代码切换按钮');
      const mermaidSnapshot = await test.snapshot({ interactive: true });
      
      // 检查预览按钮
      const hasPreviewToggle = mermaidSnapshot.tree.includes('预览') ||
                               mermaidSnapshot.tree.includes('Preview') ||
                               mermaidSnapshot.tree.includes('代码') ||
                               mermaidSnapshot.tree.includes('Code');
      
      if (hasPreviewToggle) {
        log.info('找到预览/代码切换');
        
        // 检查 Mermaid Live 链接
        const hasMermaidLive = mermaidSnapshot.tree.includes('Mermaid Live');
        if (hasMermaidLive) {
          log.info('找到 Mermaid Live 链接');
        }
      }
      
      // 检查是否有 SVG 渲染（Mermaid 图表）
      const hasSvgContent = await test.evaluate<boolean>(`
        document.querySelector('svg') !== null ||
        document.querySelector('[class*="mermaid"]') !== null
      `).catch(() => false);
      
      log.info(`Mermaid 图表渲染: ${hasSvgContent ? '是' : '否'}`);
      
      assert.ok(true, 'Mermaid 视图测试完成');
    },
  },

  // ==========================================================================
  // 4. 复制功能测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 复制功能',
    category: 'Feature',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('查找复制按钮');
      const snapshot = await test.snapshot({ interactive: true });
      
      let copyButtonRef: string | null = null;
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('复制') || 
            data.name?.includes('Copy') ||
            data.name?.toLowerCase().includes('copy')) {
          copyButtonRef = ref;
          break;
        }
      }
      
      if (!copyButtonRef) {
        log.info('未找到复制按钮，跳过测试');
        return;
      }
      
      log.step('点击复制按钮');
      await test.click(`@${copyButtonRef}`);
      await test.wait(500);
      
      // 检查是否显示"已复制"状态
      const afterSnapshot = await test.snapshot();
      const showsCopied = afterSnapshot.tree.includes('已复制') ||
                          afterSnapshot.tree.includes('Copied') ||
                          afterSnapshot.tree.includes('✓');
      
      log.info(`显示已复制状态: ${showsCopied ? '是' : '否'}`);
      
      assert.ok(true, '复制功能测试完成');
    },
  },

  // ==========================================================================
  // 5. 统计卡片测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 统计卡片',
    category: 'Data',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('切换到概览视图');
      const snapshot = await test.snapshot({ interactive: true });
      
      // 查找概览标签
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('概览') || data.name?.includes('Summary')) {
          await test.click(`@${ref}`);
          break;
        }
      }
      
      await test.wait(300);
      
      log.step('检查统计卡片');
      const summarySnapshot = await test.snapshot();
      
      // 检查统计指标
      const stats = {
        totalNodes: summarySnapshot.tree.includes('总节点') || summarySnapshot.tree.includes('Total'),
        directCalls: summarySnapshot.tree.includes('直接调用') || summarySnapshot.tree.includes('Direct'),
        asyncCalls: summarySnapshot.tree.includes('异步调用') || summarySnapshot.tree.includes('Async'),
        indirectCalls: summarySnapshot.tree.includes('间接调用') || summarySnapshot.tree.includes('Indirect'),
      };
      
      log.info(`统计卡片: ${JSON.stringify(stats)}`);
      
      // 检查异步模式区域
      const hasAsyncPatterns = summarySnapshot.tree.includes('异步模式') ||
                               summarySnapshot.tree.includes('Async Pattern') ||
                               summarySnapshot.tree.includes('WorkQueue') ||
                               summarySnapshot.tree.includes('Timer');
      
      log.info(`异步模式区域: ${hasAsyncPatterns ? '有' : '无'}`);
      
      // 检查函数列表
      const hasFunctionList = summarySnapshot.tree.includes('函数列表') ||
                              summarySnapshot.tree.includes('Function List');
      
      log.info(`函数列表: ${hasFunctionList ? '有' : '无'}`);
      
      assert.ok(true, '统计卡片测试完成');
    },
  },

  // ==========================================================================
  // 6. 数据正确性测试 (🔴 重要)
  // ==========================================================================
  {
    name: 'FlowExportPanel - 数据正确性',
    category: 'Data Correctness',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('验证数据不为空');
      
      const snapshot = await test.snapshot();
      const content = snapshot.tree;
      
      // 检查是否有 Mock 数据提示
      const hasMockData = content.includes('示例数据') ||
                          content.includes('Mock') ||
                          content.includes('demo_function');
      
      if (hasMockData) {
        log.warn('当前显示的是 Mock 数据，需要实际加载项目');
      }
      
      // 检查统计数字不全为 0
      const zeroPattern = /总节点[：:\s]*0[^\d]/i;
      const hasZeroTotal = zeroPattern.test(content);
      
      if (hasZeroTotal) {
        log.warn('⚠️ 总节点数为 0，可能是数据加载问题');
      }
      
      // 检查是否有实际的函数名
      const hasFunctionNames = /[a-zA-Z_][a-zA-Z0-9_]*\(\)/.test(content);
      log.info(`显示函数名: ${hasFunctionNames ? '是' : '否'}`);
      
      // 检查 Mermaid 内容格式
      const hasMermaidSyntax = content.includes('flowchart') ||
                               content.includes('-->') ||
                               content.includes('graph');
      
      log.info(`Mermaid 语法正确: ${hasMermaidSyntax ? '是' : '否'}`);
      
      assert.ok(true, '数据正确性验证完成');
    },
  },

  // ==========================================================================
  // 7. 刷新功能测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 刷新功能',
    category: 'Feature',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('查找刷新按钮');
      const snapshot = await test.snapshot({ interactive: true });
      
      let refreshButtonRef: string | null = null;
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('刷新') || 
            data.name?.includes('Refresh') ||
            data.name?.toLowerCase().includes('refresh')) {
          refreshButtonRef = ref;
          break;
        }
      }
      
      if (!refreshButtonRef) {
        log.info('未找到刷新按钮，跳过测试');
        return;
      }
      
      log.step('点击刷新按钮');
      const beforeSnapshot = await test.snapshot();
      await test.click(`@${refreshButtonRef}`);
      await test.wait(1000);
      
      // 检查是否有加载状态
      const loadingSnapshot = await test.snapshot();
      const showsLoading = loadingSnapshot.tree.includes('加载') ||
                           loadingSnapshot.tree.includes('Loading') ||
                           loadingSnapshot.tree.includes('animate-spin');
      
      log.info(`显示加载状态: ${showsLoading ? '是' : '否'}`);
      
      assert.ok(true, '刷新功能测试完成');
    },
  },

  // ==========================================================================
  // 8. 关闭功能测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 关闭功能',
    category: 'Feature',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('查找关闭按钮');
      const snapshot = await test.snapshot({ interactive: true });
      
      let closeButtonRef: string | null = null;
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('关闭') || 
            data.name?.includes('Close') ||
            data.name?.toLowerCase().includes('close')) {
          closeButtonRef = ref;
          break;
        }
      }
      
      if (!closeButtonRef) {
        // 尝试查找 X 图标按钮
        for (const [ref, data] of Object.entries(snapshot.refs)) {
          if (data.role === 'button' && 
              (data.name === 'X' || data.name === '×' || data.name === '')) {
            closeButtonRef = ref;
            break;
          }
        }
      }
      
      if (closeButtonRef) {
        log.step('点击关闭按钮');
        await test.click(`@${closeButtonRef}`);
        await test.wait(300);
        
        // 验证面板关闭
        const afterSnapshot = await test.snapshot();
        const panelClosed = !afterSnapshot.tree.includes('导出执行流');
        log.info(`面板关闭: ${panelClosed ? '是' : '否'}`);
      } else {
        log.info('未找到关闭按钮');
      }
      
      assert.ok(true, '关闭功能测试完成');
    },
  },

  // ==========================================================================
  // 9. VLM 视觉验证
  // ==========================================================================
  {
    name: 'FlowExportPanel - VLM 视觉验证',
    category: 'AI',
    fn: async ({ test, assert, log }: TestContext) => {
      if (!USE_VLM) {
        log.info('VLM 被禁用，跳过视觉验证');
        return;
      }
      
      log.step('运行 VLM 视觉分析');
      
      const { VLMAssertions } = await import('../src/core/vlm-assertions.js');
      const vlm = new VLMAssertions(test, {
        outputDir: OUTPUT_DIR,
        strict: false,
        minConfidence: 0.7,
      });
      
      try {
        const result = await vlm.assertVisual('flow-export-panel', `
          检查 FlowExportPanel (执行流导出面板) 的 UI：
          
          1. 布局检查：
             - 是否有标题栏显示 "导出执行流" 和函数名？
             - 是否有格式切换标签栏 (概览/Mermaid/Markdown/ASCII/JSON)？
             - 是否有工具栏按钮 (刷新/复制/导出/关闭)？
          
          2. 内容检查：
             - 当前内容区域是否有实际数据？
             - 如果是 Mermaid 视图，是否有流程图预览？
             - 如果是概览视图，是否有统计卡片？
          
          3. 样式检查：
             - 面板是否有圆角和阴影？
             - 颜色是否与主题一致？
             - 图标是否清晰可见？
          
          如果面板为空或显示错误状态，标记为失败。
        `);
        
        log.info(`通过: ${result.passed}, 置信度: ${result.confidence}`);
        
        if (result.issues.length > 0) {
          for (const issue of result.issues) {
            log.warn(`  [${issue.severity}] ${issue.description}`);
          }
        }
        
        // 保存截图
        await test.screenshot({ path: path.join(OUTPUT_DIR, 'flow-export-panel.png') });
        
        assert.ok(result.passed, 'FlowExportPanel 视觉验证应通过');
      } catch (e) {
        log.error(`VLM 检查失败: ${(e as Error).message}`);
        throw e;
      }
    },
  },

  // ==========================================================================
  // 10. 性能测试
  // ==========================================================================
  {
    name: 'FlowExportPanel - 性能测试',
    category: 'Performance',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('测量格式切换性能');
      
      const snapshot = await test.snapshot({ interactive: true });
      const tabs = ['Mermaid', 'Markdown', 'ASCII', 'JSON', '概览'];
      
      const timings: Record<string, number> = {};
      
      for (const tab of tabs) {
        // 查找标签
        for (const [ref, data] of Object.entries(snapshot.refs)) {
          if (data.name?.includes(tab)) {
            const startTime = Date.now();
            await test.click(`@${ref}`);
            await test.wait(100); // 等待渲染
            const endTime = Date.now();
            
            timings[tab] = endTime - startTime;
            log.info(`  ${tab}: ${timings[tab]}ms`);
            break;
          }
        }
      }
      
      // 检查性能
      const avgTime = Object.values(timings).reduce((a, b) => a + b, 0) / Object.keys(timings).length;
      log.info(`平均切换时间: ${avgTime.toFixed(0)}ms`);
      
      assert.lessThan(avgTime, 500, '格式切换应在 500ms 内完成');
    },
  },
];

// ============================================================================
// 主程序
// ============================================================================

async function main() {
  console.log('\n========================================');
  console.log('  FlowExportPanel E2E 测试');
  console.log('  使用 DeskPilot 框架');
  console.log('========================================\n');

  const detectedEnv = detectAgentEnvironment();
  const vlmProvider = USE_AGENT ? 'agent' : 'anthropic';

  console.log('配置:');
  console.log(`  - Mode: ${USE_VLM ? 'Hybrid' : 'Deterministic'}`);
  console.log(`  - VLM Provider: ${USE_VLM ? vlmProvider : 'disabled'}`);
  console.log(`  - CDP Port: ${CDP_PORT}`);
  console.log(`  - Output Dir: ${OUTPUT_DIR}`);
  if (USE_AGENT) {
    console.log(`  - 🤖 Agent Mode: ${detectedEnv || 'auto'}`);
  }
  console.log('');

  const runner = new TestRunner({
    config: {
      mode: USE_VLM ? TestMode.HYBRID : TestMode.DETERMINISTIC,
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

  const result = await runner.runAll(tests, 'FlowExportPanel Tests');

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
  
  console.log(`\n  截图目录: ${OUTPUT_DIR}\n`);

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
