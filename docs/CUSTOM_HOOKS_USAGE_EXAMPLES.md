# Custom Hooks 使用示例

本文档展示如何在 `DashboardPage` 组件中使用三个自定义 Hook。

---

## 📦 导入 Hooks

```typescript
import {
  useNotifications,
  useProjectManager,
  useRealtimeCollaboration,
  type Notification
} from '@/hooks';
```

---

## 1️⃣ useNotifications Hook

### 基础使用

```typescript
export default function DashboardPage() {
  // 使用默认配置(3秒自动隐藏)
  const { notification, showNotification, hideNotification } = useNotifications();
  
  // 或自定义持续时间(5秒)
  const { notification, showNotification, hideNotification } = useNotifications(5000);
  
  // 在组件中使用
  return (
    <div>
      <Notification 
        notification={notification} 
        onClose={hideNotification} 
      />
      
      <button onClick={() => showNotification('操作成功！', 'success')}>
        成功通知
      </button>
      
      <button onClick={() => showNotification('操作失败', 'error')}>
        错误通知
      </button>
      
      <button onClick={() => showNotification('提示信息', 'info')}>
        提示通知
      </button>
    </div>
  );
}
```

### 在业务逻辑中使用

```typescript
const handleAddGuest = async () => {
  try {
    await addGuestToDatabase(guestData);
    showNotification('宾客添加成功！', 'success');
  } catch (error) {
    showNotification(`添加失败: ${error.message}`, 'error');
  }
};

const handleImportFile = (file: File) => {
  if (!file.name.endsWith('.csv')) {
    showNotification('仅支持 CSV 文件', 'error');
    return;
  }
  
  showNotification('文件正在处理中...', 'info');
  // 处理文件...
};
```

---

## 2️⃣ useProjectManager Hook

### 完整设置

```typescript
export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [tables, setTables] = useState([]);
  const [unassignedGuests, setUnassignedGuests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { showNotification } = useNotifications();
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: undefined,
    type: 'warning'
  });
  
  const showConfirm = (title, message, onConfirm, type = 'warning', onCancel) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel,
      type
    });
  };
  
  // 使用项目管理 Hook
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
    setCurrentProject,
    markAsChanged,
    clearChanges,
  } = useProjectManager({
    onNotification: showNotification,
    onConfirm: showConfirm
  });
  
  // ... 其余逻辑
}
```

### 初始化 - 获取项目列表

```typescript
useEffect(() => {
  const initialize = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      // 调用 Hook 方法获取项目
      await fetchProjectsAndLoadFirst(
        user,
        setTables,
        setUnassignedGuests,
        setIsLoading
      );
    } else {
      router.push('/');
    }
  };
  
  initialize();
}, [fetchProjectsAndLoadFirst]);
```

### 保存项目

```typescript
// 手动保存
const handleSaveClick = async () => {
  await saveProject(user, tables, unassignedGuests);
};

// 自动保存
useEffect(() => {
  if (!hasUnsavedChanges || !currentProject) return;
  
  const interval = setInterval(async () => {
    if (hasUnsavedChanges && currentProject && !isSaving) {
      console.log('🕒 自动保存中...');
      await saveProject(user, tables, unassignedGuests);
    }
  }, 30000); // 每 30 秒
  
  return () => clearInterval(interval);
}, [hasUnsavedChanges, currentProject, isSaving, saveProject, user, tables, unassignedGuests]);

// 离开页面前保存
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '您有未保存的更改，确定要离开吗？';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);
```

### 创建新项目

```typescript
const [inputValue, setInputValue] = useState('');
const [isModalOpen, setIsModalOpen] = useState(null);

const handleNewProject = () => {
  createProject(
    inputValue, // 项目名称
    user,
    tables,
    unassignedGuests,
    setTables,
    setUnassignedGuests
  );
  
  // 关闭 Modal 并清空输入
  setIsModalOpen(null);
  setInputValue('');
};

// UI
<Modal isOpen={isModalOpen === 'newProject'} onClose={() => setIsModalOpen(null)}>
  <input
    value={inputValue}
    onChange={(e) => setInputValue(e.target.value)}
    placeholder="项目名称"
  />
  <button onClick={handleNewProject}>创建</button>
</Modal>
```

