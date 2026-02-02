# DeskPilot 测试框架 Post-Mortem 反思

## 核心问题：为什么 VLM 视觉测试方案存在却测不出 Bug？

### 事故回顾

FlowSight 存在两个关键 bug：
1. **终端显示 "0 个文件"** - 索引完成后统计数据不更新
2. **LLVM IR 面板为空** - 组件写好了但从未集成

这两个 bug 在用户界面上是**肉眼可见**的，但我们的 "智能视觉测试框架" 完全没有发现。

---

## 失败原因分析

### 1. VLM 能力写了但从未使用 🔴

```typescript
// VLMClient 提供了强大的视觉断言能力
async assertVisual(request: VLMAssertRequest): Promise<VLMAssertResponse>
async detectVisualIssues(screenshot: string): Promise<Array<{...}>>
async analyzeIDEScreenshot(screenshot: string): Promise<{...}>
```

**但测试用例根本没有调用这些方法！**

实际测试代码：
```typescript
// deskpilot-enhanced.spec.ts 只用了 Playwright
import { test, expect } from '@playwright/test';

test('should ...', async ({ page }) => {
  await page.screenshot({ path: 'xxx.png' });  // 只截图，不分析！
  // 没有 VLMClient.assertVisual() 调用
});
```

### 2. 网络拦截 Mock 了错误的东西 🔴

测试代码：
```typescript
await page.route('**/api/**', async route => {
  // Mock HTTP API
});
```

**但 FlowSight 使用的是 Tauri IPC (invoke)，不是 HTTP API！**
所以这些 mock 根本不会生效。

### 3. 测试逻辑有致命缺陷 🔴

```typescript
test('should not display zero counts', async ({ page }) => {
  const statsElement = page.locator('text=/发现.*个/');
  
  if (await statsElement.count() > 0) {  // ❌ 如果找不到，测试直接跳过！
    // ...
  }
  // 没有 else { fail() }
});
```

问题：
- **没有先打开项目** - 页面上根本不会有统计元素
- **条件判断导致跳过** - 元素不存在时测试"通过"
- **没有真正断言** - 只是截图

### 4. 测试与实际功能脱节 🔴

| 功能 | 测试覆盖 | 实际验证 |
|------|----------|----------|
| 打开项目 | ❌ 无 | - |
| 索引进度 | ❌ 无 | - |
| 统计显示 | 有代码 | ❌ 从不执行 |
| LLVM IR | ❌ 无 | - |
| 执行流视图 | 有代码 | ⚠️ 只验证节点存在 |

### 5. 测试从未实际运行 🔴

检查 CI/CD 配置，这些 DeskPilot 测试：
- 可能没有在 CI 中运行
- 或者运行了但失败被忽略
- 或者测试全部"跳过"而不是"通过"

---

## 根本原因

### 架构问题
1. **测试框架与应用架构不匹配** - Mock HTTP 但应用用 Tauri IPC
2. **VLM 是装饰而非核心** - 看起来高大上但没有集成到测试流程

### 流程问题
1. **写测试 ≠ 运行测试** - 代码存在但从未执行
2. **截图 ≠ 断言** - 有输出但无验证
3. **可选检查 ≠ 强制检查** - `if (count > 0)` 让测试总是"通过"

### 心态问题
1. **过度关注框架完整性，忽略实际效果**
2. **追求功能数量而非测试质量**
3. **假设"有测试代码"等于"被测试了"**

---

## 修复方案

### 1. 强制 VLM 视觉验证

```typescript
// 不是可选的，而是必须的
test('CRITICAL: Terminal must show correct stats', async ({ page }) => {
  const vlm = new VLMClient({ provider: 'auto' });
  
  // 1. 先打开项目
  await openProject(page, '/path/to/test/project');
  
  // 2. 等待索引完成
  await waitForIndexing(page);
  
  // 3. VLM 视觉断言 - 不是截图，是断言！
  const screenshot = await page.screenshot({ encoding: 'base64' });
  const result = await vlm.assertVisual({
    screenshot,
    assertion: '终端面板应显示 "发现 X 个文件, Y 个函数, Z 个结构体"，其中 X、Y、Z 不为 0',
  });
  
  expect(result.passed).toBe(true);  // 强制断言
});
```

### 2. Mock Tauri IPC 而非 HTTP

```typescript
// 正确的 mock 方式
await page.evaluate(() => {
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, args: any) => {
      if (cmd === 'open_project') {
        return { files_count: 100, functions_count: 500, structs_count: 50 };
      }
      // ... 其他命令
    }
  };
});
```

### 3. 消除可选检查

```diff
- if (await statsElement.count() > 0) {
-   // check
- }

+ // 必须存在
+ await expect(statsElement).toBeVisible({ timeout: 10000 });
+ // 必须有正确内容
+ const text = await statsElement.textContent();
+ expect(text).not.toMatch(/发现\s*0\s*个文件.*0\s*个函数/);
```

### 4. 端到端真实流程测试

