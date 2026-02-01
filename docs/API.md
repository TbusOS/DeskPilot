# API Reference

## DesktopTest

The main class for desktop automation testing.

### Constructor

```typescript
new DesktopTest(config?: DesktopTestConfig)
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `TestMode` | `'hybrid'` | Testing mode |
| `cdp` | `CDPConfig` | `{ endpoint: 9222 }` | CDP configuration |
| `vlm` | `VLMConfig` | - | VLM configuration |
| `pythonBridge` | `PythonBridgeConfig` | - | Python bridge config |
| `nutjs` | `NutJSConfig` | - | NutJS config |
| `timeout` | `number` | `30000` | Default timeout (ms) |
| `debug` | `boolean` | `false` | Enable debug logging |

### Connection Methods

#### `connect(): Promise<void>`

Connect to the desktop application.

```typescript
await test.connect();
```

#### `disconnect(): Promise<void>`

Disconnect from the application.

```typescript
await test.disconnect();
```

#### `isConnected(): boolean`

Check if connected.

```typescript
if (test.isConnected()) { /* ... */ }
```

### Snapshot Methods

#### `snapshot(options?): Promise<SnapshotResult>`

Get accessibility tree snapshot with element refs.

```typescript
const snapshot = await test.snapshot({ interactive: true });
console.log(snapshot.tree);  // Accessibility tree as string
console.log(snapshot.refs);  // { 'e1': { role: 'button', name: 'Click me' }, ... }
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interactive` | `boolean` | `true` | Only include interactive elements |

### Element Finding

#### `find(locator): Promise<ElementRef | null>`

Find a single element.

```typescript
// By ref
const element = await test.find('@e1');

// By CSS selector
const button = await test.find('#submit-btn');

// By text
const link = await test.find('text=Click here');

// By role
const menu = await test.find('role=menu');