### 加载项目

```typescript
const handleLoadProject = (project: Project) => {
  loadProject(
    project,
    setTables,
    setUnassignedGuests,
    user,
    tables,
    unassignedGuests
  );
};

// UI - 项目列表
{projects.map(project => (
  <div key={project.id} onClick={() => handleLoadProject(project)}>
    {project.name}
    {currentProject?.id === project.id && ' (当前)'}
  </div>
))}
```

### 删除项目

```typescript
const handleDeleteProject = (projectId: number) => {
  deleteProject(
    projectId,
    setTables,
    setUnassignedGuests,
    user,
    tables,
    unassignedGuests
  );
};

// UI
<button onClick={() => handleDeleteProject(project.id)}>
  删除
</button>
```

### 重命名项目

```typescript
const [editingProjectId, setEditingProjectId] = useState(null);
const [editingProjectName, setEditingProjectName] = useState('');

const handleEditProjectName = (projectId: number, currentName: string) => {
  setEditingProjectId(projectId);
  setEditingProjectName(currentName);
};

const handleSaveProjectName = async (projectId: number) => {
  const success = await renameProject(projectId, editingProjectName);
  
  if (success) {
    setEditingProjectId(null);
  }
};

// UI
{editingProjectId === project.id ? (
  <input
    value={editingProjectName}
    onChange={(e) => setEditingProjectName(e.target.value)}
    onBlur={() => handleSaveProjectName(project.id)}
    onKeyPress={(e) => e.key === 'Enter' && handleSaveProjectName(project.id)}
  />
) : (
  <span onClick={() => handleEditProjectName(project.id, project.name)}>
    {project.name}
  </span>
)}
```

### 标记更改

```typescript
// 当用户修改数据时,标记为有未保存更改
const handleAddTable = () => {
  const newTable = {
    id: uuidv4(),
    tableName: inputValue,
    guests: [],
    capacity: 10
  };
  
  setTables([...tables, newTable]);
  markAsChanged(); // 标记更改
};

const handleDeleteGuest = (guestId: string) => {
  setUnassignedGuests(unassignedGuests.filter(g => g.id !== guestId));
  markAsChanged(); // 标记更改
};
```

---

## 3️⃣ useRealtimeCollaboration Hook

### 完整设置

```typescript
export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [tables, setTables] = useState([]);
  const [unassignedGuests, setUnassignedGuests] = useState([]);
  
  const { showNotification } = useNotifications();
  const { currentProject, markAsChanged } = useProjectManager({...});
  
  // 使用实时协作 Hook
  const { 
    activeCollaborators, 
    broadcastLayoutChange,
    broadcastCheckIn
  } = useRealtimeCollaboration({
    currentProject,
    user,
    
    // 当收到布局变更时
    onLayoutChange: (newTables, newGuests, rules) => {
      setTables(newTables);
      setUnassignedGuests(newGuests);
      
      // 更新规则
      if (rules && currentProject?.layout_data) {
        setCurrentProject({
          ...currentProject,
          layout_data: {
            ...currentProject.layout_data,
            rules
          }
        });
      }
    },
    
    // 当收到签到事件时
    onCheckIn: (guestId, checkInTime) => {
      const updateGuest = (guest: Guest) => {
        if (guest.id === guestId) {
          return { 
            ...guest, 
            status: 'checked-in', 
            locked: true, 
            checkInTime 
          };
        }
        return guest;
      };
      
      // 更新桌子上的宾客
      setTables(currentTables => currentTables.map(table => ({
        ...table,
        guests: table.guests.map(updateGuest)
      })));
      
      // 更新未分配的宾客
      setUnassignedGuests(currentGuests => currentGuests.map(updateGuest));
      
      // 标记需要保存
      markAsChanged();
    },
    
    onNotification: showNotification,
    markAsChanged
  });
  
  // ... 其余逻辑
}
```

### 广播布局变更

