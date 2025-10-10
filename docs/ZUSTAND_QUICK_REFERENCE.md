# Zustand Store 快速参考

## 导入
```typescript
import { useSeatingStore, useStats, useFilteredUnassignedGuests, useAllGuests, useGuestNameMap } from '@/store/seatingStore';
```

## 常用状态

```typescript
// 核心数据
const tables = useSeatingStore((state) => state.tables);
const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
const currentProject = useSeatingStore((state) => state.currentProject);
const user = useSeatingStore((state) => state.user);

// UI 状态
const isLoading = useSeatingStore((state) => state.isLoading);
const isSaving = useSeatingStore((state) => state.isSaving);
const hasUnsavedChanges = useSeatingStore((state) => state.hasUnsavedChanges);
const notification = useSeatingStore((state) => state.notification);

// Modal 状态
const isModalOpen = useSeatingStore((state) => state.isModalOpen);
const inputValue = useSeatingStore((state) => state.inputValue);

// 面板状态
const leftPanelOpen = useSeatingStore((state) => state.leftPanelOpen);
const rightPanelOpen = useSeatingStore((state) => state.rightPanelOpen);

// 搜索筛选
const searchQuery = useSeatingStore((state) => state.searchQuery);
const activeStatusFilter = useSeatingStore((state) => state.activeStatusFilter);
```

## 常用 Actions

```typescript
// UI 控制
const setIsLoading = useSeatingStore((state) => state.setIsLoading);
const showNotification = useSeatingStore((state) => state.showNotification);
const markChanges = useSeatingStore((state) => state.markChanges);

// 数据设置
const setTables = useSeatingStore((state) => state.setTables);
const setUnassignedGuests = useSeatingStore((state) => state.setUnassignedGuests);
const setCurrentProject = useSeatingStore((state) => state.setCurrentProject);

// 宾客管理
const addGuests = useSeatingStore((state) => state.addGuests);
const addGuestsFromInput = useSeatingStore((state) => state.addGuestsFromInput);
const deleteUnassignedGuest = useSeatingStore((state) => state.deleteUnassignedGuest);
const checkInGuest = useSeatingStore((state) => state.checkInGuest);
const updateGuest = useSeatingStore((state) => state.updateGuest);

// 桌子管理
const addTable = useSeatingStore((state) => state.addTable);
const addTableFromInput = useSeatingStore((state) => state.addTableFromInput);
const deleteTable = useSeatingStore((state) => state.deleteTable);
const updateTable = useSeatingStore((state) => state.updateTable);

// Modal 控制
const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
const setInputValue = useSeatingStore((state) => state.setInputValue);
const setModalInputView = useSeatingStore((state) => state.setModalInputView);

// 面板控制
const toggleLeftPanel = useSeatingStore((state) => state.toggleLeftPanel);
const toggleRightPanel = useSeatingStore((state) => state.toggleRightPanel);

// 对话框
const showConfirm = useSeatingStore((state) => state.showConfirm);
const setDeleteConfirm = useSeatingStore((state) => state.setDeleteConfirm);

// 规则管理
const addRule = useSeatingStore((state) => state.addRule);
const deleteRule = useSeatingStore((state) => state.deleteRule);

// 批量操作
const resetLayout = useSeatingStore((state) => state.resetLayout);
```

## Selectors (派生状态)

```typescript
// 获取所有宾客
const allGuests = useAllGuests();

// 获取筛选后的未分配宾客
const filteredGuests = useFilteredUnassignedGuests();

// 获取宾客名称映射
const guestNameMap = useGuestNameMap();

// 获取统计数据
const stats = useStats();
// stats = {
//   totalGuests, tableCount, avgGuestsPerTable,
//   confirmedCount, unconfirmedCount, cancelledCount, checkedInCount,
//   assignedGuestsCount, unassignedGuestsCount,
//   tableFillRate: [{ name, rate }]
// }
```

## 直接操作 Store

```typescript
// 获取当前状态(不订阅)
const currentState = useSeatingStore.getState();

// 直接更新状态
useSeatingStore.setState({ isLoading: true });

// 部分更新
useSeatingStore.setState((state) => ({
  tables: [...state.tables, newTable],
}));
```

## 使用模式

