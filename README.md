<p align="center">
  <img src="assets/logo.svg?v=2" alt="DeskPilot Logo" width="120" height="120">
</p>

<h1 align="center">DeskPilot</h1>

<p align="center">
  <strong>AI-Powered Desktop Automation Testing Framework</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/deskpilot"><img src="https://img.shields.io/npm/v/deskpilot.svg" alt="npm version"></a>
  <a href="https://github.com/TbusOS/DeskPilot/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License"></a>
  <a href="https://github.com/TbusOS/DeskPilot/actions"><img src="https://github.com/TbusOS/DeskPilot/workflows/CI/badge.svg" alt="CI Status"></a>
  <br>
  English | <a href="./README.zh-CN.md">中文文档</a>
</p>

<p align="center">
  Combining deterministic DOM testing with VLM-powered visual AI fallback for Tauri/Electron apps
</p>

---

## Features

### Core Testing
- **Hybrid Testing Mode** - Deterministic testing first, VLM fallback when needed
- **Multi-VLM Support** - Anthropic Claude, OpenAI GPT-4V, Volcengine Doubao, Custom
- **Agent Mode** - Auto-detects Cursor IDE, Claude Code CLI, VSCode Claude plugin
- **Ref Mechanism** - Stable element references (`@e1`, `@e2`) for reliable automation
- **Network Interception** - Mock API responses, request recording, traffic simulation
- **Cost Tracking** - Monitor and control VLM API costs

### UI Testing
- **Accessibility Tree** - Full a11y tree traversal, WCAG validation, screen reader simulation
- **Visual Regression** - Screenshot comparison with baseline management
- **Interaction Testing** - Keyboard navigation, drag & drop, responsive testing
- **Flow Chart Testing** - Test @xyflow/react graphs (nodes, edges, layout)
- **Virtual List Testing** - Test large virtualized lists and infinite scrolling
- **Monaco Editor Testing** - Code editor testing (syntax, completions, navigation)
- **Timeline Testing** - Async timeline and Gantt chart component testing

### Recording & Reporting
- **Screen Recording** - Screenshots, video recording, GIF creation, annotations
- **Test Visualizer** - HTML reports with step timeline and screenshots
- **Performance Benchmarking** - Timing, memory, resource usage measurement

### Advanced Features
- **Session Management** - Multi-session parallel testing
- **Stream Server** - WebSocket real-time preview
- **Daemon Mode** - Persistent process for accelerated testing
- **Tauri Native Dialogs** - Test file open/save dialogs

### Platform Support
- **Cross-Platform** - macOS, Linux, Windows support
- **Tauri Native** - First-class support for Tauri WebView testing

## Installation

```bash
npm install deskpilot
```

Optional dependencies:

```bash
npm install @nut-tree/nut-js  # Native mouse/keyboard control
```

## Quick Start

### Deterministic Mode (Free, Fast)

```typescript
import { DesktopTest, TestMode } from 'deskpilot';

const test = new DesktopTest({
  mode: TestMode.DETERMINISTIC,
  cdp: { endpoint: 9222 },
});

await test.connect();

// Use refs from snapshot
const snapshot = await test.snapshot({ interactive: true });
await test.click('@e2');  // Click by ref

// Use CSS selectors
await test.click('#submit-btn');

await test.disconnect();
```

### Hybrid Mode (Deterministic + AI Fallback)

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

// Tries deterministic first, VLM fallback if not found
await test.click('@e2');           // Deterministic (fast)
await test.clickText('Open File'); // VLM fallback if needed

// Full AI control
await test.ai('Fill the login form with test credentials');

// Check costs
console.log(test.getCostSummary());
// { totalCost: 0.0234, totalCalls: 3, ... }
```

### Agent Mode (No API Key Needed)

```typescript
// Works automatically in Cursor IDE, Claude Code CLI, VSCode Claude
const test = new DesktopTest({
  mode: TestMode.HYBRID,
  cdp: { endpoint: 9222 },
  vlm: { provider: 'agent' }, // Auto-detect environment
});
```

## Test Suite Example

```typescript
import { TestRunner, TestMode, Assertions } from 'deskpilot';

const tests = [
  {
    name: 'Page loads correctly',
    fn: async ({ test, assert, log }) => {
      const snapshot = await test.snapshot();
      assert.greaterThan(Object.keys(snapshot.refs).length, 0);
      
      // Prevent "0 files" display bug
      Assertions.valueNotZero(fileCount, 'File count should not be zero');
    },
  },
];

