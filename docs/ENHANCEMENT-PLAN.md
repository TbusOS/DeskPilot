# DeskPilot Enhancement Plan v2.0

> 结合 agent-browser、UI-TARS-desktop 的优势，打造最强大的桌面自动化测试框架

## 一、功能增强清单

### P0 - 立即需要（核心功能）

#### 1. Ref 机制 (借鉴 agent-browser)
**目标**: snapshot 后用 ref 操作元素，提高测试稳定性

```typescript
// 使用示例
const snapshot = await test.snapshot();
// snapshot 返回带 ref 的元素: @e1, @e2, @e3...

await test.click('@e1');  // 点击第一个交互元素
await test.fill('@e3', 'hello');  // 填充表单
await test.hover('@e5');  // 悬停
```

**实现要点**:
- [ ] `RefManager` 类：管理 ref 与元素的映射
- [ ] 增强 `snapshot()` 返回带 ref 的结构化数据
- [ ] 所有交互方法支持 `@eN` 格式
- [ ] ref 在页面变化后自动失效
- [ ] 支持 nth 索引处理重复元素

#### 2. 网络拦截 (借鉴 agent-browser)
**目标**: Mock API 响应，测试边界情况

```typescript
// 使用示例
await test.network.route('**/api/files', {
  status: 200,
  body: { files: [], total: 0 }
});

await test.network.route('**/api/error', { abort: true });

const requests = await test.network.getRequests({ filter: 'api' });
```

**实现要点**:
- [ ] `NetworkInterceptor` 类
- [ ] 请求路由和 Mock 响应
- [ ] 请求阻止功能
- [ ] 请求记录和过滤
- [ ] 响应修改

#### 3. 流程图测试 (FlowSight 需求)
**目标**: 测试 @xyflow/react 执行流视图

```typescript
// 使用示例
const flowTester = test.flow();

// 节点测试
const nodes = await flowTester.getNodes();
await flowTester.clickNode('probe');
await flowTester.assertNodeExists('usb_register_driver');

// 连线测试
const edges = await flowTester.getEdges();
await flowTester.assertEdgeExists('probe', 'usb_register_driver');

// 布局测试
await flowTester.assertLayout('tree'); // or 'dagre'
await flowTester.zoom(1.5);
await flowTester.pan(100, 50);
await flowTester.fitView();
```

**实现要点**:
- [ ] `FlowTester` 类
- [ ] 节点查询和操作
- [ ] 连线验证
- [ ] 布局算法验证
- [ ] 缩放/平移测试
- [ ] 节点位置断言

#### 4. 虚拟滚动测试 (FlowSight 需求)
**目标**: 测试大型文件树的虚拟滚动

```typescript
// 使用示例
const virtualList = test.virtualList('[data-testid="file-tree"]');

await virtualList.scrollToIndex(1000);
await virtualList.scrollToItem('gpio-brcmstb.c');
await virtualList.assertItemVisible('gpio-brcmstb.c');
await virtualList.assertItemCount(2000);

// 性能测试
const metrics = await virtualList.measureScrollPerformance();
assert.lessThan(metrics.fps, 30); // 至少 30 FPS
```

**实现要点**:
- [ ] `VirtualListTester` 类
- [ ] 滚动到指定索引/项
- [ ] 可见性断言
- [ ] 懒加载验证
- [ ] 滚动性能测量

### P1 - 短期（增强功能）

#### 5. 会话管理 (借鉴 agent-browser)
**目标**: 多会话并行测试

```typescript
// 使用示例
const session1 = await DeskPilot.createSession('main');
const session2 = await DeskPilot.createSession('secondary');

// 并行操作
await Promise.all([
  session1.navigate('/page1'),
  session2.navigate('/page2')
]);

// 会话列表
const sessions = await DeskPilot.listSessions();

// 切换会话
await DeskPilot.switchSession('main');
```

**实现要点**:
- [ ] `SessionManager` 类
- [ ] 会话创建/销毁
- [ ] 会话隔离
- [ ] 会话状态持久化
- [ ] 并行测试支持

#### 6. 执行流可视化 (借鉴 UI-TARS Visualizer)
**目标**: 测试执行过程可视化

```typescript
// 使用示例
const visualizer = new Visualizer();

test.on('step', (step) => {
  visualizer.addStep(step);
});

test.on('screenshot', (screenshot) => {
  visualizer.addScreenshot(screenshot);
});

// 生成报告
await visualizer.generateReport('./reports/test-run.html');

// 导出 YAML 格式
await visualizer.exportYAML('./reports/test-run.yaml');
```

**实现要点**:
- [ ] `Visualizer` 类
- [ ] 步骤时间线
- [ ] 截图对比
- [ ] HTML 报告生成
- [ ] YAML 导出
- [ ] 交互式回放

