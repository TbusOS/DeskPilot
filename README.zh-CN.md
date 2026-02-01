<p align="center">
  <img src="assets/logo.svg" alt="DeskPilot Logo" width="120" height="120">
</p>

<h1 align="center">DeskPilot</h1>

<p align="center">
  <strong>AI 驱动的桌面自动化测试框架</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/deskpilot"><img src="https://img.shields.io/npm/v/deskpilot.svg" alt="npm 版本"></a>
  <a href="https://github.com/TbusOS/DeskPilot/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="许可证"></a>
  <a href="./README.md">English</a> | 中文
</p>

<p align="center">
  为 Tauri/Electron 应用打造的混合测试方案：确定性 DOM 测试 + VLM 视觉 AI 智能回退
</p>

---

## 特性

- **混合测试模式** - 确定性优先，VLM 智能回退
- **多 VLM 支持** - Anthropic Claude、OpenAI GPT-4V、豆包、自定义
- **Agent 模式** - 自动检测 Cursor IDE、Claude Code CLI、VSCode Claude 插件
- **无障碍树** - 完整 a11y 树遍历、WCAG 验证、屏幕阅读器模拟
- **视觉回归** - 截图对比与基线管理
- **交互测试** - 键盘导航、拖放、响应式测试
- **成本追踪** - 监控 VLM API 使用费用
- **跨平台** - macOS、Linux、Windows 全支持
- **Tauri 原生** - 一流的 Tauri WebView 测试支持

## 安装

```bash
npm install deskpilot
```

可选依赖：

```bash
npm install @nut-tree/nut-js  # 原生鼠标/键盘控制
```

## 快速开始

### 确定性模式（免费、快速）

```typescript
import { DesktopTest, TestMode } from 'deskpilot';

const test = new DesktopTest({
  mode: TestMode.DETERMINISTIC,
  cdp: { endpoint: 9222 },
});

await test.connect();

// 使用快照中的 refs
const snapshot = await test.snapshot({ interactive: true });
await test.click('@e2');  // 通过 ref 点击

// 使用 CSS 选择器
await test.click('#submit-btn');

await test.disconnect();
```

### 混合模式（确定性 + AI 回退）

```typescript
import { DesktopTest, TestMode } from 'deskpilot';

const test = new DesktopTest({
  mode: TestMode.HYBRID,
  cdp: { endpoint: 9222 },
  vlm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    trackCost: true,
  },
});

await test.connect();

// 先尝试确定性方法，找不到时使用 VLM 回退
await test.click('@e2');           // 确定性（快速）
await test.clickText('打开文件');   // VLM 回退（智能）

// 完全 AI 控制
await test.ai('用测试账号填写登录表单');

// 查看费用
console.log(test.getCostSummary());
// { totalCost: 0.0234, totalCalls: 3, ... }
```

### Agent 模式（无需 API Key）

```typescript
// 在 Cursor IDE、Claude Code CLI、VSCode Claude 中自动生效
const test = new DesktopTest({
  mode: TestMode.HYBRID,
  cdp: { endpoint: 9222 },
  vlm: { provider: 'agent' }, // 自动检测环境
});
```

## 测试套件示例

```typescript
import { TestRunner, TestMode, Assertions } from 'deskpilot';

const tests = [
  {
    name: '页面正确加载',
    fn: async ({ test, assert, log }) => {
      const snapshot = await test.snapshot();
      assert.greaterThan(Object.keys(snapshot.refs).length, 0);
      
      // 防止 "0 文件" 显示 Bug
      Assertions.valueNotZero(fileCount, '文件数不能为零');
    },
  },
];

const runner = new TestRunner({
  config: {
    mode: TestMode.HYBRID,
    cdp: { endpoint: 9222 },
  },
});

await runner.runAll(tests, '测试套件');
```

## 无障碍测试

```typescript
import { createA11yTester } from 'deskpilot';

const a11y = createA11yTester(test);

// 运行 WCAG 审计
const result = await a11y.audit({ tags: ['wcag2a', 'wcag2aa'] });
console.log(`违规数: ${result.violations.length}`);

// 获取无障碍树
const tree = await a11y.tree.getTree();
console.log(`总节点: ${tree.totalNodes}`);
console.log(`地标数: ${tree.landmarkCount}`);

// 按角色查找
const buttons = await a11y.tree.findByRole('button');

// 验证 ARIA 模式
const dialogIssues = await a11y.validatePattern('dialog');

// 屏幕阅读器模拟
const readingOrder = await a11y.getReadingOrder();
```

