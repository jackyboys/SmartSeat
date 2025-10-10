# Custom Hooks 快速参考

## 📦 导入

```typescript
import { useNotifications, useProjectManager, useRealtimeCollaboration } from '@/hooks';
```

---

## 1. useNotifications

### 基本使用
```typescript
const { notification, showNotification, hideNotification } = useNotifications(3000);
```

### API
| 方法 | 参数 | 说明 |
|-----|------|------|
| `showNotification` | `(message, type?)` | 显示通知,type: 'success' \| 'error' \| 'info' |
| `hideNotification` | `()` | 立即隐藏通知 |

### 返回值
| 属性 | 类型 | 说明 |
|-----|------|------|
| `notification` | `Notification \| null` | 当前通知对象 |

### 示例
```typescript
showNotification('保存成功！', 'success');
showNotification('操作失败', 'error');
showNotification('提示信息', 'info');
```

---

## 2. useProjectManager

### 基本使用
```typescript
const {
  projects,
  currentProject,
  isSaving,
  hasUnsavedChanges,
  fetchProjectsAndLoadFirst,
  saveProject,
  loadProject,
  createProject,
  deleteProject,
  renameProject,
  markAsChanged,
} = useProjectManager({
  onNotification: showNotification,
  onConfirm: showConfirm
});
```

### 状态
| 属性 | 类型 | 说明 |
|-----|------|------|
| `projects` | `Project[]` | 项目列表 |
| `currentProject` | `Project \| null` | 当前项目 |
| `isSaving` | `boolean` | 是否正在保存 |
| `hasUnsavedChanges` | `boolean` | 是否有未保存更改 |

### 方法
| 方法 | 参数 | 说明 |
|-----|------|------|
| `fetchProjectsAndLoadFirst` | `(user, setTables, setUnassignedGuests, setIsLoading)` | 获取项目列表并加载第一个 |
| `saveProject` | `(user, tables, unassignedGuests)` | 保存当前项目 |
| `loadProject` | `(project, setTables, setUnassignedGuests, user, tables, unassignedGuests)` | 加载指定项目 |
| `createProject` | `(name, user, tables, unassignedGuests, setTables, setUnassignedGuests)` | 创建新项目 |
| `deleteProject` | `(projectId, setTables, setUnassignedGuests, user, tables, unassignedGuests)` | 删除项目 |
| `renameProject` | `(projectId, newName)` | 重命名项目 |
| `markAsChanged` | `()` | 标记有未保存更改 |

### 示例
```typescript
// 初始化
await fetchProjectsAndLoadFirst(user, setTables, setUnassignedGuests, setIsLoading);

// 保存
await saveProject(user, tables, unassignedGuests);

// 创建
createProject('新项目', user, tables, unassignedGuests, setTables, setUnassignedGuests);

// 加载
loadProject(project, setTables, setUnassignedGuests, user, tables, unassignedGuests);

// 删除
deleteProject(projectId, setTables, setUnassignedGuests, user, tables, unassignedGuests);

// 重命名
await renameProject(projectId, '新名称');

// 标记更改
markAsChanged();
```

---

## 3. useRealtimeCollaboration

### 基本使用
```typescript
const { 
  activeCollaborators, 
  broadcastLayoutChange,
  broadcastCheckIn
} = useRealtimeCollaboration({
  currentProject,
  user,
  onLayoutChange: (tables, guests, rules) => {
    setTables(tables);
    setUnassignedGuests(guests);
  },
  onCheckIn: (guestId, checkInTime) => {
    // 更新宾客签到状态
  },
  onNotification: showNotification,
  markAsChanged
});
```

### 返回值
| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| `activeCollaborators` | `string[]` | 在线协作者邮箱列表 |
| `broadcastLayoutChange` | `(tables, guests, rules?)` | 广播布局变更 |
| `broadcastCheckIn` | `(guestId, guestName, checkInTime)` | 广播签到事件 |

### 回调函数
| 回调 | 参数 | 何时调用 |
|-----|------|---------|
| `onLayoutChange` | `(tables, guests, rules)` | 收到其他协作者的布局变更 |
| `onCheckIn` | `(guestId, checkInTime)` | 收到签到事件 |
| `onNotification` | `(message, type)` | 需要显示通知时 |
| `markAsChanged` | `()` | 收到变更需要标记保存时 |

