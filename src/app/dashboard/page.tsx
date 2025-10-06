'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { DndContext, rectIntersection, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// --- 数据结构 ---
interface Guest { id: string; name: string; }
interface SeatingTable { id: string; tableName: string; guests: Guest[]; }
interface Project { id: number; name: string; layout_data: { tables: SeatingTable[]; unassignedGuests: Guest[]; } | null; }

// --- UI 组件 ---
const DraggableGuest = ({ guest, onDelete, tableId }: { guest: Guest; onDelete: (guestId: string, tableId?: string) => void; tableId?: string; }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: guest.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(guest.id, tableId);
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-testid="guest-item" data-guest-name={guest.name} className="group p-2 bg-gray-600 rounded-md text-white cursor-grab active:cursor-grabbing shadow-sm text-sm flex justify-between items-center">
      <span>{guest.name}</span>
      <button onClick={handleDelete} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">✕</button>
    </div>
  );
};

const Modal = ({ children, onClose }: { children: React.ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
    <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

// 可投放容器：为“未分配宾客”区和各桌子提供可放置区域，支持空列表时的放置
const DroppableContainer = ({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}`}>
      {children}
    </div>
  );
};

// --- 主页面 ---
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<'newProject' | 'addGuest' | 'addTable' | 'aiSeating' | null>(null);
  const [modalInputView, setModalInputView] = useState<'manual' | 'import'>('manual');
  const [inputValue, setInputValue] = useState('');
  const [aiGuestList, setAiGuestList] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ guestId: string; tableId: string; guestName: string } | null>(null);
  const [deleteUnassignedConfirm, setDeleteUnassignedConfirm] = useState<{ guestId: string; guestName: string } | null>(null);

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const stats = useMemo(() => {
    const assignedGuests = tables.reduce((sum, table) => sum + table.guests.length, 0);
    const totalGuests = assignedGuests + unassignedGuests.length;
    const tableCount = tables.length;
    const avgGuestsPerTable = tableCount > 0 ? (assignedGuests / tableCount).toFixed(1) : 0;
    return { totalGuests, tableCount, avgGuestsPerTable };
  }, [tables, unassignedGuests]);
  
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveProject = useCallback(async () => {
    if (!currentProject || !user || !hasUnsavedChanges || isSaving) return null;

    if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
    }

    setIsSaving(true);
    const layout_data = { tables, unassignedGuests };
    let savedProject: Project | null = null;
    
    try {
      if (currentProject.id < 0) {
        const { data, error } = await supabase.from('projects').insert({ name: currentProject.name, layout_data, user_id: user.id }).select().single();
        if (error) { 
          console.error('Insert project error:', error);
          showNotification(`创建失败: ${error.message}`, 'error'); 
          setIsSaving(false);
          return null;
        } 
        else if(data) {
          showNotification('项目已创建并保存！', 'success');
          savedProject = data;
          const newProjects = projects.map(p => p.id === currentProject.id ? data : p);
          setProjects(newProjects);
          setCurrentProject(data);
        }
      } else {
        const { error } = await supabase.from('projects').update({ name: currentProject.name, layout_data }).eq('id', currentProject.id);
        if (error) { 
          console.error('Update project error:', error);
          showNotification(`保存失败: ${error.message}`, 'error'); 
          setIsSaving(false);
          return null;
        }
        else {
          showNotification('项目已保存！', 'success');
          savedProject = { ...currentProject, layout_data };
          setProjects(projects.map(p => p.id === currentProject.id ? {...p, name: currentProject.name, layout_data} : p));
        }
      }
    } catch (err: any) {
      console.error('Save project error:', err);
      showNotification(`保存出错: ${err.message}`, 'error');
      setIsSaving(false);
      return null;
    }
    
    setIsSaving(false);
    setHasUnsavedChanges(false);
    return savedProject;
  }, [currentProject, user, hasUnsavedChanges, tables, unassignedGuests, projects, isSaving]);

  const markChanges = useCallback(() => {
    setHasUnsavedChanges(true);
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    if (autoSaveEnabled) {
      autoSaveTimeout.current = setTimeout(() => {
         handleSaveProject();
      }, 1000);
    }
  }, [handleSaveProject, autoSaveEnabled]);
  
  const handleLoadProject = useCallback(async (project: Project) => {
    if (currentProject?.id === project.id) return;
    
    if (hasUnsavedChanges) {
      if (window.confirm('您有未保存的更改。是否要在切换前保存？\n\n- 按“确定”保存并切换。\n- 按“取消”放弃更改并切换。')) {
        await handleSaveProject();
      }
    }

    setCurrentProject(project);
    const layout = project.layout_data;
    setTables(layout?.tables.map((t: SeatingTable) => ({
      ...t,
      id: t.id || uuidv4(),
      guests: t.guests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() }))
    })) || []);
    setUnassignedGuests(layout?.unassignedGuests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() })) || []);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, handleSaveProject, currentProject]);

  const fetchProjectsAndLoadFirst = useCallback(async (userToFetch: User) => {
    const { data, error } = await supabase.from('projects').select('id, name, layout_data').eq('user_id', userToFetch.id).order('created_at', { ascending: false });
    if (error) {
      showNotification(`加载项目失败: ${error.message}`, 'error');
    } else {
      setProjects(data || []);
      if (data && data.length > 0) {
        const projectToLoad = data[0];
        setCurrentProject(projectToLoad);
        const layout = projectToLoad.layout_data;
        setTables(layout?.tables.map((t: SeatingTable) => ({
          ...t,
          id: t.id || uuidv4(),
          guests: t.guests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() }))
        })) || []);
        setUnassignedGuests(layout?.unassignedGuests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() })) || []);
      } else {
        const newProj: Project = { id: -1, name: '我的第一个项目', layout_data: { tables: [], unassignedGuests: [] } };
        setCurrentProject(newProj); setTables([]); setUnassignedGuests([]);
      }
    }
    setIsLoading(false);
  }, []);

  const handleNewProject = () => {
    if (!inputValue.trim()) { showNotification('项目名称不能为空', 'error'); return; }
    if (hasUnsavedChanges) {
        if (!confirm('您有未保存的更改，确定要创建新项目吗？所有未保存的更改将丢失。')) return;
    }
    const tempId = -Date.now();
    const newProj: Project = { id: tempId, name: inputValue, layout_data: { tables: [], unassignedGuests: [] } };
    setProjects([newProj, ...projects]);
    handleLoadProject(newProj);
    setIsModalOpen(null); setInputValue('');
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm('您确定要删除此项目吗？此操作无法撤销。')) return;
    if (projectId < 0) {
        const newProjects = projects.filter(p => p.id !== projectId);
        setProjects(newProjects);
        showNotification('项目已成功删除');
        if (newProjects.length > 0) { handleLoadProject(newProjects[0]); }
        else { const newProj: Project = { id: -Date.now(), name: '新项目', layout_data: null }; setCurrentProject(newProj); setTables([]); setUnassignedGuests([]); }
        return;
    }
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) { showNotification(`删除失败: ${error.message}`, 'error'); }
    else {
      showNotification('项目已成功删除');
      const newProjects = projects.filter(p => p.id !== projectId);
      setProjects(newProjects);
      if (currentProject?.id === projectId) {
        if (newProjects.length > 0) handleLoadProject(newProjects[0]);
        else { const newProj: Project = { id: -Date.now(), name: '新项目', layout_data: null }; setCurrentProject(newProj); setTables([]); setUnassignedGuests([]); }
      }
    }
  };

  const parseFileAndAdd = (file: File, type: 'guest' | 'table') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') throw new Error('无法读取文件内容');
        let names: string[] = [];
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
            names = Papa.parse(content, { header: false }).data.flat().map(n => String(n).trim()).filter(Boolean);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const workbook = XLSX.read(content, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            names = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).flat().map(n => String(n).trim()).filter(Boolean);
        } else {
            throw new Error('不支持的文件格式. 请使用 .txt, .csv, 或 .xlsx');
        }

        if(type === 'guest') {
            const newGuests: Guest[] = names.map(name => ({ id: uuidv4(), name }));
            setUnassignedGuests(g => [...g, ...newGuests]);
        } else {
            const newTables: SeatingTable[] = names.map(name => ({ id: uuidv4(), tableName: name, guests: [] }));
            setTables(t => [...t, ...newTables]);
        }
        showNotification(`成功导入 ${names.length} 个条目！`);
        setIsModalOpen(null);
        markChanges();
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    };
    reader.onerror = () => showNotification('读取文件时发生错误', 'error');
    reader.readAsBinaryString(file);
  };
  
  const handleAddGuests = () => {
    const names = inputValue.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) { showNotification('请输入宾客姓名', 'error'); return; }
    const newGuests: Guest[] = names.map(name => ({ id: uuidv4(), name }));
    setUnassignedGuests([...unassignedGuests, ...newGuests]);
    setIsModalOpen(null); setInputValue(''); markChanges();
  };

  const handleAddTable = () => {
    if (!inputValue.trim()) { showNotification('桌子名称不能为空', 'error'); return; }
    const newTable: SeatingTable = { id: uuidv4(), tableName: inputValue, guests: [] };
    setTables([...tables, newTable]);
    setIsModalOpen(null); setInputValue('');
    // 等待一次渲染后标记更改，避免在某些设备上拖放容器未即时挂载
    setTimeout(() => { markChanges(); }, 0);
  };

  const handleDeleteGuest = (guestId: string) => {
    const guest = unassignedGuests.find(g => g.id === guestId);
    if (!guest) return;
    
    setDeleteUnassignedConfirm({ guestId, guestName: guest.name });
  };

  const handleConfirmDeleteUnassigned = () => {
    if (!deleteUnassignedConfirm) return;
    
    const { guestId } = deleteUnassignedConfirm;
    
    // 从未分配宾客中删除
    setUnassignedGuests(prev => prev.filter(g => g.id !== guestId));
    // 从所有桌子中删除
    setTables(prev => prev.map(t => ({...t, guests: t.guests.filter(g => g.id !== guestId)})));
    
    setDeleteUnassignedConfirm(null);
    markChanges();
  };

  const handleRemoveGuestFromTable = (guestId: string, tableId: string) => {
    const guest = tables.find(t => t.id === tableId)?.guests.find(g => g.id === guestId);
    if (!guest) return;

    setDeleteConfirm({ guestId, tableId, guestName: guest.name });
  };

  const handleConfirmDelete = (action: 'move' | 'delete') => {
    if (!deleteConfirm) return;
    
    const { guestId, tableId, guestName } = deleteConfirm;
    const guest = tables.find(t => t.id === tableId)?.guests.find(g => g.id === guestId);
    if (!guest) return;

    if (action === 'move') {
      // 移动到未分配区
      setTables(prev => prev.map(t => 
        t.id === tableId 
          ? {...t, guests: t.guests.filter(g => g.id !== guestId)}
          : t
      ));
      setUnassignedGuests(prev => [...prev, guest]);
      showNotification('宾客已移动到未分配区');
    } else {
      // 彻底删除
      setTables(prev => prev.map(t => ({...t, guests: t.guests.filter(g => g.id !== guestId)})));
      showNotification('宾客已彻底删除');
    }
    
    setDeleteConfirm(null);
    markChanges();
  };

  const handleDeleteTable = (tableId: string) => {
    if (!confirm('您确定要删除这张桌子吗？桌上所有宾客将移至未分配区。')) return;
    const tableToMove = tables.find(t => t.id === tableId);
    if (tableToMove) setUnassignedGuests([...unassignedGuests, ...tableToMove.guests]);
    setTables(tables.filter(t => t.id !== tableId));
    markChanges();
  };

  const handleAiSeating = async () => {
    if (!aiGuestList.trim()) { showNotification('宾客名单不能为空', 'error'); return; }
    setIsAiLoading(true);
    try {
        const response = await fetch('/api/generate-seating', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestList: aiGuestList }),
        });
        const result = await response.json();
        if(!response.ok) throw new Error(result.error || 'AI 服务出错');
        
        const aiTables: SeatingTable[] = result.tables.map((t: any) => ({
            id: uuidv4(),
            tableName: t.tableName,
            guests: t.guests.map((gName: string) => ({ id: uuidv4(), name: gName }))
        }));
        setTables(aiTables);
        setUnassignedGuests([]);
        showNotification('AI 智能排座已完成！');
        markChanges();
    } catch (err: any) {
        showNotification(err.message, 'error');
    }
    setIsAiLoading(false);
    setIsModalOpen(null);
  };
  
  const handleExportPdf = () => {
    if (!currentProject) { 
      showNotification('请先选择一个项目', 'error'); 
      return; 
    }
    
    showNotification('正在生成PDF，请稍候...');
    
    try {
      // 创建HTML内容
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              margin: 20px; 
              font-size: 14px;
            }
            h1 { 
              text-align: center; 
              color: #333; 
              margin-bottom: 10px;
              font-size: 24px;
            }
            .timestamp { 
              text-align: center; 
              color: #666; 
              margin-bottom: 30px;
              font-size: 12px;
            }
            h2 { 
              color: #444; 
              border-bottom: 2px solid #ddd; 
              padding-bottom: 5px;
              margin-top: 25px;
            }
            .table-section { 
              margin-bottom: 20px; 
              page-break-inside: avoid;
            }
            .table-title { 
              font-weight: bold; 
              font-size: 16px; 
              color: #333;
              margin-bottom: 8px;
            }
            .guest-list { 
              margin-left: 20px; 
            }
            .guest-item { 
              margin: 3px 0; 
            }
            .stats { 
              margin-top: 30px; 
              border-top: 2px solid #ddd; 
              padding-top: 15px;
            }
            .stats h2 { 
              border: none; 
              margin-top: 0; 
            }
            .stat-item { 
              margin: 5px 0; 
              margin-left: 20px;
            }
            @media print {
              body { margin: 0; }
              .table-section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${currentProject.name}</h1>
          <div class="timestamp">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
          
          <h2>座位安排详情</h2>
      `;
      
      // 添加桌子信息
      tables.forEach((table) => {
        htmlContent += `
          <div class="table-section">
            <div class="table-title">${table.tableName} (${table.guests.length}人)</div>
            <div class="guest-list">
        `;
        
        if (table.guests.length > 0) {
          table.guests.forEach((guest, index) => {
            htmlContent += `<div class="guest-item">${index + 1}. ${guest.name}</div>`;
          });
        } else {
          htmlContent += `<div class="guest-item">(暂无宾客)</div>`;
        }
        
        htmlContent += `
            </div>
          </div>
        `;
      });
      
      // 添加未分配宾客
      if (unassignedGuests.length > 0) {
        htmlContent += `
          <div class="table-section">
            <div class="table-title">未分配宾客 (${unassignedGuests.length}人)</div>
            <div class="guest-list">
        `;
        
        unassignedGuests.forEach((guest, index) => {
          htmlContent += `<div class="guest-item">${index + 1}. ${guest.name}</div>`;
        });
        
        htmlContent += `
            </div>
          </div>
        `;
      }
      
      // 添加统计信息
      const totalGuests = tables.reduce((sum, table) => sum + table.guests.length, 0) + unassignedGuests.length;
      const assignedGuests = tables.reduce((sum, table) => sum + table.guests.length, 0);
      
      htmlContent += `
          <div class="stats">
            <h2>统计信息</h2>
            <div class="stat-item">总桌数: ${tables.length}</div>
            <div class="stat-item">总宾客数: ${totalGuests}</div>
            <div class="stat-item">已安排宾客: ${assignedGuests}</div>
            <div class="stat-item">未安排宾客: ${unassignedGuests.length}</div>
          </div>
        </body>
        </html>
      `;
      
      // 创建隐藏的iframe来渲染HTML
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '794px'; // A4宽度
      iframe.style.height = '1123px'; // A4高度
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('无法创建PDF渲染环境');
      }
      
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      // 等待内容加载完成后截图
      setTimeout(() => {
        html2canvas(iframeDoc.body, { 
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123
        }).then(canvas => {
          try {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'px', [794, 1123]);
            
            // 计算图片尺寸以适应PDF页面
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // 如果内容高度超过一页，需要分页
            if (imgHeight > pdfHeight) {
              let remainingHeight = imgHeight;
              let yOffset = 0;
              
              while (remainingHeight > 0) {
                const pageHeight = Math.min(remainingHeight, pdfHeight);
                
                // 创建新页面（除了第一页）
                if (yOffset > 0) {
                  pdf.addPage();
                }
                
                // 裁剪并添加图片
                const cropCanvas = document.createElement('canvas');
                const cropCtx = cropCanvas.getContext('2d');
                cropCanvas.width = imgWidth;
                cropCanvas.height = pageHeight;
                
                if (cropCtx) {
                  cropCtx.drawImage(canvas, 0, -yOffset);
                  const cropImgData = cropCanvas.toDataURL('image/png');
                  pdf.addImage(cropImgData, 'PNG', 0, 0, pdfWidth, pageHeight);
                }
                
                yOffset += pageHeight;
                remainingHeight -= pageHeight;
              }
            } else {
              pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            }
            
            pdf.save(`${currentProject.name}_座位安排.pdf`);
            showNotification('PDF导出成功！');
            
            // 清理临时元素
            document.body.removeChild(iframe);
            
          } catch (e) {
            console.error('PDF生成错误:', e);
            showNotification('导出PDF失败，请重试', 'error');
            document.body.removeChild(iframe);
          }
        }).catch(error => {
          console.error('截图失败:', error);
          showNotification('导出PDF失败，请重试', 'error');
          document.body.removeChild(iframe);
        });
      }, 1000); // 给HTML渲染1秒时间
      
    } catch (error) {
      console.error('PDF导出错误:', error);
      showNotification('导出PDF失败，请重试', 'error');
    }
  };

  const findContainer = (id: string) => {
    if (unassignedGuests.some(g => g.id === id) || id === 'unassigned-area') return 'unassigned-area';
    for (const table of tables) { if (table.guests.some(g => g.id === id) || table.id === id) return table.id; }
    return null;
  };
  
  const handleDragStart = (event: DragStartEvent) => {
    const guestId = event.active.id as string;
    const allGuests = [...unassignedGuests, ...tables.flatMap(t => t.guests)];
    setActiveGuest(allGuests.find(g => g.id === guestId) || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGuest(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    
    const originalContainerId = findContainer(activeId);
    const overContainerId = findContainer(overId);

  if (!originalContainerId || !overContainerId) return;

    if (originalContainerId === overContainerId) {
        if (activeId === overId) return;
        if (originalContainerId === 'unassigned-area') {
            setUnassignedGuests(guests => {
                const oldIndex = guests.findIndex(g => g.id === activeId);
                const newIndex = guests.findIndex(g => g.id === overId);
                return arrayMove(guests, oldIndex, newIndex);
            });
        } else {
            setTables(currentTables => currentTables.map(table => {
                if (table.id === originalContainerId) {
                    const oldIndex = table.guests.findIndex(g => g.id === activeId);
                    const newIndex = table.guests.findIndex(g => g.id === overId);
                    return { ...table, guests: arrayMove(table.guests, oldIndex, newIndex) };
                }
                return table;
            }));
        }
    } else {
        let draggedGuest: Guest | undefined;
        let nextUnassigned = [...unassignedGuests];
        let nextTables = JSON.parse(JSON.stringify(tables));

        if (originalContainerId === 'unassigned-area') {
            const index = nextUnassigned.findIndex(g => g.id === activeId);
            [draggedGuest] = nextUnassigned.splice(index, 1);
        } else {
          const table = nextTables.find((t: SeatingTable) => t.id === originalContainerId);
          if (table) {
            const index = table.guests.findIndex((g: Guest) => g.id === activeId);
            [draggedGuest] = table.guests.splice(index, 1);
          }
        }

        if (!draggedGuest) return;

        if (overContainerId === 'unassigned-area') {
            // 拖回未分配区：若目标 guest 存在则按其位置插入，否则追加
            const overGuestIndex = nextUnassigned.findIndex(g => g.id === overId);
            if (overGuestIndex !== -1) {
              nextUnassigned.splice(overGuestIndex, 0, draggedGuest);
            } else {
              nextUnassigned.push(draggedGuest);
            }
        } else {
            const table = nextTables.find((t: SeatingTable) => t.id === overContainerId);
            if(table) {
                const overGuestIndex = table.guests.findIndex((g: Guest) => g.id === overId);
                if (overGuestIndex !== -1) {
                    table.guests.splice(overGuestIndex, 0, draggedGuest);
                } else {
                    table.guests.push(draggedGuest);
                }
            }
        }
        setUnassignedGuests(nextUnassigned);
        setTables(nextTables);
    }
    markChanges();
  };
  
  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        await fetchProjectsAndLoadFirst(user);
      } else {
        router.push('/');
      }
    };
    initialize();
  }, [router, fetchProjectsAndLoadFirst]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [hasUnsavedChanges]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-xl">正在加载您的工作区...</div>;
  }
  
  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      {isModalOpen && <Modal onClose={() => setIsModalOpen(null)}>
        {isModalOpen === 'newProject' && <>
          <h3 className="text-xl font-bold mb-4">创建新项目</h3>
          <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="请输入项目名称" className="w-full p-2 bg-gray-700 rounded"/>
          <button onClick={handleNewProject} className="mt-4 w-full p-2 bg-green-600 rounded">创建</button>
        </>}
        {isModalOpen === 'addGuest' && <>
          <h3 className="text-xl font-bold mb-4">添加宾客</h3>
          <div className="flex justify-center mb-4 border-b border-gray-700">
            <button onClick={() => setModalInputView('manual')} className={`px-4 py-2 ${modalInputView === 'manual' ? 'border-b-2 border-blue-500' : ''}`}>手动输入</button>
            <button onClick={() => setModalInputView('import')} className={`px-4 py-2 ${modalInputView === 'import' ? 'border-b-2 border-blue-500' : ''}`}>从文件导入</button>
          </div>
          {modalInputView === 'manual' ? <>
            <textarea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="每行输入一位宾客姓名" className="w-full p-2 bg-gray-700 rounded h-40"/>
            <button onClick={handleAddGuests} className="mt-4 w-full p-2 bg-green-600 rounded">添加</button>
          </> : <>
            <p className="text-sm text-gray-400 mb-2">支持 .txt, .csv, .xlsx 文件, 每行一个名称。</p>
            <input type="file" accept=".txt,.csv,.xlsx,.xls" onChange={(e) => { if (e.target.files?.[0]) { parseFileAndAdd(e.target.files[0], 'guest'); } }} className="w-full p-2 bg-gray-700 rounded"/>
          </>}
        </>}
        {isModalOpen === 'addTable' && <>
           <h3 className="text-xl font-bold mb-4">添加新桌</h3>
          <div className="flex justify-center mb-4 border-b border-gray-700">
            <button onClick={() => setModalInputView('manual')} className={`px-4 py-2 ${modalInputView === 'manual' ? 'border-b-2 border-blue-500' : ''}`}>手动输入</button>
            <button onClick={() => setModalInputView('import')} className={`px-4 py-2 ${modalInputView === 'import' ? 'border-b-2 border-blue-500' : ''}`}>从文件导入</button>
          </div>
          {modalInputView === 'manual' ? <>
            <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="请输入桌子名称" className="w-full p-2 bg-gray-700 rounded"/>
            <button onClick={handleAddTable} className="mt-4 w-full p-2 bg-green-600 rounded">添加</button>
          </> : <>
            <p className="text-sm text-gray-400 mb-2">支持 .txt, .csv, .xlsx 文件, 每行一个名称。</p>
            <input type="file" accept=".txt,.csv,.xlsx,.xls" onChange={(e) => { if (e.target.files?.[0]) { parseFileAndAdd(e.target.files[0], 'table'); } }} className="w-full p-2 bg-gray-700 rounded"/>
          </>}
        </>}
         {isModalOpen === 'aiSeating' && <>
          <h3 className="text-xl font-bold mb-4">AI 智能排座</h3>
          <textarea value={aiGuestList} onChange={e => setAiGuestList(e.target.value)} placeholder="在此粘贴您的完整宾客名单..." className="w-full p-2 bg-gray-700 rounded h-60"/>
          <button onClick={handleAiSeating} disabled={isAiLoading} className="mt-4 w-full p-2 bg-blue-600 rounded disabled:bg-gray-500">{isAiLoading ? "生成中..." : "开始生成"}</button>
        </>}
      </Modal>}

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">确认操作</h3>
            <p className="text-gray-300 mb-6">
              请选择对宾客 "<span className="font-semibold text-white">{deleteConfirm.guestName}</span>" 的操作：
            </p>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => handleConfirmDelete('move')}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                移动到未分配区
              </button>
              <button 
                onClick={() => handleConfirmDelete('delete')}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                彻底删除宾客
              </button>
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 未分配宾客删除确认对话框 */}
      {deleteUnassignedConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">确认删除</h3>
            <p className="text-gray-300 mb-6">
              您确定要永久删除宾客 "<span className="font-semibold text-white">{deleteUnassignedConfirm.guestName}</span>" 吗？
            </p>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={handleConfirmDeleteUnassigned}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                确认删除
              </button>
              <button 
                onClick={() => setDeleteUnassignedConfirm(null)}
                className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 transition-transform transform-gpu ${notification ? 'translate-x-0' : 'translate-x-full'} ${notification?.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{notification.message}</div>}
      
      <aside className="w-64 bg-gray-800 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">SmartSeat</h1>
          <LogoutButton />
        </div>
        <button data-testid="btn-new-project" onClick={() => { setInputValue(''); setIsModalOpen('newProject'); }} className="w-full mb-4 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors">
          + 新建项目
        </button>
        <div className="flex-grow overflow-y-auto pr-2">
          {projects.map((proj) => (
            <div key={proj.id} onClick={() => handleLoadProject(proj)} className={`group p-3 rounded-md cursor-pointer mb-2 flex justify-between items-center ${currentProject?.id === proj.id ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
              <p className="font-semibold truncate">{proj.name}</p>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">🗑️</button>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-4"><p className="truncate">用户: {user?.email}</p></div>
      </aside>

      <main id="main-editor-area" className="flex-1 p-8 overflow-y-auto relative bg-gray-900">
        {currentProject && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
            <input data-testid="project-name" type="text" value={currentProject.name} onChange={(e) => { setCurrentProject(p => p ? {...p, name: e.target.value} : null); markChanges(); }} className="text-3xl font-bold bg-transparent focus:outline-none focus:bg-gray-700 rounded-md px-2 py-1 mb-6 w-full"/>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1 bg-gray-800 bg-opacity-50 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-4 text-center">未分配宾客 ({unassignedGuests.length})</h3>
                <SortableContext id="unassigned-area" items={unassignedGuests.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  <DroppableContainer id="unassigned-area" className="min-h-[100px]">
                  <div data-testid="unassigned-list" className="space-y-3">
                    {unassignedGuests.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4 border-2 border-dashed border-gray-600 rounded-md">
                        将宾客拖到此处
                      </div>
                    )}
                    {unassignedGuests.map(guest => <DraggableGuest key={guest.id} guest={guest} onDelete={(guestId) => handleDeleteGuest(guestId)}/>)}
                  </div>
                  </DroppableContainer>
                </SortableContext>
              </div>
              <div className="lg:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {tables.map(table => (
                    <div key={table.id} data-testid="table-card" className="bg-gray-800 bg-opacity-50 p-4 rounded-lg">
                      <div className="group flex justify-center items-center mb-4 border-b border-gray-700 pb-2">
                        <input type="text" value={table.tableName} onChange={(e) => { setTables(tables.map(t => t.id === table.id ? {...t, tableName: e.target.value} : t)); markChanges(); }} className="font-bold text-lg bg-transparent text-center focus:outline-none w-full"/>
                        <button onClick={() => handleDeleteTable(table.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity ml-2">🗑️</button>
                      </div>
                      <SortableContext id={table.id} items={table.guests.map(g => g.id)} strategy={verticalListSortingStrategy}>
                        <DroppableContainer id={table.id} className="min-h-[50px]">
                        <div className="space-y-3">
                          {table.guests.length === 0 && (
                            <div className="text-center text-gray-500 text-sm py-4 border-2 border-dashed border-gray-600 rounded-md">
                              将宾客拖到此处
                            </div>
                          )}
                          {table.guests.map(guest => <DraggableGuest key={guest.id} guest={guest} onDelete={(guestId) => handleRemoveGuestFromTable(guestId, table.id)} tableId={table.id} />)}
                        </div>
                        </DroppableContainer>
                      </SortableContext>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DragOverlay>{activeGuest ? <div className="p-2 bg-blue-500 rounded-md text-white shadow-lg cursor-grabbing text-sm">{activeGuest.name}</div> : null}</DragOverlay>
          </DndContext>
        )}
      </main>

      <aside className="w-72 bg-gray-800 p-6 flex flex-col gap-y-4">
        <h3 className="text-xl font-bold mb-2">控制面板</h3>
        <button data-testid="btn-save-project" onClick={handleSaveProject} disabled={isSaving || !hasUnsavedChanges} className="w-full p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
          {isSaving ? '保存中...' : (hasUnsavedChanges ? '💾 保存更改*' : '💾 全部已保存')}
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-300 select-none">
          <input
            data-testid="toggle-autosave"
            type="checkbox"
            className="accent-indigo-500"
            checked={autoSaveEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              setAutoSaveEnabled(enabled);
              if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
              }
              // 若开启自动保存且存在未保存更改，触发一次延迟保存
              if (enabled && hasUnsavedChanges && !isSaving) {
                autoSaveTimeout.current = setTimeout(() => { handleSaveProject(); }, 800);
              }
            }}
          />
          自动保存
        </label>
        <button data-testid="btn-ai-seating" onClick={() => { setAiGuestList(unassignedGuests.map(g => g.name).join('\n')); setIsModalOpen('aiSeating'); }} className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition-colors">🤖 AI 智能排座</button>
        <button data-testid="btn-export-pdf" onClick={handleExportPdf} className="w-full p-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-colors">导出为 PDF</button>
        <hr className="border-gray-700 my-2" />
  <button data-testid="btn-add-table" onClick={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen('addTable'); }} className="w-full p-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-colors">添加新桌</button>
  <button data-testid="btn-add-guest" onClick={() => { setInputValue(''); setModalInputView('manual'); setIsModalOpen('addGuest'); }} className="w-full p-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-colors">添加宾客</button>
        <div className="flex-grow"></div>
        <div className="p-4 bg-gray-900 bg-opacity-50 rounded-lg text-sm space-y-2">
          <h4 className="font-bold text-md mb-2">数据统计</h4>
          <div className="flex justify-between"><span>宾客总数:</span> <span>{stats.totalGuests}</span></div>
          <div className="flex justify-between"><span>桌子总数:</span> <span>{stats.tableCount}</span></div>
          <div className="flex justify-between"><span>平均每桌:</span> <span>{stats.avgGuestsPerTable}</span></div>
        </div>
      </aside>
    </div>
  );
}
