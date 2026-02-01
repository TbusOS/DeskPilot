# Design Philosophy

## Overview

`@flowsight/desktop-test` is a hybrid desktop automation testing framework that combines the best aspects of three approaches:

1. **agent-browser** - Deterministic, DOM-based, AI-friendly refs
2. **UI-TARS** - Visual AI, VLM-powered understanding
3. **Claude Computer Use** - Intelligent multi-step automation

## The Problem

Traditional desktop testing approaches have significant limitations:

### Deterministic Testing Only

- **Pros**: Fast, free, reliable, CI-friendly
- **Cons**: Breaks on UI changes, requires good selectors, can't handle dynamic content

### Visual AI Testing Only

- **Pros**: Resilient to UI changes, understands context, human-like
- **Cons**: Expensive (VLM API calls), slow, non-deterministic

### Neither alone is sufficient for modern desktop applications.

## Our Solution: Hybrid Approach

```
┌─────────────────────────────────────────────────────────────┐
│                      Test Execution                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Element Location                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Try Refs from Snapshot (free, fast)              │    │
│  │    └─ Found? → Execute action                       │    │
│  │    └─ Not found? → Continue...                      │    │
│  │                                                     │    │
│  │ 2. Try CSS/XPath via CDP (free, fast)               │    │
│  │    └─ Found? → Execute action                       │    │
│  │    └─ Not found? → Continue...                      │    │
│  │                                                     │    │
│  │ 3. Try Visual AI via VLM (paid, intelligent)        │    │
│  │    └─ Screenshot + AI analysis                      │    │
│  │    └─ Execute or report failure                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Three Modes

### 1. Deterministic Mode

**Use case**: CI/CD, regression testing, stable environments

```typescript
const test = new DesktopTest({ mode: TestMode.DETERMINISTIC });
```

- Uses DOM/accessibility tree only
- **Cost**: Free (no API calls)
- **Speed**: Milliseconds
- **Reliability**: High (deterministic)

### 2. Visual Mode

**Use case**: Exploratory testing, complex UIs, image-based elements

```typescript
const test = new DesktopTest({
  mode: TestMode.VISUAL,
  vlm: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
});
```

- Uses VLM for all element finding
- **Cost**: VLM API calls (~$0.01-0.05 per action)
- **Speed**: 1-5 seconds per action
- **Reliability**: Medium (AI can vary)

### 3. Hybrid Mode (Default)

**Use case**: Production testing, best of both worlds

```typescript
const test = new DesktopTest({
  mode: TestMode.HYBRID,
  vlm: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
});
```

- Tries deterministic first, falls back to VLM
- **Cost**: Minimal (VLM only when needed)
- **Speed**: Fast most of the time
- **Reliability**: High (VLM recovers from failures)

## Key Innovations

### 1. Smart Fallback Chain

```typescript
async find(locator) {
  // Level 1: Refs (from snapshot)
  if (locator.startsWith('@')) {
    const element = await this.findByRef(locator);
    if (element) return element;
  }

  // Level 2: CSS/XPath
  const domElement = await this.cdp.find(locator);
  if (domElement) return domElement;

  // Level 3: Visual AI (only in hybrid/visual mode)
  if (this.mode !== 'deterministic' && this.vlm) {
    return this.findVisual(locator);
  }

  return null;
}
```

### 2. Cost Tracking

```typescript
const result = await test.ai('Complete the checkout process');

console.log(result.usedVLM);     // true
console.log(result.vlmCost);     // 0.023 (estimated USD)
console.log(result.duration);    // 15230 (ms)
```

### 3. Action Result with Context

Every action returns detailed information:

```typescript
interface ActionResult {
  status: 'success' | 'failed' | 'not_found' | 'vlm_fallback';
  duration: number;      // Execution time (ms)
  usedVLM: boolean;      // Did we use VLM?
  vlmCost?: number;      // API cost if VLM used
  screenshot?: string;   // State after action
  error?: string;        // Error message if failed
}
```

### 4. Data Correctness Assertions

Built specifically for the "0 files, 0 functions" problem:

```typescript
// Instead of just checking existence:
await test.assert.exists('[data-testid="stats"]');  // Too weak!

// Check actual data correctness:
await test.assert.notZero('[data-testid="file-count"]');
await test.assert.dataCorrect('[data-testid="function-list"]',
  (data) => data.split(',').length > 0
);
```

### 5. Multi-Provider VLM Support

```typescript
// Anthropic Claude
{ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }

// OpenAI GPT-4V
{ provider: 'openai', model: 'gpt-4o' }

// Volcengine Doubao (China)
{ provider: 'volcengine', model: 'doubao-1-5-vision-pro' }

// Custom (OpenAI-compatible)
{ provider: 'custom', baseURL: 'http://localhost:8080/v1', model: 'my-vlm' }
```

## Comparison

| Feature | agent-browser | UI-TARS | Claude CU | **desktop-test** |
|---------|--------------|---------|-----------|------------------|
| DOM-based | ✓ | ✗ | ✗ | ✓ |
| Visual AI | ✗ | ✓ | ✓ | ✓ |
| Free mode | ✓ | ✗ | ✗ | ✓ |
| Smart fallback | ✗ | ✗ | ✗ | ✓ |
| Cost tracking | ✗ | ✗ | ✗ | ✓ |
| Multi-provider | ✗ | Limited | Claude only | ✓ |
| Tauri native | Partial | ✗ | ✗ | ✓ |
| CI/CD ready | ✓ | ✗ | ✗ | ✓ |

## When to Use Each Mode

| Scenario | Recommended Mode |
|----------|-----------------|
| CI/CD pipeline | `DETERMINISTIC` |
| PR checks | `DETERMINISTIC` |
| Nightly regression | `HYBRID` |
| New feature testing | `HYBRID` |
| UI exploration | `VISUAL` |
| Bug reproduction | `HYBRID` |
| Performance testing | `DETERMINISTIC` |

## Architecture

```
@flowsight/desktop-test
├── src/
│   ├── core/
│   │   ├── desktop-test.ts    # Main API
│   │   ├── test-runner.ts     # Test execution
│   │   └── assertions.ts      # Assertion methods
│   ├── adapters/
│   │   ├── cdp-adapter.ts     # WebView via CDP
│   │   ├── python-bridge.ts   # Python framework bridge
│   │   └── nutjs-adapter.ts   # Native desktop control
│   ├── vlm/
│   │   ├── client.ts          # Multi-provider VLM client
│   │   └── cost-tracker.ts    # API cost tracking
│   ├── types.ts               # Type definitions
│   └── index.ts               # Exports
├── docs/
│   ├── API.md                 # API reference
│   └── DESIGN.md              # This file
├── examples/
│   └── flowsight-tests.ts     # Example test suite
└── README.md
```

## Future Roadmap

1. **Test Recorder** - Record actions and generate test code
2. **Self-Healing** - Automatically fix broken selectors using VLM
3. **Parallel Execution** - Run multiple test sessions concurrently
4. **HTML Reports** - Visual reports with screenshots and videos
5. **Mobile Support** - ADB adapter for Android testing
6. **Browser Extension** - DevTools integration for debugging
