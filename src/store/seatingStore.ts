import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type { User } from '@supabase/supabase-js';
import type { Guest, SeatingTable, Project, ProjectMember, GuestStatus, NotTogetherRule } from '@/components/dashboard/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// 类型定义
// ============================================================

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmDialog {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  type?: 'warning' | 'danger' | 'info';
}

type ModalType = 'newProject' | 'addGuest' | 'addTable' | 'aiSeating' | 'addRule' | 'checkIn' | 'inviteCollaborator' | null;

// ============================================================
// Store 接口
// ============================================================

interface SeatingStore {
  // ==================== 核心数据状态 ====================
  user: User | null;
  projects: Project[];
  currentProject: Project | null;
  tables: SeatingTable[];
  unassignedGuests: Guest[];
  projectMembers: ProjectMember[];
  
  // ==================== UI 状态 ====================
  activeGuest: Guest | null;
  isLoading: boolean;
  isSaving: boolean;
  isAiLoading: boolean;
  hasUnsavedChanges: boolean;
  notification: Notification | null;
  
  // ==================== Modal 状态 ====================
  isModalOpen: ModalType;
  modalInputView: 'manual' | 'import';
  inputValue: string;
  inputCapacity: string;
  
  // ==================== AI 排座状态 ====================
  aiGuestList: string;
  aiPlans: any[];
  selectedPlanId: string | null;
  autoSeatTableCount: string;
  autoSeatTableCapacity: string;
  
  // ==================== 确认对话框状态 ====================
  deleteConfirm: { guestId: string; tableId: string; guestName: string } | null;
  deleteUnassignedConfirm: { guestId: string; guestName: string } | null;
  confirmDialog: ConfirmDialog;
  
  // ==================== 规则状态 ====================
  ruleGuests: { g1: string; g2: string };
  
  // ==================== 面板状态 ====================
  sidebarOpen: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  
  // ==================== 项目编辑状态 ====================
  editingProjectId: number | null;
  editingProjectName: string;
  
  // ==================== 协作状态 ====================
  activeCollaborators: string[];
  inviteEmail: string;
  
  // ==================== 搜索和筛选状态 ====================
  searchQuery: string;
  activeStatusFilter: GuestStatus | 'all';
  
  // ==================== Actions: 基础设置 ====================
  setUser: (user: User | null) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setTables: (tables: SeatingTable[]) => void;
  setUnassignedGuests: (guests: Guest[]) => void;
  setProjectMembers: (members: ProjectMember[]) => void;
  
