# Dashboard 组件化重构文档

## 任务 1: 组件化 - 完成状态

### 已创建的组件

#### 1. **类型定义** (`types.ts`)
- 所有共享的 TypeScript 接口和类型
- Guest, SeatingTable, Project, ProjectMember 等
- statusColors, statusTooltips, theme 常量

#### 2. **UnassignedGuestsPanel** 组件
负责渲染左侧的"未分配宾客"区域:
- ✅ 搜索框
- ✅ 状态筛选器 (4个状态按钮)
- ✅ 添加宾客/导入按钮
- ✅ 未分配宾客列表 (可拖拽)
- ✅ 响应式侧边栏 (移动端可折叠)

**Props**: 
```typescript
{
  unassignedGuests: Guest[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilters: Set<GuestStatus>;
  onStatusFilterToggle: (status: GuestStatus) => void;
  onAddGuest: () => void;
  onImportGuests: () => void;
  onRemoveGuest: (guestId: string) => void;
  onEditGuest: (guest: Guest) => void;
  onCheckInGuest: (guest: Guest) => void;
  leftPanelOpen: boolean;
  onTogglePanel: () => void;
}
```

#### 3. **SortableGuest** 组件
可拖拽的宾客卡片:
- ✅ 头像/首字母显示
- ✅ 状态徽章 (确认/未确认/取消/签到)
- ✅ 锁定状态显示 (签到后锁定)
- ✅ 签到时间显示
- ✅ 操作按钮 (签到/编辑/删除)
- ✅ 拖拽功能集成

#### 4. **TableCard** 组件
单个桌子卡片:
- ✅ 桌子名称和操作按钮
- ✅ 容量显示和进度条
- ✅ 超容量警告 (红色边框)
- ✅ 桌上宾客列表 (可拖拽)
- ✅ 空状态提示

**Props**:
```typescript
{
  table: SeatingTable;
  onRemoveGuest: (guestId: string) => void;
  onEditGuest: (guest: Guest) => void;
  onCheckInGuest: (guest: Guest) => void;
  onEditTable: (table: SeatingTable) => void;
  onDeleteTable: (tableId: string) => void;
}
```

#### 5. **TablesGrid** 组件
中间的桌子网格区域:
- ✅ 页面标题和说明
- ✅ 响应式网格布局 (1/2/3列)
- ✅ 遍历渲染 TableCard
- ✅ 空状态提示

#### 6. **ControlPanel** 组件
右侧控制面板:
- ✅ 项目管理按钮
- ✅ 协作成员按钮
- ✅ 快捷操作按钮 (添加桌子/AI排座/重置)
- ✅ 导出功能按钮 (PDF/桌卡)
- ✅ 关系规则列表和管理
- ✅ 数据统计面板 (包含 StatsChart)
- ✅ 响应式侧边栏 (移动端可折叠)

**Props**:
```typescript
{
  stats: Stats;
  currentProject: Project | null;
  guestNameMap: Map<string, string>;
  onAddTable: () => void;
  onAISeating: () => void;
  onResetLayout: () => void;
  onExportPdf: () => void;
  onExportPlaceCards: () => void;
  onAddRule: () => void;
  onDeleteRule: (rule: NotTogetherRule) => void;
  onManageProjects: () => void;
  onManageCollaborators: () => void;
  rightPanelOpen: boolean;
  onTogglePanel: () => void;
}
```

#### 7. **StatsChart** 组件
数据统计图表:
- ✅ 宾客状态分布条形图
- ✅ 桌子填充率可视化
- ✅ 悬停提示

#### 8. **ModalWrapper** 和 **ConfirmDialog** 组件
通用对话框组件:
- ✅ 模态窗口包装器 (3种尺寸)
- ✅ 确认对话框
- ✅ 背景模糊和点击关闭
- ✅ 可自定义按钮样式

### 文件结构

