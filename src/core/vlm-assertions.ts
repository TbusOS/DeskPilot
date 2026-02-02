/**
 * VLM Visual Assertions - AI-powered visual testing
 * 
 * 真正用 VLM 分析截图，不只是截图保存。
 * 提供强制性的视觉断言，失败则测试失败。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DesktopTest } from './desktop-test.js';

/**
 * 视觉断言结果
 */
export interface VLMAssertionResult {
  passed: boolean;
  confidence: number; // 0-1
  analysis: string;
  issues: VLMIssue[];
  screenshot: string;
  cost?: number;
}

/**
 * 发现的问题
 */
export interface VLMIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  type: 'empty_content' | 'broken_layout' | 'missing_element' | 'wrong_data' | 'accessibility' | 'other';
  description: string;
  location?: string;
}

/**
 * VLM 断言配置
 */
export interface VLMAssertionConfig {
  /** 输出目录 */
  outputDir: string;
  /** 严格模式 - minor 问题也会失败 */
  strict?: boolean;
  /** 最低置信度阈值 */
  minConfidence?: number;
  /** 自定义提示词 */
  customPrompt?: string;
}

/**
 * VLM Visual Assertions
 * 
 * @example
 * ```typescript
 * const vlm = new VLMAssertions(test, { outputDir: './test-results' });
 * 
 * // 断言页面没有空白区域
 * await vlm.assertNoEmptyAreas('main-page');
 * 
 * // 断言数据正确显示
 * await vlm.assertDataVisible('stats-panel', {
 *   expectedData: ['文件数', '函数数', '结构体数'],
 *   notZero: true,
 * });
 * 
 * // 断言布局正确
 * await vlm.assertLayoutCorrect('full-page', {
 *   expectedElements: ['侧边栏', '编辑器', '执行流视图', '状态栏'],
 * });
 * 
 * // 自定义视觉断言
 * await vlm.assertVisual('my-test', '检查按钮是否可见且可点击');
 * ```
 */
export class VLMAssertions {
  private test: DesktopTest;
  private config: Required<VLMAssertionConfig>;
  private results: VLMAssertionResult[] = [];

