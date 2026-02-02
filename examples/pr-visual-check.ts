#!/usr/bin/env npx tsx
/**
 * PR Visual Check - AI 视觉检查脚本
 * 
 * 在每个 PR 上自动运行，使用 VLM 检查：
 * 1. 页面是否有空白区域
 * 2. 数据是否正确显示（不为零）
 * 3. 布局是否正确
 * 4. 无障碍性是否达标
 * 
 * 失败则阻塞 PR 合并。
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  DesktopTest,
  TestMode,
} from '../src/index.js';

import { VLMAssertions } from '../src/core/vlm-assertions.js';
import { TauriIpcInterceptor } from '../src/core/tauri-ipc-interceptor.js';

// ============================================================================
// 配置
// ============================================================================

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');
const OUTPUT_DIR = path.resolve(__dirname, '../test-results');
const PR_NUMBER = process.env.PR_NUMBER || 'local';
const PR_TITLE = process.env.PR_TITLE || 'Local Test';

// 确保目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================================================
// Mock 数据（模拟已打开项目）
// ============================================================================

async function setupMocks(test: DesktopTest): Promise<void> {
  const ipc = new TauriIpcInterceptor(test);
  await ipc.setup();

  // Mock 项目数据
  await ipc.mock('open_project', {
    response: {
      path: '/mock/linux-kernel/drivers/gpio',
      files_count: 142,
      functions_count: 856,
      structs_count: 67,
      indexed: true,
    }
  });

  await ipc.mock('get_index_stats', {
    response: {
      files: 142,
      functions: 856,
      structs: 67,
    }
  });

  await ipc.mock('list_directory', {
    response: [
      { name: 'gpio-core.c', path: '/mock/gpio-core.c', is_dir: false, extension: 'c' },
      { name: 'gpio-pci.c', path: '/mock/gpio-pci.c', is_dir: false, extension: 'c' },
      { name: 'gpio-mmio.c', path: '/mock/gpio-mmio.c', is_dir: false, extension: 'c' },
    ]
  });

  await ipc.mock('get_functions', {
    response: [
      { name: 'gpio_probe', line: 42, kind: 'function' },
      { name: 'gpio_remove', line: 100, kind: 'function' },
      { name: 'gpio_request', line: 150, kind: 'function' },
    ]
  });

  await ipc.mock('build_execution_flow', {
    response: {
      entry_function: 'gpio_probe',
      nodes: [
        { id: 'n1', label: 'gpio_probe', node_type: 'entry' },
        { id: 'n2', label: 'devm_gpiochip_add_data', node_type: 'sync' },
        { id: 'n3', label: 'gpio_irq_handler', node_type: 'async' },
      ],
      edges: [
        { source: 'n1', target: 'n2' },
        { source: 'n2', target: 'n3' },
      ]
    }
  });
}

// ============================================================================
// 视觉检查
// ============================================================================

interface CheckResult {
  name: string;
  passed: boolean;
  issues: string[];
  screenshot: string;
}

async function runVisualChecks(): Promise<void> {
  console.log('\n========================================');
  console.log('  PR Visual Check');
  console.log(`  PR #${PR_NUMBER}: ${PR_TITLE}`);
  console.log('========================================\n');

  // 优先使用 Agent Mode（Cursor/Claude Code 环境免费）
  // 只有在明确设置 USE_API_KEY=true 时才用 API Key
  const useAgent = process.env.USE_API_KEY !== 'true';
  
  const test = new DesktopTest({
    mode: TestMode.HYBRID,
    cdp: { endpoint: CDP_PORT },
    vlm: {
      provider: useAgent ? 'agent' : 'anthropic',  // 默认用 agent
      model: useAgent ? 'claude-opus-4-5' : 'claude-sonnet-4-20250514',
      trackCost: !useAgent,  // Agent 模式免费，不需要追踪
    },
    timeout: 60000,
    screenshotDir: OUTPUT_DIR,
  });
  
  if (useAgent) {
    console.log('🤖 使用 Agent Mode（Cursor/Claude Code 环境）');
  }

  const results: CheckResult[] = [];
  let totalCost = 0;

  try {
    await test.connect();
    console.log('✅ 连接成功\n');

    // 设置 Mock
    await setupMocks(test);
    console.log('✅ Mock 设置完成\n');

    // 等待页面加载
    await test.wait(3000);

    // 创建 VLM 断言实例
    const vlm = new VLMAssertions(test, {
      outputDir: OUTPUT_DIR,
      strict: false,
      minConfidence: 0.7,
    });

    // ========================================================================
    // 检查 1: 页面没有空白区域
    // ========================================================================
    console.log('🔍 检查 1: 页面空白区域...');
    try {
      const result = await vlm.assertNoEmptyAreas('pr-check-empty-areas');
      results.push({
        name: '空白区域检查',
        passed: result.passed,
        issues: result.issues.map(i => `[${i.severity}] ${i.description}`),
        screenshot: result.screenshot,
      });
      totalCost += result.cost || 0;
      console.log(result.passed ? '  ✅ 通过' : '  ❌ 失败');
    } catch (e) {
      results.push({
        name: '空白区域检查',
        passed: false,
        issues: [(e as Error).message],
        screenshot: '',
      });
      console.log('  ❌ 失败:', (e as Error).message);
    }

    // ========================================================================
    // 检查 2: 数据正确显示
    // ========================================================================
    console.log('🔍 检查 2: 数据显示...');
    try {
      const result = await vlm.assertDataVisible('pr-check-data', {
        expectedData: ['文件', '函数', '结构体'],
        notZero: true,
        notEmpty: true,
      });
      results.push({
        name: '数据显示检查',
        passed: result.passed,
        issues: result.issues.map(i => `[${i.severity}] ${i.description}`),
        screenshot: result.screenshot,
      });
      totalCost += result.cost || 0;
      console.log(result.passed ? '  ✅ 通过' : '  ❌ 失败');
    } catch (e) {
      results.push({
        name: '数据显示检查',
        passed: false,
        issues: [(e as Error).message],
        screenshot: '',
      });
      console.log('  ❌ 失败:', (e as Error).message);
    }

    // ========================================================================
    // 检查 3: 布局正确
    // ========================================================================
    console.log('🔍 检查 3: 布局检查...');
    try {
      const result = await vlm.assertLayoutCorrect('pr-check-layout', {
        expectedElements: ['侧边栏', '编辑器', '工具栏'],
        checkAlignment: true,
        checkOverlap: true,
      });
      results.push({
        name: '布局检查',
        passed: result.passed,
        issues: result.issues.map(i => `[${i.severity}] ${i.description}`),
        screenshot: result.screenshot,
      });
      totalCost += result.cost || 0;
      console.log(result.passed ? '  ✅ 通过' : '  ❌ 失败');
    } catch (e) {
      results.push({
        name: '布局检查',
        passed: false,
        issues: [(e as Error).message],
        screenshot: '',
      });
      console.log('  ❌ 失败:', (e as Error).message);
    }

    // ========================================================================
    // 检查 4: 无障碍性
    // ========================================================================
    console.log('🔍 检查 4: 无障碍性...');
    try {
      const result = await vlm.assertAccessibility('pr-check-a11y');
      results.push({
        name: '无障碍性检查',
        passed: result.passed,
        issues: result.issues.map(i => `[${i.severity}] ${i.description}`),
        screenshot: result.screenshot,
      });
      totalCost += result.cost || 0;
      console.log(result.passed ? '  ✅ 通过' : '  ❌ 失败');
    } catch (e) {
      results.push({
        name: '无障碍性检查',
        passed: false,
        issues: [(e as Error).message],
        screenshot: '',
      });
      console.log('  ❌ 失败:', (e as Error).message);
    }

    // ========================================================================
    // 检查 5: 整体 UI 质量
    // ========================================================================
    console.log('🔍 检查 5: 整体 UI 质量...');
    try {
      const result = await vlm.assertVisual('pr-check-overall', `
        对 FlowSight 应用进行整体 UI 质量评估：
        
        1. UI 是否看起来专业、现代？
        2. 颜色方案是否协调？
        3. 字体是否清晰易读？
        4. 交互元素（按钮、输入框）是否明显可识别？
        5. 是否有明显的 UI bug（如文字重叠、元素错位）？
        
        如果有任何明显问题，请标记为失败。
      `);
      results.push({
        name: '整体 UI 质量',
        passed: result.passed,
        issues: result.issues.map(i => `[${i.severity}] ${i.description}`),
        screenshot: result.screenshot,
      });
      totalCost += result.cost || 0;
      console.log(result.passed ? '  ✅ 通过' : '  ❌ 失败');
    } catch (e) {
      results.push({
        name: '整体 UI 质量',
        passed: false,
        issues: [(e as Error).message],
        screenshot: '',
      });
      console.log('  ❌ 失败:', (e as Error).message);
    }

    // ========================================================================
    // 生成报告
    // ========================================================================
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const hasFailure = failed > 0;

    console.log('\n========================================');
    console.log('  检查完成');
    console.log('========================================');
    console.log(`  通过: ${passed}/${results.length}`);
    console.log(`  失败: ${failed}/${results.length}`);
    console.log(`  VLM 成本: $${totalCost.toFixed(4)}`);
    console.log('');

    // 生成 Markdown 报告
    let report = `# PR #${PR_NUMBER} Visual Check Report\n\n`;
    report += `**PR Title:** ${PR_TITLE}\n\n`;
    report += `| 检查项 | 状态 |\n`;
    report += `|--------|------|\n`;
    
    for (const result of results) {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      report += `| ${result.name} | ${status} |\n`;
    }
    
    report += `\n**总计:** ${passed}/${results.length} 通过\n\n`;

    if (hasFailure) {
      report += `## ❌ 失败详情\n\n`;
      for (const result of results.filter(r => !r.passed)) {
        report += `### ${result.name}\n\n`;
        for (const issue of result.issues) {
          report += `- ${issue}\n`;
        }
        if (result.screenshot) {
          report += `\n📸 截图: \`${path.basename(result.screenshot)}\`\n`;
        }
        report += '\n';
      }
    }

    report += `\n---\n`;
    report += `*Generated by DeskPilot VLM Visual Check*\n`;
    report += `*VLM Cost: $${totalCost.toFixed(4)}*\n`;

    // 保存报告
    const reportPath = path.join(OUTPUT_DIR, 'vlm-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`📝 报告已保存: ${reportPath}`);

    // 如果有失败，创建标记文件
    if (hasFailure) {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'visual-check-failed'), 'true');
      console.log('\n❌ 视觉检查失败！PR 不应合并。');
    } else {
      // 移除失败标记（如果存在）
      const failedMarker = path.join(OUTPUT_DIR, 'visual-check-failed');
      if (fs.existsSync(failedMarker)) {
        fs.unlinkSync(failedMarker);
      }
      console.log('\n✅ 所有视觉检查通过！');
    }

    await test.disconnect();

    // 如果有失败，退出码为 1
    process.exit(hasFailure ? 1 : 0);

  } catch (error) {
    console.error('测试运行失败:', error);
    
    // 写入失败报告
    const report = `# PR #${PR_NUMBER} Visual Check Report\n\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'vlm-report.md'), 
      report + `\n\n## ❌ 测试运行失败\n\n\`\`\`\n${error}\n\`\`\`\n`);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'visual-check-failed'), 'true');
    
    process.exit(1);
  }
}

// 运行检查
runVisualChecks();
