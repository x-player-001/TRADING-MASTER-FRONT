/**
 * 市场数据Hook
 * 用于获取和管理市场概览数据
 */

import { useState, useEffect, useCallback } from 'react';
import { marketAPI, MarketDataItem } from '../services/marketAPI';

interface UseMarketDataOptions {
  limit?: number;           // 获取币种数量，默认10
  autoRefresh?: boolean;    // 是否自动刷新，默认true
  refreshInterval?: number; // 刷新间隔（毫秒），默认60秒
}

interface UseMarketDataReturn {
  data: MarketDataItem[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdate: number | null;
}

/**
 * 使用市场数据Hook
 * @param options 配置选项
 * @returns 市场数据和相关方法
 */
export const useMarketData = (options: UseMarketDataOptions = {}): UseMarketDataReturn => {
  const {
    limit = 10,
    autoRefresh = true,
    refreshInterval = 60000, // 60秒
  } = options;

  const [data, setData] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  /**
   * 获取市场数据
   */
  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const marketData = await marketAPI.getMarketOverview(limit);
      setData(marketData);
      setLastUpdate(Date.now());

      console.log(`✅ 市场数据更新成功，共 ${marketData.length} 个币种`);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('❌ 获取市场数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  /**
   * 手动刷新数据
   */
  const refresh = useCallback(async () => {
    await fetchMarketData();
  }, [fetchMarketData]);

  // 初始加载
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) {
      return;
    }

    const timer = setInterval(() => {
      fetchMarketData();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, fetchMarketData]);

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdate,
  };
};

/**
 * 使用单个币种的市场数据Hook
 * @param symbol 币种符号
 * @returns 单个币种的市场数据
 */
export const useSingleMarketData = (symbol: string) => {
  const [data, setData] = useState<MarketDataItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const marketData = await marketAPI.getSingleMarketData(symbol);
      setData(marketData);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error(`❌ 获取币种 ${symbol} 市场数据失败:`, error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  };
};
