import { useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// 导入类型定义
interface Guest {
  id: string;
  name: string;
  status?: 'confirmed' | 'unconfirmed' | 'cancelled' | 'checked-in';
  avatarUrl?: string;
  locked?: boolean;
  checkInTime?: string;
}

interface SeatingTable {
  id: string;
  tableName: string;
  guests: Guest[];
  capacity: number;
}

type NotTogetherRule = [string, string];

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

/**
 * useProjectManager Hook
 * 
 * 封装项目管理的所有异步逻辑
 * 包括获取、保存、创建、删除、重命名项目等操作
 * 
 * @param options - 配置选项
 * @param options.onNotification - 通知回调函数
 * @param options.onConfirm - 确认对话框回调函数
 * 
 * @returns {
 *   projects - 项目列表
 *   currentProject - 当前项目
 *   isSaving - 是否正在保存
 *   hasUnsavedChanges - 是否有未保存的更改
 *   fetchProjectsAndLoadFirst - 获取项目列表并加载第一个
 *   saveProject - 保存当前项目
 *   createProject - 创建新项目
 *   deleteProject - 删除项目
 *   renameProject - 重命名项目
 *   loadProject - 加载指定项目
 *   setCurrentProject - 设置当前项目
 *   markAsChanged - 标记为有未保存的更改
 *   clearChanges - 清除未保存更改标记
 * }
 */
export function useProjectManager(options: {
  onNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  onConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    type?: 'warning' | 'danger' | 'info',
    onCancel?: () => void
  ) => void;
}) {
  const { onNotification, onConfirm } = options;
  const supabase = createClient();

  // 状态管理
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /**
   * 获取所有项目并加载第一个
   */
  const fetchProjectsAndLoadFirst = useCallback(async (
    user: User,
    setTables: (tables: SeatingTable[]) => void,
    setUnassignedGuests: (guests: Guest[]) => void,
    setIsLoading: (loading: boolean) => void
  ) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, layout_data, user_id, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        onNotification(`加载项目失败: ${error.message}`, 'error');
        setProjects([]);
        setIsLoading(false);
        return;
      }

      setProjects(data || []);
      
      if (data && data.length > 0) {
        // 加载第一个项目
        const projectToLoad = data[0];
        setCurrentProject(projectToLoad);
        
        const layout = projectToLoad.layout_data;
        const normalizedTables = layout?.tables.map((t: SeatingTable) => ({
          ...t,
          id: t.id || uuidv4(),
          capacity: t.capacity || 10,
          guests: t.guests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() }))
        })) || [];
        
        const normalizedGuests = layout?.unassignedGuests.map((g: Guest) => ({
          ...g, 
          id: g.id || uuidv4()
        })) || [];
        
        setTables(normalizedTables);
        setUnassignedGuests(normalizedGuests);
      } else {
        // 没有项目,创建默认项目
        const newProj: Project = {
          id: -1,
          name: '我的第一个项目',
          layout_data: { tables: [], unassignedGuests: [] }
        };
        setCurrentProject(newProj);
        setTables([]);
        setUnassignedGuests([]);
      }
      
      setIsLoading(false);
    } catch (err: any) {
      onNotification(`加载项目时出错: ${err.message}`, 'error');
      setIsLoading(false);
    }
  }, [supabase, onNotification]);

  /**
   * 保存当前项目
   */
  const saveProject = useCallback(async (
    user: User | null,
    tables: SeatingTable[],
    unassignedGuests: Guest[]
  ): Promise<Project | null> => {
    if (!currentProject || !user || isSaving) return null;

    setIsSaving(true);
    
    const layout_data = {
      tables,
      unassignedGuests,
      rules: currentProject.layout_data?.rules || { notTogether: [] }
    };

    let savedProject: Project | null = null;

    try {
      if (currentProject.id < 0) {
        // 创建新项目
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: currentProject.name,
            layout_data,
            user_id: user.id
          })
          .select()
          .single();

        if (error) {
          onNotification(`创建失败: ${error.message}`, 'error');
        } else if (data) {
          onNotification('项目已创建并保存！', 'success');
          savedProject = data;
          
          // 更新项目列表
          const newProjects = projects.map(p => 
            p.id === currentProject.id ? data : p
          );
          setProjects(newProjects);
          setCurrentProject(data);
        }
      } else {
        // 更新现有项目
        const { error } = await supabase
          .from('projects')
          .update({ name: currentProject.name, layout_data })
          .eq('id', currentProject.id);

        if (error) {
          onNotification(`保存失败: ${error.message}`, 'error');
        } else {
          onNotification('项目已保存！', 'success');
          savedProject = { ...currentProject, layout_data };
          
          // 更新项目列表
          setProjects(projects.map(p =>
            p.id === currentProject.id
              ? { ...p, name: currentProject.name, layout_data }
              : p
          ));
        }
      }
      
      setHasUnsavedChanges(false);
    } catch (err: any) {
      onNotification(`保存出错: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }

    return savedProject;
  }, [currentProject, projects, isSaving, supabase, onNotification]);

  /**
   * 加载指定项目
   */
  const loadProject = useCallback(async (
    project: Project,
    setTables: (tables: SeatingTable[]) => void,
    setUnassignedGuests: (guests: Guest[]) => void,
    user: User | null,
    tables: SeatingTable[],
    unassignedGuests: Guest[]
  ) => {
    // 如果已经是当前项目,不做任何操作
    if (currentProject?.id === project.id) return;

    const doLoad = () => {
      setCurrentProject(project);
      const layout = project.layout_data;
      
      const normalizedTables = layout?.tables.map((t: SeatingTable) => ({
        ...t,
        id: t.id || uuidv4(),
        capacity: t.capacity || 10,
        guests: t.guests.map((g: Guest) => ({ ...g, id: g.id || uuidv4() }))
      })) || [];
      
      const normalizedGuests = layout?.unassignedGuests.map((g: Guest) => ({
        ...g,
        id: g.id || uuidv4()
      })) || [];
      
      setTables(normalizedTables);
      setUnassignedGuests(normalizedGuests);
      setHasUnsavedChanges(false);
    };

    // 如果有未保存的更改,询问用户
    if (hasUnsavedChanges) {
      onConfirm(
        '未保存的更改',
        '您有未保存的更改。是否要在切换前保存？\n\n点击"确定"保存并切换\n点击"取消"放弃更改并切换',
        async () => {
          await saveProject(user, tables, unassignedGuests);
          doLoad();
        },
        'warning',
        () => {
          setHasUnsavedChanges(false);
          doLoad();
        }
      );
      return;
    }

    doLoad();
  }, [currentProject, hasUnsavedChanges, saveProject, onConfirm]);

  /**
   * 创建新项目
   */
  const createProject = useCallback((
    projectName: string,
    user: User | null,
    tables: SeatingTable[],
    unassignedGuests: Guest[],
    setTables: (tables: SeatingTable[]) => void,
    setUnassignedGuests: (guests: Guest[]) => void
  ) => {
    if (!projectName.trim()) {
      onNotification('项目名称不能为空', 'error');
      return;
    }

    const doCreate = () => {
      const tempId = -Date.now();
      const newProj: Project = {
        id: tempId,
        name: projectName,
        user_id: user?.id,
        layout_data: {
          tables: [],
          unassignedGuests: [],
          rules: { notTogether: [] }
        }
      };
      
      setProjects([newProj, ...projects]);
      loadProject(newProj, setTables, setUnassignedGuests, user, tables, unassignedGuests);
    };

    if (hasUnsavedChanges) {
      onConfirm(
        '未保存的更改',
        '您有未保存的更改，确定要创建新项目吗？所有未保存的更改将丢失。',
        doCreate,
        'warning'
      );
      return;
    }

    doCreate();
  }, [projects, hasUnsavedChanges, loadProject, onNotification, onConfirm]);

  /**
   * 删除项目
   */
  const deleteProject = useCallback(async (
    projectId: number,
    setTables: (tables: SeatingTable[]) => void,
    setUnassignedGuests: (guests: Guest[]) => void,
    user: User | null,
    tables: SeatingTable[],
    unassignedGuests: Guest[]
  ) => {
    onConfirm(
      '确认删除',
      '您确定要删除此项目吗？此操作无法撤销。',
      async () => {
        // 如果是临时项目(id < 0),直接从列表中删除
        if (projectId < 0) {
          const newProjects = projects.filter(p => p.id !== projectId);
          setProjects(newProjects);
          onNotification('项目已成功删除');
          
          if (newProjects.length > 0) {
            loadProject(newProjects[0], setTables, setUnassignedGuests, user, tables, unassignedGuests);
          } else {
            const newProj: Project = {
              id: -Date.now(),
              name: '新项目',
              layout_data: null
            };
            setCurrentProject(newProj);
            setTables([]);
            setUnassignedGuests([]);
          }
          return;
        }

        // 从数据库删除
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (error) {
          onNotification(`删除失败: ${error.message}`, 'error');
        } else {
          onNotification('项目已成功删除');
          const newProjects = projects.filter(p => p.id !== projectId);
          setProjects(newProjects);
          
          // 如果删除的是当前项目,加载另一个项目
          if (currentProject?.id === projectId) {
            if (newProjects.length > 0) {
              loadProject(newProjects[0], setTables, setUnassignedGuests, user, tables, unassignedGuests);
            } else {
              const newProj: Project = {
                id: -Date.now(),
                name: '新项目',
                layout_data: null
              };
              setCurrentProject(newProj);
              setTables([]);
              setUnassignedGuests([]);
            }
          }
        }
      },
      'danger'
    );
  }, [projects, currentProject, loadProject, supabase, onNotification, onConfirm]);

  /**
   * 重命名项目
   */
  const renameProject = useCallback(async (
    projectId: number,
    newName: string
  ) => {
    if (!newName.trim()) {
      onNotification('项目名称不能为空', 'error');
      return false;
    }

    if (projectId < 0) {
      // 临时项目,只更新本地状态
      setProjects(projects.map(p =>
        p.id === projectId ? { ...p, name: newName } : p
      ));
      
      if (currentProject?.id === projectId) {
        setCurrentProject({ ...currentProject, name: newName });
      }
      
      return true;
    }

    // 持久化项目,更新数据库
    const { error } = await supabase
      .from('projects')
      .update({ name: newName })
      .eq('id', projectId);

    if (error) {
      onNotification(`重命名失败: ${error.message}`, 'error');
      return false;
    }

    setProjects(projects.map(p =>
      p.id === projectId ? { ...p, name: newName } : p
    ));
    
    if (currentProject?.id === projectId) {
      setCurrentProject({ ...currentProject, name: newName });
    }
    
    onNotification('项目已重命名');
    return true;
  }, [projects, currentProject, supabase, onNotification]);

  /**
   * 标记为有未保存的更改
   */
  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  /**
   * 清除未保存更改标记
   */
  const clearChanges = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  return {
    // 状态
    projects,
    currentProject,
    isSaving,
    hasUnsavedChanges,
    
    // 方法
    fetchProjectsAndLoadFirst,
    saveProject,
    loadProject,
    createProject,
    deleteProject,
    renameProject,
    setCurrentProject,
    markAsChanged,
    clearChanges,
  };
}
