'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { DndContext, rectIntersection, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

// 导入所有重构后的组件和Store
import { useSeatingStore } from '@/store/seatingStore';
import { UnassignedGuestsPanel } from '@/components/dashboard/UnassignedGuestsPanel';
import { TablesGrid } from '@/components/dashboard/TablesGrid';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { ModalWrapper, ConfirmDialog } from '@/components/dashboard/ModalWrapper';
import { AllModals } from '@/components/dashboard/AllModals';
import { MODAL_TYPES } from '@/constants/modalTypes';

// 从旧代码中保留的组件
import LogoutButton from '@/components/LogoutButton';
import { QRCodeSVG } from 'qrcode.react';

// 主题配置
const theme = {
  primary: 'from-blue-600 to-blue-500',
  success: 'from-green-600 to-green-500',
  danger: 'from-red-600 to-red-500',
};

// 这是一个精简后的新版 DashboardPage
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // 从 Zustand Store 获取所有需要的状态和 actions
  const isLoading = useSeatingStore((state) => state.isLoading);
  const isModalOpen = useSeatingStore((state) => state.isModalOpen);
  const activeGuest = useSeatingStore((state) => state.activeGuest);
  const confirmDialog = useSeatingStore((state) => state.confirmDialog);
  const notification = useSeatingStore((state) => state.notification);
  const currentProject = useSeatingStore((state) => state.currentProject);
  const tables = useSeatingStore((state) => state.tables);
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  const hasUnsavedChanges = useSeatingStore((state) => state.hasUnsavedChanges);

  const setIsLoading = useSeatingStore((state) => state.setIsLoading);
  const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
  const hideConfirm = useSeatingStore((state) => state.hideConfirm);
  const clearNotification = useSeatingStore((state) => state.clearNotification);
  const handleDragStart = useSeatingStore((state) => state.handleDragStart);
  const handleDragEnd = useSeatingStore((state) => state.handleDragEnd);
  const showNotification = useSeatingStore((state) => state.showNotification);
  const setCurrentProject = useSeatingStore((state) => state.setCurrentProject);
  const clearChanges = useSeatingStore((state) => state.clearChanges);

  // 计算所有宾客列表
  const allGuests = useMemo(() => {
    return [...unassignedGuests, ...tables.flatMap((t) => t.guests)];
  }, [unassignedGuests, tables]);

  // 保存项目函数
  const handleSaveProject = async () => {
    if (!currentProject || !user || !hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    const layout_data = {
      tables,
      unassignedGuests,
      rules: currentProject.layout_data?.rules || { notTogether: [] }
    };

    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();

      if (currentProject.id < 0) {
        // 新项目 - 插入
        const { data, error } = await supabase
          .from('projects')
          .insert({ 
            name: currentProject.name, 
            layout_data, 
            user_id: user.id 
          })
          .select()
          .single();

        if (error) {
          console.error('Insert project error:', error);
          showNotification(`创建失败: ${error.message}`);
        } else if (data) {
          showNotification('项目已创建并保存！');
          setCurrentProject(data);
        }
      } else {
        // 已存在项目 - 更新
        const { error } = await supabase
          .from('projects')
          .update({ name: currentProject.name, layout_data })
          .eq('id', currentProject.id);

        if (error) {
          console.error('Update project error:', error);
          showNotification(`保存失败: ${error.message}`);
        } else {
          showNotification('项目已保存！');
        }
      }
      
      clearChanges();
    } catch (err: any) {
      console.error('Save project error:', err);
      showNotification(`保存出错: ${err.message}`);
    }

    setIsSaving(false);
  };

  // 传感器配置
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // 初始化用户和项目数据 (这部分逻辑仍然保留在主页面)
  useEffect(() => {
    const initialize = async () => {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        setUser(authUser);
        // TODO: 这里将来应该调用 useProjectManager hook 来加载数据
        // await fetchProjectsAndLoadFirst(authUser);
      } else {
        router.push('/');
      }
      setIsLoading(false);
    };
    initialize();
  }, [router, setIsLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">正在加载您的工作区...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* 这里可以放置你的项目侧边栏 (ProjectSidebar)，
        它也应该从 store 中获取 projects 和 currentProject 
      */}

      <div className="flex-1 flex overflow-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={(e) => handleDragStart(e.active.id as string)}
          onDragEnd={(e) => handleDragEnd({ activeId: e.active.id as string, overId: e.over?.id as string | null })}
          collisionDetection={rectIntersection}
        >
          <UnassignedGuestsPanel />
          <TablesGrid />
          <ControlPanel 
            onSaveProject={handleSaveProject}
            isSaving={isSaving}
          />

          <DragOverlay>
            {activeGuest ? (
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white shadow-2xl">
                {activeGuest.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 渲染 Modals (弹窗) */}
      <ModalWrapper isOpen={!!isModalOpen} onClose={() => setIsModalOpen(null)} size="lg">
        <AllModals 
          user={user}
          currentProject={currentProject}
          allGuests={allGuests}
          unassignedGuests={unassignedGuests}
          projectMembers={projectMembers}
          onSaveProject={handleSaveProject}
        />
      </ModalWrapper>

      {/* 渲染确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={hideConfirm}
        confirmButtonClass={
          confirmDialog.type === 'danger'
            ? `bg-gradient-to-r ${theme.danger}`
            : `bg-gradient-to-r ${theme.primary}`
        }
      />

      {/* 渲染通知 */}
      {notification && (
        <div className="fixed top-6 right-6 z-50">
          {/* 这里是你之前的 Notification 组件 JSX */}
        </div>
      )}
    </div>
  );
}