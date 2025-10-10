'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GuestStatus, statusColors, statusTooltips, theme } from './types';
import { SortableGuest } from './SortableGuest';
import { useSeatingStore } from '@/store/seatingStore';

export function UnassignedGuestsPanel() {
  // 从 Zustand store 获取状态和 actions
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  const searchQuery = useSeatingStore((state) => state.searchQuery);
  const activeStatusFilter = useSeatingStore((state) => state.activeStatusFilter);
  const leftPanelOpen = useSeatingStore((state) => state.leftPanelOpen);
  
  const setSearchQuery = useSeatingStore((state) => state.setSearchQuery);
  const setActiveStatusFilter = useSeatingStore((state) => state.setActiveStatusFilter);
  const toggleLeftPanel = useSeatingStore((state) => state.toggleLeftPanel);
  const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
  const setModalInputView = useSeatingStore((state) => state.setModalInputView);
  const setInputValue = useSeatingStore((state) => state.setInputValue);
  const deleteUnassignedGuest = useSeatingStore((state) => state.deleteUnassignedGuest);
  const checkInGuest = useSeatingStore((state) => state.checkInGuest);
  
  // 使用 useMemo 计算筛选后的宾客
  const filteredUnassignedGuests = useMemo(() => {
    return unassignedGuests.filter((guest) => {
      const matchesSearch = guest.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        activeStatusFilter === 'all' ||
        guest.status === activeStatusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [unassignedGuests, searchQuery, activeStatusFilter]);

  const { setNodeRef: setUnassignedRef } = useDroppable({
    id: 'unassigned',
  });

  const guestStatuses: GuestStatus[] = ['confirmed', 'unconfirmed', 'cancelled', 'checked-in'];

  // 处理添加宾客
  const handleAddGuest = () => {
    setInputValue('');
    setModalInputView('manual');
    setIsModalOpen('addGuest');
  };

  // 处理导入宾客
  const handleImportGuests = () => {
    setModalInputView('import');
    setIsModalOpen('addGuest');
  };

  // 处理状态筛选切换
  const handleStatusFilterToggle = (status: GuestStatus) => {
    if (activeStatusFilter === status) {
      setActiveStatusFilter('all');
    } else {
      setActiveStatusFilter(status);
    }
  };

  return (
    <>
      <aside
        className={`
          fixed lg:relative top-0 left-0 h-full bg-gray-900 border-r border-gray-700 p-4 space-y-4 z-30
          transition-transform duration-300
          ${leftPanelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-80 lg:w-80 overflow-y-auto flex flex-col
        `}
      >
        <button
          onClick={toggleLeftPanel}
          className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="关闭未分配面板"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          未分配宾客
        </h2>

        <div className="relative">
          <input
            type="text"
            placeholder="搜索宾客..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300"
            data-testid="search-input"
          />
          <span className="absolute left-3 top-3 text-gray-500">🔍</span>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400 font-semibold">状态筛选:</label>
          <div className="grid grid-cols-2 gap-2">
            {guestStatuses.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilterToggle(status)}
                className={`
                  p-2 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105
                  ${activeStatusFilter === status
                    ? `${statusColors[status]} text-white shadow-md`
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
                data-testid={`filter-${status}`}
              >
                {statusTooltips[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAddGuest}
            className={`flex-1 p-2.5 rounded-lg bg-gradient-to-r ${theme.primary} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
            data-testid="btn-add-guest"
          >
            + 添加宾客
          </button>
          <button
            onClick={handleImportGuests}
            className="flex-1 p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
            data-testid="btn-import-guests"
          >
            📥 导入
          </button>
        </div>

        <div
          ref={setUnassignedRef}
          className="flex-1 space-y-2 min-h-[200px] p-3 bg-gray-800 rounded-lg border-2 border-dashed border-gray-700"
          data-testid="unassigned-guests-list"
        >
          <SortableContext items={filteredUnassignedGuests.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            {filteredUnassignedGuests.map((guest) => (
              <SortableGuest
                key={guest.id}
                guest={guest}
                onRemove={deleteUnassignedGuest}
                onEdit={() => {
                  // TODO: 实现编辑宾客功能
                  console.log('Edit guest:', guest);
                }}
                onCheckIn={() => checkInGuest(guest.id)}
              />
            ))}
          </SortableContext>
          {filteredUnassignedGuests.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              {searchQuery || activeStatusFilter !== 'all' ? '没有匹配的宾客' : '暂无未分配宾客'}
            </p>
          )}
        </div>
      </aside>

      <button
        onClick={toggleLeftPanel}
        className="lg:hidden fixed top-4 left-4 z-20 p-3 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full shadow-lg"
        aria-label="打开未分配面板"
      >
        👥
      </button>
    </>
  );
}