#### 7. Monaco 编辑器测试 (FlowSight 需求)
**目标**: 测试代码编辑器功能

```typescript
// 使用示例
const editor = test.monacoEditor('[data-testid="code-editor"]');

// 内容操作
await editor.setValue('int main() {}');
const content = await editor.getValue();
await editor.insertText(5, 10, 'new code');

// 导航
await editor.goToLine(100);
await editor.goToDefinition();
await editor.findReferences();

// 语法高亮验证
const tokens = await editor.getTokensAtLine(1);
await editor.assertSyntaxHighlight('function', 'keyword');

// 代码补全
await editor.triggerCompletion();
await editor.selectCompletion('printf');
```

**实现要点**:
- [ ] `MonacoEditorTester` 类
- [ ] 内容读写
- [ ] 光标/选择操作
- [ ] 定义跳转测试
- [ ] 语法高亮验证
- [ ] 代码补全测试

#### 8. Tauri 原生对话框 (FlowSight 需求)
**目标**: 测试文件打开/保存对话框

```typescript
// 使用示例
const dialog = test.tauriDialog();

// 文件打开对话框
await dialog.expectFileOpen();
await dialog.selectFile('/path/to/file.c');

// 目录选择
await dialog.expectDirectoryPicker();
await dialog.selectDirectory('/path/to/project');

// 保存对话框
await dialog.expectFileSave();
await dialog.setFilename('output.json');
await dialog.confirm();

// Mock 对话框响应
await dialog.mockFileOpen('/mock/path/file.c');
```

**实现要点**:
- [ ] `TauriDialogTester` 类
- [ ] 文件对话框拦截
- [ ] 目录选择测试
- [ ] 对话框 Mock
- [ ] Tauri IPC 集成

#### 9. 性能基准测试
**目标**: 大规模代码索引性能测试

```typescript
// 使用示例
const benchmark = test.benchmark();

// 测量操作耗时
const indexTime = await benchmark.measure('index-project', async () => {
  await test.click('[data-testid="open-project"]');
  await test.waitFor('[data-testid="index-complete"]');
});

// 断言性能
benchmark.assertDuration('index-project', { max: 5000 }); // 5秒内

// 内存监控
const memory = await benchmark.measureMemory();
benchmark.assertMemory({ max: 500 * 1024 * 1024 }); // 500MB

// 生成报告
await benchmark.generateReport('./reports/performance.json');
```

**实现要点**:
- [ ] `BenchmarkTester` 类
- [ ] 操作耗时测量
- [ ] 内存监控
- [ ] CPU 使用率监控
- [ ] 性能报告生成
- [ ] 基准对比

### P2 - 中期（高级功能）

#### 10. 流式预览 (借鉴 agent-browser)
**目标**: WebSocket 实时查看测试执行

```typescript
// 启动流式服务器
const stream = await test.startStreaming({ port: 9223 });

// 客户端连接
// ws://localhost:9223 可以实时看到测试执行画面

// 配置
stream.setFrameRate(30);
stream.setQuality(80);

// 停止
await stream.stop();
```

**实现要点**:
- [ ] `StreamServer` 类
- [ ] WebSocket 服务
- [ ] 实时帧推送
- [ ] 输入事件注入
- [ ] 多客户端支持

#### 11. Daemon 模式 (借鉴 agent-browser)
**目标**: 持久化进程，加速连续测试

```typescript
// 启动 daemon
await DeskPilot.startDaemon();

// 连接到 daemon
const test = await DeskPilot.connect();

// 测试执行（复用浏览器实例）
await test.navigate('/page');

// 停止 daemon
await DeskPilot.stopDaemon();
```

**实现要点**:
- [ ] `DaemonManager` 类
- [ ] Unix Socket / TCP 通信
- [ ] 浏览器实例复用
- [ ] PID 文件管理
- [ ] 自动启动/停止

#### 12. 时间线组件测试 (FlowSight 需求)
**目标**: 异步时间线可视化测试

```typescript
// 使用示例
const timeline = test.timeline('[data-testid="async-timeline"]');

// 事件验证
const events = await timeline.getEvents();
await timeline.assertEventOrder(['irq', 'workqueue', 'callback']);

// 时间刻度
await timeline.assertTimeRange(0, 1000); // 0-1000ms

// 并发事件
await timeline.assertConcurrentEvents(['timer1', 'timer2']);

// 交互
await timeline.clickEvent('workqueue');
await timeline.zoomToRange(100, 500);
```

**实现要点**:
- [ ] `TimelineTester` 类
- [ ] 事件查询
- [ ] 时间顺序验证
- [ ] 并发事件测试
- [ ] 缩放/平移

## 二、技术架构

### 新增模块结构

