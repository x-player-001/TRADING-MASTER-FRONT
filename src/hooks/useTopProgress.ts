import { useState, useCallback, useRef } from 'react';

interface UseTopProgressReturn {
  isVisible: boolean;
  progress: number;
  start: () => void;
  finish: () => void;
  setProgress: (progress: number) => void;
  reset: () => void;
}

/**
 * 顶部进度条Hook
 * 提供进度条的状态管理和控制方法
 */
export const useTopProgress = (): UseTopProgressReturn => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgressState] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const start = useCallback(() => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsVisible(true);
    setProgressState(0);

    // 自动进度到85%
    timeoutRef.current = setTimeout(() => {
      setProgressState(85);
    }, 100);
  }, []);

  const finish = useCallback(() => {
    // 清除定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 快速完成到100%
    setProgressState(100);

    // 延迟隐藏
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setProgressState(0);
    }, 300);
  }, []);

  const setProgress = useCallback((newProgress: number) => {
    const clampedProgress = Math.max(0, Math.min(100, newProgress));
    setProgressState(clampedProgress);

    if (!isVisible && clampedProgress > 0) {
      setIsVisible(true);
    }
  }, [isVisible]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setProgressState(0);
  }, []);

  return {
    isVisible,
    progress,
    start,
    finish,
    setProgress,
    reset
  };
};