```
src/
├── components/
│   └── dashboard/
│       ├── types.ts                    # 共享类型定义
│       ├── UnassignedGuestsPanel.tsx   # 左侧面板
│       ├── SortableGuest.tsx           # 可拖拽宾客卡片
│       ├── TablesGrid.tsx              # 中间桌子网格
│       ├── TableCard.tsx               # 单个桌子卡片
│       ├── ControlPanel.tsx            # 右侧控制面板
│       ├── StatsChart.tsx              # 统计图表
│       ├── ModalWrapper.tsx            # 通用对话框组件
│       └── index.ts                    # 导出入口
└── app/
    └── dashboard/
        └── page.tsx                    # 主页面组件 (需要重构)
```

### 如何使用新组件

#### 在重构后的 `dashboard/page.tsx` 中:

```typescript
'use client';

import { DndContext } from '@dnd-kit/core';
import { UnassignedGuestsPanel } from '@/components/dashboard/UnassignedGuestsPanel';
import { TablesGrid } from '@/components/dashboard/TablesGrid';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { ConfirmDialog } from '@/components/dashboard';
import type { Guest, SeatingTable, GuestStatus } from '@/components/dashboard/types';

export default function DashboardPage() {
  // ... 所有 state 和业务逻辑保持不变 ...
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<GuestStatus>>(new Set());

  // ... 所有处理函数保持不变 ...

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={rectIntersection}
      >
        {/* 左侧面板 - 未分配宾客 */}
        <UnassignedGuestsPanel
          unassignedGuests={unassignedGuests}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilters={statusFilters}
          onStatusFilterToggle={(status) => {
            const newFilters = new Set(statusFilters);
            if (newFilters.has(status)) {
              newFilters.delete(status);
            } else {
              newFilters.add(status);
            }
            setStatusFilters(newFilters);
          }}
          onAddGuest={() => setIsModalOpen('addGuest')}
          onImportGuests={() => setIsModalOpen('import')}
          onRemoveGuest={handleRemoveUnassignedGuest}
          onEditGuest={handleEditGuest}
          onCheckInGuest={handleCheckInGuest}
          leftPanelOpen={leftPanelOpen}
          onTogglePanel={() => setLeftPanelOpen(!leftPanelOpen)}
        />

        {/* 中间区域 - 桌子网格 */}
        <TablesGrid
          tables={tables}
          onRemoveGuest={handleRemoveGuestFromTable}
          onEditGuest={handleEditGuest}
          onCheckInGuest={handleCheckInGuest}
          onEditTable={handleEditTable}
          onDeleteTable={handleDeleteTable}
        />

        {/* 右侧面板 - 控制面板 */}
        <ControlPanel
          stats={stats}
          currentProject={currentProject}
          guestNameMap={guestNameMap}
          onAddTable={() => setIsModalOpen('addTable')}
          onAISeating={() => setIsModalOpen('aiSeating')}
          onResetLayout={handleResetLayout}
          onExportPdf={handleExportPdf}
          onExportPlaceCards={handleExportPlaceCards}
          onAddRule={() => setIsModalOpen('addRule')}
          onDeleteRule={handleDeleteRule}
          onManageProjects={() => setIsModalOpen('projects')}
          onManageCollaborators={() => setIsModalOpen('collaborators')}
          rightPanelOpen={rightPanelOpen}
          onTogglePanel={() => setRightPanelOpen(!rightPanelOpen)}
        />

        {/* 拖拽覆盖层 */}
        <DragOverlay>
          {activeGuest && (
            <div className="p-3 bg-gray-700 rounded-lg opacity-90">
              {activeGuest.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modals - 这些将在后续任务中继续拆分 */}
      {/* ... Modal 内容保持不变 ... */}
      
      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
```

### 组件化带来的改进

#### 1. **代码可读性**
- ✅ 主组件从 3200+ 行减少到 ~800 行 (预计)
- ✅ 每个组件职责单一明确
- ✅ 更容易定位和修改特定功能