```
packages/desktop-test/src/
├── core/
│   ├── ref-manager.ts          # P0: Ref 机制
│   ├── network-interceptor.ts  # P0: 网络拦截
│   ├── flow-tester.ts          # P0: 流程图测试
│   ├── virtual-list-tester.ts  # P0: 虚拟滚动测试
│   ├── session-manager.ts      # P1: 会话管理
│   ├── visualizer.ts           # P1: 执行流可视化
│   ├── monaco-tester.ts        # P1: Monaco 编辑器测试
│   ├── tauri-dialog.ts         # P1: Tauri 对话框
│   ├── benchmark.ts            # P1: 性能基准测试
│   ├── stream-server.ts        # P2: 流式预览
│   ├── daemon.ts               # P2: Daemon 模式
│   └── timeline-tester.ts      # P2: 时间线测试
└── index.ts                    # 导出所有模块
```

### 依赖更新

```json
{
  "dependencies": {
    "ws": "^8.x",           // WebSocket (流式预览)
    "better-sqlite3": "^9.x" // 会话状态持久化
  },
  "peerDependencies": {
    "@xyflow/react": "^12.x",  // 流程图测试
    "monaco-editor": "^0.45.x" // Monaco 测试
  }
}
```

## 三、开发计划

### Phase 1: P0 功能 (本周)

| 任务 | 预计文件 | 复杂度 |
|------|---------|--------|
| Ref 机制 | ref-manager.ts | 中 |
| 网络拦截 | network-interceptor.ts | 中 |
| 流程图测试 | flow-tester.ts | 高 |
| 虚拟滚动测试 | virtual-list-tester.ts | 中 |

### Phase 2: P1 功能

| 任务 | 预计文件 | 复杂度 |
|------|---------|--------|
| 会话管理 | session-manager.ts | 中 |
| 执行流可视化 | visualizer.ts | 高 |
| Monaco 编辑器测试 | monaco-tester.ts | 高 |
| Tauri 对话框 | tauri-dialog.ts | 中 |
| 性能基准测试 | benchmark.ts | 中 |

### Phase 3: P2 功能

| 任务 | 预计文件 | 复杂度 |
|------|---------|--------|
| 流式预览 | stream-server.ts | 高 |
| Daemon 模式 | daemon.ts | 高 |
| 时间线测试 | timeline-tester.ts | 中 |

## 四、验收标准

### P0 功能验收

1. **Ref 机制**
   - [ ] snapshot 返回带 ref 的元素列表
   - [ ] 所有交互方法支持 @eN 格式
   - [ ] 页面变化后 ref 自动失效
   - [ ] FlowSight 测试使用 ref 机制

2. **网络拦截**
   - [ ] 可以 Mock API 响应
   - [ ] 可以阻止特定请求
   - [ ] 可以记录请求历史
   - [ ] FlowSight API 测试使用网络拦截

3. **流程图测试**
   - [ ] 可以获取所有节点和连线
   - [ ] 可以点击/悬停节点
   - [ ] 可以验证布局
   - [ ] FlowSight 执行流测试通过

4. **虚拟滚动测试**
   - [ ] 可以滚动到指定索引
   - [ ] 可以验证项可见性
   - [ ] 可以测量滚动性能
   - [ ] FlowSight 文件树测试通过

## 五、FlowSight 集成测试用例

### 新增测试文件

```typescript
// app/tests/desktop/enhanced-tests.spec.ts

import { DeskPilot, Assertions } from 'deskpilot';

describe('FlowSight Enhanced Tests', () => {
  
  // 使用 Ref 机制
  test('file tree navigation with refs', async () => {
    const snapshot = await test.snapshot();
    const fileItems = snapshot.filter(e => e.role === 'treeitem');
    
    await test.click(fileItems[0].ref); // @e1
    await test.dblclick(fileItems[5].ref); // @e6
  });
  
  // 网络拦截测试边界情况
  test('handles empty file list gracefully', async () => {
    await test.network.route('**/api/index', {
      body: { files: [], functions: [], structs: [] }
    });
    
    await test.click('[data-testid="open-project"]');
    await test.waitFor('[data-testid="empty-state"]');
  });
  
  // 流程图测试
  test('execution flow visualization', async () => {
    const flow = test.flow();
    
    await flow.clickNode('probe');
    await flow.assertNodeExists('usb_register_driver');
    await flow.assertEdgeExists('probe', 'usb_register_driver');
    await flow.assertLayout('tree');
  });
  
  // 虚拟滚动测试
  test('large file tree performance', async () => {
    const fileTree = test.virtualList('[data-testid="file-tree"]');
    
    await fileTree.scrollToItem('gpio-brcmstb.c');
    await fileTree.assertItemVisible('gpio-brcmstb.c');
    
    const metrics = await fileTree.measureScrollPerformance();
    assert.greaterThan(metrics.fps, 30);
  });
});
```

---

**文档版本**: v2.0  
**创建日期**: 2025-02-01  
**作者**: DeskPilot Team
