/**
 * K线数据自定义Hook
 * 封装K线数据获取、自动刷新、统计计算等逻辑
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useKlineStore } from '../stores/klineStore';
import { klineAPI, klineUtils } from '../services/klineAPI';
import type { KlineInterval } from '../types/kline';

/**
 * Hook配置选项
 */
interface UseKlineDataOptions {
  autoRefresh?: boolean;      // 是否自动刷新，默认true
  refreshInterval?: number;   // 刷新间隔(毫秒)，默认5000 (5秒)
  limit?: number;             // 获取K线数量，默认100
  fetchOnMount?: boolean;     // 挂载时是否立即获取数据，默认true
}

/**
 * K线数据Hook
 * @param options 配置选项
 */
export const useKlineData = (options: UseKlineDataOptions = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 5000,
    limit = 100,
    fetchOnMount = true,
  } = options;

  const {
    selectedSymbol,
    selectedInterval,
    klines,
    isLoading,
    error,
    lastUpdate,
    integrity,
    stats,
    setKlines,
    setLoading,
    setError,
    updateStats,
    setAutoRefresh,
  } = useKlineStore();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取K线数据
   */
  const fetchKlines = useCallback(async () => {
    if (!selectedSymbol || !selectedInterval) return;

    try {
      setLoading(true);
      setError(null);

      // 调用API获取最新K线数据
      const response = await klineAPI.getLatestKlines(
        selectedSymbol,
        selectedInterval,
        limit
      );

      // 设置K线数据
      setKlines(response.klines);

      // 计算统计数据
      const calculatedStats = klineUtils.calculateStats(response.klines);
      updateStats(calculatedStats);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取K线数据失败';
      console.error('Failed to fetch klines:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, selectedInterval, limit, setKlines, setLoading, setError, updateStats]);

  /**
   * 获取数据完整性信息
   */
  const fetchIntegrity = useCallback(async (days = 1) => {
    if (!selectedSymbol || !selectedInterval) return;

    try {
      const integrityData = await klineAPI.checkIntegrity(
        selectedSymbol,
        selectedInterval,
        days
      );
      useKlineStore.getState().setIntegrity(integrityData);
    } catch (err) {
      console.error('Failed to fetch integrity:', err);
    }
  }, [selectedSymbol, selectedInterval]);

  /**
   * 按时间范围获取K线
   */
  const fetchKlinesByRange = useCallback(async (
    startTime: number,
    endTime: number,
    rangeLimit = 1000
  ) => {
    if (!selectedSymbol || !selectedInterval) return;

    try {
      setLoading(true);
      setError(null);

      const response = await klineAPI.getKlinesByRange(
        selectedSymbol,
        selectedInterval,
        startTime,
        endTime,
        rangeLimit
      );

      setKlines(response.klines);

      const calculatedStats = klineUtils.calculateStats(response.klines);
      updateStats(calculatedStats);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取历史K线数据失败';
      console.error('Failed to fetch klines by range:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, selectedInterval, setKlines, setLoading, setError, updateStats]);

  /**
   * 手动刷新
   */
  const refresh = useCallback(() => {
    fetchKlines();
  }, [fetchKlines]);

  /**
   * 清理定时器
   */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * 启动自动刷新
   */
  const startAutoRefresh = useCallback(() => {
    clearTimer();
    if (autoRefresh && refreshInterval > 0) {
      timerRef.current = setInterval(fetchKlines, refreshInterval);
    }
  }, [autoRefresh, refreshInterval, fetchKlines, clearTimer]);

  /**
   * 停止自动刷新
   */
  const stopAutoRefresh = useCallback(() => {
    clearTimer();
    setAutoRefresh(false);
  }, [clearTimer, setAutoRefresh]);

  /**
   * 初始化和自动刷新逻辑
   */
  useEffect(() => {
    // 挂载时立即获取数据
    if (fetchOnMount) {
      fetchKlines();
    }

    // 启动自动刷新
    startAutoRefresh();

    // 清理函数
    return () => {
      clearTimer();
    };
  }, [selectedSymbol, selectedInterval, autoRefresh, refreshInterval]);

  /**
   * 返回数据和操作方法
   */
  return {
    // 数据
    klines,
    isLoading,
    error,
    lastUpdate,
    integrity,
    stats,
    selectedSymbol,
    selectedInterval,

    // 操作方法
    refresh,                    // 手动刷新
    fetchKlines,                // 获取K线数据
    fetchIntegrity,             // 获取完整性信息
    fetchKlinesByRange,         // 按时间范围获取
    startAutoRefresh,           // 启动自动刷新
    stopAutoRefresh,            // 停止自动刷新
  };
};

/**
 * 获取TOP币种概览的Hook
 */
export const useTopSymbolsOverview = (interval: KlineInterval = '1m', limit = 10) => {
  const [overview, setOverview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await klineAPI.getTopSymbolsOverview(interval, limit);
      setOverview(response);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取TOP币种概览失败';
      console.error('Failed to fetch top symbols overview:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [interval, limit]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return {
    overview,
    isLoading,
    error,
    refresh: fetchOverview,
  };
};