## 视觉回归测试

```typescript
import { createVisualRegressionTester } from 'deskpilot';

const visual = createVisualRegressionTester(test, {
  baselineDir: './baselines',
  outputDir: './screenshots',
  threshold: 0.01, // 1% 容差
});

const diff = await visual.compareScreenshot('主页面');
if (!diff.match) {
  console.log(`视觉差异: ${diff.diffPercentage}%`);
}
```

## 交互测试

```typescript
import { createInteractionTester, COMMON_VIEWPORTS } from 'deskpilot';

const interaction = createInteractionTester(test);

// 键盘导航测试
const tabResult = await interaction.testTabNavigation();
if (tabResult.trapDetected) {
  console.error('检测到焦点陷阱！');
}

// 响应式测试
const results = await interaction.testResponsive(COMMON_VIEWPORTS);
```

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      DeskPilot                              │
│                                                             │
│      统一 API + 混合模式 + 多 VLM + 成本追踪                │
├─────────────────────────────────────────────────────────────┤
│                    智能回退链                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 第一层: Refs（来自快照）- 免费、快速                 │   │
│  │ 第二层: CSS/XPath via CDP - 免费、快速              │   │
│  │ 第三层: 视觉 AI via VLM - 付费、智能                │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│   │ CDP 适配器  │  │ Python      │  │ NutJS 适配器    │    │
│   │ (WebView)   │  │ 桥接        │  │ (原生控制)      │    │
│   └─────────────┘  └─────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐   │
│  │ 无障碍测试   │ │ 视觉回归      │  │ 交互测试        │   │
│  └──────────────┘ └───────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 测试模式

| 模式 | 适用场景 | 费用 | 速度 |
|------|----------|------|------|
| **确定性** | CI/CD、回归测试 | 免费 | 快速 (毫秒级) |
| **视觉** | 探索性测试、复杂 UI | ~$0.01-0.05/操作 | 1-5秒 |
| **混合** | 生产测试 | 最小化 (按需 VLM) | 快速+智能回退 |

## VLM 提供商

```typescript
// Anthropic Claude（推荐）
{ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }

// OpenAI GPT-4V
{ provider: 'openai', model: 'gpt-4o' }

// 豆包（中国）
{ provider: 'volcengine', model: 'doubao-1-5-vision-pro' }

// Agent 模式（自动检测 Cursor/Claude CLI/VSCode）
{ provider: 'agent' }

// 自定义（OpenAI 兼容 API）
{ provider: 'custom', baseURL: 'http://localhost:8080/v1' }
```

## 启动 Tauri 应用（开启调试端口）

```bash
# macOS / Linux
WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 cargo tauri dev

# Windows
$env:WEBKIT_INSPECTOR_HTTP_SERVER="127.0.0.1:9222"; cargo tauri dev
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `CDP_PORT` | CDP 调试端口（默认: 9222） |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `USE_AGENT` | 启用 Agent 模式自动检测 |

## CI/CD 集成

```yaml
# .github/workflows/e2e.yml
name: E2E 测试
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: 安装依赖
        run: npm ci
      
      - name: 启动应用（开启调试端口）
        run: |
          WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 \
          ./target/release/my-app &
          sleep 5
      
      - name: 运行 E2E 测试
        run: npx tsx tests/e2e/run.ts
        env:
          CDP_PORT: 9222
```

## 贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 许可证

Apache-2.0 - 详见 [LICENSE](LICENSE)。

## 致谢

灵感来源于：
- [agent-browser](https://github.com/anthropics/agent-browser) - Anthropic
- [UI-TARS](https://github.com/anthropics/UI-TARS-desktop) - VLM GUI Agent
- [Claude Computer Use](https://docs.anthropic.com/en/docs/computer-use) - Anthropic

---

<p align="center">
  由 <a href="https://github.com/TbusOS">TbusOS</a> 用 ❤️ 打造
</p>
