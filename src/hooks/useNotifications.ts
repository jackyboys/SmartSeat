import { useState, useCallback, useRef } from 'react';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  type: NotificationType;
  message: string;
}

/**
 * useNotifications Hook
 * 
 * 封装通知显示和隐藏的逻辑
 * 
 * @param duration - 通知显示持续时间(毫秒), 默认 3000ms
 * @returns {
 *   notification - 当前通知对象或 null
 *   showNotification - 显示通知的函数
 *   hideNotification - 立即隐藏通知的函数
 * }
 * 
 * @example
 * const { notification, showNotification, hideNotification } = useNotifications();
 * 
 * // 显示成功通知
 * showNotification('操作成功！', 'success');
 * 
 * // 显示错误通知
 * showNotification('操作失败', 'error');
 * 
 * // 显示提示信息
 * showNotification('请注意', 'info');
 * 
 * // 手动隐藏通知
 * hideNotification();
 */
export function useNotifications(duration: number = 3000) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 显示通知
   * @param message - 通知消息内容
   * @param type - 通知类型: 'success' | 'error' | 'info'
   */
  const showNotification = useCallback((
    message: string, 
    type: NotificationType = 'success'
  ) => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 设置新通知
    setNotification({ message, type });

    // 设置自动隐藏定时器
    timeoutRef.current = setTimeout(() => {
      setNotification(null);
      timeoutRef.current = null;
    }, duration);
  }, [duration]);

  /**
   * 立即隐藏通知
   */
  const hideNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    hideNotification,
  };
}
