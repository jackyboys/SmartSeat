'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { DndContext, rectIntersection, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';

// ✅ Task 4: 导入优化后的常量和工具函数
import { MODAL_TYPES, type ModalType } from '@/constants/modalTypes';
import { generateSeatingPdf, generatePlaceCardsPdf } from '@/utils/pdfGenerator';

// ✅ Task B: 导入 Zustand 状态管理
import { useSeatingStore } from '@/store/seatingStore';

// ✅ Task B Step 2: 导入自定义 Hooks
import { useNotifications } from '@/hooks/useNotifications';
// TODO: 集成这些 hooks (见 REFACTORING_SUMMARY.md)
// import { useProjectManager } from '@/hooks/useProjectManager';
// import { useRealtimeCollaboration } from '@/hooks/useRealtimeCollaboration';

// TODO: 使用这些组件简化 JSX (见 REFACTORING_SUMMARY.md)
// import { UnassignedGuestsPanel } from '@/components/dashboard/UnassignedGuestsPanel';
// import { TablesGrid } from '@/components/dashboard/TablesGrid';
// import { ControlPanel } from '@/components/dashboard/ControlPanel';
// import { ModalWrapper } from '@/components/dashboard/ModalWrapper';

// 主题的配置
const theme = {
  primary: 'from-blue-600 to-blue-500',
  success: 'from-green-600 to-green-500',
  danger: 'from-red-600 to-red-500',
  warning: 'from-yellow-600 to-yellow-500',
  cardBg: 'from-gray-800 to-gray-900',
};

// --- 数据结构 ---
// ✅ Task B Step 3: 添加 'checked-in' 状态以匹配组件类型
type GuestStatus = 'confirmed' | 'unconfirmed' | 'cancelled' | 'checked-in';

interface Guest {
  id: string;
  name: string;
  status?: GuestStatus;
  avatarUrl?: string;
  locked?: boolean; // 签到后锁定状态
  checkInTime?: string; // 签到时间
}

interface SeatingTable {
  id: string;
  tableName: string;
  guests: Guest[];
  capacity: number;
}

type NotTogetherRule = [string, string];

interface Project {
  id: number;
  name: string;
  user_id?: string;
  layout_data: {
    tables: SeatingTable[];
    unassignedGuests: Guest[];
    rules?: {
      notTogether: NotTogetherRule[];
    };
  } | null;
}

interface ProjectMember {
  id: number;
  user_id: string;
  email: string;
  role: string;
}

const statusColors: { [key in GuestStatus]: string } = {
  confirmed: 'bg-green-500',
  unconfirmed: 'bg-yellow-500',
  cancelled: 'bg-red-500',
  'checked-in': 'bg-blue-500',
};

const statusTooltips: { [key in GuestStatus]: string } = {
  confirmed: '已确认',
  unconfirmed: '未确认',
  cancelled: '已取消',
  'checked-in': '已签到',
};

