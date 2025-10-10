'use client';

interface StatsChartProps {
  stats: {
    confirmedCount: number;
    unconfirmedCount: number;
    cancelledCount: number;
    checkedInCount: number;
    tableFillRate: Array<{ name: string; rate: number }>;
  };
}

export function StatsChart({ stats }: StatsChartProps) {
  const total = stats.confirmedCount + stats.unconfirmedCount + stats.cancelledCount + stats.checkedInCount;
  const confirmedPercent = total > 0 ? (stats.confirmedCount / total) * 100 : 0;
  const unconfirmedPercent = total > 0 ? (stats.unconfirmedCount / total) * 100 : 0;
  const cancelledPercent = total > 0 ? (stats.cancelledCount / total) * 100 : 0;
  const checkedInPercent = total > 0 ? (stats.checkedInCount / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>宾客状态分布</span>
          <span>{total} 人</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden flex">
          {checkedInPercent > 0 && (
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${checkedInPercent}%` }}
              title={`已签到: ${stats.checkedInCount}`}
            />
          )}
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
            {stats.tableFillRate.slice(0, 10).map((table, idx) => (
              <div
                key={table.name || `table-${idx}`}
                className={`h-8 rounded transition-all duration-300 hover:scale-110 cursor-pointer ${
                  table.rate >= 100
                    ? 'bg-red-500'
                    : table.rate >= 80
                    ? 'bg-yellow-500'
                    : table.rate >= 50
                    ? 'bg-blue-500'
                    : 'bg-green-500'
                }`}
                title={`${table.name}: ${table.rate.toFixed(0)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
