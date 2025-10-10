# Dashboard Page 重构指南 - 使用 Zustand Store

## 目标
将 `dashboard/page.tsx` 从 3200+ 行的巨大组件简化为精简的容器组件,主要负责:
1. 数据加载 (从 Supabase)
2. 实时协作同步
3. 自动保存
4. 渲染子组件

## 重构步骤

### 第1步: 移除不需要的 State

在 `dashboard/page.tsx` 中,以下 state 已经移到 Zustand store:

#### ❌ 可以删除的 useState:
```typescript
// 这些已经在 store 中
const [tables, setTables] = useState<SeatingTable[]>([]);
const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
const [projects, setProjects] = useState<Project[]>([]);
const [currentProject, setCurrentProject] = useState<Project | null>(null);
const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [isAiLoading, setIsAiLoading] = useState(false);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [notification, setNotification] = useState<...>(null);
const [isModalOpen, setIsModalOpen] = useState<...>(null);
const [modalInputView, setModalInputView] = useState<...>('manual');
const [inputValue, setInputValue] = useState('');
const [inputCapacity, setInputCapacity] = useState('10');
const [aiGuestList, setAiGuestList] = useState('');
const [aiPlans, setAiPlans] = useState<any[]>([]);
const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
const [deleteConfirm, setDeleteConfirm] = useState<...>(null);
const [deleteUnassignedConfirm, setDeleteUnassignedConfirm] = useState<...>(null);
const [ruleGuests, setRuleGuests] = useState<...>({ g1: '', g2: '' });
const [sidebarOpen, setSidebarOpen] = useState(false);
const [rightPanelOpen, setRightPanelOpen] = useState(false);
const [leftPanelOpen, setLeftPanelOpen] = useState(false);
const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
const [editingProjectName, setEditingProjectName] = useState('');
const [confirmDialog, setConfirmDialog] = useState<...>(...);
const [activeCollaborators, setActiveCollaborators] = useState<string[]>([]);
const [inviteEmail, setInviteEmail] = useState('');
const [searchQuery, setSearchQuery] = useState('');
const [activeStatusFilter, setActiveStatusFilter] = useState<...>('all');
const [autoSeatTableCount, setAutoSeatTableCount] = useState('5');
const [autoSeatTableCapacity, setAutoSeatTableCapacity] = useState('10');
```

#### ✅ 保留的 useState:
```typescript
// 这些仍然需要,因为涉及到 Supabase 用户和路由
const [user, setUser] = useState<User | null>(null);
// 其他 Supabase 相关的本地状态
```

### 第2步: 替换为 Zustand Hooks

```typescript
'use client';
import { useSeatingStore, useStats } from '@/store/seatingStore';
import { UnassignedGuestsPanel } from '@/components/dashboard/UnassignedGuestsPanel';
import { TablesGrid } from '@/components/dashboard/TablesGrid';
import { ControlPanel } from '@/components/dashboard/ControlPanel';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  
  // ✅ 从 Zustand 获取状态
  const tables = useSeatingStore((state) => state.tables);
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  const currentProject = useSeatingStore((state) => state.currentProject);
  const hasUnsavedChanges = useSeatingStore((state) => state.hasUnsavedChanges);
  const isLoading = useSeatingStore((state) => state.isLoading);
  
  // ✅ 从 Zustand 获取 actions
  const setUser = useSeatingStore((state) => state.setUser);
  const setProjects = useSeatingStore((state) => state.setProjects);
  const setCurrentProject = useSeatingStore((state) => state.setCurrentProject);
  const setTables = useSeatingStore((state) => state.setTables);
  const setUnassignedGuests = useSeatingStore((state) => state.setUnassignedGuests);
  const setIsLoading = useSeatingStore((state) => state.setIsLoading);
  const showNotification = useSeatingStore((state) => state.showNotification);
  const markChanges = useSeatingStore((state) => state.markChanges);
  const clearChanges = useSeatingStore((state) => state.clearChanges);
  
  // 本地 state (仅用于 Supabase 用户)
  const [localUser, setLocalUser] = useState<User | null>(null);
  
  // ... 其他逻辑
}
```

### 第3步: 更新数据加载逻辑