```typescript
test('E2E: Open kernel GPIO and verify stats', async ({ page }) => {
  // 真实操作，不是 mock
  await page.click('[data-testid="open-project"]');
  await page.fill('input', '/Users/sky/linux-kernel/linux/drivers/gpio');
  await page.click('button:has-text("打开")');
  
  // 等待索引（真实的，可能需要几秒到几分钟）
  await page.waitForSelector('text=/发现.*个文件/', { timeout: 120000 });
  
  // 验证统计
  const stats = await page.textContent('[data-testid="project-stats"]');
  expect(stats).toMatch(/发现\s+[1-9]\d*\s+个文件/);  // 不能是 0
  
  // VLM 视觉验证作为补充
  const vlm = new VLMClient({ provider: 'auto' });
  const issues = await vlm.detectVisualIssues(await page.screenshot({ encoding: 'base64' }));
  expect(issues.filter(i => i.severity === 'critical')).toHaveLength(0);
});
```

---

## 教训总结

1. **测试代码 ≠ 测试** - 代码存在不等于被执行，被执行不等于有效验证
2. **框架完善 ≠ 测试完善** - 框架只是工具，关键是如何使用
3. **VLM 是增强不是魔法** - 需要明确的断言，不能只截图
4. **Mock 要对应实际架构** - Tauri 应用要 mock IPC 不是 HTTP
5. **可选检查是陷阱** - `if (exists)` 让 bug 逃逸

---

## 行动计划

- [ ] 重写测试用例，使用强制断言
- [ ] 添加 Tauri IPC mock 支持
- [ ] 集成 VLM 断言到关键测试
- [ ] 添加真实 E2E 测试（打开真实项目）
- [ ] CI 中强制运行测试，失败则阻塞合并
- [ ] 每次发布前人工执行关键流程验证

---

## 补充：UI 交互问题未被发现

### 额外发现的问题

| 问题 | 严重程度 | 测试是否检测 |
|------|----------|-------------|
| 函数单击无反应，需要双击 | 高 | ❌ 未检测 |
| 按钮太小 (`h-3.5 w-3.5`) | 中 | ❌ 未检测 |
| 文字太小 (`text-[10px]`) | 中 | ❌ 未检测 |
| 布局过于紧凑 | 低 | ❌ 未检测 |
| 没有 hover 视觉反馈 | 中 | ❌ 未检测 |

### 代码中的问题

```typescript
// OutlinePanel: 单击只选中，不触发分析
onClick={() => setSelectedItem(itemId)}  // 只是选中
onDoubleClick={() => handleAnalyzeFunction(item.name)}  // 需要双击

// 用户期望：单击函数 → 看到执行流
// 实际行为：单击 → 无明显反应
```

```typescript
// 元素尺寸过小
<ChevronDown className="h-3 w-3" />  // 12x12px - 太小
<span className="text-[10px]">...</span>  // 10px 字体 - 太小
<Icon className="h-3.5 w-3.5" />  // 14x14px - 勉强
```

### 为什么测试没发现？

1. **没有交互测试** - 只验证元素存在，不验证点击响应
2. **没有尺寸检查** - 从不检查 WCAG 触摸目标要求
3. **VLM 未使用** - 视觉 AI 可以发现布局问题但从未调用
4. **用户视角缺失** - 开发者假设用户知道双击

### 新增测试要求

```typescript
// 1. 交互响应测试
test('函数点击必须有响应', async ({ page }) => {
  const func = page.locator('[data-testid="function-item"]');
  await func.click();
  // 必须有视觉变化或状态变化
  await expect(func).toHaveClass(/selected|active/);
});

// 2. 尺寸检查
test('可点击元素至少 24x24px', async ({ page }) => {
  const buttons = page.locator('button');
  for (const btn of await buttons.all()) {
    const box = await btn.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
});

// 3. VLM 视觉验证
test('布局应该合理', async ({ page }) => {
  const vlm = new VLMClient({ provider: 'auto' });
  const result = await vlm.detectVisualIssues(screenshot);
  expect(result.filter(i => i.severity === 'high')).toHaveLength(0);
});
```

---

## 三个 Agent 的责任

### 测试 Agent (test-agent)
- **应该发现**: 所有功能性 bug（0 文件、LLVM IR 空）
- **实际表现**: 测试代码写了但没运行，或运行了但断言无效
- **改进**: 强制断言，CI 阻塞

### 审计 Agent (code-reviewer)
- **应该发现**: 代码质量问题（可选检查、未使用的功能）
- **实际表现**: 没有检查测试代码是否真正有效
- **改进**: Review 测试代码的断言逻辑

### VLM/视觉 Agent (visual-tester)
- **应该发现**: UI 布局问题、交互问题
- **实际表现**: 从未被调用
- **改进**: 每次 PR 自动运行视觉检查

---

*这次失败的根本原因：我们构建了一个看起来很专业的测试框架，但它只是个空壳。真正的测试需要的是对功能的深入理解和严格的验证逻辑，而不是花哨的工具。*

**新增教训**：UI 交互问题需要从用户视角测试，不能假设用户知道隐藏的操作（如双击）。VLM 视觉测试不是装饰，必须真正使用。