// --- 自定义确认对话框 ---
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
  type = 'warning'
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}) => {
  if (!isOpen) return null;

  const typeColors = {
    warning: 'text-yellow-400',
    danger: 'text-red-400',
    info: 'text-blue-400'
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4"
      onClick={onCancel}
    >
      <div
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className={`text-2xl font-bold mb-4 ${typeColors[type]}`}>{title}</h3>
        <p className="text-gray-300 mb-8 whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 bg-gradient-to-r ${type === 'danger' ? theme.danger : theme.primary} hover:opacity-90 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 优化后的通知组件 ---
const Notification = ({ notification, onClose }: {
  notification: { type: 'success' | 'error' | 'info', message: string } | null;
  onClose: () => void;
}) => {
  if (!notification) return null;

  return (
    <div className="fixed top-6 right-6 max-w-md z-50 animate-slideIn">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            notification.type === 'success' ? 'bg-green-500/20 text-green-400' :
            notification.type === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            <span className="text-xl">{notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold mb-1 text-white">
              {notification.type === 'success' ? '成功' : notification.type === 'error' ? '错误' : '提示'}
            </p>
            <p className="text-sm text-gray-300">{notification.message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="关闭通知"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

// --- UI 组件 ---
const DraggableGuest = ({ guest, onDelete, onStatusChange, tableId, hasRule }: {
  guest: Guest;
  onDelete: (guestId: string, tableId?: string) => void;
  onStatusChange: (guestId: string, newStatus: GuestStatus) => void;
  tableId?: string;
  hasRule: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: guest.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isDragging ? 0.6 : 1,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(guest.id, tableId);
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const statuses: GuestStatus[] = ['unconfirmed', 'confirmed', 'cancelled'];
    const currentStatus = guest.status || 'unconfirmed';
    const nextIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    onStatusChange(guest.id, statuses[nextIndex]);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid="guest-item"
      data-guest-name={guest.name}
      role="button"
      tabIndex={0}
      aria-label={`宾客 ${guest.name}`}
      className="group relative p-2 bg-gradient-to-br from-gray-700 to-gray-800 rounded-md text-white cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg flex items-center transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-0.5 border border-gray-600 hover:border-gray-500"
    >
      {hasRule && (
        <div
          className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-gray-800 shadow-lg animate-pulse"
          title="此宾客存在特殊规则"
          aria-label="存在特殊规则"
        >
          !
        </div>
      )}

      <div className="relative flex-shrink-0 mr-2.5">
        {guest.avatarUrl ? (
          <img
            src={guest.avatarUrl}
            alt={guest.name}
            className="w-8 h-8 rounded-full object-cover shadow-inner transition-transform duration-200 group-hover:scale-110"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center font-bold text-xs shadow-inner transition-transform duration-200 group-hover:scale-110">
            {guest.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${statusColors[guest.status || 'unconfirmed']}`}
          title={statusTooltips[guest.status || 'unconfirmed']}
        />
      </div>

      <span className="flex-grow truncate text-sm font-medium">{guest.name}</span>

      <button
        onClick={handleStatusClick}
        className="mr-1.5 p-1 hover:bg-gray-600 rounded transition-all duration-200"
        title={`状态: ${statusTooltips[guest.status || 'unconfirmed']} (点击切换)`}
        aria-label={`切换状态，当前: ${statusTooltips[guest.status || 'unconfirmed']}`}
      >
        <div className={`w-4 h-4 rounded-full ${statusColors[guest.status || 'unconfirmed']}`} />
      </button>

      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all duration-200 hover:scale-110 transform"
        aria-label={`删除宾客 ${guest.name}`}
      >
        ✕
      </button>
    </div>
  );
};

// ✅ 修改Modal组件，支持不同尺寸
const Modal = ({ children, onClose, size = 'md' }: {
  children: React.ReactNode,
  onClose: () => void,
  size?: 'md' | 'lg' | 'xl'
}) => {
  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-gradient-to-br from-gray-800 to-gray-900 p-6 md:p-8 rounded-2xl shadow-2xl w-full ${sizeClasses[size]} border border-gray-700 transform transition-all duration-300 max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const DroppableContainer = ({ id, className, children, isDraggingOver }: {
  id: string;
  className?: string;
  children: React.ReactNode;
  isDraggingOver?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} transition-all duration-300 ease-out ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-500/10 scale-[1.01]' : ''
      }`}
    >
      {isDraggingOver && isOver && (
        <div className="h-0.5 bg-blue-400 my-2 animate-pulse rounded-full" />
      )}
      {children}
    </div>
  );
};

// 空状态组件
const EmptyState = ({ onAddGuest, onAiSeating }: {
  onAddGuest: () => void;
  onAiSeating: () => void;
}) => (
  <div className="flex flex-col items-center justify-center h-96 text-center px-4">
    <div className="text-6xl mb-4">🪑</div>
    <h3 className="text-xl font-bold mb-2">开始创建您的座位安排</h3>
    <p className="text-gray-400 mb-6 max-w-md">
      添加宾客和桌子，或使用 AI 智能排座快速生成座位方案
    </p>
    <div className="flex gap-3 flex-wrap justify-center">
      <button
        onClick={onAddGuest}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        添加宾客
      </button>
      <button
        onClick={onAiSeating}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        AI 排座
      </button>
    </div>
  </div>
);

// 统计图表组件
const StatsChart = ({ stats }: { stats: any }) => {
  const total = stats.confirmedCount + stats.unconfirmedCount + stats.cancelledCount;
  const confirmedPercent = total > 0 ? (stats.confirmedCount / total) * 100 : 0;
  const unconfirmedPercent = total > 0 ? (stats.unconfirmedCount / total) * 100 : 0;
  const cancelledPercent = total > 0 ? (stats.cancelledCount / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>宾客状态分布</span>
          <span>{total} 人</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden flex">
          {confirmedPercent > 0 && (
            <div
              className="bg-green-500 h-full transition-all duration-500"
              style={{ width: `${confirmedPercent}%` }}
              title={`已确认: ${stats.confirmedCount}`}
            />
          )}
          {unconfirmedPercent > 0 && (
            <div
              className="bg-yellow-500 h-full transition-all duration-500"
              style={{ width: `${unconfirmedPercent}%` }}
              title={`未确认: ${stats.unconfirmedCount}`}
            />
          )}
          {cancelledPercent > 0 && (
            <div
              className="bg-red-500 h-full transition-all duration-500"
              style={{ width: `${cancelledPercent}%` }}
              title={`已取消: ${stats.cancelledCount}`}
            />
          )}
        </div>
      </div>

      {stats.tableFillRate.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">桌子填充率</div>
          <div className="grid grid-cols-5 gap-1">
            {stats.tableFillRate.slice(0, 10).map((table: any, idx: number) => (
              <div
                key={table.name || `table-${idx}`}
                className={`h-8 rounded transition-all duration-300 hover:scale-110 cursor-pointer ${
                  table.rate >= 100 ? 'bg-red-500' :
                  table.rate >= 80 ? 'bg-yellow-500' :
                  table.rate >= 50 ? 'bg-blue-500' :
                  'bg-green-500'
                }`}
                title={`${table.name}: ${table.rate.toFixed(0)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- 主页面 ---
export default function DashboardPage() {
  const router = useRouter();
  
  // ✅ Task B: 保留 user 状态（与 Supabase 认证流程直接相关）
  const [user, setUser] = useState<User | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  
  // ✅ 实时协作状态
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([]);
  
  // ✅ Task B Step 2: 使用自定义 Hooks
  const { notification, showNotification, hideNotification } = useNotifications();
  
  // ✅ Task B: 从 Zustand Store 获取所有状态
  const projects = useSeatingStore((state) => state.projects);
  const currentProject = useSeatingStore((state) => state.currentProject);
  const tables = useSeatingStore((state) => state.tables);
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  const activeGuest = useSeatingStore((state) => state.activeGuest);
  const isLoading = useSeatingStore((state) => state.isLoading);
  const isSaving = useSeatingStore((state) => state.isSaving);
  const isAiLoading = useSeatingStore((state) => state.isAiLoading);
  const hasUnsavedChanges = useSeatingStore((state) => state.hasUnsavedChanges);
  const isModalOpen = useSeatingStore((state) => state.isModalOpen);
  const modalInputView = useSeatingStore((state) => state.modalInputView);
  const inputValue = useSeatingStore((state) => state.inputValue);
  const inputCapacity = useSeatingStore((state) => state.inputCapacity);
  const aiGuestList = useSeatingStore((state) => state.aiGuestList);
  const aiPlans = useSeatingStore((state) => state.aiPlans);
  const selectedPlanId = useSeatingStore((state) => state.selectedPlanId);
  const deleteConfirm = useSeatingStore((state) => state.deleteConfirm);
  const deleteUnassignedConfirm = useSeatingStore((state) => state.deleteUnassignedConfirm);
  const ruleGuests = useSeatingStore((state) => state.ruleGuests);
  const sidebarOpen = useSeatingStore((state) => state.sidebarOpen);
  const rightPanelOpen = useSeatingStore((state) => state.rightPanelOpen);
  const editingProjectId = useSeatingStore((state) => state.editingProjectId);
  const editingProjectName = useSeatingStore((state) => state.editingProjectName);
  const confirmDialog = useSeatingStore((state) => state.confirmDialog);
  const projectMembers = useSeatingStore((state) => state.projectMembers);
  const inviteEmail = useSeatingStore((state) => state.inviteEmail);
  const searchQuery = useSeatingStore((state) => state.searchQuery);
  const activeStatusFilter = useSeatingStore((state) => state.activeStatusFilter);
  
  // ✅ Task B: 从 Zustand Store 获取所有 Actions
  const setProjects = useSeatingStore((state) => state.setProjects);
  const setCurrentProject = useSeatingStore((state) => state.setCurrentProject);
  const setTables = useSeatingStore((state) => state.setTables);
  const setUnassignedGuests = useSeatingStore((state) => state.setUnassignedGuests);
  const setActiveGuest = useSeatingStore((state) => state.setActiveGuest);
  const setIsLoading = useSeatingStore((state) => state.setIsLoading);
  const setIsSaving = useSeatingStore((state) => state.setIsSaving);
  const setIsAiLoading = useSeatingStore((state) => state.setIsAiLoading);
  const setHasUnsavedChanges = useSeatingStore((state) => state.setHasUnsavedChanges);
  const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
  const setModalInputView = useSeatingStore((state) => state.setModalInputView);
  const setInputValue = useSeatingStore((state) => state.setInputValue);
  const setInputCapacity = useSeatingStore((state) => state.setInputCapacity);
  const setAiGuestList = useSeatingStore((state) => state.setAiGuestList);
  const setAiPlans = useSeatingStore((state) => state.setAiPlans);
  const setSelectedPlanId = useSeatingStore((state) => state.setSelectedPlanId);
  const setDeleteConfirm = useSeatingStore((state) => state.setDeleteConfirm);
  const setDeleteUnassignedConfirm = useSeatingStore((state) => state.setDeleteUnassignedConfirm);
  const setRuleGuests = useSeatingStore((state) => state.setRuleGuests);
  const setSidebarOpen = useSeatingStore((state) => state.setSidebarOpen);
  const setRightPanelOpen = useSeatingStore((state) => state.setRightPanelOpen);
  const setEditingProjectId = useSeatingStore((state) => state.setEditingProjectId);
  const setEditingProjectName = useSeatingStore((state) => state.setEditingProjectName);
  const showConfirm = useSeatingStore((state) => state.showConfirm);
  const hideConfirm = useSeatingStore((state) => state.hideConfirm);
  const setProjectMembers = useSeatingStore((state) => state.setProjectMembers);
  const setInviteEmail = useSeatingStore((state) => state.setInviteEmail);
  const setSearchQuery = useSeatingStore((state) => state.setSearchQuery);
  const setActiveStatusFilter = useSeatingStore((state) => state.setActiveStatusFilter);
  const markChanges = useSeatingStore((state) => state.markChanges);
  const clearChanges = useSeatingStore((state) => state.clearChanges);

  const filteredUnassignedGuests = useMemo(() => {
    return unassignedGuests.filter(guest => {
      const matchesSearch = guest.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeStatusFilter === 'all' || guest.status === activeStatusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [unassignedGuests, searchQuery, activeStatusFilter]);

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const allGuests = useMemo(() => [...unassignedGuests, ...tables.flatMap(t => t.guests)], [unassignedGuests, tables]);
  const guestNameMap = useMemo(() => new Map(allGuests.map(g => [g.id, g.name])), [allGuests]);

  const stats = useMemo(() => {
    const assignedGuestsCount = tables.reduce((sum, table) => sum + table.guests.length, 0);
    const totalGuests = allGuests.length;
    const tableCount = tables.length;
    const avgGuestsPerTable = tableCount > 0 ? parseFloat((assignedGuestsCount / tableCount).toFixed(1)) : 0;

    const confirmedCount = allGuests.filter(g => g.status === 'confirmed').length;
    const unconfirmedCount = allGuests.filter(g => g.status === 'unconfirmed' || g.status === undefined).length;
    const cancelledCount = allGuests.filter(g => g.status === 'cancelled').length;
    const checkedInCount = 0; // ✅ Task 4: 签到功能未实现，暂时为0
    const unassignedGuestsCount = unassignedGuests.length; // ✅ Task 4: 添加未分配人数统计
    const tableFillRate = tables.map(t => ({
      name: t.tableName,
      rate: t.capacity ? (t.guests.length / t.capacity) * 100 : 0
    }));

    return {
      totalGuests,
      tableCount,
      avgGuestsPerTable,
      confirmedCount,
      unconfirmedCount,
      cancelledCount,
      checkedInCount,
      assignedGuestsCount,
      unassignedGuestsCount,
      tableFillRate,
    };
  }, [tables, allGuests, unassignedGuests]);

  // ✅ Task B: showNotification 和 showConfirm 现在从 Zustand Store 获取，无需本地定义

  // 广播布局变更给其他协作者
  const broadcastLayoutChange = useCallback((newTables: SeatingTable[], newUnassignedGuests: Guest[]) => {
    if (!currentProject || !user) return;
    
    const channel = supabase.channel(`project-${currentProject.id}`);
    channel.send({
      type: 'broadcast',
      event: 'layout-change',
      payload: {
        tables: newTables,
        unassignedGuests: newUnassignedGuests,
        rules: currentProject.layout_data?.rules,
        editorId: user.id,
        timestamp: Date.now()
      },
    });
  }, [currentProject, user, supabase]);

  // ✅ 修改后的 fetchProjectMembers 函数
  const fetchProjectMembers = useCallback(async () => {
    if (!currentProject || currentProject.id < 0) {
      setProjectMembers([]);
      return;
    }
    
    try {
      console.log('开始获取项目成员，项目ID:', currentProject.id);
      
      // 第一步：获取项目成员列表（不使用嵌套查询）
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('id, user_id, role')
        .eq('project_id', currentProject.id);
      
      console.log('项目成员数据:', membersData, '错误:', membersError);
      
      if (membersError) {
        console.error('获取成员失败:', membersError);
        showNotification(`获取成员失败: ${membersError.message}`, 'error');
        setProjectMembers([]);
        return;
      }
      
      if (!membersData || membersData.length === 0) {
        console.log('该项目没有成员');
        setProjectMembers([]);
        return;
      }
      
      // 第二步：批量获取用户邮箱
      const userIds = membersData.map(m => m.user_id);
      console.log('需要查询的用户IDs:', userIds);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      
      console.log('用户profiles数据:', profilesData, '错误:', profilesError);
      
      if (profilesError) {
        console.error('获取用户信息失败:', profilesError);
        // 即使获取profile失败，也显示成员列表，只是邮箱显示为"未知"
      }
      
      // 第三步：合并数据
      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, p.email])
      );
      
      const members = membersData.map(m => ({
        id: m.id,
        user_id: m.user_id,
        email: profileMap.get(m.user_id) || '未知用户',
        role: m.role
      }));
      
      console.log('最终成员列表:', members);
      setProjectMembers(members);
      
    } catch (err: any) {
      console.error('获取成员时出错:', err);
      showNotification(`获取成员时出错: ${err.message}`, 'error');
      setProjectMembers([]);
    }
  }, [currentProject, supabase, showNotification]);

  // ✅ 修改后的 handleInviteCollaborator 函数
  const handleInviteCollaborator = async () => {
    console.log('开始邀请协作者，当前项目:', currentProject);
    
    if (!currentProject || currentProject.id < 0) {
      showNotification('请先保存项目', 'error');
      return;
    }
    
    if (!inviteEmail.trim()) {
      showNotification('请输入邮箱地址', 'error');
      return;
    }
    
    // 检查是否是项目所有者
    if (currentProject.user_id !== user?.id) {
      showNotification('只有项目所有者可以邀请协作者', 'error');
      return;
    }
    
    try {
      console.log('查找用户，邮箱:', inviteEmail.trim());
      
      // 1. 查找用户
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', inviteEmail.trim())
        .maybeSingle(); // 使用 maybeSingle 而不是 single，避免没找到时报错
      
      console.log('查找用户结果:', profileData, '错误:', profileError);
      
      if (profileError) {
        console.error('查找用户出错:', profileError);
        showNotification(`查找用户失败: ${profileError.message}`, 'error');
        return;
      }
      
      if (!profileData) {
        showNotification('未找到该用户，请确认邮箱是否正确', 'error');
        return;
      }
      
      // 2. 检查是否是项目所有者本人
      if (profileData.id === user?.id) {
        showNotification('不能邀请自己', 'error');
        return;
      }
      
      console.log('检查是否已是成员，项目ID:', currentProject.id, '用户ID:', profileData.id);
      
      // 3. 检查是否已经是成员
      const { data: existingMember, error: checkError } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', currentProject.id)
        .eq('user_id', profileData.id)
        .maybeSingle();
      
      console.log('检查已有成员结果:', existingMember, '错误:', checkError);
      
      if (checkError) {
        console.error('检查成员出错:', checkError);
        showNotification(`检查失败: ${checkError.message}`, 'error');
        return;
      }
      
      if (existingMember) {
        showNotification('该用户已经是项目成员', 'error');
        return;
      }
      
      console.log('添加协作者，项目ID:', currentProject.id, '用户ID:', profileData.id);
      
      // 4. 添加协作者
      const { error: insertError } = await supabase
        .from('project_members')
        .insert({
          project_id: currentProject.id,
          user_id: profileData.id,
          role: 'editor'
        });
      
      console.log('添加结果，错误:', insertError);
      
      if (insertError) {
        console.error('邀请失败:', insertError);
        showNotification(`邀请失败: ${insertError.message}`, 'error');
      } else {
        showNotification(`成功邀请 ${inviteEmail} 加入项目！`, 'success');
        setInviteEmail('');
        setIsModalOpen(null); // 关闭对话框
        fetchProjectMembers(); // 刷新成员列表
      }
    } catch (err: any) {
      console.error('邀请出错:', err);
      showNotification(`邀请出错: ${err.message}`, 'error');
    }
  };

  // ✅ 新增：移除协作者
  const handleRemoveMember = async (memberId: number, memberEmail: string) => {
    showConfirm(
      '确认移除',
      `确定要将 ${memberEmail} 移出项目吗？`,
      async () => {
        const { error } = await supabase
          .from('project_members')
          .delete()
          .eq('id', memberId);
        
        if (error) {
          showNotification(`移除失败: ${error.message}`, 'error');
        } else {
          showNotification('成员已移除', 'success');
          fetchProjectMembers();
        }
      },
      'danger'
    );
  };

  const handleSaveProject = useCallback(async () => {
    if (!currentProject || !user || !hasUnsavedChanges || isSaving) return null;

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    setIsSaving(true);
    const layout_data = {
      tables,
      unassignedGuests,
      rules: currentProject.layout_data?.rules || { notTogether: [] }
    };

    let savedProject: Project | null = null;

    try {
      if (currentProject.id < 0) {
        const { data, error } = await supabase.from('projects').insert({ name: currentProject.name, layout_data, user_id: user.id }).select().single();
        if (error) {
          console.error('Insert project error:', error);
          showNotification(`创建失败: ${error.message}`, 'error');
          setIsSaving(false);
          return null;
        }
        else if(data) {
          showNotification('项目已创建并保存！', 'success');
          savedProject = data;
          const newProjects = projects.map(p => p.id === currentProject.id ? data : p);
          setProjects(newProjects);
          setCurrentProject(data);
        }
      } else {
        const { error } = await supabase.from('projects').update({ name: currentProject.name, layout_data }).eq('id', currentProject.id);
        if (error) {
          console.error('Update project error:', error);
          showNotification(`保存失败: ${error.message}`, 'error');
          setIsSaving(false);
          return null;
        }
        else {
          showNotification('项目已保存！', 'success');
          savedProject = { ...currentProject, layout_data };
          setProjects(projects.map(p => p.id === currentProject.id ? {...p, name: currentProject.name, layout_data} : p));
        }
      }
    } catch (err: any) {
      console.error('Save project error:', err);
      showNotification(`保存出错: ${err.message}`, 'error');
      setIsSaving(false);
      return null;
    }

    setIsSaving(false);
    setHasUnsavedChanges(false);
    return savedProject;
  }, [currentProject, user, hasUnsavedChanges, tables, unassignedGuests, projects, isSaving, supabase, showNotification]);

  // ✅ Task B: markChanges 现在从 Zustand Store 获取
  // 本地保留自动保存逻辑的包装
  const markChangesWithAutoSave = useCallback(() => {
    markChanges(); // 调用 Store 的 markChanges
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    if (autoSaveEnabled) {
      autoSaveTimeout.current = setTimeout(() => {
        handleSaveProject();
      }, 1000);
    }
  }, [markChanges, handleSaveProject, autoSaveEnabled]);

  const loadProjectData = (project: Project) => {
    setCurrentProject(project);
    const layout = project.layout_data;
    setTables(layout?.tables.map((t: SeatingTable) => ({
      ...t,
      id: t.id || uuidv4(),
      capacity: t.capacity || 10,
      guests: t.guests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() }))
    })) || []);
    setUnassignedGuests(layout?.unassignedGuests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() })) || []);
    setHasUnsavedChanges(false);
  };

  const handleLoadProject = useCallback(async (project: Project) => {
    if (currentProject?.id === project.id) return;

    if (hasUnsavedChanges) {
      showConfirm(
        '未保存的更改',
        '您有未保存的更改。是否要在切换前保存？\n\n点击"确定"保存并切换\n点击"取消"放弃更改并切换',
        async () => {
          await handleSaveProject();
          loadProjectData(project);
        },
        'warning',
        () => {
          // 点击"取消"：放弃更改并切换
          setHasUnsavedChanges(false);
          loadProjectData(project);
        }
      );
      return;
    }

    loadProjectData(project);
  }, [hasUnsavedChanges, handleSaveProject, currentProject]);

  // ✅ 修改：查询用户创建的项目 + 被分享的项目
  const fetchProjectsAndLoadFirst = useCallback(async (userToFetch: User) => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, 
        name, 
        layout_data,
        user_id,
        created_at
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      showNotification(`加载项目失败: ${error.message}`, 'error');
    } else {
      setProjects(data || []);
      if (data && data.length > 0) {
        const projectToLoad = data[0];
        setCurrentProject(projectToLoad);
        const layout = projectToLoad.layout_data;
        setTables(layout?.tables.map((t: SeatingTable) => ({
          ...t,
          id: t.id || uuidv4(),
          capacity: t.capacity || 10,
          guests: t.guests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() }))
        })) || []);
        setUnassignedGuests(layout?.unassignedGuests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() })) || []);
      } else {
        const newProj: Project = { id: -1, name: '我的第一个项目', layout_data: { tables: [], unassignedGuests: [] } };
        setCurrentProject(newProj); setTables([]); setUnassignedGuests([]);
      }
    }
    setIsLoading(false);
  }, [supabase, showNotification]);

  const handleNewProject = () => {
    if (!inputValue.trim()) { showNotification('项目名称不能为空', 'error'); return; }
    if (hasUnsavedChanges) {
      showConfirm(
        '未保存的更改',
        '您有未保存的更改，确定要创建新项目吗？所有未保存的更改将丢失。',
        () => {
          createNewProject();
        },
        'warning'
      );
      return;
    }
    createNewProject();
  };

  const createNewProject = () => {
    const tempId = -Date.now();
    const newProj: Project = { id: tempId, name: inputValue, user_id: user?.id, layout_data: { tables: [], unassignedGuests: [], rules: { notTogether: [] } } };
    setProjects([newProj, ...projects]);
    handleLoadProject(newProj);
    setIsModalOpen(null); setInputValue('');
  };

  const handleDeleteProject = async (projectId: number) => {
    showConfirm(
      '确认删除',
      '您确定要删除此项目吗？此操作无法撤销。',
      async () => {
        if (projectId < 0) {
          const newProjects = projects.filter(p => p.id !== projectId);
          setProjects(newProjects);
          showNotification('项目已成功删除');
          if (newProjects.length > 0) { handleLoadProject(newProjects[0]); }
          else { const newProj: Project = { id: -Date.now(), name: '新项目', layout_data: null }; setCurrentProject(newProj); setTables([]); setUnassignedGuests([]); }
          return;
        }
        const { error } = await supabase.from('projects').delete().eq('id', projectId);
        if (error) { showNotification(`删除失败: ${error.message}`, 'error'); }
        else {
          showNotification('项目已成功删除');
          const newProjects = projects.filter(p => p.id !== projectId);
          setProjects(newProjects);
          if (currentProject?.id === projectId) {
            if (newProjects.length > 0) handleLoadProject(newProjects[0]);
            else { const newProj: Project = { id: -Date.now(), name: '新项目', layout_data: null }; setCurrentProject(newProj); setTables([]); setUnassignedGuests([]); }
          }
        }
      },
      'danger'
    );
  };

  const handleEditProjectName = (projectId: number, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingProjectName(currentName);
  };

  const handleSaveProjectName = async (projectId: number) => {
    if (!editingProjectName.trim()) {
      showNotification('项目名称不能为空', 'error');
      return;
    }

    if (projectId < 0) {
      setProjects(projects.map(p => p.id === projectId ? { ...p, name: editingProjectName } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject({ ...currentProject, name: editingProjectName });
      }
    } else {
      const { error } = await supabase.from('projects').update({ name: editingProjectName }).eq('id', projectId);
      if (error) {
        showNotification(`重命名失败: ${error.message}`, 'error');
      } else {
        setProjects(projects.map(p => p.id === projectId ? { ...p, name: editingProjectName } : p));
        if (currentProject?.id === projectId) {
          setCurrentProject({ ...currentProject, name: editingProjectName });
        }
        showNotification('项目已重命名');
      }
    }
    setEditingProjectId(null);
  };

  const parseFileAndAdd = (file: File, type: 'guest' | 'table') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') throw new Error('无法读取文件内容');
        let names: string[] = [];
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          names = Papa.parse(content, { header: false }).data.flat().map(n => String(n).trim()).filter(Boolean);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(content, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          names = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).flat().map(n => String(n).trim()).filter(Boolean);
        } else {
          throw new Error('不支持的文件格式. 请使用 .txt, .csv, 或 .xlsx');
        }

        if(type === 'guest') {
          const newGuests: Guest[] = names.map(name => ({ id: uuidv4(), name, status: 'unconfirmed' }));
          const updatedGuests = [...unassignedGuests, ...newGuests];
          setUnassignedGuests(updatedGuests);
          broadcastLayoutChange(tables, updatedGuests);
        } else {
          const newTables: SeatingTable[] = names.map(name => ({ id: uuidv4(), tableName: name, guests: [], capacity: parseInt(inputCapacity) || 10 }));
          const updatedTables = [...tables, ...newTables];
          setTables(updatedTables);
          broadcastLayoutChange(updatedTables, unassignedGuests);
        }
        showNotification(`成功导入 ${names.length} 个条目！`);
        setIsModalOpen(null);
        markChanges();
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    };
    reader.onerror = () => showNotification('读取文件时发生错误', 'error');
    reader.readAsBinaryString(file);
  };

  const handleAddGuests = () => {
    const names = inputValue.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) { showNotification('请输入宾客姓名', 'error'); return; }
    const newGuests: Guest[] = names.map(name => ({ id: uuidv4(), name, status: 'unconfirmed' }));
    const updatedGuests = [...unassignedGuests, ...newGuests];
    setUnassignedGuests(updatedGuests);
    broadcastLayoutChange(tables, updatedGuests);
    setIsModalOpen(null); setInputValue(''); markChanges();
  };

  const handleAddTable = () => {
    if (!inputValue.trim()) { showNotification('桌子名称不能为空', 'error'); return; }
    const capacity = parseInt(inputCapacity);
    if (isNaN(capacity) || capacity < 1) { showNotification('容量必须是大于0的数字', 'error'); return; }
    const newTable: SeatingTable = { id: uuidv4(), tableName: inputValue, guests: [], capacity };
    const updatedTables = [...tables, newTable];
    setTables(updatedTables);
    broadcastLayoutChange(updatedTables, unassignedGuests);
    setIsModalOpen(null); setInputValue(''); setInputCapacity('10');
    setTimeout(() => { markChanges(); }, 0);
  };

  const handleDeleteGuest = (guestId: string) => {
    const guest = unassignedGuests.find(g => g.id === guestId);
    if (!guest) return;
    setDeleteUnassignedConfirm({ guestId, guestName: guest.name });
  };

  const handleConfirmDeleteUnassigned = () => {
    if (!deleteUnassignedConfirm) return;
    const { guestId } = deleteUnassignedConfirm;
    const updatedGuests = unassignedGuests.filter(g => g.id !== guestId);
    const updatedTables = tables.map(t => ({...t, guests: t.guests.filter(g => g.id !== guestId)}));
    setUnassignedGuests(updatedGuests);
    setTables(updatedTables);
    broadcastLayoutChange(updatedTables, updatedGuests);
    setDeleteUnassignedConfirm(null);
    markChanges();
  };

  const handleRemoveGuestFromTable = (guestId: string, tableId: string) => {
    const guest = tables.find(t => t.id === tableId)?.guests.find(g => g.id === guestId);
    if (!guest) return;
    setDeleteConfirm({ guestId, tableId, guestName: guest.name });
  };

  const handleConfirmDelete = (action: 'move' | 'delete') => {
    if (!deleteConfirm) return;
    const { guestId, tableId } = deleteConfirm;
    const guest = tables.find(t => t.id === tableId)?.guests.find(g => g.id === guestId);
    if (!guest) return;

    if (action === 'move') {
      const updatedTables = tables.map(t =>
        t.id === tableId
          ? {...t, guests: t.guests.filter(g => g.id !== guestId)}
          : t
      );
      const updatedGuests = [...unassignedGuests, guest];
      setTables(updatedTables);
      setUnassignedGuests(updatedGuests);
      broadcastLayoutChange(updatedTables, updatedGuests);
      showNotification('宾客已移动到未分配区');
    } else {
      const updatedTables = tables.map(t => ({...t, guests: t.guests.filter(g => g.id !== guestId)}));
      setTables(updatedTables);
      broadcastLayoutChange(updatedTables, unassignedGuests);
      showNotification('宾客已彻底删除');
    }
    setDeleteConfirm(null);
    markChanges();
  };

  const handleGuestStatusChange = (guestId: string, newStatus: GuestStatus) => {
    const updateUser = (users: Guest[]) => users.map(g => g.id === guestId ? { ...g, status: newStatus } : g);
    const updatedGuests = updateUser(unassignedGuests);
    const updatedTables = tables.map(t => ({
      ...t,
      guests: updateUser(t.guests)
    }));
    setUnassignedGuests(updatedGuests);
    setTables(updatedTables);
    broadcastLayoutChange(updatedTables, updatedGuests);
    markChanges();
  };

  const handleDeleteTable = (tableId: string) => {
    showConfirm(
      '确认删除',
      '您确定要删除这张桌子吗？桌上所有宾客将移至未分配区。',
      () => {
        const tableToMove = tables.find(t => t.id === tableId);
        const updatedGuests = tableToMove ? [...unassignedGuests, ...tableToMove.guests] : unassignedGuests;
        const updatedTables = tables.filter(t => t.id !== tableId);
        setUnassignedGuests(updatedGuests);
        setTables(updatedTables);
        broadcastLayoutChange(updatedTables, updatedGuests);
        markChanges();
      },
      'warning'
    );
  };

  const handleAddRule = () => {
    const { g1, g2 } = ruleGuests;
    if (!g1 || !g2) {
      showNotification('请选择两位宾客', 'error');
      return;
    }
    if (g1 === g2) {
      showNotification('不能将同一位宾客设置为一组规则', 'error');
      return;
    }

    const newRule: NotTogetherRule = [g1, g2].sort() as NotTogetherRule;
    const existingRules = currentProject?.layout_data?.rules?.notTogether || [];

    const isDuplicate = existingRules.some(rule => rule[0] === newRule[0] && rule[1] === newRule[1]);
    if (isDuplicate) {
      showNotification('该规则已存在', 'error');
      return;
    }

    setCurrentProject(proj => {
      if (!proj) return null;
      const newLayout = {
        ...proj.layout_data!,
        rules: {
          ...proj.layout_data?.rules,
          notTogether: [...existingRules, newRule],
        },
      };
      return { ...proj, layout_data: newLayout };
    });

    showNotification('规则添加成功！');
    setIsModalOpen(null);
    setRuleGuests({ g1: '', g2: '' });
    broadcastLayoutChange(tables, unassignedGuests);
    markChanges();
  };

  const handleDeleteRule = (ruleToRemove: NotTogetherRule) => {
    setCurrentProject(proj => {
      if (!proj) return null;
      const newRules = (proj.layout_data?.rules?.notTogether || []).filter(
        rule => rule[0] !== ruleToRemove[0] || rule[1] !== ruleToRemove[1]
      );
      const newLayout = {
        ...proj.layout_data!,
        rules: {
          ...proj.layout_data?.rules,
          notTogether: newRules,
        },
      };
      return { ...proj, layout_data: newLayout };
    });
    broadcastLayoutChange(tables, unassignedGuests);
    markChanges();
  };

  const handleAiSeating = async () => {
    if (!aiGuestList.trim()) {
      showNotification('宾客名单不能为空', 'error');
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/generate-seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestList: aiGuestList,
          planCount: 3
        }),
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || 'AI 服务出错');

      if (result.plans) {
        const plansWithIds = result.plans.map((plan: any, index: number) => ({
          ...plan,
          id: plan.id || uuidv4()
        }));

        setAiPlans(plansWithIds);
        setSelectedPlanId(plansWithIds[0]?.id || null);
        showNotification(`AI 生成了 ${plansWithIds.length} 个方案，请选择应用！`);
      } else {
        const aiTables: SeatingTable[] = result.tables.map((t: any) => ({
          id: uuidv4(),
          tableName: t.tableName,
          guests: t.guests.map((gName: string) => ({
            id: uuidv4(),
            name: gName,
            status: 'unconfirmed'
          })),
          capacity: 10,
        }));
        setTables(aiTables);
        setUnassignedGuests([]);
        broadcastLayoutChange(aiTables, []);
        showNotification('AI 智能排座已完成！');
        markChanges();
        setIsModalOpen(null);
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
    setIsAiLoading(false);
  };

  const handleApplySelectedPlan = () => {
    const selectedPlan = aiPlans.find(p => p.id === selectedPlanId);
    if (!selectedPlan) {
      showNotification('请先选择一个方案', 'error');
      return;
    }

    const aiTables: SeatingTable[] = selectedPlan.tables.map((t: any) => ({
      id: uuidv4(),
      tableName: t.tableName,
      guests: t.guests.map((gName: string) => ({
        id: uuidv4(),
        name: gName,
        status: 'unconfirmed'
      })),
      capacity: 10,
    }));

    setTables(aiTables);
    setUnassignedGuests([]);
    broadcastLayoutChange(aiTables, []);
    showNotification(`已应用"${selectedPlan.name}"方案！`);
    markChanges();
    setIsModalOpen(null);
    setAiPlans([]);
    setSelectedPlanId(null);
  };

  const handleExportPdf = () => {
    if (!currentProject) {
      showNotification('请先选择一个项目', 'error');
      return;
    }

    showNotification('正在生成PDF，请稍候...');

    try {
      // ✅ Task 4: 使用抽离的 PDF 生成工具函数
      generateSeatingPdf(currentProject, tables, unassignedGuests, stats, guestNameMap);

      showNotification('PDF导出成功！');

    } catch (error) {
      console.error('PDF导出错误:', error);
      showNotification('导出PDF失败，请重试', 'error');
    }
  };

  const handleExportPlaceCards = () => {
    if (!currentProject) {
      showNotification('请先选择一个项目', 'error');
      return;
    }

    const assignedGuests = tables.flatMap(table =>
      table.guests.map(guest => ({
        guestName: guest.name,
        tableName: table.tableName,
      }))
    );

    if (assignedGuests.length === 0) {
      showNotification('没有已安排座位的宾客可以生成桌卡', 'error');
      return;
    }

    showNotification('正在生成桌卡PDF, 请稍候...');

    try {
      // ✅ Task 4: 使用抽离的 PDF 生成工具函数
      generatePlaceCardsPdf(currentProject, tables);
      showNotification('桌卡PDF已成功生成！');
    } catch (error) {
      console.error('生成桌卡PDF时出错:', error);
      showNotification('生成桌卡失败，请重试', 'error');
    }
  };

  const handleCopyCheckInLink = () => {
    if (!currentProject) return;
    
    const checkInUrl = `${window.location.origin}/check-in/${currentProject.id}`;
    
    navigator.clipboard.writeText(checkInUrl).then(() => {
      showNotification('签到链接已复制到剪贴板！', 'success');
    }).catch(() => {
      showNotification('复制失败，请手动复制', 'error');
    });
  };

  const findContainer = (id: string) => {
    if (unassignedGuests.some(g => g.id === id) || id === 'unassigned-area') return 'unassigned-area';
    for (const table of tables) { if (table.guests.some(g => g.id === id) || table.id === id) return table.id; }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const guestId = event.active.id as string;
    setActiveGuest(allGuests.find(g => g.id === guestId) || null);
  };

  // 新的函数，用于移动并解锁宾客
  const moveAndUnlockGuest = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    let guestToMove: Guest | undefined = allGuests.find(g => g.id === activeId);

    if (!guestToMove) return;

    // 关键改变：创建一个解锁后的宾客副本
    const unlockedGuest = { ...guestToMove, locked: false };

    // 从原位置移除
    let updatedTables = tables.map(t => ({
      ...t,
      guests: t.guests.filter(g => g.id !== activeId)
    }));
    let updatedUnassigned = unassignedGuests.filter(g => g.id !== activeId);

    const overId = over.id as string;
    const overContainerId = findContainer(overId);

    // 放置到新位置
    if (overContainerId === 'unassigned-area') {
      updatedUnassigned.push(unlockedGuest);
    } else {
      const targetTable = updatedTables.find(t => t.id === overContainerId);
      if (targetTable) {
        const overGuestIndex = targetTable.guests.findIndex(g => g.id === overId);
        if (overGuestIndex !== -1) {
          targetTable.guests.splice(overGuestIndex, 0, unlockedGuest);
        } else {
          targetTable.guests.push(unlockedGuest);
        }
      }
    }
    
    setTables(updatedTables);
    setUnassignedGuests(updatedUnassigned);
    broadcastLayoutChange(updatedTables, updatedUnassigned);
    markChanges();
    showNotification(`宾客 "${unlockedGuest.name}" 已被移动并解锁。`, 'info');
  };

  // 更新后的 handleDragEnd 函数
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGuest(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const originalContainerId = findContainer(activeId);
    const overContainerId = findContainer(overId);

    if (!originalContainerId || !overContainerId || activeId === overId) return;

    const draggedGuest = allGuests.find(g => g.id === activeId);
    const isMovingWithinUnassigned = originalContainerId === 'unassigned-area' && overContainerId === 'unassigned-area';

    if (draggedGuest && draggedGuest.locked && !isMovingWithinUnassigned) {
      showConfirm(
        '管理员操作确认',
        `宾客 "${draggedGuest.name}" 已签到并锁定。\n\n您确定要移动他/她的座位吗？\n此操作将同时为该宾客解锁。`,
        () => {
          moveAndUnlockGuest(event);
        },
        'warning'
      );
      return;
    }
    
    // --- 常规拖拽逻辑 (保持不变) ---
    if (originalContainerId === overContainerId) {
      if (originalContainerId === 'unassigned-area') {
        setUnassignedGuests(guests => {
          const oldIndex = guests.findIndex(g => g.id === activeId);
          const newIndex = guests.findIndex(g => g.id === overId);
          return arrayMove(guests, oldIndex, newIndex);
        });
      } else {
        setTables(currentTables => currentTables.map(table => {
          if (table.id === originalContainerId) {
            const oldIndex = table.guests.findIndex(g => g.id === activeId);
            const newIndex = table.guests.findIndex(g => g.id === overId);
            return { ...table, guests: arrayMove(table.guests, oldIndex, newIndex) };
          }
          return table;
        }));
      }
    } else {
      const rules = currentProject?.layout_data?.rules?.notTogether || [];
      const targetTable = tables.find(t => t.id === overContainerId);

      if (targetTable) {
        if (targetTable.guests.length >= targetTable.capacity) {
          showNotification(`"${targetTable.tableName}" 已满，无法添加更多宾客。`, 'error');
          return;
        }
        for (const rule of rules) {
          const [p1, p2] = rule;
          const isConflict = (p1 === activeId && targetTable.guests.some(g => g.id === p2)) ||
                               (p2 === activeId && targetTable.guests.some(g => g.id === p1));
          if (isConflict) {
            showNotification(`规则冲突：${guestNameMap.get(p1)} 和 ${guestNameMap.get(p2)} 不能同桌。`, 'error');
            return;
          }
        }
      }

      let guestToMove: Guest | undefined;
      let nextUnassigned = [...unassignedGuests];
      let nextTables = structuredClone(tables);

      if (originalContainerId === 'unassigned-area') {
        const index = nextUnassigned.findIndex(g => g.id === activeId);
        [guestToMove] = nextUnassigned.splice(index, 1);
      } else {
        const table = nextTables.find((t: SeatingTable) => t.id === originalContainerId);
        if (table) {
          const index = table.guests.findIndex((g: Guest) => g.id === activeId);
          [guestToMove] = table.guests.splice(index, 1);
        }
      }

      if (!guestToMove) return;

      if (overContainerId === 'unassigned-area') {
        const overGuestIndex = nextUnassigned.findIndex(g => g.id === overId);
        nextUnassigned.splice(overGuestIndex, 0, guestToMove);
      } else {
        const table = nextTables.find((t: SeatingTable) => t.id === overContainerId);
        if(table) {
          if (table.guests.length >= table.capacity) {
            showNotification(`"${table.tableName}" 已满。`, 'error');
            return;
          }
          const overGuestIndex = table.guests.findIndex((g: Guest) => g.id === overId);
          table.guests.splice(overGuestIndex, 0, guestToMove);
        }
      }
      setUnassignedGuests(nextUnassigned);
      setTables(nextTables);
      broadcastLayoutChange(nextTables, nextUnassigned);
    }
    markChanges();
  };

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        await fetchProjectsAndLoadFirst(user);
      } else {
        router.push('/');
      }
    };
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setProjects([]);
          setCurrentProject(null);
          setTables([]);
          setUnassignedGuests([]);
          router.push('/');
        } else if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          fetchProjectsAndLoadFirst(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, fetchProjectsAndLoadFirst, supabase.auth]);

  // ✅ 新增：当项目切换时，获取项目成员
  useEffect(() => {
    if (currentProject && currentProject.id > 0) {
      fetchProjectMembers();
    } else {
      setProjectMembers([]);
    }
  }, [currentProject?.id, fetchProjectMembers]);

  // 实时协作：订阅项目变更
  useEffect(() => {
    if (!currentProject || !user) return;

    const channel = supabase
      .channel(`project-${currentProject.id}`)
      .on('broadcast', { event: 'layout-change' }, (payload: any) => {
        // 避免响应自己的变更
        if (payload.payload.editorId !== user.id) {
          const { tables: newTables, unassignedGuests: newUnassignedGuests, rules } = payload.payload;
          
          setTables(newTables || []);
          setUnassignedGuests(newUnassignedGuests || []);
          
          if (rules && currentProject.layout_data) {
            setCurrentProject({
              ...currentProject,
              layout_data: {
                ...currentProject.layout_data,
                rules
              }
            });
          }
          
          showNotification('👥 布局已由协作者更新', 'info');
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // 🔧 使用 Object.values 和可选链安全获取协作者邮箱
        const collaborators = Object.values(state)
          .map(presences => presences?.[0] as any) // 获取每个用户的第一个 presence
          .map(presence => presence?.user_email) // 安全访问 user_email
          .filter((email): email is string => typeof email === 'string' && email !== user.email); // 类型守卫，过滤掉无效值
        setActiveCollaborators(collaborators);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const newCollaborator = newPresences[0]?.user_email;
        if (newCollaborator && newCollaborator !== user.email) {
          showNotification(`👋 ${newCollaborator} 加入了协作`, 'info');
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftCollaborator = leftPresences[0]?.user_email;
        if (leftCollaborator && leftCollaborator !== user.email) {
          showNotification(`👋 ${leftCollaborator} 离开了协作`, 'info');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            user_id: user.id,
            user_email: user.email,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, user?.id, supabase, showNotification]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [hasUnsavedChanges]);

  const isEmpty = unassignedGuests.length === 0 && tables.length === 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-white text-xl font-semibold">正在加载您的工作区...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white font-sans overflow-hidden">
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>

      <Notification notification={notification} onClose={hideNotification} />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => {
          if (confirmDialog.onCancel) {
            confirmDialog.onCancel();
          }
          hideConfirm();
        }}
        type={confirmDialog.type}
      />

      {isModalOpen && (
        <Modal
          onClose={() => {
            setIsModalOpen(null);
            if (isModalOpen === MODAL_TYPES.AI_SEATING) {
              setAiPlans([]);
              setSelectedPlanId(null);
            }
          }}
          size={isModalOpen === MODAL_TYPES.AI_SEATING && aiPlans.length > 0 ? 'lg' : 'md'}
        >
          {isModalOpen === MODAL_TYPES.NEW_PROJECT && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">创建新项目</h3>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="请输入项目名称"
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                aria-label="项目名称"
              />
              <button
                onClick={handleNewProject}
                className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
              >
                创建
              </button>
            </>
          )}

          {isModalOpen === MODAL_TYPES.ADD_GUEST && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">添加宾客</h3>
              <div className="flex justify-center mb-6 border-b border-gray-700">
                <button
                  onClick={() => setModalInputView('manual')}
                  className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'manual' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  手动输入
                </button>
                <button
                  onClick={() => setModalInputView('import')}
                  className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'import' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  从文件导入
                </button>
              </div>
              {modalInputView === 'manual' ? (
                <>
                  <textarea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="每行输入一位宾客姓名&#10;例如：&#10;张三&#10;李四&#10;王五"
                    className="w-full p-3 bg-gray-700 rounded-lg h-40 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 resize-none"
                    aria-label="宾客姓名列表"
                  />
                  <button
                    onClick={handleAddGuests}
                    className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
                  >
                    添加
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mb-4">支持 .txt, .csv, .xlsx 文件, 每行一个名称。</p>
                  <input
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls"
                    onChange={(e) => { if (e.target.files?.[0]) { parseFileAndAdd(e.target.files[0], 'guest'); } }}
                    className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-200 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer file:hover:bg-blue-500"
                  />
                </>
              )}
            </>
          )}

          {isModalOpen === MODAL_TYPES.ADD_TABLE && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">添加新桌</h3>
              <div className="flex justify-center mb-6 border-b border-gray-700">
                <button
                  onClick={() => setModalInputView('manual')}
                  className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'manual' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  手动输入
                </button>
                <button
                  onClick={() => setModalInputView('import')}
                  className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'import' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  从文件导入
                </button>
              </div>
              {modalInputView === 'manual' ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 font-medium mb-2 block">桌子名称</label>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder="例如：主桌, 1号桌"
                        className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                        aria-label="桌子名称"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 font-medium mb-2 block">容量 (人)</label>
                      <input
                        type="number"
                        value={inputCapacity}
                        onChange={e => setInputCapacity(e.target.value)}
                        placeholder="10"
                        min="1"
                        className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                        aria-label="桌子容量"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddTable}
                    className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
                  >
                    添加
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mb-4">支持 .txt, .csv, .xlsx 文件, 每行一个名称。</p>
                  <input
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls"
                    onChange={(e) => { if (e.target.files?.[0]) { parseFileAndAdd(e.target.files[0], 'table'); } }}
                    className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-200 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer file:hover:bg-blue-500"
                  />
                </>
              )}
            </>
          )}

          {isModalOpen === MODAL_TYPES.AI_SEATING && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">AI 智能排座</h3>

              {aiPlans.length === 0 ? (
                <>
                  <textarea
                    value={aiGuestList}
                    onChange={e => setAiGuestList(e.target.value)}
                    placeholder="在此粘贴您的完整宾客名单..."
                    className="w-full p-3 bg-gray-700 rounded-lg h-60 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 resize-none"
                    aria-label="宾客名单"
                  />
                  <button
                    onClick={handleAiSeating}
                    disabled={isAiLoading}
                    className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.primary} rounded-lg font-semibold hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:transform-none disabled:shadow-none`}
                  >
                    {isAiLoading ? "生成中..." : "开始生成"}
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-gray-300 mb-4">AI为您生成了 {aiPlans.length} 个不同的座位安排方案，请选择一个应用：</p>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {aiPlans.map((plan, index) => (
                        <div
                          key={plan.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            selectedPlanId === plan.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                          }`}
                          onClick={() => setSelectedPlanId(plan.id)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-white">{plan.name}</h4>
                            <span className="text-sm px-2 py-1 bg-green-500/20 text-green-400 rounded">
                              评分: {Math.round(plan.score)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{plan.analysis}</p>
                          <p className="text-xs text-gray-500">{plan.scenario}</p>
                          <div className="mt-2 text-xs text-gray-400">
                            共 {plan.tables.length} 桌，{plan.tables.reduce((sum: number, t: any) => sum + t.guests.length, 0)} 位宾客
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setAiPlans([]);
                        setSelectedPlanId(null);
                      }}
                      className="flex-1 p-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors"
                    >
                      重新生成
                    </button>
                    <button
                      onClick={handleApplySelectedPlan}
                      disabled={!selectedPlanId}
                      className={`flex-1 p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300`}
                    >
                      应用方案
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {isModalOpen === MODAL_TYPES.ADD_RULE && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">添加"不宜同桌"规则</h3>
              <div className='space-y-5'>
                <div>
                  <label className='text-sm text-gray-400 font-medium mb-2 block'>选择宾客 1</label>
                  <select
                    value={ruleGuests.g1}
                    onChange={e => setRuleGuests(g => ({...g, g1: e.target.value}))}
                    className="w-full p-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                    aria-label="选择第一位宾客"
                  >
                    <option value="">-- 请选择 --</option>
                    {allGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className='text-sm text-gray-400 font-medium mb-2 block'>选择宾客 2</label>
                  <select
                    value={ruleGuests.g2}
                    onChange={e => setRuleGuests(g => ({...g, g2: e.target.value}))}
                    className="w-full p-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                    aria-label="选择第二位宾客"
                  >
                    <option value="">-- 请选择 --</option>
                    {allGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddRule}
                className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
              >
                添加规则
              </button>
            </>
          )}

          {isModalOpen === MODAL_TYPES.CHECK_IN && currentProject && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">📱 现场签到模式</h3>
              
              <div className="space-y-6">
                <div className="bg-gray-700/50 p-6 rounded-xl border border-gray-600">
                  <p className="text-sm text-gray-300 mb-4">使用以下二维码或链接让宾客现场签到：</p>
                  
                  <div className="flex justify-center mb-6 bg-white p-4 rounded-lg">
                    <QRCodeSVG 
                      value={`${window.location.origin}/check-in/${currentProject.id}`}
                      size={200}
                      level="H"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm text-gray-400 font-medium block">签到链接</label>
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/check-in/${currentProject.id}`}
                      className="w-full p-3 bg-gray-800 rounded-lg border border-gray-600 text-gray-300 text-sm select-all"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    
                    <button
                      onClick={handleCopyCheckInLink}
                      className={`w-full p-3 bg-gradient-to-r ${theme.primary} rounded-lg font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
                    >
                      📋 复制链接
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    💡 <strong>提示：</strong>将此二维码打印出来放置在入口处，或将链接分享给宾客，他们即可通过手机完成签到。
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ✅ 新增：邀请协作者 Modal */}
          {isModalOpen === MODAL_TYPES.INVITE_COLLABORATOR && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                邀请协作者
              </h3>
              
              {currentProject && currentProject.user_id !== user?.id && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-200">
                    ⚠️ 只有项目所有者可以邀请协作者
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 font-medium mb-2 block">
                    协作者邮箱
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                    disabled={currentProject?.user_id !== user?.id}
                  />
                </div>
                
                {projectMembers.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-400 font-medium mb-2 block">
                      当前协作者
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {projectMembers.map(member => (
                        <div 
                          key={member.id}
                          className="flex justify-between items-center bg-gray-700 p-3 rounded-lg"
                        >
                          <div>
                            <p className="text-sm text-white">{member.email}</p>
                            <p className="text-xs text-gray-400">
                              {member.role === 'owner' ? '所有者' : member.role === 'editor' ? '编辑者' : '查看者'}
                            </p>
                          </div>
                          {currentProject?.user_id === user?.id && member.user_id !== user?.id && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.email)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleInviteCollaborator}
                  disabled={currentProject?.user_id !== user?.id}
                  className={`w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:transform-none`}
                >
                  发送邀请
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl transform transition-all duration-300">
            <h3 className="text-2xl font-bold mb-4 text-white">确认操作</h3>
            <p className="text-gray-300 mb-8">
              请选择对宾客 "<span className="font-semibold text-blue-400">{deleteConfirm.guestName}</span>" 的操作：
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => handleConfirmDelete('move')}
                className={`w-full px-4 py-3 bg-gradient-to-r ${theme.primary} hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
              >
                移动到未分配区
              </button>
              <button
                onClick={() => handleConfirmDelete('delete')}
                className={`w-full px-4 py-3 bg-gradient-to-r ${theme.danger} hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
              >
                彻底删除宾客
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all duration-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUnassignedConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl transform transition-all duration-300">
            <h3 className="text-2xl font-bold mb-4 text-white">确认删除</h3>
            <p className="text-gray-300 mb-8">
              您确定要永久删除宾客 "<span className="font-semibold text-blue-400">{deleteUnassignedConfirm.guestName}</span>" 吗？
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleConfirmDeleteUnassigned}
                className={`w-full px-4 py-3 bg-gradient-to-r ${theme.danger} hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
              >
                确认删除
              </button>
              <button
                onClick={() => setDeleteUnassignedConfirm(null)}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all duration-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative w-60 h-full bg-gradient-to-b from-gray-800 to-gray-900 p-5 flex flex-col border-r border-gray-700 shadow-xl z-40 transition-transform duration-300
      `}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">SmartSeat</h1>
          <div className="flex items-center gap-2">
            <LogoutButton />
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
              aria-label="关闭侧边栏"
            >
              ✕
            </button>
          </div>
        </div>
        <button
          data-testid="btn-new-project"
          onClick={() => { setInputValue(''); setIsModalOpen(MODAL_TYPES.NEW_PROJECT); }}
          className={`w-full mb-5 px-4 py-2.5 rounded-lg bg-gradient-to-r ${theme.success} hover:from-green-500 hover:to-green-400 text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
        >
          + 新建项目
        </button>
        <div className="flex-grow overflow-y-auto pr-2 space-y-1.5">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className={`group p-3 rounded-lg cursor-pointer transition-all duration-300 ${currentProject?.id === proj.id ? `bg-gradient-to-r ${theme.primary} shadow-md` : 'bg-gray-700 hover:bg-gray-600 shadow-sm hover:shadow-md'}`}
            >
              {editingProjectId === proj.id ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingProjectName}
                    onChange={e => setEditingProjectName(e.target.value)}
                    onBlur={() => handleSaveProjectName(proj.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveProjectName(proj.id);
                      if (e.key === 'Escape') setEditingProjectId(null);
                    }}
                    className="flex-1 bg-gray-600 text-white px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  onClick={() => handleLoadProject(proj)}
                  className="flex justify-between items-center"
                >
                  <div className="flex-1">
                    <p className="font-semibold truncate">{proj.name}</p>
                    {/* ✅ 显示项目类型标签 */}
                    {proj.user_id && proj.user_id !== user?.id && (
                      <p className="text-xs text-blue-300 mt-1">🤝 共享项目</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEditProjectName(proj.id, proj.name);
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-all duration-200"
                      aria-label={`编辑 ${proj.name}`}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                      className="text-red-400 hover:text-red-300 transition-all duration-200 hover:scale-110 transform"
                      aria-label={`删除项目 ${proj.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-400 mt-6 p-3 bg-gray-800 bg-opacity-50 rounded-lg">
          <p className="truncate">用户: {user?.email}</p>
        </div>
      </aside>

      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-gray-800 rounded-lg shadow-lg"
        aria-label="打开菜单"
      >
        ☰
      </button>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {currentProject && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={rectIntersection}
          >
              <div className="mb-5">
                <input
                  data-testid="project-name"
                  type="text"
                  value={currentProject.name}
                  onChange={(e) => {
                    setCurrentProject(p => p ? {...p, name: e.target.value} : null);
                    markChanges();
                  }}
                  className="text-2xl md:text-3xl font-bold bg-transparent focus:outline-none focus:bg-gray-800 focus:bg-opacity-30 rounded-lg px-3 py-2 w-full transition-all duration-200 border-2 border-transparent focus:border-blue-500"
                  aria-label="项目名称"
                />
            </div>

            {isEmpty ? (
              <EmptyState
                onAddGuest={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen(MODAL_TYPES.ADD_GUEST); }}
                onAiSeating={() => { setAiGuestList(unassignedGuests.map(g => g.name).join('\n')); setIsModalOpen(MODAL_TYPES.AI_SEATING); }}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 md:gap-6">
                <div className="lg:col-span-1">
                  <div className={`bg-gradient-to-br ${theme.cardBg} rounded-xl p-5 border border-gray-700 shadow-lg flex flex-col`}>
                    <h3 className="font-bold text-lg mb-3 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      未分配宾客 ({unassignedGuests.length})
                    </h3>

                    <div className="mb-3 space-y-2.5">
                      <input
                        type="text"
                        placeholder="🔍 搜索宾客..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                      />
                      <div className="flex justify-between gap-1 text-xs">
                        {(['all', 'unconfirmed', 'confirmed', 'cancelled'] as const).map(status => (
                          <button
                            key={status}
                            onClick={() => setActiveStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-md font-semibold transition-all duration-200 flex-1 ${
                              activeStatusFilter === status
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            {{
                              all: '全部',
                              unconfirmed: '未确认',
                              confirmed: '已确认',
                              cancelled: '已取消',
                            }[status]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                      <SortableContext
                        id="unassigned-area"
                        items={unassignedGuests.map(g => g.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableContainer
                          id="unassigned-area"
                          className="min-h-[120px] rounded-xl"
                          isDraggingOver={!!activeGuest}
                        >
                          <div data-testid="unassigned-list" className="space-y-3">
                            {filteredUnassignedGuests.length === 0 && (
                              <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-600 rounded-xl bg-gray-800 bg-opacity-30">
                                {unassignedGuests.length > 0 ? '没有匹配的宾客' : '将宾客拖到此处或点击右侧添加'}
                              </div>
                            )}
                            {filteredUnassignedGuests.map(guest => {
                              const hasRule = currentProject.layout_data?.rules?.notTogether.some(
                                rule => rule.includes(guest.id)
                              ) || false;
                              return (
                                <DraggableGuest
                                  key={guest.id}
                                  guest={guest}
                                  hasRule={hasRule}
                                  onDelete={(guestId) => handleDeleteGuest(guestId)}
                                  onStatusChange={handleGuestStatusChange}
                                />
                              );
                            })}
                          </div>
                        </DroppableContainer>
                      </SortableContext>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tables.map(table => {
                      const fillRate = table.capacity ? (table.guests.length / table.capacity) * 100 : 0;
                      const isFull = table.guests.length >= table.capacity;

                      return (
                        <div
                          key={table.id}
                          data-testid="table-card"
                          className={`bg-gradient-to-br ${theme.cardBg} p-5 rounded-xl flex flex-col border-2 transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl ${
                            isFull ? 'border-red-500 shadow-red-500/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="mb-3">
                            <div className="group flex justify-between items-center mb-2.5 pb-2.5 border-b border-gray-700">
                              <input
                                type="text"
                                value={table.tableName}
                                onChange={(e) => {
                                  const updatedTables = tables.map(t =>
                                    t.id === table.id ? {...t, tableName: e.target.value} : t
                                  );
                                  setTables(updatedTables);
                                  broadcastLayoutChange(updatedTables, unassignedGuests);
                                  markChanges();
                                }}
                                  className="font-bold text-base bg-transparent w-full focus:outline-none focus:bg-gray-700 focus:bg-opacity-30 rounded px-2 py-1 transition-all duration-200"
                                aria-label={`桌子名称: ${table.tableName}`}
                              />
                              <button
                                onClick={() => handleDeleteTable(table.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all duration-200 ml-2"
                                aria-label={`删除 ${table.tableName}`}
                              >
                                🗑️
                              </button>
                            </div>

                            <div className="w-full bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  fillRate >= 100 ? 'bg-red-500' :
                                  fillRate >= 80 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(fillRate, 100)}%` }}
                              />
                            </div>

                            <div className='flex items-center justify-between text-sm'>
                              <span className={`font-semibold ${isFull ? 'text-red-400' : 'text-gray-400'}`}>
                                {table.guests.length} /
                                <input
                                  type="number"
                                  value={table.capacity}
                                  onChange={(e) => {
                                    const newCapacity = parseInt(e.target.value) || 0;
                                    const updatedTables = tables.map(t =>
                                      t.id === table.id ? { ...t, capacity: newCapacity } : t
                                    );
                                    setTables(updatedTables);
                                    broadcastLayoutChange(updatedTables, unassignedGuests);
                                    markChanges();
                                  }}
                                  className="w-11 bg-transparent text-center focus:outline-none focus:bg-gray-700 focus:bg-opacity-30 rounded px-1 ml-1"
                                  min="1"
                                  aria-label="桌子容量"
                                /> 人
                              </span>
                              <span className="text-gray-500 text-xs">
                                {fillRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          <SortableContext
                            id={table.id}
                            items={table.guests.map(g => g.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <DroppableContainer
                              id={table.id}
                              className="flex-grow rounded-lg min-h-[54px]"
                              isDraggingOver={!!activeGuest}
                            >
                              <div className="space-y-2.5">
                                {table.guests.length === 0 && (
                                  <div className="text-center text-gray-400 text-sm py-5 border-2 border-dashed border-gray-600 rounded-lg bg-gray-800 bg-opacity-30 transition-all duration-200 hover:border-gray-500">
                                    将宾客拖到此处
                                  </div>
                                )}
                                {table.guests.map(guest => {
                                  const hasRule = currentProject.layout_data?.rules?.notTogether.some(
                                    rule => rule.includes(guest.id)
                                  ) || false;
                                  return (
                                    <DraggableGuest
                                      key={guest.id}
                                      guest={guest}
                                      hasRule={hasRule}
                                      onDelete={(guestId) => handleRemoveGuestFromTable(guestId, table.id)}
                                      onStatusChange={handleGuestStatusChange}
                                      tableId={table.id}
                                    />
                                  );
                                })}
                              </div>
                            </DroppableContainer>
                          </SortableContext>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <DragOverlay>
              {activeGuest ? (
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white shadow-2xl cursor-grabbing text-sm flex items-center border-2 border-blue-300 transform scale-110">
                  <div className="w-8 h-8 rounded-full bg-blue-300 flex-shrink-0 mr-3 flex items-center justify-center font-bold shadow-inner">
                    {activeGuest.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold">{activeGuest.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <aside className={`
        ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        fixed lg:relative lg:translate-x-0 w-80 h-full bg-gradient-to-b from-gray-800 to-gray-900 p-6 flex flex-col gap-y-4 border-l border-gray-700 shadow-2xl z-30 transition-transform duration-300 overflow-y-auto
      `}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            控制面板
          </h3>
          <button
            onClick={() => setRightPanelOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
            aria-label="关闭控制面板"
          >
            ✕
          </button>
        </div>

        {activeCollaborators.length > 0 && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-blue-300">正在协作</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              {activeCollaborators.map((email, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  <span>{email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          data-testid="btn-save-project"
          onClick={handleSaveProject}
          disabled={isSaving || !hasUnsavedChanges}
          className="w-full p-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-semibold transition-all duration-300 transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none shadow-md hover:shadow-lg disabled:shadow-none"
          aria-label={hasUnsavedChanges ? '保存更改' : '全部已保存'}
        >
          {isSaving ? '保存中...' : (hasUnsavedChanges ? '💾 保存更改*' : '💾 全部已保存')}
        </button>

        <label className="flex items-center gap-3 text-sm text-gray-300 select-none p-2.5 bg-gray-800 bg-opacity-50 rounded-lg hover:bg-opacity-70 transition-all duration-200 cursor-pointer">
          <input
            data-testid="toggle-autosave"
            type="checkbox"
            className="accent-indigo-500 w-4 h-4 cursor-pointer"
            checked={autoSaveEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              setAutoSaveEnabled(enabled);
              if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
              }
              if (enabled && hasUnsavedChanges && !isSaving) {
                autoSaveTimeout.current = setTimeout(() => { handleSaveProject(); }, 800);
              }
            }}
            aria-label="自动保存开关"
          />
          <span className="font-medium">自动保存</span>
        </label>

        <hr className="border-gray-700 my-2" />

        <h3 className="text-base font-bold text-gray-200">快捷操作</h3>

        <button
          data-testid="btn-add-guest"
          onClick={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen(MODAL_TYPES.ADD_GUEST); }}
          className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
        >
          添加宾客
        </button>

        <button
          data-testid="btn-add-table"
          onClick={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen(MODAL_TYPES.ADD_TABLE); }}
          className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
        >
          添加新桌
        </button>

        <button
          data-testid="btn-ai-seating"
          onClick={() => { setAiGuestList(unassignedGuests.map(g => g.name).join('\n')); setIsModalOpen(MODAL_TYPES.AI_SEATING); }}
          className={`w-full p-2.5 rounded-lg bg-gradient-to-r ${theme.primary} hover:from-blue-500 hover:to-blue-400 font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
        >
          🤖 AI 智能排座
        </button>

        <button
          data-testid="btn-check-in"
          onClick={() => setIsModalOpen(MODAL_TYPES.CHECK_IN)}
          className={`w-full p-2.5 rounded-lg bg-gradient-to-r ${theme.warning} hover:from-yellow-500 hover:to-yellow-400 font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
        >
          📱 现场签到模式
        </button>

        {/* ✅ 新增：邀请协作者按钮 */}
        <button
          onClick={() => {
            setInviteEmail('');
            setIsModalOpen(MODAL_TYPES.INVITE_COLLABORATOR);
          }}
          className={`w-full p-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
        >
          👥 邀请协作者
        </button>

        <button
          data-testid="btn-export-pdf"
          onClick={handleExportPdf}
          className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
        >
          导出为 PDF
        </button>

        <button
          data-testid="btn-export-place-cards"
          onClick={handleExportPlaceCards}
          className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
        >
          📇 生成桌卡
        </button>

        <div className={`p-4 bg-gradient-to-br ${theme.cardBg} rounded-lg text-sm space-y-2.5 border border-gray-700 shadow-md`}>
          <h4 className="font-bold text-md mb-3 text-gray-200">关系规则</h4>
          <div className='max-h-28 overflow-y-auto space-y-2 pr-2'>
            {(currentProject?.layout_data?.rules?.notTogether || []).map((rule, index) => (
              <div
                key={`${rule[0]}-${rule[1]}`}
                className="flex justify-between items-center bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-all duration-200"
              >
                <span className="text-xs truncate">
                  {guestNameMap.get(rule[0])} ↔ {guestNameMap.get(rule[1])}
                </span>
                <button
                  onClick={() => handleDeleteRule(rule)}
                  className="text-red-400 hover:text-red-300 transition-all duration-200"
                  aria-label={`删除规则: ${guestNameMap.get(rule[0])} 和 ${guestNameMap.get(rule[1])}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {(currentProject?.layout_data?.rules?.notTogether || []).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">暂无规则</p>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(MODAL_TYPES.ADD_RULE)}
            className={`w-full mt-3 p-2 text-xs rounded-lg bg-gradient-to-r ${theme.primary} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
          >
            + 添加规则
          </button>
        </div>

        <div className="flex-grow"></div>

        <div className={`p-4 bg-gradient-to-br ${theme.cardBg} rounded-lg text-sm space-y-2.5 border border-gray-700 shadow-md`}>
          <h4 className="font-bold text-md mb-3 text-gray-200">数据统计</h4>

          <StatsChart stats={stats} />

          <hr className="border-gray-700 my-3" />

          <div className="space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>宾客总数:</span>
              <span className="font-semibold">{stats.totalGuests}</span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>已确认:</span>
              <span className="font-semibold">{stats.confirmedCount}</span>
            </div>
            <div className="flex justify-between text-yellow-400">
              <span>未确认:</span>
              <span className="font-semibold">{stats.unconfirmedCount}</span>
            </div>
            <div className="flex justify-between text-red-400">
              <span>已取消:</span>
              <span className="font-semibold">{stats.cancelledCount}</span>
            </div>
            <hr className="border-gray-700 my-2" />
            <div className="flex justify-between text-gray-300">
              <span>桌子总数:</span>
              <span className="font-semibold">{stats.tableCount}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>已安排宾客:</span>
              <span className="font-semibold">{stats.assignedGuestsCount}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>平均每桌:</span>
              <span className="font-semibold">{stats.avgGuestsPerTable}</span>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setRightPanelOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-20 p-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full shadow-lg"
        aria-label="打开控制面板"
      >
        ⚙️
      </button>
    </div>
  );
}
