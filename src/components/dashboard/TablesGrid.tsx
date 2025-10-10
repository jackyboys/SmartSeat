'use client';

import { TableCard } from './TableCard';
import { useSeatingStore } from '@/store/seatingStore';

export function TablesGrid() {
  // 从 Zustand store 获取状态
  const tables = useSeatingStore((state) => state.tables);
  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          座位安排
        </h1>
        <p className="text-gray-400 mt-2">拖拽宾客到相应桌子进行座位安排</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {tables.map((table) => (
          <TableCard key={table.id} table={table} />
        ))}
        {tables.length === 0 && (
          <div className="col-span-full text-center py-20">
            <p className="text-gray-500 text-lg">暂无桌子，点击右侧 "添加桌子" 开始创建</p>
          </div>
        )}
      </div>
    </main>
  );
}