const runner = new TestRunner({
  config: {
    mode: TestMode.HYBRID,
    cdp: { endpoint: 9222 },
  },
});

await runner.runAll(tests, 'My Test Suite');
```

## Accessibility Testing

```typescript
import { createA11yTester, createAccessibilityTreeManager } from 'deskpilot';

const a11y = createA11yTester(test);

// Run WCAG audit
const result = await a11y.audit({ tags: ['wcag2a', 'wcag2aa'] });
console.log(`Violations: ${result.violations.length}`);

// Get accessibility tree
const tree = await a11y.tree.getTree();
console.log(`Total nodes: ${tree.totalNodes}`);
console.log(`Landmarks: ${tree.landmarkCount}`);

// Find by role
const buttons = await a11y.tree.findByRole('button');

// Validate patterns
const dialogIssues = await a11y.validatePattern('dialog');

// Screen reader simulation
const readingOrder = await a11y.getReadingOrder();
```

## Visual Regression Testing

```typescript
import { createVisualRegressionTester } from 'deskpilot';

const visual = createVisualRegressionTester(test, {
  baselineDir: './baselines',
  outputDir: './screenshots',
  threshold: 0.01, // 1% tolerance
});

const diff = await visual.compareScreenshot('main-page');
if (!diff.match) {
  console.log(`Visual diff: ${diff.diffPercentage}%`);
}
```

## Interaction Testing

```typescript
import { createInteractionTester, COMMON_VIEWPORTS } from 'deskpilot';

const interaction = createInteractionTester(test);

// Keyboard navigation
const tabResult = await interaction.testTabNavigation();
if (tabResult.trapDetected) {
  console.error('Focus trap detected!');
}

// Responsive testing
const results = await interaction.testResponsive(COMMON_VIEWPORTS);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DeskPilot                              │
│                                                             │
│     Unified API + Hybrid Mode + Multi-VLM + Cost Tracking   │
├─────────────────────────────────────────────────────────────┤
│                   Smart Fallback Chain                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Level 1: Refs (from snapshot) - free, fast          │   │
│  │ Level 2: CSS/XPath via CDP - free, fast             │   │
│  │ Level 3: Visual AI via VLM - paid, intelligent      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│   │ CDP Adapter │  │ Python      │  │ NutJS Adapter   │    │
│   │ (WebView)   │  │ Bridge      │  │ (Native)        │    │
│   └─────────────┘  └─────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐   │
│  │ A11y Tester  │ │ Visual       │  │ Interaction     │   │
│  │              │ │ Regression   │  │ Tester          │   │
│  └──────────────┘ └───────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Testing Modes

| Mode | Best For | Cost | Speed |
|------|----------|------|-------|
| **Deterministic** | CI/CD, regression testing | Free | Fast (ms) |
| **Visual** | Exploratory testing, complex UIs | ~$0.01-0.05/action | 1-5s |
| **Hybrid** | Production testing | Minimal (VLM when needed) | Fast with fallback |

## VLM Providers

```typescript
// Anthropic Claude (recommended)
{ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }

// OpenAI GPT-4V
{ provider: 'openai', model: 'gpt-4o' }

// Volcengine Doubao (China)
{ provider: 'volcengine', model: 'doubao-1-5-vision-pro' }

// Agent Mode (auto-detect Cursor/Claude CLI/VSCode)
{ provider: 'agent' }

// Custom (OpenAI-compatible API)
{ provider: 'custom', baseURL: 'http://localhost:8080/v1' }
```

## Starting Tauri App with Debug Port

```bash
# macOS / Linux
WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 cargo tauri dev

# Windows
$env:WEBKIT_INSPECTOR_HTTP_SERVER="127.0.0.1:9222"; cargo tauri dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CDP_PORT` | CDP debugging port (default: 9222) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `USE_AGENT` | Enable agent mode auto-detection |

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start app with debug port
        run: |
          WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 \
          ./target/release/my-app &
          sleep 5
      
      - name: Run E2E tests
        run: npx tsx tests/e2e/run.ts
        env:
          CDP_PORT: 9222
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.

## Credits

Inspired by:
- [agent-browser](https://github.com/anthropics/agent-browser) - Anthropic
- [UI-TARS](https://github.com/anthropics/UI-TARS-desktop) - VLM GUI Agent
- [Claude Computer Use](https://docs.anthropic.com/en/docs/computer-use) - Anthropic

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/TbusOS">TbusOS</a>
</p>
