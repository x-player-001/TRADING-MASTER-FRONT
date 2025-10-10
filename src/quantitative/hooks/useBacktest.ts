/**
 * 量化交易 - 回测执行Hook
 */

import { useCallback } from 'react';
import { useBacktestStore } from '../stores/backtestStore';
import { backtestAPI } from '../services';
import { BacktestRequest, BestMetric } from '../types';

export const useBacktest = () => {
  const {
    backtests,
    selectedBacktest,
    backtestTrades,
    isRunning,
    isLoading,
    error,
    setBacktests,
    addBacktest,
    removeBacktest,
    selectBacktest,
    setBacktestTrades,
    setRunning,
    setLoading,
    setError,
  } = useBacktestStore();

  // 运行回测
  const runBacktest = useCallback(async (request: BacktestRequest) => {
    setRunning(true);
    setError(null);
    try {
      const result = await backtestAPI.runBacktest(request);
      addBacktest(result);
      selectBacktest(result);
      return result;
    } catch (err: any) {
      setError(err.message || '回测执行失败');
      throw err;
    } finally {
      setRunning(false);
    }
  }, [addBacktest, selectBacktest, setRunning, setError]);

  // 获取回测列表
  const fetchBacktests = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    try {
      const data = await backtestAPI.getBacktestResults(params);
      setBacktests(data);
    } catch (err: any) {
      setError(err.message || '获取回测列表失败');
    } finally {
      setLoading(false);
    }
  }, [setBacktests, setLoading, setError]);

  // 获取回测详情
  const fetchBacktestDetail = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await backtestAPI.getBacktestDetail(id);
      selectBacktest(data);
      return data;
    } catch (err: any) {
      setError(err.message || '获取回测详情失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectBacktest, setLoading, setError]);

  // 获取回测交易明细
  const fetchBacktestTrades = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await backtestAPI.getBacktestTrades(id);
      setBacktestTrades(data);
    } catch (err: any) {
      setError(err.message || '获取交易明细失败');
    } finally {
      setLoading(false);
    }
  }, [setBacktestTrades, setLoading, setError]);

  // 获取最佳回测
  const fetchBestBacktest = useCallback(async (strategyId: number, metric: BestMetric = 'sharpe_ratio') => {
    setLoading(true);
    setError(null);
    try {
      const data = await backtestAPI.getBestBacktest(strategyId, metric);
      selectBacktest(data);
      return data;
    } catch (err: any) {
      setError(err.message || '获取最佳回测失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectBacktest, setLoading, setError]);

  // 删除回测
  const deleteBacktest = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await backtestAPI.deleteBacktest(id);
      removeBacktest(id);
    } catch (err: any) {
      setError(err.message || '删除回测失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [removeBacktest, setLoading, setError]);

  return {
    backtests,
    selectedBacktest,
    backtestTrades,
    isRunning,
    isLoading,
    error,
    selectBacktest,
    runBacktest,
    fetchBacktests,
    fetchBacktestDetail,
    fetchBacktestTrades,
    fetchBestBacktest,
    deleteBacktest,
  };
};
