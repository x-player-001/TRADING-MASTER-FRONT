/**
 * 结构检测数据Hook
 * 封装结构数据获取、自动刷新和状态管理
 */

import { useState, useEffect, useCallback } from 'react';
import { structureAPI, StructureRange, StructureBreakout, StructureStatistics } from '../services/structureAPI';
import { useStructureStore } from '../stores/structureStore';

interface UseStructureDataOptions {
  symbol: string;
  interval: string;
  autoRefresh?: boolean;       // 是否自动刷新
  refreshInterval?: number;    // 刷新间隔(毫秒)
  enableRanges?: boolean;      // 是否启用区间数据
  enableBreakouts?: boolean;   // 是否启用突破信号
  enableStatistics?: boolean;  // 是否启用统计数据
}

interface UseStructureDataReturn {
  // 数据
  ranges: StructureRange[];
  breakouts: StructureBreakout[];
  statistics: StructureStatistics | null;

  // 过滤后的数据
  filteredRanges: StructureRange[];
  filteredBreakouts: StructureBreakout[];

  // 状态
  isLoading: boolean;
  error: string | null;

  // 操作
  refresh: () => Promise<void>;
  updateSignalResult: (signalId: number, result: 'win' | 'loss') => Promise<void>;
}

/**
 * 使用结构检测数据的Hook
 */
export const useStructureData = (options: UseStructureDataOptions): UseStructureDataReturn => {
  const {
    symbol,
    interval,
    autoRefresh = false,
    refreshInterval = 30000, // 默认30秒
    enableRanges = true,
    enableBreakouts = true,
    enableStatistics = true,
  } = options;

  // 状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Store
  const {
    ranges,
    breakouts,
    statistics,
    setRanges,
    setBreakouts,
    setStatistics,
    getFilteredRanges,
    getFilteredBreakouts,
  } = useStructureStore();

  /**
   * 获取结构数据
   */
  const fetchStructureData = useCallback(async () => {
    if (!symbol || !interval) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const promises: Promise<any>[] = [];

      // 根据配置决定获取哪些数据
      if (enableRanges) {
        promises.push(
          structureAPI.getRanges({
            symbol,
            interval,
            status: 'active',
            limit: 5,
          })
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (enableBreakouts) {
        promises.push(
          structureAPI.getBreakouts({
            symbol,
            interval,
            status: 'pending',
            limit: 10,
          })
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (enableStatistics) {
        promises.push(
          structureAPI.getStatistics({
            symbol,
            interval,
            days: 30,
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      const [rangesData, breakoutsData, statisticsData] = await Promise.all(promises);

      // 更新store
      if (enableRanges && rangesData) {
        setRanges(rangesData);
      }
      if (enableBreakouts && breakoutsData) {
        setBreakouts(breakoutsData);
      }
      if (enableStatistics && statisticsData) {
        setStatistics(statisticsData);
      }

      console.log('[useStructureData] 数据获取成功:', {
        ranges: rangesData?.length || 0,
        breakouts: breakoutsData?.length || 0,
        statistics: statisticsData ? 'loaded' : 'null',
      });
    } catch (err: any) {
      const errorMsg = err?.message || '获取结构数据失败';
      setError(errorMsg);
      console.error('[useStructureData] 数据获取失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    symbol,
    interval,
    enableRanges,
    enableBreakouts,
    enableStatistics,
    setRanges,
    setBreakouts,
    setStatistics,
  ]);

  /**
   * 更新信号结果
   */
  const updateSignalResult = useCallback(
    async (signalId: number, result: 'win' | 'loss') => {
      try {
        await structureAPI.updateSignalResult(signalId, { result });

        // 重新获取数据
        await fetchStructureData();

        console.log(`[useStructureData] 信号结果已更新: ${signalId} -> ${result}`);
      } catch (err: any) {
        const errorMsg = err?.message || '更新信号结果失败';
        setError(errorMsg);
        console.error('[useStructureData] 更新信号结果失败:', err);
        throw err;
      }
    },
    [fetchStructureData]
  );

  /**
   * 初始加载
   */
  useEffect(() => {
    fetchStructureData();
  }, [fetchStructureData]);

  /**
   * 自动刷新
   */
  useEffect(() => {
    if (!autoRefresh || !symbol || !interval) {
      return;
    }

    const timer = setInterval(() => {
      fetchStructureData();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, symbol, interval, fetchStructureData]);

  /**
   * 获取过滤后的数据
   */
  const filteredRanges = getFilteredRanges();
  const filteredBreakouts = getFilteredBreakouts();

  return {
    // 原始数据
    ranges,
    breakouts,
    statistics,

    // 过滤后的数据
    filteredRanges,
    filteredBreakouts,

    // 状态
    isLoading,
    error,

    // 操作
    refresh: fetchStructureData,
    updateSignalResult,
  };
};

export default useStructureData;