### 示例
```typescript
// 广播布局变更
const handleAddTable = () => {
  const updatedTables = [...tables, newTable];
  setTables(updatedTables);
  broadcastLayoutChange(updatedTables, unassignedGuests);
  markAsChanged();
};

// 广播签到
const handleCheckIn = (guestId, guestName) => {
  const checkInTime = new Date().toISOString();
  // 本地更新...
  broadcastCheckIn(guestId, guestName, checkInTime);
};

// 显示在线协作者
<div>在线: {activeCollaborators.length} 人</div>
```

---

## 🔄 组合使用

### 完整示例
```typescript
export default function DashboardPage() {
  // 1. 通知
  const { notification, showNotification, hideNotification } = useNotifications();
  
  // 2. 项目管理
  const {
    projects,
    currentProject,
    isSaving,
    hasUnsavedChanges,
    fetchProjectsAndLoadFirst,
    saveProject,
    markAsChanged,
  } = useProjectManager({
    onNotification: showNotification,
    onConfirm: showConfirm
  });
  
  // 3. 实时协作
  const { 
    activeCollaborators, 
    broadcastLayoutChange,
  } = useRealtimeCollaboration({
    currentProject,
    user,
    onLayoutChange: (tables, guests) => {
      setTables(tables);
      setUnassignedGuests(guests);
    },
    onCheckIn: (guestId, checkInTime) => {
      // 更新签到状态
    },
    onNotification: showNotification,
    markAsChanged
  });
  
  // 业务逻辑
  const handleAddTable = () => {
    const updatedTables = [...tables, newTable];
    setTables(updatedTables);
    broadcastLayoutChange(updatedTables, unassignedGuests);
    markAsChanged();
    showNotification('桌子已添加', 'success');
  };
  
  return (
    <div>
      <Notification notification={notification} onClose={hideNotification} />
      {/* 其他 UI */}
    </div>
  );
}
```

---

## ⚡ 常见模式

### 模式 1: 修改并广播
```typescript
const handleModify = () => {
  // 1. 修改本地状态
  setTables(updatedTables);
  
  // 2. 广播给协作者
  broadcastLayoutChange(updatedTables, unassignedGuests);
  
  // 3. 标记需要保存
  markAsChanged();
  
  // 4. 显示通知
  showNotification('修改成功', 'success');
};
```

### 模式 2: 保存前确认
```typescript
const handleDelete = () => {
  showConfirm(
    '确认删除',
    '此操作无法撤销',
    async () => {
      await deleteProject(projectId, ...);
      showNotification('删除成功', 'success');
    },
    'danger'
  );
};
```

### 模式 3: 自动保存
```typescript
useEffect(() => {
  if (!hasUnsavedChanges || !currentProject) return;
  
  const interval = setInterval(async () => {
    if (hasUnsavedChanges && !isSaving) {
      await saveProject(user, tables, unassignedGuests);
    }
  }, 30000);
  
  return () => clearInterval(interval);
}, [hasUnsavedChanges, currentProject, isSaving, saveProject]);
```

### 模式 4: 初始化加载
```typescript
useEffect(() => {
  const initialize = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      await fetchProjectsAndLoadFirst(user, setTables, setUnassignedGuests, setIsLoading);
    }
  };
  initialize();
}, [fetchProjectsAndLoadFirst]);
```

---

## 🎯 快速清单

使用 Hooks 时记得:

- ✅ 导入需要的 Hook
- ✅ 提供必需的回调函数
- ✅ 调用方法时传递正确参数
- ✅ 处理异步操作的错误
- ✅ 在修改数据后调用 `markAsChanged()`
- ✅ 在修改数据后调用 `broadcastLayoutChange()`
- ✅ 使用通知提示用户操作结果
- ✅ 清理 useEffect 中的订阅和定时器

---

## 📚 相关文档

- `TASK_3_CUSTOM_HOOKS_COMPLETE.md` - 完整任务报告
- `CUSTOM_HOOKS_USAGE_EXAMPLES.md` - 详细使用示例
- `src/hooks/useNotifications.ts` - 源代码和 JSDoc
- `src/hooks/useProjectManager.ts` - 源代码和 JSDoc
- `src/hooks/useRealtimeCollaboration.ts` - 源代码和 JSDoc