```typescript
// 当用户修改布局时,广播给其他协作者
const handleAddTable = () => {
  const newTable = {
    id: uuidv4(),
    tableName: inputValue,
    guests: [],
    capacity: 10
  };
  
  const updatedTables = [...tables, newTable];
  setTables(updatedTables);
  
  // 广播变更
  broadcastLayoutChange(updatedTables, unassignedGuests);
  
  markAsChanged();
};

const handleMoveGuest = (guestId: string, fromTableId: string, toTableId: string) => {
  // ... 移动宾客逻辑
  
  // 广播变更
  broadcastLayoutChange(updatedTables, updatedGuests);
  
  markAsChanged();
};

const handleDeleteTable = (tableId: string) => {
  const updatedTables = tables.filter(t => t.id !== tableId);
  setTables(updatedTables);
  
  // 广播变更
  broadcastLayoutChange(updatedTables, unassignedGuests);
  
  markAsChanged();
};
```

### 广播签到事件

```typescript
const handleCheckIn = (guestId: string) => {
  const guest = findGuestById(guestId); // 辅助函数
  const checkInTime = new Date().toISOString();
  
  // 本地更新
  const updateGuest = (g: Guest) => {
    if (g.id === guestId) {
      return { ...g, status: 'checked-in', locked: true, checkInTime };
    }
    return g;
  };
  
  setTables(tables.map(table => ({
    ...table,
    guests: table.guests.map(updateGuest)
  })));
  
  setUnassignedGuests(unassignedGuests.map(updateGuest));
  
  // 广播签到事件
  broadcastCheckIn(guestId, guest.name, checkInTime);
  
  showNotification(`${guest.name} 已签到`, 'success');
  markAsChanged();
};

// UI - 签到按钮
<button 
  onClick={() => handleCheckIn(guest.id)}
  disabled={guest.status === 'checked-in'}
>
  {guest.status === 'checked-in' ? '已签到' : '签到'}
</button>
```

### 显示在线协作者

```typescript
// UI - 协作者列表
<div className="collaborators">
  <h3>在线协作者 ({activeCollaborators.length})</h3>
  {activeCollaborators.length > 0 ? (
    <ul>
      {activeCollaborators.map((email, index) => (
        <li key={index}>
          <span className="online-indicator">●</span>
          {email}
        </li>
      ))}
    </ul>
  ) : (
    <p>暂无其他协作者在线</p>
  )}
</div>
```

---

## 🔄 完整示例: DashboardPage 重构

