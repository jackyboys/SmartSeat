'use client';

import { theme, NotTogetherRule } from './types';
import { StatsChart } from './StatsChart';
import { useSeatingStore, useStats, useGuestNameMap } from '@/store/seatingStore';

export function ControlPanel() {
  // 从 Zustand store 获取状态和 actions
  const stats = useStats();
  const currentProject = useSeatingStore((state) => state.currentProject);
  const guestNameMap = useGuestNameMap();
  const rightPanelOpen = useSeatingStore((state) => state.rightPanelOpen);
  
  const toggleRightPanel = useSeatingStore((state) => state.toggleRightPanel);
  const setSidebarOpen = useSeatingStore((state) => state.setSidebarOpen);
  const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
  const setInputValue = useSeatingStore((state) => state.setInputValue);
  const setInputCapacity = useSeatingStore((state) => state.setInputCapacity);
  const setModalInputView = useSeatingStore((state) => state.setModalInputView);
  const setAiGuestList = useSeatingStore((state) => state.setAiGuestList);
  const setRuleGuests = useSeatingStore((state) => state.setRuleGuests);
  const deleteRule = useSeatingStore((state) => state.deleteRule);
  const resetLayout = useSeatingStore((state) => state.resetLayout);
  const showConfirm = useSeatingStore((state) => state.showConfirm);
  const unassignedGuests = useSeatingStore((state) => state.unassignedGuests);
  
  // 处理各种操作
  const handleAddTable = () => {
    setInputValue('');
    setInputCapacity('10');
    setModalInputView('manual');
    setIsModalOpen('addTable');
  };

  const handleAISeating = () => {
    setAiGuestList(unassignedGuests.map((g) => g.name).join('\n'));
    setIsModalOpen('aiSeating');
  };

  const handleResetLayout = () => {
    showConfirm(
      '确认重置',
      '这将清空所有桌子并将所有宾客移回未分配区域。此操作不可撤销。',
      () => {
        resetLayout();
      },
      'danger'
    );
  };

  const handleAddRule = () => {
    setRuleGuests({ g1: '', g2: '' });
    setIsModalOpen('addRule');
  };

  const handleManageProjects = () => {
    setSidebarOpen(true);
  };

  const handleManageCollaborators = () => {
    setIsModalOpen('inviteCollaborator');
  };

  // 这些需要在实际使用时实现
  const handleExportPdf = () => {
    // TODO: 实现 PDF 导出
    console.log('Export PDF');
  };

  const handleExportPlaceCards = () => {
    // TODO: 实现桌卡导出
    console.log('Export Place Cards');
  };
  return (
    <>
      <aside
        className={`
          fixed lg:relative top-0 right-0 h-full bg-gray-900 border-l border-gray-700 p-4 space-y-4 z-30
          transition-transform duration-300
          ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          w-80 lg:w-80 overflow-y-auto flex flex-col
        `}
      >
        <button
          onClick={toggleRightPanel}
          className="lg:hidden absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
          aria-label="关闭控制面板"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          控制面板
        </h2>

        <div className="space-y-2">
          <button
            onClick={handleManageProjects}
            className={`w-full p-2.5 rounded-lg bg-gradient-to-r ${theme.primary} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
            data-testid="btn-manage-projects"
          >
            📁 管理项目
          </button>

          <button
            onClick={handleManageCollaborators}
            className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
            data-testid="btn-manage-collaborators"
          >
            👥 协作成员
          </button>
        </div>

        <hr className="border-gray-700" />

        <button
          onClick={handleAddTable}
          className={`w-full p-2.5 rounded-lg bg-gradient-to-r ${theme.success} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
          data-testid="btn-add-table"
        >
          + 添加桌子
        </button>

        <button
          onClick={handleAISeating}
          className={`w-full p-2.5 rounded-lg bg-gradient-to-r ${theme.warning} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
          data-testid="btn-ai-seating"
        >
          🤖 AI 智能排座
        </button>

        <button
          onClick={handleResetLayout}
          className={`w-full p-2.5 rounded-lg bg-gradient-to-r ${theme.danger} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
          data-testid="btn-reset-layout"
        >
          🔄 重置布局
        </button>

        <button
          onClick={handleExportPdf}
          className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          data-testid="btn-export-pdf"
        >
          导出为 PDF
        </button>

        <button
          onClick={handleExportPlaceCards}
          className="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          data-testid="btn-export-place-cards"
        >
          📇 生成桌卡
        </button>

        <div className={`p-4 bg-gradient-to-br ${theme.cardBg} rounded-lg text-sm space-y-2.5 border border-gray-700 shadow-md`}>
          <h4 className="font-bold text-md mb-3 text-gray-200">关系规则</h4>
          <div className="max-h-28 overflow-y-auto space-y-2 pr-2">
            {(currentProject?.layout_data?.rules?.notTogether || []).map((rule, index) => (
              <div
                key={`${rule[0]}-${rule[1]}`}
                className="flex justify-between items-center bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-all duration-200"
              >
                <span className="text-xs truncate">
                  {guestNameMap.get(rule[0])} ↔ {guestNameMap.get(rule[1])}
                </span>
                <button
                  onClick={() => deleteRule(rule)}
                  className="text-red-400 hover:text-red-300 transition-all duration-200"
                  aria-label={`删除规则: ${guestNameMap.get(rule[0])} 和 ${guestNameMap.get(rule[1])}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {(currentProject?.layout_data?.rules?.notTogether || []).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">暂无规则</p>
            )}
          </div>
          <button
            onClick={handleAddRule}
            className={`w-full mt-3 p-2 text-xs rounded-lg bg-gradient-to-r ${theme.primary} font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
          >
            + 添加规则
          </button>
        </div>

        <div className="flex-grow"></div>

        <div className={`p-4 bg-gradient-to-br ${theme.cardBg} rounded-lg text-sm space-y-2.5 border border-gray-700 shadow-md`}>
          <h4 className="font-bold text-md mb-3 text-gray-200">数据统计</h4>

          <StatsChart stats={stats} />

          <hr className="border-gray-700 my-3" />

          <div className="space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>宾客总数:</span>
              <span className="font-semibold">{stats.totalGuests}</span>
            </div>
            <div className="flex justify-between text-blue-400">
              <span>已签到:</span>
              <span className="font-semibold">
                {stats.checkedInCount} (
                {stats.totalGuests > 0 && stats.cancelledCount < stats.totalGuests
                  ? ((stats.checkedInCount / (stats.totalGuests - stats.cancelledCount)) * 100).toFixed(1)
                  : 0}
                %)
              </span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>已确认:</span>
              <span className="font-semibold">{stats.confirmedCount}</span>
            </div>
            <div className="flex justify-between text-yellow-400">
              <span>未确认:</span>
              <span className="font-semibold">{stats.unconfirmedCount}</span>
            </div>
            <div className="flex justify-between text-red-400">
              <span>已取消:</span>
              <span className="font-semibold">{stats.cancelledCount}</span>
            </div>
            <hr className="border-gray-700 my-2" />
            <div className="flex justify-between text-gray-300">
              <span>桌子总数:</span>
              <span className="font-semibold">{stats.tableCount}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>已安排宾客:</span>
              <span className="font-semibold">{stats.assignedGuestsCount}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>平均每桌:</span>
              <span className="font-semibold">{stats.avgGuestsPerTable}</span>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={toggleRightPanel}
        className="lg:hidden fixed bottom-4 right-4 z-20 p-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full shadow-lg"
        aria-label="打开控制面板"
      >
        ⚙️
      </button>
    </>
  );
}
