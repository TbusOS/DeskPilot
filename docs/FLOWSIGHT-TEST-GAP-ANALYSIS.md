# FlowSight 测试能力差距分析

> 分析 DeskPilot 框架是否能完整测试 FlowSight IDE 的所有功能

## 一、FlowSight 功能清单

### 1. 项目管理
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 打开项目 | 选择文件夹，触发索引 | ✅ TauriDialogTester | - |
| 索引进度 | 显示扫描/解析/索引进度 | ⚠️ 部分支持 | 需要状态验证 |
| 项目统计 | 文件数、函数数、结构体数 | ⚠️ 部分支持 | **关键 bug 点** |
| 关闭项目 | 清理状态 | ✅ 基本支持 | - |

### 2. UI 布局
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| Header | 顶部导航栏 | ✅ 基本 DOM | - |
| Sidebar | 左侧图标栏 | ✅ 基本 DOM | - |
| 面板调整 | 拖拽调整面板大小 | ❌ 缺失 | **需要新模块** |
| 响应式 | 不同窗口大小适配 | ✅ InteractionTester | - |
| 主题切换 | 深色/浅色主题 | ❌ 缺失 | **需要新模块** |
| 动画效果 | Framer Motion 动画 | ❌ 缺失 | 需要验证 |

### 3. 文件浏览器
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 文件树 | 显示项目文件结构 | ✅ VirtualListTester | - |
| 虚拟滚动 | 大文件树性能 | ✅ VirtualListTester | - |
| 文件选择 | 点击打开文件 | ✅ 基本 DOM | - |
| 文件夹展开 | 展开/折叠目录 | ✅ VirtualListTester | - |
| 文件搜索 | 快速定位文件 | ⚠️ 部分支持 | 需要增强 |

### 4. 执行流视图 (FlowView)
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 节点渲染 | @xyflow/react 节点 | ✅ FlowTester | - |
| 边渲染 | 节点间连线 | ✅ FlowTester | - |
| dagre 布局 | 自动布局算法 | ✅ FlowTester | - |
| 缩放/平移 | 画布操作 | ✅ FlowTester | - |
| 节点点击 | 选中节点，显示详情 | ✅ FlowTester | - |
| 异步边界 | 异步调用标记 | ⚠️ 部分支持 | 需要颜色验证 |
| 导出图片 | PNG/SVG 导出 | ❌ 缺失 | 需要验证 |

### 5. 代码编辑器 (Monaco)
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 语法高亮 | C/Rust 语法着色 | ✅ MonacoTester | - |
| 代码导航 | 跳转定义/引用 | ✅ MonacoTester | - |
| 查找替换 | Cmd+F 查找 | ✅ MonacoTester | - |
| 行号跳转 | Cmd+G 跳转 | ✅ MonacoTester | - |
| 代码补全 | 智能补全 | ✅ MonacoTester | - |
| 文件标签 | 多文件标签切换 | ❌ 缺失 | 需要新模块 |

### 6. 命令面板
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 打开面板 | Cmd+K 触发 | ✅ 键盘测试 | - |
| 命令搜索 | 模糊搜索命令 | ⚠️ 部分支持 | 需要增强 |
| 命令执行 | 选择执行命令 | ⚠️ 部分支持 | 需要结果验证 |
| 关闭面板 | Escape 关闭 | ✅ 键盘测试 | - |

### 7. 快捷键
| 快捷键 | 功能 | DeskPilot 支持 |
|--------|------|---------------|
| Cmd+K | 命令面板 | ✅ |
| Cmd+B | 切换侧边栏 | ✅ |
| Cmd+E | 切换文件浏览器 | ✅ |
| Cmd+J | 切换底部面板 | ✅ |
| Cmd+\ | 切换右侧面板 | ✅ |
| Cmd+1/2/3 | 切换视图模式 | ✅ |
| Cmd+W | 关闭当前文件 | ✅ |
| Cmd+Shift+F | 全局搜索 | ✅ |

### 8. 右侧面板
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 大纲面板 | 函数/结构体列表 | ⚠️ 部分支持 | 需要树结构验证 |
| 详情面板 | 节点详细信息 | ⚠️ 部分支持 | 需要数据验证 |
| 搜索面板 | 搜索结果列表 | ⚠️ 部分支持 | 需要增强 |
| LLVM IR | IR 代码显示 | ❌ 缺失 | 需要验证 |

### 9. 底部面板
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 终端面板 | 命令日志显示 | ⚠️ 部分支持 | 需要日志验证 |
| 输出颜色 | 不同类型不同颜色 | ❌ 缺失 | 需要样式验证 |

