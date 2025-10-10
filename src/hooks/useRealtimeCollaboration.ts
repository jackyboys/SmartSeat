import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// 导入类型定义
interface Guest {
  id: string;
  name: string;
  status?: 'confirmed' | 'unconfirmed' | 'cancelled' | 'checked-in';
  avatarUrl?: string;
  locked?: boolean;
  checkInTime?: string;
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

/**
 * useRealtimeCollaboration Hook
 * 
 * 封装 Supabase 实时协作的所有逻辑
 * 包括监听布局变更、签到事件、在线状态(presence)等
 * 
 * @param options - 配置选项
 * @param options.currentProject - 当前项目
 * @param options.user - 当前用户
 * @param options.onLayoutChange - 布局变更回调
 * @param options.onCheckIn - 签到事件回调
 * @param options.onNotification - 通知回调
 * @param options.markAsChanged - 标记有未保存更改的回调
 * 
 * @returns {
 *   activeCollaborators - 当前在线的协作者列表
 *   broadcastLayoutChange - 广播布局变更的函数
 *   broadcastCheckIn - 广播签到事件的函数
 * }
 * 
 * @example
 * const { 
 *   activeCollaborators, 
 *   broadcastLayoutChange,
 *   broadcastCheckIn
 * } = useRealtimeCollaboration({
 *   currentProject,
 *   user,
 *   onLayoutChange: (tables, guests) => {
 *     setTables(tables);
 *     setUnassignedGuests(guests);
 *   },
 *   onCheckIn: (guestId, checkInTime) => {
 *     // 更新宾客状态
 *   },
 *   onNotification: showNotification,
 *   markAsChanged: markChanges
 * });
 */
export function useRealtimeCollaboration(options: {
  currentProject: Project | null;
  user: User | null;
  onLayoutChange: (
    tables: SeatingTable[], 
    unassignedGuests: Guest[], 
    rules?: { notTogether: NotTogetherRule[] }
  ) => void;
  onCheckIn: (guestId: string, checkInTime: string) => void;
  onNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  markAsChanged: () => void;
}) {
  const {
    currentProject,
    user,
    onLayoutChange,
    onCheckIn,
    onNotification,
    markAsChanged
  } = options;

  const supabase = createClient();
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  /**
   * 设置实时订阅
   */
  useEffect(() => {
    // 如果没有当前项目或用户,不订阅
    if (!currentProject || !user) {
      setActiveCollaborators([]);
      return;
    }

    // 创建频道
    const realtimeChannel = supabase.channel(`project-${currentProject.id}`);

    // 监听布局变更事件
    realtimeChannel.on(
      'broadcast',
      { event: 'layout-change' },
      (payload: any) => {
        // 忽略自己发送的消息
        if (payload.payload.editorId !== user.id) {
          const {
            tables: newTables,
            unassignedGuests: newUnassignedGuests,
            rules
          } = payload.payload;

          // 触发回调更新本地状态
          onLayoutChange(
            newTables || [],
            newUnassignedGuests || [],
            rules
          );

          onNotification('👥 布局已由协作者更新', 'info');
        }
      }
    );

    // 监听签到事件
    realtimeChannel.on(
      'broadcast',
      { event: 'check-in' },
      (payload: any) => {
        const { guestId, checkInTime, guestName } = payload.payload;

        // 触发回调更新本地状态
        onCheckIn(guestId, checkInTime);

        // 显示签到通知
        onNotification(`✅ ${guestName || '宾客'} 已成功签到！`, 'info');
        
        // 标记为需要保存
        markAsChanged();
      }
    );

    // 监听在线状态同步
    realtimeChannel.on(
      'presence',
      { event: 'sync' },
      () => {
        const state = realtimeChannel.presenceState();
        const collaborators = Object.keys(state)
          .map(key => (state[key][0] as any)?.user_email)
          .filter(email => email && email !== user.email);
        
        setActiveCollaborators(collaborators);
      }
    );

    // 监听协作者加入
    realtimeChannel.on(
      'presence',
      { event: 'join' },
      ({ newPresences }) => {
        const newCollaborator = (newPresences[0] as any)?.user_email;
        if (newCollaborator && newCollaborator !== user.email) {
          onNotification(`👋 ${newCollaborator} 加入了协作`, 'info');
        }
      }
    );

    // 监听协作者离开
    realtimeChannel.on(
      'presence',
      { event: 'leave' },
      ({ leftPresences }) => {
        const leftCollaborator = (leftPresences[0] as any)?.user_email;
        if (leftCollaborator && leftCollaborator !== user.email) {
          onNotification(`👋 ${leftCollaborator} 离开了协作`, 'info');
        }
      }
    );

    // 订阅频道
    realtimeChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // 订阅成功后,追踪当前用户的在线状态
        await realtimeChannel.track({
          user_id: user.id,
          user_email: user.email,
          online_at: new Date().toISOString()
        });
      }
    });

    // 保存频道引用
    setChannel(realtimeChannel);

    // 清理函数
    return () => {
      realtimeChannel.untrack();
      supabase.removeChannel(realtimeChannel);
      setActiveCollaborators([]);
      setChannel(null);
    };
  }, [currentProject?.id, user?.id, user?.email, supabase, onLayoutChange, onCheckIn, onNotification, markAsChanged]);

  /**
   * 广播布局变更
   */
  const broadcastLayoutChange = (
    tables: SeatingTable[],
    unassignedGuests: Guest[],
    rules?: { notTogether: NotTogetherRule[] }
  ) => {
    if (!currentProject || !user || !channel) return;

    channel.send({
      type: 'broadcast',
      event: 'layout-change',
      payload: {
        tables,
        unassignedGuests,
        rules: rules || currentProject.layout_data?.rules,
        editorId: user.id,
        timestamp: Date.now()
      }
    });
  };

  /**
   * 广播签到事件
   */
  const broadcastCheckIn = (guestId: string, guestName: string, checkInTime: string) => {
    if (!currentProject || !channel) return;

    channel.send({
      type: 'broadcast',
      event: 'check-in',
      payload: {
        guestId,
        guestName,
        checkInTime,
        timestamp: Date.now()
      }
    });
  };

  return {
    activeCollaborators,
    broadcastLayoutChange,
    broadcastCheckIn,
  };
}