  constructor(test: DesktopTest, config: VLMAssertionConfig) {
    this.test = test;
    this.config = {
      strict: false,
      minConfidence: 0.7,
      customPrompt: '',
      ...config,
    };

    // 确保输出目录存在
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * 断言页面没有空白区域
   */
  async assertNoEmptyAreas(name: string): Promise<VLMAssertionResult> {
    const screenshot = await this.takeScreenshot(name);
    
    const result = await this.test.ai(`
      仔细检查这个截图，寻找任何空白区域或内容缺失：

      1. 检查是否有大面积空白区域（不包括正常的间距和留白）
      2. 检查是否有应该显示内容但显示为空的区域
      3. 检查是否有加载失败的迹象（如空白面板、缺失的图标）
      4. 检查是否有 "暂无数据"、"No data"、"Empty" 等空状态提示

      请用以下 JSON 格式回答：
      {
        "hasEmptyAreas": true/false,
        "confidence": 0.0-1.0,
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "empty_content",
            "description": "描述问题",
            "location": "问题位置"
          }
        ],
        "analysis": "总体分析"
      }

      如果页面正常显示内容，hasEmptyAreas 应为 false。
    `);

    return this.parseAndValidate(name, screenshot, result, 'assertNoEmptyAreas');
  }

  /**
   * 断言数据正确显示
   */
  async assertDataVisible(
    name: string,
    options: {
      expectedData?: string[];
      notZero?: boolean;
      notEmpty?: boolean;
    } = {}
  ): Promise<VLMAssertionResult> {
    const screenshot = await this.takeScreenshot(name);
    const { expectedData = [], notZero = true, notEmpty = true } = options;

    const dataCheckList = expectedData.length > 0 
      ? `检查以下数据是否显示: ${expectedData.join(', ')}`
      : '检查页面上的数据是否正确显示';

    const result = await this.test.ai(`
      分析这个截图中的数据显示情况：

      ${dataCheckList}

      检查要点：
      ${notZero ? '1. 数字不应该全为零（如 "0 个文件, 0 个函数" 是错误的）' : ''}
      ${notEmpty ? '2. 列表/表格不应该为空（应该有实际数据）' : ''}
      3. 数据格式是否正确（数字、文本、日期等）
      4. 数据是否完整显示（没有被截断或隐藏）

      请用以下 JSON 格式回答：
      {
        "dataCorrect": true/false,
        "confidence": 0.0-1.0,
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "wrong_data/empty_content",
            "description": "描述问题",
            "location": "问题位置"
          }
        ],
        "analysis": "数据分析结果"
      }
    `);

    return this.parseAndValidate(name, screenshot, result, 'assertDataVisible');
  }

  /**
   * 断言布局正确
   */
  async assertLayoutCorrect(
    name: string,
    options: {
      expectedElements?: string[];
      checkAlignment?: boolean;
      checkOverlap?: boolean;
    } = {}
  ): Promise<VLMAssertionResult> {
    const screenshot = await this.takeScreenshot(name);
    const { expectedElements = [], checkAlignment = true, checkOverlap = true } = options;

    const elementList = expectedElements.length > 0
      ? `期望的元素: ${expectedElements.join(', ')}`
      : '';

    const result = await this.test.ai(`
      分析这个截图的布局：

      ${elementList}

      检查要点：
      1. 所有期望的元素是否都存在且可见
      ${checkAlignment ? '2. 元素是否正确对齐（没有错位）' : ''}
      ${checkOverlap ? '3. 元素之间是否有不正常的重叠' : ''}
      4. 整体布局是否符合现代 UI 设计规范
      5. 是否有明显的布局错误（如元素溢出、断裂）

      请用以下 JSON 格式回答：
      {
        "layoutCorrect": true/false,
        "confidence": 0.0-1.0,
        "missingElements": ["缺失的元素"],
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "broken_layout/missing_element",
            "description": "描述问题",
            "location": "问题位置"
          }
        ],
        "analysis": "布局分析结果"
      }
    `);

    return this.parseAndValidate(name, screenshot, result, 'assertLayoutCorrect');
  }

  /**
   * 断言无障碍性
   */
  async assertAccessibility(name: string): Promise<VLMAssertionResult> {
    const screenshot = await this.takeScreenshot(name);

    const result = await this.test.ai(`
      从视觉角度检查这个截图的无障碍性：

      检查要点：
      1. 文字对比度是否足够（深色背景上的浅色文字，或浅色背景上的深色文字）
      2. 按钮和可交互元素是否足够大（至少 44x44 像素）
      3. 是否有仅靠颜色传达信息的情况（色盲用户可能无法识别）
      4. 文字大小是否足够大（至少 12px）
      5. 焦点状态是否可见（如果有的话）

      请用以下 JSON 格式回答：
      {
        "accessible": true/false,
        "confidence": 0.0-1.0,
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "accessibility",
            "description": "描述问题",
            "location": "问题位置"
          }
        ],
        "analysis": "无障碍性分析结果"
      }
    `);

    return this.parseAndValidate(name, screenshot, result, 'assertAccessibility');
  }

  /**
   * 断言组件状态
   */
  async assertComponentState(
    name: string,
    options: {
      componentName: string;
      expectedState: 'loading' | 'loaded' | 'error' | 'empty' | 'disabled' | 'active';
    }
  ): Promise<VLMAssertionResult> {
    const screenshot = await this.takeScreenshot(name);
    const { componentName, expectedState } = options;

    const stateDescriptions = {
      loading: '显示加载中状态（如 spinner、骨架屏、"加载中..." 文字）',
      loaded: '显示正常加载完成的内容（有实际数据，没有加载指示器）',
      error: '显示错误状态（如红色提示、错误图标、"加载失败" 文字）',
      empty: '显示空状态（如 "暂无数据"、空白提示）',
      disabled: '显示禁用状态（如灰色、不可点击的外观）',
      active: '显示激活/选中状态（如高亮、边框、不同背景色）',
    };

    const result = await this.test.ai(`
      检查截图中的 "${componentName}" 组件状态：

      期望状态: ${expectedState} - ${stateDescriptions[expectedState]}

      请判断组件当前是否处于期望的状态。

      请用以下 JSON 格式回答：
      {
        "stateCorrect": true/false,
        "actualState": "实际状态",
        "confidence": 0.0-1.0,
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "other",
            "description": "描述问题"
          }
        ],
        "analysis": "状态分析结果"
      }
    `);

    return this.parseAndValidate(name, screenshot, result, 'assertComponentState');
  }

  /**
   * 自定义视觉断言
   */
  async assertVisual(name: string, assertion: string): Promise<VLMAssertionResult> {
    const screenshot = await this.takeScreenshot(name);

    const result = await this.test.ai(`
      对这个截图进行以下检查：

      ${assertion}

      请用以下 JSON 格式回答：
      {
        "passed": true/false,
        "confidence": 0.0-1.0,
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "other",
            "description": "描述问题",
            "location": "问题位置（如果适用）"
          }
        ],
        "analysis": "分析结果"
      }
    `);

    return this.parseAndValidate(name, screenshot, result, 'assertVisual');
  }

  /**
   * 比较两个截图
   */
  async assertVisualMatch(
    name: string,
    baselineScreenshot: string,
    options: {
      allowedDifferences?: string[];
      threshold?: number;
    } = {}
  ): Promise<VLMAssertionResult> {
    const currentScreenshot = await this.takeScreenshot(name);
    const { allowedDifferences = [], threshold = 0.05 } = options;

    const allowedList = allowedDifferences.length > 0
      ? `允许的差异: ${allowedDifferences.join(', ')}`
      : '';

    // 读取基线截图
    if (!fs.existsSync(baselineScreenshot)) {
      return {
        passed: false,
        confidence: 1,
        analysis: `基线截图不存在: ${baselineScreenshot}`,
        issues: [{
          severity: 'critical',
          type: 'other',
          description: '基线截图不存在',
        }],
        screenshot: currentScreenshot,
      };
    }

    const result = await this.test.ai(`
      比较当前截图与基线截图的差异：

      ${allowedList}
      差异阈值: ${threshold * 100}%

      请检查：
      1. 布局是否发生变化
      2. 颜色是否发生变化
      3. 文字内容是否发生变化
      4. 是否有元素消失或新增

      请用以下 JSON 格式回答：
      {
        "match": true/false,
        "differencePercentage": 0.0-1.0,
        "confidence": 0.0-1.0,
        "issues": [
          {
            "severity": "critical/major/minor/info",
            "type": "other",
            "description": "描述差异",
            "location": "差异位置"
          }
        ],
        "analysis": "比较分析结果"
      }
    `);

    return this.parseAndValidate(name, currentScreenshot, result, 'assertVisualMatch');
  }

  /**
   * 获取所有结果
   */
  getResults(): VLMAssertionResult[] {
    return this.results;
  }

  /**
   * 获取失败的断言
   */
  getFailures(): VLMAssertionResult[] {
    return this.results.filter(r => !r.passed);
  }

  /**
   * 生成报告
   */
  generateReport(): string {
    const failures = this.getFailures();
    const passed = this.results.filter(r => r.passed);

    let report = `# VLM Visual Assertions Report\n\n`;
    report += `- Total: ${this.results.length}\n`;
    report += `- Passed: ${passed.length}\n`;
    report += `- Failed: ${failures.length}\n\n`;

    if (failures.length > 0) {
      report += `## Failures\n\n`;
      for (const failure of failures) {
        report += `### ${failure.screenshot}\n\n`;
        report += `**Analysis:** ${failure.analysis}\n\n`;
        report += `**Issues:**\n`;
        for (const issue of failure.issues) {
          report += `- [${issue.severity.toUpperCase()}] ${issue.description}`;
          if (issue.location) {
            report += ` (at ${issue.location})`;
          }
          report += '\n';
        }
        report += '\n';
      }
    }

    return report;
  }

  /**
   * 保存报告
   */
  saveReport(filename: string = 'vlm-report.md'): string {
    const reportPath = path.join(this.config.outputDir, filename);
    const report = this.generateReport();
    fs.writeFileSync(reportPath, report);
    return reportPath;
  }

  // Private methods

  private async takeScreenshot(name: string): Promise<string> {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(this.config.outputDir, filename);
    await this.test.screenshot(filepath);
    return filepath;
  }

  private parseAndValidate(
    name: string,
    screenshot: string,
    aiResult: { status: string; message?: string; vlmCost?: number; error?: string },
    assertionType: string
  ): VLMAssertionResult {
    let result: VLMAssertionResult;

    if (aiResult.status !== 'success' || !aiResult.message) {
      result = {
        passed: false,
        confidence: 0,
        analysis: `VLM 调用失败: ${aiResult.error || 'unknown error'}`,
        issues: [{
          severity: 'critical',
          type: 'other',
          description: 'VLM 分析失败',
        }],
        screenshot,
        cost: aiResult.vlmCost,
      };
    } else {
      try {
        // 尝试解析 JSON 响应
        const jsonMatch = aiResult.message.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        // 根据断言类型确定是否通过
        let passed = false;
        switch (assertionType) {
          case 'assertNoEmptyAreas':
            passed = parsed.hasEmptyAreas === false;
            break;
          case 'assertDataVisible':
            passed = parsed.dataCorrect === true;
            break;
          case 'assertLayoutCorrect':
            passed = parsed.layoutCorrect === true;
            break;
          case 'assertAccessibility':
            passed = parsed.accessible === true;
            break;
          case 'assertComponentState':
            passed = parsed.stateCorrect === true;
            break;
          case 'assertVisualMatch':
            passed = parsed.match === true;
            break;
          default:
            passed = parsed.passed === true;
        }

        // 检查置信度
        const confidence = parsed.confidence || 0.5;
        if (confidence < this.config.minConfidence) {
          passed = false;
        }

        // 检查严重问题
        const issues: VLMIssue[] = (parsed.issues || []).map((i: unknown) => ({
          severity: (i as { severity?: string }).severity || 'info',
          type: (i as { type?: string }).type || 'other',
          description: (i as { description?: string }).description || '',
          location: (i as { location?: string }).location,
        }));

        // 如果有 critical 问题，强制失败
        if (issues.some(i => i.severity === 'critical')) {
          passed = false;
        }

        // 严格模式下，major 问题也失败
        if (this.config.strict && issues.some(i => i.severity === 'major')) {
          passed = false;
        }

        result = {
          passed,
          confidence,
          analysis: parsed.analysis || '',
          issues,
          screenshot,
          cost: aiResult.vlmCost,
        };
      } catch (parseError) {
        // JSON 解析失败，尝试从文本提取信息
        result = {
          passed: false,
          confidence: 0.5,
          analysis: aiResult.message,
          issues: [{
            severity: 'minor',
            type: 'other',
            description: 'VLM 响应格式不正确',
          }],
          screenshot,
          cost: aiResult.vlmCost,
        };
      }
    }

    this.results.push(result);

    // 如果失败且是 critical，抛出错误
    if (!result.passed) {
      const criticalIssues = result.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        const errorMsg = criticalIssues.map(i => i.description).join('; ');
        throw new Error(`[VLM Assertion Failed] ${name}: ${errorMsg}`);
      }
    }

    return result;
  }
}

/**
 * 创建 VLM 断言实例
 */
export function createVLMAssertions(
  test: DesktopTest,
  config: VLMAssertionConfig
): VLMAssertions {
  return new VLMAssertions(test, config);
}

export default VLMAssertions;