这里展示如何将所有三个 Hook 结合使用:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useProjectManager,
  useRealtimeCollaboration
} from '@/hooks';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  
  // 基础状态
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [unassignedGuests, setUnassignedGuests] = useState([]);
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });
  
  const showConfirm = useCallback((title, message, onConfirm, type = 'warning', onCancel) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel,
      type
    });
  }, []);
  
  // ===== Hook 1: 通知管理 =====
  const { notification, showNotification, hideNotification } = useNotifications();
  
  // ===== Hook 2: 项目管理 =====
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
    setCurrentProject,
    markAsChanged,
  } = useProjectManager({
    onNotification: showNotification,
    onConfirm: showConfirm
  });
  
  // ===== Hook 3: 实时协作 =====
  const { 
    activeCollaborators, 
    broadcastLayoutChange,
    broadcastCheckIn
  } = useRealtimeCollaboration({
    currentProject,
    user,
    onLayoutChange: (newTables, newGuests, rules) => {
      setTables(newTables);
      setUnassignedGuests(newGuests);
      if (rules && currentProject?.layout_data) {
        setCurrentProject({
          ...currentProject,
          layout_data: {
            ...currentProject.layout_data,
            rules
          }
        });
      }
    },
    onCheckIn: (guestId, checkInTime) => {
      const updateGuest = (guest) => {
        if (guest.id === guestId) {
          return { ...guest, status: 'checked-in', locked: true, checkInTime };
        }
        return guest;
      };
      
      setTables(currentTables => currentTables.map(table => ({
        ...table,
        guests: table.guests.map(updateGuest)
      })));
      setUnassignedGuests(currentGuests => currentGuests.map(updateGuest));
      markAsChanged();
    },
    onNotification: showNotification,
    markAsChanged
  });
  
  // ===== 初始化逻辑 =====
  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        await fetchProjectsAndLoadFirst(user, setTables, setUnassignedGuests, setIsLoading);
      } else {
        router.push('/');
      }
    };
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          router.push('/');
        } else if (event === 'SIGNED_IN' && session?.user && !hasUnsavedChanges) {
          setUser(session.user);
          fetchProjectsAndLoadFirst(session.user, setTables, setUnassignedGuests, setIsLoading);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, fetchProjectsAndLoadFirst, hasUnsavedChanges, supabase.auth]);
  
  // ===== 自动保存 =====
  useEffect(() => {
    if (!hasUnsavedChanges || !currentProject) return;
    
    const interval = setInterval(async () => {
      if (hasUnsavedChanges && currentProject && !isSaving) {
        console.log('🕒 自动保存中...');
        await saveProject(user, tables, unassignedGuests);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [hasUnsavedChanges, currentProject, isSaving, saveProject, user, tables, unassignedGuests]);
  
  // ===== 防止意外离开 =====
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  // ===== 业务逻辑 =====
  const handleAddTable = () => {
    const newTable = {
      id: uuidv4(),
      tableName: inputValue,
      guests: [],
      capacity: 10
    };
    
    const updatedTables = [...tables, newTable];
    setTables(updatedTables);
    broadcastLayoutChange(updatedTables, unassignedGuests);
    markAsChanged();
  };
  
  const handleCheckIn = (guestId: string, guestName: string) => {
    const checkInTime = new Date().toISOString();
    
    const updateGuest = (g) => {
      if (g.id === guestId) {
        return { ...g, status: 'checked-in', locked: true, checkInTime };
      }
      return g;
    };
    
    setTables(tables.map(table => ({
      ...table,
      guests: table.guests.map(updateGuest)
    })));
    setUnassignedGuests(unassignedGuests.map(updateGuest));
    
    broadcastCheckIn(guestId, guestName, checkInTime);
    showNotification(`${guestName} 已签到`, 'success');
    markAsChanged();
  };
  
  // ===== 渲染 =====
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <div className="dashboard">
      <Notification notification={notification} onClose={hideNotification} />
      <ConfirmDialog {...confirmDialog} />
      
      {/* 项目列表 */}
      <ProjectList 
        projects={projects}
        currentProject={currentProject}
        onLoadProject={(p) => loadProject(p, setTables, setUnassignedGuests, user, tables, unassignedGuests)}
        onDeleteProject={(id) => deleteProject(id, setTables, setUnassignedGuests, user, tables, unassignedGuests)}
        onRenameProject={renameProject}
      />
      
      {/* 在线协作者 */}
      <CollaboratorsList collaborators={activeCollaborators} />
      
      {/* 其余 UI */}
    </div>
  );
}
```

---

## 🎯 最佳实践

### 1. 依赖管理

确保 Hook 的依赖数组正确:

```typescript
// ✅ 正确
useEffect(() => {
  fetchData();
}, [fetchData]); // 包含所有使用的外部变量

// ❌ 错误
useEffect(() => {
  fetchData();
}, []); // 缺少依赖可能导致使用过期的闭包
```

### 2. 错误处理

总是处理 Hook 可能的错误:

```typescript
const handleSave = async () => {
  try {
    await saveProject(user, tables, unassignedGuests);
  } catch (error) {
    console.error('保存失败:', error);
    showNotification('保存失败,请重试', 'error');
  }
};
```

### 3. 类型安全

利用 TypeScript 类型:

```typescript
import type { Project } from '@/hooks';

const myProject: Project = {
  id: 1,
  name: '测试项目',
  layout_data: {
    tables: [],
    unassignedGuests: []
  }
};
```

### 4. 性能优化

使用 `useCallback` 稳定函数引用:

```typescript
const handleLayoutChange = useCallback((newTables, newGuests, rules) => {
  setTables(newTables);
  setUnassignedGuests(newGuests);
  // ...
}, []); // 没有外部依赖

// 传递给 Hook
const { ... } = useRealtimeCollaboration({
  onLayoutChange: handleLayoutChange, // 稳定的引用
  // ...
});
```

---

## 📚 更多资源

- [React Hooks 官方文档](https://react.dev/reference/react)
- [自定义 Hooks 最佳实践](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Supabase Realtime 文档](https://supabase.com/docs/guides/realtime)
