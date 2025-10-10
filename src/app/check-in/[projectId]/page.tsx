'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useParams } from 'next/navigation';

// --- 数据结构 ---
type GuestStatus = 'confirmed' | 'unconfirmed' | 'cancelled' | 'checked-in';

interface Guest {
  id: string;
  name: string;
  status?: GuestStatus;
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

interface Project {
  id: number;
  name: string;
  layout_data: {
    tables: SeatingTable[];
    unassignedGuests: Guest[];
  } | null;
}

// --- Reusable Notification Component ---
const Notification = ({ notification, onClose }: {
  notification: { type: 'success' | 'error' | 'info', message: string } | null;
  onClose: () => void;
}) => {
  if (!notification) return null;

  return (
    <div className="fixed top-6 right-6 max-w-sm w-full z-50 animate-slideIn">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            notification.type === 'success' ? 'bg-green-500/20 text-green-400' :
            notification.type === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            <span className="text-lg">{notification.type === 'success' ? '✓' : '✕'}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">
              {notification.type === 'success' ? '成功' : '错误'}
            </p>
            <p className="text-sm text-gray-300">{notification.message}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
      </div>
    </div>
  );
};

// --- Main Check-in Page Component ---
export default function CheckInPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [guestLocationMap, setGuestLocationMap] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [checkingInGuestId, setCheckingInGuestId] = useState<string | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const processLayoutData = useCallback((layout: Project['layout_data']) => {
    if (!layout) return;
    const guestsFromTables = layout.tables.flatMap(t => t.guests);
    const unassigned = layout.unassignedGuests;
    const combinedGuests = [...guestsFromTables, ...unassigned];
    combinedGuests.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    setAllGuests(combinedGuests);

    const newLocationMap = new Map<string, string>();
    layout.tables.forEach(table => {
      table.guests.forEach(guest => {
        newLocationMap.set(guest.id, table.tableName);
      });
    });
    layout.unassignedGuests.forEach(guest => {
      newLocationMap.set(guest.id, '未分配');
    });
    setGuestLocationMap(newLocationMap);
  }, []);

  useEffect(() => {
    const fetchProjectGuests = async () => {
      if (!projectId) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('name, layout_data')
          .eq('id', projectId)
          .single();

        if (error || !data) throw new Error("项目未找到或加载失败。");

        setProjectName(data.name);
        processLayoutData(data.layout_data);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectGuests();

    const channel = supabase
      .channel(`project-${projectId}-checkin-page`)
      .on('broadcast', { event: 'layout-change' }, (payload: any) => {
         const { tables: newTables, unassignedGuests: newUnassignedGuests } = payload.payload;
         processLayoutData({ tables: newTables, unassignedGuests: newUnassignedGuests });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [projectId, supabase, processLayoutData]);

  const filteredGuests = useMemo(() => {
    if (!searchQuery) {
      return [];
    }
    return allGuests.filter(guest =>
      guest.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allGuests]);

  // ==================================================================
  // ========= ✅ 已修正：填充 handleCheckIn 函数的完整逻辑 =============
  // ==================================================================
  const handleCheckIn = async (guestId: string) => {
    setCheckingInGuestId(guestId);
    try {
      // Step 1: Fetch the latest project data
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('layout_data')
        .eq('id', projectId)
        .single();

      if (fetchError || !projectData) throw new Error("无法获取最新项目数据，请重试。");

      // Step 2: Find and update the guest in the layout data
      const layout = projectData.layout_data;
      if (!layout) throw new Error("项目数据不完整。");
      
      let guestFound = false;
      let guestName = '';
      const newCheckInTime = new Date().toISOString();

      const updateGuestState = (g: Guest): Guest => {
        if (g.id === guestId) {
          guestFound = true;
          guestName = g.name;
          if (g.status === 'checked-in') {
             throw new Error(`"${g.name}" 已经签到过了。`);
          }
          return {
            ...g,
            status: 'checked-in',
            locked: true,
            checkInTime: newCheckInTime,
          };
        }
        return g;
      };

      layout.tables = layout.tables.map(table => ({ ...table, guests: table.guests.map(updateGuestState) }));
      layout.unassignedGuests = layout.unassignedGuests.map(updateGuestState);

      if (!guestFound) throw new Error("在项目中未找到该宾客。");

      // Step 3: Update the entire layout_data back to the database
      const { error: updateError } = await supabase
        .from('projects')
        .update({ layout_data: layout })
        .eq('id', projectId);

      if (updateError) throw new Error(`数据库更新失败: ${updateError.message}`);

      // Step 4: Broadcast the check-in event to the dashboard
      const channel = supabase.channel(`project-${projectId}`);
      await channel.send({
        type: 'broadcast',
        event: 'check-in',
        payload: {
          guestId: guestId,
          checkInTime: newCheckInTime,
        },
      });

      // Step 5: Update local UI to reflect the change immediately
      setAllGuests(prevGuests => prevGuests.map(g => g.id === guestId ? { ...g, status: 'checked-in' } : g));
      showNotification(`"${guestName}" 已成功签到！`);

    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setCheckingInGuestId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">正在加载活动信息...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-xl text-center p-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 sm:p-6 md:p-8">
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>

      <Notification notification={notification} onClose={() => setNotification(null)} />

      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {projectName}
          </h1>
          <p className="text-lg text-gray-400 mt-2">现场签到</p>
        </header>

        <main>
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 在此输入宾客姓名进行搜索..."
              className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="space-y-3">
            {searchQuery && filteredGuests.length === 0 && (
              <div className="text-center py-10 px-4 bg-gray-800/50 rounded-lg">
                <p className="text-gray-400">找不到匹配的宾客，请确认姓名是否正确。</p>
              </div>
            )}
            
            {!searchQuery && (
              <div className="text-center py-10 px-4 bg-gray-800/50 rounded-lg">
                <p className="text-gray-400">开始输入以查找宾客。</p>
              </div>
            )}
            
            {filteredGuests.map((guest) => (
              <div key={guest.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between transition-all duration-200">
                <div>
                    <p className="font-medium text-lg">{guest.name}</p>
                    <p className="text-sm text-gray-400">
                        位置: <span className="font-semibold text-blue-300">{guestLocationMap.get(guest.id) || '未知'}</span>
                    </p>
                </div>
                <button
                  onClick={() => handleCheckIn(guest.id)}
                  disabled={guest.status === 'checked-in' || checkingInGuestId === guest.id}
                  className={`px-5 py-2 rounded-md font-semibold transition-all duration-200 transform focus:outline-none flex-shrink-0
                    ${guest.status === 'checked-in' 
                      ? 'bg-green-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
                    }
                    disabled:opacity-70 disabled:cursor-wait
                  `}
                >
                  {checkingInGuestId === guest.id 
                    ? '处理中...' 
                    : guest.status === 'checked-in' 
                      ? '已签到 ✅' 
                      : '签到'
                  }
                </button>
              </div>
            ))}
          </div>
        </main>

        <footer className="text-center mt-12 text-gray-600 text-sm">
          <p>Powered by SmartSeat</p>
        </footer>
      </div>
    </div>
  );
}