// Using ElementLocator object
const el = await test.find({
  strategy: LocatorStrategy.CSS,
  value: '.my-class',
});
```

#### `findAll(locator): Promise<ElementRef[]>`

Find all matching elements.

```typescript
const items = await test.findAll('.list-item');
```

#### `waitFor(locator, options?): Promise<ElementRef>`

Wait for element to appear.

```typescript
const element = await test.waitFor('#loading-complete', {
  timeout: 10000,
  state: 'visible',
});
```

### Actions

#### `click(locator, options?): Promise<ActionResult>`

Click an element.

```typescript
await test.click('@e1');
await test.click('#btn', { button: 'right' });
await test.click('.item', { count: 2 });  // Double-click
```

#### `dblclick(locator): Promise<ActionResult>`

Double-click an element.

```typescript
await test.dblclick('#file-item');
```

#### `rightClick(locator): Promise<ActionResult>`

Right-click an element.

```typescript
await test.rightClick('#context-menu-target');
```

#### `type(locator, text, options?): Promise<ActionResult>`

Type text into an element.

```typescript
await test.type('#input', 'Hello World');
await test.type('#search', 'query', { submit: true });  // Press Enter after
```

#### `fill(locator, text): Promise<ActionResult>`

Clear and fill an input.

```typescript
await test.fill('#username', 'john@example.com');
```

#### `clear(locator): Promise<ActionResult>`

Clear an input.

```typescript
await test.clear('#search');
```

#### `press(key): Promise<ActionResult>`

Press a keyboard key or combination.

```typescript
await test.press('Enter');
await test.press('Control+a');
await test.press('Meta+Shift+s');
```

#### `hover(locator): Promise<ActionResult>`

Hover over an element.

```typescript
await test.hover('#tooltip-trigger');
```

#### `scroll(options): Promise<ActionResult>`

Scroll the page.

```typescript
await test.scroll({ direction: 'down', amount: 100 });
```

#### `drag(from, to): Promise<ActionResult>`

Drag from one element to another.

```typescript
await test.drag('#draggable', '#drop-zone');
```

### Visual AI Methods

#### `clickText(text): Promise<ActionResult>`

Click element by visible text using VLM.

```typescript
await test.clickText('Submit');
await test.clickText('打开项目');
```

#### `clickImage(description): Promise<ActionResult>`

Click element by visual description using VLM.

```typescript
await test.clickImage('blue login button');
await test.clickImage('folder icon in the sidebar');
```

#### `ai(instruction): Promise<ActionResult>`

Execute a complex instruction using VLM.

```typescript
await test.ai('Fill the login form with test credentials');
await test.ai('Navigate to settings and enable dark mode');
```

### Getters

#### `getText(locator): Promise<string>`

Get element text content.

```typescript
const text = await test.getText('#message');
```

#### `getValue(locator): Promise<string>`

Get input element value.

```typescript
const value = await test.getValue('#email-input');
```

#### `getAttribute(locator, attr): Promise<string | null>`

Get element attribute.

```typescript
const href = await test.getAttribute('#link', 'href');
```

#### `isVisible(locator): Promise<boolean>`

Check if element is visible.

```typescript
if (await test.isVisible('#modal')) { /* ... */ }
```

#### `isEnabled(locator): Promise<boolean>`

Check if element is enabled.

```typescript
if (await test.isEnabled('#submit-btn')) { /* ... */ }
```

#### `count(locator): Promise<number>`

Count matching elements.

```typescript
const count = await test.count('.list-item');
```

#### `boundingBox(locator): Promise<BoundingBox | null>`

Get element bounding box.

```typescript
const box = await test.boundingBox('#element');
// { x: 100, y: 200, width: 300, height: 50 }
```

### Page Methods

#### `getUrl(): Promise<string>`

Get current page URL.

```typescript
const url = await test.getUrl();
```

#### `getTitle(): Promise<string>`

Get page title.

```typescript
const title = await test.getTitle();
```

#### `evaluate<T>(script): Promise<T>`

Execute JavaScript in the page context.

```typescript
const result = await test.evaluate<number>('window.innerWidth');
const data = await test.evaluate<object>('window.__APP_STATE__');
```

### Screenshot & Recording

#### `screenshot(path?, options?): Promise<string>`

Take a screenshot.

```typescript
const path = await test.screenshot('./screenshot.png');
const fullPage = await test.screenshot('./full.png', { fullPage: true });
```

#### `startRecording(path): Promise<void>`

Start video recording.

```typescript
await test.startRecording('./recording.webm');
```

#### `stopRecording(): Promise<{ path: string }>`

Stop video recording.

```typescript
const { path } = await test.stopRecording();
```

### Cost Tracking

#### `getCostSummary(): CostSummary`

Get VLM API cost summary.

```typescript
const summary = test.getCostSummary();
console.log(`Total cost: $${summary.totalCost.toFixed(4)}`);
console.log(`Total calls: ${summary.totalCalls}`);
console.log(`By provider:`, summary.byProvider);
```

#### `resetCostTracking(): void`

Reset cost tracking.

```typescript
test.resetCostTracking();
```

### Utilities

#### `wait(ms): Promise<void>`

Wait for specified milliseconds.

```typescript
await test.wait(1000);  // Wait 1 second
```

#### `waitForIdle(timeout?): Promise<void>`

Wait for page to be idle (no network activity).

```typescript
await test.waitForIdle(5000);
```

---

## TestRunner

Test runner for organizing and executing tests.

### Constructor

```typescript
new TestRunner(options?: TestRunnerOptions)
```

### Methods

#### `runTest(test: TestCase): Promise<TestResult>`

Run a single test.

#### `runAll(tests: TestCase[], suiteName?: string): Promise<TestSuiteResult>`

Run all tests.

```typescript
const result = await runner.runAll(tests, 'My Suite');
console.log(`Passed: ${result.passed}, Failed: ${result.failed}`);
```

---

## Assertions

Available in test context as `assert`.

### Basic Assertions

```typescript
assert.ok(condition, message?);
assert.equal(actual, expected, message?);
assert.notEqual(actual, expected, message?);
```

### Number Assertions

```typescript
assert.greaterThan(actual, expected, message?);
assert.lessThan(actual, expected, message?);
assert.greaterOrEqual(actual, expected, message?);
assert.lessOrEqual(actual, expected, message?);
```

### String Assertions

```typescript
assert.contains(haystack, needle, message?);
assert.matches(actual, pattern, message?);
```

### Element Assertions

```typescript
await assert.exists(locator, message?);
await assert.notExists(locator, message?);
await assert.visible(locator, message?);
await assert.hidden(locator, message?);
await assert.hasText(locator, text, message?);
await assert.hasValue(locator, value, message?);
await assert.hasAttribute(locator, attr, value?, message?);
```

### Data Correctness Assertions

```typescript
await assert.notZero(locator, message?);
await assert.notEmpty(locator, message?);
await assert.dataCorrect(locator, validator, message?);
```

### Visual Assertions

```typescript
await assert.visualCheck(description, message?);
await assert.noVisualRegression(baseline, threshold?);
```

---

## Types

See [types.ts](../src/types.ts) for complete type definitions.
