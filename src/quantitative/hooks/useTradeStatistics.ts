/**
 * 量化交易 - 交易统计Hook
 */

import { useCallback, useEffect } from 'react';
import { useTradeStore } from '../stores/tradeStore';
import { tradeAPI } from '../services';
import { TradeListParams, TradeStatisticsParams } from '../types';

export const useTradeStatistics = () => {
  const {
    trades,
    statistics,
    isLoading,
    error,
    setTrades,
    setStatistics,
    setLoading,
    setError,
  } = useTradeStore();

  // 获取交易列表
  const fetchTrades = useCallback(async (params?: TradeListParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await tradeAPI.getTrades(params);
      setTrades(data);
    } catch (err: any) {
      setError(err.message || '获取交易列表失败');
    } finally {
      setLoading(false);
    }
  }, [setTrades, setLoading, setError]);

  // 获取交易统计
  const fetchStatistics = useCallback(async (params?: TradeStatisticsParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await tradeAPI.getTradeStatistics(params);
      setStatistics(data);
    } catch (err: any) {
      setError(err.message || '获取交易统计失败');
    } finally {
      setLoading(false);
    }
  }, [setStatistics, setLoading, setError]);

  // 按回测获取交易
  const fetchTradesByBacktest = useCallback(async (backtestId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await tradeAPI.getTradesByBacktest(backtestId);
      setTrades(data);
    } catch (err: any) {
      setError(err.message || '获取回测交易失败');
    } finally {
      setLoading(false);
    }
  }, [setTrades, setLoading, setError]);

  return {
    trades,
    statistics,
    isLoading,
    error,
    fetchTrades,
    fetchStatistics,
    fetchTradesByBacktest,
  };
};
