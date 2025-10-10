'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SeatingTable, theme } from './types';
import { SortableGuest } from './SortableGuest';
import { useSeatingStore } from '@/store/seatingStore';

interface TableCardProps {
  table: SeatingTable;
}

export function TableCard({ table }: TableCardProps) {
  // 从 Zustand store 获取 actions
  const showConfirm = useSeatingStore((state) => state.showConfirm);
  const deleteTable = useSeatingStore((state) => state.deleteTable);
  const checkInGuest = useSeatingStore((state) => state.checkInGuest);
  const setDeleteConfirm = useSeatingStore((state) => state.setDeleteConfirm);
  const tables = useSeatingStore((state) => state.tables);
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);

  // 处理移除宾客
  const handleRemoveGuest = (guestId: string) => {
    const guest = table.guests.find((g) => g.id === guestId);
    if (!guest) return;

    if (guest.locked) {
      // 如果宾客已锁定,显示管理员确认框
      showConfirm(
        '管理员操作确认',
        `宾客 "${guest.name}" 已签到，座位已锁定。\n\n您确定要将他/她强制移至"未分配区"吗？此操作将同时为该宾客解锁。`,
        () => {
          const updatedTables = tables.map((t) =>
            t.id === table.id
              ? { ...t, guests: t.guests.filter((g) => g.id !== guestId) }
              : t
          );
          const guestToMove = { ...guest, locked: false };
          const updatedGuests = [...unassignedGuests, guestToMove];

          useSeatingStore.setState({
            tables: updatedTables,
            unassignedGuests: updatedGuests,
            hasUnsavedChanges: true,
          });

          useSeatingStore.getState().showNotification(
            `宾客 "${guest.name}" 已解锁并移至未分配区。`,
            'info'
          );
        },
        'warning'
      );
    } else {
      // 如果宾客未锁定,显示移动/删除对话框
      setDeleteConfirm({ guestId, tableId: table.id, guestName: guest.name });
    }
  };

  // 处理编辑桌子
  const handleEditTable = () => {
    // TODO: 实现编辑桌子功能
    console.log('Edit table:', table);
  };

  // 处理删除桌子
  const handleDeleteTable = () => {
    showConfirm(
      '确认删除',
      `确定要删除 "${table.tableName}" 吗？桌上的宾客将移回未分配区域。`,
      () => {
        deleteTable(table.id);
      },
      'danger'
    );
  };
  const { setNodeRef } = useDroppable({
    id: table.id,
  });

  const occupancyPercentage = (table.guests.length / table.capacity) * 100;
  const isOverCapacity = table.guests.length > table.capacity;

  return (
    <div
      className={`
        bg-gradient-to-br ${theme.cardBg} rounded-xl border-2
        ${isOverCapacity ? 'border-red-500' : 'border-gray-700'}
        p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]
        flex flex-col h-full
      `}
      data-testid={`table-${table.id}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <span className="mr-2">🪑</span>
          {table.tableName}
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={handleEditTable}
            className="p-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 transition-all duration-300 transform hover:scale-110"
            title="编辑桌子"
            data-testid={`edit-table-${table.id}`}
          >
            ✎
          </button>
          <button
            onClick={handleDeleteTable}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-500 transition-all duration-300 transform hover:scale-110"
            title="删除桌子"
            data-testid={`delete-table-${table.id}`}
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>
            容量: {table.guests.length} / {table.capacity}
          </span>
          <span className={isOverCapacity ? 'text-red-400 font-semibold' : ''}>
            {occupancyPercentage.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverCapacity
                ? 'bg-gradient-to-r from-red-600 to-red-500'
                : occupancyPercentage > 80
                ? 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                : 'bg-gradient-to-r from-green-600 to-green-500'
            }`}
            style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
          ></div>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="space-y-2 flex-1 min-h-[100px] p-3 bg-gray-800 rounded-lg border-2 border-dashed border-gray-700"
        data-testid={`table-guests-${table.id}`}
      >
        <SortableContext items={table.guests.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          {table.guests.map((guest) => (
            <SortableGuest
              key={guest.id}
              guest={guest}
              onRemove={() => handleRemoveGuest(guest.id)}
              onEdit={() => {
                // TODO: 实现编辑宾客功能
                console.log('Edit guest:', guest);
              }}
              onCheckIn={() => checkInGuest(guest.id)}
            />
          ))}
        </SortableContext>
        {table.guests.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">拖拽宾客到这里</p>
        )}
      </div>
    </div>
  );
}
