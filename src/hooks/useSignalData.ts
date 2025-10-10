/**
 * 信号数据Hook
 * 封装信号数据获取逻辑，支持自动刷新和错误处理
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSignalStore } from '../stores/signalStore';
import { signalAPI } from '../services/signalAPI';

/**
 * Hook配置选项
 */
export interface UseSignalDataOptions {
  symbol: string; // 币种符号
  interval: string; // 时间周期
  autoRefresh?: boolean; // 是否自动刷新，默认false
  refreshInterval?: number; // 刷新间隔(毫秒)，默认30秒
  limit?: number; // 获取信号数量，默认20
  enabled?: boolean; // 是否启用数据获取，默认true
}

/**
 * 信号数据Hook
 */
export const useSignalData = (options: UseSignalDataOptions) => {
  const {
    symbol,
    interval,
    autoRefresh = false,
    refreshInterval = 30000, // 30秒
    limit = 20,
    enabled = true,
  } = options;

  const {
    signals,
    isLoading,
    error,
    lastUpdate,
    filter,
    setSignals,
    setLoading,
    setError,
    setLastUpdate,
    getFilteredSignals,
    getLatestSignal,
  } = useSignalStore();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * 获取历史信号数据
   */
  const fetchSignals = useCallback(async () => {
    if (!enabled || !symbol || !interval) return;

    try {
      setLoading(true);
      setError(null);

      const response = await signalAPI.getHistorySignals(symbol, interval, undefined, undefined, limit);

      if (isMountedRef.current) {
        setSignals(response.signals || []);
        setLastUpdate(Date.now());
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMsg = err instanceof Error ? err.message : '获取信号失败';
        setError(errorMsg);
        console.error('获取信号失败:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, symbol, interval, limit, setSignals, setLoading, setError, setLastUpdate]);

  /**
   * 获取最新信号（用于轮询）
   */
  const fetchLatestSignal = useCallback(async () => {
    if (!enabled || !symbol || !interval) return;

    try {
      const response = await signalAPI.getLatestSignals(symbol, interval, 1);

      if (isMountedRef.current && response.signals && response.signals.length > 0) {
        const latestSignal = response.signals[0];
        const currentLatest = getLatestSignal();

        // 只有当信号ID不同时才更新（避免重复）
        if (!currentLatest || latestSignal.id !== currentLatest.id) {
          // 重新获取完整列表
          await fetchSignals();
        }
      }
    } catch (err) {
      console.error('获取最新信号失败:', err);
      // 不设置错误状态，避免轮询时频繁报错
    }
  }, [enabled, symbol, interval, getLatestSignal, fetchSignals]);

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    await fetchSignals();
  }, [fetchSignals]);

  /**
   * 生成测试信号
   */
  const generateSignal = useCallback(async () => {
    if (!symbol || !interval) return null;

    try {
      setLoading(true);
      const response = await signalAPI.generateSignal(symbol, interval, 100);

      if (response.signal) {
        // 刷新信号列表以包含新生成的信号
        await fetchSignals();
        return response.signal;
      }

      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '生成信号失败';
      setError(errorMsg);
      console.error('生成信号失败:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, setLoading, setError, fetchSignals]);

  /**
   * 初始加载
   */
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && symbol && interval) {
      fetchSignals();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, symbol, interval, fetchSignals]);

  /**
   * 自动刷新
   */
  useEffect(() => {
    if (!autoRefresh || !enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 启动定时器
    timerRef.current = setInterval(() => {
      fetchLatestSignal();
    }, refreshInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, enabled, refreshInterval, fetchLatestSignal]);

  return {
    // 数据
    signals,
    filteredSignals: getFilteredSignals(),
    latestSignal: getLatestSignal(),

    // 状态
    isLoading,
    error,
    lastUpdate,

    // 过滤器
    filter,

    // Actions
    refresh,
    generateSignal,
  };
};
