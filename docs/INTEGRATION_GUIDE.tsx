/**
 * 重构后的 Dashboard 页面 - 集成示例
 * 
 * 这个文件展示如何将新创建的组件集成到现有的 dashboard/page.tsx 中
 * 
 * 重构步骤:
 * 1. 在现有 dashboard/page.tsx 顶部添加新的 import 语句
 * 2. 找到对应的 JSX 部分 (左侧面板/中间区域/右侧面板)
 * 3. 用新组件替换旧的 JSX 代码
 * 4. 确保传递正确的 props
 * 5. 测试功能
 */

// ============================================================
// 第一步: 在 dashboard/page.tsx 开头添加这些 imports
// ============================================================

import { UnassignedGuestsPanel } from '@/components/dashboard/UnassignedGuestsPanel';
import { TablesGrid } from '@/components/dashboard/TablesGrid';
import { TableCard } from '@/components/dashboard/TableCard';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { ConfirmDialog, ModalWrapper } from '@/components/dashboard';
import type { Guest, SeatingTable, GuestStatus } from '@/components/dashboard/types';

// ============================================================
// 第二步: 添加新的 state (如果尚未存在)
// ============================================================

// 在 DashboardPage 函数组件内部添加:
const [leftPanelOpen, setLeftPanelOpen] = useState(false);
const [searchTerm, setSearchTerm] = useState('');
const [statusFilters, setStatusFilters] = useState<Set<GuestStatus>>(new Set());

// ============================================================
// 第三步: 替换 JSX 中的左侧面板
// ============================================================

// 查找现有代码中的左侧 <aside> 标签 (大约在第 2800-3000 行)
// 它包含 "未分配宾客" 标题和搜索框
// 用以下代码替换整个 <aside>...</aside> 部分:

<UnassignedGuestsPanel
  unassignedGuests={unassignedGuests}
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  statusFilters={statusFilters}
  onStatusFilterToggle={(status) => {
    const newFilters = new Set(statusFilters);
    if (newFilters.has(status)) {
      newFilters.delete(status);
    } else {
      newFilters.add(status);
    }
    setStatusFilters(newFilters);
  }}
  onAddGuest={() => {
    setInputValue('');
    setModalInputView('manual');
    setIsModalOpen('addGuest');
  }}
  onImportGuests={() => {
    setModalInputView('import');
    setIsModalOpen('addGuest');
  }}
  onRemoveGuest={(guestId) => {
    const guest = unassignedGuests.find(g => g.id === guestId);
    if (guest) {
      setDeleteUnassignedConfirm({ guestId, guestName: guest.name });
    }
  }}
  onEditGuest={(guest) => {
    // 实现编辑宾客逻辑
    // 可以打开一个编辑 modal 或内联编辑
  }}
  onCheckInGuest={(guest) => {
    // 实现签到逻辑
    setActiveGuest(guest);
    setIsModalOpen('checkIn');
  }}
  leftPanelOpen={leftPanelOpen}
  onTogglePanel={() => setLeftPanelOpen(!leftPanelOpen)}
/>

// ============================================================
// 第四步: 替换 JSX 中的中间桌子网格区域
// ============================================================

// 查找现有代码中的主要 <main> 标签或桌子网格的 <div>
// 它包含 tables.map() 循环渲染桌子
// 用以下代码替换:

<TablesGrid
  tables={tables}
  onRemoveGuest={handleRemoveGuestFromTable}
  onEditGuest={(guest) => {
    // 编辑宾客逻辑
  }}
  onCheckInGuest={(guest) => {
    setActiveGuest(guest);
    setIsModalOpen('checkIn');
  }}
  onEditTable={(table) => {
    // 编辑桌子逻辑
    // 打开编辑 modal 并填充数据
  }}
  onDeleteTable={(tableId) => {
    showConfirm(
      '确认删除',
      '确定要删除这个桌子吗？桌上的宾客将移回未分配区域。',
      () => {
        const table = tables.find(t => t.id === tableId);
        if (table) {
          setUnassignedGuests(prev => [...prev, ...table.guests]);
          setTables(prev => prev.filter(t => t.id !== tableId));
          markChanges();
          broadcastLayoutChange(tables.filter(t => t.id !== tableId), unassignedGuests);
          showNotification('桌子已删除');
        }
      },
      'danger'
    );
  }}
/>

// ============================================================
// 第五步: 替换 JSX 中的右侧控制面板
// ============================================================

// 查找现有代码中的右侧 <aside> 标签
// 它包含 "控制面板" 标题和各种按钮
// 用以下代码替换整个右侧 <aside>...</aside> 部分:

