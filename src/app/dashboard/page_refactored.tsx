'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { DndContext, rectIntersection, DragStartEvent, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';

// Zustand Store
import { useSeatingStore } from '@/store/seatingStore';

// Custom Hooks
import { useNotifications } from '@/hooks/useNotifications';

// Components
import { UnassignedGuestsPanel } from '@/components/dashboard/UnassignedGuestsPanel';
import { TablesGrid } from '@/components/dashboard/TablesGrid';
import { ControlPanel } from '@/components/dashboard/ControlPanel';

// Types
import type { Guest, SeatingTable, Project } from '@/components/dashboard/types';

/**
 * Dashboard Page - 重构后的精简版本
 * 
 * 职责:
 * 1. 用户认证和初始化
 * 2. 数据加载和保存 (通过 Zustand)
 * 3. 实时协作监听
 * 4. 拖拽上下文管理
 * 5. 渲染子组件
 */
export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  
  // Local state (仅用于 Supabase 用户认证)
  const [user, setUser] = useState<User | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([]);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Notifications
  const { notification, showNotification, hideNotification } = useNotifications();
  
  // Zustand Store - 状态
  const projects = useSeatingStore((state) => state.projects);
  const currentProject = useSeatingStore((state) => state.currentProject);
  const tables = useSeatingStore((state) => state.tables);
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  const activeGuest = useSeatingStore((state) => state.activeGuest);
  const isLoading = useSeatingStore((state) => state.isLoading);
  const isSaving = useSeatingStore((state) => state.isSaving);
  const hasUnsavedChanges = useSeatingStore((state) => state.hasUnsavedChanges);
  const confirmDialog = useSeatingStore((state) => state.confirmDialog);
  
  // Zustand Store - Actions
  const setProjects = useSeatingStore((state) => state.setProjects);
  const setCurrentProject = useSeatingStore((state) => state.setCurrentProject);
  const setTables = useSeatingStore((state) => state.setTables);
  const setUnassignedGuests = useSeatingStore((state) => state.setUnassignedGuests);
  const setActiveGuest = useSeatingStore((state) => state.setActiveGuest);
  const setIsLoading = useSeatingStore((state) => state.setIsLoading);
  const setIsSaving = useSeatingStore((state) => state.setIsSaving);
  const markChanges = useSeatingStore((state) => state.markChanges);
  const clearChanges = useSeatingStore((state) => state.clearChanges);
  const showConfirm = useSeatingStore((state) => state.showConfirm);
  const hideConfirm = useSeatingStore((state) => state.hideConfirm);

  // ==================== 用户认证 ====================
  useEffect(() => {
    const initAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/');
        return;
      }
      setUser(currentUser);
      
      // 加载项目数据
      await fetchProjectsAndLoadFirst(currentUser);
    };

    initAuth();
  }, []);

  // ==================== 项目管理 ====================
  const fetchProjectsAndLoadFirst = useCallback(async (userToFetch: User) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, layout_data, user_id, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        showNotification(`加载项目失败: ${error.message}`, 'error');
        setIsLoading(false);
        return;
      }

      setProjects(data || []);
      
      if (data && data.length > 0) {
        const projectToLoad = data[0];
        loadProjectData(projectToLoad);
      } else {
        // 创建默认项目
        const newProj: Project = {
          id: -1,
          name: '我的第一个项目',
          layout_data: { tables: [], unassignedGuests: [], rules: { notTogether: [] } }
        };
        setCurrentProject(newProj);
        setTables([]);
        setUnassignedGuests([]);
      }
      
      setIsLoading(false);
    } catch (err: any) {
      showNotification(`加载项目时出错: ${err.message}`, 'error');
      setIsLoading(false);
    }
  }, [supabase, showNotification, setProjects, setCurrentProject, setTables, setUnassignedGuests, setIsLoading]);

  const loadProjectData = (project: Project) => {
    setCurrentProject(project);
    const layout = project.layout_data;
    
    const normalizedTables = layout?.tables.map((t: any) => ({
      ...t,
      id: t.id || uuidv4(),
      capacity: t.capacity || 10,
      guests: t.guests.map((g: any) => ({ ...g, id: g.id || uuidv4() }))
    })) || [];
    
    const normalizedGuests = layout?.unassignedGuests.map((g: any) => ({
      ...g,
      id: g.id || uuidv4()
    })) || [];
    
    setTables(normalizedTables);
    setUnassignedGuests(normalizedGuests);
    clearChanges();
  };

  const handleSaveProject = useCallback(async () => {
    if (!currentProject || !user || !hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    const layout_data = {
      tables,
      unassignedGuests,
      rules: currentProject.layout_data?.rules || { notTogether: [] }
    };

    try {
      if (currentProject.id < 0) {
        // 创建新项目
        const { data, error } = await supabase
          .from('projects')
          .insert({ name: currentProject.name, layout_data, user_id: user.id })
          .select()
          .single();

        if (error) {
          showNotification(`创建失败: ${error.message}`, 'error');
        } else if (data) {
          showNotification('项目已创建并保存！', 'success');
          setProjects(projects.map(p => p.id === currentProject.id ? data : p));
          setCurrentProject(data);
        }
      } else {
        // 更新现有项目
        const { error } = await supabase
          .from('projects')
          .update({ name: currentProject.name, layout_data })
          .eq('id', currentProject.id);

        if (error) {
          showNotification(`保存失败: ${error.message}`, 'error');
        } else {
          showNotification('项目已保存！', 'success');
          setProjects(projects.map(p =>
            p.id === currentProject.id
              ? { ...p, name: currentProject.name, layout_data }
              : p
          ));
        }
      }
      
      clearChanges();
    } catch (err: any) {
      showNotification(`保存出错: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, user, hasUnsavedChanges, tables, unassignedGuests, projects, isSaving, supabase, showNotification, setProjects, setCurrentProject, clearChanges, setIsSaving]);

  // ==================== 自动保存 ====================
  useEffect(() => {
    if (hasUnsavedChanges && autoSaveEnabled && currentProject) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      autoSaveTimeout.current = setTimeout(() => {
        handleSaveProject();
      }, 1000);
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [hasUnsavedChanges, autoSaveEnabled, currentProject, handleSaveProject]);

  // ==================== 实时协作 ====================
  useEffect(() => {
    if (!currentProject || !user || currentProject.id < 0) {
      setActiveCollaborators([]);
      return;
    }

    const channel = supabase.channel(`project-${currentProject.id}`);

    // 监听布局变更
    channel.on('broadcast', { event: 'layout-change' }, (payload: any) => {
      if (payload.payload.editorId !== user.id) {
        const { tables: newTables, unassignedGuests: newUnassignedGuests, rules } = payload.payload;
        
        setTables(newTables || []);
        setUnassignedGuests(newUnassignedGuests || []);
        
        if (rules && currentProject.layout_data) {
          setCurrentProject({
            ...currentProject,
            layout_data: { ...currentProject.layout_data, rules }
          });
        }
        
        showNotification('👥 布局已由协作者更新', 'info');
      }
    });

    // 监听在线状态
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const collaborators = Object.values(state)
        .flatMap((presences: any) => presences)
        .map((presence: any) => presence.email)
        .filter((email: string) => email !== user.email);
      setActiveCollaborators(collaborators);
    });

    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ email: user.email, online_at: new Date().toISOString() });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [currentProject, user, supabase, setTables, setUnassignedGuests, setCurrentProject, showNotification]);

  // ==================== 拖拽处理 ====================
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const guest = [...unassignedGuests, ...tables.flatMap(t => t.guests)].find(g => g.id === active.id);
    if (guest) {
      setActiveGuest(guest);
    }
  }, [unassignedGuests, tables, setActiveGuest]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveGuest(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 查找宾客和容器
    const findGuestAndContainer = () => {
      for (const table of tables) {
        const guestIndex = table.guests.findIndex(g => g.id === activeId);
        if (guestIndex !== -1) {
          return { guest: table.guests[guestIndex], fromContainer: table.id, fromIndex: guestIndex };
        }
      }
      const unassignedIndex = unassignedGuests.findIndex(g => g.id === activeId);
      if (unassignedIndex !== -1) {
        return { guest: unassignedGuests[unassignedIndex], fromContainer: 'unassigned', fromIndex: unassignedIndex };
      }
      return null;
    };

    const result = findGuestAndContainer();
    if (!result) return;

    const { guest, fromContainer } = result;

    // 检查是否是已签到的宾客
    if (guest.locked) {
      showConfirm(
        '移动已签到的宾客',
        `${guest.name} 已签到。移动后将自动解除签到状态。是否继续？`,
        () => {
          moveAndUnlockGuest(guest, fromContainer, overId);
        },
        'warning'
      );
      return;
    }

    // 正常移动
    moveGuest(guest, fromContainer, overId);
  }, [tables, unassignedGuests, setActiveGuest, showConfirm]);

  const moveGuest = (guest: Guest, fromContainer: string, toContainer: string) => {
    let newTables = [...tables];
    let newUnassignedGuests = [...unassignedGuests];

    // 从原容器移除
    if (fromContainer === 'unassigned') {
      newUnassignedGuests = newUnassignedGuests.filter(g => g.id !== guest.id);
    } else {
      newTables = newTables.map(t =>
        t.id === fromContainer ? { ...t, guests: t.guests.filter(g => g.id !== guest.id) } : t
      );
    }

    // 添加到新容器
    if (toContainer === 'unassigned') {
      newUnassignedGuests.push(guest);
    } else {
      newTables = newTables.map(t =>
        t.id === toContainer ? { ...t, guests: [...t.guests, guest] } : t
      );
    }

    setTables(newTables);
    setUnassignedGuests(newUnassignedGuests);
    markChanges();

    // 广播变更
    broadcastLayoutChange(newTables, newUnassignedGuests);
  };

  const moveAndUnlockGuest = (guest: Guest, fromContainer: string, toContainer: string) => {
    const unlockedGuest = { ...guest, locked: false, checkInTime: undefined };
    moveGuest(unlockedGuest, fromContainer, toContainer);
    showNotification(`${guest.name} 已移动并解除签到状态`, 'info');
  };

  const broadcastLayoutChange = (newTables: SeatingTable[], newUnassignedGuests: Guest[]) => {
    if (!currentProject || !user || currentProject.id < 0) return;
    
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
  };

  // ==================== 渲染 ====================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">加载中...</p>
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

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-fadeIn">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500' :
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-white">{notification.message}</span>
              <button onClick={hideNotification} className="text-white hover:text-gray-200">✕</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{confirmDialog.title}</h3>
            <p className="text-gray-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                确定
              </button>
              <button
                onClick={() => {
                  if (confirmDialog.onCancel) {
                    confirmDialog.onCancel();
                  }
                  hideConfirm();
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - 项目列表 */}
      <aside className="w-60 bg-gradient-to-b from-gray-800 to-gray-900 p-5 flex flex-col border-r border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            SmartSeat
          </h1>
          <LogoutButton />
        </div>

        <div className="flex-grow overflow-y-auto">
          <div className="mb-4">
            <p className="text-sm text-gray-400">当前项目:</p>
            <p className="text-lg font-semibold">{currentProject?.name || '未选择'}</p>
          </div>
          
          {hasUnsavedChanges && (
            <button
              onClick={handleSaveProject}
              disabled={isSaving}
              className="w-full mb-4 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              {isSaving ? '保存中...' : '💾 保存项目'}
            </button>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="rounded"
            />
            自动保存
          </label>
        </div>

        <div className="text-xs text-gray-400 mt-6 p-3 bg-gray-800 bg-opacity-50 rounded-lg">
          <p className="truncate">用户: {user?.email}</p>
          {activeCollaborators.length > 0 && (
            <p className="mt-2">
              🟢 {activeCollaborators.length} 人在线
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-hidden flex">
        {currentProject && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={rectIntersection}
          >
            {/* 未分配宾客面板 */}
            <UnassignedGuestsPanel />

            {/* 桌子网格 */}
            <TablesGrid />

            {/* 拖拽覆盖层 */}
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

      {/* 控制面板 */}
      <ControlPanel />
    </div>
  );
}