### 基本使用
```typescript
function MyComponent() {
  const tables = useSeatingStore((state) => state.tables);
  const addTable = useSeatingStore((state) => state.addTable);
  
  return (
    <div>
      <p>桌子数: {tables.length}</p>
      <button onClick={() => addTable('新桌子', 10)}>添加</button>
    </div>
  );
}
```

### 多个状态
```typescript
function MyComponent() {
  const { tables, isLoading } = useSeatingStore((state) => ({
    tables: state.tables,
    isLoading: state.isLoading,
  }));
  
  if (isLoading) return <div>加载中...</div>;
  return <div>{tables.length} 桌</div>;
}
```

### 使用 Selector
```typescript
function StatsDisplay() {
  const stats = useStats();
  
  return (
    <div>
      <p>总宾客: {stats.totalGuests}</p>
      <p>已签到: {stats.checkedInCount}</p>
    </div>
  );
}
```

### 条件渲染
```typescript
function GuestList() {
  const filteredGuests = useFilteredUnassignedGuests();
  
  return (
    <div>
      {filteredGuests.map((guest) => (
        <div key={guest.id}>{guest.name}</div>
      ))}
    </div>
  );
}
```

## 常见操作示例

### 添加宾客
```typescript
const addGuests = useSeatingStore((state) => state.addGuests);
const showNotification = useSeatingStore((state) => state.showNotification);

function handleAddGuests() {
  addGuests(['张三', '李四', '王五']);
  showNotification('已添加3位宾客');
}
```

### 删除桌子
```typescript
const deleteTable = useSeatingStore((state) => state.deleteTable);
const showConfirm = useSeatingStore((state) => state.showConfirm);

function handleDeleteTable(tableId: string, tableName: string) {
  showConfirm(
    '确认删除',
    `确定删除 "${tableName}" 吗?`,
    () => deleteTable(tableId),
    'danger'
  );
}
```

### 签到宾客
```typescript
const checkInGuest = useSeatingStore((state) => state.checkInGuest);

function handleCheckIn(guestId: string) {
  checkInGuest(guestId);
  // 自动更新宾客状态为 'checked-in', locked: true
}
```

### 打开 Modal
```typescript
const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
const setInputValue = useSeatingStore((state) => state.setInputValue);
const setModalInputView = useSeatingStore((state) => state.setModalInputView);

function handleOpenAddGuestModal() {
  setInputValue('');
  setModalInputView('manual');
  setIsModalOpen('addGuest');
}
```

### 重置布局
```typescript
const resetLayout = useSeatingStore((state) => state.resetLayout);
const showConfirm = useSeatingStore((state) => state.showConfirm);

function handleReset() {
  showConfirm(
    '确认重置',
    '这将清空所有桌子并将宾客移回未分配区域',
    () => resetLayout(),
    'danger'
  );
}
```

## 性能优化

### 使用浅比较
```typescript
import { shallow } from 'zustand/shallow';

const { tables, guests } = useSeatingStore(
  (state) => ({ 
    tables: state.tables, 
    guests: state.unassignedGuests 
  }),
  shallow
);
```

### 选择性订阅
```typescript
// ✅ 好 - 只在长度变化时重渲染
const guestCount = useSeatingStore(
  (state) => state.unassignedGuests.length
);

// ❌ 避免 - 在数组任何变化时都重渲染
const guests = useSeatingStore((state) => state.unassignedGuests);
```

### 分离 Actions
```typescript
// ✅ 好 - Actions 永远不会变化
const addTable = useSeatingStore((state) => state.addTable);

// 在 useEffect 中安全使用
useEffect(() => {
  // addTable 不需要在依赖数组中
}, []);
```

## 调试

### Redux DevTools
1. 安装 Redux DevTools 浏览器扩展
2. 打开开发者工具
3. 切换到 "Redux" 标签
4. 查看 "SeatingStore"

### 日志输出
```typescript
// 查看当前状态
console.log('Current State:', useSeatingStore.getState());

// 订阅所有变化
useSeatingStore.subscribe((state) => {
  console.log('State Changed:', state);
});
```

## TypeScript 类型

```typescript
import type { 
  Guest, 
  SeatingTable, 
  Project, 
  GuestStatus,
  NotTogetherRule 
} from '@/components/dashboard/types';

// Store 完全类型安全
const store = useSeatingStore.getState();
// TypeScript 会提示所有可用的 state 和 actions
```

---

**快速开始**: 复制你需要的代码片段即可开始使用!