### 10. 状态栏
| 功能 | 描述 | DeskPilot 支持 | 缺失 |
|------|------|---------------|------|
| 索引状态 | 显示索引进度 | ⚠️ 部分支持 | 需要状态验证 |
| 文件信息 | 当前文件路径 | ⚠️ 部分支持 | 需要验证 |
| 统计信息 | 行数/列数 | ⚠️ 部分支持 | 需要验证 |

## 二、缺失的测试能力

### P0 - 必须实现

#### 1. 面板调整测试 (ResizablePanelTester)
```typescript
// 需要测试拖拽调整面板大小
const panel = test.resizablePanel('[data-testid="left-panel"]');
await panel.resize(300); // 设置宽度
await panel.assertWidth(300);
await panel.drag(50); // 拖拽增加50px
```

#### 2. 状态验证器 (StateValidator)
```typescript
// 需要验证 Jotai/Zustand 状态
const state = test.state();
await state.assertStore('analysisStore', {
  'currentProject.files_count': { notEqual: 0 },
  'currentProject.functions_count': { greaterThan: 0 }
});
```

#### 3. Tauri IPC 拦截器
```typescript
// 需要拦截和 Mock Tauri invoke 调用
await test.tauri.mockInvoke('open_project', {
  response: { files_count: 100, functions_count: 500 }
});
await test.tauri.assertInvoked('get_execution_flow', { times: 1 });
```

### P1 - 应该实现

#### 4. 主题测试器 (ThemeTester)
```typescript
// 测试主题切换
const theme = test.theme();
await theme.switch('dark');
await theme.assertCurrentTheme('dark');
await theme.assertCSSVariable('--bg-primary', '#1a1a1a');
```

#### 5. 动画验证器
```typescript
// 验证 Framer Motion 动画
await test.animation.waitForComplete('[data-testid="sidebar"]');
await test.animation.assertTransition({ duration: '< 500ms' });
```

### P2 - 可以实现

#### 6. 标签栏测试器
```typescript
// 测试多文件标签
const tabs = test.tabs('[data-testid="tab-bar"]');
await tabs.assertTabCount(3);
await tabs.switchTo('main.c');
await tabs.close('utils.h');
```

## 三、核心测试场景缺失分析

### 场景 1: "0 个文件" Bug 复现
**问题**: 打开项目后显示 "发现 0 个文件，0 个函数，0 个结构体"

**需要的测试能力**:
1. ✅ 打开项目对话框 (TauriDialogTester)
2. ❌ 拦截 Tauri IPC 调用，验证数据正确
3. ❌ 验证 Zustand store 状态更新
4. ✅ 验证 DOM 显示的数字不为 0 (Assertions)

**缺失**: Tauri IPC 拦截器、状态验证器

### 场景 2: 执行流视图渲染
**需要的测试能力**:
1. ✅ 节点渲染 (FlowTester)
2. ✅ 边渲染 (FlowTester)
3. ❌ 验证节点颜色（异步类型）
4. ❌ 验证布局算法正确性
5. ✅ 缩放/平移 (FlowTester)

**缺失**: CSS 样式深度验证

### 场景 3: 面板调整大小
**需要的测试能力**:
1. ❌ 拖拽分隔条
2. ❌ 验证面板宽度/高度变化
3. ❌ 验证最小/最大限制
4. ❌ 验证动画效果

**缺失**: 完整的 ResizablePanelTester

## 四、实施计划

### 阶段 1: 实现核心缺失模块
1. `ResizablePanelTester` - 面板调整测试
2. `StateValidator` - 状态验证
3. `TauriInvokeInterceptor` - Tauri IPC 拦截

### 阶段 2: 增强现有模块
1. `Assertions` - 增加样式/颜色断言
2. `FlowTester` - 增加节点样式验证
3. `VirtualListTester` - 增加搜索功能测试

### 阶段 3: 完善测试用例
1. 创建完整的 FlowSight 集成测试套件
2. 覆盖所有 UI 交互场景
3. 添加性能基准测试

## 五、验收标准

完成后，DeskPilot 应能:
1. ✅ 自动检测 "0 个文件" bug
2. ✅ 验证所有快捷键功能
3. ✅ 测试面板拖拽调整
4. ✅ 验证执行流视图渲染
5. ✅ 测试主题切换
6. ✅ 验证状态管理正确性
7. ✅ 拦截和 Mock Tauri IPC 调用