<ControlPanel
  stats={stats}
  currentProject={currentProject}
  guestNameMap={guestNameMap}
  onAddTable={() => {
    setInputValue('');
    setInputCapacity('10');
    setModalInputView('manual');
    setIsModalOpen('addTable');
  }}
  onAISeating={() => {
    setAiGuestList(unassignedGuests.map(g => g.name).join('\n'));
    setIsModalOpen('aiSeating');
  }}
  onResetLayout={() => {
    showConfirm(
      '确认重置',
      '这将清空所有桌子并将所有宾客移回未分配区域。此操作不可撤销。',
      () => {
        const allGuestsReset = [...unassignedGuests, ...tables.flatMap(t => t.guests)];
        setUnassignedGuests(allGuestsReset);
        setTables([]);
        markChanges();
        broadcastLayoutChange([], allGuestsReset);
        showNotification('布局已重置');
      },
      'danger'
    );
  }}
  onExportPdf={handleExportPdf}
  onExportPlaceCards={handleExportPlaceCards}
  onAddRule={() => {
    setRuleGuests({ g1: '', g2: '' });
    setIsModalOpen('addRule');
  }}
  onDeleteRule={(rule) => {
    if (!currentProject || !currentProject.layout_data) return;
    const updatedRules = (currentProject.layout_data.rules?.notTogether || [])
      .filter(r => !(r[0] === rule[0] && r[1] === rule[1]));
    setCurrentProject({
      ...currentProject,
      layout_data: {
        ...currentProject.layout_data,
        rules: { notTogether: updatedRules }
      }
    });
    markChanges();
    showNotification('规则已删除');
  }}
  onManageProjects={() => setSidebarOpen(true)}
  onManageCollaborators={() => setIsModalOpen('inviteCollaborator')}
  rightPanelOpen={rightPanelOpen}
  onTogglePanel={() => setRightPanelOpen(!rightPanelOpen)}
/>

// ============================================================
// 完整的 JSX 结构示例
// ============================================================

/**
 * 重构后的主要返回结构应该是:
 * 
 * return (
 *   <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
 *     {/* 左侧项目列表边栏 - 保持原样 *\/}
 *     <aside className={...}>...</aside>
 * 
 *     <div className="flex-1 flex overflow-hidden">
 *       <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
 *         
 *         {/* ⭐ 新组件: 左侧未分配宾客面板 *\/}
 *         <UnassignedGuestsPanel {...props} />
 *         
 *         {/* ⭐ 新组件: 中间桌子网格 *\/}
 *         <TablesGrid {...props} />
 *         
 *         {/* ⭐ 新组件: 右侧控制面板 *\/}
 *         <ControlPanel {...props} />
 *         
 *         <DragOverlay>{activeGuest && <div>...</div>}</DragOverlay>
 *       </DndContext>
 *     </div>
 * 
 *     {/* Modals - 保持原样,后续任务继续优化 *\/}
 *     <ModalWrapper isOpen={isModalOpen === 'addGuest'} onClose={...}>
 *       ...
 *     </ModalWrapper>
 *     
 *     {/* ⭐ 新组件: 确认对话框 *\/}
 *     <ConfirmDialog {...confirmDialog} />
 *     
 *     {/* 通知 - 保持原样 *\/}
 *     {notification && <div>...</div>}
 *   </div>
 * );
 */

// ============================================================
// 迁移检查清单
// ============================================================

/**
 * ✅ 完成标记:
 * 
 * [ ] 1. 导入所有新组件
 * [ ] 2. 添加新的 state 变量 (leftPanelOpen, searchTerm, statusFilters)
 * [ ] 3. 替换左侧面板 JSX 为 <UnassignedGuestsPanel />
 * [ ] 4. 替换中间区域 JSX 为 <TablesGrid />
 * [ ] 5. 替换右侧面板 JSX 为 <ControlPanel />
 * [ ] 6. 测试拖拽功能
 * [ ] 7. 测试搜索和筛选
 * [ ] 8. 测试所有按钮和操作
 * [ ] 9. 测试响应式布局 (移动端)
 * [ ] 10. 测试实时协作功能
 * 
 * 注意事项:
 * - 保持所有业务逻辑函数不变
 * - 不要修改 state 管理逻辑
 * - 确保 props 名称匹配
 * - 测试前先备份原文件
 */

// ============================================================
// 已知需要适配的函数
// ============================================================

/**
 * 这些函数可能需要轻微调整以匹配新组件的接口:
 * 
 * 1. handleRemoveGuestFromTable - 已存在,直接使用
 * 2. handleEditGuest - 可能需要创建
 * 3. handleCheckInGuest - 可能需要创建或重命名
 * 4. handleEditTable - 可能需要创建
 * 5. handleDeleteTable - 可能需要创建
 * 
 * 如果这些函数不存在,参考原代码中的相应逻辑创建它们
 */

export {};
