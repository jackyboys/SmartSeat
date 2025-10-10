'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Guest, statusColors, statusTooltips } from './types';

interface SortableGuestProps {
  guest: Guest;
  onRemove: (guestId: string) => void;
  onEdit: (guest: Guest) => void;
  onCheckIn: (guest: Guest) => void;
}

export function SortableGuest({ guest, onRemove, onEdit, onCheckIn }: SortableGuestProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: guest.id,
    data: { guest, containerId: 'unassigned' },
    disabled: guest.locked, // 锁定的宾客不能拖拽
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        p-3 bg-gray-700 rounded-lg cursor-grab active:cursor-grabbing
        hover:bg-gray-600 transition-all duration-300 group
        ${guest.locked ? 'ring-2 ring-blue-500 opacity-75' : ''}
        ${isDragging ? 'shadow-2xl scale-105' : 'shadow-md'}
      `}
      data-testid={`guest-${guest.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {guest.avatarUrl ? (
            <img
              src={guest.avatarUrl}
              alt={guest.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
              {guest.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate flex items-center gap-2">
              {guest.name}
              {guest.locked && (
                <span className="text-blue-400 text-xs" title="已锁定(已签到)">
                  🔒
                </span>
              )}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              {guest.status && (
                <span
                  className={`inline-block px-2 py-0.5 ${statusColors[guest.status]} text-white text-xs rounded-full`}
                  title={statusTooltips[guest.status]}
                >
                  {statusTooltips[guest.status]}
                </span>
              )}
              {guest.checkInTime && (
                <span className="text-xs text-gray-400" title={`签到时间: ${guest.checkInTime}`}>
                  ⏰ {new Date(guest.checkInTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {!guest.locked && guest.status !== 'checked-in' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCheckIn(guest);
              }}
              className="p-1.5 rounded bg-blue-600 hover:bg-blue-500 transition-colors"
              title="签到"
              data-testid={`checkin-guest-${guest.id}`}
            >
              ✓
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(guest);
            }}
            className="p-1.5 rounded bg-yellow-600 hover:bg-yellow-500 transition-colors"
            title="编辑"
            data-testid={`edit-guest-${guest.id}`}
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(guest.id);
            }}
            className="p-1.5 rounded bg-red-600 hover:bg-red-500 transition-colors"
            title="删除"
            data-testid={`delete-guest-${guest.id}`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