#### 2. **可维护性**
- ✅ 组件独立测试
- ✅ 修改一个组件不影响其他组件
- ✅ 更容易追踪 props 和数据流

#### 3. **可复用性**
- ✅ SortableGuest 在左侧和桌子中都使用
- ✅ ModalWrapper 可用于所有对话框
- ✅ StatsChart 可独立使用

#### 4. **性能优化空间**
- ✅ 可以为每个子组件添加 React.memo
- ✅ 可以更精确地控制重渲染
- ✅ 更容易识别性能瓶颈

### 下一步行动

要完成组件化重构,需要:

1. **更新 `dashboard/page.tsx`**
   - 导入新组件
   - 移除已拆分的 UI 代码
   - 保留所有业务逻辑和 state
   - 传递 props 给子组件

2. **继续拆分 Modal 组件** (可选,后续任务)
   - AddGuestModal
   - AddTableModal
   - AISeatingModal
   - CheckInModal
   - ProjectManagementModal
   - CollaboratorModal
   - 等等...

3. **测试验证**
   - 确保所有功能正常工作
   - 检查拖拽功能
   - 验证实时协作
   - 测试响应式布局

### 优势总结

#### 代码组织
- **之前**: 3200+ 行单文件,难以导航
- **现在**: 8个专注的小组件,清晰的文件结构

#### 开发体验
- **之前**: 修改需要滚动查找,容易出错
- **现在**: 直接打开相关组件文件,快速定位

#### 团队协作
- **之前**: 多人修改同一文件容易冲突
- **现在**: 不同开发者可以独立修改不同组件

#### 测试
- **之前**: 难以编写单元测试
- **现在**: 每个组件可以独立测试

### 注意事项

1. **保持业务逻辑在父组件**
   - 所有 state 管理仍在 DashboardPage
   - 子组件只负责展示和触发回调
   - 避免过度拆分导致 props drilling

2. **保持原有功能完整**
   - 所有拖拽逻辑保持不变
   - 锁定宾客逻辑保持不变
   - 实时协作功能保持不变
   - 不改变任何业务规则

3. **渐进式重构**
   - 可以逐步替换,不需要一次性完成
   - 先替换简单组件,验证无误后继续
   - 保持代码始终可运行

---

## 示例: 重构前后对比

### 之前 (部分代码):
```typescript
// dashboard/page.tsx (3200+ 行)
export default function DashboardPage() {
  // ... 500 行 state 定义 ...
  // ... 1000 行业务逻辑函数 ...
  
  return (
    <div>
      {/* 300 行左侧面板 JSX */}
      <aside>
        {/* 搜索框 */}
        {/* 筛选按钮 */}
        {/* 宾客列表 */}
      </aside>
      
      {/* 800 行中间区域 JSX */}
      <main>
        {tables.map(table => (
          {/* 200 行桌子卡片 JSX */}
        ))}
      </main>
      
      {/* 400 行右侧面板 JSX */}
      <aside>
        {/* 控制按钮 */}
        {/* 规则列表 */}
        {/* 统计图表 */}
      </aside>
      
      {/* 200 行 Modal JSX */}
    </div>
  );
}
```

### 之后:
```typescript
// dashboard/page.tsx (~800 行)
export default function DashboardPage() {
  // ... 500 行 state 定义和业务逻辑 (保持不变) ...
  
  return (
    <div>
      <UnassignedGuestsPanel {...leftPanelProps} />
      <TablesGrid {...gridProps} />
      <ControlPanel {...controlProps} />
      {/* Modals */}
    </div>
  );
}

// components/dashboard/UnassignedGuestsPanel.tsx (~150 行)
// components/dashboard/TableCard.tsx (~100 行)
// components/dashboard/ControlPanel.tsx (~200 行)
// ... 其他组件 ...
```

---

**状态**: ✅ 任务1 基础组件创建完成,等待集成到主页面