  // ==================== Actions: UI 控制 ====================
  setActiveGuest: (guest: Guest | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setIsAiLoading: (loading: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
  
  // ==================== Actions: Modal 控制 ====================
  setIsModalOpen: (modal: ModalType) => void;
  setModalInputView: (view: 'manual' | 'import') => void;
  setInputValue: (value: string) => void;
  setInputCapacity: (value: string) => void;
  
  // ==================== Actions: 面板控制 ====================
  setSidebarOpen: (open: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  
  // ==================== Actions: 搜索和筛选 ====================
  setSearchQuery: (query: string) => void;
  setActiveStatusFilter: (filter: GuestStatus | 'all') => void;
  
  // ==================== Actions: 确认对话框 ====================
  showConfirm: (title: string, message: string, onConfirm: () => void, type?: 'warning' | 'danger' | 'info', onCancel?: () => void) => void;
  hideConfirm: () => void;
  setDeleteConfirm: (confirm: { guestId: string; tableId: string; guestName: string } | null) => void;
  setDeleteUnassignedConfirm: (confirm: { guestId: string; guestName: string } | null) => void;
  
  // ==================== Actions: 宾客管理 ====================
  addGuests: (names: string[]) => void;
  addGuestsFromInput: () => void;
  deleteUnassignedGuest: (guestId: string) => void;
  confirmDeleteUnassigned: () => void;
  moveGuestToUnassigned: (guestId: string, tableId: string) => void;
  deleteGuestCompletely: (guestId: string, tableId: string) => void;
  updateGuestStatus: (guestId: string, newStatus: GuestStatus) => void;
  updateGuest: (guestId: string, updates: Partial<Guest>) => void;
  checkInGuest: (guestId: string) => void;
  
  // ==================== Actions: 桌子管理 ====================
  addTable: (tableName: string, capacity: number) => void;
  addTableFromInput: () => void;
  deleteTable: (tableId: string) => void;
  updateTable: (tableId: string, updates: Partial<SeatingTable>) => void;
  moveGuestBetweenTables: (guestId: string, fromTableId: string, toTableId: string, toIndex?: number) => void;
  
  // ==================== Actions: 拖拽操作 ====================
  handleDragStart: (guestId: string) => void;
  handleDragEnd: (result: { overId: string | null; activeId: string }) => void;
  
  // ==================== Actions: 规则管理 ====================
  setRuleGuests: (guests: { g1: string; g2: string }) => void;
  addRule: (guest1Id: string, guest2Id: string) => void;
  deleteRule: (rule: NotTogetherRule) => void;
  
  // ==================== Actions: AI 排座 ====================
  setAiGuestList: (list: string) => void;
  setAiPlans: (plans: any[]) => void;
  setSelectedPlanId: (id: string | null) => void;
  setAutoSeatTableCount: (count: string) => void;
  setAutoSeatTableCapacity: (capacity: string) => void;
  applyAiPlan: (planId: string) => void;
  
  // ==================== Actions: 项目管理 ====================
  setEditingProjectId: (id: number | null) => void;
  setEditingProjectName: (name: string) => void;
  updateCurrentProjectName: (name: string) => void;
  updateProjectRules: (rules: NotTogetherRule[]) => void;
  
  // ==================== Actions: 协作管理 ====================
  setActiveCollaborators: (collaborators: string[]) => void;
  setInviteEmail: (email: string) => void;
  
  // ==================== Actions: 重置和批量操作 ====================
  resetLayout: () => void;
  markChanges: () => void;
  clearChanges: () => void;
  reset: () => void;
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  // 核心数据
  user: null,
  projects: [],
  currentProject: null,
  tables: [],
  unassignedGuests: [],
  projectMembers: [],
  
  // UI 状态
  activeGuest: null,
  isLoading: true,
  isSaving: false,
  isAiLoading: false,
  hasUnsavedChanges: false,
  notification: null,
  
  // Modal 状态
  isModalOpen: null as ModalType,
  modalInputView: 'manual' as const,
  inputValue: '',
  inputCapacity: '10',
  
  // AI 状态
  aiGuestList: '',
  aiPlans: [],
  selectedPlanId: null,
  autoSeatTableCount: '5',
  autoSeatTableCapacity: '10',
  
  // 确认对话框
  deleteConfirm: null,
  deleteUnassignedConfirm: null,
  confirmDialog: {
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  },
  
  // 规则
  ruleGuests: { g1: '', g2: '' },
  
  // 面板
  sidebarOpen: false,
  leftPanelOpen: false,
  rightPanelOpen: false,
  
  // 项目编辑
  editingProjectId: null,
  editingProjectName: '',
  
  // 协作
  activeCollaborators: [],
  inviteEmail: '',
  
  // 搜索筛选
  searchQuery: '',
  activeStatusFilter: 'all' as const,
};

// ============================================================
// Zustand Store
// ============================================================

export const useSeatingStore = create<SeatingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ==================== 基础设置 Actions ====================
      setUser: (user) => set({ user }),
      setProjects: (projects) => set({ projects }),
      setCurrentProject: (project) => set({ currentProject: project }),
      setTables: (tables) => set({ tables }),
      setUnassignedGuests: (guests) => set({ unassignedGuests: guests }),
      setProjectMembers: (members) => set({ projectMembers: members }),

      // ==================== UI 控制 Actions ====================
      setActiveGuest: (guest) => set({ activeGuest: guest }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setIsSaving: (saving) => set({ isSaving: saving }),
      setIsAiLoading: (loading) => set({ isAiLoading: loading }),
      setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
      
      showNotification: (message, type = 'success') => {
        set({ notification: { message, type } });
        setTimeout(() => set({ notification: null }), 3000);
      },
      
      clearNotification: () => set({ notification: null }),

      // ==================== Modal 控制 Actions ====================
      setIsModalOpen: (modal) => set({ isModalOpen: modal }),
      setModalInputView: (view) => set({ modalInputView: view }),
      setInputValue: (value) => set({ inputValue: value }),
      setInputCapacity: (value) => set({ inputCapacity: value }),

      // ==================== 面板控制 Actions ====================
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

      // ==================== 搜索筛选 Actions ====================
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveStatusFilter: (filter) => set({ activeStatusFilter: filter }),

      // ==================== 确认对话框 Actions ====================
      showConfirm: (title, message, onConfirm, type = 'warning', onCancel) => {
        set({
          confirmDialog: {
            isOpen: true,
            title,
            message,
            onConfirm: () => {
              onConfirm();
              set({
                confirmDialog: {
                  isOpen: false,
                  title: '',
                  message: '',
                  onConfirm: () => {},
                },
              });
            },
            onCancel,
            type,
          },
        });
      },

      hideConfirm: () => {
        set({
          confirmDialog: {
            isOpen: false,
            title: '',
            message: '',
            onConfirm: () => {},
          },
        });
      },

      setDeleteConfirm: (confirm) => set({ deleteConfirm: confirm }),
      setDeleteUnassignedConfirm: (confirm) => set({ deleteUnassignedConfirm: confirm }),

      // ==================== 宾客管理 Actions ====================
      addGuests: (names) => {
        const newGuests: Guest[] = names.map((name) => ({
          id: uuidv4(),
          name,
          status: 'unconfirmed',
        }));
        
        set((state) => ({
          unassignedGuests: [...state.unassignedGuests, ...newGuests],
          hasUnsavedChanges: true,
        }));
      },

      addGuestsFromInput: () => {
        const { inputValue, showNotification } = get();
        const names = inputValue
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean);
        
        if (names.length === 0) {
          showNotification('请输入宾客姓名', 'error');
          return;
        }
        
        get().addGuests(names);
        set({
          isModalOpen: null,
          inputValue: '',
        });
        showNotification(`成功添加 ${names.length} 位宾客`);
      },

      deleteUnassignedGuest: (guestId) => {
        const guest = get().unassignedGuests.find((g) => g.id === guestId);
        if (!guest) return;
        
        set({ deleteUnassignedConfirm: { guestId, guestName: guest.name } });
      },

      confirmDeleteUnassigned: () => {
        const { deleteUnassignedConfirm, unassignedGuests, tables } = get();
        if (!deleteUnassignedConfirm) return;
        
        const { guestId } = deleteUnassignedConfirm;
        const updatedGuests = unassignedGuests.filter((g) => g.id !== guestId);
        const updatedTables = tables.map((t) => ({
          ...t,
          guests: t.guests.filter((g) => g.id !== guestId),
        }));
        
        set({
          unassignedGuests: updatedGuests,
          tables: updatedTables,
          deleteUnassignedConfirm: null,
          hasUnsavedChanges: true,
        });
        
        get().showNotification('宾客已删除');
      },

      moveGuestToUnassigned: (guestId, tableId) => {
        const { tables, unassignedGuests } = get();
        const guest = tables.find((t) => t.id === tableId)?.guests.find((g) => g.id === guestId);
        if (!guest) return;
        
        const updatedTables = tables.map((t) =>
          t.id === tableId
            ? { ...t, guests: t.guests.filter((g) => g.id !== guestId) }
            : t
        );
        
        set({
          tables: updatedTables,
          unassignedGuests: [...unassignedGuests, guest],
          deleteConfirm: null,
          hasUnsavedChanges: true,
        });
        
        get().showNotification('宾客已移动到未分配区');
      },

      deleteGuestCompletely: (guestId, tableId) => {
        const { tables, unassignedGuests } = get();
        const updatedTables = tables.map((t) => ({
          ...t,
          guests: t.guests.filter((g) => g.id !== guestId),
        }));
        
        set({
          tables: updatedTables,
          deleteConfirm: null,
          hasUnsavedChanges: true,
        });
        
        get().showNotification('宾客已彻底删除');
      },

      updateGuestStatus: (guestId, newStatus) => {
        const { unassignedGuests, tables } = get();
        
        const updateGuest = (guests: Guest[]) =>
          guests.map((g) => (g.id === guestId ? { ...g, status: newStatus } : g));
        
        set({
          unassignedGuests: updateGuest(unassignedGuests),
          tables: tables.map((t) => ({
            ...t,
            guests: updateGuest(t.guests),
          })),
          hasUnsavedChanges: true,
        });
      },

      updateGuest: (guestId, updates) => {
        const { unassignedGuests, tables } = get();
        
        const updateGuestData = (guests: Guest[]) =>
          guests.map((g) => (g.id === guestId ? { ...g, ...updates } : g));
        
        set({
          unassignedGuests: updateGuestData(unassignedGuests),
          tables: tables.map((t) => ({
            ...t,
            guests: updateGuestData(t.guests),
          })),
          hasUnsavedChanges: true,
        });
      },

      checkInGuest: (guestId) => {
        const now = new Date().toISOString();
        get().updateGuest(guestId, {
          status: 'checked-in',
          locked: true,
          checkInTime: now,
        });
        get().showNotification('签到成功', 'success');
      },

      // ==================== 桌子管理 Actions ====================
      addTable: (tableName, capacity) => {
        const newTable: SeatingTable = {
          id: uuidv4(),
          tableName,
          guests: [],
          capacity,
        };
        
        set((state) => ({
          tables: [...state.tables, newTable],
          hasUnsavedChanges: true,
        }));
        
        get().showNotification(`桌子 "${tableName}" 已添加`);
      },

      addTableFromInput: () => {
        const { inputValue, inputCapacity, showNotification } = get();
        
        if (!inputValue.trim()) {
          showNotification('桌子名称不能为空', 'error');
          return;
        }
        
        const capacity = parseInt(inputCapacity);
        if (isNaN(capacity) || capacity < 1) {
          showNotification('容量必须是大于0的数字', 'error');
          return;
        }
        
        get().addTable(inputValue, capacity);
        
        set({
          isModalOpen: null,
          inputValue: '',
          inputCapacity: '10',
        });
      },

      deleteTable: (tableId) => {
        const { tables, unassignedGuests } = get();
        const table = tables.find((t) => t.id === tableId);
        if (!table) return;
        
        // 将桌子上的宾客移回未分配区
        const updatedGuests = [...unassignedGuests, ...table.guests];
        const updatedTables = tables.filter((t) => t.id !== tableId);
        
        set({
          tables: updatedTables,
          unassignedGuests: updatedGuests,
          hasUnsavedChanges: true,
        });
        
        get().showNotification(`桌子 "${table.tableName}" 已删除`);
      },

      updateTable: (tableId, updates) => {
        set((state) => ({
          tables: state.tables.map((t) =>
            t.id === tableId ? { ...t, ...updates } : t
          ),
          hasUnsavedChanges: true,
        }));
      },

      moveGuestBetweenTables: (guestId, fromTableId, toTableId, toIndex) => {
        const { tables } = get();
        const fromTable = tables.find((t) => t.id === fromTableId);
        const toTable = tables.find((t) => t.id === toTableId);
        
        if (!fromTable || !toTable) return;
        
        const guest = fromTable.guests.find((g) => g.id === guestId);
        if (!guest) return;
        
        const updatedTables = tables.map((t) => {
          if (t.id === fromTableId) {
            return { ...t, guests: t.guests.filter((g) => g.id !== guestId) };
          }
          if (t.id === toTableId) {
            const newGuests = [...t.guests];
            if (toIndex !== undefined) {
              newGuests.splice(toIndex, 0, guest);
            } else {
              newGuests.push(guest);
            }
            return { ...t, guests: newGuests };
          }
          return t;
        });
        
        set({ tables: updatedTables, hasUnsavedChanges: true });
      },

      // ==================== 拖拽操作 Actions ====================
      handleDragStart: (guestId) => {
        const { unassignedGuests, tables } = get();
        const guest =
          unassignedGuests.find((g) => g.id === guestId) ||
          tables.flatMap((t) => t.guests).find((g) => g.id === guestId);
        
        if (guest) {
          set({ activeGuest: guest });
        }
      },

      handleDragEnd: ({ overId, activeId }) => {
        // 这个函数的实现比较复杂,需要在实际使用时根据具体需求实现
        // 这里提供基本框架
        set({ activeGuest: null });
        
        // TODO: 实现完整的拖拽逻辑
        // 需要处理:
        // 1. 从未分配区拖到桌子
        // 2. 从桌子拖到未分配区
        // 3. 桌子之间拖拽
        // 4. 同一容器内排序
        // 5. 锁定宾客的特殊处理
      },

      // ==================== 规则管理 Actions ====================
      setRuleGuests: (guests) => set({ ruleGuests: guests }),

      addRule: (guest1Id, guest2Id) => {
        const { currentProject } = get();
        if (!currentProject || !currentProject.layout_data) return;
        
        const existingRules = currentProject.layout_data.rules?.notTogether || [];
        const newRule: NotTogetherRule = [guest1Id, guest2Id];
        
        set({
          currentProject: {
            ...currentProject,
            layout_data: {
              ...currentProject.layout_data,
              rules: {
                notTogether: [...existingRules, newRule],
              },
            },
          },
          hasUnsavedChanges: true,
        });
        
        get().showNotification('规则已添加');
      },

      deleteRule: (rule) => {
        const { currentProject } = get();
        if (!currentProject || !currentProject.layout_data) return;
        
        const updatedRules = (currentProject.layout_data.rules?.notTogether || []).filter(
          (r) => !(r[0] === rule[0] && r[1] === rule[1])
        );
        
        set({
          currentProject: {
            ...currentProject,
            layout_data: {
              ...currentProject.layout_data,
              rules: { notTogether: updatedRules },
            },
          },
          hasUnsavedChanges: true,
        });
        
        get().showNotification('规则已删除');
      },

      // ==================== AI 排座 Actions ====================
      setAiGuestList: (list) => set({ aiGuestList: list }),
      setAiPlans: (plans) => set({ aiPlans: plans }),
      setSelectedPlanId: (id) => set({ selectedPlanId: id }),
      setAutoSeatTableCount: (count) => set({ autoSeatTableCount: count }),
      setAutoSeatTableCapacity: (capacity) => set({ autoSeatTableCapacity: capacity }),

      applyAiPlan: (planId) => {
        const { aiPlans } = get();
        const plan = aiPlans.find((p) => p.id === planId);
        if (!plan) return;
        
        // TODO: 实现 AI 计划应用逻辑
        set({
          isModalOpen: null,
          selectedPlanId: null,
          hasUnsavedChanges: true,
        });
        
        get().showNotification('AI 排座方案已应用');
      },

      // ==================== 项目管理 Actions ====================
      setEditingProjectId: (id) => set({ editingProjectId: id }),
      setEditingProjectName: (name) => set({ editingProjectName: name }),

      updateCurrentProjectName: (name) => {
        const { currentProject } = get();
        if (!currentProject) return;
        
        set({
          currentProject: { ...currentProject, name },
          hasUnsavedChanges: true,
        });
      },

      updateProjectRules: (rules) => {
        const { currentProject } = get();
        if (!currentProject || !currentProject.layout_data) return;
        
        set({
          currentProject: {
            ...currentProject,
            layout_data: {
              ...currentProject.layout_data,
              rules: { notTogether: rules },
            },
          },
          hasUnsavedChanges: true,
        });
      },

      // ==================== 协作管理 Actions ====================
      setActiveCollaborators: (collaborators) => set({ activeCollaborators: collaborators }),
      setInviteEmail: (email) => set({ inviteEmail: email }),

      // ==================== 重置和批量操作 Actions ====================
      resetLayout: () => {
        const { tables, unassignedGuests } = get();
        const allGuests = [...unassignedGuests, ...tables.flatMap((t) => t.guests)];
        
        set({
          tables: [],
          unassignedGuests: allGuests,
          hasUnsavedChanges: true,
        });
        
        get().showNotification('布局已重置');
      },

      markChanges: () => set({ hasUnsavedChanges: true }),
      clearChanges: () => set({ hasUnsavedChanges: false }),

      reset: () => set(initialState),
    }),
    { name: 'SeatingStore' }
  )
);

