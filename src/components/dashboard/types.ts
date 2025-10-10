// 共享的类型定义
export type GuestStatus = 'confirmed' | 'unconfirmed' | 'cancelled' | 'checked-in';

export interface Guest {
  id: string;
  name: string;
  status?: GuestStatus;
  avatarUrl?: string;
  locked?: boolean;
  checkInTime?: string;
}

export interface SeatingTable {
  id: string;
  tableName: string;
  guests: Guest[];
  capacity: number;
}

export type NotTogetherRule = [string, string];

export interface Project {
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

export interface ProjectMember {
  id: number;
  user_id: string;
  email: string;
  role: string;
}

export const statusColors: { [key in GuestStatus]: string } = {
  confirmed: 'bg-green-500',
  unconfirmed: 'bg-yellow-500',
  cancelled: 'bg-red-500',
  'checked-in': 'bg-blue-500',
};

export const statusTooltips: { [key in GuestStatus]: string } = {
  confirmed: '已确认',
  unconfirmed: '未确认',
  cancelled: '已取消',
  'checked-in': '已签到',
};

export const theme = {
  primary: 'from-blue-600 to-blue-500',
  success: 'from-green-600 to-green-500',
  danger: 'from-red-600 to-red-500',
  warning: 'from-yellow-600 to-yellow-500',
  cardBg: 'from-gray-800 to-gray-900',
};
