/**
 * Modal 类型常量
 * 
 * 用于定义所有 Modal 弹窗的类型,避免魔法字符串和拼写错误
 */

export const MODAL_TYPES = {
  NEW_PROJECT: 'newProject',
  ADD_GUEST: 'addGuest',
  ADD_TABLE: 'addTable',
  AI_SEATING: 'aiSeating',
  ADD_RULE: 'addRule',
  CHECK_IN: 'checkIn',
  INVITE_COLLABORATOR: 'inviteCollaborator',
} as const;

// 导出类型
export type ModalType = typeof MODAL_TYPES[keyof typeof MODAL_TYPES] | null;