```typescript
// 从 Supabase 加载项目
const fetchProjectsAndLoadFirst = useCallback(async (user: User) => {
  try {
    setIsLoading(true);
    
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('id', { ascending: false });
    
    if (error) {
      showNotification(`加载项目失败: ${error.message}`, 'error');
      return;
    }
    
    const projects = projectsData || [];
    setProjects(projects); // ✅ 使用 Zustand action
    
    if (projects.length > 0) {
      const firstProject = projects[0];
      setCurrentProject(firstProject); // ✅ 使用 Zustand action
      
      // 加载项目数据到 store
      if (firstProject.layout_data) {
        setTables(firstProject.layout_data.tables || []);
        setUnassignedGuests(firstProject.layout_data.unassignedGuests || []);
      }
    }
    
    setIsLoading(false);
  } catch (err: any) {
    showNotification(`发生错误: ${err.message}`, 'error');
    setIsLoading(false);
  }
}, [supabase, setIsLoading, showNotification, setProjects, setCurrentProject, setTables, setUnassignedGuests]);
```

### 第4步: 更新保存逻辑

```typescript
const handleSaveProject = useCallback(async () => {
  if (!currentProject) return;
  
  try {
    setIsSaving(true);
    
    const layoutData = {
      tables,
      unassignedGuests,
      rules: currentProject.layout_data?.rules || { notTogether: [] },
    };
    
    const { error } = await supabase
      .from('projects')
      .update({
        name: currentProject.name,
        layout_data: layoutData,
      })
      .eq('id', currentProject.id);
    
    if (error) {
      showNotification(`保存失败: ${error.message}`, 'error');
    } else {
      showNotification('项目已保存', 'success');
      clearChanges(); // ✅ 使用 Zustand action
    }
    
    setIsSaving(false);
  } catch (err: any) {
    showNotification(`保存时出错: ${err.message}`, 'error');
    setIsSaving(false);
  }
}, [currentProject, tables, unassignedGuests, supabase, showNotification, clearChanges]);
```

### 第5步: 简化 JSX

```typescript
return (
  <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
    {/* 左侧项目列表边栏 - 保持原样或也可以拆分 */}
    <ProjectSidebar />
    
    <div className="flex-1 flex overflow-hidden">
      <DndContext
        sensors={sensors}
        onDragStart={(event) => {
          const guestId = event.active.id as string;
          useSeatingStore.getState().handleDragStart(guestId);
        }}
        onDragEnd={(event) => {
          const overId = event.over?.id as string | null;
          const activeId = event.active.id as string;
          useSeatingStore.getState().handleDragEnd({ overId, activeId });
        }}
        collisionDetection={rectIntersection}
      >
        {/* ✨ 新组件 - 无需 props! */}
        <UnassignedGuestsPanel />
        <TablesGrid />
        <ControlPanel />
        
        {/* 拖拽覆盖层 */}
        <DragOverlay>
          {activeGuest && (
            <div className="p-3 bg-gray-700 rounded-lg opacity-90">
              {activeGuest.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
    
    {/* Modals - 这些也可以继续拆分 */}
    <Modals />
    
    {/* 通知 */}
    <Notifications />
  </div>
);
```

### 第6步: 移除不需要的函数

以下函数已经在 Zustand store 中实现,可以删除:

```typescript
// ❌ 可以删除
const handleAddGuests = () => { ... }
const handleAddTable = () => { ... }
const handleDeleteGuest = (guestId: string) => { ... }
const handleConfirmDeleteUnassigned = () => { ... }
const handleRemoveGuestFromTable = (guestId: string, tableId: string) => { ... }
const handleConfirmDelete = (action: 'move' | 'delete') => { ... }
const handleGuestStatusChange = (guestId: string, newStatus: GuestStatus) => { ... }
const showConfirm = (...) => { ... }
// ... 等等
```

只需要保留:
```typescript
// ✅ 保留这些 - Supabase 特定的逻辑
const fetchProjectsAndLoadFirst = async (user: User) => { ... }
const handleSaveProject = async () => { ... }
const fetchProjectMembers = async () => { ... }
const handleInviteCollaborator = async () => { ... }
// ... 等等
```

### 第7步: 实时协作同步

```typescript
useEffect(() => {
  if (!currentProject || !localUser) return;

  const channel = supabase
    .channel(`project-${currentProject.id}`)
    .on('broadcast', { event: 'layout-change' }, (payload: any) => {
      if (payload.payload.editorId !== localUser.id) {
        const { tables: newTables, unassignedGuests: newGuests, rules } = payload.payload;
        
        // ✅ 使用 Zustand actions 更新状态
        setTables(newTables || []);
        setUnassignedGuests(newGuests || []);
        
        if (rules && currentProject.layout_data) {
          setCurrentProject({
            ...currentProject,
            layout_data: {
              ...currentProject.layout_data,
              rules,
            },
          });
        }
        
        showNotification('👥 布局已由协作者更新', 'info');
      }
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, [currentProject, localUser]);
```

