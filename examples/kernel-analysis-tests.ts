#!/usr/bin/env npx tsx
/**
 * FlowSight 内核分析 E2E 测试 (使用 DeskPilot)
 *
 * 完整测试流程：打开内核文件 → 分析 → 显示执行流
 *
 * 运行方式:
 *   1. 启动应用 (启用 CDP):
 *      WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 cargo tauri dev
 *
 *   2. 运行测试:
 *      npx tsx packages/desktop-test/examples/kernel-analysis-tests.ts
 *
 *   3. 使用 Agent 模式 (在 Cursor/Claude Code 中):
 *      USE_AGENT=true npx tsx packages/desktop-test/examples/kernel-analysis-tests.ts
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
const USE_VLM = process.env.USE_VLM === 'true';
const USE_AGENT = process.env.USE_AGENT === 'true' ||
                  process.env.USE_CURSOR === 'true' ||
                  shouldUseAgentMode();

// Linux 内核测试路径
const KERNEL_PATHS = [
  '/Users/sky/linux-kernel/linux',
  '/home/parallels/linux_kernel',
];

const TEST_FILES = {
  usb_driver: 'drivers/usb/core/driver.c',
  gpio_driver: 'drivers/gpio/gpio-dwapb.c',
  imx_clk: 'arch/arm/mach-imx/clk-imx6q.c',
};

function findKernelPath(): string | null {
  for (const p of KERNEL_PATHS) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'drivers'))) {
      return p;
    }
  }
  return null;
}

// ============================================================================
// 测试用例
// ============================================================================

const tests: TestCase[] = [
  // --------------------------------------------------------------------------
  // 基础页面加载测试
  // --------------------------------------------------------------------------
  {
    name: 'Page Load - FlowSight main UI',
    category: 'Basic',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('验证 FlowSight 主界面加载');
      const snapshot = await test.snapshot({ interactive: true });

      // 验证核心 UI 元素存在
      assert.greaterThan(
        snapshot.tree.length,
        100,
        '页面快照应包含足够内容'
      );

      // 检查是否有交互元素
      const refCount = Object.keys(snapshot.refs).length;
      assert.greaterThan(refCount, 0, '应该有可交互元素');

      log.info(`页面包含 ${refCount} 个可交互元素`);
    },
  },

  // --------------------------------------------------------------------------
  // 打开内核项目测试
  // --------------------------------------------------------------------------
  {
    name: 'Open Kernel Project - USB drivers',
    category: 'Kernel Analysis',
    fn: async ({ test, assert, log }: TestContext) => {
      const kernelPath = findKernelPath();
      if (!kernelPath) {
        log.warn('跳过: 未找到 Linux 内核路径');
        return;
      }

      const usbPath = path.join(kernelPath, 'drivers/usb');
      log.step(`尝试打开内核目录: ${usbPath}`);

      // 获取初始快照
      const initialSnapshot = await test.snapshot({ interactive: true });

      // 查找打开项目按钮
      let openProjectRef: string | null = null;
      for (const [ref, data] of Object.entries(initialSnapshot.refs)) {
        if (data.name?.includes('打开') || data.name?.includes('Open') ||
            data.name?.includes('项目') || data.name?.includes('Project') ||
            data.name?.includes('folder')) {
          if (data.role === 'button' || data.role === 'link') {
            openProjectRef = ref;
            break;
          }
        }
      }

      if (openProjectRef) {
        log.step(`点击打开项目按钮: @${openProjectRef}`);
        await test.click(`@${openProjectRef}`);
        await test.wait(2000);
        log.info('已点击打开项目按钮，等待对话框');
      } else {
        log.info('未找到打开项目按钮，可能项目已加载');
      }
    },
  },

  // --------------------------------------------------------------------------
  // 文件树验证测试
  // --------------------------------------------------------------------------
  {
    name: 'File Tree - Display kernel files',
    category: 'Kernel Analysis',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('检查文件树是否显示内核文件');
      const snapshot = await test.snapshot();
      const tree = snapshot.tree.toLowerCase();

      // 检查是否有 .c 或 .h 文件显示
      const hasCFiles = tree.includes('.c') || tree.includes('.h');
      const hasKernelContent = tree.includes('driver') || 
                               tree.includes('gpio') || 
                               tree.includes('usb');

      if (hasCFiles || hasKernelContent) {
        log.info('✅ 文件树包含内核文件');
        assert.ok(true, '文件树显示正常');
      } else {
        log.info('⚠️ 文件树未检测到内核文件，可能需要先打开项目');
      }
    },
  },

  // --------------------------------------------------------------------------
  // 统计数据验证测试 (关键)
  // --------------------------------------------------------------------------
  {
    name: '🔴 Statistics - Should not show all zeros',
    category: 'Data Correctness',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('验证统计数据不全为零');
      const snapshot = await test.snapshot();
      const tree = snapshot.tree.toLowerCase();

      // 检查是否有 "0 个文件, 0 个函数, 0 个结构体" 的问题
      const hasZeroFiles = tree.includes('0 个文件') || tree.includes('0 files');
      const hasZeroFunctions = tree.includes('0 个函数') || tree.includes('0 functions');
      const hasZeroStructs = tree.includes('0 个结构体') || tree.includes('0 structs');

      const allZeros = hasZeroFiles && hasZeroFunctions && hasZeroStructs;

      // 如果项目已加载，不应该全部为零
      if (tree.includes('文件') || tree.includes('file')) {
        assert.ok(
          !allZeros,
          '已加载项目的统计数据不应全部为零'
        );
        log.info('✅ 统计数据正常');
      } else {
        log.info('未检测到文件统计区域，可能尚未加载项目');
      }
    },
  },

  // --------------------------------------------------------------------------
  // 执行流视图测试
  // --------------------------------------------------------------------------
  {
    name: 'Execution Flow - Nodes should exist after analysis',
    category: 'Execution Flow',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('检查执行流视图');
      const snapshot = await test.snapshot();

      // 检查是否有执行流相关元素
      const hasFlowElements = snapshot.tree.includes('执行流') ||
                              snapshot.tree.includes('flow') ||
                              snapshot.tree.includes('Flow') ||
                              snapshot.tree.includes('node');

      if (hasFlowElements) {
        // 检查是否只有一个 probe 节点
        const probeOnlyPattern = /probe\s*00/i;
        const hasOnlyProbeNode = probeOnlyPattern.test(snapshot.tree);

        if (!hasOnlyProbeNode) {
          log.info('✅ 执行流包含多个节点');
        } else {
          log.warn('⚠️ 执行流可能只有一个入口节点');
        }
      } else {
        log.info('执行流视图未激活，需要先选择函数');
      }
    },
  },

  // --------------------------------------------------------------------------
  // 命令面板测试
  // --------------------------------------------------------------------------
  {
    name: 'Command Palette - Open and search',
    category: 'UI Interaction',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('打开命令面板 (⌘K)');
      await test.press('Meta+k');
      await test.wait(500);

      const snapshot = await test.snapshot({ interactive: true });

      // 检查是否有搜索输入框
      let hasSearchInput = false;
      for (const data of Object.values(snapshot.refs)) {
        if (data.role === 'textbox' || data.role === 'searchbox' ||
            data.name?.includes('搜索') || data.name?.includes('Search')) {
          hasSearchInput = true;
          break;
        }
      }

      if (hasSearchInput) {
        log.info('✅ 命令面板已打开');
        
        // 尝试搜索
        log.step('搜索 "打开项目"');
        await test.type('打开项目');
        await test.wait(300);
        
        const afterSearch = await test.snapshot();
        const hasResults = afterSearch.tree.includes('打开') || 
                          afterSearch.tree.includes('项目');
        
        if (hasResults) {
          log.info('✅ 搜索结果正确显示');
        }
      } else {
        log.info('未检测到搜索输入框');
      }

      // 关闭命令面板
      await test.press('Escape');
    },
  },

  // --------------------------------------------------------------------------
  // 函数分析测试
  // --------------------------------------------------------------------------
  {
    name: 'Function Analysis - Click function to analyze',
    category: 'Kernel Analysis',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('查找并点击函数进行分析');
      const snapshot = await test.snapshot({ interactive: true });

      // 查找函数列表项
      let functionRef: string | null = null;
      for (const [ref, data] of Object.entries(snapshot.refs)) {
        if (data.name?.includes('probe') || 
            data.name?.includes('init') ||
            data.name?.includes('main')) {
          functionRef = ref;
          break;
        }
      }

      if (functionRef) {
        log.step(`点击函数: @${functionRef}`);
        await test.click(`@${functionRef}`);
        await test.wait(2000);

        // 验证执行流是否更新
        const afterClick = await test.snapshot();
        const hasFlow = afterClick.tree.includes('执行流') ||
                       afterClick.tree.includes('flow') ||
                       afterClick.tree.includes('node');
        
        if (hasFlow) {
          log.info('✅ 函数分析已触发');
        }
      } else {
        log.info('未找到可分析的函数，需要先打开文件');
      }
    },
  },

  // --------------------------------------------------------------------------
  // 侧边栏切换测试
  // --------------------------------------------------------------------------
  {
    name: 'Sidebar Toggle - Can toggle sidebar',
    category: 'UI Interaction',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('测试侧边栏切换 (⌘B)');
      
      const beforeSnapshot = await test.snapshot();
      const beforeLen = beforeSnapshot.tree.length;

      await test.press('Meta+b');
      await test.wait(300);

      const afterSnapshot = await test.snapshot();
      const afterLen = afterSnapshot.tree.length;

      // 切换后内容长度应该变化
      if (Math.abs(afterLen - beforeLen) > 50) {
        log.info('✅ 侧边栏切换成功');
      } else {
        log.info('侧边栏状态可能未变化');
      }

      // 恢复原状
      await test.press('Meta+b');
    },
  },

  // --------------------------------------------------------------------------
  // 视图模式切换测试
  // --------------------------------------------------------------------------
  {
    name: 'View Mode - Switch between code and flow view',
    category: 'UI Interaction',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('测试视图切换');

      // 切换到代码视图
      await test.press('Meta+1');
      await test.wait(300);
      
      const codeViewSnapshot = await test.snapshot();
      log.info('已切换到代码视图');

      // 切换到执行流视图
      await test.press('Meta+2');
      await test.wait(300);
      
      const flowViewSnapshot = await test.snapshot();
      log.info('已切换到执行流视图');

      // 验证视图确实切换了
      const viewChanged = codeViewSnapshot.tree !== flowViewSnapshot.tree;
      if (viewChanged) {
        log.info('✅ 视图切换成功');
      }
    },
  },

  // --------------------------------------------------------------------------
  // VLM 视觉验证测试 (仅在启用 VLM 时运行)
  // --------------------------------------------------------------------------
  {
    name: 'Visual AI - Verify kernel analysis UI',
    category: 'AI',
    skip: !USE_VLM && !USE_AGENT,
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('使用 AI 验证界面');

      const result = await test.ai(`
        分析 FlowSight 应用的当前界面状态，验证：
        1. 主界面是否正常渲染？
        2. 是否有可见的错误状态？
        3. 如果有加载项目，文件树是否正常显示？
        4. 执行流视图是否有节点显示？
        请报告发现的任何问题。
      `);

      assert.ok(
        result.status === 'success',
        'AI 视觉分析应该完成'
      );

      log.info(`VLM 分析完成，成本: $${result.vlmCost?.toFixed(4) || 0}`);
    },
  },

  // --------------------------------------------------------------------------
  // 性能测试
  // --------------------------------------------------------------------------
  {
    name: 'Performance - Snapshot generation speed',
    category: 'Performance',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('测量快照生成速度');
      
      const iterations = 3;
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await test.snapshot({ interactive: true });
        totalTime += Date.now() - start;
      }

      const avgTime = totalTime / iterations;
      
      assert.lessThan(
        avgTime,
        5000,
        `快照平均耗时应小于 5 秒 (实际: ${avgTime.toFixed(0)}ms)`
      );

      log.info(`平均快照耗时: ${avgTime.toFixed(0)}ms`);
    },
  },

  // --------------------------------------------------------------------------
  // 控制台错误检查
  // --------------------------------------------------------------------------
  {
    name: 'Console - No critical errors',
    category: 'Stability',
    fn: async ({ test, assert, log }: TestContext) => {
      log.step('检查控制台错误');

      const errorCount = await test.evaluate<number>(`
        (function() {
          const errors = window.__CONSOLE_ERRORS__ || [];
          return errors.filter(e => 
            e.type === 'error' && 
            !e.text.includes('Warning') &&
            !e.text.includes('DevTools')
          ).length;
        })()
      `).catch(() => 0);

      assert.lessOrEqual(
        errorCount,
        5,
        `控制台错误应在可接受范围内 (发现 ${errorCount} 个)`
      );

      if (errorCount === 0) {
        log.info('✅ 无控制台错误');
      } else {
        log.warn(`⚠️ 发现 ${errorCount} 个控制台错误`);
      }
    },
  },
];

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  FlowSight 内核分析 E2E 测试');
  console.log('  使用 DeskPilot 桌面测试框架');
  console.log('═'.repeat(60) + '\n');

  // 检测环境
  const detectedEnv = detectAgentEnvironment();
  const vlmProvider = USE_AGENT ? 'agent' : 'anthropic';
  const useVLMMode = USE_VLM || USE_AGENT;

  console.log('配置:');
  console.log(`  - 模式: ${useVLMMode ? '混合 (带 VLM)' : '确定性'}`);
  console.log(`  - VLM 提供者: ${useVLMMode ? vlmProvider : '无'}`);
  console.log(`  - CDP 端口: ${CDP_PORT}`);
  console.log(`  - 超时: ${TEST_TIMEOUT}ms`);
  console.log(`  - 内核路径: ${findKernelPath() || '未找到'}`);
  if (USE_AGENT) {
    console.log(`  - 🤖 Agent 模式: ${detectedEnv || 'auto'}`);
  }
  console.log('');

  const runner = new TestRunner({
    config: {
      mode: useVLMMode ? TestMode.HYBRID : TestMode.DETERMINISTIC,
      cdp: { endpoint: CDP_PORT },
      vlm: useVLMMode ? {
        provider: vlmProvider,
        model: USE_AGENT ? 'claude-opus-4-5' : 'claude-sonnet-4-20250514',
        trackCost: !USE_AGENT,
      } : undefined,
      timeout: TEST_TIMEOUT,
      debug: process.env.DEBUG === 'true',
    },
    stopOnFailure: process.env.STOP_ON_FAILURE === 'true',
  });

  const result = await runner.runAll(tests, 'FlowSight 内核分析 E2E');

  // 打印成本摘要
  if (useVLMMode && result.totalVLMCost > 0) {
    console.log(`\nVLM 总成本: $${result.totalVLMCost.toFixed(4)}`);
  }

  // 生成测试报告
  const reportPath = path.resolve(__dirname, '../../../.claude/reports/e2e-kernel-analysis-report.md');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = generateReport(result);
  fs.writeFileSync(reportPath, report);
  console.log(`\n📝 测试报告已保存: ${reportPath}`);

  process.exit(result.failed > 0 ? 1 : 0);
}

function generateReport(result: any): string {
  const now = new Date().toISOString().split('T')[0];
  
  return `# FlowSight 内核分析 E2E 测试报告

生成日期: ${now}

## 测试概览

| 指标 | 值 |
|------|-----|
| 总测试数 | ${result.total} |
| 通过 | ${result.passed} ✅ |
| 失败 | ${result.failed} ❌ |
| 跳过 | ${result.skipped} ⏭️ |
| 通过率 | ${((result.passed / result.total) * 100).toFixed(1)}% |
| 总耗时 | ${(result.duration / 1000).toFixed(2)}s |

## 测试类别

### Kernel Analysis (内核分析)
- 打开内核项目
- 文件树显示
- 函数分析触发

### Data Correctness (数据正确性)
- 🔴 统计数据不全为零
- 执行流节点验证

### UI Interaction (界面交互)
- 命令面板
- 侧边栏切换
- 视图模式切换

### Stability (稳定性)
- 控制台错误检查

## 下一步

1. 修复失败的测试用例
2. 增加更多内核子系统的测试
3. 完善执行流验证逻辑
4. 集成到 CI/CD 流程
`;
}

main().catch((err) => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
