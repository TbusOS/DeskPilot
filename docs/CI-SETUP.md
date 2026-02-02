# DeskPilot CI 配置指南

## 概述

DeskPilot 提供完整的 CI/CD 集成，包括：

1. **基础功能测试** - 每次 push/PR 运行
2. **VLM 视觉检查** - 每个 PR 必须通过
3. **完整 VLM 测试** - push 到 main 时运行

## GitHub Branch Protection 配置

要让 PR 必须通过测试才能合并，需要配置 Branch Protection Rules：

### 步骤

1. 打开仓库 **Settings**
2. 点击 **Branches**
3. 点击 **Add branch protection rule**
4. 配置规则：

```
Branch name pattern: main
```

勾选以下选项：

- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass before merging**
  - 搜索并添加：
    - `DeskPilot Tests (Required)`
    - `Visual Check (Required for PR)`
- ✅ **Require branches to be up to date before merging**
- ✅ **Do not allow bypassing the above settings**

### 状态检查说明

| 检查名称 | 运行时机 | 阻塞 PR |
|----------|----------|---------|
| `DeskPilot Tests (Required)` | 每次 push/PR | ✅ 是 |
| `Visual Check (Required for PR)` | 仅 PR | ✅ 是 |
| `Full VLM Tests` | push 到 main | ❌ 否 |

## Secrets 配置

需要在仓库中配置以下 Secrets：

1. 打开 **Settings** > **Secrets and variables** > **Actions**
2. 添加：

| Secret 名称 | 描述 |
|-------------|------|
| `ANTHROPIC_API_KEY` | Anthropic API Key（用于 VLM 测试） |

## 工作流文件

工作流定义在 `.github/workflows/deskpilot.yml`：

```yaml
name: DeskPilot Tests

on:
  push:
    branches: [main, shadcn-ui]
  pull_request:
    branches: [main, shadcn-ui]

jobs:
  # Job 1: 基础测试（必须通过）
  deskpilot-test:
    name: DeskPilot Tests (Required)
    ...

  # Job 2: VLM 视觉检查（PR 必须通过）
  deskpilot-visual-check:
    name: Visual Check (Required for PR)
    needs: deskpilot-test
    if: github.event_name == 'pull_request'
    ...

  # Job 3: 完整 VLM 测试（push 到 main）
  deskpilot-vlm-full:
    name: Full VLM Tests
    needs: deskpilot-test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    ...
```

## PR 视觉检查

每个 PR 会自动运行视觉检查，包括：

1. **空白区域检查** - 确保页面没有意外的空白
2. **数据显示检查** - 确保数据正确显示（不为零）
3. **布局检查** - 确保布局正确
4. **无障碍性检查** - 确保符合 WCAG 标准
5. **整体 UI 质量** - AI 评估整体 UI 质量

检查结果会自动评论到 PR 上：

```markdown
## 🔍 DeskPilot Visual Check

| 检查项 | 状态 |
|--------|------|
| 空白区域检查 | ✅ 通过 |
| 数据显示检查 | ✅ 通过 |
| 布局检查 | ✅ 通过 |
| 无障碍性检查 | ✅ 通过 |
| 整体 UI 质量 | ✅ 通过 |

**总计:** 5/5 通过
```

## 本地测试

### Agent Mode（推荐 - 免费）

在 Cursor IDE 或 Claude Code CLI 中运行，自动使用当前模型：

```bash
# 1. 启动应用
cd app
WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 pnpm tauri dev

# 2. 运行基础测试
cd packages/desktop-test
npx tsx examples/flowsight-tests.ts

# 3. 运行完整功能测试（自动检测 Cursor/Claude Code）
npx tsx examples/full-feature-tests.ts

# 4. 运行 PR 视觉检查（Agent Mode 免费）
npx tsx examples/pr-visual-check.ts
```

### API Key Mode（CI 环境）

CI 环境没有 Cursor/Claude Code，需要用 API Key：

```bash
USE_API_KEY=true ANTHROPIC_API_KEY=your-key npx tsx examples/pr-visual-check.ts
```

## 成本控制

### Agent Mode（本地开发）

在 Cursor IDE 或 Claude Code CLI 中运行测试是**免费**的！
- 自动使用你当前订阅的模型（如 Opus 4.5）
- 不需要额外的 API Key
- 不产生额外费用

### API Key Mode（CI 环境）

CI 环境需要 API Key，会产生费用：

| 测试类型 | 预估成本 |
|----------|----------|
| PR 视觉检查（5 项） | ~$0.05 |
| 完整 VLM 测试 | ~$0.10 |

每月费用取决于 PR 数量。

**建议**：本地开发用 Agent Mode（免费），CI 才用 API Key。

## 故障排除

### 测试超时

增加 `TEST_TIMEOUT` 环境变量：

```yaml
env:
  TEST_TIMEOUT: 120000  # 2 分钟
```

### VLM 调用失败

1. 检查 `ANTHROPIC_API_KEY` 是否正确配置
2. 检查 API 配额是否充足
3. 查看日志中的错误信息

### 截图问题

确保应用已完全加载：

```typescript
await test.wait(5000);  // 等待 5 秒
```

## 相关文件

- `.github/workflows/deskpilot.yml` - CI 工作流
- `packages/desktop-test/examples/pr-visual-check.ts` - PR 视觉检查
- `packages/desktop-test/examples/full-feature-tests.ts` - 完整功能测试
- `packages/desktop-test/src/core/vlm-assertions.ts` - VLM 断言工具