// ============================================================
// Selectors (用于派生状态)
// ============================================================

// 获取所有宾客
export const useAllGuests = () => {
  return useSeatingStore((state) => [
    ...state.unassignedGuests,
    ...state.tables.flatMap((t) => t.guests),
  ]);
};

// 获取筛选后的未分配宾客
export const useFilteredUnassignedGuests = () => {
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  const searchQuery = useSeatingStore((state) => state.searchQuery);
  const activeStatusFilter = useSeatingStore((state) => state.activeStatusFilter);
  
  return unassignedGuests.filter((guest) => {
    const matchesSearch = guest.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeStatusFilter === 'all' ||
      guest.status === activeStatusFilter;
    return matchesSearch && matchesFilter;
  });
};

// 获取宾客名称映射（已废弃，请在组件中使用 useMemo）
// 保留导出以避免破坏现有代码，但建议组件直接使用 useAllGuests 并用 useMemo 创建 Map
export const useGuestNameMap = () => {
  const allGuests = useAllGuests();
  // 注意：这会在每次调用时创建新的 Map
  // 建议在组件中使用 useMemo 来缓存结果
  return new Map(allGuests.map((g) => [g.id, g.name]));
};

// 获取统计数据
export const useStats = () => {
  return useSeatingStore((state) => {
    const allGuests = [
      ...state.unassignedGuests,
      ...state.tables.flatMap((t) => t.guests),
    ];
    const assignedGuestsCount = state.tables.reduce(
      (sum, table) => sum + table.guests.length,
      0
    );
    const totalGuests = allGuests.length;
    const tableCount = state.tables.length;
    const avgGuestsPerTable =
      tableCount > 0 ? (assignedGuestsCount / tableCount).toFixed(1) : '0';

    const confirmedCount = allGuests.filter((g) => g.status === 'confirmed').length;
    const unconfirmedCount = allGuests.filter(
      (g) => g.status === 'unconfirmed' || g.status === undefined
    ).length;
    const cancelledCount = allGuests.filter((g) => g.status === 'cancelled').length;
    const checkedInCount = allGuests.filter((g) => g.status === 'checked-in').length;

    const tableFillRate = state.tables.map((t) => ({
      name: t.tableName,
      rate: t.capacity ? (t.guests.length / t.capacity) * 100 : 0,
    }));

    const checkInRate =
      totalGuests > 0
        ? ((checkedInCount / (totalGuests - cancelledCount)) * 100).toFixed(1)
        : '0.0';

    return {
      totalGuests,
      tableCount,
      avgGuestsPerTable,
      confirmedCount,
      unconfirmedCount,
      cancelledCount,
      checkedInCount,
      checkInRate,
      assignedGuestsCount,
      unassignedGuestsCount: state.unassignedGuests.length,
      tableFillRate,
    };
  });
};
