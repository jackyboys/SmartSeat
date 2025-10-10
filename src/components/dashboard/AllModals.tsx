'use client';

import React, { useState, useCallback } from 'react';
import { useSeatingStore } from '@/store/seatingStore';
import { MODAL_TYPES } from '@/constants/modalTypes';
import { theme, type Project } from './types';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

interface AllModalsProps {
  user: User | null;
  currentProject: Project | null;
  allGuests: any[];
  unassignedGuests: any[];
  projectMembers: any[];
  onSaveProject?: () => Promise<void>;
}

export function AllModals({ 
  user, 
  currentProject, 
  allGuests, 
  unassignedGuests,
  projectMembers,
  onSaveProject 
}: AllModalsProps) {
  const isModalOpen = useSeatingStore((state) => state.isModalOpen);
  const inputValue = useSeatingStore((state) => state.inputValue);
  const inputCapacity = useSeatingStore((state) => state.inputCapacity);
  const modalInputView = useSeatingStore((state) => state.modalInputView);
  const aiGuestList = useSeatingStore((state) => state.aiGuestList);
  const aiPlans = useSeatingStore((state) => state.aiPlans);
  const selectedPlanId = useSeatingStore((state) => state.selectedPlanId);
  const ruleGuests = useSeatingStore((state) => state.ruleGuests);
  const inviteEmail = useSeatingStore((state) => state.inviteEmail);
  const isAiLoading = useSeatingStore((state) => state.isLoading);

  const setInputValue = useSeatingStore((state) => state.setInputValue);
  const setInputCapacity = useSeatingStore((state) => state.setInputCapacity);
  const setModalInputView = useSeatingStore((state) => state.setModalInputView);
  const setAiGuestList = useSeatingStore((state) => state.setAiGuestList);
  const setAiPlans = useSeatingStore((state) => state.setAiPlans);
  const setSelectedPlanId = useSeatingStore((state) => state.setSelectedPlanId);
  const setRuleGuests = useSeatingStore((state) => state.setRuleGuests);
  const setInviteEmail = useSeatingStore((state) => state.setInviteEmail);
  const setIsModalOpen = useSeatingStore((state) => state.setIsModalOpen);
  const showNotification = useSeatingStore((state) => state.showNotification);
  const addGuests = useSeatingStore((state) => state.addGuests);
  const addTable = useSeatingStore((state) => state.addTable);
  const addRule = useSeatingStore((state) => state.addRule);
  const applyAiPlan = useSeatingStore((state) => state.applyAiPlan);

  // 处理添加宾客
  const handleAddGuests = useCallback(() => {
    if (!inputValue.trim()) {
      showNotification('请输入宾客姓名');
      return;
    }
    const names = inputValue.split('\n').filter(n => n.trim()).map(n => n.trim());
    addGuests(names);
    setIsModalOpen(null);
    showNotification(`成功添加 ${names.length} 位宾客`);
    if (onSaveProject) onSaveProject();
  }, [inputValue, addGuests, setIsModalOpen, showNotification, onSaveProject]);

  // 处理添加桌子
  const handleAddTable = useCallback(() => {
    if (!inputValue.trim()) {
      showNotification('请输入桌子名称');
      return;
    }
    const capacity = parseInt(inputCapacity) || 10;
    addTable(inputValue.trim(), capacity);
    setIsModalOpen(null);
    showNotification(`成功添加桌子: ${inputValue.trim()}`);
    if (onSaveProject) onSaveProject();
  }, [inputValue, inputCapacity, addTable, setIsModalOpen, showNotification, onSaveProject]);

  // 处理添加规则
  const handleAddRule = useCallback(() => {
    if (!ruleGuests.g1 || !ruleGuests.g2) {
      showNotification('请选择两位宾客');
      return;
    }
    if (ruleGuests.g1 === ruleGuests.g2) {
      showNotification('请选择不同的宾客');
      return;
    }
    addRule(ruleGuests.g1, ruleGuests.g2);
    setIsModalOpen(null);
    if (onSaveProject) onSaveProject();
  }, [ruleGuests, addRule, setIsModalOpen, showNotification, onSaveProject]);

  // 处理 AI 排座
  const handleAiSeating = useCallback(async () => {
    if (!aiGuestList.trim()) {
      showNotification('请输入宾客名单');
      return;
    }

    useSeatingStore.getState().setIsLoading(true);
    
    try {
      const response = await fetch('/api/generate-seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestList: aiGuestList,
          planCount: 3
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'AI 服务出错');
      }

      if (result.plans && result.plans.length > 0) {
        // 生成了多个方案
        const plansWithIds = result.plans.map((plan: any, index: number) => ({
          ...plan,
          id: plan.id || `plan-${Date.now()}-${index}`,
        }));

        setAiPlans(plansWithIds);
        setSelectedPlanId(plansWithIds[0]?.id || null);
        showNotification(`AI 生成了 ${plansWithIds.length} 个方案，请选择应用！`);
      } else if (result.tables) {
        // 直接返回了一个方案
        showNotification('AI 智能排座已完成！');
        setIsModalOpen(null);
        if (onSaveProject) onSaveProject();
      }
    } catch (err: any) {
      console.error('AI Seating error:', err);
      showNotification(err.message || 'AI排座失败，请重试');
    }
    
    useSeatingStore.getState().setIsLoading(false);
  }, [aiGuestList, showNotification, setAiPlans, setSelectedPlanId, setIsModalOpen, onSaveProject]);

  // 应用选中的 AI 方案
  const handleApplySelectedPlan = useCallback(() => {
    if (!selectedPlanId) {
      showNotification('请选择一个方案');
      return;
    }
    applyAiPlan(selectedPlanId);
    setIsModalOpen(null);
    if (onSaveProject) onSaveProject();
  }, [selectedPlanId, applyAiPlan, setIsModalOpen, showNotification, onSaveProject]);

  // 处理邀请协作者
  const handleInviteCollaborator = useCallback(async () => {
    if (!inviteEmail.trim()) {
      showNotification('请输入邮箱地址');
      return;
    }
    
    // TODO: 调用邀请 API
    showNotification('邀请功能开发中...');
  }, [inviteEmail, showNotification]);

  // 处理移除成员
  const handleRemoveMember = useCallback(async (memberId: string, memberEmail: string) => {
    // TODO: 调用移除成员 API
    showNotification(`已移除 ${memberEmail}`);
  }, [showNotification]);

  // 复制签到链接
  const handleCopyCheckInLink = useCallback(() => {
    if (!currentProject) return;
    const link = `${window.location.origin}/check-in/${currentProject.id}`;
    navigator.clipboard.writeText(link).then(() => {
      showNotification('链接已复制到剪贴板');
    });
  }, [currentProject, showNotification]);

  // 解析文件并添加
  const parseFileAndAdd = useCallback(async (file: File, type: 'guest' | 'table') => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        let names: string[] = [];

        if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
          // 处理文本文件
          const text = data as string;
          names = text.split(/[\r\n]+/).filter(n => n.trim());
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // 处理 Excel 文件
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
          names = jsonData.flat().filter(n => n && String(n).trim());
        }

        if (names.length === 0) {
          showNotification('文件中没有找到有效数据');
          return;
        }

        if (type === 'guest') {
          const guestNames = names.map(name => String(name).trim());
          addGuests(guestNames);
          showNotification(`成功导入 ${names.length} 位宾客`);
        } else {
          names.forEach(name => addTable(String(name).trim(), 10));
          showNotification(`成功导入 ${names.length} 个桌子`);
        }

        setIsModalOpen(null);
        if (onSaveProject) onSaveProject();
      } catch (error) {
        showNotification('文件解析失败，请检查格式');
        console.error('File parse error:', error);
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  }, [addGuests, addTable, setIsModalOpen, showNotification, onSaveProject]);

  // 渲染添加宾客 Modal
  const renderAddGuestModal = () => (
    <>
      <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">添加宾客</h3>
      <div className="flex justify-center mb-6 border-b border-gray-700">
        <button
          onClick={() => setModalInputView('manual')}
          className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'manual' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          手动输入
        </button>
        <button
          onClick={() => setModalInputView('import')}
          className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'import' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          从文件导入
        </button>
      </div>
      {modalInputView === 'manual' ? (
        <>
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="每行输入一位宾客姓名&#10;例如：&#10;张三&#10;李四&#10;王五"
            className="w-full p-3 bg-gray-700 rounded-lg h-40 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 resize-none"
            aria-label="宾客姓名列表"
          />
          <button
            onClick={handleAddGuests}
            className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
          >
            添加
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">支持 .txt, .csv, .xlsx 文件, 每行一个名称。</p>
          <input
            type="file"
            accept=".txt,.csv,.xlsx,.xls"
            onChange={(e) => { if (e.target.files?.[0]) { parseFileAndAdd(e.target.files[0], 'guest'); } }}
            className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-200 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer file:hover:bg-blue-500"
          />
        </>
      )}
    </>
  );

  // 渲染添加桌子 Modal
  const renderAddTableModal = () => (
    <>
      <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">添加新桌</h3>
      <div className="flex justify-center mb-6 border-b border-gray-700">
        <button
          onClick={() => setModalInputView('manual')}
          className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'manual' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          手动输入
        </button>
        <button
          onClick={() => setModalInputView('import')}
          className={`px-6 py-3 font-semibold transition-all duration-200 ${modalInputView === 'import' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          从文件导入
        </button>
      </div>
      {modalInputView === 'manual' ? (
        <>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 font-medium mb-2 block">桌子名称</label>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="例如：主桌, 1号桌"
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                aria-label="桌子名称"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 font-medium mb-2 block">容量 (人)</label>
              <input
                type="number"
                value={inputCapacity}
                onChange={e => setInputCapacity(e.target.value)}
                placeholder="10"
                min="1"
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                aria-label="桌子容量"
              />
            </div>
          </div>
          <button
            onClick={handleAddTable}
            className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
          >
            添加
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">支持 .txt, .csv, .xlsx 文件, 每行一个名称。</p>
          <input
            type="file"
            accept=".txt,.csv,.xlsx,.xls"
            onChange={(e) => { if (e.target.files?.[0]) { parseFileAndAdd(e.target.files[0], 'table'); } }}
            className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-200 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer file:hover:bg-blue-500"
          />
        </>
      )}
    </>
  );

  // 渲染 AI 排座 Modal
  const renderAiSeatingModal = () => (
    <>
      <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">AI 智能排座</h3>

      {aiPlans.length === 0 ? (
        <>
          <textarea
            value={aiGuestList}
            onChange={e => setAiGuestList(e.target.value)}
            placeholder="在此粘贴您的完整宾客名单..."
            className="w-full p-3 bg-gray-700 rounded-lg h-60 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 resize-none"
            aria-label="宾客名单"
          />
          <button
            onClick={handleAiSeating}
            disabled={isAiLoading}
            className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.primary} rounded-lg font-semibold hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:transform-none disabled:shadow-none`}
          >
            {isAiLoading ? "生成中..." : "开始生成"}
          </button>
        </>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-gray-300 mb-4">AI为您生成了 {aiPlans.length} 个不同的座位安排方案，请选择一个应用：</p>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {aiPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedPlanId === plan.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-white">{plan.name}</h4>
                    <span className="text-sm px-2 py-1 bg-green-500/20 text-green-400 rounded">
                      评分: {Math.round(plan.score)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{plan.analysis}</p>
                  <p className="text-xs text-gray-500">{plan.scenario}</p>
                  <div className="mt-2 text-xs text-gray-400">
                    共 {plan.tables.length} 桌，{plan.tables.reduce((sum: number, t: any) => sum + t.guests.length, 0)} 位宾客
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setAiPlans([]);
                setSelectedPlanId(null);
              }}
              className="flex-1 p-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors"
            >
              重新生成
            </button>
            <button
              onClick={handleApplySelectedPlan}
              disabled={!selectedPlanId}
              className={`flex-1 p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300`}
            >
              应用方案
            </button>
          </div>
        </>
      )}
    </>
  );

  // 渲染添加规则 Modal
  const renderAddRuleModal = () => (
    <>
      <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">添加"不宜同桌"规则</h3>
      <div className='space-y-5'>
        <div>
          <label className='text-sm text-gray-400 font-medium mb-2 block'>选择宾客 1</label>
          <select
            value={ruleGuests.g1}
            onChange={e => setRuleGuests({ ...ruleGuests, g1: e.target.value })}
            className="w-full p-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
            aria-label="选择第一位宾客"
          >
            <option value="">-- 请选择 --</option>
            {allGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className='text-sm text-gray-400 font-medium mb-2 block'>选择宾客 2</label>
          <select
            value={ruleGuests.g2}
            onChange={e => setRuleGuests({ ...ruleGuests, g2: e.target.value })}
            className="w-full p-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
            aria-label="选择第二位宾客"
          >
            <option value="">-- 请选择 --</option>
            {allGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>
      <button
        onClick={handleAddRule}
        className={`mt-6 w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
      >
        添加规则
      </button>
    </>
  );

  // 渲染签到 Modal
  const renderCheckInModal = () => (
    <>
      <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">📱 现场签到模式</h3>
      
      <div className="space-y-6">
        <div className="bg-gray-700/50 p-6 rounded-xl border border-gray-600">
          <p className="text-sm text-gray-300 mb-4">使用以下二维码或链接让宾客现场签到：</p>
          
          <div className="flex justify-center mb-6 bg-white p-4 rounded-lg">
            <QRCodeSVG 
              value={`${window.location.origin}/check-in/${currentProject?.id}`}
              size={200}
              level="H"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm text-gray-400 font-medium block">签到链接</label>
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/check-in/${currentProject?.id}`}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-600 text-gray-300 text-sm select-all"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            
            <button
              onClick={handleCopyCheckInLink}
              className={`w-full p-3 bg-gradient-to-r ${theme.primary} rounded-lg font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
            >
              📋 复制链接
            </button>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-sm text-yellow-200">
            💡 <strong>提示：</strong>将此二维码打印出来放置在入口处，或将链接分享给宾客，他们即可通过手机完成签到。
          </p>
        </div>
      </div>
    </>
  );

  // 渲染邀请协作者 Modal
  const renderInviteCollaboratorModal = () => (
    <>
      <h3 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
        邀请协作者
      </h3>
      
      {currentProject && currentProject.user_id !== user?.id && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-200">
            ⚠️ 只有项目所有者可以邀请协作者
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 font-medium mb-2 block">
            协作者邮箱
          </label>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
            disabled={currentProject?.user_id !== user?.id}
          />
        </div>
        
        {projectMembers.length > 0 && (
          <div>
            <label className="text-sm text-gray-400 font-medium mb-2 block">
              当前协作者
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {projectMembers.map(member => (
                <div 
                  key={member.id}
                  className="flex justify-between items-center bg-gray-700 p-3 rounded-lg"
                >
                  <div>
                    <p className="text-sm text-white">{member.email}</p>
                    <p className="text-xs text-gray-400">
                      {member.role === 'owner' ? '所有者' : member.role === 'editor' ? '编辑者' : '查看者'}
                    </p>
                  </div>
                  {currentProject?.user_id === user?.id && member.user_id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.email)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      移除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <button
          onClick={handleInviteCollaborator}
          disabled={currentProject?.user_id !== user?.id}
          className={`w-full p-3 bg-gradient-to-r ${theme.success} rounded-lg font-semibold hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:transform-none`}
        >
          发送邀请
        </button>
      </div>
    </>
  );

  // 根据当前 Modal 类型渲染对应内容
  if (isModalOpen === MODAL_TYPES.ADD_GUEST) {
    return renderAddGuestModal();
  } else if (isModalOpen === MODAL_TYPES.ADD_TABLE) {
    return renderAddTableModal();
  } else if (isModalOpen === MODAL_TYPES.AI_SEATING) {
    return renderAiSeatingModal();
  } else if (isModalOpen === MODAL_TYPES.ADD_RULE) {
    return renderAddRuleModal();
  } else if (isModalOpen === MODAL_TYPES.CHECK_IN) {
    return renderCheckInModal();
  } else if (isModalOpen === MODAL_TYPES.INVITE_COLLABORATOR) {
    return renderInviteCollaboratorModal();
  }

  return null;
}
