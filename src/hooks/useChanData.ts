/**
 * 缠论数据Hook
 * 管理分型、笔、中枢数据的获取和状态
 */

import { useState, useEffect, useCallback } from 'react';
import { chanAPI, ChanAnalysisData } from '../services/chanAPI';

export interface UseChanDataOptions {
  symbol: string;
  interval: string;
  lookback?: number;          // 回溯K线数量 (默认200)
  autoRefresh?: boolean;      // 是否自动刷新
  refreshInterval?: number;   // 刷新间隔(毫秒, 默认30000)
}

export interface UseChanDataReturn {
  // 数据
  chanData: ChanAnalysisData | null;

  // 加载状态
  isLoading: boolean;
  error: Error | null;

  // 操作方法
  refresh: () => Promise<void>;
}

/**
 * 缠论数据Hook
 */
export const useChanData = (options: UseChanDataOptions): UseChanDataReturn => {
  const {
    symbol,
    interval,
    lookback = 200,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const [chanData, setChanData] = useState<ChanAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 获取缠论数据
  const fetchChanData = useCallback(async () => {
    if (!symbol || !interval) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await chanAPI.getChanAnalysis({
        symbol,
        interval,
        lookback,
      });

      setChanData(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('获取缠论数据失败');
      setError(error);
      console.error('[useChanData] 获取缠论数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, interval, lookback]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await fetchChanData();
  }, [fetchChanData]);

  // 初始加载
  useEffect(() => {
    fetchChanData();
  }, [fetchChanData]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      fetchChanData();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, fetchChanData]);

  return {
    chanData,
    isLoading,
    error,
    refresh,
  };
};

export default useChanData;
