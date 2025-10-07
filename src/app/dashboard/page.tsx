'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { DndContext, rectIntersection, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// 主题的配置
const theme = {
  primary: 'from-blue-600 to-blue-500',
  success: 'from-green-600 to-green-500',
  danger: 'from-red-600 to-red-500',
  warning: 'from-yellow-600 to-yellow-500',
  cardBg: 'from-gray-800 to-gray-900',
};

// --- 数据结构 ---
type GuestStatus = 'confirmed' | 'unconfirmed' | 'cancelled';

interface Guest {
  id: string;
  name: string;
  status?: GuestStatus;
  avatarUrl?: string;
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
  layout_data: {
    tables: SeatingTable[];
    unassignedGuests: Guest[];
    rules?: {
      notTogether: NotTogetherRule[]; 
    };
  } | null;
}

const statusColors: { [key in GuestStatus]: string } = {
  confirmed: 'bg-green-500',
  unconfirmed: 'bg-yellow-500',
  cancelled: 'bg-red-500',
};

const statusTooltips: { [key in GuestStatus]: string } = {
  confirmed: '已确认',
  unconfirmed: '未确认',
  cancelled: '已取消',
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
  notification: { type: 'success' | 'error', message: string } | null;
  onClose: () => void;
}) => {
  if (!notification) return null;
  
  return (
    <div className="fixed top-6 right-6 max-w-md z-50 animate-slideIn">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            notification.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <span className="text-xl">{notification.type === 'success' ? '✓' : '✕'}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold mb-1 text-white">
              {notification.type === 'success' ? '成功' : '错误'}
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
      className="group relative p-3 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl text-white cursor-grab active:cursor-grabbing shadow-md hover:shadow-xl flex items-center transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-0.5 border border-gray-600 hover:border-gray-500"
    >
      {hasRule && (
        <div 
          className="absolute -top-2 -left-2 w-5 h-5 bg-yellow-400 text-black text-xs font-bold flex items-center justify-center rounded-full border-2 border-gray-800 shadow-lg animate-pulse" 
          title="此宾客存在特殊规则"
          aria-label="存在特殊规则"
        >
          !
        </div>
      )}
      
      <div className="relative flex-shrink-0 mr-3">
        {guest.avatarUrl ? (
          <img 
            src={guest.avatarUrl} 
            alt={guest.name}
            className="w-9 h-9 rounded-full object-cover shadow-inner transition-transform duration-200 group-hover:scale-110" 
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center font-bold text-sm shadow-inner transition-transform duration-200 group-hover:scale-110">
            {guest.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div 
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-800 ${statusColors[guest.status || 'unconfirmed']}`}
          title={statusTooltips[guest.status || 'unconfirmed']}
        />
      </div>

      <span className="flex-grow truncate text-sm font-medium">{guest.name}</span>

      <button
        onClick={handleStatusClick}
        className="mr-2 p-1 hover:bg-gray-600 rounded transition-all duration-200"
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

const Modal = ({ children, onClose }: { children: React.ReactNode, onClose: () => void }) => (
  <div 
    className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn p-4" 
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div 
      className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 transform transition-all duration-300" 
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

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
                key={idx}
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
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<'newProject' | 'addGuest' | 'addTable' | 'aiSeating' | 'addRule' | null>(null);
  const [modalInputView, setModalInputView] = useState<'manual' | 'import'>('manual');
  const [inputValue, setInputValue] = useState('');
  const [inputCapacity, setInputCapacity] = useState('10');
  const [aiGuestList, setAiGuestList] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ guestId: string; tableId: string; guestName: string } | null>(null);
  const [deleteUnassignedConfirm, setDeleteUnassignedConfirm] = useState<{ guestId: string; guestName: string } | null>(null);
  const [ruleGuests, setRuleGuests] = useState<{ g1: string, g2: string }>({ g1: '', g2: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'warning' | 'danger' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const allGuests = useMemo(() => [...unassignedGuests, ...tables.flatMap(t => t.guests)], [unassignedGuests, tables]);
  const guestNameMap = useMemo(() => new Map(allGuests.map(g => [g.id, g.name])), [allGuests]);

  const stats = useMemo(() => {
    const assignedGuestsCount = tables.reduce((sum, table) => sum + table.guests.length, 0);
    const totalGuests = allGuests.length;
    const tableCount = tables.length;
    const avgGuestsPerTable = tableCount > 0 ? (assignedGuestsCount / tableCount).toFixed(1) : 0;
    
    const confirmedCount = allGuests.filter(g => g.status === 'confirmed').length;
    const unconfirmedCount = allGuests.filter(g => g.status === 'unconfirmed' || g.status === undefined).length;
    const cancelledCount = allGuests.filter(g => g.status === 'cancelled').length;
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
      assignedGuestsCount,
      tableFillRate,
    };
  }, [tables, allGuests]);
  
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      },
      type
    });
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
  }, [currentProject, user, hasUnsavedChanges, tables, unassignedGuests, projects, isSaving, supabase]);

  const markChanges = useCallback(() => {
    setHasUnsavedChanges(true);
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    if (autoSaveEnabled) {
      autoSaveTimeout.current = setTimeout(() => {
        handleSaveProject();
      }, 1000);
    }
  }, [handleSaveProject, autoSaveEnabled]);
  
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
        'warning'
      );
      return;
    }
    
    loadProjectData(project);
  }, [hasUnsavedChanges, handleSaveProject, currentProject]);

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

  const fetchProjectsAndLoadFirst = useCallback(async (userToFetch: User) => {
    const { data, error } = await supabase.from('projects').select('id, name, layout_data').eq('user_id', userToFetch.id).order('created_at', { ascending: false });
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
  }, [supabase]);

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
    const newProj: Project = { id: tempId, name: inputValue, layout_data: { tables: [], unassignedGuests: [], rules: { notTogether: [] } } };
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
          setUnassignedGuests(g => [...g, ...newGuests]);
        } else {
          const newTables: SeatingTable[] = names.map(name => ({ id: uuidv4(), tableName: name, guests: [], capacity: parseInt(inputCapacity) || 10 }));
          setTables(t => [...t, ...newTables]);
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
    setUnassignedGuests([...unassignedGuests, ...newGuests]);
    setIsModalOpen(null); setInputValue(''); markChanges();
  };

  const handleAddTable = () => {
    if (!inputValue.trim()) { showNotification('桌子名称不能为空', 'error'); return; }
    const capacity = parseInt(inputCapacity);
    if (isNaN(capacity) || capacity < 1) { showNotification('容量必须是大于0的数字', 'error'); return; }
    const newTable: SeatingTable = { id: uuidv4(), tableName: inputValue, guests: [], capacity };
    setTables([...tables, newTable]);
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
    setUnassignedGuests(prev => prev.filter(g => g.id !== guestId));
    setTables(prev => prev.map(t => ({...t, guests: t.guests.filter(g => g.id !== guestId)})));
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
      setTables(prev => prev.map(t => 
        t.id === tableId 
          ? {...t, guests: t.guests.filter(g => g.id !== guestId)}
          : t
      ));
      setUnassignedGuests(prev => [...prev, guest]);
      showNotification('宾客已移动到未分配区');
    } else {
      setTables(prev => prev.map(t => ({...t, guests: t.guests.filter(g => g.id !== guestId)})));
      showNotification('宾客已彻底删除');
    }
    setDeleteConfirm(null);
    markChanges();
  };
    
  const handleGuestStatusChange = (guestId: string, newStatus: GuestStatus) => {
    const updateUser = (users: Guest[]) => users.map(g => g.id === guestId ? { ...g, status: newStatus } : g);
    setUnassignedGuests(updateUser);
    setTables(prevTables => prevTables.map(t => ({
      ...t,
      guests: updateUser(t.guests)
    })));
    markChanges();
  };

  const handleDeleteTable = (tableId: string) => {
    showConfirm(
      '确认删除',
      '您确定要删除这张桌子吗？桌上所有宾客将移至未分配区。',
      () => {
        const tableToMove = tables.find(t => t.id === tableId);
        if (tableToMove) setUnassignedGuests([...unassignedGuests, ...tableToMove.guests]);
        setTables(tables.filter(t => t.id !== tableId));
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
    markChanges();
  };

  const handleAiSeating = async () => {
    if (!aiGuestList.trim()) { showNotification('宾客名单不能为空', 'error'); return; }
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/generate-seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestList: aiGuestList }),
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || 'AI 服务出错');
      
      const aiTables: SeatingTable[] = result.tables.map((t: any) => ({
        id: uuidv4(),
        tableName: t.tableName,
        guests: t.guests.map((gName: string) => ({ id: uuidv4(), name: gName, status: 'unconfirmed' })),
        capacity: 10,
      }));
      setTables(aiTables);
      setUnassignedGuests([]);
      showNotification('AI 智能排座已完成！');
      markChanges();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
    setIsAiLoading(false);
    setIsModalOpen(null);
  };
  
  const handleExportPdf = () => {
    if (!currentProject) { 
      showNotification('请先选择一个项目', 'error'); 
      return; 
    }
    
    showNotification('正在生成PDF，请稍候...');
    
    try {
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              margin: 20px; 
              font-size: 14px;
            }
            h1 { 
              text-align: center; 
              color: #333; 
              margin-bottom: 10px;
              font-size: 24px;
            }
            .timestamp { 
              text-align: center; 
              color: #666; 
              margin-bottom: 30px;
              font-size: 12px;
            }
            h2 { 
              color: #444; 
              border-bottom: 2px solid #ddd; 
              padding-bottom: 5px;
              margin-top: 25px;
            }
            .table-section { 
              margin-bottom: 20px; 
              page-break-inside: avoid;
            }
            .table-title { 
              font-weight: bold; 
              font-size: 16px; 
              color: #333;
              margin-bottom: 8px;
            }
            .guest-list { 
              margin-left: 20px; 
            }
            .guest-item { 
              margin: 3px 0; 
            }
            .stats { 
              margin-top: 30px; 
              border-top: 2px solid #ddd; 
              padding-top: 15px;
            }
            .stats h2 { 
              border: none; 
              margin-top: 0; 
            }
            .stat-item { 
              margin: 5px 0; 
              margin-left: 20px;
            }
            @media print {
              body { margin: 0; }
              .table-section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${currentProject.name}</h1>
          <div class="timestamp">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
          
          <h2>座位安排详情</h2>
      `;
      
      tables.forEach((table) => {
        htmlContent += `
          <div class="table-section">
            <div class="table-title">${table.tableName} (${table.guests.length}人)</div>
            <div class="guest-list">
        `;
        
        if (table.guests.length > 0) {
          table.guests.forEach((guest, index) => {
            htmlContent += `<div class="guest-item">${index + 1}. ${guest.name}</div>`;
          });
        } else {
          htmlContent += `<div class="guest-item">(暂无宾客)</div>`;
        }
        
        htmlContent += `
            </div>
          </div>
        `;
      });
      
      if (unassignedGuests.length > 0) {
        htmlContent += `
          <div class="table-section">
            <div class="table-title">未分配宾客 (${unassignedGuests.length}人)</div>
            <div class="guest-list">
        `;
        
        unassignedGuests.forEach((guest, index) => {
          htmlContent += `<div class="guest-item">${index + 1}. ${guest.name}</div>`;
        });
        
        htmlContent += `
            </div>
          </div>
        `;
      }
      
      const totalGuests = tables.reduce((sum, table) => sum + table.guests.length, 0) + unassignedGuests.length;
      const assignedGuests = tables.reduce((sum, table) => sum + table.guests.length, 0);
      
      htmlContent += `
          <div class="stats">
            <h2>统计信息</h2>
            <div class="stat-item">总桌数: ${tables.length}</div>
            <div class="stat-item">总宾客数: ${totalGuests}</div>
            <div class="stat-item">已安排宾客: ${assignedGuests}</div>
            <div class="stat-item">未安排宾客: ${unassignedGuests.length}</div>
          </div>
        </body>
        </html>
      `;
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '794px';
      iframe.style.height = '1123px';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('无法创建PDF渲染环境');
      }
      
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      setTimeout(() => {
        html2canvas(iframeDoc.body, { 
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123
        }).then(canvas => {
          try {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'px', [794, 1123]);
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            if (imgHeight > pdfHeight) {
              let remainingHeight = imgHeight;
              let yOffset = 0;
              
              while (remainingHeight > 0) {
                const pageHeight = Math.min(remainingHeight, pdfHeight);
                
                if (yOffset > 0) {
                  pdf.addPage();
                }
                
                const cropCanvas = document.createElement('canvas');
                const cropCtx = cropCanvas.getContext('2d');
                cropCanvas.width = imgWidth;
                cropCanvas.height = pageHeight;
                
                if (cropCtx) {
                  cropCtx.drawImage(canvas, 0, -yOffset);
                  const cropImgData = cropCanvas.toDataURL('image/png');
                  pdf.addImage(cropImgData, 'PNG', 0, 0, pdfWidth, pageHeight);
                }
                
                yOffset += pageHeight;
                remainingHeight -= pageHeight;
              }
            } else {
              pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            }
            
            pdf.save(`${currentProject.name}_座位安排.pdf`);
            showNotification('PDF导出成功！');
            
            document.body.removeChild(iframe);
            
          } catch (e) {
            console.error('PDF生成错误:', e);
            showNotification('导出PDF失败，请重试', 'error');
            document.body.removeChild(iframe);
          }
        }).catch(error => {
          console.error('截图失败:', error);
          showNotification('导出PDF失败，请重试', 'error');
          document.body.removeChild(iframe);
        });
      }, 1000);
      
    } catch (error) {
      console.error('PDF导出错误:', error);
      showNotification('导出PDF失败，请重试', 'error');
    }
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

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGuest(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    
    const originalContainerId = findContainer(activeId);
    const overContainerId = findContainer(overId);

    if (!originalContainerId || !overContainerId) return;

    if (originalContainerId === overContainerId) {
      if (activeId === overId) return;
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

      let draggedGuest: Guest | undefined;
      let nextUnassigned = [...unassignedGuests];
      let nextTables = JSON.parse(JSON.stringify(tables));

      if (originalContainerId === 'unassigned-area') {
        const index = nextUnassigned.findIndex(g => g.id === activeId);
        [draggedGuest] = nextUnassigned.splice(index, 1);
      } else {
        const table = nextTables.find((t: SeatingTable) => t.id === originalContainerId);
        if (table) {
          const index = table.guests.findIndex((g: Guest) => g.id === activeId);
          [draggedGuest] = table.guests.splice(index, 1);
        }
      }

      if (!draggedGuest) return;

      if (overContainerId === 'unassigned-area') {
        const overGuestIndex = nextUnassigned.findIndex(g => g.id === overId);
        if (overGuestIndex !== -1) {
          nextUnassigned.splice(overGuestIndex, 0, draggedGuest);
        } else {
          nextUnassigned.push(draggedGuest);
        }
      } else {
        const table = nextTables.find((t: SeatingTable) => t.id === overContainerId);
        if(table) {
          const overGuestIndex = table.guests.findIndex((g: Guest) => g.id === overId);
          if (overGuestIndex !== -1) {
            table.guests.splice(overGuestIndex, 0, draggedGuest);
          } else {
            table.guests.push(draggedGuest);
          }
        }
      }
      setUnassignedGuests(nextUnassigned);
      setTables(nextTables);
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

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          // 用户登出时，清除本地状态并跳转到首页
          setUser(null);
          setProjects([]);
          setCurrentProject(null);
          setTables([]);
          setUnassignedGuests([]);
          router.push('/');
        } else if (event === 'SIGNED_IN' && session?.user) {
          // 用户登录时，更新用户信息
          setUser(session.user);
          fetchProjectsAndLoadFirst(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, fetchProjectsAndLoadFirst, supabase.auth]);

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

      <Notification notification={notification} onClose={() => setNotification(null)} />
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
        type={confirmDialog.type}
      />

      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(null)}>
          {isModalOpen === 'newProject' && (
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
          
          {isModalOpen === 'addGuest' && (
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
          
          {isModalOpen === 'addTable' && (
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

          {isModalOpen === 'aiSeating' && (
            <>
              <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">AI 智能排座</h3>
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
          )}

          {isModalOpen === 'addRule' && (
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

      {/* 左侧边栏 */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative w-72 h-full bg-gradient-to-b from-gray-800 to-gray-900 p-6 flex flex-col border-r border-gray-700 shadow-2xl z-40 transition-transform duration-300
      `}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">SmartSeat</h1>
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
          onClick={() => { setInputValue(''); setIsModalOpen('newProject'); }} 
          className={`w-full mb-6 px-4 py-3 rounded-xl bg-gradient-to-r ${theme.success} hover:from-green-500 hover:to-green-400 text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
        >
          + 新建项目
        </button>
        <div className="flex-grow overflow-y-auto pr-2 space-y-2">
          {projects.map((proj) => (
            <div 
              key={proj.id}
              className={`group p-4 rounded-xl cursor-pointer transition-all duration-300 ${currentProject?.id === proj.id ? `bg-gradient-to-r ${theme.primary} shadow-lg` : 'bg-gray-700 hover:bg-gray-600 shadow-md hover:shadow-lg'}`}
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
                  <p className="font-semibold truncate flex-1">{proj.name}</p>
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

      {/* 汉堡菜单按钮 */}
      <button 
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-gray-800 rounded-lg shadow-lg"
        aria-label="打开菜单"
      >
        ☰
      </button>

      {/* 主内容区 */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {currentProject && (
          <DndContext 
            sensors={sensors} 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd} 
            collisionDetection={rectIntersection}
          >
            <div className="mb-6">
              <input 
                data-testid="project-name" 
                type="text" 
                value={currentProject.name} 
                onChange={(e) => { 
                  setCurrentProject(p => p ? {...p, name: e.target.value} : null); 
                  markChanges(); 
                }} 
                className="text-3xl md:text-4xl font-bold bg-transparent focus:outline-none focus:bg-gray-800 focus:bg-opacity-30 rounded-xl px-4 py-2 w-full transition-all duration-200 border-2 border-transparent focus:border-blue-500"
                aria-label="项目名称"
              />
            </div>

            {isEmpty ? (
              <EmptyState 
                onAddGuest={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen('addGuest'); }}
                onAiSeating={() => { setAiGuestList(unassignedGuests.map(g => g.name).join('\n')); setIsModalOpen('aiSeating'); }}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
                {/* 未分配区域 */}
                <div className="lg:col-span-1">
                  <div className={`bg-gradient-to-br ${theme.cardBg} rounded-2xl p-6 border border-gray-700 shadow-xl`}>
                    <h3 className="font-bold text-xl mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      未分配宾客 ({unassignedGuests.length})
                    </h3>
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
                          {unassignedGuests.length === 0 && (
                            <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-600 rounded-xl bg-gray-800 bg-opacity-30 transition-all duration-200 hover:border-gray-500">
                              将宾客拖到此处或点击右侧添加
                            </div>
                          )}
                          {unassignedGuests.map(guest => {
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

                {/* 桌子区域 */}
                <div className="lg:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {tables.map(table => {
                      const fillRate = table.capacity ? (table.guests.length / table.capacity) * 100 : 0;
                      const isFull = table.guests.length >= table.capacity;
                      
                      return (
                        <div 
                          key={table.id} 
                          data-testid="table-card" 
                          className={`bg-gradient-to-br ${theme.cardBg} p-6 rounded-2xl flex flex-col border-2 transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl ${
                            isFull ? 'border-red-500 shadow-red-500/20' : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="mb-4">
                            <div className="group flex justify-between items-center mb-3 pb-3 border-b border-gray-700">
                              <input 
                                type="text" 
                                value={table.tableName} 
                                onChange={(e) => { 
                                  setTables(tables.map(t => 
                                    t.id === table.id ? {...t, tableName: e.target.value} : t
                                  )); 
                                  markChanges(); 
                                }} 
                                className="font-bold text-lg bg-transparent w-full focus:outline-none focus:bg-gray-700 focus:bg-opacity-30 rounded px-2 py-1 transition-all duration-200"
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
                            
                            {/* 填充率进度条 */}
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
                                    setTables(tables.map(t => 
                                      t.id === table.id ? { ...t, capacity: newCapacity } : t
                                    ));
                                    markChanges();
                                  }}
                                  className="w-12 bg-transparent text-center focus:outline-none focus:bg-gray-700 focus:bg-opacity-30 rounded px-1 ml-1"
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
                              className="flex-grow rounded-xl min-h-[60px]"
                              isDraggingOver={!!activeGuest}
                            >
                              <div className="space-y-3">
                                {table.guests.length === 0 && (
                                  <div className="text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-600 rounded-xl bg-gray-800 bg-opacity-30 transition-all duration-200 hover:border-gray-500">
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

      {/* 右侧控制面板 */}
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
        
        <button 
          data-testid="btn-save-project" 
          onClick={handleSaveProject} 
          disabled={isSaving || !hasUnsavedChanges} 
          className="w-full p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-semibold transition-all duration-300 transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl disabled:shadow-none"
          aria-label={hasUnsavedChanges ? '保存更改' : '全部已保存'}
        >
          {isSaving ? '保存中...' : (hasUnsavedChanges ? '💾 保存更改*' : '💾 全部已保存')}
        </button>
        
        <label className="flex items-center gap-3 text-sm text-gray-300 select-none p-3 bg-gray-800 bg-opacity-50 rounded-xl hover:bg-opacity-70 transition-all duration-200 cursor-pointer">
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
        
        <h3 className="text-lg font-bold text-gray-200">快捷操作</h3>
        
        <button 
          data-testid="btn-add-guest" 
          onClick={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen('addGuest'); }} 
          className="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
        >
          添加宾客
        </button>
        
        <button 
          data-testid="btn-add-table" 
          onClick={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen('addTable'); }} 
          className="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
        >
          添加新桌
        </button>
        
        <button 
          data-testid="btn-ai-seating" 
          onClick={() => { setAiGuestList(unassignedGuests.map(g => g.name).join('\n')); setIsModalOpen('aiSeating'); }} 
          className={`w-full p-3 rounded-xl bg-gradient-to-r ${theme.primary} hover:from-blue-500 hover:to-blue-400 font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
        >
          🤖 AI 智能排座
        </button>
        
        <button 
          data-testid="btn-export-pdf" 
          onClick={handleExportPdf} 
          className="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
        >
          导出为 PDF
        </button>

        <div className={`p-5 bg-gradient-to-br ${theme.cardBg} rounded-xl text-sm space-y-3 border border-gray-700 shadow-lg`}>
          <h4 className="font-bold text-md mb-3 text-gray-200">关系规则</h4>
          <div className='max-h-28 overflow-y-auto space-y-2 pr-2'>
            {(currentProject?.layout_data?.rules?.notTogether || []).map((rule, index) => (
              <div 
                key={index} 
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
            onClick={() => setIsModalOpen('addRule')} 
            className={`w-full mt-3 p-2 text-xs rounded-lg bg-gradient-to-r ${theme.primary} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
          >
            + 添加规则
          </button>
        </div>

        <div className="flex-grow"></div>

        <div className={`p-5 bg-gradient-to-br ${theme.cardBg} rounded-xl text-sm space-y-3 border border-gray-700 shadow-lg`}>
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

      {/* 控制面板切换按钮 (移动端) */}
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