### 第8步: 广播布局变更

```typescript
// 在 Zustand store 中的 actions 里添加广播逻辑
// 或者在 dashboard/page.tsx 中监听 store 变化

useEffect(() => {
  if (!currentProject || !localUser) return;
  
  // 当 tables 或 unassignedGuests 改变时广播
  const channel = supabase.channel(`project-${currentProject.id}`);
  
  channel.send({
    type: 'broadcast',
    event: 'layout-change',
    payload: {
      tables,
      unassignedGuests,
      rules: currentProject.layout_data?.rules,
      editorId: localUser.id,
      timestamp: Date.now(),
    },
  });
  
  return () => {
    channel.unsubscribe();
  };
}, [tables, unassignedGuests, currentProject, localUser]);
```

## 重构后的结构

```typescript
// dashboard/page.tsx (预计 ~500-800 行)
export default function DashboardPage() {
  // 1. Supabase 客户端和传感器
  const supabase = createClient();
  const sensors = useSensors(...);
  const router = useRouter();
  
  // 2. 本地状态 (仅 Supabase 用户)
  const [localUser, setLocalUser] = useState<User | null>(null);
  
  // 3. Zustand store hooks (10-15 行)
  const tables = useSeatingStore((state) => state.tables);
  const currentProject = useSeatingStore((state) => state.currentProject);
  // ... 其他需要的状态
  
  // 4. Supabase 相关函数 (200-300 行)
  const fetchProjects = async () => { ... }
  const handleSaveProject = async () => { ... }
  const fetchProjectMembers = async () => { ... }
  // ... 其他 Supabase 操作
  
  // 5. Effects (100-200 行)
  useEffect(() => { /* 初始化 */ }, []);
  useEffect(() => { /* 自动保存 */ }, [hasUnsavedChanges]);
  useEffect(() => { /* 实时协作 */ }, [currentProject]);
  // ... 其他 effects
  
  // 6. JSX (100-200 行)
  return (
    <div>
      <DndContext>
        <UnassignedGuestsPanel />
        <TablesGrid />
        <ControlPanel />
      </DndContext>
      <Modals />
    </div>
  );
}
```

## 预期效果

### 代码量减少
| 部分 | 重构前 | 重构后 | 减少 |
|------|--------|--------|------|
| State 定义 | ~150行 | ~20行 | -87% |
| 业务逻辑函数 | ~800行 | 0行 | -100% |
| JSX Props 传递 | ~200行 | ~20行 | -90% |
| 总行数 | 3205行 | ~600行 | -81% |

### 职责清晰
- ✅ **dashboard/page.tsx**: 数据加载、保存、实时协作
- ✅ **seatingStore.ts**: 状态管理、业务逻辑
- ✅ **子组件**: UI 展示、用户交互

### 易于测试
```typescript
// 测试 Store
import { useSeatingStore } from '@/store/seatingStore';

test('应该添加宾客', () => {
  const { addGuests } = useSeatingStore.getState();
  addGuests(['张三', '李四']);
  
  const { unassignedGuests } = useSeatingStore.getState();
  expect(unassignedGuests).toHaveLength(2);
});

// 测试组件
import { render } from '@testing-library/react';
import { UnassignedGuestsPanel } from './UnassignedGuestsPanel';

test('应该渲染宾客列表', () => {
  useSeatingStore.setState({
    unassignedGuests: [{ id: '1', name: '张三' }],
  });
  
  const { getByText } = render(<UnassignedGuestsPanel />);
  expect(getByText('张三')).toBeInTheDocument();
});
```

## 检查清单

完成重构后,确保:

- [ ] 所有不必要的 useState 已移除
- [ ] 使用 Zustand hooks 替代 props
- [ ] 数据加载逻辑更新为使用 Zustand actions
- [ ] 保存逻辑更新为从 store 获取数据
- [ ] 实时协作同步正常工作
- [ ] 所有 UI 功能正常
- [ ] 拖拽功能正常
- [ ] Modals 正常打开/关闭
- [ ] 通知系统正常工作
- [ ] 无 TypeScript 错误
- [ ] 无 React 警告
- [ ] 代码提交到 Git

---

**下一步**: 开始重构 `dashboard/page.tsx` 主组件!
